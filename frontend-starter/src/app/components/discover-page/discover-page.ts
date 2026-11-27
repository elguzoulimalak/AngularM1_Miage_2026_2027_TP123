import { Component, OnDestroy, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Track } from '../../shared/models/track.model';
import { AuthService } from '../../shared/services/auth.service';
import { TrackService } from '../../shared/services/track.service';

const PAGE_SIZE = 10;

/**
 * TP4 : page « Découvrir ». Liste les pistes publiques de tous les
 * utilisateurs, des plus récentes aux plus anciennes, avec une recherche
 * par titre et la lecture audio.
 */
@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './discover-page.html',
  styleUrl: './discover-page.css',
})
export class DiscoverPageComponent implements OnDestroy {
  private readonly service = inject(TrackService);
  private readonly auth = inject(AuthService);

  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly search = new FormControl('', { nonNullable: true });
  readonly activeSearch = signal('');

  readonly audioUrl = signal('');
  readonly playingId = signal<string | null>(null);
  readonly playingTitle = signal('');
  readonly loadingAudioId = signal<string | null>(null);
  readonly playError = signal('');

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service.listPublic(this.page(), PAGE_SIZE, this.activeSearch()).subscribe({
      next: (response) => {
        this.tracks.set(response.items);
        this.pages.set(response.pages);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message ?? 'Impossible de charger les pistes publiques.');
        this.loading.set(false);
      },
    });
  }

  applySearch(): void {
    this.activeSearch.set(this.search.value.trim());
    this.page.set(1);
    this.load();
  }

  clearSearch(): void {
    this.search.setValue('');
    this.applySearch();
  }

  go(page: number): void {
    this.page.set(page);
    this.load();
  }

  /** True when the track belongs to the logged-in user. */
  isMine(track: Track): boolean {
    const me = this.auth.currentUser();
    return !!me && me.id === track.ownerId;
  }

  play(track: Track): void {
    if (this.loadingAudioId()) return;
    this.playError.set('');
    this.loadingAudioId.set(track.id);
    this.service.audio(track.id).subscribe({
      next: (blob) => {
        this.loadingAudioId.set(null);
        const previousUrl = this.audioUrl();
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        this.audioUrl.set(URL.createObjectURL(blob));
        this.playingId.set(track.id);
        this.playingTitle.set(track.title);
      },
      error: (err: HttpErrorResponse) => {
        this.loadingAudioId.set(null);
        if (err.status === 401) return; // géré par l'intercepteur
        this.playError.set(
          err.status === 404
            ? `« ${track.title} » n'est plus disponible : elle a été supprimée ou rendue privée.`
            : `Impossible de charger « ${track.title} ». Réessayez.`,
        );
      },
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  ngOnDestroy(): void {
    const url = this.audioUrl();
    if (url) URL.revokeObjectURL(url);
  }
}

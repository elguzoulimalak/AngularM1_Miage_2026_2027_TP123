import { Component, OnDestroy, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ActivityItem } from '../../shared/models/activity.model';
import { FriendService } from '../../shared/services/friend.service';
import { Track } from '../../shared/models/track.model';
import { AuthService } from '../../shared/services/auth.service';
import { TrackService } from '../../shared/services/track.service';

const PAGE_SIZE = 10;
const ACTIVITY_SIZE = 8;

/** Which list is shown: public tracks, or tracks friends shared with me. */
export type DiscoverTab = 'public' | 'shared';

/**
 * TP4 : page « Découvrir ». Liste les pistes publiques de tous les
 * utilisateurs, des plus récentes aux plus anciennes, avec une recherche
 * par titre et la lecture audio.
 * TP4 étape 2 : onglet « Partagées avec moi » pour les pistes privées
 * que des amis ont partagées.
 * TP4 étape 3 : bloc « Activité de mes amis ».
 */
@Component({
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './discover-page.html',
  styleUrl: './discover-page.css',
})
export class DiscoverPageComponent implements OnDestroy {
  private readonly service = inject(TrackService);
  private readonly auth = inject(AuthService);
  private readonly friendService = inject(FriendService);

  readonly tab = signal<DiscoverTab>('public');
  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly search = new FormControl('', { nonNullable: true });
  readonly activeSearch = signal('');

  readonly activity = signal<ActivityItem[]>([]);
  readonly activityLoading = signal(false);
  readonly activityError = signal('');

  readonly audioUrl = signal('');
  readonly playingId = signal<string | null>(null);
  readonly playingTitle = signal('');
  readonly loadingAudioId = signal<string | null>(null);
  readonly playError = signal('');

  constructor() {
    this.load();
    this.loadActivity();
  }

  /** Loads the friends activity feed (independent from the track list). */
  loadActivity(): void {
    this.activityLoading.set(true);
    this.activityError.set('');
    this.friendService.activity(ACTIVITY_SIZE).subscribe({
      next: (feed) => {
        this.activity.set(feed.items);
        this.activityLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.activityLoading.set(false);
        if (err.status === 401) return;
        this.activityError.set(err.error?.message ?? "Impossible de charger l'activité de vos amis.");
      },
    });
  }

  /** Short sentence describing an activity event. */
  describe(item: ActivityItem): string {
    return item.type === 'track_shared' ? 'vous a partagé' : 'a publié';
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const request =
      this.tab() === 'shared'
        ? this.service.listShared(this.page(), PAGE_SIZE, this.activeSearch())
        : this.service.listPublic(this.page(), PAGE_SIZE, this.activeSearch());
    request.subscribe({
      next: (response) => {
        this.tracks.set(response.items);
        this.pages.set(response.pages);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message ?? 'Impossible de charger les pistes.');
        this.loading.set(false);
      },
    });
  }

  /** Switches between public tracks and tracks shared with me. */
  selectTab(tab: DiscoverTab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    this.page.set(1);
    this.load();
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

  /** Plays a track; only its id and title are needed (list item or activity event). */
  play(track: Pick<Track, 'id' | 'title'>): void {
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
            ? `« ${track.title} » n'est plus disponible : elle a été supprimée, rendue privée ou n'est plus partagée.`
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

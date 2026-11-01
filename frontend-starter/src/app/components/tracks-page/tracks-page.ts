import { Component, ElementRef, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';

const MAX_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'];

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent implements OnDestroy {
  private readonly service = inject(TrackService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly audioUrl = signal('');
  readonly playingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly title = new FormControl('', { nonNullable: true });

  readonly uploadStatus = signal<UploadStatus>('idle');
  readonly uploadProgress = signal(0);
  readonly uploading = computed(() => this.uploadStatus() === 'uploading');
  readonly uploadError = signal('');
  readonly uploadSuccess = signal('');

  file?: File;

  constructor() {
    this.load();
  }

  choose(event: Event): void {
    const selected = (event.target as HTMLInputElement).files?.[0];
    this.uploadError.set('');
    this.uploadSuccess.set('');
    this.uploadStatus.set('idle');

    if (!selected) {
      this.file = undefined;
      return;
    }

    if (!ALLOWED_TYPES.includes(selected.type)) {
      this.uploadError.set(`Format non supporté (${selected.type || 'inconnu'}). Formats acceptés : mp3, wav, ogg, mp4, m4a.`);
      this.file = undefined;
      return;
    }

    if (selected.size > MAX_SIZE_BYTES) {
      const mb = (selected.size / (1024 * 1024)).toFixed(1);
      this.uploadError.set(`Fichier trop volumineux (${mb} Mo). Maximum autorisé : 25 Mo.`);
      this.file = undefined;
      return;
    }

    this.file = selected;
    console.debug('[TracksPage] Fichier sélectionné', this.file.name);
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service.list(this.page()).subscribe({
      next: (response) => {
        this.tracks.set(response.items);
        this.pages.set(response.pages);
        this.loading.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.error.set(err.error?.message ?? 'Impossible de charger les pistes.');
        this.loading.set(false);
      },
    });
  }

  go(page: number): void {
    this.page.set(page);
    this.load();
  }

  upload(): void {
    if (!this.file || this.uploading()) return;

    const title = this.title.value || this.file.name;
    this.uploadStatus.set('uploading');
    this.uploadProgress.set(0);
    this.uploadError.set('');
    this.uploadSuccess.set('');
    this.title.disable();

    this.service.upload(this.file, title).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress.set(Math.round((100 * event.loaded) / event.total));
        } else if (event.type === HttpEventType.Response) {
          this.finishUpload(event.body?.title ?? title);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.uploadStatus.set('error');
        this.uploadProgress.set(0);
        this.title.enable();
        this.uploadError.set(err.error?.message ?? "Échec de l'envoi du fichier.");
      },
    });
  }

  private finishUpload(title: string): void {
    this.uploadStatus.set('success');
    this.uploadSuccess.set(`« ${title} » envoyée avec succès.`);
    this.title.enable();
    this.title.setValue('');
    this.file = undefined;
    const input = this.fileInput();
    if (input) input.nativeElement.value = '';
    this.page.set(1);
    this.load();
  }

  play(track: Track): void {
    this.service.audio(track.id).subscribe({
      next: (blob) => {
        const previousUrl = this.audioUrl();
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        this.audioUrl.set(URL.createObjectURL(blob));
        this.playingId.set(track.id);
      },
      error: (error) => console.error('[TracksPage] Lecture impossible', error),
    });
  }

  remove(track: Track): void {
    if (this.deletingId()) return;
    if (!window.confirm(`Supprimer « ${track.title} » ? Cette action est définitive.`)) return;

    this.deletingId.set(track.id);
    this.service.delete(track.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.stopIfPlaying(track.id);
        this.notify(`« ${track.title} » supprimée.`);
        this.reloadAfterDelete();
      },
      error: (err: HttpErrorResponse) => {
        this.deletingId.set(null);
        if (err.status === 404) {
          this.notify("Cette piste n'existe plus ou ne vous appartient pas.");
          this.reloadAfterDelete();
        } else if (err.status !== 401) {
          this.notify('Suppression impossible. Réessayez.');
        }
      },
    });
  }

  private stopIfPlaying(id: string): void {
    if (this.playingId() !== id) return;
    const url = this.audioUrl();
    if (url) URL.revokeObjectURL(url);
    this.audioUrl.set('');
    this.playingId.set(null);
  }

  private reloadAfterDelete(): void {
    if (this.tracks().length === 1 && this.page() > 1) {
      this.page.set(this.page() - 1);
    }
    this.load();
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Fermer', { duration: 4000 });
  }

  formatSize(sizeInBytes: number): string {
    const mb = sizeInBytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} Mo` : `${Math.round(sizeInBytes / 1024)} Ko`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatExt(name: string): string {
    return name.split('.').pop()?.toUpperCase() ?? '';
  }

  ngOnDestroy(): void {
    const url = this.audioUrl();
    if (url) URL.revokeObjectURL(url);
  }
}
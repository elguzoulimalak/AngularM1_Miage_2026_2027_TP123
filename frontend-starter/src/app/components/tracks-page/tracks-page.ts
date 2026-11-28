import { Component, ElementRef, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Track, TrackVisibility } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';
import { FriendUser } from '../../shared/models/friend.model';
import { FriendService } from '../../shared/services/friend.service';

const MAX_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'];

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent implements OnDestroy {
  private readonly service = inject(TrackService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly friendService = inject(FriendService);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly audioUrl = signal('');
  readonly playingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly loadingAudioId = signal<string | null>(null);
  readonly playError = signal('');
  readonly playingTitle = signal('');
  readonly title = new FormControl('', { nonNullable: true });
  /** Visibility chosen in the upload form (private by default). */
  readonly visibility = new FormControl<TrackVisibility>('private', { nonNullable: true });
  /** Search box above "Mes pistes". */
  readonly search = new FormControl('', { nonNullable: true });
  /** Search actually applied to the list (set when the user submits). */
  readonly activeSearch = signal('');
  readonly togglingId = signal<string | null>(null);

  /** TP4 étape 2 : partage avec les amis. */
  readonly sharingTrackId = signal<string | null>(null);
  readonly friends = signal<FriendUser[] | null>(null);
  readonly friendsError = signal('');
  /** Id of the friend whose share is being changed. */
  readonly shareBusyId = signal<string | null>(null);

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
    this.service.list(this.page(), 5, this.activeSearch()).subscribe({
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

  /** Applies the search box and goes back to page 1. */
  applySearch(): void {
    this.activeSearch.set(this.search.value.trim());
    this.page.set(1);
    this.load();
  }

  clearSearch(): void {
    this.search.setValue('');
    this.applySearch();
  }

  /** Switches a track between private and public. */
  toggleVisibility(track: Track): void {
    if (this.togglingId()) return;
    const next: TrackVisibility = track.visibility === 'public' ? 'private' : 'public';
    this.togglingId.set(track.id);
    this.service.setVisibility(track.id, next).subscribe({
      next: (updated) => {
        this.togglingId.set(null);
        this.tracks.update((list) => list.map((t) => (t.id === updated.id ? { ...t, visibility: updated.visibility } : t)));
        this.notify(
          updated.visibility === 'public'
            ? `« ${track.title} » est maintenant publique.`
            : `« ${track.title} » est maintenant privée.`,
        );
      },
      error: (err: HttpErrorResponse) => {
        this.togglingId.set(null);
        if (err.status === 401) return; // géré par l'intercepteur
        this.notify(err.error?.message ?? 'Impossible de changer la visibilité. Réessayez.');
      },
    });
  }

  /** Opens or closes the share panel of a track; friends are loaded once. */
  toggleSharePanel(track: Track): void {
    if (this.sharingTrackId() === track.id) {
      this.sharingTrackId.set(null);
      return;
    }
    this.sharingTrackId.set(track.id);
    if (this.friends() === null) this.loadFriends();
  }

  private loadFriends(): void {
    this.friendsError.set('');
    this.friendService.overview().subscribe({
      next: (overview) => this.friends.set(overview.friends.map((f) => f.user)),
      error: (err: HttpErrorResponse) => {
        if (err.status === 401) return;
        this.friendsError.set(err.error?.message ?? 'Impossible de charger vos amis.');
      },
    });
  }

  isSharedWith(track: Track, userId: string): boolean {
    return (track.sharedWith ?? []).includes(userId);
  }

  /** Shares the track with a friend, or stops the share if it already exists. */
  toggleShare(track: Track, friend: FriendUser): void {
    if (this.shareBusyId()) return;
    const shared = this.isSharedWith(track, friend.id);
    const request = shared ? this.service.unshare(track.id, friend.id) : this.service.share(track.id, friend.id);
    this.shareBusyId.set(friend.id);
    request.subscribe({
      next: (updated) => {
        this.shareBusyId.set(null);
        this.tracks.update((list) =>
          list.map((t) => (t.id === updated.id ? { ...t, sharedWith: updated.sharedWith ?? [] } : t)),
        );
        this.notify(
          shared
            ? `« ${track.title} » n'est plus partagée avec ${friend.name}.`
            : `« ${track.title} » est partagée avec ${friend.name}.`,
        );
      },
      error: (err: HttpErrorResponse) => {
        this.shareBusyId.set(null);
        if (err.status === 401) return;
        this.notify(err.error?.message ?? 'Partage impossible. Réessayez.');
      },
    });
  }

  go(page: number): void {
    this.page.set(page);
    this.load();
  }

  upload(): void {
    if (!this.file || this.uploading()) return;

    const title = this.title.value.trim() || this.file.name;
    this.uploadStatus.set('uploading');
    this.uploadProgress.set(0);
    this.uploadError.set('');
    this.uploadSuccess.set('');
    this.title.disable();

    this.service.upload(this.file, title, this.visibility.value).subscribe({
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
    this.visibility.setValue('private');
    this.file = undefined;
    const input = this.fileInput();
    if (input) input.nativeElement.value = '';
    this.page.set(1);
    this.load();
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
            ? `« ${track.title} » est introuvable : la piste a peut-être été supprimée.`
            : `Impossible de charger « ${track.title} ». Réessayez.`,
        );
      },
    });
  }

  /** Appelé par l'élément <audio> quand le navigateur ne peut pas décoder le fichier. */
  onAudioError(): void {
    this.playError.set(`Le navigateur ne peut pas lire « ${this.playingTitle()} » (format non pris en charge ou fichier corrompu).`);
    this.playingId.set(null);
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
    this.playingTitle.set('');
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
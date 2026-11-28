import { Component, computed, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TrackFilters, TrackFormat, TrackSort } from '../../shared/models/track-filters.model';

/**
 * TP4 finition : panneau « Filtres avancés » réutilisé par Backing tracks et
 * Découvrir. Il émet les filtres à chaque changement de format ou de tri, et
 * quand le champ propriétaire est validé (Entrée ou sortie du champ).
 */
@Component({
  selector: 'app-track-filters',
  imports: [ReactiveFormsModule],
  templateUrl: './track-filters.html',
  styleUrl: './track-filters.css',
})
export class TrackFiltersComponent {
  /** Shows the owner field (only meaningful for other people's tracks). */
  readonly showOwner = input(false);
  readonly filtersChange = output<TrackFilters>();

  readonly open = signal(false);
  readonly form = new FormGroup({
    format: new FormControl<TrackFormat>('', { nonNullable: true }),
    sort: new FormControl<TrackSort>('recent', { nonNullable: true }),
    owner: new FormControl('', { nonNullable: true }),
  });

  /** Last emitted filters, used for the badge on the toggle button. */
  private readonly applied = signal<TrackFilters>({});
  readonly activeCount = computed(() => {
    const f = this.applied();
    return [f.format, f.sort && f.sort !== 'recent', f.owner].filter(Boolean).length;
  });

  readonly formats: { value: TrackFormat; label: string }[] = [
    { value: '', label: 'Tous les formats' },
    { value: 'mp3', label: 'MP3' },
    { value: 'wav', label: 'WAV' },
    { value: 'ogg', label: 'OGG' },
    { value: 'm4a', label: 'M4A' },
  ];

  readonly sorts: { value: TrackSort; label: string }[] = [
    { value: 'recent', label: 'Plus récentes' },
    { value: 'oldest', label: 'Plus anciennes' },
    { value: 'title', label: 'Titre (A → Z)' },
    { value: 'size', label: 'Taille (plus grosses)' },
  ];

  toggle(): void {
    this.open.update((v) => !v);
  }

  /** Emits the current filters if they changed since the last emission. */
  apply(): void {
    const { format, sort, owner } = this.form.getRawValue();
    const next: TrackFilters = { format, sort, owner: this.showOwner() ? owner.trim() : '' };
    const prev = this.applied();
    if (prev.format === next.format && prev.sort === next.sort && prev.owner === next.owner) return;
    this.applied.set(next);
    this.filtersChange.emit(next);
  }

  reset(): void {
    this.form.reset({ format: '', sort: 'recent', owner: '' });
    this.apply();
  }
}

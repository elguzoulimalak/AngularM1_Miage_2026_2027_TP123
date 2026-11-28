import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { TrackFilters } from '../../shared/models/track-filters.model';
import { TrackFiltersComponent } from './track-filters';

function setup(showOwner = false) {
  const fixture = TestBed.createComponent(TrackFiltersComponent);
  fixture.componentRef.setInput('showOwner', showOwner);
  const emitted: TrackFilters[] = [];
  fixture.componentInstance.filtersChange.subscribe((f) => emitted.push(f));
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, emitted };
}

describe('TrackFiltersComponent', () => {
  it('est replié par défaut et s’ouvre au clic', () => {
    const { fixture } = setup();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('form')).toBeNull();
    el.querySelector<HTMLButtonElement>('.toggle')!.click();
    fixture.detectChanges();
    expect(el.querySelector('form')).not.toBeNull();
    expect(el.querySelector('input')).toBeNull(); // pas de champ propriétaire
  });

  it('émet format et tri, et compte les filtres actifs', () => {
    const { fixture, component, emitted } = setup();
    component.form.patchValue({ format: 'wav', sort: 'title' });
    component.apply();
    fixture.detectChanges();

    expect(emitted).toEqual([{ format: 'wav', sort: 'title', owner: '' }]);
    expect(component.activeCount()).toBe(2);
    expect(fixture.nativeElement.querySelector('.count')?.textContent).toContain('2');
  });

  it('n’émet pas deux fois les mêmes filtres', () => {
    const { component, emitted } = setup();
    component.form.patchValue({ format: 'mp3' });
    component.apply();
    component.apply();
    expect(emitted.length).toBe(1);
  });

  it('prend en compte le propriétaire seulement si le champ est affiché', () => {
    const withOwner = setup(true);
    withOwner.component.form.patchValue({ owner: '  Alice ' });
    withOwner.component.apply();
    expect(withOwner.emitted[0].owner).toBe('Alice');

    const withoutOwner = setup(false);
    withoutOwner.component.form.patchValue({ owner: 'Alice', format: 'ogg' });
    withoutOwner.component.apply();
    expect(withoutOwner.emitted[0].owner).toBe('');
  });

  it('réinitialise tous les filtres', () => {
    const { component, emitted } = setup(true);
    component.form.patchValue({ format: 'm4a', sort: 'size', owner: 'Bob' });
    component.apply();
    component.reset();
    expect(emitted.at(-1)).toEqual({ format: '', sort: 'recent', owner: '' });
    expect(component.activeCount()).toBe(0);
  });
});

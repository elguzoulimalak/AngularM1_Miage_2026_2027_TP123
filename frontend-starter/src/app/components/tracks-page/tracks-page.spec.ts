import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Track } from '../../shared/models/track.model';
import { TracksPageComponent } from './tracks-page';

const track: Track = {
  id: 't1',
  title: 'Ma piste',
  originalName: 'song.mp3',
  mimeType: 'audio/mpeg',
  size: 1024,
  visibility: 'private',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const pageOf = (items: Track[]) => ({ items, page: 1, limit: 5, total: items.length, pages: 1 });
const isListRequest = (r: { url: string }) => r.url === '/api/tracks';

describe('TracksPageComponent', () => {
  let http: HttpTestingController;
  const snackBar = { open: vi.fn() };

  beforeEach(() => {
    snackBar.open.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    http.verify();
  });

  it('affiche une erreur après un échec HTTP au chargement', () => {
    const fixture = TestBed.createComponent(TracksPageComponent);

    http.expectOne(isListRequest).flush({ message: 'Serveur indisponible' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(fixture.componentInstance.error()).toBe('Serveur indisponible');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Serveur indisponible');
  });

  it('supprime une piste via DELETE puis recharge la liste', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(TracksPageComponent);
    const component = fixture.componentInstance;

    http.expectOne(isListRequest).flush(pageOf([track]));
    expect(component.tracks()).toEqual([track]);

    component.remove(track);

    const del = http.expectOne('/api/tracks/t1');
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });

    http.expectOne(isListRequest).flush(pageOf([]));
    expect(component.tracks()).toEqual([]);
    expect(snackBar.open).toHaveBeenCalledWith('« Ma piste » supprimée.', 'Fermer', { duration: 4000 });
  });

  it('ne supprime rien si l\'utilisateur annule la confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fixture = TestBed.createComponent(TracksPageComponent);

    http.expectOne(isListRequest).flush(pageOf([track]));
    fixture.componentInstance.remove(track);

    http.expectNone('/api/tracks/t1');
  });
});
describe('TracksPageComponent — visibilité et recherche (TP4)', () => {
  let http: HttpTestingController;
  const snackBar = { open: vi.fn() };

  beforeEach(() => {
    snackBar.open.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('rend une piste privée publique via PATCH et met à jour la carte', () => {
    const fixture = TestBed.createComponent(TracksPageComponent);
    const component = fixture.componentInstance;
    http.expectOne(isListRequest).flush(pageOf([track]));

    component.toggleVisibility(track);
    const req = http.expectOne('/api/tracks/t1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ visibility: 'public' });
    req.flush({ ...track, visibility: 'public' });
    fixture.detectChanges();

    expect(component.tracks()[0].visibility).toBe('public');
    expect(fixture.nativeElement.querySelector('.visibility-badge')?.textContent).toContain('Publique');
    expect(snackBar.open).toHaveBeenCalledWith('« Ma piste » est maintenant publique.', 'Fermer', { duration: 4000 });
  });

  it('affiche un message si le changement de visibilité échoue', () => {
    const fixture = TestBed.createComponent(TracksPageComponent);
    const component = fixture.componentInstance;
    http.expectOne(isListRequest).flush(pageOf([track]));

    component.toggleVisibility(track);
    http.expectOne('/api/tracks/t1').flush({ message: 'Piste inconnue' }, { status: 404, statusText: 'Not Found' });

    expect(component.tracks()[0].visibility).toBe('private');
    expect(component.togglingId()).toBeNull();
    expect(snackBar.open).toHaveBeenCalledWith('Piste inconnue', 'Fermer', { duration: 4000 });
  });

  it('recherche dans mes pistes en repartant de la page 1', () => {
    const fixture = TestBed.createComponent(TracksPageComponent);
    const component = fixture.componentInstance;
    http.expectOne(isListRequest).flush({ ...pageOf([track]), pages: 3 });
    component.page.set(2);

    component.search.setValue('  blues ');
    component.applySearch();

    const req = http.expectOne(isListRequest);
    expect(req.request.params.get('q')).toBe('blues');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(pageOf([]));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.empty-state')?.textContent).toContain('blues');
  });
});

describe('TracksPageComponent — partage avec les amis (TP4 étape 2)', () => {
  let http: HttpTestingController;
  const snackBar = { open: vi.fn() };
  const alice = { id: 'u2', name: 'Alice', email: 'alice@test.fr' };
  const friendsResponse = {
    friends: [{ friendshipId: 'f1', user: alice, since: '2026-11-28T00:00:00.000Z' }],
    incoming: [],
    outgoing: [],
  };

  beforeEach(() => {
    snackBar.open.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('ouvre le panneau de partage et charge les amis une seule fois', () => {
    const fixture = TestBed.createComponent(TracksPageComponent);
    const component = fixture.componentInstance;
    http.expectOne(isListRequest).flush(pageOf([track]));

    component.toggleSharePanel(track);
    http.expectOne('/api/friends').flush(friendsResponse);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.share-panel')?.textContent).toContain('Alice');

    component.toggleSharePanel(track); // fermeture
    component.toggleSharePanel(track); // réouverture : pas de nouvel appel
    http.expectNone('/api/friends');
  });

  it('partage puis arrête le partage avec un ami', () => {
    const fixture = TestBed.createComponent(TracksPageComponent);
    const component = fixture.componentInstance;
    http.expectOne(isListRequest).flush(pageOf([track]));

    component.toggleShare(track, alice);
    const share = http.expectOne('/api/tracks/t1/shares/u2');
    expect(share.request.method).toBe('PUT');
    share.flush({ ...track, sharedWith: ['u2'] });
    expect(component.tracks()[0].sharedWith).toEqual(['u2']);
    expect(snackBar.open).toHaveBeenCalledWith('« Ma piste » est partagée avec Alice.', 'Fermer', { duration: 4000 });

    component.toggleShare(component.tracks()[0], alice);
    const unshare = http.expectOne('/api/tracks/t1/shares/u2');
    expect(unshare.request.method).toBe('DELETE');
    unshare.flush({ ...track, sharedWith: [] });
    expect(component.tracks()[0].sharedWith).toEqual([]);
  });

  it('affiche le message du serveur si le partage est refusé', () => {
    const fixture = TestBed.createComponent(TracksPageComponent);
    const component = fixture.componentInstance;
    http.expectOne(isListRequest).flush(pageOf([track]));

    component.toggleShare(track, alice);
    http.expectOne('/api/tracks/t1/shares/u2').flush(
      { message: "Vous ne pouvez partager qu'avec vos amis" },
      { status: 403, statusText: 'Forbidden' },
    );
    expect(component.shareBusyId()).toBeNull();
    expect(snackBar.open).toHaveBeenCalledWith("Vous ne pouvez partager qu'avec vos amis", 'Fermer', { duration: 4000 });
  });
});

describe('TracksPageComponent — lecture', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('affiche une erreur compréhensible si la piste n’existe plus', () => {
    const fixture = TestBed.createComponent(TracksPageComponent);
    const component = fixture.componentInstance;
    http.expectOne(isListRequest).flush(pageOf([track]));

    component.play(track);
    http.expectOne('/api/tracks/t1/audio').flush(new Blob(), { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(component.playError()).toContain('introuvable');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Ma piste');
  });
});

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityItem } from '../../shared/models/activity.model';
import { Track } from '../../shared/models/track.model';
import { AuthService } from '../../shared/services/auth.service';
import { DiscoverPageComponent } from './discover-page';

const publicTrack: Track = {
  id: 'p1',
  ownerId: 'u2',
  ownerName: 'Alice',
  title: 'Blues en A',
  originalName: 'blues.mp3',
  mimeType: 'audio/mpeg',
  size: 2048,
  visibility: 'public',
  createdAt: '2026-11-27T00:00:00.000Z',
};

const pageOf = (items: Track[]) => ({ items, page: 1, limit: 10, total: items.length, pages: 1 });
const isPublicList = (r: { url: string }) => r.url === '/api/tracks/public';
const isActivity = (r: { url: string }) => r.url === '/api/activity';

const sharedEvent: ActivityItem = {
  id: 'a1',
  type: 'track_shared',
  at: '2026-11-28T10:00:00.000Z',
  user: { id: 'u2', name: 'Alice' },
  track: { id: 'p9', title: 'Riff funk' },
};

describe('DiscoverPageComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  // Le fil d'activité est chargé en parallèle ; les tests qui ne le testent
  // pas répondent par un fil vide avant la vérification.
  afterEach(() => {
    http.match(isActivity).forEach((req) => req.flush({ items: [] }));
    http.verify();
  });

  it('affiche les pistes publiques récentes avec le nom du propriétaire', () => {
    const fixture = TestBed.createComponent(DiscoverPageComponent);
    const req = http.expectOne(isPublicList);
    expect(req.request.params.has('q')).toBe(false);
    req.flush(pageOf([publicTrack]));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Récemment ajoutées');
    expect(text).toContain('Blues en A');
    expect(text).toContain('par Alice');
  });

  it('recherche par titre et affiche un message si rien ne correspond', () => {
    const fixture = TestBed.createComponent(DiscoverPageComponent);
    const component = fixture.componentInstance;
    http.expectOne(isPublicList).flush(pageOf([publicTrack]));

    component.search.setValue('jazz');
    component.applySearch();
    const req = http.expectOne(isPublicList);
    expect(req.request.params.get('q')).toBe('jazz');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(pageOf([]));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.empty-state')?.textContent).toContain('jazz');
  });

  it('signale ses propres pistes avec « (vous) »', () => {
    TestBed.inject(AuthService).currentUser.set({ id: 'u2', name: 'Alice', email: 'a@b.fr', createdAt: '' });
    const fixture = TestBed.createComponent(DiscoverPageComponent);
    http.expectOne(isPublicList).flush(pageOf([publicTrack]));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.mine')?.textContent).toContain('(vous)');
  });

  it('explique qu’une piste rendue privée n’est plus disponible', () => {
    const fixture = TestBed.createComponent(DiscoverPageComponent);
    const component = fixture.componentInstance;
    http.expectOne(isPublicList).flush(pageOf([publicTrack]));

    component.play(publicTrack);
    http.expectOne('/api/tracks/p1/audio').flush(new Blob(), { status: 404, statusText: 'Not Found' });

    expect(component.playError()).toContain('rendue privée');
  });

  it('l’onglet « Partagées avec moi » appelle /api/tracks/shared', () => {
    const fixture = TestBed.createComponent(DiscoverPageComponent);
    const component = fixture.componentInstance;
    http.expectOne(isPublicList).flush(pageOf([publicTrack]));
    component.page.set(2);

    component.selectTab('shared');
    const req = http.expectOne((r) => r.url === '/api/tracks/shared');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(pageOf([{ ...publicTrack, visibility: 'private', ownerName: 'Bob' }]));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Partagées avec moi par mes amis');
    expect(text).toContain('par Bob');
  });

  it('affiche une erreur si le chargement échoue', () => {
    const fixture = TestBed.createComponent(DiscoverPageComponent);
    http.expectOne(isPublicList).flush({ message: 'Serveur indisponible' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Serveur indisponible');
  });

  it('affiche le fil d’activité des amis', () => {
    const fixture = TestBed.createComponent(DiscoverPageComponent);
    http.expectOne(isPublicList).flush(pageOf([]));
    const req = http.expectOne(isActivity);
    expect(req.request.params.get('limit')).toBe('8');
    req.flush({ items: [sharedEvent, { ...sharedEvent, id: 'a2', type: 'track_published', track: { id: 'p1', title: 'Blues en A' } }] });
    fixture.detectChanges();

    const feed = fixture.nativeElement.querySelector('.feed')?.textContent as string;
    expect(feed).toContain('Alice vous a partagé « Riff funk »');
    expect(feed).toContain('Alice a publié « Blues en A »');
  });

  it('lit une piste depuis le fil d’activité', () => {
    const fixture = TestBed.createComponent(DiscoverPageComponent);
    const component = fixture.componentInstance;
    http.expectOne(isPublicList).flush(pageOf([]));
    http.expectOne(isActivity).flush({ items: [sharedEvent] });

    // jsdom ne fournit pas URL.createObjectURL : on le simule.
    const createObjectURL = vi.fn(() => 'blob:riff');
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });

    component.play(sharedEvent.track);
    http.expectOne('/api/tracks/p9/audio').flush(new Blob(['x']));
    expect(component.playingId()).toBe('p9');
    expect(component.playingTitle()).toBe('Riff funk');
    expect(component.audioUrl()).toBe('blob:riff');
  });

  it('invite à ajouter des amis quand le fil est vide, et signale une erreur', () => {
    const fixture = TestBed.createComponent(DiscoverPageComponent);
    const component = fixture.componentInstance;
    http.expectOne(isPublicList).flush(pageOf([]));
    http.expectOne(isActivity).flush({ items: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.feed')?.textContent).toContain('Inviter des amis');

    component.loadActivity();
    http.expectOne(isActivity).flush({ message: 'Erreur serveur' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(component.activityError()).toBe('Erreur serveur');
  });

  it('applique les filtres avancés (propriétaire, format, tri) en repartant de la page 1', () => {
    const fixture = TestBed.createComponent(DiscoverPageComponent);
    const component = fixture.componentInstance;
    http.expectOne(isPublicList).flush({ ...pageOf([publicTrack]), pages: 3 });
    component.page.set(3);

    component.onFilters({ format: 'mp3', sort: 'title', owner: 'Ali' });
    const req = http.expectOne(isPublicList);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('format')).toBe('mp3');
    expect(req.request.params.get('sort')).toBe('title');
    expect(req.request.params.get('owner')).toBe('Ali');
    req.flush(pageOf([]));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Résultats filtrés (0)');
    expect(text).toContain('Aucune piste ne correspond à ces filtres.');
  });

  it('garde les filtres en changeant d’onglet', () => {
    const fixture = TestBed.createComponent(DiscoverPageComponent);
    const component = fixture.componentInstance;
    http.expectOne(isPublicList).flush(pageOf([]));
    component.onFilters({ format: 'wav', sort: 'recent', owner: '' });
    http.expectOne(isPublicList).flush(pageOf([]));

    component.selectTab('shared');
    const req = http.expectOne((r) => r.url === '/api/tracks/shared');
    expect(req.request.params.get('format')).toBe('wav');
    req.flush(pageOf([]));
  });
});

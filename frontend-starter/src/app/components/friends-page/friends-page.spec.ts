import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FriendsOverview } from '../../shared/models/friend.model';
import { FriendsPageComponent } from './friends-page';

const alice = { id: 'u2', name: 'Alice', email: 'alice@test.fr' };
const bob = { id: 'u3', name: 'Bob', email: 'bob@test.fr' };
const overview: FriendsOverview = {
  friends: [{ friendshipId: 'f1', user: alice, since: '2026-11-28T00:00:00.000Z' }],
  incoming: [{ id: 'r1', user: bob, createdAt: '2026-11-28T00:00:00.000Z' }],
  outgoing: [],
};
const empty: FriendsOverview = { friends: [], incoming: [], outgoing: [] };

describe('FriendsPageComponent', () => {
  let http: HttpTestingController;
  const snackBar = { open: vi.fn() };

  beforeEach(() => {
    snackBar.open.mockClear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: MatSnackBar, useValue: snackBar }],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    http.verify();
  });

  it('affiche les amis et les invitations reçues', () => {
    const fixture = TestBed.createComponent(FriendsPageComponent);
    http.expectOne('/api/friends').flush(overview);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.friends')?.textContent).toContain('Alice');
    expect(el.querySelector('.incoming')?.textContent).toContain('Bob');
  });

  it('n’envoie pas d’invitation si l’email est invalide', () => {
    const fixture = TestBed.createComponent(FriendsPageComponent);
    http.expectOne('/api/friends').flush(empty);

    fixture.componentInstance.email.setValue('pas-un-email');
    fixture.componentInstance.invite();
    http.expectNone('/api/friends/requests');
  });

  it('invite un ami par email puis recharge la liste', () => {
    const fixture = TestBed.createComponent(FriendsPageComponent);
    const component = fixture.componentInstance;
    http.expectOne('/api/friends').flush(empty);

    component.email.setValue('alice@test.fr');
    component.invite();
    const req = http.expectOne('/api/friends/requests');
    expect(req.request.body).toEqual({ email: 'alice@test.fr' });
    req.flush({ id: 'r9', status: 'pending', user: alice });

    http.expectOne('/api/friends').flush(empty);
    expect(snackBar.open).toHaveBeenCalledWith('Invitation envoyée à Alice.', 'Fermer', { duration: 4000 });
    expect(component.email.value).toBe('');
  });

  it('affiche l’erreur du serveur si l’email est inconnu', () => {
    const fixture = TestBed.createComponent(FriendsPageComponent);
    const component = fixture.componentInstance;
    http.expectOne('/api/friends').flush(empty);

    component.email.setValue('x@test.fr');
    component.invite();
    http.expectOne('/api/friends/requests').flush(
      { message: 'Aucun utilisateur avec cet email' },
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Aucun utilisateur');
  });

  it('accepte une invitation reçue', () => {
    const fixture = TestBed.createComponent(FriendsPageComponent);
    http.expectOne('/api/friends').flush(overview);

    fixture.componentInstance.accept(overview.incoming[0]);
    const req = http.expectOne('/api/friends/requests/r1/accept');
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'r1', status: 'accepted' });
    http.expectOne('/api/friends').flush(empty);

    expect(snackBar.open).toHaveBeenCalledWith('Vous êtes maintenant ami·e avec Bob.', 'Fermer', { duration: 4000 });
  });

  it('retire un ami après confirmation seulement', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fixture = TestBed.createComponent(FriendsPageComponent);
    const component = fixture.componentInstance;
    http.expectOne('/api/friends').flush(overview);

    component.remove(overview.friends[0]);
    http.expectNone('/api/friends/u2');

    confirm.mockReturnValue(true);
    component.remove(overview.friends[0]);
    const req = http.expectOne('/api/friends/u2');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne('/api/friends').flush(empty);
  });
});

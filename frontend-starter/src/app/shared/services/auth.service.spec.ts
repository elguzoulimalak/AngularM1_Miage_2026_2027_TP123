import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('login() appelle POST /api/auth/login avec le bon corps et mémorise la session', () => {
    const user = { id: '1', name: 'Demo', email: 'demo@example.com', createdAt: '2026-01-01T00:00:00.000Z' };

    auth.login('demo@example.com', 'secret-de-test').subscribe();

    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'demo@example.com', password: 'secret-de-test' });
    req.flush({ token: 'faux-token', user });

    expect(auth.token()).toBe('faux-token');
    expect(auth.currentUser()).toEqual(user);
    expect(localStorage.getItem('gpc_token')).toBe('faux-token');
  });

  it('logout() efface le token et l\'utilisateur', () => {
    auth.token.set('faux-token');
    localStorage.setItem('gpc_token', 'faux-token');

    auth.logout();

    expect(auth.token()).toBeNull();
    expect(auth.currentUser()).toBeNull();
    expect(localStorage.getItem('gpc_token')).toBeNull();
  });
});
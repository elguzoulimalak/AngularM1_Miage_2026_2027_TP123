import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => http.verify());

  it('ajoute Authorization: Bearer quand un token existe', () => {
    auth.token.set('faux-token');

    client.get('/api/tracks').subscribe();

    const req = http.expectOne('/api/tracks');
    expect(req.request.headers.get('Authorization')).toBe('Bearer faux-token');
    req.flush({});
  });

  it('n\'ajoute aucun header Authorization sans token', () => {
    client.get('/api/tracks').subscribe();

    const req = http.expectOne('/api/tracks');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('déconnecte et redirige vers /login sur une réponse 401', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    auth.token.set('token-expire');

    client.get('/api/users/me').subscribe({ error: () => undefined });

    http.expectOne('/api/users/me').flush({ message: 'Jeton invalide' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.token()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
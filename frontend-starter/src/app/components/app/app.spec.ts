import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppComponent } from './app';

describe('AppComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('après un rechargement avec token, affiche la navigation connectée et recharge le profil', () => {
    localStorage.setItem('gpc_token', 'faux-token');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Déconnexion');
    http.expectOne('/api/users/me').flush({ id: '1', name: 'Demo', email: 'demo@example.com', createdAt: '2026-01-01' });
  });

  it('sans token, affiche Connexion et ne demande pas le profil', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Connexion');
    http.expectNone('/api/users/me');
  });
});

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPageComponent } from './login-page';

describe('LoginPageComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('n’envoie aucune requête et affiche les erreurs si le formulaire est invalide', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.componentInstance.form.setValue({ email: 'pas-un-email', password: '' });

    fixture.componentInstance.submit();
    fixture.detectChanges();

    http.expectNone('/api/auth/login');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Format d’email invalide.');
    expect(text).toContain('Le mot de passe est obligatoire.');
  });

  it('affiche le message du serveur après un refus', () => {
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LoginPageComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ email: 'demo@example.com', password: 'mauvais' });

    component.submit();
    expect(component.submitting()).toBe(true);
    http.expectOne('/api/auth/login').flush({ message: 'Identifiants incorrects' }, { status: 401, statusText: 'Unauthorized' });

    expect(component.submitting()).toBe(false);
    expect(component.error()).toBe('Identifiants incorrects');
  });
});

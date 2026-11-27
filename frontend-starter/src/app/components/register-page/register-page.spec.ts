import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RegisterPageComponent } from './register-page';

describe('RegisterPageComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('refuse un mot de passe de moins de 8 caractères sans appeler le backend', () => {
    const fixture = TestBed.createComponent(RegisterPageComponent);
    fixture.componentInstance.form.setValue({ name: 'Malak', email: 'malak@example.com', password: '1234567' });

    fixture.componentInstance.submit();
    fixture.detectChanges();

    http.expectNone('/api/auth/register');
    expect(fixture.nativeElement.textContent).toContain('au moins 8 caractères');
  });
});

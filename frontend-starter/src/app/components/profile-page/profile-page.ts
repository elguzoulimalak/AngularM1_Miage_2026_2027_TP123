import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePageComponent {
  readonly auth = inject(AuthService);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    // Le profil est chargé dès l'ouverture de la page (GET /api/users/me).
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.auth
      .profile()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (user) => this.form.setValue({ name: user.name }),
        error: (error: HttpErrorResponse) => {
          if (error.status !== 401) this.error.set('Impossible de charger le profil.');
        },
      });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;

    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    this.auth
      .update(this.form.getRawValue().name.trim())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.success.set('Profil enregistré.'),
        error: (error: HttpErrorResponse) => {
          if (error.status !== 401) {
            this.error.set(error.error?.message ?? 'Enregistrement impossible.');
          }
        },
      });
  }
}

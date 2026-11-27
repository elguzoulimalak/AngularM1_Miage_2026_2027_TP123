import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    // Après un rechargement, seul le token est relu depuis localStorage :
    // on recharge le profil pour que currentUser soit de nouveau disponible.
    // Un token expiré renvoie 401, que l'intercepteur traite (déconnexion + /login).
    if (this.auth.isAuthenticated() && !this.auth.currentUser()) {
      this.auth.profile().subscribe({ error: () => undefined });
    }
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
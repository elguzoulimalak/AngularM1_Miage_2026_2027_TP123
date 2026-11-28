import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { Friend, FriendRequest } from '../../shared/models/friend.model';
import { FriendService } from '../../shared/services/friend.service';

/**
 * TP4 étape 2 : page « Amis ». Inviter par email, accepter ou refuser une
 * invitation, annuler une invitation envoyée et retirer un ami.
 */
@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './friends-page.html',
  styleUrl: './friends-page.css',
})
export class FriendsPageComponent {
  private readonly service = inject(FriendService);
  private readonly snackBar = inject(MatSnackBar);

  readonly friends = signal<Friend[]>([]);
  readonly incoming = signal<FriendRequest[]>([]);
  readonly outgoing = signal<FriendRequest[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly inviting = signal(false);
  readonly inviteError = signal('');
  /** Id of the request or friend currently being processed. */
  readonly busyId = signal<string | null>(null);
  readonly email = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service.overview().subscribe({
      next: (overview) => {
        this.friends.set(overview.friends);
        this.incoming.set(overview.incoming);
        this.outgoing.set(overview.outgoing);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message ?? 'Impossible de charger vos amis.');
        this.loading.set(false);
      },
    });
  }

  invite(): void {
    this.email.markAsTouched();
    if (this.email.invalid || this.inviting()) return;
    this.inviting.set(true);
    this.inviteError.set('');
    this.service.invite(this.email.value).subscribe({
      next: (result) => {
        this.inviting.set(false);
        this.email.reset('');
        this.notify(
          result.status === 'accepted'
            ? `${result.user.name} vous avait déjà invité·e : vous êtes maintenant amis.`
            : `Invitation envoyée à ${result.user.name}.`,
        );
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.inviting.set(false);
        if (err.status === 401) return; // géré par l'intercepteur
        this.inviteError.set(err.error?.message ?? "Impossible d'envoyer l'invitation.");
      },
    });
  }

  accept(request: FriendRequest): void {
    this.run(request.id, this.service.accept(request.id), `Vous êtes maintenant ami·e avec ${request.user.name}.`);
  }

  decline(request: FriendRequest): void {
    this.run(request.id, this.service.cancelRequest(request.id), `Invitation de ${request.user.name} refusée.`);
  }

  cancel(request: FriendRequest): void {
    this.run(request.id, this.service.cancelRequest(request.id), `Invitation à ${request.user.name} annulée.`);
  }

  remove(friend: Friend): void {
    const ok = window.confirm(
      `Retirer ${friend.user.name} de vos amis ? Tous les partages entre vous seront arrêtés.`,
    );
    if (!ok) return;
    this.run(friend.user.id, this.service.remove(friend.user.id), `${friend.user.name} a été retiré·e de vos amis.`);
  }

  /** Runs one action on a request or friend, then reloads the lists. */
  private run(id: string, action: Observable<unknown>, success: string): void {
    if (this.busyId()) return;
    this.busyId.set(id);
    action.subscribe({
      next: () => {
        this.busyId.set(null);
        this.notify(success);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.busyId.set(null);
        if (err.status === 401) return;
        this.notify(err.error?.message ?? 'Action impossible. Réessayez.');
        this.load();
      },
    });
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Fermer', { duration: 4000 });
  }
}

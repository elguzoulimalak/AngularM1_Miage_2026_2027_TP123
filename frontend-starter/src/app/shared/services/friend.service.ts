import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FriendsOverview, InviteResult } from '../models/friend.model';

/** HTTP operations for friends and invitations (TP4 step 2). */
@Injectable({ providedIn: 'root' })
export class FriendService {
  private readonly http = inject(HttpClient);

  overview() {
    return this.http.get<FriendsOverview>('/api/friends');
  }

  invite(email: string) {
    return this.http.post<InviteResult>('/api/friends/requests', { email: email.trim() });
  }

  accept(requestId: string) {
    return this.http.post<{ id: string; status: 'accepted' }>(`/api/friends/requests/${requestId}/accept`, {});
  }

  /** Declines a received invitation or cancels a sent one. */
  cancelRequest(requestId: string) {
    return this.http.delete<void>(`/api/friends/requests/${requestId}`);
  }

  /** Removes a friend; the backend also stops every share between the two users. */
  remove(userId: string) {
    return this.http.delete<void>(`/api/friends/${userId}`);
  }
}

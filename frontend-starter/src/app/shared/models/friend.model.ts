/** Minimal public data of another user (TP4 step 2). */
export interface FriendUser {
  id: string;
  name: string;
  email: string;
}

/** An accepted friend. */
export interface Friend {
  friendshipId: string;
  user: FriendUser;
  since: string;
}

/** A pending invitation, received or sent. */
export interface FriendRequest {
  id: string;
  user: FriendUser;
  createdAt: string;
}

/** Response of GET /api/friends. */
export interface FriendsOverview {
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

/** Response of POST /api/friends/requests. */
export interface InviteResult {
  id: string;
  status: 'pending' | 'accepted';
  user: FriendUser;
}

/*
 * Fonctions pures pour les amis et le partage (TP4 étape 2).
 * Elles ne touchent pas à MongoDB, ce qui permet de les tester sans base.
 */

/** Filtre qui trouve la relation entre deux utilisateurs, quel que soit le sens. */
export function friendshipBetweenFilter(a, b) {
  return {
    $or: [
      { requester: a, recipient: b },
      { requester: b, recipient: a },
    ],
  };
}

/** Filtre de toutes les relations (en attente ou acceptées) d'un utilisateur. */
export function friendshipsOfFilter(userId) {
  return { $or: [{ requester: userId }, { recipient: userId }] };
}

/** Données publiques minimales d'un utilisateur (champ peuplé par populate). */
export function publicUser(user) {
  if (!user || typeof user !== "object" || !user._id) {
    return { id: String(user ?? ""), name: "Utilisateur inconnu", email: "" };
  }
  return { id: String(user._id), name: user.name, email: user.email };
}

/** Identifiant d'un champ requester/recipient, qu'il soit peuplé ou non. */
function idOf(value) {
  return String(value?._id ?? value);
}

/**
 * Range les relations d'un utilisateur en trois listes pour l'écran « Amis » :
 * amis acceptés, invitations reçues et invitations envoyées.
 */
export function splitFriendships(friendships, me) {
  const result = { friends: [], incoming: [], outgoing: [] };
  for (const f of friendships) {
    const iAmRequester = idOf(f.requester) === String(me);
    const other = iAmRequester ? f.recipient : f.requester;
    if (f.status === "accepted") {
      result.friends.push({
        friendshipId: String(f._id),
        user: publicUser(other),
        since: f.updatedAt ?? f.createdAt,
      });
    } else if (iAmRequester) {
      result.outgoing.push({ id: String(f._id), user: publicUser(other), createdAt: f.createdAt });
    } else {
      result.incoming.push({ id: String(f._id), user: publicUser(other), createdAt: f.createdAt });
    }
  }
  return result;
}

/** Normalise un email saisi par l'utilisateur ; null s'il est invalide. */
export function parseEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

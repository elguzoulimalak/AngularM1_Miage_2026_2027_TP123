/*
 * Fonctions pures du fil d'activité (TP4 étape 3), testables sans MongoDB.
 */

export const DEFAULT_FEED_LIMIT = 10;
export const MAX_FEED_LIMIT = 50;

/** Valide `limit` (1 à 50, 10 par défaut). */
export function parseFeedLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_FEED_LIMIT;
  return Math.min(MAX_FEED_LIMIT, Math.floor(n));
}

/** Identifiants de mes amis, à partir de mes relations acceptées. */
export function friendIdsOf(friendships, me) {
  return friendships.map((f) =>
    String(f.requester) === String(me) ? String(f.recipient) : String(f.requester),
  );
}

/**
 * Filtre MongoDB des événements qui me concernent : publications de mes amis,
 * et partages de mes amis faits avec moi.
 */
export function feedFilter(friendIds, me) {
  return {
    actor: { $in: friendIds },
    $or: [{ type: "track_published" }, { type: "track_shared", target: me }],
  };
}

/**
 * Vérifie qu'un événement est toujours valable au moment de la lecture :
 * la piste existe encore, est encore publique (publication) ou encore
 * partagée avec moi (partage), et appartient toujours à l'auteur.
 */
export function isStillVisible(activity, me) {
  const track = activity.track;
  if (!track || typeof track !== "object") return false;
  if (String(track.ownerId) !== String(activity.actor?._id ?? activity.actor)) return false;
  if (activity.type === "track_published") return track.visibility === "public";
  if (activity.type === "track_shared") {
    return (track.sharedWith ?? []).map(String).includes(String(me));
  }
  return false;
}

/**
 * Construit le fil : garde les événements encore valables, supprime les
 * doublons (même type et même piste : on garde le plus récent) et limite
 * le nombre d'éléments. `activities` doit être trié du plus récent au plus ancien.
 */
export function buildFeed(activities, me, limit = DEFAULT_FEED_LIMIT) {
  const seen = new Set();
  const feed = [];
  for (const a of activities) {
    if (!isStillVisible(a, me)) continue;
    const key = `${a.type}:${String(a.track._id)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    feed.push({
      id: String(a._id),
      type: a.type,
      at: a.createdAt,
      user: { id: String(a.actor?._id ?? a.actor), name: a.actor?.name ?? "Utilisateur inconnu" },
      track: { id: String(a.track._id), title: a.track.title },
    });
    if (feed.length >= limit) break;
  }
  return feed;
}

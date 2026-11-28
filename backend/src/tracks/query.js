/*
 * Fonctions pures liées aux pistes (TP4, étape 1).
 * Elles ne touchent pas à MongoDB : elles valident les entrées utilisateur et
 * construisent des filtres Mongoose sûrs. Les isoler permet de les tester
 * sans base de données.
 */

/** Valeurs autorisées pour la visibilité d'une piste. */
export const VISIBILITIES = ["private", "public"];

/** Longueur maximale d'une recherche, pour éviter des expressions trop coûteuses. */
export const MAX_QUERY_LENGTH = 100;

/**
 * Retourne la visibilité si elle est valide, sinon null.
 * `undefined` ou une chaîne vide donnent la valeur par défaut fournie.
 */
export function parseVisibility(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  return VISIBILITIES.includes(value) ? value : null;
}

/**
 * Échappe les caractères spéciaux d'une expression régulière.
 * Sans cela, une recherche comme "a.*" ou "(" serait interprétée par MongoDB
 * comme une regex, ce qui peut être lent ou provoquer une erreur.
 */
export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalise le paramètre de recherche `q`.
 * Retourne une chaîne nettoyée (éventuellement vide) ou null si invalide.
 */
export function parseSearch(value) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null; // ex. ?q=a&q=b donne un tableau
  const trimmed = value.trim();
  return trimmed.length > MAX_QUERY_LENGTH ? null : trimmed;
}

/** Ajoute au filtre une recherche insensible à la casse sur le titre. */
function withSearch(filter, search) {
  if (!search) return filter;
  return { ...filter, title: { $regex: escapeRegex(search), $options: "i" } };
}

/** Filtre « mes pistes », avec recherche optionnelle sur le titre. */
export function myTracksFilter(userId, search = "") {
  return withSearch({ ownerId: userId }, search);
}

/** Filtre des pistes publiques de tous les utilisateurs. */
export function publicTracksFilter(search = "") {
  return withSearch({ visibility: "public" }, search);
}

/**
 * Filtre d'accès à une piste : son propriétaire peut toujours la lire,
 * les autres utilisateurs seulement si elle est publique.
 */
export function readableTrackFilter(trackId, userId) {
  return {
    _id: trackId,
    $or: [{ ownerId: userId }, { visibility: "public" }],
  };
}

/** Valide page et limit, avec un maximum imposé. */
export function parsePagination(query) {
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.min(20, Math.max(1, Number(query?.limit) || 5));
  return { page, limit };
}

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

/*
 * Recherche avancée (TP4 finition) : format, tri et propriétaire.
 * Un format correspond à un ou plusieurs types MIME acceptés à l'upload.
 */
export const FORMATS = {
  mp3: ["audio/mpeg"],
  wav: ["audio/wav", "audio/x-wav"],
  ogg: ["audio/ogg"],
  m4a: ["audio/mp4", "audio/x-m4a"],
};

/** Tris disponibles. `title` utilise une collation française (voir sortOptions). */
export const SORTS = {
  recent: { createdAt: -1 },
  oldest: { createdAt: 1 },
  title: { title: 1, createdAt: -1 },
  size: { size: -1, createdAt: -1 },
};

/** Format demandé : "" (tous), une clé de FORMATS, ou null si invalide. */
export function parseFormat(value) {
  if (value === undefined || value === null || value === "") return "";
  return typeof value === "string" && Object.hasOwn(FORMATS, value) ? value : null;
}

/** Tri demandé : une clé de SORTS ("recent" par défaut), ou null si invalide. */
export function parseSort(value) {
  if (value === undefined || value === null || value === "") return "recent";
  return typeof value === "string" && Object.hasOwn(SORTS, value) ? value : null;
}

/**
 * Valide tous les paramètres de recherche d'une liste de pistes.
 * Retourne { search, format, sort, owner } ou { error } avec un message clair.
 */
export function parseTrackQuery(query = {}) {
  const search = parseSearch(query.q);
  if (search === null) return { error: "Recherche invalide (100 caractères maximum)" };
  const format = parseFormat(query.format);
  if (format === null) return { error: `Format inconnu (valeurs possibles : ${Object.keys(FORMATS).join(", ")})` };
  const sort = parseSort(query.sort);
  if (sort === null) return { error: `Tri inconnu (valeurs possibles : ${Object.keys(SORTS).join(", ")})` };
  const owner = parseSearch(query.owner);
  if (owner === null) return { error: "Propriétaire invalide (100 caractères maximum)" };
  return { search, format, sort, owner };
}

/**
 * Options Mongoose du tri. Le tri par titre utilise une collation française
 * (strength 1) : « école », « Ecole » et « ecole » sont rangés ensemble.
 * Les autres tris n'en ont pas besoin, ce qui laisse MongoDB utiliser les index.
 */
export function sortOptions(sort) {
  return {
    sort: SORTS[sort] ?? SORTS.recent,
    collation: sort === "title" ? { locale: "fr", strength: 1 } : null,
  };
}

/** Filtre des utilisateurs dont le nom contient le texte (recherche par propriétaire). */
export function ownerNameFilter(owner) {
  return { name: { $regex: escapeRegex(owner), $options: "i" } };
}

/** Ajoute au filtre la recherche sur le titre et le format. */
function withSearch(filter, search, format = "") {
  let result = filter;
  if (search) result = { ...result, title: { $regex: escapeRegex(search), $options: "i" } };
  if (format) result = { ...result, mimeType: { $in: FORMATS[format] } };
  return result;
}

/** Filtre « mes pistes », avec recherche optionnelle sur le titre et le format. */
export function myTracksFilter(userId, search = "", format = "") {
  return withSearch({ ownerId: userId }, search, format);
}

/** Filtre des pistes publiques de tous les utilisateurs. */
export function publicTracksFilter(search = "", format = "") {
  return withSearch({ visibility: "public" }, search, format);
}

/** Filtre des pistes qu'un ami a partagées avec moi (TP4 étape 2). */
export function sharedWithMeFilter(userId, search = "", format = "") {
  return withSearch({ sharedWith: userId }, search, format);
}

/**
 * Filtre d'accès à une piste : son propriétaire peut toujours la lire,
 * les autres utilisateurs seulement si elle est publique ou partagée avec eux.
 */
export function readableTrackFilter(trackId, userId) {
  return {
    _id: trackId,
    $or: [{ ownerId: userId }, { visibility: "public" }, { sharedWith: userId }],
  };
}

/** Valide page et limit, avec un maximum imposé. */
export function parsePagination(query) {
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.min(20, Math.max(1, Number(query?.limit) || 5));
  return { page, limit };
}

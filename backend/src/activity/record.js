import { Activity } from "../models/Activity.js";

/**
 * Enregistre un événement du fil d'activité.
 * L'enregistrement est « best effort » : une erreur est journalisée mais ne
 * fait pas échouer l'action principale (upload, partage…), qui a déjà réussi.
 */
export async function recordActivity({ actor, type, track, target }) {
  try {
    await Activity.create({ actor, type, track, target });
    console.log(`[activity] ${type} enregistré pour la piste ${track}`);
  } catch (error) {
    console.error(`[activity] Impossible d'enregistrer ${type} pour la piste ${track}`, error);
  }
}

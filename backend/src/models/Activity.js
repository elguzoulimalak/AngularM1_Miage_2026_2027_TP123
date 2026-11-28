import mongoose from "mongoose";

/*
 * TP4 étape 3 : journal des actions qui alimentent le fil d'activité.
 * - track_published : `actor` a rendu `track` publique (à l'upload ou plus tard) ;
 * - track_shared : `actor` a partagé `track` avec `target`.
 * Le journal n'est jamais modifié : quand une piste redevient privée, n'est
 * plus partagée ou est supprimée, l'événement est filtré à la lecture.
 */
const schema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["track_published", "track_shared"],
      required: true,
    },
    track: { type: mongoose.Schema.Types.ObjectId, ref: "Track", required: true },
    target: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Le fil cherche les derniers événements d'une liste d'amis.
schema.index({ actor: 1, createdAt: -1 });

export const Activity = mongoose.model("Activity", schema);

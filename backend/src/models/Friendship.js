import mongoose from "mongoose";

/*
 * TP4 étape 2 : relation d'amitié entre deux utilisateurs.
 * - requester : celui qui envoie l'invitation ;
 * - recipient : celui qui la reçoit ;
 * - status : "pending" tant que l'invitation n'est pas acceptée, puis "accepted".
 * Une seule collection suffit : refuser ou retirer un ami supprime le document.
 */
const schema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "pending",
    },
  },
  { timestamps: true },
);

// Empêche deux invitations identiques. Le sens inverse (B invite A alors que
// A a déjà invité B) est vérifié dans la route avant la création.
schema.index({ requester: 1, recipient: 1 }, { unique: true });

export const Friendship = mongoose.model("Friendship", schema);

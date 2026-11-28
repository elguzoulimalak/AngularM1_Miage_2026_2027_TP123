/*
 * TP4 — finition : recherche avancée (format, tri, propriétaire).
 * Fonctions pures testées directement ; routes testées avec des doublures
 * Mongoose, sans base de données.
 */
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { Track } from "../src/models/Track.js";
import { User } from "../src/models/User.js";
import {
  myTracksFilter,
  ownerNameFilter,
  parseFormat,
  parseSort,
  parseTrackQuery,
  publicTracksFilter,
  sortOptions,
} from "../src/tracks/query.js";
import { fakeQuery } from "./helpers.js";

const SECRET = process.env.JWT_SECRET || "tp1-development-secret";
const me = new mongoose.Types.ObjectId().toString();
const headers = { Authorization: `Bearer ${jwt.sign({ sub: me, email: "moi@test.fr" }, SECRET)}` };

let server, base;

test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());
test.afterEach(() => mock.restoreAll());

/** Remplace Track.find/countDocuments et renvoie la requête simulée. */
function stubTracks(items = []) {
  const query = fakeQuery(items);
  const find = mock.method(Track, "find", () => query);
  mock.method(Track, "countDocuments", () => Promise.resolve(items.length));
  return { query, find };
}

// ---------- Fonctions pures ----------

test("parseFormat accepte les formats connus et refuse le reste", () => {
  assert.equal(parseFormat(undefined), "");
  assert.equal(parseFormat("mp3"), "mp3");
  assert.equal(parseFormat("m4a"), "m4a");
  assert.equal(parseFormat("flac"), null);
  assert.equal(parseFormat("toString"), null); // pas de clé héritée d'Object
  assert.equal(parseFormat(["mp3"]), null);
});

test("parseSort vaut recent par défaut et refuse un tri inconnu", () => {
  assert.equal(parseSort(undefined), "recent");
  assert.equal(parseSort("title"), "title");
  assert.equal(parseSort("random"), null);
});

test("parseTrackQuery renvoie une erreur claire pour chaque paramètre invalide", () => {
  assert.deepEqual(parseTrackQuery({ q: " blues ", format: "wav", sort: "size", owner: " ali " }), {
    search: "blues",
    format: "wav",
    sort: "size",
    owner: "ali",
  });
  assert.match(parseTrackQuery({ format: "flac" }).error, /Format inconnu/);
  assert.match(parseTrackQuery({ sort: "x" }).error, /Tri inconnu/);
  assert.match(parseTrackQuery({ owner: "x".repeat(101) }).error, /Propriétaire invalide/);
  assert.match(parseTrackQuery({ q: ["a", "b"] }).error, /Recherche invalide/);
});

test("le filtre de format couvre tous les types MIME du format", () => {
  assert.deepEqual(myTracksFilter("u1", "", "wav"), {
    ownerId: "u1",
    mimeType: { $in: ["audio/wav", "audio/x-wav"] },
  });
  assert.deepEqual(publicTracksFilter("riff", "mp3"), {
    visibility: "public",
    title: { $regex: "riff", $options: "i" },
    mimeType: { $in: ["audio/mpeg"] },
  });
});

test("sortOptions n'ajoute la collation française que pour le tri par titre", () => {
  assert.deepEqual(sortOptions("title"), {
    sort: { title: 1, createdAt: -1 },
    collation: { locale: "fr", strength: 1 },
  });
  assert.deepEqual(sortOptions("oldest"), { sort: { createdAt: 1 }, collation: null });
});

test("ownerNameFilter échappe la recherche", () => {
  assert.deepEqual(ownerNameFilter("a.b"), { name: { $regex: "a\\.b", $options: "i" } });
});

// ---------- Routes ----------

test("GET /api/tracks applique format et tri par titre avec collation", async () => {
  const { query, find } = stubTracks();
  const r = await fetch(base + "/api/tracks?format=ogg&sort=title", { headers });
  assert.equal(r.status, 200);
  assert.deepEqual(find.mock.calls[0].arguments[0], { ownerId: me, mimeType: { $in: ["audio/ogg"] } });
  assert.deepEqual(query.calls.sort, [{ title: 1, createdAt: -1 }]);
  assert.deepEqual(query.calls.collation, [{ locale: "fr", strength: 1 }]);
});

test("GET /api/tracks sans tri garde l'ordre récent et pas de collation", async () => {
  const { query } = stubTracks();
  await fetch(base + "/api/tracks", { headers });
  assert.deepEqual(query.calls.sort, [{ createdAt: -1 }]);
  assert.equal(query.calls.collation, undefined);
});

test("GET /api/tracks renvoie 400 pour un format ou un tri inconnu", async () => {
  const find = mock.method(Track, "find", () => fakeQuery([]));
  const r1 = await fetch(base + "/api/tracks?format=flac", { headers });
  assert.equal(r1.status, 400);
  assert.match((await r1.json()).message, /Format inconnu/);
  const r2 = await fetch(base + "/api/tracks/public?sort=random", { headers });
  assert.equal(r2.status, 400);
  assert.equal(find.mock.callCount(), 0);
});

test("GET /api/tracks/public filtre par propriétaire via les utilisateurs correspondants", async () => {
  const alice = new mongoose.Types.ObjectId();
  const users = mock.method(User, "find", () => fakeQuery([{ _id: alice }]));
  const { find, query } = stubTracks();

  const r = await fetch(base + "/api/tracks/public?owner=ali&sort=oldest", { headers });
  assert.equal(r.status, 200);
  assert.deepEqual(users.mock.calls[0].arguments[0], { name: { $regex: "ali", $options: "i" } });
  assert.deepEqual(find.mock.calls[0].arguments[0], { visibility: "public", ownerId: { $in: [alice] } });
  assert.deepEqual(query.calls.sort, [{ createdAt: 1 }]);
});

test("GET /api/tracks/shared renvoie une page vide si aucun propriétaire ne correspond", async () => {
  mock.method(User, "find", () => fakeQuery([]));
  const find = mock.method(Track, "find", () => fakeQuery([]));
  const r = await fetch(base + "/api/tracks/shared?owner=zz", { headers });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { items: [], page: 1, limit: 5, total: 0, pages: 1 });
  assert.equal(find.mock.callCount(), 0);
});

test("GET /api/tracks/shared combine partage, format et taille décroissante", async () => {
  const { find, query } = stubTracks();
  const r = await fetch(base + "/api/tracks/shared?format=m4a&sort=size", { headers });
  assert.equal(r.status, 200);
  assert.deepEqual(find.mock.calls[0].arguments[0], {
    sharedWith: me,
    mimeType: { $in: ["audio/mp4", "audio/x-m4a"] },
  });
  assert.deepEqual(query.calls.sort, [{ size: -1, createdAt: -1 }]);
});

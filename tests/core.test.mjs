import assert from "node:assert/strict";
import test from "node:test";

import { verifyAdminAuthorization, secureCompare } from "../lib/admin-auth.ts";
import {
  FALLBACK_GAME_IMAGE,
  encodeGameSlugPath,
  getGameStatusBadge,
  getSlugLookupCandidates,
  normalizeDownloadLinks,
  normalizeRequirements,
  parsePageNumber,
  requirementsToRows,
  resolveGameImagePath,
} from "../lib/game-data.ts";

test("resolveGameImagePath handles Blob URLs, relative paths, bare filenames, and fallbacks", () => {
  assert.equal(
    resolveGameImagePath("https://abc.public.blob.vercel-storage.com/games/zort.webp"),
    "https://abc.public.blob.vercel-storage.com/games/zort.webp"
  );
  assert.equal(resolveGameImagePath("/games/zort.webp"), "/games/zort.webp");
  assert.equal(resolveGameImagePath("zort.webp"), "/games/zort.webp");
  assert.equal(resolveGameImagePath(""), FALLBACK_GAME_IMAGE);
  assert.equal(resolveGameImagePath(null), FALLBACK_GAME_IMAGE);
});

test("getSlugLookupCandidates handles decoded and percent-encoded non-ASCII slugs", () => {
  assert.deepEqual(
    getSlugLookupCandidates("umigari-%E3%82%A6%E3%83%9F%E3%82%AC%E3%83%AA"),
    ["umigari-%E3%82%A6%E3%83%9F%E3%82%AC%E3%83%AA", "umigari-ウミガリ"]
  );
  assert.deepEqual(getSlugLookupCandidates("zort"), ["zort"]);
  assert.deepEqual(getSlugLookupCandidates("%E0%A4%A"), ["%E0%A4%A"]);
});

test("encodeGameSlugPath percent-encodes Unicode slugs safely", () => {
  assert.equal(encodeGameSlugPath("zort"), "/game/zort");
  assert.equal(
    encodeGameSlugPath("umigari-ウミガリ"),
    "/game/umigari-%E3%82%A6%E3%83%9F%E3%82%AC%E3%83%AA"
  );
});

test("getGameStatusBadge handles Date and ISO string timestamps", () => {
  const now = Date.UTC(2026, 10, 13);
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
  const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();

  assert.equal(getGameStatusBadge(oneDayAgo, oneDayAgo, now), "New Entry");
  assert.equal(getGameStatusBadge(tenDaysAgo, twoDaysAgo, now), "Updated");
  assert.equal(getGameStatusBadge(tenDaysAgo, tenDaysAgo, now), null);
});

test("parsePageNumber clamps invalid or negative page numbers to 1", () => {
  assert.equal(parsePageNumber(undefined), 1);
  assert.equal(parsePageNumber("0"), 1);
  assert.equal(parsePageNumber("-4"), 1);
  assert.equal(parsePageNumber("abc"), 1);
  assert.equal(parsePageNumber("3"), 3);
  assert.equal(parsePageNumber(["5", "2"]), 5);
});

test("normalizeRequirements and normalizeDownloadLinks sanitize malformed inputs", () => {
  const reqs = normalizeRequirements(JSON.stringify({ cpu: "i5", ram: "8 GB", extra: "ignored" }));
  assert.deepEqual(requirementsToRows(reqs), [
    { key: "Processor", value: "i5" },
    { key: "Memory", value: "8 GB" },
  ]);

  const links = normalizeDownloadLinks([
    { url: "https://gofile.io/d/abc", host: "gofile.io", label: "Gofile" },
    { url: "https://gofile.io/d/abc", host: "gofile.io", label: "Duplicate" },
    { url: "javascript:alert(1)", host: "evil", label: "Bad" },
  ]);
  assert.equal(links.length, 1);
  assert.equal(links[0].url, "https://gofile.io/d/abc");
});

test("verifyAdminAuthorization enforces Basic Auth and fails closed when unconfigured", () => {
  assert.equal(verifyAdminAuthorization(null, {}).status, 503);

  const env = { ADMIN_USERNAME: "admin", ADMIN_PASSWORD: "secret-password" };
  assert.equal(verifyAdminAuthorization(null, env).status, 401);

  const wrong = `Basic ${btoa("admin:wrong-password")}`;
  assert.equal(verifyAdminAuthorization(wrong, env).status, 401);

  const valid = `Basic ${btoa("admin:secret-password")}`;
  assert.deepEqual(verifyAdminAuthorization(valid, env), { ok: true });

  assert.equal(secureCompare("abc", "abcd"), false);
  assert.equal(secureCompare("abc", "abc"), true);
});


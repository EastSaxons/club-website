#!/usr/bin/env node
// Daily sync: ECB Play-Cricket API -> data/fixtures.json
// Runs ONLY inside GitHub Actions (or locally by an admin). Uses Node 18+ built-in fetch, no dependencies.
//
// Env:
//   PLAY_CRICKET_API_TOKEN  (secret, required)  - never printed, never written to disk
//   PLAY_CRICKET_SITE_ID    (variable, required) - numeric Play-Cricket site id
//   PLAY_CRICKET_CLUB_ID    (variable, optional) - club id used in fixtures; inferred when blank
//   PLAY_CRICKET_SEASONS    (optional) - e.g. "2026,2027"; default = current + coming season
//   PLAY_CRICKET_SITE_URL   (optional) - default https://eastsaxons.play-cricket.com
//   FIXTURES_OUTPUT         (optional) - default data/fixtures.json
//
// When the token or site id is missing the script exits 0 without touching the file,
// so the existing feed stays in place until the club connects the API.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  normalizeMatches,
  buildDocument,
  sameContent,
  defaultSeasons,
  inferClubId,
} from "./lib/normalize-fixtures.mjs";

const DEFAULT_API_BASE = "https://www.play-cricket.com/api/v2";
// Override exists only for local tests against a mock server; the token can never be sent elsewhere.
const API_BASE = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(process.env.PLAY_CRICKET_API_BASE || "")
  ? process.env.PLAY_CRICKET_API_BASE.replace(/\/$/, "")
  : DEFAULT_API_BASE;
const RETRY_DELAY_MS = Number(process.env.PLAY_CRICKET_RETRY_DELAY_MS || 2000);
const token = (process.env.PLAY_CRICKET_API_TOKEN || "").trim();
const siteId = (process.env.PLAY_CRICKET_SITE_ID || "").trim();
const clubIdConfig = (process.env.PLAY_CRICKET_CLUB_ID || "").trim();
const siteUrl = (process.env.PLAY_CRICKET_SITE_URL || "https://eastsaxons.play-cricket.com").trim();
const output = process.env.FIXTURES_OUTPUT || "data/fixtures.json";
const seasons = (process.env.PLAY_CRICKET_SEASONS || "").trim()
  ? process.env.PLAY_CRICKET_SEASONS.split(",").map((s) => s.trim()).filter(Boolean)
  : defaultSeasons();

const redact = (text) => (token ? String(text).split(token).join("***") : String(text));
const log = (msg) => console.log(redact(msg));
const fail = (msg) => {
  console.error(`::error::${redact(msg)}`);
  process.exit(1);
};

async function fetchJson(endpoint, params) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("api_token", token);
  const label = `${endpoint} (season ${params.season})`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "EastSaxonsCC-fixtures-sync/1.0 (GitHub Actions)" },
        signal: AbortSignal.timeout(30_000),
        redirect: "error",
      });
      if (res.status === 401 || res.status === 403) {
        throw Object.assign(new Error(`${label}: access denied (HTTP ${res.status}). Check the API token and site id.`), { fatal: true });
      }
      if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
      const type = res.headers.get("content-type") || "";
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`${label}: response was not JSON (content-type ${type || "unknown"})`);
      }
    } catch (err) {
      lastError = err;
      if (err.fatal) break;
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * RETRY_DELAY_MS));
    }
  }
  throw lastError;
}

async function readExisting() {
  try {
    return JSON.parse(await readFile(output, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  if (!token || !siteId) {
    log(
      "::notice::PLAY_CRICKET_API_TOKEN secret and/or PLAY_CRICKET_SITE_ID variable not set - skipping sync. " +
        "The site keeps showing its current data.",
    );
    return;
  }
  if (!/^\d+$/.test(siteId)) fail("PLAY_CRICKET_SITE_ID must be numeric.");

  const existing = await readExisting();
  const rawMatches = [];
  const rawResults = [];
  const resultsFailedSeasons = new Set();

  for (const season of seasons) {
    let data;
    try {
      data = await fetchJson("matches.json", { site_id: siteId, season });
    } catch (err) {
      // Any fixtures failure aborts without writing, so a bad API day never wipes the site.
      fail(`Could not fetch fixtures: ${err.message}`);
    }
    if (!Array.isArray(data?.matches)) fail(`Unexpected fixtures response for ${season}. Existing feed preserved.`);
    const rows = data.matches;
    log(`Season ${season}: ${rows.length} fixture rows`);
    rawMatches.push(...rows);

    try {
      const res = await fetchJson("result_summary.json", { site_id: siteId, season });
      if (!Array.isArray(res?.result_summary)) throw new Error("Unexpected results response");
      const rrows = res.result_summary;
      log(`Season ${season}: ${rrows.length} result rows`);
      rawResults.push(...rrows);
    } catch (err) {
      if (err.fatal) fail(err.message);
      resultsFailedSeasons.add(String(season));
      log(`::warning::Results unavailable for ${season} (${err.message}); keeping previously synced results.`);
    }
  }

  const clubId = inferClubId(rawMatches, clubIdConfig);
  if (!clubId && rawMatches.some((m) => m && String(m.status).toLowerCase() !== "deleted")) {
    fail("Could not identify East Saxons CC. Configure PLAY_CRICKET_CLUB_ID.");
  }
  const { matches, stats } = normalizeMatches({ rawMatches, rawResults, clubId });

  // Carry forward previous results for seasons whose result call failed today.
  if (resultsFailedSeasons.size && existing && !existing.sample) {
    const prev = new Map((existing.matches || []).map((m) => [m.id, m]));
    for (const m of matches) {
      const old = prev.get(m.id);
      if (!m.result && old?.result && resultsFailedSeasons.has(String(m.season))) {
        m.result = old.result;
        m.status = old.status;
      }
    }
  }

  // Guard: an empty response should never silently replace real fixtures.
  const prevReal = existing && !existing.sample ? (existing.matches || []).filter((m) => seasons.includes(String(m.season))) : [];
  for (const season of seasons) {
    if (prevReal.some((m) => m.season === season) && !matches.some((m) => m.season === season)) {
      fail(`API returned no usable fixtures for ${season}. Existing feed preserved.`);
    }
  }

  log(
    `Normalised ${matches.length} fixtures (club id ${clubId || "unknown"}; ` +
      `dropped ${stats.deleted} deleted, ${stats.unpublished} unpublished, ${stats.invalid} invalid, ${stats.notOurs} other-club).`,
  );

  const doc = buildDocument({ matches, seasons, generatedAt: new Date().toISOString(), siteUrl });
  if (sameContent(doc, existing)) {
    log("No fixture changes - file left untouched.");
    return;
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  log(`Wrote ${output}.`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = `### Play-Cricket sync\n\n- Seasons: ${seasons.join(", ")}\n- Fixtures written: ${matches.length}\n- Deleted/unpublished dropped: ${stats.deleted}/${stats.unpublished}\n`;
    await writeFile(process.env.GITHUB_STEP_SUMMARY, summary, { flag: "a" });
  }
}

main().catch((err) => fail(err?.message || String(err)));

// Pure normalisation of ECB Play-Cricket API responses into data/fixtures.json.
// No network, no secrets: sync-fixtures.mjs fetches, this module only reshapes.
//
// Inputs (ECB Play-Cricket API v2):
//   matches.json        -> { matches: [ { id, status: "New"|"Deleted", published: "Yes"|"No",
//                            match_date: "dd/mm/yyyy", match_time: "HH:MM", ground_name,
//                            home_club_id, home_club_name, home_team_id, home_team_name,
//                            away_club_id, away_club_name, away_team_id, away_team_name,
//                            competition_name, competition_type, league_name, season, ... } ] }
//   result_summary.json -> { result_summary: [ { id, status, result, result_description,
//                            result_applied_to, innings: [ { team_batting_id, runs, wickets, overs } ] } ] }
// Unknown or missing fields are tolerated; anything we cannot ground is left null.

export const SCHEMA_VERSION = 1;
export const MATCH_CENTRE_BASE = "https://www.play-cricket.com/website/results/";

const str = (v) => (v === null || v === undefined ? "" : String(v).trim());

/** "31/08/2026" -> "2026-08-31"; anything else -> null */
export function parseUkDate(value) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str(value));
  if (!m) return null;
  const [, d, mo, y] = m;
  const day = Number(d);
  const month = Number(mo);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const check = new Date(Date.UTC(Number(y), month - 1, day));
  if (check.getUTCMonth() !== month - 1) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "13:00" -> "13:00"; "", "00:00", junk -> null (Play-Cricket uses 00:00 for "no time set") */
export function parseTime(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(str(value));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59 || (h === 0 && min === 0)) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/** Map a Play-Cricket team name to a filter key. */
export function teamKeyFrom(teamName) {
  const n = str(teamName).toLowerCase();
  if (/\b(1st|first|1s)\b/.test(n) || /\bi\s*xi\b/.test(n)) return "1st";
  if (/\b(2nd|second|2s)\b/.test(n) || /\bii\s*xi\b/.test(n)) return "2nd";
  if (/\b(3rd|third|3s)\b/.test(n) || /\biii\s*xi\b/.test(n)) return "3rd";
  return "other";
}

/** Only build a match-centre link from a real numeric Play-Cricket match id. */
export function matchCentreUrl(id) {
  const s = str(id);
  return /^\d+$/.test(s) ? `${MATCH_CENTRE_BASE}${s}` : null;
}

/**
 * The club's own Play-Cricket club id. Preferred: explicit config.
 * Otherwise: the club id that appears in (nearly) every fixture on the club site.
 */
export function inferClubId(rawMatches, configuredClubId) {
  if (str(configuredClubId)) return str(configuredClubId);
  const namedIds = new Set();
  const counts = new Map();
  for (const m of rawMatches) {
    if (!m || str(m.status).toLowerCase() === "deleted") continue;
    for (const side of ["home", "away"]) {
      const id = str(m[`${side}_club_id`]);
      if (id && /^east saxons(?: cc| cricket club)?$/i.test(str(m[`${side}_club_name`]))) namedIds.add(id);
    }
    for (const id of new Set([str(m.home_club_id), str(m.away_club_id)])) {
      if (id) counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  if (namedIds.size === 1) return [...namedIds][0];
  let best = null;
  let bestCount = 0;
  for (const [id, c] of counts) {
    if (c > bestCount) {
      best = id;
      bestCount = c;
    } else if (c === bestCount) {
      best = null;
    }
  }
  return best;
}

function formatInnings(inn) {
  if (!inn) return null;
  const runs = str(inn.runs);
  if (!runs) return null;
  const wkts = str(inn.wickets);
  const overs = str(inn.overs);
  let score = wkts === "10" ? `${runs} all out` : wkts ? `${runs}/${wkts}` : runs;
  if (str(inn.declared).toLowerCase() === "true" || inn.declared === true) score += " dec";
  if (overs) score += ` (${overs} ov)`;
  return score;
}

/**
 * Turn a result_summary entry into our result object, from our club's perspective.
 * Returns { outcome, summary, ourScore, theirScore } or null when nothing usable.
 */
export function normalizeResult(r, ourTeamId, theirTeamId) {
  if (!r || str(r.status).toLowerCase() === "deleted" || str(r.published).toLowerCase() === "no") return null;
  const code = str(r.result).toUpperCase();
  const desc = str(r.result_description);
  const appliedTo = str(r.result_applied_to);
  let outcome = null;
  if (code === "W" || code === "L") {
    if (appliedTo && (appliedTo === ourTeamId || appliedTo === theirTeamId)) {
      const weAreSubject = appliedTo === ourTeamId;
      outcome = (code === "W") === weAreSubject ? "won" : "lost";
    }
  } else if (code === "D") outcome = "draw";
  else if (code === "T") outcome = "tie";
  else if (code === "A") outcome = "abandoned";
  else if (code === "C") outcome = "cancelled";
  else if (code === "N" || code === "NR") outcome = "no-result";
  else if (code === "CON") {
    // Conceded: result_applied_to is the side that conceded.
    if (appliedTo === ourTeamId) outcome = "lost";
    else if (appliedTo === theirTeamId) outcome = "won";
  }
  if (!outcome && /in progress/i.test(desc)) return null;
  if (!outcome) {
    if (/abandon/i.test(desc)) outcome = "abandoned";
    else if (/cancel/i.test(desc)) outcome = "cancelled";
    else if (/no result/i.test(desc)) outcome = "no-result";
    else if (/\bdraw/i.test(desc)) outcome = "draw";
    else if (/\btie/i.test(desc)) outcome = "tie";
  }
  const innings = Array.isArray(r.innings) ? r.innings : [];
  const ours = innings.filter((i) => str(i.team_batting_id) === ourTeamId);
  const theirs = innings.filter((i) => str(i.team_batting_id) === theirTeamId);
  const ourScore = ours.map(formatInnings).filter(Boolean).join(" & ") || null;
  const theirScore = theirs.map(formatInnings).filter(Boolean).join(" & ") || null;
  if (!outcome && !desc && !ourScore && !theirScore) return null;
  return { outcome: outcome || "unknown", summary: desc || null, ourScore, theirScore };
}

function statusFromOutcome(outcome) {
  if (outcome === "cancelled") return "cancelled";
  if (outcome === "abandoned") return "abandoned";
  return "completed";
}

/**
 * Normalise raw API rows. Deleted and unpublished rows are dropped and counted.
 * @returns {{ matches: object[], stats: { received: number, deleted: number, unpublished: number, invalid: number, notOurs: number } }}
 */
export function normalizeMatches({ rawMatches, rawResults = [], clubId }) {
  const stats = { received: rawMatches.length, deleted: 0, unpublished: 0, invalid: 0, notOurs: 0 };
  const resultsById = new Map();
  for (const r of rawResults) if (str(r?.id)) resultsById.set(str(r?.id), r);

  const byId = new Map();
  for (const m of rawMatches) {
    const id = str(m?.id);
    if (!m) {
      stats.invalid++;
      continue;
    }
    if (str(m.status).toLowerCase() === "deleted") {
      stats.deleted++;
      if (id) byId.delete(id); // a later "Deleted" row supersedes an earlier copy
      continue;
    }
    if (str(m.published).toLowerCase() === "no") {
      stats.unpublished++;
      if (id) byId.delete(id);
      continue;
    }
    const date = parseUkDate(m.match_date);
    if (!/^\d+$/.test(id) || !date) {
      stats.invalid++;
      continue;
    }
    const homeClub = str(m.home_club_id);
    const awayClub = str(m.away_club_id);
    const isHome = clubId ? homeClub === clubId : true;
    if (clubId && homeClub !== clubId && awayClub !== clubId) {
      stats.notOurs++;
      continue;
    }
    const side = isHome ? "home" : "away";
    const other = isHome ? "away" : "home";
    const team = str(m[`${side}_team_name`]) || null;
    const oppClub = str(m[`${other}_club_name`]);
    const oppTeam = str(m[`${other}_team_name`]);
    const opponent = [oppClub, oppTeam].filter(Boolean).join(" ") || null;
    const ourTeamId = str(m[`${side}_team_id`]);
    const theirTeamId = str(m[`${other}_team_id`]);
    const result = normalizeResult(resultsById.get(id), ourTeamId, theirTeamId);

    byId.set(id, {
      id: `pc-${id}`,
      playCricketId: Number(id),
      season: str(m.season) || date.slice(0, 4),
      team,
      teamKey: teamKeyFrom(team),
      date,
      time: parseTime(m.match_time),
      opponent,
      venue: str(m.ground_name) || null,
      homeAway: side,
      competition: str(m.competition_name) || str(m.league_name) || (str(m.competition_type) === "Friendly" ? "Friendly" : null),
      competitionType: str(m.competition_type) || null,
      status: result ? statusFromOutcome(result.outcome) : "scheduled",
      result,
      matchCentreUrl: matchCentreUrl(id),
    });
  }

  const matches = [...byId.values()].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time || "99:99").localeCompare(b.time || "99:99") ||
      a.playCricketId - b.playCricketId,
  );
  return { matches, stats };
}

export function buildDocument({ matches, seasons, generatedAt, siteUrl }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    source: "play-cricket",
    sample: false,
    generatedAt,
    seasons: seasons.map(String),
    club: { name: "East Saxons CC", playCricketUrl: siteUrl },
    matches,
  };
}

/** True when two documents differ only in generatedAt (avoids a daily no-op commit). */
export function sameContent(a, b) {
  if (!a || !b) return false;
  const strip = ({ generatedAt, ...rest }) => rest; // eslint-disable-line no-unused-vars
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

/** Current and coming season, based on today's date in the UK. */
export function defaultSeasons(now = new Date()) {
  const year = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric" }).format(now));
  return [String(year), String(year + 1)];
}

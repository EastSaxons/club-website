// East Saxons CC - fixtures helpers (pure functions, no DOM).
// Shared by fixtures.js and the unit tests. Plain ES module: works on GitHub Pages with no build step.

export const PLAY_CRICKET_HOME = "https://eastsaxons.play-cricket.com/home";
export const PLAY_CRICKET_MATCHES = "https://eastsaxons.play-cricket.com/Matches";

export const TEAM_LABELS = { all: "All teams", "1st": "1st XI", "2nd": "2nd XI", "3rd": "3rd XI", other: "Other" };
export const OUTCOME_LABELS = {
  won: "Won",
  lost: "Lost",
  draw: "Draw",
  tie: "Tie",
  "no-result": "No result",
  abandoned: "Abandoned",
  cancelled: "Cancelled",
  unknown: "Result",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in the UK as YYYY-MM-DD (fixtures are UK local dates). */
export function londonToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Only allow links to the official Play-Cricket domain. */
export function safePlayCricketUrl(url) {
  if (typeof url !== "string") return null;
  return /^https:\/\/([a-z0-9-]+\.)?play-cricket\.com\/[^\s"'<>]*$/i.test(url) ? url : null;
}

/** Validate the fixtures document shape; drops malformed rows instead of crashing the page. */
export function readDocument(doc) {
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.matches)) {
    throw new Error("Fixtures file is not in the expected format.");
  }
  const matches = doc.matches.filter((m) => m && typeof m.id === "string" && ISO_DATE.test(m.date || ""));
  return {
    sample: doc.sample === true || doc.source === "sample",
    notice: typeof doc.notice === "string" ? doc.notice : null,
    generatedAt: typeof doc.generatedAt === "string" ? doc.generatedAt : null,
    seasons: Array.isArray(doc.seasons) ? doc.seasons.map(String) : [],
    matches,
  };
}

const byDateAsc = (a, b) => a.date.localeCompare(b.date) || (a.time || "99:99").localeCompare(b.time || "99:99");

/** Fixtures still to come (cancelled future fixtures stay visible, flagged). Soonest first. */
export function upcomingMatches(matches, today) {
  return matches
    .filter((m) => m.date >= today && (m.status === "scheduled" || m.status === "cancelled"))
    .sort(byDateAsc);
}

/** Played / past fixtures, most recent first. */
export function resultMatches(matches, today) {
  return matches
    .filter((m) => !(m.date >= today && (m.status === "scheduled" || m.status === "cancelled")))
    .sort((a, b) => byDateAsc(b, a));
}

/** The next fixture that is actually going ahead. */
export function nextMatch(matches, today, teamKey = "all") {
  return (
    upcomingMatches(matches, today).find(
      (m) => m.status === "scheduled" && (teamKey === "all" || m.teamKey === teamKey),
    ) || null
  );
}

export function filterMatches(matches, { team = "all", month = "all" } = {}) {
  return matches.filter(
    (m) => (team === "all" || m.teamKey === team) && (month === "all" || m.date.slice(0, 7) === month),
  );
}

/** Team filter keys present: always 1st/2nd/3rd XI, plus "other" when the data has it. */
export function teamKeysIn(matches) {
  const keys = ["all", "1st", "2nd", "3rd"];
  if (matches.some((m) => m.teamKey === "other")) keys.push("other");
  return keys;
}

export function monthsIn(matches) {
  return [...new Set(matches.map((m) => m.date.slice(0, 7)))].sort();
}

export function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function dateParts(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { weekday: WEEKDAYS[wd], day: String(d), month: MONTHS[m - 1], year: String(y) };
}

export function formatDate(iso) {
  const p = dateParts(iso);
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

export function daysUntil(iso, today) {
  const toUtc = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(iso) - toUtc(today)) / 86_400_000);
}

export function countdownLabel(iso, today) {
  const n = daysUntil(iso, today);
  if (n <= 0) return "Today";
  if (n === 1) return "Tomorrow";
  return `In ${n} days`;
}

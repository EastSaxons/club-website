// East Saxons CC - fixtures widgets for the static GitHub Pages site.
// Reads data/fixtures.json (written daily by the GitHub Action). No API token, no backend.
//
// Mount points (add to any page, then load: <script type="module" src="fixtures.js"></script>):
//   <div data-es-next-match>fallback markup</div>   homepage "Next Match" hero card
//   <div data-es-upcoming-teams></div>              homepage next fixture per XI
//   <div data-es-schedule></div>                    full fixture list with team + month filters
//   <div data-es-results></div>                     results with team + month filters
// Optional attribute on any mount: data-src="path/to/fixtures.json"

import {
  PLAY_CRICKET_HOME,
  PLAY_CRICKET_MATCHES,
  PLAY_CRICKET_WEEKLY,
  TEAM_LABELS,
  OUTCOME_LABELS,
  londonToday,
  escapeHtml as esc,
  safePlayCricketUrl,
  readDocument,
  upcomingMatches,
  resultMatches,
  nextMatch,
  filterMatches,
  teamKeysIn,
  monthsIn,
  monthLabel,
  dateParts,
  formatDate,
  countdownLabel,
} from "./fixtures-core.js";

const DEFAULT_SRC = "data/fixtures.json";
const cache = new Map();

function load(src) {
  if (!cache.has(src)) {
    cache.set(
      src,
      fetch(src, { cache: "no-cache" })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(readDocument)
        .catch((err) => {
          cache.delete(src); // allow retry
          throw err;
        }),
    );
  }
  return cache.get(src);
}

/* ---------- icons (inline SVG, currentColor) ---------- */
const icon = {
  clock: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-12.5a.75.75 0 00-1.5 0V10c0 .2.08.39.22.53l2.5 2.5a.75.75 0 101.06-1.06l-2.28-2.28V5.5z" clip-rule="evenodd"/></svg>',
  pin: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M9.69 18.93l.03.02a.75.75 0 00.56 0l.03-.02c.18-.1.43-.25.74-.45a19.6 19.6 0 002.3-1.83C15.07 15.06 17 12.6 17 9.5a7 7 0 10-14 0c0 3.1 1.93 5.56 3.65 7.15a19.6 19.6 0 003.04 2.28zM10 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clip-rule="evenodd"/></svg>',
  trophy: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5 2.75A.75.75 0 015.75 2h8.5a.75.75 0 01.75.75V3h1.25a.75.75 0 01.75.75V5a3.5 3.5 0 01-3.06 3.47A5 5 0 0110.75 11.9v2.6h2.5a.75.75 0 010 1.5h-6.5a.75.75 0 010-1.5h2.5v-2.6a5 5 0 01-3.19-3.43A3.5 3.5 0 013 5V3.75A.75.75 0 013.75 3H5v-.25zM5 4.5H4.5V5a2 2 0 00.6 1.43A5 5 0 015 5.5v-1zm10 1v-1h.5V5a2 2 0 01-.6 1.43c.06-.3.1-.61.1-.93z" clip-rule="evenodd"/></svg>',
  cal: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clip-rule="evenodd"/></svg>',
  ext: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .41.34.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm6.5-2.75A.75.75 0 0111.5 2h5.75a.75.75 0 01.75.75V8.5a.75.75 0 01-1.5 0V4.56l-6.22 6.22a.75.75 0 11-1.06-1.06l6.22-6.22H11.5a.75.75 0 01-.75-.75z" clip-rule="evenodd"/></svg>',
};

/* ---------- shared fragments ---------- */
function sampleBanner(doc) {
  if (!doc.sample) return "";
  return `<div class="es-sample-banner" role="note">
    <span class="es-sample-banner__tag">Sample data</span>
    <p><strong>These are placeholder fixtures for previewing the new design &mdash; not real East Saxons matches.</strong>
    Real fixtures will appear automatically once the club connects Play-Cricket.
    <a href="${PLAY_CRICKET_MATCHES}" target="_blank" rel="noopener noreferrer">See official fixtures on Play-Cricket</a>.</p>
  </div>`;
}

function sourceLine(doc, count, noun) {
  const updated = doc.generatedAt && !doc.sample
    ? `Updated from Play-Cricket ${esc(formatDate(doc.generatedAt.slice(0, 10)))}`
    : doc.sample ? "Sample data &middot; not real fixtures" : "Play-Cricket";
  return `<p class="es-meta"><span>${count} ${noun}${count === 1 ? "" : "s"}</span><span aria-hidden="true">&bull;</span><span>${updated}</span></p>`;
}

function matchLink(m, label = "Match centre") {
  const url = safePlayCricketUrl(m.matchCentreUrl);
  if (url) {
    return `<a class="es-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ${icon.ext}</a>`;
  }
  // No grounded match id (e.g. sample data): link to the official list, labelled honestly.
  return `<a class="es-btn es-btn--ghost" href="${PLAY_CRICKET_MATCHES}" target="_blank" rel="noopener noreferrer">Play-Cricket fixtures ${icon.ext}</a>`;
}

function tags(m, doc) {
  const out = [`<span class="es-tag es-tag--team">${esc(m.team || TEAM_LABELS[m.teamKey] || "East Saxons")}</span>`];
  out.push(`<span class="es-tag es-tag--${m.homeAway === "home" ? "home" : "away"}">${m.homeAway === "home" ? "Home" : "Away"}</span>`);
  if (m.status === "cancelled") out.push('<span class="es-tag es-tag--cancelled">Cancelled</span>');
  if (doc.sample || String(m.id).startsWith("sample-")) out.push('<span class="es-tag es-tag--sample">Sample</span>');
  return out.join("");
}

function metaList(m) {
  const items = [
    `<li>${icon.clock}<span>${m.time ? esc(m.time) : "Time TBC"}</span></li>`,
    `<li>${icon.pin}<span>${m.venue ? esc(m.venue) : "Venue TBC"}</span></li>`,
  ];
  if (m.competition) items.push(`<li>${icon.trophy}<span>${esc(m.competition)}</span></li>`);
  return `<ul class="es-card__meta">${items.join("")}</ul>`;
}

function dateBlock(m) {
  const p = dateParts(m.date);
  return `<div class="es-date" aria-hidden="true"><span class="es-date__wd">${p.weekday}</span><span class="es-date__d">${p.day}</span><span class="es-date__m">${p.month}</span></div>`;
}

function fixtureCard(m, doc) {
  return `<article class="es-card${m.status === "cancelled" ? " es-card--cancelled" : ""}" aria-label="${esc(`${formatDate(m.date)}, ${m.team || ""} versus ${m.opponent || "opponent TBC"}`)}">
    ${dateBlock(m)}
    <div class="es-card__body">
      <div class="es-card__tags">${tags(m, doc)}</div>
      <h4 class="es-card__title"><span class="es-vs">vs</span> ${esc(m.opponent || "Opponent TBC")}</h4>
      ${metaList(m)}
    </div>
    <div class="es-card__action">${matchLink(m)}</div>
  </article>`;
}

function resultCard(m, doc) {
  const r = m.result;
  const outcome = r ? r.outcome : "pending";
  const label = r ? OUTCOME_LABELS[r.outcome] || "Result" : "Awaiting result";
  const scores = r && (r.ourScore || r.theirScore)
    ? `<dl class="es-scores">
        <div><dt>${esc(m.team ? `East Saxons ${m.team}` : "East Saxons")}</dt><dd>${esc(r.ourScore || "–")}</dd></div>
        <div><dt>${esc(m.opponent || "Opponent")}</dt><dd>${esc(r.theirScore || "–")}</dd></div>
      </dl>`
    : "";
  return `<article class="es-card es-result es-result--${esc(outcome)}" aria-label="${esc(`${formatDate(m.date)}, ${m.team || ""} versus ${m.opponent || "opponent TBC"}`)}">
    ${dateBlock(m)}
    <div class="es-card__body">
      <div class="es-card__tags"><span class="es-outcome">${esc(label)}</span>${tags(m, doc)}</div>
      <h4 class="es-card__title"><span class="es-vs">vs</span> ${esc(m.opponent || "Opponent TBC")}</h4>
      ${r && r.summary ? `<p class="es-summary">${esc(r.summary)}</p>` : ""}
      ${scores}
      ${metaList(m)}
    </div>
    <div class="es-card__action">${matchLink(m, "Scorecard")}</div>
  </article>`;
}

function skeleton(rows = 3) {
  return `<div class="es-skeleton-list" aria-busy="true" aria-label="Loading fixtures">${'<div class="es-skeleton"></div>'.repeat(rows)}</div>`;
}

function errorState(el, retry) {
  el.innerHTML = `<div class="es-state es-state--error" role="alert">
    <p class="es-state__title">Fixtures couldn&rsquo;t load right now</p>
    <p>Please try again, or view the official list on Play-Cricket.</p>
    <div class="es-state__actions">
      <button type="button" class="es-btn es-btn--ghost" data-es-retry>Try again</button>
      <a class="es-btn" href="${PLAY_CRICKET_MATCHES}" target="_blank" rel="noopener noreferrer">Open Play-Cricket ${icon.ext}</a>
    </div>
  </div>`;
  el.querySelector("[data-es-retry]").addEventListener("click", retry);
}

function emptyState(title, body, withClear, playCricketUrl) {
  return `<div class="es-state">
    <p class="es-state__title">${title}</p>
    <p>${body}</p>
    <div class="es-state__actions">
      ${withClear ? '<button type="button" class="es-btn es-btn--ghost" data-es-clear>Show all fixtures</button>' : ""}
      <a class="es-btn" href="${playCricketUrl}" target="_blank" rel="noopener noreferrer">Play-Cricket ${icon.ext}</a>
    </div>
  </div>`;
}

/* ---------- filters (team + month, kept in the URL for sharing) ---------- */
function readParams() {
  const p = new URLSearchParams(window.location.search);
  return { team: p.get("team") || "all", month: p.get("month") || "all" };
}
function writeParams({ team, month }) {
  const p = new URLSearchParams(window.location.search);
  team === "all" ? p.delete("team") : p.set("team", team);
  month === "all" ? p.delete("month") : p.set("month", month);
  const qs = p.toString();
  history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
}

function mountFilterableList(el, doc, pool, { noun, emptyAll, renderItem, groupDesc, playCricketUrl = PLAY_CRICKET_WEEKLY }) {
  const teamKeys = teamKeysIn(pool);
  let state = readParams();
  if (!teamKeys.includes(state.team)) state.team = "all";

  const render = () => {
    const months = monthsIn(filterMatches(pool, { team: state.team }));
    if (groupDesc) months.reverse();
    if (state.month !== "all" && !months.includes(state.month)) state.month = "all";
    const list = filterMatches(pool, state);

    const teamButtons = teamKeys
      .map((k) => `<button type="button" class="es-seg__btn" data-team="${k}" aria-pressed="${state.team === k}">${TEAM_LABELS[k]}</button>`)
      .join("");
    const monthOptions = ['<option value="all">All months</option>']
      .concat(months.map((ym) => `<option value="${ym}"${state.month === ym ? " selected" : ""}>${monthLabel(ym)}</option>`))
      .join("");

    let body;
    if (pool.length === 0) body = emptyState(emptyAll.title, emptyAll.body, false, playCricketUrl);
    else if (list.length === 0) body = emptyState(`No ${noun}s match these filters`, "Try another team or month.", true, playCricketUrl);
    else {
      const groups = new Map();
      for (const m of list) {
        const ym = m.date.slice(0, 7);
        if (!groups.has(ym)) groups.set(ym, []);
        groups.get(ym).push(m);
      }
      body = [...groups]
        .map(([ym, items]) => `<section class="es-group"><h3 class="es-group__title">${monthLabel(ym)}</h3><div class="es-list">${items.map((m) => renderItem(m, doc)).join("")}</div></section>`)
        .join("");
    }

    const focused = document.activeElement;
    el.innerHTML = `${sampleBanner(doc)}
      <div class="es-toolbar">
        <div class="es-seg" role="group" aria-label="Filter by team">${teamButtons}</div>
        <label class="es-select"><span class="es-select__label">${icon.cal} Month</span>
          <select data-es-month aria-label="Filter by month">${monthOptions}</select></label>
      </div>
      ${sourceLine(doc, list.length, noun)}
      <div aria-live="polite">${body}</div>`;

    el.querySelectorAll("[data-team]").forEach((b) =>
      b.addEventListener("click", () => {
        state = { ...state, team: b.dataset.team };
        render();
        writeParams(state);
      }),
    );
    el.querySelector("[data-es-month]").addEventListener("change", (e) => {
      state = { ...state, month: e.target.value };
      render();
      writeParams(state);
    });
    if (focused?.matches("[data-es-month]")) el.querySelector("[data-es-month]").focus();
    else if (focused?.matches("[data-team], [data-es-clear]")) {
      el.querySelector('[data-team][aria-pressed="true"]').focus();
    }
    const clear = el.querySelector("[data-es-clear]");
    if (clear) clear.addEventListener("click", () => {
      state = { team: "all", month: "all" };
      render();
      writeParams(state);
    });
  };
  render();
}

/* ---------- widgets ---------- */
async function initSchedule(el) {
  el.innerHTML = skeleton(4);
  try {
    const doc = await load(el.dataset.src || DEFAULT_SRC);
    const pool = upcomingMatches(doc.matches, londonToday());
    mountFilterableList(el, doc, pool, {
      noun: "fixture",
      emptyAll: {
        title: "No upcoming fixtures published yet",
        body: `Check Play-Cricket for the latest fixtures.`,
      },
      renderItem: fixtureCard,
    });
  } catch {
    errorState(el, () => initSchedule(el));
  }
}

async function initResults(el) {
  el.innerHTML = skeleton(3);
  try {
    const doc = await load(el.dataset.src || DEFAULT_SRC);
    const pool = resultMatches(doc.matches, londonToday());
    mountFilterableList(el, doc, pool, {
      noun: "result",
      playCricketUrl: PLAY_CRICKET_MATCHES,
      emptyAll: {
        title: "No results recorded yet",
        body: `Check Play-Cricket for the latest results.`,
      },
      renderItem: resultCard,
      groupDesc: true,
    });
  } catch {
    errorState(el, () => initResults(el));
  }
}

async function initNextMatch(el) {
  const fallback = el.innerHTML; // the page's original "vs TBD" markup
  el.setAttribute("aria-busy", "true");
  try {
    const doc = await load(el.dataset.src || DEFAULT_SRC);
    const m = nextMatch(doc.matches, londonToday());
    el.removeAttribute("aria-busy");
    if (!m) {
      el.innerHTML = `${fallback}<p class="es-next__fallback-link"><a href="${PLAY_CRICKET_WEEKLY}" target="_blank" rel="noopener noreferrer">Check Play-Cricket for the latest fixtures ${icon.ext}</a></p>`;
      return;
    }
    const isSample = doc.sample || String(m.id).startsWith("sample-");
    const chips = [
      `<li>${icon.cal}<span>${esc(formatDate(m.date))}</span></li>`,
      `<li>${icon.clock}<span>${m.time ? esc(m.time) : "Time TBC"}</span></li>`,
      `<li>${icon.pin}<span>${m.venue ? esc(m.venue) : "Venue TBC"}</span></li>`,
      m.competition ? `<li>${icon.trophy}<span>${esc(m.competition)}</span></li>` : "",
    ].join("");
    el.innerHTML = `<div class="es-next">
      <div class="es-next__badges">
        <span class="es-next__badge"><span class="es-next__dot"></span>Next Match</span>
        ${isSample ? '<span class="es-next__badge es-next__badge--sample">Sample &middot; not a real fixture</span>' : ""}
      </div>
      <h1 class="es-next__title">East Saxons CC ${esc(m.team || "")}<br /><span>vs ${esc(m.opponent || "TBC")}</span></h1>
      <p class="es-next__when"><span class="es-next__count">${esc(countdownLabel(m.date, londonToday()))}</span>
        <span class="es-tag es-tag--${m.homeAway === "home" ? "home" : "away"} es-tag--onDark">${m.homeAway === "home" ? "Home" : "Away"}</span></p>
      <ul class="es-next__chips">${chips}</ul>
      <div class="es-next__actions">
        ${matchLink(m)}
        <a class="es-btn es-btn--onDark" href="schedule.html">All fixtures</a>
      </div>
    </div>`;
  } catch {
    el.removeAttribute("aria-busy");
    el.innerHTML = fallback; // keep the original hero if data can't load
  }
}

async function initUpcomingTeams(el) {
  el.innerHTML = skeleton(1);
  try {
    const doc = await load(el.dataset.src || DEFAULT_SRC);
    const today = londonToday();
    const cards = ["1st", "2nd", "3rd"].map((k) => {
      const m = nextMatch(doc.matches, today, k);
      if (!m) {
        return `<div class="es-mini es-mini--empty"><p class="es-mini__team">${TEAM_LABELS[k]}</p><p class="es-mini__opp">No fixture scheduled</p></div>`;
      }
      return `<a class="es-mini" href="schedule.html?team=${k}">
        <p class="es-mini__team">${TEAM_LABELS[k]}${doc.sample ? ' <span class="es-tag es-tag--sample">Sample</span>' : ""}</p>
        <p class="es-mini__date">${esc(formatDate(m.date))}${m.time ? ` &middot; ${esc(m.time)}` : ""}</p>
        <p class="es-mini__opp">vs ${esc(m.opponent || "TBC")}</p>
        <p class="es-mini__venue">${m.homeAway === "home" ? "Home" : "Away"}${m.venue ? ` &middot; ${esc(m.venue)}` : ""}</p>
      </a>`;
    });
    el.innerHTML = `<div class="es-minis">${cards.join("")}</div>`;
  } catch {
    el.innerHTML = `<p class="es-meta">Upcoming fixtures are on <a href="${PLAY_CRICKET_WEEKLY}" target="_blank" rel="noopener noreferrer">Play-Cricket</a>.</p>`;
  }
}

function init() {
  document.querySelectorAll("[data-es-next-match]").forEach(initNextMatch);
  document.querySelectorAll("[data-es-upcoming-teams]").forEach(initUpcomingTeams);
  document.querySelectorAll("[data-es-schedule]").forEach(initSchedule);
  document.querySelectorAll("[data-es-results]").forEach(initResults);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

export { PLAY_CRICKET_HOME };

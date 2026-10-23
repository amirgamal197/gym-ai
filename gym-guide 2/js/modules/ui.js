/**
 * ui.js — Shared UI Builders
 * ---------------------------------------------------------------
 * Generic, presentation-only helpers used by every page module:
 * the exercise card, the YouTube/MuscleWiki media links, and the
 * collapsible "group" block (used for warm-up/mobility/activation).
 *
 * Fixes vs. the original prototype:
 *  - No more inline `onclick="..."` attributes (they required every
 *    handler to be a `window` global; this build uses data-action
 *    attributes + one delegated listener registered in app.js instead).
 *  - Collapsible/clickable elements are keyboard accessible
 *    (role="button", tabindex="0") and expose aria-expanded /
 *    aria-pressed / aria-checked so screen readers announce state.
 * ---------------------------------------------------------------
 */
import { YT_SEARCH, MW_SEARCH } from "./data.js";
import { icon } from "./icons.js";

/** Parse the leading number out of a "3×10-12" style sets string. Defaults to 3 sets if unparsable. */
export function setsCount(str) {
  const m = (str || "").match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 3;
}

/** Epley 1RM estimate from a logged weight/reps pair. */
export function epley1RM(w, r) {
  w = parseFloat(w) || 0;
  r = parseFloat(r) || 0;
  return w && r ? Math.round(w * (1 + r / 30) * 10) / 10 : 0;
}

/** Shared formatter for a single saved session-history row (was duplicated 3x in the original file). */
export function formatHistoryEntry(e) {
  // Phase 4: a `partial` entry is the work done on an exercise before it was
  // replaced mid-session (replacements.js) — say so instead of looking like a full session.
  const partial = e.partial ? ` — جزئية (${e.setsDone || 0} سيت، اتبدّل أثناء الجلسة)` : "";
  return `${e.date} — حجم: ${e.volume} كجم — 1RM تقديري: ${e.best1rm} كجم${partial}`;
}

/**
 * Small inline trend sparkline for a series of numbers (e.g. per-session
 * volume from STATE.history) — presentational only, no STATE import here,
 * consistent with the rest of ui.js. Returns "" when there's nothing
 * meaningful to draw (fewer than 2 points), same "no data → no card"
 * rule progression.js follows. Stroke color reflects the trend from the
 * first to the last point (green = up, red = down, blue = flat) using
 * the same CSS custom properties as .prog-tip in styles.css, so it reads
 * consistently with the rest of the adaptive-progression UI.
 */
export function sparklineSVG(values, opts = {}) {
  const w = opts.width || 132;
  const h = opts.height || 36;
  const pad = 4;
  if (!values || values.length < 2) return "";

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // avoid divide-by-zero on a flat series
  const stepX = (w - pad * 2) / (values.length - 1);

  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const first = values[0];
  const last = values[values.length - 1];
  const color = last > first ? "var(--success)" : last < first ? "var(--health)" : "var(--data-2)";
  const [lastX, lastY] = points[points.length - 1].split(",");

  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" focusable="false">
    <polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${lastX}" cy="${lastY}" r="3" fill="${color}"/>
  </svg>`;
}

/**
 * GIF is only rendered when opening exercise details (this HTML is built
 * once per card but sits inside the collapsed .ex-body — see styles.css
 * — and `loading="lazy"` on every image means the browser doesn't fetch
 * anything until the card is actually opened/near-viewport). Never
 * guesses a GIF url — only ex.gif entries that were explicitly verified
 * and set in the data file render an image.
 *
 * The big clickable video-thumbnail preview (used to show for the 3-day
 * program's own exercises, which carry a small set of manually-verified
 * YouTube `vid` ids from the original Workout Engine) has been removed
 * intentionally — some of those embedded previews/links were wrong, so
 * no exercise card renders a video thumbnail anymore, in either the
 * day program or the Exercise Library. Video access everywhere is now
 * only the simple `tutorialLink` pill below.
 */
export function mediaHtml(ex) {
  const gifHtml = ex.gif
    ? `<div class="gif-wrap"><img src="${ex.gif}" alt="GIF توضيحي لتمرين ${ex.en}" loading="lazy"></div>`
    : "";
  return gifHtml;
}

/**
 * Tutorial link: a simple pill for the link-row. Points straight at the
 * verified video when the entry has one (data.js `Ex`/`DayEx` — see
 * mediaHtml above), otherwise a live YouTube *search* built from the
 * exercise's English name (data.js YT_SEARCH) — this is what every
 * Exercise Library entry gets, since none of them carry a `vid` id.
 * Never a guessed video — an existing verified `vid` is always reused
 * as-is, never replaced.
 *
 * The visible label is the exercise's own name (not a generic "Tutorial"
 * / "Watch Video" string) so it's obvious which exercise's video the
 * link opens, especially when several links sit next to each other.
 */
export function tutorialLink(ex) {
  const href = ex.vid ? `https://www.youtube.com/watch?v=${ex.vid}` : YT_SEARCH(ex.en);
  return `<a class="pill-link" target="_blank" rel="noopener" href="${href}">${icon("video")} ${ex.en}</a>`;
}

/**
 * Illustration link: uses the exercise's own verified direct page
 * (ex.illustration) when one is set on the data entry — either a
 * MuscleWiki `/exercise/...` page, or a MuscleAndStrength page when no
 * direct MuscleWiki page exists. Never derived/guessed from the exercise
 * name. Until a real URL is added, this is an honest labeled search
 * fallback instead of a fake "direct page" link.
 */
export function illustrationLink(ex) {
  if (ex.illustration) {
    return `<a class="pill-link muscle" target="_blank" rel="noopener" href="${ex.illustration}">${icon("dna")} Illustration — صفحة التمرين</a>`;
  }
  return `<a class="pill-link muscle" target="_blank" rel="noopener" href="${MW_SEARCH(ex.en)}">${icon("search")} دور على MuscleWiki</a>`;
}

/**
 * Build one exercise card. `key` must be a unique, DOM-safe id
 * (e.g. "day1-main-0", "apt-3", "day2-mob-1").
 * `opts.beforeSets` / `opts.afterLogs`: optional pre-built HTML strings
 * injected right before the sets-row / right after the log-rows —
 * used by workout.js to slot in the progression.js recommendation
 * card and RPE input without this (presentational-only) module
 * needing to know anything about STATE or adaptive-progression logic.
 * `opts.slotTools` (Phase 4): pre-built HTML for the "Alternatives" button
 * (and replacement note), placed under the tutorial links.
 */
export function exCard(key, idx, ex, opts) {
  opts = opts || {};
  const nSets = setsCount(ex.sets);
  let setsHtml = "";
  for (let i = 0; i < nSets; i++) {
    setsHtml += `<div class="set-box" role="button" tabindex="0" aria-pressed="false"
        data-action="toggle-set" data-key="${key}" data-set="${i}">سيت ${i + 1}</div>`;
  }

  let logRows = "";
  if (opts.trackable) {
    for (let i = 0; i < nSets; i++) {
      logRows += `
      <div class="log-row">
        <label for="log-${key}-${i}-w">سيت ${i + 1}</label>
        <input type="text" inputmode="decimal" placeholder="وزن كجم" id="log-${key}-${i}-w"
          aria-label="وزن سيت ${i + 1} بالكيلوجرام لتمرين ${ex.en}" data-log="${key}-${i}-w">
        <input type="text" inputmode="numeric" placeholder="عدات" id="log-${key}-${i}-r"
          aria-label="عدد عدات سيت ${i + 1} لتمرين ${ex.en}" data-log="${key}-${i}-r">
      </div>`;
    }
  }

  const classifyRow = ex.classify ? `<div class="chip full"><b>التصنيف</b>${ex.classify}</div>` : "";

  return `
  <div class="ex-card" id="card-${key}">
    <div class="ex-head" role="button" tabindex="0" aria-expanded="false" aria-controls="body-${key}"
        data-action="toggle-card" data-key="${key}">
      <div class="num" aria-hidden="true">${idx + 1}</div>
      <div class="ex-titles">
        <div class="en">${ex.en}</div>
        <div class="ar">${ex.ar}</div>
      </div>
      ${ex.replaced ? `<span class="badge badge-swap">بديل</span>` : ""}
      <span class="badge diff-${ex.difficulty || ""}">${ex.difficulty || ""}</span>
      <span class="chevron" aria-hidden="true">▾</span>
    </div>
    <div class="ex-body" id="body-${key}">
      <div class="ex-body-inner">
        ${mediaHtml(ex)}
        <div class="link-row">
          ${tutorialLink(ex)}
          ${illustrationLink(ex)}
        </div>
        ${opts.slotTools || ""}
        ${classifyRow}
        <div class="chip-grid">
          <div class="chip"><b>العضلة الأساسية</b>${ex.primary || ex.muscle || "—"}</div>
          <div class="chip"><b>العضلات الثانوية</b>${ex.secondary || "—"}</div>
          <div class="chip"><b>Sets / Reps</b>${ex.sets}</div>
          <div class="chip"><b>Tempo</b>${ex.tempo || "—"}</div>
          <div class="chip"><b>الراحة</b>${ex.rest || "—"}</div>
          <div class="chip"><b>الشدة</b>${ex.rpe || "—"}</div>
          ${ex.stabilizers ? `<div class="chip full"><b>عضلات الثبات</b>${ex.stabilizers}</div>` : ""}
        </div>
        ${ex.why ? `<div class="why">${icon("target")} <b>ليه التمرين ده:</b> ${ex.why}</div>` : ""}
        ${ex.cue ? `<div class="tip">${icon("lightbulb")} <b>Coaching Cue:</b> ${ex.cue}</div>` : ""}
        ${ex.mistake ? `<div class="mistake">${icon("alert-triangle")} <b>خطأ لازم تتجنبه:</b> ${ex.mistake}</div>` : ""}
        ${ex.neglected ? `<div class="tip">${icon("lightbulb")} <b>عضلة بتتهمل غالبًا:</b> ${ex.neglected}</div>` : ""}
        ${
          ex.prog || ex.reg
            ? `<div class="prog-reg">
            <div><b>${icon("arrow-up")} Progression</b>${ex.prog || "—"}</div>
            <div><b>${icon("arrow-down")} Regression</b>${ex.reg || "—"}</div>
          </div>`
            : ""
        }
        ${opts.beforeSets || ""}
        <div class="sets-row">${setsHtml}</div>
        ${logRows}
        ${opts.afterLogs || ""}
        ${
          opts.trackable
            ? `
          <div class="stat-line" id="stat-${key}" aria-live="polite">حجم التمرين: 0 كجم · أفضل 1RM تقديري: 0 كجم</div>
          <button class="save-session done-btn" type="button" data-action="save-session" data-key="${key}" data-name="${ex.en}">${icon("check")} Done — احفظ وكمّل اللي بعده</button>
          <div class="history-list" id="hist-${key}"></div>
        `
            : ""
        }
      </div>
    </div>
  </div>`;
}

/**
 * Card for a duration-based cardio/stretch item (general warm-up cardio,
 * post-workout cool-down stretch, or the standalone recovery flexibility
 * routine) — same collapsible ex-card shape as exCard() above (image
 * link, video-search link, why, and "which neglected muscle this hits"
 * chip) but without the sets/log machinery, since these items track
 * duration, not weight × reps. `item` needs {en, ar, dur} at minimum;
 * `why`/`neglected`/`illustration` are optional and hidden if absent.
 */
export function stretchCard(key, idx, item) {
  return `
  <div class="ex-card" id="card-${key}">
    <div class="ex-head" role="button" tabindex="0" aria-expanded="false" aria-controls="body-${key}"
        data-action="toggle-card" data-key="${key}">
      <div class="num" aria-hidden="true">${idx + 1}</div>
      <div class="ex-titles">
        <div class="en">${item.en}</div>
        <div class="ar">${item.ar}</div>
      </div>
      <span class="badge">${item.dur || ""}</span>
      <span class="chevron" aria-hidden="true">▾</span>
    </div>
    <div class="ex-body" id="body-${key}">
      <div class="ex-body-inner">
        <div class="link-row">
          ${tutorialLink(item)}
          ${illustrationLink(item)}
        </div>
        <div class="chip-grid">
          <div class="chip"><b>المدة</b>${item.dur || "—"}</div>
          ${item.primary ? `<div class="chip"><b>العضلة المستهدفة</b>${item.primary}</div>` : ""}
        </div>
        ${item.note ? `<div class="tip">${icon("lightbulb")} <b>ملاحظة:</b> ${item.note}</div>` : ""}
        ${item.why ? `<div class="why">${icon("target")} <b>ليه بنعمل التمرين ده:</b> ${item.why}</div>` : ""}
        ${item.neglected ? `<div class="tip">${icon("lightbulb")} <b>عضلة بتتهمل غالبًا:</b> ${item.neglected}</div>` : ""}
      </div>
    </div>
  </div>`;
}

/**
 * Small "back" link shown at the top of every page that isn't in the
 * main 4-tab nav bar (Day pages, Tracker, Recovery, Nutrition, Injury,
 * Corrective, Metrics) — these are reachable from a hub page (Program /
 * Support / Dashboard) instead of the top nav. `target` is the hash tab
 * to return to (defaults to "dashboard"); `text` is the bilingual label.
 */
export function backLink(text, target) {
  return `<a class="back-link" href="#${target || "dashboard"}">${icon("arrow-left")} ${text || "Dashboard · لوحة التحكم"}</a>`;
}

export function groupBlock(id, title, sub, innerHtml, collapsedDefault) {
  return `
  <div class="group-head ${collapsedDefault ? "collapsed" : ""}" role="button" tabindex="0"
      aria-expanded="${collapsedDefault ? "false" : "true"}" aria-controls="group-${id}"
      data-action="toggle-group" data-group="${id}">
    <div>
      <div class="group-title">${title}</div>
      <div class="group-sub">${sub}</div>
    </div>
    <span class="arrow" aria-hidden="true">▾</span>
  </div>
  <div class="group-body ${collapsedDefault ? "collapsed" : ""}" id="group-${id}" style="${collapsedDefault ? "max-height:0" : ""}">
    ${innerHtml}
  </div>`;
}

/** Toggle a collapsible group's open/closed animation + aria-expanded state.
 * Phase 6 fix: the open state used to leave an inline `max-height` equal to the
 * height measured at click time, so any card opened INSIDE the group afterwards
 * (warm-up, mobility, activation, cool-down, recovery) was clipped by the group's
 * overflow:hidden and its details looked cut off. Once the opening animation ends
 * the cap is now removed (`none`), so nested content can grow freely. */
const GROUP_ANIM_MS = 380; // a little over --dur-slow (360ms)
const groupTimers = new WeakMap();

export function toggleGroupOpen(groupId) {
  const head = document.querySelector(`[data-action="toggle-group"][data-group="${groupId}"]`);
  const body = document.getElementById("group-" + groupId);
  if (!head || !body) return;
  clearTimeout(groupTimers.get(body));
  head.classList.toggle("collapsed");
  const collapsedNow = head.classList.contains("collapsed");
  head.setAttribute("aria-expanded", String(!collapsedNow));

  if (!collapsedNow) {
    // opening: animate 0 -> measured height, then release the cap
    body.classList.remove("collapsed");
    body.style.maxHeight = body.scrollHeight + "px";
    groupTimers.set(body, setTimeout(() => { body.style.maxHeight = "none"; }, GROUP_ANIM_MS));
  } else {
    // closing: pin the current height (it may be "none"), force a reflow, then animate to 0
    body.style.maxHeight = body.scrollHeight + "px";
    void body.offsetHeight;
    requestAnimationFrame(() => {
      body.classList.add("collapsed");
      body.style.maxHeight = "0";
    });
  }
}

/** Close a card (class + aria) without touching anything else. */
function closeCard(card) {
  card.classList.remove("open");
  const head = card.querySelector('[data-action="toggle-card"]');
  if (head) head.setAttribute("aria-expanded", "false");
}

/** Toggle an exercise card open/closed + aria-expanded state.
 * Accordion behaviour (Phase 6: page-wide): opening a card collapses EVERY other
 * open card on the page (warm-up, mobility, activation, main exercises, cool-down,
 * library, recovery...), not only its siblings in the same list, so the card you
 * just tapped is always the one you can read in full. Opening a card also
 * scrolls it into view once the others have finished collapsing. */
export function toggleCardOpen(key) {
  const card = document.getElementById("card-" + key);
  if (!card) return;
  const opening = !card.classList.contains("open");

  if (opening) {
    const scope = card.closest("section, main") || document;
    scope.querySelectorAll(".ex-card.open").forEach((other) => {
      if (other !== card) closeCard(other);
    });
  }

  card.classList.toggle("open");
  const head = card.querySelector('[data-action="toggle-card"]');
  if (head) head.setAttribute("aria-expanded", String(card.classList.contains("open")));

  if (opening && head) {
    // wait for the collapse animation of the other cards so the final position is stable
    setTimeout(() => {
      if (!card.classList.contains("open")) return;
      const r = head.getBoundingClientRect();
      const topBar = 110; // sticky header + tabs
      if (r.top < topBar || r.top > window.innerHeight * 0.6) {
        const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: window.scrollY + r.top - topBar - 8, behavior: reduce ? "auto" : "smooth" });
      }
    }, 380);
  }
}

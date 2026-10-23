/**
 * alternatives-ui.js — Alternatives sheet + safe replacement UI (Phase 4)
 * ---------------------------------------------------------------
 * A modal bottom sheet (#altSheet in index.html) opened from the
 * "Alternatives" button on an exercise card — on a workout-day page, in
 * Gym Mode, or on the Exercise Library page.
 *
 *  - Replace mode (day card / Gym Mode): lists substitutes from the
 *    alternatives engine, lets the person filter by equipment category
 *    and by what they own, explains WHY each one is close or partial,
 *    and replaces the exercise through replacements.js after an explicit
 *    confirmation step that states exactly what is kept.
 *  - Browse mode (library card): the same list without replace buttons.
 *
 * All matching logic lives in exercise-alternatives.js; all state changes
 * live in replacements.js. This file only renders and routes actions.
 * ---------------------------------------------------------------
 */
import { EXERCISES, EQUIPMENT_LABELS } from "./exercises-data.js";
import { STATE } from "./store.js";
import {
  ALT_CATEGORIES,
  HOME_NOTES,
  REASON_LABELS,
  availableCategoriesFromProfile,
  getAlternatives,
  getExerciseMeta,
  getPartialOnlyReason,
  muscleLabel,
  patternLabel,
} from "./exercise-alternatives.js";
import {
  getSlotExerciseId,
  getReplacementInfo,
  getDayExerciseIds,
  getSlotWorkSummary,
  getSlotRef,
  replaceExercise,
  slotKey,
  REFUSAL_MESSAGES,
} from "./replacements.js";
import { refreshDayPage } from "./workout.js";
import { refreshGymAfterReplace, isGymModeActive } from "./timer.js";
import { icon } from "./icons.js";

const LIB = new Map(EXERCISES.map((e) => [e.id, e]));
const DIFF_AR = { Beginner: "مبتدئ", Intermediate: "متوسط", Advanced: "متقدم" };
const CAT_BY_KEY = Object.fromEntries(ALT_CATEGORIES.map((c) => [c.key, c]));
// Reasons worth a chip; muscle/pattern reasons are spelled out in the sentence instead.
const CHIP_REASONS = ["easier", "harder", "limited-overload", "like-for-like-equipment", "pinned"];

const sheet = {
  open: false,
  mode: "replace", // "replace" | "browse"
  dayKey: null,
  index: null,
  sourceId: null,
  category: "all",
  onlyMine: false,
  view: "list", // "list" | "confirm"
  confirmId: null,
  error: "",
  opener: null,
};

let inertEls = [];
let toastTimer = null;

/* ---------------- small helpers ---------------- */
const $ = (id) => document.getElementById(id);
const nameOf = (id) => (LIB.get(id) ? LIB.get(id).en : id);
const arOf = (id) => (LIB.get(id) ? LIB.get(id).ar : "");

function exName(id) {
  return `<span class="alt-en"><bdi>${nameOf(id)}</bdi></span><span class="alt-ar">${arOf(id)}</span>`;
}

function profileCats() {
  return availableCategoriesFromProfile(STATE.profile && STATE.profile.equipment);
}

export function isAltSheetOpen() {
  return sheet.open;
}

/* ---------------- data for the list view ---------------- */
function computeLists() {
  const cats = profileCats();
  const restrict = sheet.onlyMine && cats ? cats : null;
  const used = sheet.mode === "replace" ? new Set(getDayExerciseIds(sheet.dayKey)) : new Set();
  used.delete(sheet.sourceId);
  const strip = (r) => ({
    close: r.close.filter((a) => !used.has(a.id)),
    partial: r.partial.filter((a) => !used.has(a.id)),
  });
  const everything = getAlternatives(sheet.sourceId);
  if (!everything) return null;
  const shown = restrict ? getAlternatives(sheet.sourceId, { availableCategories: restrict }) : everything;
  const full = strip(everything);
  const base = strip(shown);
  const hiddenByEquipment = full.close.length + full.partial.length - (base.close.length + base.partial.length);
  const hiddenInDay = everything.close.length + everything.partial.length - (full.close.length + full.partial.length);

  const counts = { all: base.close.length + base.partial.length };
  ALT_CATEGORIES.forEach((c) => {
    counts[c.key] = [...base.close, ...base.partial].filter((a) => a.categories.includes(c.key)).length;
  });
  const inCat = (a) => sheet.category === "all" || a.categories.includes(sheet.category);
  return {
    hasProfile: !!cats,
    close: base.close.filter(inCat),
    partial: base.partial.filter(inCat),
    unfilteredCloseCount: full.close.length,
    hiddenByEquipment,
    hiddenInDay,
    counts,
  };
}

/* ---------------- rendering ---------------- */
function explain(srcMeta, alt) {
  const c = getExerciseMeta(alt.id);
  const sameM = srcMeta.muscle === c.muscle;
  const sameP = srcMeta.pattern === c.pattern;
  const m = muscleLabel(c.muscle, "ar");
  const p = patternLabel(c.pattern, "ar");
  const first = sameM ? `نفس العضلة المستهدفة: ${m}` : `بيركّز على ${m} بدل ${muscleLabel(srcMeta.muscle, "ar")}`;
  const second = sameP ? `ونفس نمط الحركة (${p})` : `بحركة مختلفة: ${p} بدل ${patternLabel(srcMeta.pattern, "ar")}`;
  const tier =
    alt.tier === "close"
      ? "ينفع يحل محل التمرين من غير ما يتغير هدف الجلسة."
      : "بيغيّر التركيز أو الأحمال — استخدمه لما البديل القريب مش متاح.";
  return `${first} ${second}. ${tier}`;
}

function altItem(srcMeta, alt) {
  const meta = getExerciseMeta(alt.id);
  const lib = LIB.get(alt.id);
  const catAr = (CAT_BY_KEY[alt.category] && CAT_BY_KEY[alt.category].ar) || alt.category;
  const tierBadge =
    alt.tier === "close"
      ? `<span class="alt-tier alt-tier-close">${icon("check")} بديل قريب</span>`
      : `<span class="alt-tier alt-tier-partial">${icon("alert-triangle")} بديل جزئي</span>`;
  const homeBadge =
    meta.homeMode === "none"
      ? `<span class="alt-tag alt-tag-home">${icon("chair")} منزلي — من غير أدوات</span>`
      : meta.homeMode === "adaptable"
        ? `<span class="alt-tag alt-tag-home">${icon("chair")} منزلي — بأدوات البيت</span>`
        : "";
  const homeNote = meta.homeMode === "adaptable" && HOME_NOTES[alt.id] ? `<div class="alt-home-note">${HOME_NOTES[alt.id].ar}</div>` : "";
  const chips = alt.reasons
    .filter((r) => CHIP_REASONS.includes(r))
    .map((r) => `<span class="alt-chip" title="${REASON_LABELS[r].en}">${REASON_LABELS[r].ar}</span>`)
    .join("");
  const action =
    sheet.mode === "replace"
      ? `<button type="button" class="alt-pick" data-action="alt-pick" data-id="${alt.id}" aria-label="استبدل بـ ${lib.en}">${icon("swap")} استبدل</button>`
      : "";
  return `
  <li class="alt-item alt-item-${alt.tier}">
    <div class="alt-item-top">
      <div class="alt-names">${exName(alt.id)}</div>
      ${action}
    </div>
    <div class="alt-badges">
      ${tierBadge}
      <span class="alt-tag">${catAr}</span>
      <span class="alt-tag">${DIFF_AR[lib.difficulty] || lib.difficulty}</span>
      ${homeBadge}
    </div>
    <p class="alt-explain">${explain(srcMeta, alt)}</p>
    ${homeNote}
    ${chips ? `<div class="alt-chips">${chips}</div>` : ""}
  </li>`;
}

function noCloseBox(lists) {
  const reason = getPartialOnlyReason(sheet.sourceId);
  if (!lists.unfilteredCloseCount && reason) {
    return `<div class="alt-note alt-note-info">${icon("lightbulb")} <div><b>مفيش بديل مطابق للتمرين ده.</b> ${reason.ar}<br><span class="alt-note-en" dir="ltr">${reason.en}</span></div></div>`;
  }
  if (!lists.unfilteredCloseCount) {
    return `<div class="alt-note alt-note-info">${icon("lightbulb")} <div><b>مفيش بديل قريب متاح</b> للتمرين ده — الاختيارات الجزئية تحت هي الأقرب.</div></div>`;
  }
  return `<div class="alt-note alt-note-info">${icon("search")} <div>مفيش بديل قريب بالفلاتر الحالية. جرّب تغيّر نوع الأداة أو اعرض كل الأدوات.</div></div>`;
}

function listView() {
  const src = sheet.sourceId;
  const srcMeta = getExerciseMeta(src);
  const lib = LIB.get(src);
  if (!srcMeta || !lib) {
    return `<div class="alt-note alt-note-warn">${icon("alert-triangle")} <div>مفيش بيانات بدائل لتمرين ده.</div></div>`;
  }
  const lists = computeLists();
  const info = sheet.mode === "replace" ? getReplacementInfo(sheet.dayKey, sheet.index) : { replaced: false };

  const catChips = [{ key: "all", ar: "الكل", label: "All" }]
    .concat(ALT_CATEGORIES)
    .filter((c) => c.key === "all" || lists.counts[c.key] > 0 || sheet.category === c.key)
    .map((c) => {
      const on = sheet.category === c.key;
      return `<button type="button" class="alt-filter${on ? " on" : ""}" data-action="alt-filter" data-cat="${c.key}"
          aria-pressed="${on}" aria-label="${c.label}: ${lists.counts[c.key] || 0}">${c.ar} <span class="alt-count">${lists.counts[c.key] || 0}</span></button>`;
    })
    .join("");

  const mineToggle = lists.hasProfile
    ? `<button type="button" class="alt-toggle${sheet.onlyMine ? " on" : ""}" data-action="alt-toggle-mine" role="switch" aria-checked="${sheet.onlyMine}">
         ${icon("dumbbell")} معداتي بس <span class="alt-toggle-state">${sheet.onlyMine ? "شغّال" : "مقفول"}</span></button>`
    : `<div class="alt-hint">${icon("lightbulb")} حدّد معداتك في <a href="#profile" data-action="alt-close">الملف الشخصي</a> عشان البدائل تتفلتر حسب المتاح عندك.</div>`;

  const hiddenNote =
    sheet.onlyMine && lists.hiddenByEquipment > 0
      ? `<div class="alt-hint">${lists.hiddenByEquipment} بديل مخفي لأنه محتاج معدات مش في قايمتك.</div>`
      : "";
  const dayNote =
    lists.hiddenInDay > 0
      ? `<div class="alt-hint">${lists.hiddenInDay} تمرين مخفي لأنه موجود فعلًا في اليوم ده.</div>`
      : "";

  const replacedBanner = info.replaced
    ? `<div class="alt-note alt-note-swap">${icon("refresh")} <div>التمرين ده بديل لـ <b><bdi>${nameOf(info.originalId)}</bdi></b> (${arOf(info.originalId)}).
         <button type="button" class="alt-link" data-action="alt-pick" data-id="${info.originalId}">رجّع التمرين الأصلي</button></div></div>`
    : "";

  const errorBox = sheet.error ? `<div class="alt-note alt-note-warn" role="alert">${icon("alert-triangle")} <div>${sheet.error}</div></div>` : "";

  const closeHtml = lists.close.length
    ? `<ul class="alt-list">${lists.close.map((a) => altItem(srcMeta, a)).join("")}</ul>`
    : noCloseBox(lists);
  const partialHtml = lists.partial.length
    ? `<ul class="alt-list">${lists.partial.map((a) => altItem(srcMeta, a)).join("")}</ul>`
    : `<div class="alt-empty">مفيش بدائل جزئية بالفلاتر الحالية.</div>`;

  return `
    ${errorBox}
    ${replacedBanner}
    <div class="alt-filters" role="group" aria-label="فلتر نوع الأداة">${catChips}</div>
    ${mineToggle}
    ${hiddenNote}${dayNote}
    <h3 class="alt-section">${icon("check")} بدائل قريبة · Close <span class="alt-section-count">${lists.close.length}</span></h3>
    <p class="alt-section-sub">نفس العضلة ونفس نمط الحركة — أقرب حاجة للتمرين الأصلي.</p>
    ${closeHtml}
    <h3 class="alt-section">${icon("alert-triangle")} بدائل جزئية · Partial <span class="alt-section-count">${lists.partial.length}</span></h3>
    <p class="alt-section-sub">بتشغل نفس العضلة أو حركة قريبة بس بتغيّر التركيز أو إمكانية زيادة الأحمال.</p>
    ${partialHtml}
    ${sheet.mode === "browse" ? `<div class="alt-hint">للاستبدال افتح التمرين من صفحة يوم التمرين واضغط «بدائل».</div>` : ""}
  `;
}

function confirmView() {
  const fromId = sheet.sourceId;
  const toId = sheet.confirmId;
  const toLib = LIB.get(toId);
  const base = getSlotRef(sheet.dayKey, sheet.index);
  const work = getSlotWorkSummary(sheet.dayKey, sheet.index);
  const info = getReplacementInfo(sheet.dayKey, sheet.index);
  const restoring = info.replaced && toId === info.originalId;
  const srcMeta = getExerciseMeta(fromId);
  const alt = getAlternatives(fromId);
  const found = alt && [...alt.close, ...alt.partial].find((a) => a.id === toId);
  const partial = found && found.tier === "partial";

  const keepLines = [];
  if (work.hasWork) {
    keepLines.push(
      `${work.setsDone} سيت مكتمل${work.volume ? ` وحجم ${work.volume} كجم` : ""} على <bdi>${nameOf(fromId)}</bdi> هيتحفظوا في سجلك كجلسة جزئية — مش هيتمسحوا.`
    );
  } else {
    keepLines.push(`لسه مفيش سيتات أو أوزان متسجلة على <bdi>${nameOf(fromId)}</bdi> في الجلسة دي.`);
  }
  keepLines.push(`كل سجل جلساتك القديمة لـ <bdi>${nameOf(fromId)}</bdi> فاضل محفوظ في «تتبع التقدم» ومربوط بيه.`);
  keepLines.push(
    restoring
      ? `سيتات وأوزان <bdi>${nameOf(toId)}</bdi> اللي سجلتها قبل كده هترجع زي ما كانت.`
      : `السيتات والأوزان لـ <bdi>${nameOf(toId)}</bdi> هتبدأ من الصفر وبسجله الخاص.`
  );
  keepLines.push(`نفس شكل الجلسة: ${base.sets} · راحة ${base.rest || "—"}.`);
  keepLines.push(`تقدر ترجّع التمرين الأصلي في أي وقت.`);

  const warn = partial
    ? `<div class="alt-note alt-note-warn">${icon("alert-triangle")} <div><b>ده بديل جزئي.</b> هيغيّر التركيز أو الأحمال شوية مقارنة بـ <bdi>${nameOf(fromId)}</bdi>.${
        srcMeta && getExerciseMeta(toId) && getExerciseMeta(toId).limitedOverload ? " وكمان مجال زيادة الأوزان فيه محدود." : ""
      } راجع عدد العدات والراحة بعد التبديل.</div></div>`
    : "";

  return `
    <div class="alt-confirm">
      <div class="alt-swap-pair">
        <div class="alt-swap-from">${exName(fromId)}</div>
        <div class="alt-swap-arrow" aria-hidden="true">${icon("arrow-left")}</div>
        <div class="alt-swap-to">${exName(toId)}<div class="alt-badges"><span class="alt-tag">${(CAT_BY_KEY[getExerciseMeta(toId).equipmentCategory] || {}).ar || ""}</span><span class="alt-tag">${EQUIPMENT_LABELS[toLib.equipment] || toLib.equipment}</span></div></div>
      </div>
      ${warn}
      <h3 class="alt-section">${icon("lock")} اللي هيتحفظ</h3>
      <ul class="alt-keep">${keepLines.map((l) => `<li>${icon("check")} <span>${l}</span></li>`).join("")}</ul>
      <div class="alt-actions">
        <button type="button" class="alt-confirm-btn" data-action="alt-confirm">${icon("check")} ${restoring ? "رجّع التمرين الأصلي" : "تأكيد الاستبدال"}</button>
        <button type="button" class="alt-cancel-btn" data-action="alt-back">رجوع للبدائل</button>
      </div>
    </div>`;
}

function headerHtml() {
  const id = sheet.sourceId;
  const meta = getExerciseMeta(id);
  const lib = LIB.get(id);
  const title = sheet.view === "confirm" ? "تأكيد الاستبدال" : "بدائل التمرين · Alternatives";
  const sub = lib
    ? `${exName(id)}${
        meta
          ? `<div class="alt-badges"><span class="alt-tag">${muscleLabel(meta.muscle, "ar")}</span><span class="alt-tag">${patternLabel(meta.pattern, "ar")}</span><span class="alt-tag">${(CAT_BY_KEY[meta.equipmentCategory] || {}).ar || ""}</span><span class="alt-tag">${DIFF_AR[lib.difficulty] || ""}</span></div>`
          : ""
      }`
    : "";
  return `
    <div class="alt-head">
      <div class="alt-head-text">
        <h2 id="altTitle" tabindex="-1">${title}</h2>
        <div class="alt-source">${sub}</div>
      </div>
      <button type="button" class="alt-close" data-action="alt-close" aria-label="إغلاق">${icon("x")}</button>
    </div>`;
}

function render(focusSel, keepScroll) {
  const panel = $("altPanel");
  if (!panel) return;
  const prevScroll = keepScroll && panel.querySelector(".alt-body") ? panel.querySelector(".alt-body").scrollTop : 0;
  panel.innerHTML = `${headerHtml()}<div class="alt-body">${sheet.view === "confirm" ? confirmView() : listView()}</div>`;
  const body = panel.querySelector(".alt-body");
  if (body) body.scrollTop = prevScroll;
  const target = (focusSel && panel.querySelector(focusSel)) || $("altTitle");
  if (target) target.focus({ preventScroll: true });
}

/* ---------------- open / close ---------------- */
function setBackgroundInert(on) {
  if (on) {
    inertEls = Array.from(document.body.children).filter((el) => el.id !== "altSheet" && el.id !== "altToast" && el.tagName !== "SCRIPT");
    inertEls.forEach((el) => el.setAttribute("inert", ""));
  } else {
    inertEls.forEach((el) => el.removeAttribute("inert"));
    inertEls = [];
  }
}

export function openAltSheet(el) {
  const root = $("altSheet");
  if (!root) return;
  const ds = el.dataset || {};
  const replaceMode = ds.day !== undefined && ds.index !== undefined;
  sheet.mode = replaceMode ? "replace" : "browse";
  sheet.dayKey = replaceMode ? ds.day : null;
  sheet.index = replaceMode ? parseInt(ds.index, 10) : null;
  sheet.sourceId = replaceMode ? getSlotExerciseId(sheet.dayKey, sheet.index) : ds.id;
  if (!sheet.sourceId) return;
  sheet.category = "all";
  sheet.onlyMine = !!profileCats(); // equipment-aware by default when the profile says what they own
  sheet.view = "list";
  sheet.confirmId = null;
  sheet.error = "";
  sheet.opener = el;
  sheet.open = true;
  setBackgroundInert(true);
  root.hidden = false;
  document.body.classList.add("alt-open");
  render();
}

export function closeAltSheet(opts = {}) {
  if (!sheet.open) return;
  sheet.open = false;
  const root = $("altSheet");
  if (root) root.hidden = true;
  document.body.classList.remove("alt-open");
  setBackgroundInert(false);
  const opener = sheet.opener;
  sheet.opener = null;
  if (opts.restoreFocus !== false && opener && opener.isConnected && opener.focus) opener.focus({ preventScroll: true });
}

/* ---------------- actions ---------------- */
export function setAltFilter(cat) {
  sheet.category = cat;
  sheet.error = "";
  render(`[data-action="alt-filter"][data-cat="${cat}"]`, true);
}

export function toggleAltMine() {
  sheet.onlyMine = !sheet.onlyMine;
  // A category tab that no longer has results would look empty; fall back to "all".
  const lists = computeLists();
  if (lists && sheet.category !== "all" && !lists.counts[sheet.category]) sheet.category = "all";
  render('[data-action="alt-toggle-mine"]', true);
}

export function pickAltExercise(id) {
  if (sheet.mode !== "replace") return;
  sheet.confirmId = id;
  sheet.view = "confirm";
  sheet.error = "";
  render('[data-action="alt-confirm"]');
}

export function backToAltList() {
  sheet.view = "list";
  sheet.confirmId = null;
  render();
}

function showToast(text) {
  const t = $("altToast");
  if (!t) return;
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 4500);
}

export function confirmAltReplacement() {
  if (sheet.mode !== "replace" || !sheet.confirmId) return;
  const { dayKey, index, confirmId } = sheet;
  const fromId = getSlotExerciseId(dayKey, index);
  const res = replaceExercise(dayKey, index, confirmId);
  if (!res.ok) {
    const m = REFUSAL_MESSAGES[res.reason];
    sheet.error = m ? m.ar : "مقدرناش نبدّل التمرين.";
    sheet.view = "list";
    sheet.confirmId = null;
    render();
    return;
  }
  closeAltSheet({ restoreFocus: false });
  refreshDayPage(dayKey, index);
  if (isGymModeActive()) refreshGymAfterReplace(dayKey, index);
  const kept = res.preserved.setsDone ? " — السيتات المكتملة اتحفظت في السجل" : "";
  showToast(
    res.restoredOriginal
      ? `رجع التمرين الأصلي: ${nameOf(confirmId)}${kept}`
      : `اتبدّل ${nameOf(fromId)} ← ${nameOf(confirmId)}${kept}`
  );
  // The old opener button was re-rendered; put keyboard focus on the new one.
  const btn = document.querySelector(`#card-${slotKey(dayKey, index)} .alt-btn`) || document.querySelector(`#gymBody .alt-btn`);
  if (btn) btn.focus({ preventScroll: true });
}

/** Esc / Tab handling while the sheet is open. Returns true when the key was consumed. */
export function handleAltKeydown(e) {
  if (!sheet.open) return false;
  if (e.key === "Escape") {
    e.preventDefault();
    if (sheet.view === "confirm") backToAltList();
    else closeAltSheet();
    return true;
  }
  if (e.key === "Tab") {
    const panel = $("altPanel");
    if (!panel) return false;
    const f = Array.from(panel.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter(
      (n) => n.offsetParent !== null
    );
    if (!f.length) return false;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel || document.activeElement.id === "altTitle")) {
      e.preventDefault();
      last.focus();
      return true;
    }
    if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
      return true;
    }
  }
  return false;
}

export function initAlternativesUI() {
  window.addEventListener("hashchange", () => closeAltSheet({ restoreFocus: false }));
}

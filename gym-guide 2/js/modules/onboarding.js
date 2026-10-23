/**
 * onboarding.js — First-run setup
 * ---------------------------------------------------------------
 * A brand-new install opens on the neutral defaults. This full-screen
 * setup asks five short things (goal, level + days/week, equipment,
 * posture problems, then a summary) and personalizes the app:
 * the line under the logo, the program, the posture drills.
 *
 *  - Nothing is written to STATE until "ابدأ" on the last step, so
 *    skipping (or closing the tab half-way) leaves the defaults intact.
 *  - Existing users are never shown this (see goals.js needsOnboarding).
 *  - It can be re-opened any time from the Profile page.
 *
 * Rendered with the same data-action delegation as the rest of the
 * app (see app.js ACTIONS); the overlay is modal: the page behind it
 * is `inert` and Tab stays inside.
 * ---------------------------------------------------------------
 */
import { STATE, persist } from "./store.js";
import { GOALS, EXPERIENCE_LEVELS, EQUIPMENT_OPTIONS } from "./profile.js";
import { POSTURE_OPTIONS, GOAL_PROFILES, brandFor, recommendProgram, applyBrand } from "./goals.js";
import { PROGRAMS, setProgram } from "./schedule.js";
import { icon } from "./icons.js";

const STEPS = ["goal", "level", "equipment", "posture", "summary"];
const PAGE_ROOTS = ["header", "#tabs", "#offlineBanner", "#mainContent", "footer.legal"];

let draft = null;
let step = 0;
let onDone = null;

const GOAL_HINTS = {
  "muscle-gain": "زيادة حجم العضلات وتكبير الجسم",
  "fat-loss": "تقليل الدهون مع الحفاظ على العضلات",
  recomposition: "بناء عضل وتقليل دهون مع بعض",
  strength: "ترفع أوزان أقوى في التمارين الأساسية",
  "general-fitness": "لياقة وصحة وشكل متوازن",
};
const LEVEL_HINTS = {
  beginner: "أقل من ٦ شهور تمرين منتظم",
  intermediate: "من ٦ شهور لـ ٢ سنة",
  advanced: "أكتر من ٢ سنة تمرين منتظم",
};

function root() {
  return document.getElementById("onboarding");
}

function freshDraft() {
  const p = STATE.profile || {};
  return {
    goal: p.goal || null,
    experience: p.experience || null,
    days: STATE.schedule && STATE.schedule.programId && PROGRAMS[STATE.schedule.programId]
      ? PROGRAMS[STATE.schedule.programId].daysPerWeek
      : 3,
    equipment: Array.isArray(p.equipment) ? p.equipment.slice() : [],
    posture: Array.isArray(p.posture) ? p.posture.slice() : [],
    postureNone: false,
  };
}

/* ---------------- RENDER ---------------- */

function optionCard({ action, field, value, title, hint, selected, multi }) {
  return `<button type="button" class="ob-option ${selected ? "selected" : ""}" data-action="${action}"
      data-field="${field}" data-value="${value}" aria-pressed="${selected}">
      <span class="ob-option-mark" aria-hidden="true">${selected ? icon("check") : ""}</span>
      <span class="ob-option-text"><span class="ob-option-title">${title}</span>${hint ? `<span class="ob-option-hint">${hint}</span>` : ""}</span>
    </button>`;
}

function stepBody() {
  const name = STEPS[step];
  if (name === "goal") {
    return {
      title: "إيه هدفك الأساسي؟",
      sub: "هنظبط التطبيق كله على هدفك. تقدر تغيّره بعدين من البروفايل.",
      html: GOALS.map((g) =>
        optionCard({ action: "ob-select", field: "goal", value: g.key, title: g.ar, hint: GOAL_HINTS[g.key], selected: draft.goal === g.key })
      ).join(""),
      ready: !!draft.goal,
    };
  }
  if (name === "level") {
    const levels = EXPERIENCE_LEVELS.map((l) =>
      optionCard({ action: "ob-select", field: "experience", value: l.key, title: l.ar, hint: LEVEL_HINTS[l.key], selected: draft.experience === l.key })
    ).join("");
    const days = [3, 6]
      .map((n) =>
        optionCard({
          action: "ob-select", field: "days", value: String(n),
          title: n === 3 ? "٣ أيام في الأسبوع" : "٦ أيام في الأسبوع",
          hint: n === 3 ? "يوم راحة بين كل جلستين" : "جمعة راحة",
          selected: draft.days === n,
        })
      )
      .join("");
    return {
      title: "مستواك وأيام التمرين",
      sub: "ده اللي بيحدد البرنامج المناسب ليك.",
      html: `<div class="ob-group-label">مستواك</div>${levels}<div class="ob-group-label">هتتمرن كام يوم؟</div>${days}`,
      ready: !!draft.experience,
    };
  }
  if (name === "equipment") {
    return {
      title: "إيه المتاح عندك؟",
      sub: "اختار كل اللي عندك. لو مش متأكد سيبها فاضية وكمّل.",
      html: EQUIPMENT_OPTIONS.map((e) =>
        optionCard({ action: "ob-multi", field: "equipment", value: e.key, title: e.ar, selected: draft.equipment.includes(e.key) })
      ).join(""),
      ready: true,
    };
  }
  if (name === "posture") {
    const opts = POSTURE_OPTIONS.map((o) =>
      optionCard({ action: "ob-multi", field: "posture", value: o.key, title: o.ar, hint: o.key === "apt" ? "بطن بارزة وتقوّس في أسفل الظهر" : "الكتفين مايلين لقدام وضهر محني", selected: draft.posture.includes(o.key) })
    ).join("");
    const none = optionCard({ action: "ob-multi", field: "posture", value: "none", title: "مفيش مشكلة قوام / مش متأكد", hint: "هتشتغل على الهدف بس من غير تمارين تصحيح", selected: draft.postureNone });
    return {
      title: "عندك مشكلة قوام عايز تصلحها؟",
      sub: "اختياري. لو اخترت، تمارين التسخين والتنشيط والإطالة هتتغير عشان تخدمها.",
      html: opts + none,
      ready: true,
    };
  }
  // summary
  const rec = recommendProgram({ goal: draft.goal, experience: draft.experience, days: draft.days });
  const prog = PROGRAMS[rec.programId];
  const brand = brandFor(draft.goal, draft.posture);
  const goalAr = (GOALS.find((g) => g.key === draft.goal) || {}).ar || "—";
  const lvlAr = (EXPERIENCE_LEVELS.find((l) => l.key === draft.experience) || {}).ar || "—";
  const gp = GOAL_PROFILES[draft.goal];
  const postureAr = draft.posture.length
    ? draft.posture.map((k) => POSTURE_OPTIONS.find((o) => o.key === k).ar).join(" + ")
    : "من غير تمارين تصحيح";
  return {
    title: "خطتك جاهزة",
    sub: "دي اللي هتشوفها في التطبيق دلوقتي.",
    html: `
      <div class="ob-summary">
        <div class="ob-brand-preview" aria-label="العنوان في التطبيق"><span class="brand-mark" aria-hidden="true">AI</span>
          <div><div class="ob-brand-name">Personal AI Trainer</div><div class="ob-brand-line">${brand.en} <span>· ${brand.ar}</span></div></div></div>
        <dl class="ob-facts">
          <div><dt>الهدف</dt><dd>${goalAr}</dd></div>
          <div><dt>المستوى</dt><dd>${lvlAr}</dd></div>
          <div><dt>البرنامج</dt><dd>${prog.ar} — ${prog.daysPerWeek} أيام</dd></div>
          <div><dt>تصحيح القوام</dt><dd>${postureAr}</dd></div>
        </dl>
        <p class="ob-reason">${rec.reason}</p>
        ${gp ? `<p class="ob-reason">${gp.reps}. ${gp.rest}.</p>` : ""}
      </div>`,
    ready: true,
  };
}

function render() {
  const el = root();
  if (!el) return;
  const body = stepBody();
  const last = step === STEPS.length - 1;
  const dots = STEPS.map((_, i) => `<span class="ob-dot ${i === step ? "on" : i < step ? "past" : ""}"></span>`).join("");
  el.innerHTML = `
    <div class="ob-panel">
      <div class="ob-top">
        <div class="ob-progress" role="img" aria-label="خطوة ${step + 1} من ${STEPS.length}">${dots}</div>
        ${last ? "" : `<button type="button" class="ob-skip" data-action="ob-skip">تخطي وابدأ بالإعدادات الافتراضية</button>`}
      </div>
      <div class="ob-scroll">
        <h2 id="obTitle" class="ob-title" tabindex="-1">${body.title}</h2>
        <p class="ob-sub">${body.sub}</p>
        <div class="ob-options" role="group" aria-labelledby="obTitle">${body.html}</div>
      </div>
      <div class="ob-actions">
        ${step > 0 ? `<button type="button" class="ob-btn ob-btn-ghost" data-action="ob-back">${icon("arrow-right")} رجوع</button>` : "<span></span>"}
        <button type="button" class="ob-btn ob-btn-primary" data-action="${last ? "ob-finish" : "ob-next"}" ${body.ready ? "" : "disabled"}>
          ${last ? "ابدأ التمرين" : "التالي"} ${icon(last ? "check" : "arrow-left")}
        </button>
      </div>
    </div>`;
}

function focusTitle() {
  const t = document.getElementById("obTitle");
  if (t) t.focus({ preventScroll: true });
}

/* ---------------- OPEN / CLOSE ---------------- */

function setPageInert(on) {
  PAGE_ROOTS.forEach((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    if (on) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  });
}

export function isOnboardingOpen() {
  const el = root();
  return !!el && !el.hidden;
}

export function openOnboarding(doneCallback) {
  const el = root();
  if (!el) return;
  onDone = typeof doneCallback === "function" ? doneCallback : onDone;
  draft = freshDraft();
  step = 0;
  el.hidden = false;
  document.body.classList.add("ob-open");
  setPageInert(true);
  render();
  focusTitle();
}

function close() {
  const el = root();
  if (el) {
    el.hidden = true;
    el.innerHTML = "";
  }
  document.body.classList.remove("ob-open");
  setPageInert(false);
  draft = null;
}

/* ---------------- ACTIONS ---------------- */

export function obSelect(field, value) {
  if (!draft) return;
  draft[field] = field === "days" ? parseInt(value, 10) : value;
  render();
  const btn = root().querySelector(`[data-field="${field}"][data-value="${value}"]`);
  if (btn) btn.focus({ preventScroll: true });
}

export function obMulti(field, value) {
  if (!draft) return;
  if (field === "posture") {
    if (value === "none") {
      draft.postureNone = !draft.postureNone;
      if (draft.postureNone) draft.posture = [];
    } else {
      draft.postureNone = false;
      const i = draft.posture.indexOf(value);
      if (i === -1) draft.posture.push(value);
      else draft.posture.splice(i, 1);
    }
  } else {
    const list = draft[field];
    const i = list.indexOf(value);
    if (i === -1) list.push(value);
    else list.splice(i, 1);
  }
  render();
  const btn = root().querySelector(`[data-field="${field}"][data-value="${value}"]`);
  if (btn) btn.focus({ preventScroll: true });
}

export function obNext() {
  if (!draft || step >= STEPS.length - 1) return;
  if (!stepBody().ready) return;
  step += 1;
  render();
  focusTitle();
}

export function obBack() {
  if (!draft || step === 0) return;
  step -= 1;
  render();
  focusTitle();
}

/** Skip = keep every default. Marked done so it is not shown again. */
export function obSkip() {
  STATE.onboarding = { done: true, skipped: true, at: new Date().toISOString() };
  persist();
  close();
  applyBrand();
  if (onDone) onDone();
}

export function obFinish() {
  if (!draft || !draft.goal || !draft.experience) return;
  const p = (STATE.profile = STATE.profile || {});
  p.goal = draft.goal;
  p.experience = draft.experience;
  p.equipment = draft.equipment.slice();
  p.posture = draft.posture.slice();
  p.limitations = p.limitations || [];
  const rec = recommendProgram({ goal: draft.goal, experience: draft.experience, days: draft.days });
  setProgram(rec.programId);
  STATE.onboarding = { done: true, skipped: false, at: new Date().toISOString() };
  persist();
  close();
  applyBrand();
  if (onDone) onDone();
}

/** Keeps Tab inside the overlay. Returns true when it handled the event. */
export function handleOnboardingKeydown(e) {
  if (!isOnboardingOpen() || e.key !== "Tab") return false;
  const nodes = Array.from(root().querySelectorAll("button:not([disabled]), [tabindex='-1']")).filter((n) => n.offsetParent !== null);
  const tabbables = nodes.filter((n) => n.tabIndex >= 0);
  if (!tabbables.length) return false;
  const first = tabbables[0];
  const last = tabbables[tabbables.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || !root().contains(active))) {
    e.preventDefault();
    last.focus();
    return true;
  }
  if (!e.shiftKey && (active === last || !root().contains(active))) {
    e.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

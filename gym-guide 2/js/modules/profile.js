/**
 * profile.js — My Profile / Assessment Page
 * ---------------------------------------------------------------
 * The onboarding/assessment layer the app was missing: a single
 * place to capture who the person is (basic stats), what they're
 * training for (goal/experience/activity), what they have to train
 * with (equipment), and what to train around (injury areas). This
 * is intentionally an ASSESSMENT, not a diagnosis — the limitations
 * chips reuse the exact same body-area names as the existing
 * INJURY guide (data.js) instead of inventing new medical-sounding
 * categories, and the page links out to that guide rather than
 * repeating/replacing its advice.
 *
 * STATE.profile shape (all fields optional — every one renders an
 * honest empty state until the person fills it in, same rule
 * metrics.js follows for body measurements):
 *   {
 *     gender: "male" | "female" | null,
 *     age, heightCm, weightKg: number | null,
 *     goal: one of GOALS[].key | null,
 *     experience: one of EXPERIENCE_LEVELS[].key | null,
 *     activityLevel: one of ACTIVITY_LEVELS[].key | null,
 *     equipment: string[]   (keys from EQUIPMENT_OPTIONS),
 *     limitations: string[] (keys from LIMITATION_OPTIONS, or ["none"])
 *   }
 *
 * Nothing here rewrites the workout program itself yet — DAY_KEYS/
 * DATA in data.js stay exactly as they are (see program.js). This
 * profile is the data layer a future adaptive/program-selection
 * engine would read from; today it's surfaced back to the person as
 * a plain-language "Training Profile" summary, computed only from
 * fields they actually filled in.
 * ---------------------------------------------------------------
 */
import { STATE, persist } from "./store.js";
import { backLink } from "./ui.js";
import { icon } from "./icons.js";

/* ---------------- OPTION SETS ---------------- */

export const GENDERS = [
  { key: "male", label: "Male", ar: "ذكر" },
  { key: "female", label: "Female", ar: "أنثى" },
];

export const GOALS = [
  { key: "muscle-gain", label: "Muscle Gain", ar: "تضخيم عضلي" },
  { key: "fat-loss", label: "Fat Loss", ar: "تنشيف / خسارة دهون" },
  { key: "recomposition", label: "Recomposition", ar: "إعادة تكوين الجسم" },
  { key: "strength", label: "Strength", ar: "قوة" },
  { key: "general-fitness", label: "General Fitness", ar: "لياقة عامة" },
];

// Same wording as exercises.js DIFF_LABELS on purpose — one vocabulary
// for "level" across the whole app instead of a second competing scale.
export const EXPERIENCE_LEVELS = [
  { key: "beginner", label: "Beginner", ar: "مبتدئ" },
  { key: "intermediate", label: "Intermediate", ar: "متوسط" },
  { key: "advanced", label: "Advanced", ar: "متقدم" },
];

// Same activity bands/wording as nutrition.js's #cActivity select, kept
// consistent rather than introducing a second set of labels for the
// same concept.
export const ACTIVITY_LEVELS = [
  { key: "sedentary", label: "Sedentary", ar: "قليل الحركة" },
  { key: "light", label: "Lightly Active", ar: "نشاط خفيف (1-3 أيام)" },
  { key: "moderate", label: "Moderately Active", ar: "نشاط متوسط (3-5 أيام)" },
  { key: "very", label: "Very Active", ar: "نشاط عالي (6-7 أيام)" },
];

export const EQUIPMENT_OPTIONS = [
  { key: "barbell", label: "Barbell", ar: "بار حديد" },
  { key: "dumbbells", label: "Dumbbells", ar: "دمبلز" },
  { key: "cables", label: "Cables", ar: "كابلات" },
  { key: "machines", label: "Machines", ar: "أجهزة" },
  { key: "bands", label: "Resistance Bands", ar: "أحبال مقاومة" },
  { key: "bodyweight", label: "Bodyweight Only", ar: "وزن الجسم فقط" },
  { key: "full-gym", label: "Full Gym Access", ar: "جيم كامل" },
];

// Deliberately the same five body areas as INJURY in data.js (shoulder/
// knee/lower-back/elbow/wrist) — this list exists to flag *where* to be
// careful, the Injury Guide is still the one place for cause/avoid/
// alternative-exercise detail (see backLink at the bottom of this page).
export const LIMITATION_OPTIONS = [
  { key: "shoulder", label: "Shoulder", ar: "الكتف" },
  { key: "knee", label: "Knee", ar: "الركبة" },
  { key: "lower-back", label: "Lower Back", ar: "أسفل الظهر" },
  { key: "elbow", label: "Elbow", ar: "المرفق" },
  { key: "wrist", label: "Wrist", ar: "الرسغ" },
  { key: "none", label: "None", ar: "لا يوجد" },
];

const NUMBER_FIELDS = [
  { key: "age", label: "Age · العمر", unit: "", step: "1", placeholder: "25" },
  { key: "heightCm", label: "Height · الطول", unit: "cm", step: "0.5", placeholder: "175" },
  { key: "weightKg", label: "Weight · الوزن", unit: "kg", step: "0.1", placeholder: "75" },
];

/* ---------------- STATE HELPERS ---------------- */

function ensureProfile() {
  STATE.profile = STATE.profile || {};
  STATE.profile.equipment = STATE.profile.equipment || [];
  STATE.profile.limitations = STATE.profile.limitations || [];
  return STATE.profile;
}

/** True once enough is filled in to compute a meaningful summary. */
function hasEnoughForSummary(p) {
  return !!(p.goal || p.experience);
}

function bmi(p) {
  if (!p.heightCm || !p.weightKg) return null;
  const hM = p.heightCm / 100;
  return Math.round((p.weightKg / (hM * hM)) * 10) / 10;
}

function findLabel(list, key) {
  const found = list.find((o) => o.key === key);
  return found ? `${found.label} · ${found.ar}` : null;
}

/* ---------------- RENDER: SUMMARY ---------------- */

function renderSummary() {
  const p = ensureProfile();
  if (!hasEnoughForSummary(p)) {
    // Same stable id as the "enough data" branch below — updateProfileField
    // always replaces this exact element, so it must exist in both states
    // or a debounced number input ends up with nothing to target.
    return `<div class="top-note" id="profileSummaryBox"><b>Training Profile · بروفايلك التدريبي</b><br>كمّل الحقول تحت (الهدف والمستوى على الأقل) عشان يظهر هنا ملخص بروفايلك.</div>`;
  }
  const bmiVal = bmi(p);
  const rows = [
    p.goal ? { label: "Primary Goal", ar: "الهدف الأساسي", value: findLabel(GOALS, p.goal) } : null,
    p.experience ? { label: "Training Level", ar: "المستوى", value: findLabel(EXPERIENCE_LEVELS, p.experience) } : null,
    bmiVal ? { label: "BMI", ar: "مؤشر كتلة الجسم", value: String(bmiVal) } : null,
    p.limitations.length && !p.limitations.includes("none")
      ? {
          label: "Training Around",
          ar: "تمرين حذر حول",
          value: p.limitations.map((k) => findLabel(LIMITATION_OPTIONS, k)).join(" · "),
        }
      : null,
  ].filter(Boolean);

  const chips = rows.map((r) => `<div class="chip"><b>${r.label} · ${r.ar}</b>${r.value}</div>`).join("");

  return `
  <div class="rule-card" id="profileSummaryBox">
    <h3>${icon("target")} Your Training Profile · بروفايلك التدريبي</h3>
    <div class="chip-grid">${chips}</div>
  </div>`;
}

/* ---------------- RENDER: SELECT ROWS ---------------- */

function singleSelectRow(field, options, current) {
  return `<div class="filter-chip-row" role="group">
    ${options
      .map(
        (o) => `<button type="button" class="filter-chip ${o.key === current ? "active" : ""}"
          data-action="profile-set-single" data-field="${field}" data-value="${o.key}"
          aria-pressed="${o.key === current}">${o.label}<span class="chip-ar">${o.ar}</span></button>`
      )
      .join("")}
  </div>`;
}

function multiSelectRow(field, options, current) {
  return `<div class="filter-chip-row" role="group">
    ${options
      .map(
        (o) => `<button type="button" class="filter-chip ${current.includes(o.key) ? "active" : ""}"
          data-action="profile-toggle-multi" data-field="${field}" data-value="${o.key}"
          aria-pressed="${current.includes(o.key)}">${o.label}<span class="chip-ar">${o.ar}</span></button>`
      )
      .join("")}
  </div>`;
}

/* ---------------- PAGE ---------------- */

export function pageProfile() {
  const p = ensureProfile();

  const numberRows = NUMBER_FIELDS.map(
    (f) => `
    <div class="calc-row">
      <label for="profile-${f.key}">${f.label}${f.unit ? ` (${f.unit})` : ""}</label>
      <input type="number" inputmode="decimal" step="${f.step}" id="profile-${f.key}"
        placeholder="${f.placeholder}" value="${p[f.key] != null ? p[f.key] : ""}" data-profile-field="${f.key}">
    </div>`
  ).join("");

  return `
    ${backLink()}
    <div class="top-note">بروفايلك بيتحفظ على جهازك بس، وبيساعد التطبيق يفهم هدفك ومستواك ومعداتك — من غير ما يغيّر برنامج التمرين الحالي دلوقتي.</div>

    ${renderSummary()}

    <div class="calc-card">
      <h3>${icon("person-standing")} Basic Info · بيانات أساسية</h3>
      <div class="calc-row"><label>Gender · النوع</label></div>
      ${singleSelectRow("gender", GENDERS, p.gender)}
      ${numberRows}
    </div>

    <div class="section-title">${icon("target")} Goal · الهدف</div>
    ${singleSelectRow("goal", GOALS, p.goal)}

    <div class="section-title">${icon("dumbbell")} Experience Level · المستوى</div>
    ${singleSelectRow("experience", EXPERIENCE_LEVELS, p.experience)}

    <div class="section-title">${icon("activity")} Activity Level · مستوى النشاط اليومي</div>
    ${singleSelectRow("activityLevel", ACTIVITY_LEVELS, p.activityLevel)}

    <div class="section-title">${icon("wrench")} Equipment Available · المعدات المتاحة</div>
    <div class="sub-note">اختار كل اللي متاح عندك (تقدر تختار أكتر من واحد).</div>
    ${multiSelectRow("equipment", EQUIPMENT_OPTIONS, p.equipment)}

    <div class="section-title">${icon("bandage")} Injuries / Limitations · إصابات أو حدود تدريب</div>
    <div class="sub-note">اختار أي منطقة محتاج تحذر فيها. للتفاصيل (السبب، تمارين تتجنبها، بدائل آمنة) شوف دليل الإصابات.</div>
    ${multiSelectRow("limitations", LIMITATION_OPTIONS, p.limitations)}
    <a class="back-link" href="#injury" style="margin-top:2px;">${icon("bandage")} دليل الإصابات بالتفصيل</a>
  `;
}

/* ---------------- ACTIONS ---------------- */

export function setProfileSingle(field, value) {
  const p = ensureProfile();
  p[field] = p[field] === value ? null : value; // tap active tile again to clear
  persist();
  rerenderProfilePage();
}

export function toggleProfileMulti(field, value) {
  const p = ensureProfile();
  const list = p[field] || (p[field] = []);
  const idx = list.indexOf(value);

  if (field === "limitations") {
    if (value === "none") {
      // "None" is exclusive with every real limitation.
      p.limitations = idx === -1 ? ["none"] : [];
    } else {
      const withoutNone = list.filter((k) => k !== "none");
      if (idx === -1) withoutNone.push(value);
      else withoutNone.splice(withoutNone.indexOf(value), 1);
      p.limitations = withoutNone;
    }
  } else if (idx === -1) {
    list.push(value);
  } else {
    list.splice(idx, 1);
  }

  persist();
  rerenderProfilePage();
}

/** Debounced number-input handler (age/height/weight) — mirrors workout.js
 * updateLog: persist + surgically refresh only the summary card, so the
 * person can keep typing into other fields without losing focus. */
export function updateProfileField(field, value) {
  const p = ensureProfile();
  const n = parseFloat(value);
  p[field] = value === "" || Number.isNaN(n) ? null : n;
  persist();
  const box = document.getElementById("profileSummaryBox");
  if (box) box.outerHTML = renderSummary();
}

function rerenderProfilePage() {
  const sec = document.getElementById("sec-profile");
  if (sec) sec.innerHTML = pageProfile();
}

/** Cheap, idempotent helper other pages can use to decide whether to
 * nudge the person toward completing their profile (see dashboard.js). */
export function isProfileStarted() {
  const p = STATE.profile;
  return !!(p && (p.goal || p.experience || p.gender || p.age || p.heightCm || p.weightKg));
}

/* ---------------- CROSS-PAGE INTEGRATION HELPERS ----------------
 * Read-only helpers other pages import to make actual use of the
 * profile — nothing in profile.js itself reaches into those pages.
 * ------------------------------------------------------------- */

// Maps a profile equipment key to the exercises-data.js EQUIPMENT_TYPES
// value(s) it corresponds to (see exercises.js). "full-gym" intentionally
// maps to every type — having full access means nothing needs excluding.
const EQUIPMENT_TO_EX_TYPES = {
  barbell: ["Barbell"],
  dumbbells: ["Dumbbell"],
  cables: ["Cable"],
  machines: ["Machine"],
  bands: ["Band"],
  bodyweight: ["Bodyweight"],
  "full-gym": ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight", "Band"],
};

/** Has the person selected any equipment in their profile yet? Used by
 * exercises.js to decide whether to offer the "My Equipment" filter. */
export function hasProfileEquipment() {
  const p = STATE.profile;
  return !!(p && p.equipment && p.equipment.length);
}

/** Does a single exercise-library equipment value (e.g. "Barbell", as
 * used on exercises-data.js EXERCISES[].equipment) match anything the
 * person marked as available in their profile? */
export function exerciseMatchesProfileEquipment(exEquipment) {
  const p = STATE.profile;
  if (!p || !p.equipment || !p.equipment.length) return false;
  for (const key of p.equipment) {
    const types = EQUIPMENT_TO_EX_TYPES[key];
    if (types && types.includes(exEquipment)) return true;
  }
  return false;
}

// nutrition.js's #cActivity select already uses these exact multiplier
// strings as option values (Mifflin-St Jeor activity factors) — kept
// here as the single place activityLevel keys are defined.
const ACTIVITY_MULTIPLIERS = { sedentary: "1.2", light: "1.375", moderate: "1.55", very: "1.725" };

/** The nutrition calculator's activity-multiplier value for a profile
 * activityLevel key, or null if unset/unrecognized. */
export function activityLevelMultiplier(key) {
  return ACTIVITY_MULTIPLIERS[key] || null;
}

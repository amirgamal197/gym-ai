/**
 * goals.js — Goal-driven personalization
 * ---------------------------------------------------------------
 * One place that answers "what does THIS person's app look like?":
 *   - the header line under the logo (was hard-coded "تضخيم + تصحيح
 *     القوام" for everyone),
 *   - which posture problems (if any) they want to work on, and
 *     therefore which warm-up / activation / stretch drills the Day
 *     pages pick,
 *   - what the goal means in practice (rep range, rest, calories, an
 *     optional cardio finisher),
 *   - which of the existing programs fits their goal + days per week.
 *
 * Nothing here edits DATA or any workout key. It only READS
 * STATE.profile / STATE.onboarding and returns plain values (plus one
 * DOM helper, applyBrand), so every existing set / log / history key
 * keeps working exactly as before.
 *
 * STATE shape added by this module (both optional):
 *   STATE.profile.posture  = ["apt" | "rounded-shoulders", ...]  ([] = none)
 *   STATE.onboarding       = { done, skipped, legacy, at }
 *
 * No imports from profile.js on purpose (profile.js imports THIS file).
 * ---------------------------------------------------------------
 */
import { STATE } from "./store.js";

/* ---------------- POSTURE FOCUS ---------------- */

// Only conditions that really have a library today (see data.js
// CORRECTIVE_CONDITIONS). Forward-head / kyphosis stay "coming soon"
// there and are not offered here, so nobody picks something we can't serve.
export const POSTURE_OPTIONS = [
  { key: "apt", label: "Pelvic Tilt (APT)", ar: "ميل الحوض الأمامي", short: "APT", shortAr: "ميل الحوض" },
  { key: "rounded-shoulders", label: "Rounded Shoulders", ar: "انحناء الكتفين", short: "Shoulders", shortAr: "الكتفين" },
];
const POSTURE_KEYS = POSTURE_OPTIONS.map((p) => p.key);

/** The person's chosen posture problems (validated). [] = none chosen. */
export function getPostureFocus() {
  const raw = STATE.profile && STATE.profile.posture;
  if (!Array.isArray(raw)) return [];
  return POSTURE_KEYS.filter((k) => raw.includes(k));
}

/** Posture tag(s) each prep drill works on, keyed by the drill's English name.
 *  Anything not listed is "general" (useful for everyone). */
const PREP_TAGS = {
  // mobility
  "Thread the Needle": ["rounded-shoulders"],
  "Thoracic Rotation (Quadruped)": ["rounded-shoulders"],
  "Shoulder CARs": ["rounded-shoulders"],
  "Band Pull Apart": ["rounded-shoulders"],
  "Hip CARs": ["apt"],
  "90/90 Hip Rotation": ["apt"],
  "World's Greatest Stretch": ["apt", "rounded-shoulders"],
  // activation
  "Face Pull": ["rounded-shoulders"],
  "Scapular Pull-ups": ["rounded-shoulders"],
  "Band External Rotation": ["rounded-shoulders"],
  "Wall Slides": ["rounded-shoulders"],
  "Glute Bridge": ["apt"],
  "Dead Bug": ["apt"],
  "Bird Dog": ["apt"],
  "Mini Band Walk": ["apt"],
  "Hip Airplane": ["apt"],
  // cool-down
  "Doorway Chest Stretch": ["rounded-shoulders"],
  "Kneeling Hip Flexor Stretch": ["apt"],
  "Figure-4 Glute Stretch": ["apt"],
};

export function postureTagsOf(item) {
  return (item && PREP_TAGS[item.en]) || [];
}

/** 2 = trains one of the person's posture problems, 1 = general, 0 = trains
 *  only a posture problem they did NOT pick. */
function prepScore(item, focus) {
  const tags = postureTagsOf(item);
  if (tags.some((t) => focus.includes(t))) return 2;
  return tags.length ? 0 : 1;
}

function shuffled(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Pick `max` warm-up-block drills from `pool`.
 *  - No posture focus chosen  -> exactly the old behaviour (random pick).
 *  - Focus chosen             -> drills for THEIR posture problems first,
 *    then general drills, and only then drills for problems they didn't pick.
 */
export function pickPrep(pool, max = 2) {
  if (!pool || pool.length <= max) return pool ? pool.slice() : [];
  const focus = getPostureFocus();
  if (!focus.length) return shuffled(pool).slice(0, max);
  const ranked = shuffled(pool).sort((a, b) => prepScore(b, focus) - prepScore(a, focus));
  return ranked.slice(0, max);
}

/** Same list, posture drills for the person's focus moved to the front
 *  (nothing is removed — used for the cool-down stretches). */
export function orderByFocus(list) {
  const focus = getPostureFocus();
  if (!focus.length || !list) return list ? list.slice() : [];
  return list
    .map((item, i) => ({ item, i, s: prepScore(item, focus) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.item);
}

/** How many activation drills to show: a little more when posture is a goal. */
export function activationCount() {
  return getPostureFocus().length ? 3 : 2;
}

/* ---------------- GOAL PROFILES ---------------- */

/**
 * What each goal means in practice. Ranges are mainstream, conservative
 * resistance-training guidance (ACSM/NSCA-style) — the program's own
 * sets/reps are not rewritten, this is coaching text shown next to them.
 */
export const GOAL_PROFILES = {
  "muscle-gain": {
    brandEn: "Hypertrophy", brandAr: "تضخيم",
    pitch: "بناء حجم عضلي",
    reps: "٦–١٢ تكرار للمركّبات و١٠–١٥ للعزل",
    rest: "راحة ٩٠–١٥٠ ثانية بين السيتات",
    food: "فائض بسيط ٢٠٠–٣٠٠ سعرة فوق احتياجك + بروتين كفاية",
    finisher: false,
  },
  "fat-loss": {
    brandEn: "Fat Loss", brandAr: "تنشيف",
    pitch: "خسارة دهون مع الحفاظ على العضلات",
    reps: "٦–١٢ تكرار — خلّي الأوزان تقيلة عشان تحافظ على عضلك",
    rest: "راحة ٦٠–٩٠ ثانية بين السيتات",
    food: "عجز بسيط ٣٠٠–٥٠٠ سعرة تحت احتياجك + بروتين عالي",
    finisher: true,
  },
  recomposition: {
    brandEn: "Recomposition", brandAr: "إعادة تكوين",
    pitch: "بناء عضل وخسارة دهون في نفس الوقت",
    reps: "٦–١٢ تكرار، وزوّد الوزن كل ما تقدر",
    rest: "راحة ٩٠–١٢٠ ثانية بين السيتات",
    food: "سعرات قريبة من احتياجك + بروتين عالي (١٫٨–٢٫٢ جم لكل كجم)",
    finisher: false,
  },
  strength: {
    brandEn: "Strength", brandAr: "قوة",
    pitch: "زيادة القوة في التمارين الأساسية",
    reps: "٣–٦ تكرار في المركّبات التقيلة",
    rest: "راحة ٢–٤ دقايق بين سيتات المركّبات",
    food: "سعرات قريبة من احتياجك أو أعلى بشوية + بروتين كفاية",
    finisher: false,
  },
  "general-fitness": {
    brandEn: "General Fitness", brandAr: "لياقة عامة",
    pitch: "لياقة وصحة عامة",
    reps: "٨–١٥ تكرار بتحكم كامل في الحركة",
    rest: "راحة ٦٠–٩٠ ثانية بين السيتات",
    food: "أكل متوازن قريب من احتياجك + بروتين في كل وجبة",
    finisher: true,
  },
};

export const DEFAULT_BRAND = { en: "Your Personal Training Guide", ar: "دليلك التدريبي الشخصي" };

export function getGoal() {
  const g = STATE.profile && STATE.profile.goal;
  return GOAL_PROFILES[g] ? g : null;
}

export function getGoalProfile() {
  const g = getGoal();
  return g ? GOAL_PROFILES[g] : null;
}

/** Cardio finisher block is part of the plan for fat-loss / general-fitness. */
export function wantsFinisher() {
  const gp = getGoalProfile();
  return !!(gp && gp.finisher);
}

/* ---------------- BRAND LINE ---------------- */

function postureBrand(focus) {
  if (!focus.length) return null;
  if (focus.length > 1) return { en: "Posture Correction", ar: "تصحيح القوام" };
  const p = POSTURE_OPTIONS.find((o) => o.key === focus[0]);
  return p.key === "apt"
    ? { en: "APT Correction", ar: "تصحيح ميل الحوض" }
    : { en: "Shoulder Posture", ar: "تصحيح الكتفين" };
}

/** Brand line for a given goal + posture list. Pure — no STATE access. */
export function brandFor(goal, focus) {
  const gp = GOAL_PROFILES[goal] || null;
  const pb = postureBrand(focus || []);
  if (gp && pb) return { en: `${gp.brandEn} & ${pb.en}`, ar: `${gp.brandAr} + ${pb.ar}` };
  if (gp) return { en: gp.brandEn, ar: gp.brandAr };
  if (pb) return { en: pb.en, ar: pb.ar };
  return DEFAULT_BRAND;
}

/** The line shown under the logo. */
export function getBrand() {
  const ob = STATE.onboarding;
  const g = getGoal();
  const focus = getPostureFocus();
  // Existing installs that never picked a goal keep the line they always had.
  if (!g && !focus.length && ob && ob.legacy) {
    return { en: "Hypertrophy & APT Correction", ar: "تضخيم + تصحيح القوام" };
  }
  return brandFor(g, focus);
}

/** Write the brand line into the header, <title> and the theme of the page. */
export function applyBrand() {
  if (typeof document === "undefined") return;
  const b = getBrand();
  const el = document.querySelector(".brand-program");
  if (el) {
    el.innerHTML = "";
    el.append(document.createTextNode(b.en + " "));
    const ar = document.createElement("span");
    ar.className = "brand-program-ar";
    ar.textContent = "· " + b.ar;
    el.append(ar);
  }
}

/* ---------------- PROGRAM RECOMMENDATION ---------------- */

/**
 * Which existing program fits. Only 3 and 6 days exist today
 * (schedule.js SUPPORTED_FREQUENCIES), so that is all this chooses between.
 * @returns {{programId:string, reason:string}}
 */
export function recommendProgram({ goal, experience, days }) {
  if (Number(days) === 6) {
    return { programId: "ppl6", reason: "٦ أيام في الأسبوع: دفع/سحب/رجل مرتين، كل عضلة بتتدرب مرتين." };
  }
  if (goal === "muscle-gain" && experience === "advanced") {
    return { programId: "ppl3", reason: "متقدم وهدفك تضخيم: دفع/سحب/رجل بحجم أعلى للعضلة في الجلسة." };
  }
  return {
    programId: "fullbody",
    reason: "٣ أيام: فول بادي بيدرّب كل عضلة ٣ مرات في الأسبوع، وده أنسب لمعظم الأهداف.",
  };
}

/* ---------------- ONBOARDING STATE ---------------- */

/** Has the person got any saved activity from before this feature existed? */
function hasLegacyData() {
  const has = (o) => o && typeof o === "object" && Object.keys(o).length > 0;
  const p = STATE.profile;
  return has(STATE.sets) || has(STATE.history) || has(STATE.schedule) || !!(p && (p.goal || p.experience));
}

/**
 * Decide, once at boot, whether to show the first-run setup.
 * Existing users are NOT interrupted: they are marked done + legacy.
 * @returns {boolean} true when the setup should be shown
 */
export function needsOnboarding() {
  if (STATE.onboarding && STATE.onboarding.done) return false;
  if (hasLegacyData()) {
    STATE.onboarding = { done: true, skipped: true, legacy: true, at: new Date().toISOString() };
    return false;
  }
  return true;
}

export function isPersonalized() {
  return !!getGoal() || getPostureFocus().length > 0;
}

/** Short HTML card for the Day page / dashboard: what the goal means today.
 *  Returns "" until a goal is chosen (nothing is shown by default). */
export function goalNoteHtml() {
  const g = getGoal();
  if (!g) return "";
  const gp = GOAL_PROFILES[g];
  const focus = getPostureFocus();
  const posture = focus.length
    ? `<div class="goal-note-row"><b>تصحيح القوام:</b> ${focus
        .map((k) => POSTURE_OPTIONS.find((o) => o.key === k).ar)
        .join(" + ")} — اخترنا لك تمارين تسخين وتنشيط وإطالة تخدم ده.</div>`
    : "";
  return `
  <div class="goal-note" id="goalNote">
    <div class="goal-note-title">${gp.brandAr} · ${gp.pitch}</div>
    <div class="goal-note-row"><b>التكرارات:</b> ${gp.reps}</div>
    <div class="goal-note-row"><b>الراحة:</b> ${gp.rest}</div>
    <div class="goal-note-row"><b>الأكل:</b> ${gp.food}</div>
    ${posture}
  </div>`;
}

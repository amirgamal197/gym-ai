import { STATE, persist } from "./store.js";
import { ENERGY_OPTIONS, TIME_OPTIONS, TIER_LABELS } from "./adaptive-meta.js";
import { icon } from "./icons.js";
import { buildAdaptiveWorkout } from "./adaptive-workout.js";
import { DATA } from "./data.js";
import { getSlotRef } from "./replacements.js";

const REASON_MAP = {
  "equipment-swap": "تغيير بسبب المعدات المتاحة",
  "level-swap": "تغيير ليناسب مستوى خبرتك",
  "energy-swap": "تغيير ليناسب طاقتك النهاردة",
  "fewer-exercises": "تقليل عدد التمارين لتناسب وقتك/طاقتك",
  "fewer-sets": "تقليل عدد السيتات لتناسب طاقتك",
  "time-trimmed": "تعديل في الحجم عشان نلتزم بالوقت",
  "accessory-added": "إضافة تمرين إكسسوار لزيادة الفائدة",
  "partial-swap": "نفس العضلة بحركة مختلفة (تعديل تكيّفي)",
  "group-fallback": "نفس العضلة بحركة مختلفة (بديل أساسي)",
  "relaxed-tier": "تمرين متقدم تم الإبقاء عليه رغم الطاقة المنخفضة",
  "kept-demanding": "تمرين أساسي تم الإبقاء عليه",
};

/** Renders the adaptive check-in card for a specific day. */
export function renderCheckIn(dayKey) {
  const d = DATA[dayKey];
  if (!d) return "";

  const state = STATE.adaptive || {};
  const dayState = state.byDay?.[dayKey] || {};
  const energy = dayState.energy || "normal";
  const time = dayState.time || state.defaultTime || "45-60";

  // Check if the workout is actually adapted compared to the original
  const slots = d.main.map((_, i) => ({ index: i, ...getSlotRef(dayKey, i) }));
  const adapted = buildAdaptiveWorkout({
    dayKey,
    slots,
    level: STATE.profile?.experience || "intermediate",
    energy,
    time,
    availableCategories: STATE.profile?.equipment || null,
  });

  const isAdapted = adapted.summaryKey === "adapted";
  const tierLabel = TIER_LABELS[adapted.tier].ar;

  return `
    <div class="adaptive-checkin" role="group" aria-label="تعديل خطة التمرين">
      <div class="checkin-head">
        <h3>${icon("zap")} تعديل خطة النهارده</h3>
        <div class="checkin-sub">حسب طاقتك ومستواك، بنقترح عليك أنسب حجم تمرين للنهارده.</div>
      </div>

      <div class="checkin-row">
        <span class="row-label">الطاقة:</span>
        <div class="chip-grid">
          ${ENERGY_OPTIONS.map((o) => `
            <button type="button" class="filter-chip ${o.key === energy ? "active" : ""}"
              data-action="adaptive-set" data-field="energy" data-value="${o.key}"
              aria-pressed="${o.key === energy}">${o.label}<span class="chip-ar">${o.ar}</span></button>
          `).join("")}
        </div>
      </div>

      <div class="checkin-row">
        <span class="row-label">الوقت:</span>
        <div class="chip-grid">
          ${TIME_OPTIONS.map((o) => `
            <button type="button" class="filter-chip ${o.key === time ? "active" : ""}"
              data-action="adaptive-set" data-field="time" data-value="${o.key}"
              aria-pressed="${o.key === time}">${o.label}<span class="chip-ar">${o.ar}</span></button>
          `).join("")}
        </div>
      </div>

      ${isAdapted ? `
        <div class="adaptation-note">
          ${icon("refresh")} حسب طاقتك ومستواك عدّلنا تمرين النهارده
          <span class="tier-badge">${tierLabel}</span>
        </div>
      ` : ""}

      <button type="button" class="reset-btn" data-action="adaptive-reset" data-day="${dayKey}">
        ${icon("refresh")} رجّع خطة اليوم الكاملة
      </button>
    </div>
  `;
}

/** Handles adaptive state updates. */
export function handleAdaptiveAction(action, dayKey, value, field) {
  STATE.adaptive = STATE.adaptive || { date: null, byDay: {}, defaultTime: "45-60" };

  if (action === "adaptive-set") {
    STATE.adaptive.byDay = STATE.adaptive.byDay || {};
    STATE.adaptive.byDay[dayKey] = STATE.adaptive.byDay[dayKey] || {};
    STATE.adaptive.byDay[dayKey][field] = value;
    persist();
  } else if (action === "adaptive-reset") {
    if (STATE.adaptive.byDay?.[dayKey]) {
      delete STATE.adaptive.byDay[dayKey];
      persist();
    }
  }
}

/** Renders a small note explaining why an exercise was adapted. */
export function renderAdaptationNote(reasons) {
  if (!reasons || !reasons.length) return "";
  const texts = reasons.map((r) => REASON_MAP[r] || r).filter(Boolean);
  return `<div class="adaptation-note-small">${icon("info")} ${texts.join(" • ")}</div>`;
}

/**
 * recovery.js — Recovery Page
 * ---------------------------------------------------------------
 * Daily recovery checklist + fatigue slider + static recovery guidance.
 * ---------------------------------------------------------------
 */
import { RECOVERY } from "./data.js";
import { STATE, persist } from "./store.js";
import { backLink, stretchCard } from "./ui.js";
import { icon } from "./icons.js";

export function pageRecovery() {
  const cardsHtml = RECOVERY.cards.map((c) => `<div class="rule-card"><h3>${c.title}</h3><p>${c.body}</p></div>`).join("");
  const checkHtml = RECOVERY.checklist
    .map(
      (t, i) => `
    <div class="check-item" role="checkbox" tabindex="0" aria-checked="false" data-action="toggle-check" data-check="rec-${i}">
      <div class="box" aria-hidden="true">${icon("check")}</div><div>${t}</div>
    </div>`
    )
    .join("");
  const flexHtml = RECOVERY.flexibilityRoutine
    .map((c, i) => stretchCard("rec-flex-" + i, i, c))
    .join("");
  return `
    ${backLink("Support & Recovery · الدعم والاستشفاء", "support")}
    <div class="section-title">${icon("check")} تشيك ليست الاستشفاء اليومي</div>
    ${checkHtml}
    <div class="section-title">${icon("book")} دليل الاستشفاء</div>
    ${cardsHtml}
    <div class="section-title">${icon("meditate")} روتين مرونة يوم الراحة (15-20 دقيقة)</div>
    <div class="top-note">استخدمه في أيام الراحة (زي يوم الكورس) بدل الجمود الكامل — كله إطالات ثابتة، مفيش حركات ديناميكية.</div>
    ${flexHtml}
    <div class="section-title">${icon("activity")} مقياس الإرهاق (Fatigue Score)</div>
    <div class="rule-card">
      <p>قيّم مستوى إرهاقك دلوقتي من 1 (طاقة كاملة) لـ 10 (إرهاق شديد). لو فوق 7 لمدة كذا يوم متتالية، فكر في يوم Deload.</p>
      <label for="fatigueSlider" style="display:block;font-size:.76rem;color:var(--muted);margin-bottom:6px;">مستوى الإرهاق</label>
      <input type="range" min="1" max="10" value="${STATE.fatigue || 5}" id="fatigueSlider"
        style="width:100%;" aria-valuemin="1" aria-valuemax="10" aria-valuenow="${STATE.fatigue || 5}">
      <div class="stat-line" id="fatigueVal" aria-live="polite">المستوى الحالي: ${STATE.fatigue || 5}/10</div>
    </div>
  `;
}

export function toggleCheck(key) {
  STATE.checks = STATE.checks || {};
  STATE.checks[key] = !STATE.checks[key];
  const el = document.querySelector(`[data-check="${key}"]`);
  if (el) {
    el.classList.toggle("checked");
    el.setAttribute("aria-checked", String(el.classList.contains("checked")));
  }
  persist();
}

export function updateFatigue(value) {
  STATE.fatigue = value;
  const label = document.getElementById("fatigueVal");
  if (label) label.textContent = `المستوى الحالي: ${value}/10`;
  const slider = document.getElementById("fatigueSlider");
  if (slider) slider.setAttribute("aria-valuenow", String(value));
  persist();
}

/** Re-apply persisted checklist state onto freshly-rendered DOM. */
export function hydrateRecoveryUI() {
  document.querySelectorAll("[data-check]").forEach((el) => {
    const k = el.dataset.check;
    const checked = !!(STATE.checks && STATE.checks[k]);
    el.classList.toggle("checked", checked);
    el.setAttribute("aria-checked", String(checked));
  });
}

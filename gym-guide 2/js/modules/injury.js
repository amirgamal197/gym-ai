/**
 * injury.js — Injury / Pain Guide Page
 * ---------------------------------------------------------------
 * Static, collapsible per-body-area guidance. Reuses the same
 * collapsible-card interaction pattern as exercise cards
 * (data-action="toggle-card", handled by ui.js/app.js).
 * ---------------------------------------------------------------
 */
import { INJURY } from "./data.js";
import { backLink } from "./ui.js";
import { icon } from "./icons.js";

export function pageInjury() {
  const html = INJURY.map(
    (it, i) => `
    <div class="ex-card" id="card-inj-${i}">
      <div class="ex-head" role="button" tabindex="0" aria-expanded="false" aria-controls="body-inj-${i}"
          data-action="toggle-card" data-key="inj-${i}">
        <div class="ex-titles"><div class="en">${it.area}</div></div>
        <span class="chevron" aria-hidden="true">▾</span>
      </div>
      <div class="ex-body" id="body-inj-${i}"><div class="ex-body-inner">
        <div class="tip">${icon("search")} <b>السبب المحتمل:</b> ${it.cause}</div>
        <div class="mistake">${icon("ban")} <b>تجنب:</b> ${it.avoid}</div>
        <div class="why">${icon("check")} <b>بدائل آمنة:</b> ${it.alt}</div>
        <div class="chip full"><b>موبيليتي مفيد</b>${it.mobility}</div>
        <div class="chip full" style="margin-top:8px;"><b>توصيات الاستشفاء</b>${it.recovery}</div>
      </div></div>
    </div>`
  ).join("");
  return `
    ${backLink("Support & Recovery · الدعم والاستشفاء", "support")}
    <div class="top-note">الدليل ده عام وتعليمي — مش تشخيص طبي. لو الألم حاد، مستمر، أو فيه تورم/تنميل، استشر مختص فورًا.</div>
    ${html}
  `;
}

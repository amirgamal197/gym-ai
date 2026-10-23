/**
 * corrective.js — Corrective / Posture Library Page
 * ---------------------------------------------------------------
 * Was a single-purpose "APT library" tab. Restructured into a
 * condition picker (APT, Rounded Shoulders, Forward Head, Kyphosis,
 * ...) so the app doesn't assume every user has the same posture
 * issue — nothing loads until a condition is chosen. Only APT ships
 * with real content right now (the exact aptEducation/aptLibrary
 * data that used to live directly on the old "APT" tab, unchanged);
 * the rest are declared in data.js as an honest "coming soon" state,
 * ready for real content later without any further restructuring.
 * ---------------------------------------------------------------
 */
import { DATA, CORRECTIVE_CONDITIONS, CONDITION_CONTENT } from "./data.js";
import { exCard, backLink } from "./ui.js";
import { icon } from "./icons.js";
import { getPostureFocus } from "./goals.js";

// Local (non-persisted) UI state — which condition is currently open.
// Starts at null on purpose: the page opens on the picker, not on APT.
let openCondition = null;

export function pageCorrective() {
  if (!openCondition) return pagePicker();
  const cond = CORRECTIVE_CONDITIONS.find((c) => c.key === openCondition);
  if (!cond || !cond.available) return pagePicker();
  return pageConditionDetail(cond);
}

function pagePicker() {
  // The person's own posture problems (profile / first-run setup) come first.
  const mine = getPostureFocus();
  const ordered = CORRECTIVE_CONDITIONS.slice().sort((a, b) => Number(mine.includes(b.key)) - Number(mine.includes(a.key)));
  const cardsHtml = ordered.map(
    (c) => `
    <div class="condition-card ${c.available ? "" : "soon"} ${mine.includes(c.key) ? "mine" : ""}" role="button" tabindex="0"
        data-action="corrective-open" data-condition="${c.key}" aria-disabled="${!c.available}">
      ${mine.includes(c.key) ? `<div class="condition-mine-badge">${icon("check")} اخترتها لنفسك</div>` : ""}
      <div class="condition-title">${c.label}</div>
      <div class="condition-ar">${c.ar}</div>
      <div class="condition-intro">${c.intro}</div>
      ${c.available ? `<div class="condition-cta">افتح المكتبة ${icon("arrow-left")}</div>` : `<div class="condition-soon-badge">قريبًا</div>`}
    </div>`
  ).join("");

  return `
    ${backLink("Support & Recovery · الدعم والاستشفاء", "support")}
    <div class="top-note">${mine.length ? "دي الحالات اللي اخترتها في بروفايلك، وتمارين التسخين والتنشيط والإطالة في أيام التمرين بتتغير عشان تخدمها. تقدر تغيّرها من البروفايل." : "مكتبة تصحيحية اختيارية — اختار الحالة اللي بتنطبق عليك (لو فيه) وابدأ. مش لازم يكون عندك أي مشكلة قوام عشان تستخدم باقي التطبيق."}</div>
    <div class="condition-grid">${cardsHtml}</div>
  `;
}

function pageConditionDetail(cond) {
  const content = CONDITION_CONTENT[cond.key];
  const eduList = (content && DATA[content.edu]) || [];
  const libList = (content && DATA[content.lib]) || [];
  const eduHtml = eduList.map((c) => `<div class="rule-card"><h3>${c.title}</h3><p>${c.body}</p></div>`).join("");
  const libHtml = libList.map((ex, i) => exCard(cond.key + "-" + i, i, ex, { trackable: false })).join("");
  return `
    <button type="button" class="back-link-btn" data-action="corrective-back">${icon("arrow-left")} كل الحالات</button>
    <div class="section-title">${icon("book")} فهم ${cond.label}</div>
    ${eduHtml}
    <div class="section-title">${icon("wrench")} مكتبة التمارين التصحيحية</div>
    <div class="sub-note">استخدم التمارين دي كروتين يومي (10-15 دقيقة) — مش لازم كلها كل مرة، اختار 4-5 وبدّل بينهم أسبوعيًا.</div>
    ${libHtml}
  `;
}

export function openConditionLibrary(key) {
  const cond = CORRECTIVE_CONDITIONS.find((c) => c.key === key);
  if (!cond || !cond.available) return; // "coming soon" conditions aren't clickable into a page
  openCondition = key;
  rerender();
}

export function backToConditionPicker() {
  openCondition = null;
  rerender();
}

function rerender() {
  const sec = document.getElementById("sec-corrective");
  if (sec) {
    sec.innerHTML = pageCorrective();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

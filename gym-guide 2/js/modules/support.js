/**
 * support.js — Support & Recovery Hub
 * ---------------------------------------------------------------
 * Groups everything that isn't the workout itself — nutrition,
 * recovery, posture correction, injury guidance — under one
 * meaningful section instead of a flat "Links" grid. Every card
 * routes to the existing page/tab (nutrition.js, recovery.js,
 * corrective.js, injury.js) via the same hash navigation already
 * used everywhere else — nothing about those pages changes.
 * ---------------------------------------------------------------
 */
import { backLink } from "./ui.js";
import { icon } from "./icons.js";

const SUPPORT_LINKS = [
  { tab: "profile", icon: "clipboard", title: "My Profile", ar: "بروفايلي", desc: "هدفك، مستواك، معداتك، وأي منطقة محتاج تحذر فيها — بيانات بتتحفظ على جهازك بس." },
  { tab: "nutrition", icon: "salad", title: "Nutrition", ar: "التغذية", desc: "حاسبات البروتين والسعرات والماء، والمكملات المرتبة حسب قوة الأدلة." },
  { tab: "recovery", icon: "meditate", title: "Recovery", ar: "الاستشفاء", desc: "تشيك ليست الاستشفاء اليومي، مقياس الإرهاق، ودليل النوم والـ Deload." },
  { tab: "corrective", icon: "person-standing", title: "Posture Correction", ar: "تصحيح القوام", desc: "مكتبة تصحيحية لـ APT وحالات القوام الأخرى." },
  { tab: "injury", icon: "bandage", title: "Injury Guide", ar: "دليل الإصابات", desc: "أسباب محتملة، تمارين لازم تتجنبها، وبدائل آمنة لكل منطقة." },
  { tab: "tracker", icon: "trending-up", title: "Progress Tracker", ar: "سجل التقدم", desc: "كل تمرين محفوظ بحجمه وأفضل 1RM تقديري — تابع تقدمك أول بأول." },
];

export function pageSupport() {
  const cards = SUPPORT_LINKS.map(
    (l) => `
    <a class="support-card" href="#${l.tab}">
      <span class="support-card-icon" aria-hidden="true">${icon(l.icon)}</span>
      <span class="support-card-body">
        <span class="support-card-title">${l.title} <span class="support-card-ar">${l.ar}</span></span>
        <span class="support-card-desc">${l.desc}</span>
      </span>
      <span class="support-card-arrow" aria-hidden="true">${icon("arrow-left")}</span>
    </a>`
  ).join("");

  return `
    ${backLink()}
    <div class="top-note">كل حاجة بتدعم تمرينك — تغذية، استشفاء، تصحيح قوام، وإصابات — في مكان واحد.</div>
    <div class="support-grid">${cards}</div>
  `;
}

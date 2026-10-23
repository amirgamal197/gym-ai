/**
 * settings.js — App Settings & Data Management
 * ---------------------------------------------------------------
 * Handles visual preferences (theme, language) and critical
 * data actions (factory reset).
 * ---------------------------------------------------------------
 */
import { STATE, persist } from "./store.js";
import { backLink } from "./ui.js";
import { icon } from "./icons.js";

export function pageSettings() {
  const s = STATE.settings || {};

  return `
    ${backLink()}
    <div class="calc-card">
      <h3>${icon("settings")} App Settings · إعدادات التطبيق</h3>

      <div class="calc-row">
        <label>Theme · المظهر</label>
        <div class="filter-chip-row">
          <button type="button" class="filter-chip ${s.theme === "dark" ? "active" : ""}"
            data-action="set-theme" data-value="dark">Dark <span class="chip-ar">داكن</span></button>
          <button type="button" class="filter-chip ${s.theme === "light" ? "active" : ""}"
            data-action="set-theme" data-value="light">Light <span class="chip-ar">فاتح</span></button>
        </div>
      </div>

      <div class="calc-row">
        <label>Language · اللغة</label>
        <div class="filter-chip-row">
          <button type="button" class="filter-chip ${s.lang === "ar" ? "active" : ""}"
            data-action="set-lang" data-value="ar">Arabic <span class="chip-ar">العربية</span></button>
          <button type="button" class="filter-chip ${s.lang === "en" ? "active" : ""}"
            data-action="set-lang" data-value="en">English <span class="chip-ar">الإنجليزية</span></button>
        </div>
      </div>
    </div>

    <div class="section-title" style="margin-top:24px;">${icon("alert-triangle")} Danger Zone · منطقة الخطر</div>
    <div class="calc-card" style="border-color: var(--error-color, #ff4444);">
      <p class="sub-note">Warning: This will permanently delete all your logs, profile, and program settings. You cannot undo this action.</p>
      <p class="sub-note ar">تحذير: سيؤدي هذا إلى حذف جميع سجلاتك، وبروفايلك، وإعدادات البرنامج نهائياً. لا يمكن التراجع عن هذا الإجراء.</p>
      <button type="button" class="save-session" data-action="reset-app" style="background: var(--error-color, #ff4444); color: white; margin-top:12px;">
        ${icon("refresh")} Factory Reset · إعادة تعيين المصنع
      </button>
    </div>
  `;
}

export function setTheme(theme) {
  STATE.settings = STATE.settings || {};
  STATE.settings.theme = theme;
  persist();
  applyTheme();
  rerenderSettingsPage();
}

export function applyTheme() {
  const theme = STATE.settings?.theme || "dark";
  if (theme === "light") {
    document.body.classList.add("light-theme");
  } else {
    document.body.classList.remove("light-theme");
  }
}

export function setLang(lang) {
  STATE.settings = STATE.settings || {};
  STATE.settings.lang = lang;
  persist();
  // In a full i18n app, we would trigger a global re-render here.
  rerenderSettingsPage();
}

export function resetAllData() {
  if (confirm("Are you sure? All data will be wiped!\\nهل أنت متأكد؟ سيتم مسح جميع البيانات!")) {
    localStorage.clear();
    window.location.reload();
  }
}

function rerenderSettingsPage() {
  const sec = document.getElementById("sec-settings");
  if (sec) sec.innerHTML = pageSettings();
}

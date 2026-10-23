/**
 * metrics.js — Body Measurements
 * ---------------------------------------------------------------
 * A body-metrics "entry" is one measurement snapshot: exactly the
 * shape an InBody scan produces (several fields captured at once).
 * Manual entry today creates one of these snapshots by hand; a future
 * InBody OCR/PDF importer would create the exact same shape from a
 * scanned report — no data-model change needed when that ships, only
 * a new "source" ("inbody" instead of "manual") and an importer that
 * calls addMetricEntry() with whatever fields it manages to read.
 *
 * STATE.metrics = {
 *   entries: [
 *     { id, dateISO, source: "manual" | "inbody",
 *       weight, bodyFatPct, muscleMass, bmi, waist, chest, arms, thighs,
 *       height  // optional, only used to auto-derive bmi when omitted
 *     }, ...
 *   ]
 * }
 *
 * "Current" value for any field = the most recent entry that actually
 * has that field set (fields are sparse — a manual entry might only
 * fill in weight + waist that day). No value is ever invented: an
 * unset field renders as a clean empty state (see dashboard.js).
 * ---------------------------------------------------------------
 */
import { STATE, persist, localISODate } from "./store.js";
import { backLink } from "./ui.js";
import { icon } from "./icons.js";

export const METRIC_FIELDS = [
  { key: "weight", label: "Weight · الوزن", unit: "kg", step: "0.1" },
  { key: "bodyFatPct", label: "Body Fat · نسبة الدهون", unit: "%", step: "0.1" },
  { key: "muscleMass", label: "Muscle Mass · الكتلة العضلية", unit: "kg", step: "0.1" },
  { key: "bmi", label: "BMI · مؤشر كتلة الجسم", unit: "", step: "0.1" },
  { key: "waist", label: "Waist · محيط الخصر", unit: "cm", step: "0.5" },
  { key: "chest", label: "Chest · محيط الصدر", unit: "cm", step: "0.5" },
  { key: "arms", label: "Arms · محيط الذراع", unit: "cm", step: "0.5" },
  { key: "thighs", label: "Thighs · محيط الفخذ", unit: "cm", step: "0.5" },
];

function entries() {
  STATE.metrics = STATE.metrics || { entries: [] };
  STATE.metrics.entries = STATE.metrics.entries || [];
  return STATE.metrics.entries;
}

/** Most recent entry that has `key` set, or null if nothing was ever recorded for it. */
export function getLatestMetric(key) {
  const list = entries();
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i][key] !== undefined && list[i][key] !== null && list[i][key] !== "") {
      return { value: list[i][key], dateISO: list[i].dateISO, source: list[i].source };
    }
  }
  return null;
}

export function getAllEntries() {
  return entries().slice().reverse(); // newest first
}

/** Add one manual measurement snapshot. Only non-empty fields are stored — never fills in guessed values. */
export function addManualMetricEntry(values) {
  const clean = {};
  METRIC_FIELDS.forEach((f) => {
    const v = values[f.key];
    if (v !== undefined && v !== null && v !== "" && !Number.isNaN(parseFloat(v))) {
      clean[f.key] = parseFloat(v);
    }
  });
  if (values.height && !Number.isNaN(parseFloat(values.height))) clean.height = parseFloat(values.height);

  // Auto-derive BMI only if the person gave weight+height and didn't already type a BMI themselves.
  if (clean.weight && clean.height && clean.bmi === undefined) {
    const hM = clean.height / 100;
    clean.bmi = Math.round((clean.weight / (hM * hM)) * 10) / 10;
  }

  if (Object.keys(clean).length === 0) return false; // nothing to save

  const list = entries();
  list.push(Object.assign({ id: "m" + Date.now(), dateISO: localISODate(), source: "manual" }, clean));
  persist();
  return true;
}

export function deleteMetricEntry(id) {
  STATE.metrics.entries = entries().filter((e) => e.id !== id);
  persist();
}

/* ---------------- PAGE ---------------- */
export function pageMetrics() {
  const formRows = METRIC_FIELDS.map(
    (f) => `
    <div class="calc-row">
      <label for="metric-${f.key}">${f.label}${f.unit ? ` (${f.unit})` : ""}</label>
      <input type="number" inputmode="decimal" step="${f.step}" id="metric-${f.key}" placeholder="—">
    </div>`
  ).join("");

  const historyHtml = getAllEntries().length
    ? getAllEntries()
        .slice(0, 12)
        .map((e) => {
          const chips = METRIC_FIELDS.filter((f) => e[f.key] !== undefined)
            .map((f) => `<div class="chip"><b>${f.label}</b>${e[f.key]}${f.unit ? " " + f.unit : ""}</div>`)
            .join("");
          return `
        <div class="rule-card metric-entry">
          <div class="metric-entry-head">
            <h3>${e.dateISO} <span class="badge">${e.source === "inbody" ? "InBody" : "يدوي"}</span></h3>
            <button type="button" class="metric-delete" data-action="metric-delete" data-id="${e.id}" aria-label="حذف القياس">${icon("trash")}</button>
          </div>
          <div class="chip-grid">${chips}</div>
        </div>`;
        })
        .join("")
    : `<div class="rule-card"><p>لسه معملتش أي قياس. سجّل أول قياس من الفورم فوق.</p></div>`;

  return `
    ${backLink()}
    <div class="top-note">سجّل قياساتك يدويًا دلوقتي. لاحقًا هتقدر ترفع تقرير InBody ويتقرا تلقائيًا (OCR) ويملى نفس الحقول دي — الشكل جاهز من دلوقتي.</div>

    <div class="section-title">${icon("edit")} إدخال يدوي</div>
    <div class="calc-card">
      <div class="calc-row"><label for="metric-height">الطول (سم) — اختياري، لحساب BMI تلقائيًا</label><input type="number" inputmode="decimal" id="metric-height" placeholder="—"></div>
      ${formRows}
      <button class="save-session" type="button" data-action="metric-save" style="background:var(--energy-grad-solid);color:#fff;border:none;">${icon("save")} احفظ القياس</button>
    </div>

    <div class="section-title">${icon("camera")} استيراد InBody (قريبًا)</div>
    <div class="rule-card inbody-stub">
      <p>هتقدر ترفع صورة/PDF تقرير InBody وهيتملى الوزن ونسبة الدهون والكتلة العضلية وباقي الحقول تلقائيًا. الميزة دي لسه مش شغالة — البيانات والتصميم بس جاهزين لها.</p>
      <button type="button" class="save-session" disabled aria-disabled="true">${icon("file")} رفع تقرير InBody — قريبًا</button>
    </div>

    <div class="section-title">${icon("history")} سجل القياسات</div>
    ${historyHtml}
  `;
}

/* ---------------- ACTIONS ---------------- */
export function saveMetricsForm() {
  const values = {};
  METRIC_FIELDS.forEach((f) => {
    const el = document.getElementById("metric-" + f.key);
    if (el) values[f.key] = el.value;
  });
  const heightEl = document.getElementById("metric-height");
  if (heightEl) values.height = heightEl.value;

  const saved = addManualMetricEntry(values);
  const sec = document.getElementById("sec-metrics");
  if (saved && sec) {
    sec.innerHTML = pageMetrics();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

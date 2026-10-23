/**
 * progress-ui.js — Progress visualisation (Phase 5)
 * ---------------------------------------------------------------
 * HTML-string builders (same style as dashboard.js / ui.js) on top of the
 * pure data in progress.js. Every chart has:
 *   - role="img" + an aria-label that states the numbers in words, and
 *   - a real <table> with the same data (visually hidden for the weekly bars,
 *     inside a <details> for the exercise curve),
 * so nothing is conveyed by colour or shape alone.
 * Charts are drawn left→right (oldest → newest) with direction:ltr, even
 * inside the RTL page, so the numbers and the time axis never mirror.
 * ---------------------------------------------------------------
 */
import { icon } from "./icons.js";
import { getExerciseProgress, getPersonalRecords, getWeeklyStats, parseISO, getInBodyHistory } from "./progress.js";

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function fmtDate(iso, opts) {
  if (!iso) return "";
  try {
    return parseISO(iso).toLocaleDateString("ar-EG", opts || { day: "numeric", month: "short" });
  } catch (e) {
    return iso;
  }
}

function fmtNum(n) {
  return Math.round(n).toLocaleString("en-US");
}

/**
 * Renders the Body Composition (InBody) section.
 * Includes a Chart.js canvas and a data logging form.
 */
export function bodyCompositionHTML() {
  const history = getInBodyHistory();
  if (!history.length) {
    return `
      <div class="section-title">${icon("scale")} تكوين الجسم (InBody)</div>
      <div class="rule-card">
        <p>لسه مفيش بيانات InBody متسجلة. ضيف أول قياس عشان تتابع تطورك!</p>
        <div class="calc-row"><label>التاريخ</label><input type="date" id="ibDate"></div>
        <div class="calc-row"><label>الوزن (كجم)</label><input type="number" id="ibWeight" step="0.1"></div>
        <div class="calc-row"><label>العضلات (كجم)</label><input type="number" id="ibMuscle" step="0.1"></div>
        <div class="calc-row"><label>الدهون (%)</label><input type="number" id="ibFat" step="0.1"></div>
        <button class="save-session" type="button" data-action="save-inbody">حفظ القياسات</button>
      </div>
    `;
  }

  const rows = history.slice().reverse().map(e => `
    <tr>
      <td>${esc(fmtDate(e.dateISO, { day: "numeric", month: "short", year: "numeric" }))}</td>
      <td>${fmtNum(e.weight)}</td>
      <td>${fmtNum(e.muscle)}</td>
      <td>${fmtNum(e.fat)}%</td>
      <td><button class="reset-btn" style="padding:2px 8px; font-size:.7rem;" data-action="delete-inbody" data-date="${e.dateISO}">✕</button></td>
    </tr>
  `).join("");

  return `
    <div class="section-title">${icon("scale")} تكوين الجسم (InBody)</div>
    <div class="rule-card">
      <div class="chart-container" style="position:relative; height:250px; width:100%; margin-bottom:20px;">
        <canvas id="inbodyChart"></canvas>
      </div>
      <div class="sub-note">تتبع تطور الوزن، الكتلة العضلية، ونسبة الدهون عبر الزمن.</div>
    </div>

    <div class="rule-card">
      <h3>${icon("plus")} إضافة قياس جديد</h3>
      <div class="calc-row"><label>التاريخ</label><input type="date" id="ibDate" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="calc-row"><label>الوزن (كجم)</label><input type="number" id="ibWeight" step="0.1"></div>
      <div class="calc-row"><label>العضلات (كجم)</label><input type="number" id="ibMuscle" step="0.1"></div>
      <div class="calc-row"><label>الدهون (%)</label><input type="number" id="ibFat" step="0.1"></div>
      <button class="save-session" type="button" data-action="save-inbody">حفظ القياسات</button>
    </div>

    <div class="pg-table-wrap">
      <table class="pg-table">
        <thead><tr><th>التاريخ</th><th>الوزن</th><th>العضلات</th><th>الدهون</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/** Initialize the InBody Chart using Chart.js. */
export function initInBodyChart() {
  const canvas = document.getElementById("inbodyChart");
  if (!canvas) return;

  const history = getInBodyHistory();
  if (!history.length) return;

  const labels = history.map(e => fmtDate(e.dateISO));
  const weights = history.map(e => e.weight);
  const muscles = history.map(e => e.muscle);
  const fats = history.map(e => e.fat);

  new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "الوزن", data: weights, borderColor: "var(--energy-1)", tension: 0.3, yAxisID: "y" },
        { label: "العضلات", data: muscles, borderColor: "var(--energy-2)", tension: 0.3, yAxisID: "y" },
        { label: "الدهون", data: fats, borderColor: "var(--data-1)", tension: 0.3, yAxisID: "y1" },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { type: "linear", position: "left", title: { display: true, text: "كجم" } },
        y1: { type: "linear", position: "right", title: { display: true, text: "%" }, grid: { drawOnChartArea: false } }
      },
      plugins: {
        legend: { position: "bottom", labels: { color: "var(--text-muted)", font: { size: 11 } } }
      }
    }
  });
}

/**
 * Line chart for one series. points: [{label, value}] (≥2). Returns "" for fewer.
 * The y-axis always shows min and max so the scale is never hidden.
 */
export function lineChartSVG(points, { unit = "", summary = "" } = {}) {
  if (!Array.isArray(points) || points.length < 2) return "";
  const W = 320,
    H = 140,
    L = 40,
    R = 12,
    T = 14,
    B = 26;
  const vals = points.map((p) => p.value);
  let min = Math.min(...vals),
    max = Math.max(...vals);
  if (min === max) {
    min = min * 0.9;
    max = max * 1.1 || 1;
  }
  const x = (i) => L + (i * (W - L - R)) / (points.length - 1);
  const y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const pts = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const best = vals.indexOf(Math.max(...vals));
  const dots = points
    .map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="${i === best ? 4.5 : 3}" fill="${i === best ? "var(--energy-2)" : "var(--data-2)"}"/>`)
    .join("");
  const first = points[0],
    last = points[points.length - 1];
  return `<svg class="pg-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(summary)}" style="direction:ltr" focusable="false">
    <line x1="${L}" y1="${y(max).toFixed(1)}" x2="${W - R}" y2="${y(max).toFixed(1)}" class="pg-grid"/>
    <line x1="${L}" y1="${y(min).toFixed(1)}" x2="${W - R}" y2="${y(min).toFixed(1)}" class="pg-grid"/>
    <text x="${L - 6}" y="${(y(max) + 4).toFixed(1)}" text-anchor="end" class="pg-axis">${fmtNum(Math.max(...vals))}</text>
    <text x="${L - 6}" y="${(y(min) + 4).toFixed(1)}" text-anchor="end" class="pg-axis">${fmtNum(Math.min(...vals))}</text>
    <polyline points="${pts}" fill="none" stroke="var(--data)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
    <text x="${L}" y="${H - 8}" text-anchor="start" class="pg-axis">${esc(first.label)}</text>
    <text x="${W - R}" y="${H - 8}" text-anchor="end" class="pg-axis">${esc(last.label)}</text>
  </svg>${unit ? `<div class="pg-unit">${esc(unit)}</div>` : ""}`;
}

/** Card for one exercise: PR, change since first session, curve, data table. */
export function exerciseProgressCard(p) {
  const rm = p.trend.filter((s) => s.best1rm > 0).map((s) => ({ label: fmtDate(s.dateISO) || s.dateLabel || "—", value: s.best1rm, dateISO: s.dateISO, volume: s.volume }));
  const summary =
    rm.length >= 2
      ? `${p.name}: أفضل 1RM تقديري من ${fmtNum(rm[0].value)} إلى ${fmtNum(rm[rm.length - 1].value)} كجم عبر ${rm.length} جلسات`
      : "";
  const chart = lineChartSVG(rm, { unit: "1RM تقديري (كجم)", summary });
  const changeChip =
    p.changePct === null
      ? ""
      : `<div class="chip"><b>${icon(p.changePct > 0 ? "arrow-up" : p.changePct < 0 ? "arrow-down" : "target")} حجم الجلسة</b>${p.changePct > 0 ? "+" : ""}${p.changePct}% من أول جلسة</div>`;
  const rows = p.sessions
    .slice()
    .reverse()
    .map((s) => `<tr><td>${esc(fmtDate(s.dateISO, { day: "numeric", month: "short", year: "numeric" }) || s.dateLabel || "—")}</td><td>${fmtNum(s.volume)}</td><td>${fmtNum(s.best1rm)}</td></tr>`)
    .join("");
  const partialCount = p.entryCount - p.sessions.length;
  return `<div class="rule-card pg-card" data-exercise-id="${esc(p.id)}">
    <h3>${esc(p.name)} ${p.latestIsPR ? `<span class="pg-pr-badge">${icon("star")} رقم قياسي جديد</span>` : ""}</h3>
    <div class="chip-grid">
      <div class="chip"><b>${icon("star")} أفضل 1RM تقديري</b>${p.best ? fmtNum(p.best.best1rm) + " كجم" : "—"}</div>
      <div class="chip"><b>عدد الجلسات</b>${p.sessions.length}${partialCount ? ` + ${partialCount} جزئية` : ""}</div>
      ${changeChip}
    </div>
    ${chart ? `<div class="pg-chart-wrap">${chart}</div>` : `<p class="sub-note">محتاج جلستين على الأقل عشان يظهر منحنى التقدّم.</p>`}
    ${
      rows
        ? `<details class="pg-details"><summary>الأرقام بالتفصيل</summary>
      <div class="pg-table-wrap"><table class="pg-table"><thead><tr><th scope="col">التاريخ</th><th scope="col">الحجم (كجم)</th><th scope="col">1RM (كجم)</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${partialCount ? `<p class="sub-note">الجلسات الجزئية (اتبدّل التمرين أثناءها) محسوبة في الرقم القياسي بس مش في منحنى الحجم.</p>` : ""}
    </details>`
        : ""
    }
  </div>`;
}

/** Tracker section: records + one curve card per exercise (all follow the exercise across swaps). */
export function progressByExerciseHTML() {
  const list = getExerciseProgress();
  const bodyComp = bodyCompositionHTML();
  if (!list.length && !bodyComp) return "";
  return `
    ${bodyComp}
    <div class="section-title">${icon("trending-up")} التقدّم لكل تمرين</div>
    <p class="sub-note">كل تمرين بيتتبّع باسمه الثابت — لو بدّلته وبعدين رجعته، أو عملته في أكتر من يوم، تقدمه بيفضل في منحنى واحد.</p>
    ${list.map(exerciseProgressCard).join("")}
    <div class="section-title">${icon("history")} السجل التفصيلي حسب اليوم</div>`;
}

/** Weekly bars: sessions + volume for the last `count` weeks. "" when there is no dated history at all. */
export function weeklyBarsHTML(count = 8) {
  const weeks = getWeeklyStats(count);
  if (!weeks.some((w) => w.volume > 0 || w.sessions > 0)) return "";
  const maxVol = Math.max(...weeks.map((w) => w.volume), 1);
  const bars = weeks
    .map((w) => {
      const pct = Math.round((w.volume / maxVol) * 100);
      return `<div class="pg-bar-col${w.current ? " current" : ""}" aria-hidden="true">
        <div class="pg-bar-val">${w.volume >= 1000 ? (w.volume / 1000).toFixed(1) + "k" : w.volume}</div>
        <div class="pg-bar-track"><div class="pg-bar-fill" style="height:${Math.max(w.volume ? 6 : 0, pct)}%"></div></div>
        <div class="pg-bar-lab">${w.current ? "الحالي" : fmtDate(w.startISO, { day: "numeric", month: "numeric" })}</div>
      </div>`;
    })
    .join("");
  const label = `حجم التمرين الأسبوعي آخر ${count} أسابيع: ` + weeks.map((w) => `${w.current ? "الأسبوع الحالي" : "أسبوع " + fmtDate(w.startISO)} ${fmtNum(w.volume)} كجم في ${w.sessions} أيام`).join("، ");
  const rows = weeks
    .map((w) => `<tr><th scope="row">${esc(fmtDate(w.startISO, { day: "numeric", month: "long" }))}${w.current ? " (الحالي)" : ""}</th><td>${w.sessions}</td><td>${fmtNum(w.volume)}</td></tr>`)
    .join("");
  return `<div class="dash-week pg-weekly" role="group" aria-label="${esc(label)}">
    <div class="dash-week-head"><span>${icon("activity")} حجم التمرين الأسبوعي</span><span>كجم × تكرار</span></div>
    <div class="pg-bars" style="direction:ltr">${bars}</div>
    <div class="sr-only"><table><caption>حجم التمرين الأسبوعي</caption><thead><tr><th scope="col">الأسبوع (بيبدأ السبت)</th><th scope="col">أيام التدريب</th><th scope="col">الحجم (كجم)</th></tr></thead><tbody>${rows}</tbody></table></div>
  </div>`;
}

/** Top personal records for the dashboard. "" when none. */
export function recentRecordsHTML(limit = 3) {
  const prs = getPersonalRecords(limit);
  if (!prs.length) return "";
  const items = prs
    .map(
      (r) => `<li class="pg-pr-row"><span class="pg-pr-name">${esc(r.name)}${r.isNew ? ` <span class="pg-pr-badge">${icon("star")} جديد</span>` : ""}</span><span class="pg-pr-val">${fmtNum(r.best1rm)} <small>كجم</small></span><span class="pg-pr-date">${esc(fmtDate(r.dateISO) || r.dateLabel)}</span></li>`
    )
    .join("");
  return `<div class="dash-week pg-prs">
    <div class="dash-week-head"><span>${icon("star")} أحدث أرقامك القياسية (1RM تقديري)</span><a class="dash-weekstrip-edit" href="#tracker">كل التقدم</a></div>
    <ul class="pg-pr-list">${items}</ul>
  </div>`;
}

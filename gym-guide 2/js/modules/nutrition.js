/**
 * nutrition.js — Nutrition Page
 * ---------------------------------------------------------------
 * Daily Macro Tracker + Protein / calorie / hydration calculators
 * ---------------------------------------------------------------
 */
import { NUTRITION } from "./data.js";
import { STATE, persist, localISODate } from "./store.js";
import { activityLevelMultiplier } from "./profile.js";
import { backLink } from "./ui.js";
import { icon } from "./icons.js";

/**
 * Renders the nutrition page. Now includes a Daily Macro Tracker
 * alongside the existing calculators.
 */
export function pageNutrition() {
  const p = STATE.profile || {};
  const today = localISODate();

  // Initialize macro state if missing
  STATE.macros = STATE.macros || {};
  STATE.macroGoals = STATE.macroGoals || { calories: 2500, protein: 160, carbs: 250, fats: 70 };

  const todayData = STATE.macros[today] || { calories: 0, protein: 0, carbs: 0, fats: 0 };
  const goals = STATE.macroGoals;

  const getPct = (val, goal) => Math.min(Math.round((val / goal) * 100), 100) || 0;

  const macroBars = [
    { label: "سعرات", key: "calories", val: todayData.calories, goal: goals.calories, unit: "سعرة", color: "var(--energy-1)" },
    { label: "بروتين", key: "protein", val: todayData.protein, goal: goals.protein, unit: "جم", color: "var(--energy-2)" },
    { label: "كارب", key: "carbs", val: todayData.carbs, goal: goals.carbs, unit: "جم", color: "var(--data-1)" },
    { label: "دهون", key: "fats", val: todayData.fats, goal: goals.fats, unit: "جم", color: "var(--data-2)" },
  ].map(m => `
    <div class="macro-bar-row">
      <div class="macro-bar-info"><span>${m.label}</span><span>${m.val} / ${m.goal} ${m.unit}</span></div>
      <div class="macro-bar-track"><div class="macro-bar-fill" style="width:${getPct(m.val, m.goal)}%; background:${m.color}"></div></div>
    </div>
  `).join("");

  const activityVal = activityLevelMultiplier(p.activityLevel);
  const activityOptions = [
    { value: "1.2", label: "قليل الحركة" },
    { value: "1.375", label: "نشاط خفيف (1-3 أيام)" },
    { value: "1.55", label: "نشاط متوسط (3-5 أيام)" },
    { value: "1.725", label: "نشاط عالي (6-7 أيام)" },
  ]
    .map((o) => `<option value="${o.value}" ${o.value === activityVal ? "selected" : (!activityVal && o.value === "1.55" ? "selected" : "")}>${o.label}</option>`)
    .join("");

  const supHtml = NUTRITION.supplements
    .map(
      (s) => `
    <div class="evidence-tier">
      <span>${s.name}<br><span style="color:var(--muted);font-size:.72rem;">${s.note}</span></span>
      <span class="tier-badge tier-${s.tier}">${s.tier === "High" ? "أدلة قوية" : s.tier === "Moderate" ? "أدلة متوسطة" : "أدلة محدودة" }</span>
    </div>`
    )
    .join("");

  return `
    ${backLink("Support & Recovery · الدعم والاستشفاء", "support")}

    <div class="section-title">${icon("utensils")} تتبع الماكروز اليومي</div>
    <div class="rule-card">
      <div class="macro-summary">${macroBars}</div>
      <div class="macro-add-grid">
        <div class="calc-row"><label>سعرات</label><input type="number" id="addCal" placeholder="0"></div>
        <div class="calc-row"><label>بروتين</label><input type="number" id="addProt" placeholder="0"></div>
        <div class="calc-row"><label>كارب</label><input type="number" id="addCarb" placeholder="0"></div>
        <div class="calc-row"><label>دهون</label><input type="number" id="addFat" placeholder="0"></div>
        <button class="save-session" type="button" data-action="save-macro-entry" style="grid-column: span 4; margin-top:10px;">إضافة للقيم الحالية</button>
      </div>
    </div>

    <details class="pg-details">
      <summary>تعديل الأهداف اليومية</summary>
      <div class="macro-goal-grid">
        <div class="calc-row"><label>السعرات</label><input type="number" id="goalCal" value="${goals.calories}"></div>
        <div class="calc-row"><label>البروتين</label><input type="number" id="goalProt" value="${goals.protein}"></div>
        <div class="calc-row"><label>الكارب</label><input type="number" id="goalCarb" value="${goals.carbs}"></div>
        <div class="calc-row"><label>الدهون</label><input type="number" id="goalFat" value="${goals.fats}"></div>
        <button class="save-session" type="button" data-action="set-macro-goal" style="margin-top:10px;">حفظ الأهداف</button>
      </div>
    </details>

    ${p.weightKg || p.heightCm || p.age || p.activityLevel ? `<div class="top-note">الحقول تحت اتملت تلقائيًا من <a href="#profile">بروفايلك</a> — عدّل فيها براحتك، التعديل هنا مش بيغيّر بروفايلك.</div>` : ""}
    <div class="calc-card">
      <h3>${icon("meat")} حاسبة البروتين</h3>
      <div class="calc-row"><label for="pWeight">وزن الجسم (كجم)</label><input type="number" id="pWeight" placeholder="مثال: 75" value="${p.weightKg || ""}"></div>
      <button class="save-session" type="button" data-action="calc-protein">احسب</button>
      <div class="calc-result" id="pResult" aria-live="polite"></div>
    </div>
    <div class="calc-card">
      <h3>${icon("flame")} حاسبة السعرات (تقريبية)</h3>
      <div class="calc-row"><label for="cWeight">الوزن (كجم)</label><input type="number" id="cWeight" placeholder="75" value="${p.weightKg || ""}"></div>
      <div class="calc-row"><label for="cHeight">الطول (سم)</label><input type="number" id="cHeight" placeholder="175" value="${p.heightCm || ""}"></div>
      <div class="calc-row"><label for="cAge">العمر</label><input type="number" id="cAge" placeholder="25" value="${p.age || ""}"></div>
      <div class="calc-row"><label for="cActivity">النشاط</label>
        <select id="cActivity">
          ${activityOptions}
        </select>
      </div>
      <div class="calc-row"><label for="cGoal">الهدف</label>
        <select id="cGoal">
          <option value="0">ثبات الوزن</option>
          <option value="300">زيادة عضلية (فائض)</option>
          <option value="-300">تنشيف (عجز)</option>
        </select>
      </div>
      <button class="save-session" type="button" data-action="calc-calories">احسب</button>
      <div class="calc-result" id="cResult" aria-live="polite"></div>
    </div>
    <div class="calc-card">
      <h3>${icon("droplet")} حاسبة الماء</h3>
      <div class="calc-row"><label for="hWeight">الوزن (كجم)</label><input type="number" id="hWeight" placeholder="75" value="${p.weightKg || ""}"></div>
      <button class="save-session" type="button" data-action="calc-hydration">احسب</button>
      <div class="calc-result" id="hResult" aria-live="polite"></div>
    </div>
    <div class="rule-card">
      <h3>${icon("clock")} توقيت الوجبات</h3>
      <p><b>قبل التمرين (60-90 دقيقة):</b> كارب سريع الهضم + بروتين خفيف (مثلاً موز + شوفان).</p>
      <p><b>بعد التمرين (خلال ساعة):</b> بروتين + كارب لتعويض الجليكوجين وبدء الاستشفاء (مثلاً أرز + دجاج أو شيك بروتين + موز).</p>
    </div>
    <div class="section-title">${icon("pill")} المكملات مرتبة حسب قوة الأدلة العلمية</div>
    ${supHtml}
    <div class="rule-card"><p style="margin:0;">ملحوظة: المعلومات دي عامة وتعليمية بس، مش استشارة طبية أو غذائية شخصية — لو عندك أي حالة صحية استشر دكتور أو أخصائي تغذية.</p></div>
  `;
}

export function saveMacroEntry() {
  const today = localISODate();
  const cal = parseFloat(document.getElementById("addCal")?.value) || 0;
  const prot = parseFloat(document.getElementById("addProt")?.value) || 0;
  const carb = parseFloat(document.getElementById("addCarb")?.value) || 0;
  const fat = parseFloat(document.getElementById("addFat")?.value) || 0;

  STATE.macros = STATE.macros || {};
  STATE.macros[today] = STATE.macros[today] || { calories: 0, protein: 0, carbs: 0, fats: 0 };

  STATE.macros[today].calories += cal;
  STATE.macros[today].protein += prot;
  STATE.macros[today].carbs += carb;
  STATE.macros[today].fats += fat;

  persist();
  window.dispatchEvent(new CustomEvent("render-current-page"));
}

export function setMacroGoal() {
  const cal = parseFloat(document.getElementById("goalCal")?.value) || 2500;
  const prot = parseFloat(document.getElementById("goalProt")?.value) || 160;
  const carb = parseFloat(document.getElementById("goalCarb")?.value) || 250;
  const fat = parseFloat(document.getElementById("goalFat")?.value) || 70;

  STATE.macroGoals = { calories: cal, protein: prot, carbs: carb, fats: fat };
  persist();
  window.dispatchEvent(new CustomEvent("render-current-page"));
}

export function calcProtein() {
  const wEl = document.getElementById("pWeight");
  const resultEl = document.getElementById("pResult");
  const w = parseFloat(wEl.value);
  if (!w || w <= 0) {
    resultEl.textContent = "اكتب وزنك الأول.";
    return;
  }
  resultEl.innerHTML = `احتياجك اليومي التقريبي: <b>${Math.round(w * 1.6)} - ${Math.round(w * 2.2)} جم بروتين</b> يوميًا لدعم بناء العضلات.`;
}

export function calcCalories() {
  const w = parseFloat(document.getElementById("cWeight").value);
  const h = parseFloat(document.getElementById("cHeight").value);
  const a = parseFloat(document.getElementById("cAge").value);
  const act = parseFloat(document.getElementById("cActivity").value);
  const goal = parseFloat(document.getElementById("cGoal").value);
  const resultEl = document.getElementById("cResult");
  if (!w || !h || !a || w <= 0 || h <= 0 || a <= 0) {
    resultEl.textContent = "كمل البيانات كلها الأول.";
    return;
  }
  const bmr = 10 * w + 6.25 * h - 5 * a + 5;
  const tdee = Math.round(bmr * act);
  resultEl.innerHTML = `تقديرًا: <b>${tdee + goal} سعرة/يوم</b> (TDEE تقريبي: ${tdee}).
    هذا تقدير عام مبني على معادلة عامة (تقدير رجل تقريبي) ومش دقيق 100% —
    لازم تتابع وزنك أسبوعيًا وتعدل عليه حسب استجابة جسمك الفعلية.`;
}

export function calcHydration() {
  const w = parseFloat(document.getElementById("hWeight").value);
  const resultEl = document.getElementById("hResult");
  if (!w || w <= 0) {
    resultEl.textContent = "اكتب وزنك الأول.";
    return;
  }
  resultEl.innerHTML = `احتياجك الأساسي: <b>${Math.round(w * 35)} مل/يوم</b> تقريبًا، زوّد 500-750 مل إضافية في يوم التمرين حسب شدة التعرق.`;
}

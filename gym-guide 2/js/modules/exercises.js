/**
 * exercises.js — Exercise Library Page (Workout Engine)
 * ---------------------------------------------------------------
 * Search + filter (muscle group / equipment / difficulty) + favorite
 * + detail view over the exercise database in exercises-data.js.
 *
 * Follows the same patterns as the rest of the app: pure string
 * templates, data-action delegation (app.js), STATE + persist() for
 * favorites, and the existing .ex-card/.ex-head/.ex-body visual
 * language from ui.js/styles.css (no new visual system introduced).
 * ---------------------------------------------------------------
 */
import { EXERCISES, MUSCLE_GROUPS, EQUIPMENT_TYPES, EQUIPMENT_LABELS } from "./exercises-data.js";
import { STATE, persist } from "./store.js";
import { mediaHtml, tutorialLink, illustrationLink } from "./ui.js";
import { muscleIconSVG } from "./muscle-icons.js";
import { hasProfileEquipment, exerciseMatchesProfileEquipment } from "./profile.js";
import { icon } from "./icons.js";

// Local (non-persisted) filter/search state — resets on page reload, like any list view.
const filterState = { query: "", group: "all", equipment: "all", difficulty: "all", onlyFav: false, onlyMyEquipment: false, selectedId: null };

/**
 * Normalizes common Arabic spelling variants that people mix up while typing
 * (ه/ة, أ/إ/آ/ا, ى/ي) so the search box matches regardless of which form the
 * exercise data or the person's query happens to use — e.g. "عقله" still finds
 * "عقلة" and vice versa. Left as a lowercase pass-through for English text.
 */
function normalizeSearchText(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[ةه]/g, "ه")
    .replace(/[أإآا]/g, "ا")
    .replace(/[ىي]/g, "ي");
}

const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
const DIFF_LABELS = { Beginner: "مبتدئ", Intermediate: "متوسط", Advanced: "متقدم" };

/* ---------------- PAGE ---------------- */
export function pageExercises() {
  const groupTiles = MUSCLE_GROUPS.map(
    (g) => `<button type="button" class="filter-chip muscle-tile" data-action="ex-filter" data-type="group" data-value="${g.key}"><span class="muscle-tile-icon">${muscleIconSVG(g.key)}</span><span class="muscle-tile-label">${g.label}<span class="muscle-tile-ar">${g.ar || ""}</span></span></button>`
  ).join("");

  const equipmentOptions = [`<option value="all">كل المعدات</option>`]
    .concat(EQUIPMENT_TYPES.map((eq) => `<option value="${eq}">${EQUIPMENT_LABELS[eq] || eq}</option>`))
    .join("");

  const difficultyOptions = [`<option value="all">كل المستويات</option>`]
    .concat(DIFFICULTIES.map((d) => `<option value="${d}">${DIFF_LABELS[d]}</option>`))
    .join("");

  return `
    <div class="top-note">دور على أي تمرين، فلتر حسب العضلة/المعدات/المستوى، واحفظ المفضلة عندك. كل تمرين فيه طريقة الأداء الصحيحة، الأخطاء التي يجب تجنبها، ونصايح، مع رابط Tutorial (يوتيوب) وIllustration (MuscleWiki/MuscleAndStrength).</div>

    <div class="ex-search-row">
      <input type="search" id="exerciseSearch" placeholder="دور باسم التمرين..." aria-label="بحث عن تمرين" autocomplete="off">
      <button type="button" class="fav-filter-btn" id="favFilterBtn" data-action="ex-toggle-fav-filter" aria-pressed="false">${icon("star")} المفضلة فقط</button>
      ${
        hasProfileEquipment()
          ? `<button type="button" class="fav-filter-btn" id="myEquipmentFilterBtn" data-action="ex-toggle-my-equipment" aria-pressed="false">${icon("wrench")} معداتي فقط</button>`
          : `<a class="fav-filter-btn" href="#profile" style="text-decoration:none;">${icon("wrench")} حدد معداتك في البروفايل</a>`
      }
      <button type="button" class="fav-filter-btn" id="clearFiltersBtn" data-action="ex-clear-filters">${icon("refresh")} مسح الفلاتر</button>
    </div>

    <div class="muscle-tile-grid" id="groupChipRow" role="group" aria-label="فلتر العضلة">${groupTiles}</div>
    <div class="top-note" id="groupNoteBox" hidden></div>

    <div class="ex-select-row">
      <select id="exEquipmentFilter" aria-label="فلتر المعدات">${equipmentOptions}</select>
      <select id="exDifficultyFilter" aria-label="فلتر مستوى الصعوبة">${difficultyOptions}</select>
    </div>

    <div id="exerciseListContainer">${renderExerciseList()}</div>
  `;
}

/* ---------------- FILTERING / LIST RENDER ---------------- */
function matchesFilters(ex) {
  try {
    if (filterState.selectedId && ex.id !== filterState.selectedId) return false;
    if (filterState.onlyFav && !(STATE.favorites && STATE.favorites[ex.id])) return false;
    if (filterState.onlyMyEquipment && !exerciseMatchesProfileEquipment(ex.equipment)) return false;
    if (filterState.group !== "all" && ex.group !== filterState.group) return false;
    if (filterState.equipment !== "all" && ex.equipment !== filterState.equipment) return false;
    if (filterState.difficulty !== "all" && ex.difficulty !== filterState.difficulty) return false;
    if (filterState.query) {
      const q = normalizeSearchText(filterState.query.trim());
      const hay = normalizeSearchText(`${ex.en} ${ex.ar} ${ex.primary}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  } catch (e) {
    console.error("Filter error for exercise " + ex.id, e);
    return true; // show it anyway
  }
}

function renderExerciseList() {
  const list = EXERCISES.filter(matchesFilters);
  if (list.length === 0) {
    return `<div class="rule-card"><p>مفيش تمارين مطابقة للفلاتر دي. جرب تغيّر البحث أو الفلاتر.</p></div>`;
  }
  return list.map((ex, i) => exerciseDetailCard("exdb-" + ex.id, i, ex)).join("");
}

function refreshExerciseList() {
  const container = document.getElementById("exerciseListContainer");
  if (container) container.innerHTML = renderExerciseList();
}

/* ---------------- CARD RENDERER ----------------
 * Mirrors ui.js's exCard visual structure/classes (ex-card/ex-head/
 * ex-body/chip-grid/tip/mistake) but adapted for reference-library
 * content (instructions/mistakes/tips lists + favorite star)
 * instead of trackable workout sets.
 */
function exerciseDetailCard(key, idx, ex) {
  const isFav = !!(STATE.favorites && STATE.favorites[ex.id]);
  const instructionsHtml = ex.instructions.length
    ? `<ol class="instr-list">${ex.instructions.map((s) => `<li>${s}</li>`).join("")}</ol>`
    : "";
  const mistakesHtml = ex.mistakes.length
    ? `<div class="mistake">${icon("alert-triangle")} <b>الأخطاء التي يجب تجنبها:</b><ul>${ex.mistakes.map((m) => `<li>${m}</li>`).join("")}</ul></div>`
    : "";
  const tipsHtml = ex.tips.length
    ? `<div class="tip">${icon("lightbulb")} <b>نصايح:</b><ul>${ex.tips.map((t) => `<li>${t}</li>`).join("")}</ul></div>`
    : "";

  // Quick-glance thumbnail: exercise library entries no longer carry a
  // per-exercise YouTube id (see exercises-data.js v1.3.2), so every card
  // gets the neutral muscle-group icon tile here instead of a thumbnail —
  // consistent for every entry, nothing fabricated/guessed.
  const thumbHtml = muscleIconSVG(ex.group);

  return `
  <div class="ex-card ex-card-visual" id="card-${key}">
    <div class="ex-head" role="button" tabindex="0" aria-expanded="false" aria-controls="body-${key}"
        data-action="toggle-card" data-key="${key}">
      <div class="ex-thumb" aria-hidden="true">${thumbHtml}</div>
      <div class="ex-titles">
        <div class="en">${ex.en}</div>
        <div class="ar">${ex.ar}</div>
        <div class="ex-quickmeta">${ex.primary || "—"} · ${EQUIPMENT_LABELS[ex.equipment] || ex.equipment}</div>
      </div>
      <button type="button" class="fav-star ${isFav ? "active" : ""}" data-action="ex-toggle-favorite" data-id="${ex.id}"
          aria-pressed="${isFav}" aria-label="أضف ${ex.en} للمفضلة">${icon("star")}</button>
      <span class="badge diff-${ex.difficulty}">${DIFF_LABELS[ex.difficulty] || ex.difficulty}</span>
      <span class="chevron" aria-hidden="true">▾</span>
    </div>
    <div class="ex-body" id="body-${key}">
      <div class="ex-body-inner">
        ${mediaHtml(ex)}
        <div class="link-row">
          ${tutorialLink(ex)}
          ${illustrationLink(ex)}
        </div>
        <div class="alt-row">
          <button type="button" class="alt-btn" data-action="alt-open" data-id="${ex.id}" aria-haspopup="dialog"
              aria-label="بدائل تمرين ${ex.en}">${icon("swap")} بدائل · Alternatives</button>
        </div>
        <div class="chip-grid">
          <div class="chip"><b>العضلة الأساسية</b>${ex.primary || "—"}</div>
          <div class="chip"><b>العضلات الثانوية</b>${ex.secondary || "—"}</div>
          <div class="chip"><b>المعدات</b>${EQUIPMENT_LABELS[ex.equipment] || ex.equipment}</div>
          <div class="chip"><b>المستوى</b>${DIFF_LABELS[ex.difficulty] || ex.difficulty}</div>
        </div>
        ${instructionsHtml ? `<div class="why"><b>${icon("clipboard")} طريقة الأداء الصحيحة:</b>${instructionsHtml}</div>` : ""}
        ${mistakesHtml}
        ${tipsHtml}
      </div>
    </div>
  </div>`;
}

/* ---------------- ACTIONS ---------------- */
export function toggleFavoriteExercise(id) {
  STATE.favorites = STATE.favorites || {};
  STATE.favorites[id] = !STATE.favorites[id];
  if (!STATE.favorites[id]) delete STATE.favorites[id];
  persist();
  // Re-render just the star button in place (avoids losing scroll position / open cards).
  document.querySelectorAll(`.fav-star[data-id="${id}"]`).forEach((btn) => {
    const active = !!STATE.favorites[id];
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
    btn.innerHTML = icon("star");
  });
  // If "favorites only" filter is on and this exercise just got un-favorited, refresh the list.
  if (filterState.onlyFav) refreshExerciseList();
}

export function toggleOnlyFavoritesFilter() {
  filterState.onlyFav = !filterState.onlyFav;
  const btn = document.getElementById("favFilterBtn");
  if (btn) {
    btn.classList.toggle("active", filterState.onlyFav);
    btn.setAttribute("aria-pressed", String(filterState.onlyFav));
  }
  refreshExerciseList();
}

/** "My Equipment" toggle — only reachable when the profile actually has
 * equipment selected (see the button's conditional render above), so
 * this never needs to handle an empty-profile case. */
export function toggleOnlyMyEquipmentFilter() {
  filterState.onlyMyEquipment = !filterState.onlyMyEquipment;
  const btn = document.getElementById("myEquipmentFilterBtn");
  if (btn) {
    btn.classList.toggle("active", filterState.onlyMyEquipment);
    btn.setAttribute("aria-pressed", String(filterState.onlyMyEquipment));
  }
  refreshExerciseList();
}

export function setExerciseFilter(type, value) {
  if (type === "group") {
    // Tapping the already-active muscle tile deselects it — with no tile
    // marked, the list automatically falls back to showing every muscle
    // group's exercises (no separate "All" tile needed).
    filterState.group = filterState.group === value ? "all" : value;
    document.querySelectorAll('#groupChipRow .filter-chip').forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.value === filterState.group);
    });
    updateGroupNoteBox();
  }
  refreshExerciseList();
}

/** Show the selected muscle group's short evidence-based intro (hidden for "all"). */
function updateGroupNoteBox() {
  const box = document.getElementById("groupNoteBox");
  if (!box) return;
  const g = MUSCLE_GROUPS.find((g) => g.key === filterState.group);
  if (g && g.note) {
    box.innerHTML = `${icon("microscope")} ${g.note}`;
    box.hidden = false;
  } else {
    box.hidden = true;
  }
}

export function clearExerciseFilters() {
  filterState.query = "";
  filterState.group = "all";
  filterState.equipment = "all";
  filterState.difficulty = "all";
  filterState.onlyFav = false;
  filterState.onlyMyEquipment = false;
  filterState.selectedId = null;

  // Update UI
  document.querySelectorAll('#groupChipRow .filter-chip').forEach((chip) => {
    chip.classList.remove("active");
  });
  document.getElementById("favFilterBtn")?.classList.remove("active");
  document.getElementById("myEquipmentFilterBtn")?.classList.remove("active");
  document.getElementById("exEquipmentFilter")?.setAttribute("value", "all");
  document.getElementById("exDifficultyFilter")?.setAttribute("value", "all");
  document.getElementById("exerciseSearch")?.setAttribute("value", "");

  updateGroupNoteBox();
  refreshExerciseList();
}

export function updateExerciseSearch(value) {
  filterState.query = value || "";
  refreshExerciseList();
}

export function viewExerciseById(id) {
  filterState.selectedId = id;
  filterState.query = "";
  filterState.group = "all";
  filterState.equipment = "all";
  filterState.difficulty = "all";
  refreshExerciseList();
}

export function updateExerciseSelectFilter(id, value) {
  if (id === "exEquipmentFilter") filterState.equipment = value;
  if (id === "exDifficultyFilter") filterState.difficulty = value;
  refreshExerciseList();
}

/** Re-apply select values on fresh render (selects reset to default option on innerHTML rebuild otherwise). */
export function hydrateExercisesUI() {
  const eq = document.getElementById("exEquipmentFilter");
  if (eq) eq.value = filterState.equipment;
  const diff = document.getElementById("exDifficultyFilter");
  if (diff) diff.value = filterState.difficulty;
  const search = document.getElementById("exerciseSearch");
  if (search) search.value = filterState.query;
  const favBtn = document.getElementById("favFilterBtn");
  if (favBtn) {
    favBtn.classList.toggle("active", filterState.onlyFav);
    favBtn.setAttribute("aria-pressed", String(filterState.onlyFav));
  }
  const myEqBtn = document.getElementById("myEquipmentFilterBtn");
  if (myEqBtn) {
    myEqBtn.classList.toggle("active", filterState.onlyMyEquipment);
    myEqBtn.setAttribute("aria-pressed", String(filterState.onlyMyEquipment));
  }
  updateGroupNoteBox();
}

/**
 * muscle-icons.js — Real muscle-diagram icons for the Exercise Library
 * ---------------------------------------------------------------
 * Replaces the old generic emoji (🎯 🔙 💪 ...) with small inline SVG
 * body-silhouette icons: a muted human outline with the actual target
 * muscle highlighted in the app's accent color — the same visual idea
 * used by MuscleWiki/MuscleAndStrength "muscle map" icons, just drawn
 * as a lightweight, dependency-free vector so it works fully offline
 * and themes correctly (currentColor outline + var(--accent) fill).
 *
 * Every icon shares one base humanoid silhouette (BODY_OUTLINE) so the
 * set reads as one consistent icon family; only the highlighted region
 * changes per muscle group.
 * ---------------------------------------------------------------
 */

// Shared body silhouette — head, neck, torso, arms, hips, legs.
// Drawn muted (stroke only, partial opacity) as the "map" the highlight sits on.
const BODY_OUTLINE = `
  <g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity=".32">
    <circle cx="30" cy="9" r="6"/>
    <rect x="27" y="14" width="6" height="6"/>
    <path d="M17,20 L43,20 L40,53 L20,53 Z"/>
    <rect x="8" y="20" width="7" height="33" rx="3.5"/>
    <rect x="45" y="20" width="7" height="33" rx="3.5"/>
    <path d="M20,53 L40,53 L43,61 L17,61 Z"/>
    <rect x="18" y="61" width="10" height="34" rx="4"/>
    <rect x="32" y="61" width="10" height="34" rx="4"/>
  </g>`;

// Highlighted region per muscle group, layered on top of BODY_OUTLINE.
const HIGHLIGHTS = {
  chest: `<ellipse cx="23" cy="27" rx="6" ry="5"/><ellipse cx="37" cy="27" rx="6" ry="5"/>`,

  back: `<path d="M18,21 L42,21 L39,50 Q30,55 21,50 Z"/>`,

  shoulders: `<circle cx="13" cy="23" r="6"/><circle cx="47" cy="23" r="6"/>`,

  biceps: `<ellipse cx="11.5" cy="28" rx="4.5" ry="7"/><ellipse cx="48.5" cy="28" rx="4.5" ry="7"/>`,

  triceps: `<path d="M14,26 L8,34 L14,42 Z"/><path d="M46,26 L52,34 L46,42 Z"/>`,

  forearms: `<rect x="8.5" y="42" width="6" height="10" rx="3"/><rect x="45.5" y="42" width="6" height="10" rx="3"/>`,

  quads: `<rect x="18.5" y="62" width="8" height="16" rx="3"/><rect x="32.5" y="62" width="8" height="16" rx="3"/>`,

  hamstrings: `<rect x="19" y="63" width="3" height="15" rx="1.5"/><rect x="24" y="63" width="3" height="15" rx="1.5"/>
    <rect x="33" y="63" width="3" height="15" rx="1.5"/><rect x="38" y="63" width="3" height="15" rx="1.5"/>`,

  glutes: `<path d="M18,54 L42,54 L44,61 L16,61 Z"/>`,

  calves: `<rect x="19" y="80" width="7" height="13" rx="3"/><rect x="33" y="80" width="7" height="13" rx="3"/>`,

  core: `<rect x="22" y="35" width="7" height="5" rx="1.5"/><rect x="31" y="35" width="7" height="5" rx="1.5"/>
    <rect x="22" y="41" width="7" height="5" rx="1.5"/><rect x="31" y="41" width="7" height="5" rx="1.5"/>
    <rect x="22" y="47" width="7" height="5" rx="1.5"/><rect x="31" y="47" width="7" height="5" rx="1.5"/>`,

  traps: `<path d="M30,14 L40,23 L30,32 L20,23 Z"/>`,
};

// Monotonic counter so every rendered icon gets a unique gradient id —
// SVG <defs> ids are global to the document, so two icons sharing one id
// (e.g. two exercise cards for the same muscle group) would otherwise
// silently reuse/break each other's gradient.
let uid = 0;

/**
 * Returns an inline SVG string for the given muscle-group key: the shared
 * body outline plus that group's highlighted region, filled with a small
 * energy-toned gradient (+ soft glow via CSS) instead of a flat color —
 * this is the app's one signature visual motif, reused everywhere a
 * muscle group needs representing (filter tiles, exercise-card thumbs),
 * so it's worth the extra bit of visual craft. Falls back to a plain
 * silhouette (no highlight) for unknown keys so callers never get nothing.
 */
export function muscleIconSVG(key) {
  const highlight = HIGHLIGHTS[key] || "";
  const gradId = `mi-grad-${key || "x"}-${uid++}`;
  return `<svg viewBox="0 0 60 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--energy-2)"/>
        <stop offset="100%" stop-color="var(--energy)"/>
      </linearGradient>
    </defs>
    ${BODY_OUTLINE}
    <g class="muscle-highlight" fill="url(#${gradId})" stroke="none">${highlight}</g>
  </svg>`;
}

export { HIGHLIGHTS };

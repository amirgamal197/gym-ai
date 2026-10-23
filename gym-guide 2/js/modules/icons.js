/**
 * icons.js — Lightweight inline SVG icon library
 * ---------------------------------------------------------------
 * Replaces every emoji used across the app's UI with a small,
 * dependency-free line-icon (24x24 viewBox, stroke="currentColor",
 * 1em sizing) so the interface looks consistent and themes correctly
 * regardless of OS/browser emoji font rendering.
 *
 * Usage:
 *   icon("check")                → default 1em inline icon
 *   icon("flame", { size: "1.2em", className: "dash-cta-icon" })
 *   colorDot("blue")              → small filled circle (status/legend dots)
 * ---------------------------------------------------------------
 */

// Each entry is the *inner* markup of a 24x24 viewBox SVG (paths/shapes only).
const ICONS = {
  // ---- status / feedback ----
  check: `<polyline points="20 6 9 17 4 12"/>`,
  "alert-triangle": `<path d="M12 2 1 21h22L12 2Z"/><line x1="12" y1="9" x2="12" y2="14"/><circle cx="12" cy="17.5" r=".6" fill="currentColor" stroke="none"/>`,
  "help-circle": `<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4"/><circle cx="12" cy="17.5" r=".6" fill="currentColor" stroke="none"/>`,
  ban: `<circle cx="12" cy="12" r="10"/><line x1="5.5" y1="5.5" x2="18.5" y2="18.5"/>`,

  // ---- search / nav ----
  search: `<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.2" y2="16.2"/>`,
  "arrow-left": `<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>`,
  "arrow-right": `<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>`,
  "arrow-up": `<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>`,
  "arrow-down": `<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>`,
  "skip-back": `<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>`,
  "skip-forward": `<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>`,
  swap: `<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>`,
  x: `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
  refresh: `<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.5 9a8.5 8.5 0 0 1 14.5-4.5L23 10M1 14l5-4.5A8.5 8.5 0 0 0 20.5 15"/>`,
  "wifi-off": `<line x1="2" y1="2" x2="22" y2="22"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.5a10 10 0 0 1 5-2.7M19 12.5a10 10 0 0 0-3-2.1"/><path d="M1.5 8.5a15 15 0 0 1 5-3"/><path d="M22.5 8.5a15 15 0 0 0-8-4.2"/><circle cx="12" cy="20" r=".6" fill="currentColor" stroke="none"/>`,

  // ---- fitness / body ----
  dumbbell: `<path d="M6 7v10M18 7v10"/><path d="M3 9v6M21 9v6"/><line x1="8" y1="12" x2="16" y2="12"/>`,
  muscle: `<path d="M4 15c0-4 2-6 4-6 1.3 0 1.7 1 3 1 1-3 3-4 5-4 3 0 5 3 4 6-.5 1.5-2 2-2 4v3H8l-1-2c-2 0-3-1-3-2Z"/>`,
  activity: `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`,
  target: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>`,
  footprints: `<path d="M8 4c1.4 0 2.4 1.4 2.4 3.2 0 1.6-.6 2.3-.6 3.6 0 1.5.9 1.9.9 3.4C10.7 15.9 9.5 17 8 17s-2.7-1.1-2.7-2.8c0-1.5.9-2 .9-3.4 0-1.3-.6-2-.6-3.6C5.6 5.4 6.6 4 8 4Z"/><path d="M17 9c1.4 0 2.4 1.4 2.4 3.2 0 1.6-.6 2.3-.6 3.6 0 1.5.9 1.9.9 3.4 0 1.7-1.2 2.8-2.7 2.8s-2.7-1.1-2.7-2.8c0-1.5.9-2 .9-3.4 0-1.3-.6-2-.6-3.6C14.6 10.4 15.6 9 17 9Z"/>`,
  meditate: `<circle cx="12" cy="6" r="2"/><path d="M12 8v4"/><path d="M4 19c1-3 4-4 4-4h8s3 1 4 4"/><path d="M8 15 5 11M16 15l3-4"/>`,
  stretch: `<circle cx="17" cy="5" r="2"/><path d="M17 7 12 12l2 8"/><path d="M12 12 6 9M12 12l6 3"/><path d="M14 20l4-2M10 20l-4-3"/>`,
  "person-standing": `<circle cx="12" cy="4" r="2"/><path d="M12 6v7"/><path d="M9 9h6"/><path d="M12 13 9 20M12 13l3 7"/>`,

  // ---- media / content ----
  camera: `<path d="M4 8h3l2-2h6l2 2h3v11H4Z"/><circle cx="12" cy="13.5" r="3.5"/>`,
  video: `<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10.5 22 7v10l-6-3.5Z"/>`,
  image: `<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5.5-5.5L4 20"/>`,
  clipboard: `<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3" rx="1"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="13" y2="18"/>`,
  book: `<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>`,
  file: `<path d="M6 2h9l5 5v15H6Z"/><polyline points="15 2 15 7 20 7"/>`,
  history: `<path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 9 8 9"/><polyline points="12 7 12 12 16 14"/>`,
  edit: `<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>`,
  trash: `<polyline points="3 6 5 6 21 6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>`,
  save: `<path d="M5 3h11l4 4v14H5Z"/><path d="M8 3v6h8V3"/><path d="M8 21v-7h8v7"/>`,

  // ---- misc UI ----
  calendar: `<rect x="3" y="4.5" width="18" height="16" rx="2"/><line x1="3" y1="9.5" x2="21" y2="9.5"/><line x1="8" y1="2.5" x2="8" y2="6.5"/><line x1="16" y1="2.5" x2="16" y2="6.5"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><polyline points="12 6.5 12 12 15.5 14"/>`,
  flame: `<path d="M12 2s5 4.5 5 9.5a5 5 0 0 1-10 0c0-1.5.8-2.6 1.5-3.5-.2 2 1 2.8 1 2.8-.4-2.5 1-4 1-6.3C10.5 3 12 2 12 2Z"/>`,
  droplet: `<path d="M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13Z"/>`,
  lock: `<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>`,
  moon: `<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>`,
  wrench: `<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-3 3-2-2Z"/>`,
  zap: `<polygon points="13 2 4 14 11 14 10 22 20 10 13 10 13 2"/>`,
  bowl: `<path d="M3 12h18a9 6 0 0 1-18 0Z"/><path d="M8 12c0-3 1.5-6 4-6s4 3 4 6"/>`,
  salad: `<path d="M3 13h18a9 6 0 0 1-18 0Z"/><path d="M8 13c0-3 1-5 2-6"/><path d="M12 13c1-4 3-6 5-7"/><circle cx="15" cy="4.5" r="1.5"/>`,
  meat: `<path d="M9.5 14.5 4 20"/><circle cx="13" cy="10" r="7"/><path d="M17 6c1.5 0 3 1 3 3s-1.5 3-3 3"/>`,
  bandage: `<rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-30 12 12)"/><circle cx="9.5" cy="10.5" r=".6" fill="currentColor" stroke="none"/><circle cx="14.5" cy="13.5" r=".6" fill="currentColor" stroke="none"/>`,
  chair: `<path d="M6 4v9a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V4"/><path d="M6 21v-5M18 21v-5"/><line x1="6" y1="10" x2="18" y2="10"/>`,
  wallet: `<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H3"/><circle cx="16" cy="13" r="1"/>`,
  scale: `<line x1="12" y1="3" x2="12" y2="21"/><path d="M5 7h14"/><path d="M5 7 2 14a3 3 0 0 0 6 0Z"/><path d="M19 7l-3 7a3 3 0 0 0 6 0Z"/>`,
  ruler: `<path d="M3 16 8 21 21 8 16 3Z"/><line x1="8.5" y1="8.5" x2="10.5" y2="10.5"/><line x1="11.5" y1="5.5" x2="13.5" y2="7.5"/><line x1="5.5" y1="11.5" x2="7.5" y2="13.5"/>`,
  "trending-up": `<polyline points="3 17 9 11 13 15 21 6"/><polyline points="15 6 21 6 21 12"/>`,
  "trending-down": `<polyline points="3 7 9 13 13 9 21 18"/><polyline points="15 18 21 18 21 12"/>`,
  lightbulb: `<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.7.5 1.1 1.3 1.1 2.1h4.8c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3Z"/>`,
  star: `<polygon points="12 2.5 15.1 8.8 22 9.8 17 14.7 18.2 21.5 12 18.3 5.8 21.5 7 14.7 2 9.8 8.9 8.8"/>`,
  microscope: `<path d="M5 21h10"/><path d="M8 21v-4a4 4 0 0 1 4-4h0"/><path d="M9 13V4l3-1 3 1"/><line x1="7" y1="7" x2="13" y2="7"/><circle cx="17" cy="17" r="3"/>`,
  dna: `<path d="M6 3c0 6 12 6 12 12"/><path d="M6 21c0-6 12-6 12-12"/><line x1="7" y1="7" x2="17" y2="7"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="7" y1="17" x2="17" y2="17"/>`,
  pill: `<rect x="3" y="10.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)"/><line x1="9" y1="9" x2="15" y2="15"/>`,
  party: `<path d="M4 21 14 11"/><path d="M13.5 3.5 15 6M18 5l1 2.5M20.5 8.5 22 10"/><path d="M4 21 2.5 15.5 9 13l-1.5 3Z"/><path d="M4 21 8.5 19.5 6 13Z"/>`,
  "hand-wave": `<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5"/><path d="M11 11V4a1.5 1.5 0 0 1 3 0v7"/><path d="M14 11V6a1.5 1.5 0 0 1 3 0v7"/><path d="M17 12V9a1.5 1.5 0 0 1 3 0v6c0 3.5-2.5 6-6 6h-2c-2.5 0-4-1-5.5-3L4 15.5c-.6-.9-.2-2 .8-2.2.6-.1 1.2.1 1.6.6L8 16"/>`,
};

/**
 * Returns an inline <svg> string for the given icon name.
 * @param {string} name - icon key from ICONS
 * @param {{size?: string, className?: string}} [opts]
 */
export function icon(name, opts = {}) {
  const { size = "1em", className = "" } = opts;
  const body = ICONS[name];
  if (!body) {
    console.warn(`[icons] unknown icon "${name}"`);
  }
  const cls = className ? ` icon ${className}` : " icon";
  return `<svg class="${cls.trim()}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.125em;flex-shrink:0" aria-hidden="true">${body || ICONS["help-circle"]}</svg>`;
}

// Named colors used by small status/legend dots (injury body-map, etc.)
// Mapped to the app's existing CSS custom properties where possible so
// dots stay on-theme automatically.
const DOT_COLORS = {
  blue: "var(--blue)",
  green: "var(--green)",
  orange: "var(--accent)",
  amber: "var(--accent2)",
  red: "var(--red)",
  purple: "#b07cf0",
  white: "#e8eaed",
  muted: "var(--muted)",
};

/**
 * Returns a small inline filled circle (<span>) for use as a color-coded
 * status dot — replacement for emoji like 🔵🟢🟠🟣⚪.
 * @param {string} colorKey - key from DOT_COLORS (falls back to raw CSS color if unknown)
 * @param {{size?: string}} [opts]
 */
export function colorDot(colorKey, opts = {}) {
  const { size = "0.65em" } = opts;
  const color = DOT_COLORS[colorKey] || colorKey;
  return `<span class="color-dot" style="display:inline-block;width:${size};height:${size};border-radius:50%;background:${color};vertical-align:middle;flex-shrink:0" aria-hidden="true"></span>`;
}

export { ICONS, DOT_COLORS };

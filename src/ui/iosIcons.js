import { svg } from "lit-html";

// Shared decorative icons from docs/UI_STYLE_GUIDE.md §5.
const tilePaths = {
  o_struct: svg`<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8.5 8.5l3.5 7 3.5-7"/>`,
  o_tex: svg`<path d="M4 7h16" stroke-width="1.4"/><path d="M4 12h16" stroke-width="2.4"/><path d="M4 17.5h16" stroke-width="3.6"/>`,
  o_loop: svg`<path d="M3 15l12-12 6 6-12 12z"/><path d="M8 10l2 2M11 7l2 2M5 13l2 2"/>`,
  o_more: svg`<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>`,
  o_prec: svg`<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>`,
  o_res: svg`<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>`,
  o_density: svg`<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>`,
  o_diameter: svg`<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/>`,
  o_modulus: svg`<path d="M12 3v3M12 18v3"/><path d="M7 6h10L7 9h10L7 12h10L7 15h10l-10 3h10"/>`,
  o_compress: svg`<path d="M4 12h16"/><path d="M12 3v6M9 6l3 3 3-3M12 21v-6M9 18l3-3 3 3"/>`,
  o_packing: svg`<circle cx="12" cy="12" r="8"/><path d="M12 4v8h8"/><path d="M12 12L6.5 17.5"/>`,
  o_calc: svg`<path d="M8 5l11 7-11 7z" fill="#fff"/>`,
  o_recalc: svg`<path d="M19 12a7 7 0 1 1-2-4.9"/><path d="M19 4v4h-4"/>`,
  b_yarn: svg`<path d="M7 4h10M7 20h10"/><rect x="8" y="6" width="8" height="12" rx="2"/><path d="M8 9l8 3M8 13l8 3"/>`,
  b_fuzz: svg`<path d="M3 15h18"/><path d="M6 15l-1.5-5M10 15l1-6M14 15l-1-5M18 15l1.5-6M8 15l-2 4M16 15l2 4"/>`,
  b_src: svg`<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M8 6c5 0 4 6 8 6M8 18c5 0 4-6 8-6"/>`,
  b_dice: svg`<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="#fff"/><circle cx="12" cy="12" r="1.2" fill="#fff"/><circle cx="15.5" cy="15.5" r="1.2" fill="#fff"/>`,
  b_more: svg`<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>`,
  b_hairiness: svg`<path d="M3 18h18"/><path d="M6 18V10M9.5 18V7M13 18v-9M16.5 18V7M20 18v-6"/>`,
  b_hairlen: svg`<path d="M3 18h12"/><path d="M6 18l6-11"/><path d="M18 6v12M16 6h4M16 18h4"/>`,
  b_angle: svg`<path d="M3 18h18"/><path d="M5 18L17 7"/><path d="M11 18a6 6 0 0 0-1.6-4.2"/>`,
  b_curl: svg`<path d="M3 18h5c0-5 3-8 6-8s4 3 2 5-5 0-3-4 6-5 8-3"/>`,
  b_opacity: svg`<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="#fff"/>`,
  b_halo: svg`<circle cx="12" cy="12" r="3.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>`,
  b_halowidth: svg`<path d="M3 12h18"/><path d="M12 9V3.5M9.5 6L12 3.5 14.5 6M12 15v5.5M9.5 18l2.5 2.5 2.5-2.5"/>`,
  b_normal: svg`<path d="M12 20V5M8 9l4-4 4 4"/><path d="M4 20h16"/>`,
  b_band: svg`<path d="M3 12h18"/><path d="M6 5v14M18 5v14" stroke-dasharray="2 2"/>`,
  g_face: svg`<path d="M4 6l4 12 4-12M12 6l4 12 4-12"/>`,
  g_back: svg`<path d="M3 11a4.5 4.5 0 0 1 9 0M12 11a4.5 4.5 0 0 1 9 0M7.5 18a4.5 4.5 0 0 1 9 0"/>`,
  g_strand: svg`<path d="M3 12c3-4 6 4 9 0s6 4 9 0"/>`,
  g_tile: svg`<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>`,
  g_info: svg`<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>`,
  g_warn: svg`<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>`,
  e_fabric: svg`<path d="M4 4h7v7H4zM13 4h7v7h-7z"/><path d="M12 13v8M8.5 17.5L12 21l3.5-3.5"/>`,
  e_yarn: svg`<path d="M3 8c3-3 6 3 9 0s6 3 9 0"/><path d="M12 12v9M8.5 17.5L12 21l3.5-3.5"/>`,
  e_repeat: svg`<rect x="4" y="4" width="7" height="7" rx="1"/><path d="M14 7.5h6M17.5 5l2.5 2.5-2.5 2.5M7.5 14v6M5 17.5l2.5 2.5 2.5-2.5"/>`,
  e_len: svg`<path d="M3 8c3-3 6 3 9 0s6 3 9 0"/><path d="M3 16h18M3 13.5v5M21 13.5v5"/>`,
  r_stop: svg`<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="#fff"/>`,
  r_reset: svg`<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>`,
};

const tileColors = {
  o: "#C75F00", b: "#0066D6", g: "#7C7C82", e: "#248A3D", r: "#D70015",
};

export function iconTile(name) {
  return svg`<svg class="ios-icon-tile" width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
    <rect width="28" height="28" rx="7" fill=${tileColors[name[0]]} />
    <g transform="translate(4.4 4.4) scale(0.8)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${tilePaths[name]}</g>
  </svg>`;
}

const glyphPaths = {
  face: svg`<path d="M4 6l4 12 4-12M12 6l4 12 4-12"/>`,
  back: svg`<path d="M3 11a4.5 4.5 0 0 1 9 0M12 11a4.5 4.5 0 0 1 9 0M7.5 18a4.5 4.5 0 0 1 9 0"/>`,
  strand: svg`<path d="M3 12c3-4 6 4 9 0s6 4 9 0"/>`,
  tile: svg`<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>`,
  recalc: svg`<path d="M19 12a7 7 0 1 1-2-4.9"/><path d="M19 4v4h-4"/>`,
  fabric: svg`<path d="M4 4h7v7H4zM13 4h7v7h-7z"/><path d="M12 13v8M8.5 17.5L12 21l3.5-3.5"/>`,
  yarn: svg`<path d="M3 8c3-3 6 3 9 0s6 3 9 0"/><path d="M12 12v9M8.5 17.5L12 21l3.5-3.5"/>`,
  info: svg`<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>`,
  warn: svg`<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>`,
  fuzzLow: svg`<path d="M3 15h18M9 15l-1-5M15 15l1-5"/>`,
  fuzzMedium: svg`<path d="M3 15h18M6 15l-1-5M10 15l1-6M14 15l-1-5M18 15l1-6"/>`,
  fuzzHigh: svg`<path d="M3 14h18M5 14l-1.5-6M8 14l1-7M11 14l-1-6M14 14l1-7M17 14l-1-6M20 14l1.5-6M7 14l-2 5M13 14l1 5M18 14l2 5"/>`,
  calc: svg`<path d="M7 4l13 8-13 8z" fill="currentColor"/>`,
  stop: svg`<rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor"/>`,
  more: svg`<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>`,
  menu: svg`<path d="M1.5 5l3-3 3 3M1.5 9l3 3 3-3"/>`,
  chevron: svg`<path d="M1.5 1.5l5 5-5 5"/>`,
  check: svg`<path d="M5 12l4.5 4.5L19 7"/>`,
  spinner: svg`<path d="M12 3a9 9 0 1 0 9 9"/>`,
  empty: svg`<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M6 8l3 8 3-8 3 8 3-8"/>`,
};

export function glyph(name, size = 15) {
  const key = name === "calculate" ? "calc" : name === "recalculate" ? "recalc" : name;
  const width = key === "menu" ? 9 : key === "chevron" ? 8 : size;
  const height = key === "menu" ? 14 : key === "chevron" ? 13 : size;
  const viewBox = key === "menu" ? "0 0 9 14" : key === "chevron" ? "0 0 8 13" : "0 0 24 24";
  return svg`<svg class="ios-glyph" width=${width} height=${height} viewBox=${viewBox} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyphPaths[key]}</svg>`;
}

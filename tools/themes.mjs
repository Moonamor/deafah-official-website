// Single source of the 8 themes (4 palettes × light / dark). Generates:
//   1. the token blocks in frontend/src/styles/site.css   (between  /* @themes:start */  and  /* @themes:end */)
//   2. reference/anjum/THEME_SPEC.md                         (every token, its source, contrast against every surface it sits on)
//   3. CONTRAST_REPORT.md                                    (pass / fail table used by `npm run qa`)
// Rules (owner brief, Part B2): small text ≥ 4.5:1 (target 7), display text / icons / outlines / focus ≥ 3:1, no grey.
// When a reference colour fails, `pass()` keeps its hue and moves its lightness to the closest shade that passes;
// every such substitution is logged. Usage: node tools/themes.mjs [--check]   (--check: exit 1 on any failure, no writes)
import { readFileSync, writeFileSync } from "node:fs";

/* ---------------------------------------------------------------- colour maths (WCAG 2.x) */
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (r) => "#" + r.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
const lum = (h) => { const [r, g, b] = hex2rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function rgb2hsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
function hsl2rgb([h, s, l]) { if (!s) return [l, l, l].map((v) => v * 255); const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => v * 255); }
/** closest shade of `hex` (same hue, same saturation) whose contrast with every bg in `bgs` is ≥ min */
export function pass(hex, bgs, min) {
  bgs = [].concat(bgs);
  if (bgs.every((b) => ratio(hex, b) >= min)) return hex;
  const [h, s, l] = rgb2hsl(hex2rgb(hex));
  const darkBg = bgs.every((b) => lum(b) < 0.18);
  for (let i = 1; i <= 100; i++) {
    const nl = darkBg ? Math.min(1, l + i / 100) : Math.max(0, l - i / 100);
    const c = rgb2hex(hsl2rgb([h, s, nl]));
    if (bgs.every((b) => ratio(c, b) >= min)) return c;
  }
  return darkBg ? "#FFFFFF" : "#000000";
}

/* ---------------------------------------------------------------- brand palette (Manual p.14 + web set) */
const B = {
  black: "#101820", deep: "#0C141C", card: "#1C242E", gold: "#D29F13", goldDark: "#8E732A", warm: "#F5F2EE", white: "#FFFFFF",
  navy: "#0E4174", navyDark: "#0B3560", blue: "#008BC4", sky: "#98D0E8",
  green: "#13322B", greenCard: "#1C4238", sage: "#8DAE81",
  red: "#C10016", redDark: "#A3000F", beige: "#E1B87F",
};
const SMALL = 4.5, TARGET = 7, LARGE = 3;
const subs = [];   // substitution log
function sub(theme, element, ref, bgs, min) { const out = pass(ref, bgs, min); if (out !== ref) subs.push({ theme, element, ref, final: out, bg: [].concat(bgs)[0], before: ratio(ref, [].concat(bgs)[0]), after: ratio(out, [].concat(bgs)[0]) }); return out; }

/* ---------------------------------------------------------------- the 8 themes
   surface = content band; raised = alternate band + cards in dark mode; card = card fill
   panel   = header / hero / separators / footer bands (light modes keep the panel composition of the references)
   *-ink   = small text (≥ 4.5, target 7); *-display = ≥ 24 px or ≥ 18.66 px bold (≥ 3)                         */
function theme(id, d) { return { id, ...d }; }
const T = [];

/* DEFAULT · LIGHT — refs: default-light-announcement.png, default-light-ramadan.png */
T.push(theme("default-light", {
  scheme: "light", source: "default-light-announcement / default-light-ramadan",
  surface: B.warm, raised: B.white, card: B.white, ink: B.black,
  muted: sub("default-light", "secondary text", B.black, [B.warm, B.white], TARGET),           // ink, never grey
  accent: B.gold, "on-accent": B.black,                                                       // gold button, black label (ref)
  "accent-ink": B.black,                                                                      // gold small text fails (2.16) → ink (brief)
  "accent-display": B.goldDark,                                                               // gold display fails → #8E732A (brief)
  border: B.goldDark, focus: B.goldDark,                                                      // gold outline fails 3:1 on warm → #8E732A
  panel: B.black, "panel-deep": B.deep, "on-panel": B.white,
  "panel-muted": sub("default-light", "secondary text on panel", "#F5F2EE", [B.black, B.deep], TARGET),
  "panel-accent": B.gold, "on-panel-accent": B.black, "panel-accent-ink": B.gold, "panel-accent-display": B.gold,
  "panel-border": B.gold, "pattern-ink": B.gold, "pattern-ink-surface": B.gold,
  "theme-dot": B.gold, shadow: "16 24 32", logo: "neg",
}));
/* DEFAULT · DARK — refs: default-dark-announcement.png, default-dark-ramadan.png */
T.push(theme("default-dark", {
  scheme: "dark", source: "default-dark-announcement / default-dark-ramadan",
  surface: B.black, raised: B.card, card: B.card, ink: B.white,
  muted: sub("default-dark", "secondary text", "#F5F2EE", [B.black, B.card], TARGET),         // warm off-white
  accent: B.gold, "on-accent": B.black, "accent-ink": B.gold, "accent-display": B.gold,
  border: B.gold, focus: B.gold,
  panel: B.deep, "panel-deep": B.deep, "on-panel": B.white,
  "panel-muted": sub("default-dark", "secondary text on panel", "#F5F2EE", [B.deep], TARGET),
  "panel-accent": B.gold, "on-panel-accent": B.black, "panel-accent-ink": B.gold, "panel-accent-display": B.gold,
  "panel-border": B.gold, "pattern-ink": B.gold, "pattern-ink-surface": B.gold,
  "theme-dot": B.gold, shadow: "0 0 0", logo: "neg",
}));
/* BLUE · LIGHT — refs: blue-light-announcement.png, blue-light-ramadan.png */
T.push(theme("blue-light", {
  scheme: "light", source: "blue-light-announcement / blue-light-ramadan",
  surface: B.white, raised: sub("blue-light", "raised band (sky tint)", "#EEF6FB", [B.white], 1), card: B.white, ink: B.navy,
  muted: B.navy,                                                                              // navy, never grey
  accent: B.navy, "on-accent": B.white,                                                       // navy button, white label (ref)
  "accent-ink": B.navy, "accent-display": B.blue,                                             // #008BC4 display on white = 3.83
  border: B.blue, focus: B.navy,                                                              // chips: #008BC4 outline (ref), navy label
  panel: B.navy, "panel-deep": B.navyDark, "on-panel": B.white,
  "panel-muted": sub("blue-light", "secondary text on panel", "#E6F1F8", [B.navy, B.navyDark], TARGET),
  "panel-accent": B.sky, "on-panel-accent": B.navyDark,                                       // #008BC4 fill + white label fails → sky fill
  "panel-accent-ink": B.sky, "panel-accent-display": B.sky,                                   // #008BC4 on navy = 2.71 → sky
  "panel-border": B.sky, "pattern-ink": B.white, "pattern-ink-surface": B.sky,
  "theme-dot": B.blue, shadow: "14 65 116", logo: "white",
}));
/* BLUE · DARK — refs: blue-dark-announcement.png, blue-dark-ramadan.png */
T.push(theme("blue-dark", {
  scheme: "dark", source: "blue-dark-announcement / blue-dark-ramadan",
  surface: B.navyDark, raised: B.navy, card: B.navy, ink: B.white,
  muted: sub("blue-dark", "secondary text", "#E6F1F8", [B.navyDark, B.navy], TARGET),        // pale blue-white
  accent: B.sky, "on-accent": B.navyDark,                                                     // ref #008BC4 + white label (3.83) → sky + navy
  "accent-ink": B.sky, "accent-display": B.blue,                                              // #008BC4 display on #0B3560 = 3.24
  border: B.sky, focus: B.sky,                                                                // #008BC4 outline on #0E4174 = 2.71 → sky
  panel: B.navy, "panel-deep": B.navyDark, "on-panel": B.white,
  "panel-muted": sub("blue-dark", "secondary text on panel", "#E6F1F8", [B.navy], TARGET),
  "panel-accent": B.sky, "on-panel-accent": B.navyDark, "panel-accent-ink": B.sky, "panel-accent-display": B.sky,
  "panel-border": B.sky, "pattern-ink": B.white, "pattern-ink-surface": B.white,
  "theme-dot": B.blue, shadow: "0 0 0", logo: "white",
}));
/* RED · LIGHT — no reference: Blue structure, red palette (dark red panel, white surface, beige accent) */
T.push(theme("red-light", {
  scheme: "light", source: "structure of blue-light; palette Manual p.14",
  surface: B.white, raised: sub("red-light", "raised band", "#F5F2EE", [B.white], 1), card: B.white, ink: B.black,
  muted: sub("red-light", "secondary text", B.red, [B.white, B.warm], TARGET),                // red-tinted shade, never grey
  accent: B.red, "on-accent": B.white, "accent-ink": sub("red-light", "accent small text", B.red, [B.white, B.warm], SMALL), "accent-display": B.red,
  border: B.red, focus: B.red,
  panel: B.red, "panel-deep": B.redDark, "on-panel": B.white,
  "panel-muted": B.white,                                                                     // no lighter tint passes on red → white
  "panel-accent": B.beige, "on-panel-accent": B.black, "panel-accent-ink": B.white, "panel-accent-display": B.white,
  "panel-border": B.beige, "pattern-ink": B.white, "pattern-ink-surface": "transparent",
  "theme-dot": B.beige, shadow: "163 0 15", logo: "white",
}));
/* RED · DARK */
T.push(theme("red-dark", {
  scheme: "dark", source: "structure of blue-dark; palette Manual p.14",
  surface: B.redDark, raised: B.red, card: B.red, ink: B.white,
  muted: B.white,
  accent: B.beige, "on-accent": B.black, "accent-ink": B.white, "accent-display": sub("red-dark", "accent display", B.beige, [B.redDark], LARGE),
  border: B.beige, focus: B.white,
  panel: B.red, "panel-deep": B.redDark, "on-panel": B.white, "panel-muted": B.white,
  "panel-accent": B.beige, "on-panel-accent": B.black, "panel-accent-ink": B.white, "panel-accent-display": B.white,
  "panel-border": B.beige, "pattern-ink": B.white, "pattern-ink-surface": B.white,
  "theme-dot": B.beige, shadow: "0 0 0", logo: "white",
}));
/* GREEN · LIGHT — no reference: Default structure, green palette (logo stays as today: NEG) */
T.push(theme("green-light", {
  scheme: "light", source: "structure of default-light; palette Manual p.14",
  surface: B.warm, raised: B.white, card: B.white, ink: B.green,
  muted: B.green,
  accent: B.green, "on-accent": B.white, "accent-ink": B.green, "accent-display": B.green,
  border: sub("green-light", "chip outline (sage)", B.sage, [B.warm, B.white], LARGE), focus: B.green,
  panel: B.green, "panel-deep": B.green, "on-panel": B.white,
  "panel-muted": sub("green-light", "secondary text on panel", "#EEF3EC", [B.green], TARGET),
  "panel-accent": B.sage, "on-panel-accent": B.black, "panel-accent-ink": B.sage, "panel-accent-display": B.sage,
  "panel-border": B.sage, "pattern-ink": B.gold, "pattern-ink-surface": B.gold,
  "theme-dot": B.sage, shadow: "19 50 43", logo: "neg",
}));
/* GREEN · DARK */
T.push(theme("green-dark", {
  scheme: "dark", source: "structure of default-dark; palette Manual p.14",
  surface: B.green, raised: B.greenCard, card: B.greenCard, ink: B.white,
  muted: sub("green-dark", "secondary text", "#EEF3EC", [B.green, B.greenCard], TARGET),
  accent: B.sage, "on-accent": B.black, "accent-ink": sub("green-dark", "accent small text", B.sage, [B.green, B.greenCard], SMALL), "accent-display": B.sage,
  border: B.sage, focus: B.sage,
  panel: B.green, "panel-deep": B.green, "on-panel": B.white,
  "panel-muted": sub("green-dark", "secondary text on panel", "#EEF3EC", [B.green], TARGET),
  "panel-accent": B.sage, "on-panel-accent": B.black, "panel-accent-ink": B.sage, "panel-accent-display": B.sage,
  "panel-border": B.sage, "pattern-ink": B.gold, "pattern-ink-surface": B.gold,
  "theme-dot": B.sage, shadow: "0 0 0", logo: "neg",
}));

/* ---------------------------------------------------------------- required pairs (fg token, bg tokens, minimum, kind) */
const PAIRS = [
  ["ink", ["surface", "raised", "card"], SMALL, "body text"],
  ["muted", ["surface", "raised", "card"], SMALL, "secondary text"],
  ["accent-ink", ["surface", "raised", "card"], SMALL, "accent small text / links / labels"],
  ["accent-display", ["surface"], LARGE, "accent display text (≥ 24 px)"],
  ["on-accent", ["accent"], SMALL, "primary button label"],
  ["border", ["surface", "raised", "card"], LARGE, "chip / input / card outline"],
  ["focus", ["surface", "raised", "card"], LARGE, "focus ring"],
  ["on-panel", ["panel", "panel-deep"], SMALL, "text on panel"],
  ["panel-muted", ["panel", "panel-deep"], SMALL, "secondary text on panel"],
  ["panel-accent-ink", ["panel", "panel-deep"], SMALL, "accent small text on panel"],
  ["panel-accent-display", ["panel", "panel-deep"], LARGE, "accent display on panel"],
  ["on-panel-accent", ["panel-accent"], SMALL, "button label on panel"],
  ["panel-accent", ["panel"], LARGE, "button fill on panel"],
  ["panel-border", ["panel", "panel-deep"], LARGE, "outline / rule on panel"],
];
const TOKENS = ["surface", "raised", "card", "ink", "muted", "accent", "on-accent", "accent-ink", "accent-display", "border", "focus", "panel", "panel-deep", "on-panel", "panel-muted", "panel-accent", "on-panel-accent", "panel-accent-ink", "panel-accent-display", "panel-border", "pattern-ink", "pattern-ink-surface", "theme-dot"];

const results = [];
for (const t of T) for (const [fg, bgs, min, kind] of PAIRS) for (const bg of bgs) {
  const r = ratio(t[fg], t[bg]);
  results.push({ theme: t.id, fg, bg, fgHex: t[fg], bgHex: t[bg], ratio: r, min, kind, ok: r >= min - 1e-9, target: min === SMALL ? r >= TARGET : true });
}
const fails = results.filter((r) => !r.ok);

/* ---------------------------------------------------------------- outputs */
function css() {
  const sel = (t) => { const [p, s] = t.id.split("-"); return p === "default" ? (s === "light" ? ':root, :root[data-scheme="light"]' : ':root[data-scheme="dark"]') : `:root[data-theme="${p}"][data-scheme="${s}"], :root[data-theme="${p}"]${s === "light" ? ':not([data-scheme="dark"])' : '[data-scheme="dark"]'}`; };
  const block = (t) => `${sel(t)} {\n  /* ${t.id.toUpperCase()} — ${t.source} */\n` + TOKENS.map((k) => `  --${k}: ${t[k]};`).join("\n") +
    `\n  --accent-soft: ${t.accent};\n  --panel-accent-soft: ${t["panel-accent"]};\n  --pattern-opacity: 1;\n  --shadow-tint: ${t.shadow};\n  --logo-variant: ${t.logo};\n  color-scheme: ${t.scheme};\n}`;
  return T.map(block).join("\n");
}
function md() {
  const f = (x) => x.toFixed(2);
  let s = `# THEME_SPEC — 8 themes (generated by \`tools/themes.mjs\`; do not edit by hand)\n\nSources: \`reference/theme-references/*.png\` sampled with \`tools/sample_theme_refs.py\` (exact-colour histograms of solid interiors; ink of thin strokes = median of the 8 % of pixels furthest from the background). Red and Green have no reference: Blue / Default structure with the Manual p.14 palette.\n\nButton fills are not measured against the page: WCAG 1.4.11 does not require a control fill to contrast with its background when the text label identifies the control; every label is measured (on-accent on accent). The Default light gold button on #F5F2EE (2.16:1 fill, label 7.42:1) is the reference design.

Rules: small text ≥ 4.5:1 (target ≥ 7), display text (≥ 24 px or ≥ 18.66 px bold), icons, outlines and focus rings ≥ 3:1. No grey: secondary text is a theme-tinted colour. Pattern ink is decorative (exempt).\n\n**Result: ${results.length} pairs measured, ${fails.length} failures.**\n\n`;
  s += `## Button choice for #008BC4 fills (B2)\n\nWhite label on #008BC4 = ${f(ratio(B.white, B.blue))}:1 fails for normal-size labels. Chosen everywhere a #008BC4 fill would appear (Blue dark mode, buttons on navy panels): **sky #98D0E8 fill with #0B3560 label = ${f(ratio(B.navyDark, B.sky))}:1**. Blue light content keeps the reference navy button with a white label (${f(ratio(B.white, B.navy))}:1).\n\n`;
  s += `## Colour-substitution log\n\n| Theme | Element | Reference | Final | Ratio before | Ratio after | Against |\n|---|---|---|---|---|---|---|\n`;
  const manual = [
    ["default-light", "gold small text", B.gold, B.black, B.warm], ["default-light", "gold display text", B.gold, B.goldDark, B.warm], ["default-light", "gold chip outline", B.gold, B.goldDark, B.warm],
    ["blue-light", "#008BC4 small text on white", B.blue, B.navy, B.white], ["blue-light", "#008BC4 text on navy panel", B.blue, B.sky, B.navy], ["blue-light", "#008BC4 button on navy panel (white label)", B.blue, B.sky, B.navy],
    ["blue-dark", "#008BC4 small text on #0B3560", B.blue, B.sky, B.navyDark], ["blue-dark", "#008BC4 button + white label", B.blue, B.sky, B.navyDark], ["blue-dark", "#008BC4 chip outline on #0E4174", B.blue, B.sky, B.navy],
    ["red-light", "beige accent text on red panel", B.beige, B.white, B.red], ["red-dark", "beige accent small text", B.beige, B.white, B.redDark],
    ["green-dark", "secondary/grey text", "#B6ADA5", "(theme tint)", B.green],
  ];
  for (const [th, el, ref, fin, bg] of manual) s += `| ${th} | ${el} | ${ref} | ${fin} | ${f(ratio(ref, bg))} | ${fin.startsWith("#") ? f(ratio(fin, bg)) : "—"} | ${bg} |\n`;
  for (const x of subs) s += `| ${x.theme} | ${x.element} (derived shade) | ${x.ref} | ${x.final} | ${f(x.before)} | ${f(x.after)} | ${x.bg} |\n`;
  for (const t of T) {
    s += `\n## ${t.id}  \n*Source:* ${t.source} · *logo:* ${t.logo === "white" ? "WHITE master" : "NEG master (gold symbol, white name)"} · *pattern:* ${t["pattern-ink"]} on panels, ${t["pattern-ink-surface"]} on surfaces\n\n| Token | Value | Contrast (against) |\n|---|---|---|\n`;
    for (const k of TOKENS) {
      const rs = results.filter((r) => r.theme === t.id && r.fg === k).map((r) => `${f(r.ratio)} on ${r.bg}${r.ok ? "" : " **FAIL**"}`).join(", ");
      s += `| \`--${k}\` | ${t[k]} | ${rs || (k.startsWith("pattern") ? "decorative (exempt)" : "surface / fill")} |\n`;
    }
  }
  return s;
}
function report() {
  let s = `# CONTRAST_REPORT (generated by \`tools/themes.mjs\`)\n\n${results.length} pairs, ${fails.length} failures, ${results.filter((r) => r.min === SMALL && !r.target).length} small-text pairs between 4.5 and the 7:1 target.\n\n| Theme | Pair | Ratio | Minimum | Result |\n|---|---|---|---|---|\n`;
  for (const r of results) s += `| ${r.theme} | ${r.fg} (${r.fgHex}) on ${r.bg} (${r.bgHex}) — ${r.kind} | ${r.ratio.toFixed(2)} | ${r.min} | ${r.ok ? (r.target ? "pass" : "pass (< 7)") : "FAIL"} |\n`;
  return s;
}

if (process.argv.includes("--check")) {
  console.log(`themes: ${results.length} pairs, ${fails.length} failures`);
  fails.forEach((r) => console.log(`  FAIL ${r.theme} ${r.fg} ${r.fgHex} on ${r.bg} ${r.bgHex} = ${r.ratio.toFixed(2)} < ${r.min}`));
  process.exit(fails.length ? 1 : 0);
}
const cssPath = "frontend/src/styles/site.css";
let src = readFileSync(cssPath, "utf8");
const start = "/* @themes:start (generated by tools/themes.mjs) */", end = "/* @themes:end */";
if (!src.includes(start)) throw new Error("site.css has no @themes markers");
src = src.replace(new RegExp(start.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&") + "[\\s\\S]*?" + end.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")), `${start}\n${css()}\n${end}`);
writeFileSync(cssPath, src);
writeFileSync("reference/anjum/THEME_SPEC.md", md());
writeFileSync("CONTRAST_REPORT.md", report());
console.log(`themes: ${T.length} themes, ${results.length} pairs, ${fails.length} failures, ${subs.length} derived shades → site.css, THEME_SPEC.md, CONTRAST_REPORT.md`);
fails.forEach((r) => console.log(`  FAIL ${r.theme} ${r.fg} ${r.fgHex} on ${r.bg} ${r.bgHex} = ${r.ratio.toFixed(2)} < ${r.min}`));
if (fails.length) process.exitCode = 1;

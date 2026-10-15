# Vendored runtime libraries (no CDN at runtime)

| file | package | version | licence | notes |
|---|---|---|---|---|
| `gsap/gsap.min.js`, `gsap/ScrollTrigger.min.js`, `gsap/SplitText.min.js` | gsap | 3.15.0 | GSAP Standard "no charge" licence (https://gsap.com/standard-license) — since GSAP 3.13 every plugin, SplitText included, is free for all uses including commercial | file headers carry the licence notice |
| `lenis/lenis.min.js` | lenis | 1.3.26 | MIT (`lenis/LICENSE`) | smooth scroll |
| `three.min.js` | three (core + examples/jsm/controls/OrbitControls) | 0.186.1 | MIT (`THREE-LICENSE`) | built by `npm run build:three` (esbuild, ESM, tree-shaken) from `src/js/three-entry.js`; committed like `dist/site.css` |
| `emailjs/email.min.js` | @emailjs/browser | 4.4.1 | BSD-3-Clause | existing contact-form dependency, vendored to keep the no-CDN rule |

Update versions here when `package.json` changes; copy the files from `node_modules` (or rebuild three) — never edit them by hand.

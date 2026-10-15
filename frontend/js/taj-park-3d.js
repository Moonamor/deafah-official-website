/* Al Deafah — Taj Park Hotel, procedural 3D (Phase 5). ES module, loaded lazily by js/taj-park-3d-loader.js.
   Geometry: the OpenStreetMap building footprint (frontend/data/taj-park-footprint.json, ODbL — attribution is in the
   section) extruded into podium + tower; windows are an instanced grid along every façade edge; materials use brand
   tokens only; the ground carries the Kufic 2×2 tile at 25 % as a repeating texture (whole tiles: the plane is an exact
   multiple of the tile). Day/night follows html[data-scheme]; the camera orbit is scrubbed by scroll (direction-aware),
   with optional limited OrbitControls drag. DPR ≤ 1.5, renders only while visible and while something moves. */
import {
  Scene, PerspectiveCamera, WebGLRenderer, Color, Group, Vector3, MathUtils,
  Shape, ExtrudeGeometry, BoxGeometry, PlaneGeometry, Mesh, InstancedMesh, Matrix4, Object3D,
  MeshStandardMaterial, MeshBasicMaterial, HemisphereLight, DirectionalLight, CanvasTexture, RepeatWrapping, SRGBColorSpace, Fog,
  OrbitControls
} from "../vendor/three.min.js";

/* brand tokens (hex literals live here because WebGL cannot read CSS variables) */
const T = {
  black: 0x101820, grey: 0xB6ADA5, raisedLight: 0xF5F2EE, raisedDark: 0x1C242E, borderDark: 0x3A4350, white: 0xFFFFFF,
  goldSolid: 0xBC9639, patternLight: "#8E732A", patternDark: "#D6AA42", surfaceLight: 0xFFFFFF, surfaceDark: 0x101820, _source: "taj-park-3d: brand tokens mirrored for WebGL"
};

const stats = { frames: 0, total: 0, last: [], max: 0 };
export function getStats() {
  const l = stats.last, s = l.slice().sort((a, b) => a - b);
  return { frames: stats.frames, avgMs: +(stats.total / Math.max(1, stats.frames)).toFixed(2), p95Ms: +(s[Math.floor(s.length * 0.95)] || 0).toFixed(2), maxMs: +stats.max.toFixed(2) };
}

function project(ring) {
  const lat0 = ring.reduce((a, p) => a + p[1], 0) / ring.length, lon0 = ring.reduce((a, p) => a + p[0], 0) / ring.length;
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180), kz = 110540;
  return ring.map(([lon, lat]) => [(lon - lon0) * kx, -(lat - lat0) * kz]);
}
function signedArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; } return a / 2; }

async function kuficTexture(src, ink) {
  const txt = await fetch(src).then((r) => r.text());
  const doc = new DOMParser().parseFromString(txt, "image/svg+xml");
  const unit = parseFloat((doc.documentElement.getAttribute("viewBox") || "0 0 81.553 81.553").split(/\s+/)[2]) || 81.553;
  const paths = [...doc.querySelectorAll("path")].map((p) => new Path2D(p.getAttribute("d")));
  const size = 256, c = document.createElement("canvas"); c.width = c.height = size;
  const ctx = c.getContext("2d"); ctx.clearRect(0, 0, size, size);
  ctx.globalAlpha = 0.25; ctx.fillStyle = ink;
  const s = (size * 0.86) / unit, off = (size - size * 0.86) / 2; /* gutter between tiles = the master's 1.07 mm gutter ratio, rounded */
  ctx.setTransform(s, 0, 0, s, off, off);
  for (const p of paths) ctx.fill(p);
  const tex = new CanvasTexture(c); tex.wrapS = tex.wrapT = RepeatWrapping; tex.colorSpace = SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

export async function mount(section, opts = {}) {
  performance.mark("tp3d:module-ready");
  const canvas = section.querySelector("canvas");
  const dir = () => ((document.documentElement.getAttribute("dir") || "rtl") === "rtl" ? -1 : 1);
  const scheme = () => (document.documentElement.getAttribute("data-scheme") === "dark" ? "dark" : "light");
  const data = await fetch(section.getAttribute("data-footprint")).then((r) => r.json());
  const m = data.massing;
  const pts = project(data.footprint);
  if (signedArea(pts) < 0) pts.reverse();

  /* ---------- scene ---------- */
  const scene = new Scene();
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = SRGBColorSpace;
  const camera = new PerspectiveCamera(34, 1, 1, 2000);
  const world = new Group(); scene.add(world);

  const floorH = m.floorHeight, podiumH = m.podiumFloors * floorH, towerH = m.floors * floorH;
  const shape = new Shape(pts.map(([x, z]) => ({ x, y: -z })));
  const facadeMat = new MeshStandardMaterial({ color: T.raisedLight, roughness: 0.92, metalness: 0 });
  const podiumMat = new MeshStandardMaterial({ color: T.grey, roughness: 0.95, metalness: 0 });
  const glassMat = new MeshStandardMaterial({ color: T.black, roughness: 0.35, metalness: 0.2, emissive: T.goldSolid, emissiveIntensity: 0 });
  const litMat = new MeshStandardMaterial({ color: T.black, roughness: 0.35, metalness: 0.2, emissive: T.goldSolid, emissiveIntensity: 0 });

  function extrude(depth, inset) {
    const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); /* extrude along +y */
    return g;
  }
  const podium = new Mesh(extrude(podiumH), podiumMat); world.add(podium);
  const tower = new Mesh(extrude(towerH - podiumH), facadeMat); tower.position.y = podiumH; world.add(tower);
  /* roof slab + plant room */
  const roof = new Mesh(extrude(0.6), podiumMat); roof.position.y = towerH; world.add(roof);
  const plant = new Mesh(new BoxGeometry(m.roofBox[0], m.roofBox[1], m.roofBox[2]), podiumMat); plant.position.set(0, towerH + m.roofBox[1] / 2, 0); world.add(plant);

  /* glazed corner band (the curved lounge glazing in the reference photo), modelled as a dark glass box on the entrance corner */
  if (m.cornerGlass) {
    const cg = m.cornerGlass, box = new Mesh(new BoxGeometry(cg.width, cg.floors * floorH, cg.depth), glassMat);
    box.position.set(cg.x, podiumH + cg.floors * floorH / 2, cg.z); world.add(box);
  }

  /* windows: instanced along every edge, one row per tower floor */
  const win = new BoxGeometry(m.window[0], m.window[1], 0.12);
  const placements = [];
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
    if (len < m.window[0] * 2) continue;
    const n = Math.floor((len - 1.2) / m.windowPitch), ux = dx / len, uz = dz / len;
    const nx = uz, nz = -ux; /* outward normal for a counter-clockwise ring in x/−z space */
    const start = (len - (n - 1) * m.windowPitch) / 2;
    const angle = Math.atan2(nx, nz);
    for (let f = m.podiumFloors; f < m.floors; f++) for (let k = 0; k < n; k++) {
      const t = start + k * m.windowPitch;
      placements.push({ x: x1 + ux * t + nx * 0.08, y: f * floorH + floorH * 0.55, z: z1 + uz * t + nz * 0.08, rot: angle, lit: ((f * 7 + k * 13 + i * 3) % 10) < 7 });
    }
  }
  const litN = placements.filter((p) => p.lit).length, dimN = placements.length - litN;
  const lit = new InstancedMesh(win, litMat, Math.max(1, litN)), dim = new InstancedMesh(win, glassMat, Math.max(1, dimN));
  const o = new Object3D(); let li = 0, di = 0;
  for (const p of placements) { o.position.set(p.x, p.y, p.z); o.rotation.set(0, p.rot, 0); o.updateMatrix(); if (p.lit) lit.setMatrixAt(li++, o.matrix); else dim.setMatrixAt(di++, o.matrix); }
  lit.instanceMatrix.needsUpdate = dim.instanceMatrix.needsUpdate = true; world.add(lit, dim);

  /* ground: base colour + Kufic tile at 25 % (plane = whole tiles) */
  const tile = m.tileMetres, tilesN = 26, groundSize = tile * tilesN;
  const groundMat = new MeshStandardMaterial({ color: T.surfaceLight, roughness: 1 });
  const ground = new Mesh(new PlaneGeometry(groundSize, groundSize), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; world.add(ground);
  const patMat = new MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 1 });
  const pattern = new Mesh(new PlaneGeometry(groundSize, groundSize), patMat); pattern.rotation.x = -Math.PI / 2; pattern.position.y = 0.0; world.add(pattern);
  const texSrc = section.getAttribute("data-tile") || "../assets/brand/pattern/kufic-2x2.svg";
  const textures = { light: await kuficTexture(texSrc, T.patternLight), dark: await kuficTexture(texSrc, T.patternDark) };
  for (const k in textures) textures[k].repeat.set(tilesN, tilesN);

  /* lights + fog */
  const hemi = new HemisphereLight(T.white, T.grey, 1); scene.add(hemi);
  const sun = new DirectionalLight(T.white, 1.2); sun.position.set(-60, 120, 80); scene.add(sun);

  function applyScheme() {
    const dark = scheme() === "dark";
    facadeMat.color.setHex(dark ? T.raisedDark : T.raisedLight);
    podiumMat.color.setHex(dark ? T.borderDark : T.grey);
    groundMat.color.setHex(dark ? T.surfaceDark : T.surfaceLight);
    litMat.emissiveIntensity = dark ? 0.95 : 0;
    glassMat.emissiveIntensity = dark ? 0.12 : 0;
    patMat.map = textures[dark ? "dark" : "light"]; patMat.needsUpdate = true;
    hemi.intensity = dark ? 0.28 : 1.0; sun.intensity = dark ? 0.18 : 1.2;
    scene.fog = new Fog(dark ? T.surfaceDark : T.surfaceLight, 220, 520);
    dirty = true;
  }

  /* ---------- camera / orbit ---------- */
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  const target = new Vector3((Math.max(...xs) + Math.min(...xs)) / 2, towerH * 0.38, (Math.max(...zs) + Math.min(...zs)) / 2);
  const radiusBase = Math.max(towerH * 2.3, extent * 1.9);
  let radius = radiusBase;
  const polar = MathUtils.degToRad(64);
  let scrollT = 0, azimuth = 0, azimuthGoal = 0, dragOffset = 0, dirty = true, visible = true, lastT = 0;
  const base = MathUtils.degToRad(m.cameraStartDeg), range = MathUtils.degToRad(m.cameraRangeDeg);
  function place() {
    const a = azimuth + dragOffset;
    camera.position.set(target.x + radius * Math.sin(polar) * Math.sin(a), target.y + radius * Math.cos(polar), target.z + radius * Math.sin(polar) * Math.cos(a));
    camera.lookAt(target);
  }
  function setScroll(t) { scrollT = MathUtils.clamp(t, 0, 1); azimuthGoal = base + (scrollT - 0.5) * range * dir(); dirty = true; }
  azimuth = azimuthGoal = base;

  let controls = null;
  if (section.getAttribute("data-orbit") === "drag") {
    controls = new OrbitControls(camera, canvas);
    controls.enableZoom = false; controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minPolarAngle = controls.maxPolarAngle = polar;
    controls.target.copy(target);
    controls.addEventListener("change", () => { dirty = true; });
    controls.addEventListener("start", () => { section.setAttribute("data-dragging", "true"); });
    controls.addEventListener("end", () => { /* keep the user's offset relative to the scroll position */ dragOffset = controls.getAzimuthalAngle() - azimuth; section.removeAttribute("data-dragging"); });
  }

  /* ---------- resize / visibility ---------- */
  function resize() {
    const r = canvas.parentElement.getBoundingClientRect(); const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false); camera.aspect = w / h;
    radius = radiusBase * (camera.aspect < 1 ? 1.55 : camera.aspect < 1.4 ? 1.2 : 1); /* portrait viewports step back */
    camera.updateProjectionMatrix(); dirty = true;
  }
  new ResizeObserver(resize).observe(canvas.parentElement);
  new IntersectionObserver((es) => { es.forEach((e) => { visible = e.isIntersecting; if (visible) { dirty = true; loop(); } }); }).observe(section);
  document.addEventListener("deafah:themechange", applyScheme);
  document.addEventListener("deafah:langchange", () => setScroll(scrollT));

  /* scroll progress across the section (ScrollTrigger when present, otherwise a plain listener) */
  if (window.ScrollTrigger && window.gsap && !opts.reduce) {
    window.ScrollTrigger.create({ trigger: section, start: "top bottom", end: "bottom top", scrub: 1, onUpdate: (st) => setScroll(st.progress) });
  } else {
    const onScroll = () => { const r = section.getBoundingClientRect(); setScroll((window.innerHeight - r.top) / (window.innerHeight + r.height)); };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  /* ---------- render loop (only when visible and moving) ---------- */
  let raf = 0, first = true;
  function frame(now) {
    raf = 0;
    if (!visible) return;
    const moving = Math.abs(azimuthGoal - azimuth) > 0.0005;
    if (moving) { azimuth += (azimuthGoal - azimuth) * 0.08; dirty = true; }
    if (controls && section.hasAttribute("data-dragging")) { controls.update(); dirty = true; }
    else if (controls && !moving) { /* re-sync controls to the scroll-driven orbit */ }
    if (dirty) {
      if (!(controls && section.hasAttribute("data-dragging"))) place();
      const t0 = performance.now();
      renderer.render(scene, camera);
      const ms = performance.now() - t0; stats.frames++; stats.total += ms; stats.last.push(ms); if (stats.last.length > 120) stats.last.shift(); if (ms > stats.max) stats.max = ms;
      dirty = false;
      if (first) { first = false; performance.mark("tp3d:first-frame"); section.setAttribute("data-3d", "live"); canvas.hidden = false; }
    }
    raf = requestAnimationFrame(frame);
  }
  function loop() { if (!raf) raf = requestAnimationFrame(frame); }

  applyScheme(); resize(); setScroll(scrollT); azimuth = azimuthGoal; place(); loop();

  /* poster mode (dev only): a fixed, deterministic view rendered once at 1600×1000 */
  const api = {
    renderPoster(width = 1600, height = 1000, az = base) {
      renderer.setPixelRatio(1); renderer.setSize(width, height, false); camera.aspect = width / height; radius = radiusBase; camera.updateProjectionMatrix();
      azimuth = azimuthGoal = az; dragOffset = 0; place(); renderer.render(scene, camera);
      return canvas.toDataURL("image/png");
    },
    setScheme: applyScheme, setScroll, getStats, scene, camera, renderer
  };
  window.DeafahTajPark3D = api;
  return api;
}

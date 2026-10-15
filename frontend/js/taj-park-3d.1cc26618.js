/* Al Deafah — Taj Park Hotel, procedural 3D kit (Phase 5.1). ES module, loaded lazily by js/taj-park-3d-loader.js.
   Geometry source: the OpenStreetMap footprint (data/taj-park-footprint.json, ODbL; 23 floors / 95 m from the way's tags)
   and the neighbours in data/taj-park-context.json (ODbL). The architecture follows the group's own photos and renders
   (reference only): two rectilinear wings meeting at an obtuse angle, a full-height cylindrical curtain-wall tower at the
   street corner capped by a pergola crown, sandstone pier/spandrel grid with floor-high dark-blue glazing, pointed arches
   under a frieze on the top floors, a glazed podium with an entrance canopy and a lit restaurant band on the cylinder.
   Night: white LED strips outline the stone grid. Materials use brand tokens only. No logo on the building.
   Kit: makeSky, makeContext, makePlaza, makePodium, makeWing (per façade edge), makeArchRow, makeCylinderTower, makeCrown,
   makeLedEdges, makePalms, makeLamps. GLB path: data-model="…glb" loads with GLTFLoader instead of the kit. */
import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Vector3, MathUtils, Path, Shape, ExtrudeGeometry, BoxGeometry,
  PlaneGeometry, CylinderGeometry, ConeGeometry, TorusGeometry, Mesh, InstancedMesh, Object3D,
  MeshStandardMaterial, HemisphereLight, DirectionalLight, CanvasTexture, EquirectangularReflectionMapping,
  SRGBColorSpace, Fog, DoubleSide, OrbitControls, GLTFLoader
} from "../vendor/three.d81d4031.min.js";

/* brand tokens mirrored for WebGL (CSS variables are not readable inside the GL context) — source: taj-park-3d */
const T = {
  black: 0x101820, grey: 0xB6ADA5, beige: 0xE1B87F, darkBlue: 0x0E4174, blue: 0x008BC4, white: 0xFFFFFF, muted: 0x5C5853,
  borderDark: 0x3A4350, green: 0x8DAE81, goldSolid: 0xBC9639, raisedLight: 0xF5F2EE, raisedDark: 0x1C242E, _source: "taj-park-3d"
};
const stats = { frames: 0, total: 0, last: [], max: 0 };
export function getStats() {
  const l = stats.last, s = l.slice().sort((a, b) => a - b);
  return { frames: stats.frames, avgMs: +(stats.total / Math.max(1, stats.frames)).toFixed(2), p95Ms: +(s[Math.floor(s.length * 0.95)] || 0).toFixed(2), maxMs: +stats.max.toFixed(2) };
}

/* ------------------------------------------------------------------ geometry helpers (plan: e = east, n = north; scene: x = e, z = −n) */
function projectRing(ring, lat0, lon0) {
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180), kz = 110540;
  return ring.map(([lon, lat]) => [(lon - lon0) * kx, (lat - lat0) * kz]);
}
function planShape(pts) { const s = new Shape(); pts.forEach(([e, n], i) => (i ? s.lineTo(e, -n) : s.moveTo(e, -n))); s.closePath(); return s; }
/* ExtrudeGeometry extrudes along +z; rotateX(+90°) maps shape (x, y) → (x, z = y) and the depth to −y, so translate lifts it to 0…height */
function extrudePlan(pts, height) { const g = new ExtrudeGeometry(planShape(pts), { depth: height, bevelEnabled: false }); g.rotateX(Math.PI / 2); g.translate(0, height, 0); return g; }
function circleFit(arc) { /* algebraic least squares */
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sr = 0, sxr = 0, syr = 0; const n = arc.length;
  for (const [x, y] of arc) { const r = x * x + y * y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sr += r; sxr += x * r; syr += y * r; }
  const A = [[2 * sxx, 2 * sxy, sx], [2 * sxy, 2 * syy, sy], [2 * sx, 2 * sy, n]], B = [sxr, syr, sr];
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A), sol = [0, 1, 2].map((i) => det(A.map((row, r) => row.map((v, c) => (c === i ? B[r] : v)))) / D);
  return { e: sol[0], n: sol[1], r: Math.sqrt(sol[2] + sol[0] ** 2 + sol[1] ** 2) };
}

/* ------------------------------------------------------------------ materials (one set, retinted per scheme) */
function makeMaterials() {
  return {
    stone: new MeshStandardMaterial({ color: T.beige, roughness: 0.85, metalness: 0 }),
    stoneLight: new MeshStandardMaterial({ color: T.grey, roughness: 0.9, metalness: 0 }),
    glass: new MeshStandardMaterial({ color: T.darkBlue, roughness: 0.05, metalness: 0.95, envMapIntensity: 3.2 }),
    podiumGlass: new MeshStandardMaterial({ color: T.darkBlue, roughness: 0.08, metalness: 0.7, envMapIntensity: 2.0, transparent: true, opacity: 0.55, depthWrite: false }),
    interior: new MeshStandardMaterial({ color: T.beige, roughness: 0.9, emissive: T.beige, emissiveIntensity: 0 }),
    glassCyl: new MeshStandardMaterial({ color: T.darkBlue, roughness: 0.06, metalness: 0.95, envMapIntensity: 2.4 }),
    lit: new MeshStandardMaterial({ color: T.black, roughness: 0.6, emissive: T.beige, emissiveIntensity: 0 }),
    band: new MeshStandardMaterial({ color: T.darkBlue, roughness: 0.2, metalness: 0.6, emissive: T.beige, emissiveIntensity: 0, transparent: true, opacity: 0.9 }),
    led: new MeshStandardMaterial({ color: T.beige, roughness: 0.6, emissive: T.white, emissiveIntensity: 0 }),
    gold: new MeshStandardMaterial({ color: T.goldSolid, roughness: 0.35, metalness: 0.6, emissive: T.goldSolid, emissiveIntensity: 0 }),
    ground: new MeshStandardMaterial({ color: T.borderDark, roughness: 1 }),
    kerb: new MeshStandardMaterial({ color: T.grey, roughness: 1 }),
    context: new MeshStandardMaterial({ color: T.grey, roughness: 1, transparent: true, opacity: 0.55 }),
    trunk: new MeshStandardMaterial({ color: T.muted, roughness: 1 }),
    frond: new MeshStandardMaterial({ color: T.green, roughness: 1, side: DoubleSide }),
    lampHead: new MeshStandardMaterial({ color: T.grey, emissive: T.white, emissiveIntensity: 0 })
  };
}

/* ------------------------------------------------------------------ sky: scheme-aware gradient (also the reflection environment) */
function makeSky(dark) {
  const w = 1024, h = 512, c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"), g = ctx.createLinearGradient(0, 0, 0, h);
  const hex = (v) => "#" + v.toString(16).padStart(6, "0");
  if (dark) { g.addColorStop(0, hex(T.black)); g.addColorStop(0.47, hex(T.darkBlue)); g.addColorStop(0.52, hex(T.borderDark)); g.addColorStop(1, hex(T.black)); }
  else { g.addColorStop(0, hex(T.blue)); g.addColorStop(0.42, hex(T.white)); g.addColorStop(0.5, hex(T.white)); g.addColorStop(0.55, hex(T.grey)); g.addColorStop(1, hex(T.muted)); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const tex = new CanvasTexture(c); tex.mapping = EquirectangularReflectionMapping; tex.colorSpace = SRGBColorSpace; return tex;
}

export async function mount(section, opts = {}) {
  performance.mark("tp3d:module-ready");
  const canvas = section.querySelector("canvas");
  const dir = () => ((document.documentElement.getAttribute("dir") || "rtl") === "rtl" ? -1 : 1);
  const scheme = () => (document.documentElement.getAttribute("data-scheme") === "dark" ? "dark" : "light");
  const fp = await fetch(section.getAttribute("data-footprint")).then((r) => r.json());
  const ctxData = section.getAttribute("data-context") ? await fetch(section.getAttribute("data-context")).then((r) => r.json()).catch(() => null) : null;
  const M = Object.assign({ floors: 23, floorHeight: 4.0, podiumFloors: 3, bayWidth: 4.2, pierWidth: 0.9, spandrelHeight: 1.0, archFloors: 3, cylinderExtraFloors: 2 }, fp.massing || {});
  const pts = projectRing(fp.footprint, fp.centre.lat, fp.centre.lon); /* CCW in east/north */
  const floorH = M.floorHeight, podiumH = M.podiumFloors * floorH, wingH = M.floors * floorH;

  /* ---------- renderer / scene ---------- */
  const scene = new Scene();
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.debug.checkShaderErrors = false;   /* production: skip shader info-log checks (three.js docs); removes the ANGLE precision warning */
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = SRGBColorSpace;
  const camera = new PerspectiveCamera(36, 1, 1, 3000);
  const world = new Group(); scene.add(world);
  const mat = makeMaterials();
  const sky = { light: makeSky(false), dark: makeSky(true) };

  /* ---------- the cylinder: fitted to the arc nodes of the footprint ---------- */
  const arcIdx = M.arcNodes || [14, 15, 16, 17, 18, 19, 20];
  const cyl = circleFit(arcIdx.map((i) => pts[i]));
  const cylR = cyl.r + 0.4, cylCentre = new Vector3(cyl.e, 0, -cyl.n), cylH = wingH + M.cylinderExtraFloors * floorH;
  const inner = arcIdx.slice(1, -1);
  const body = pts.filter((_, i) => !inner.includes(i)); /* footprint with the arc replaced by its chord (the cylinder covers it) */
  const nearCyl = (p) => Math.hypot(p[0] - cyl.e, p[1] - cyl.n) < cyl.r + 0.8;

  /* ---------- podium (fully glazed) + tower core (glass) ---------- */
  const kit = new Group(); world.add(kit);
  function makePodium() {
    const g = new Group();
    /* interior volumes behind the glass: floor slabs + a warm core (lit at night), then the transparent glass skin */
    const insetPts = body.map(([e, n]) => [e * 0.93, n * 0.93]);
    for (let f = 0; f <= M.podiumFloors; f++) { const sl = new Mesh(extrudePlan(insetPts, 0.35), mat.stone); sl.position.y = f * floorH; g.add(sl); }
    const coreVol = new Mesh(extrudePlan(body.map(([e, n]) => [e * 0.72, n * 0.72]), podiumH - 0.4), mat.interior); coreVol.position.y = 0.4; g.add(coreVol);
    const glassSkin = new Mesh(extrudePlan(body, podiumH), mat.podiumGlass); glassSkin.renderOrder = 2; g.add(glassSkin);
    const slab = new Mesh(extrudePlan(body, 0.5), mat.stone); slab.position.y = podiumH; g.add(slab);
    g.add(new Mesh(extrudePlan(body, 0.6), mat.stoneLight));
    /* entrance canopy at the base of the cylinder, facing the street (north-east) */
    const out = new Vector3(0.7, 0, -0.7).normalize();
    const canopy = new Group();
    const slabC = new Mesh(new BoxGeometry(30, 0.6, 16), mat.stone); slabC.position.y = 6.2; canopy.add(slabC);
    const edge = new Mesh(new BoxGeometry(30, 0.35, 0.4), mat.gold); edge.position.set(0, 5.9, 8.0); canopy.add(edge);
    const sign = new Mesh(new BoxGeometry(14, 1.6, 0.3), mat.gold); sign.position.set(0, 7.9, 7.8); canopy.add(sign);
    for (const sx of [-12, -4, 4, 12]) { const col = new Mesh(new CylinderGeometry(0.38, 0.38, 6.2, 12), mat.stoneLight); col.position.set(sx, 3.1, 7.0); canopy.add(col); }
    canopy.position.copy(cylCentre).addScaledVector(out, cylR + 9); canopy.rotation.y = Math.atan2(out.x, out.z);
    g.add(canopy);
    return g;
  }
  kit.add(makePodium());
  const core = new Mesh(extrudePlan(body, wingH - podiumH), mat.glass); core.position.y = podiumH; kit.add(core);
  const roofSlab = new Mesh(extrudePlan(body, 0.6), mat.stone); roofSlab.position.y = wingH; kit.add(roofSlab);

  /* ---------- wing façades: stone pier/spandrel grid per straight edge, arches + frieze on top, LED edge lines ---------- */
  const ledPlacements = [], litPlacements = [], archRows = [], pierPlacements = [], spandrelPlacements = [];
  const pierGeo = new BoxGeometry(M.pierWidth, wingH - podiumH, 1.0), spandrelGeo = new BoxGeometry(1, M.spandrelHeight, 0.9);
  function makeWing(e1, e2) {
    const dx = e2[0] - e1[0], dn = e2[1] - e1[1], L = Math.hypot(dx, dn);
    if (L < 5) return null;
    const ux = dx / L, un = dn / L, ox = un, on = -ux;                    /* outward normal of a CCW ring (right-hand side) */
    const g = new Group();
    const n = Math.max(1, Math.round(L / M.bayWidth)), bay = L / n;
    const yaw = Math.atan2(-un, ux) * -1;                                 /* box +x axis along the edge in scene space (x = e, z = −n) */
    const place = (mesh, t, y, outOff) => { mesh.position.set(e1[0] + ux * t + ox * outOff, y, -(e1[1] + un * t + on * outOff)); mesh.rotation.y = yaw; };
    for (let k = 0; k <= n; k++) {
      pierPlacements.push({ e: e1[0] + ux * k * bay + ox * 0.5, n: e1[1] + un * k * bay + on * 0.5, y: podiumH + (wingH - podiumH) / 2, yaw });
      ledPlacements.push({ e: e1[0] + ux * k * bay + ox * 1.02, n: e1[1] + un * k * bay + on * 1.02, y: podiumH + (wingH - podiumH) / 2, len: wingH - podiumH, yaw, vertical: true });
    }
    const archStart = M.floors - M.archFloors;
    for (let f = M.podiumFloors; f < M.floors; f++) {
      const top = (f + 1) * floorH;
      if (f < archStart) {
        spandrelPlacements.push({ e: e1[0] + ux * L / 2 + ox * 0.45, n: e1[1] + un * L / 2 + on * 0.45, y: top - M.spandrelHeight / 2, yaw, len: L });
        ledPlacements.push({ e: e1[0] + ux * L / 2 + ox * 0.92, n: e1[1] + un * L / 2 + on * 0.92, y: top - M.spandrelHeight, len: L, yaw, vertical: false });
      }
      for (let k = 0; k < n; k++) if (((f * 7 + k * 5 + Math.round(L)) % 100) < 18) litPlacements.push({ e: e1[0] + ux * (k + 0.5) * bay + ox * 0.08, n: e1[1] + un * (k + 0.5) * bay + on * 0.08, y: f * floorH + floorH * 0.5 - (f < archStart ? M.spandrelHeight / 2 : 0), w: bay - M.pierWidth, h: floorH - (f < archStart ? M.spandrelHeight : 0.4), yaw });
    }
    archRows.push({ e1, ux, un, ox, on, n, bay, yaw, L });
    const frieze = new Mesh(new BoxGeometry(L + 1.2, 1.4, 1.1), mat.stoneLight); place(frieze, L / 2, wingH - 0.7, 0.55); g.add(frieze);
    const parapet = new Mesh(new BoxGeometry(L + 1.2, 0.5, 1.1), mat.stone); place(parapet, L / 2, wingH + 0.55, 0.55); g.add(parapet);
    return g;
  }
  function makeArchRow(row) {
    const H = M.archFloors * floorH - 1.6, w = row.bay, p = M.pierWidth * 0.6, r = (w - 2 * p) / 2;
    const shape = new Shape(); shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, H); shape.lineTo(-w / 2, H); shape.closePath();
    const hole = new Path(); hole.moveTo(-w / 2 + p, 0); hole.lineTo(-w / 2 + p, H - 1.3 - r); hole.quadraticCurveTo(-w / 2 + p, H - 0.4, 0, H - 0.2); hole.quadraticCurveTo(w / 2 - p, H - 0.4, w / 2 - p, H - 1.3 - r); hole.lineTo(w / 2 - p, 0); hole.closePath();
    shape.holes.push(hole);
    const geo = new ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false });
    const mesh = new InstancedMesh(geo, mat.stone, row.n), o = new Object3D();
    for (let k = 0; k < row.n; k++) {
      const t = (k + 0.5) * row.bay;
      o.position.set(row.e1[0] + row.ux * t + row.ox * 0.75, (M.floors - M.archFloors) * floorH + 0.3, -(row.e1[1] + row.un * t + row.on * 0.75));
      o.rotation.set(0, row.yaw + Math.PI, 0); o.updateMatrix(); mesh.setMatrixAt(k, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true; return mesh;
  }
  for (let i = 0; i < body.length; i++) {
    const a = body[i], b = body[(i + 1) % body.length];
    if (nearCyl(a) && nearCyl(b)) continue;                               /* the chord under the cylinder is not a façade */
    const w = makeWing(a, b); if (w) kit.add(w);
  }
  archRows.forEach((row) => kit.add(makeArchRow(row)));
  function instanced(geo, material, list, setup) { const mesh = new InstancedMesh(geo, material, Math.max(1, list.length)), o = new Object3D(); list.forEach((p, i) => { setup(o, p); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); }); mesh.instanceMatrix.needsUpdate = true; return mesh; }
  kit.add(instanced(pierGeo, mat.stone, pierPlacements, (o, p) => { o.position.set(p.e, p.y, -p.n); o.rotation.set(0, p.yaw, 0); o.scale.set(1, 1, 1); }));
  kit.add(instanced(spandrelGeo, mat.stone, spandrelPlacements, (o, p) => { o.position.set(p.e, p.y, -p.n); o.rotation.set(0, p.yaw, 0); o.scale.set(p.len, 1, 1); }));

  /* ---------- the cylinder tower (smooth: 96 segments), floor rings, restaurant band, crown ---------- */
  function makeCylinderTower() {
    const g = new Group();
    const tube = new Mesh(new CylinderGeometry(cylR, cylR, cylH, 96, 1, false), mat.glassCyl); tube.position.set(cylCentre.x, cylH / 2, cylCentre.z); g.add(tube);
    const ringGeo = new TorusGeometry(cylR + 0.12, 0.22, 6, 96), ringsN = M.floors + M.cylinderExtraFloors;
    const rings = new InstancedMesh(ringGeo, mat.stone, ringsN), ro = new Object3D();
    for (let f = 1; f <= ringsN; f++) { ro.position.set(cylCentre.x, f * floorH, cylCentre.z); ro.rotation.set(Math.PI / 2, 0, 0); ro.updateMatrix(); rings.setMatrixAt(f - 1, ro.matrix); }
    rings.instanceMatrix.needsUpdate = true; g.add(rings);
    const band = new Mesh(new CylinderGeometry(cylR + 0.35, cylR + 0.35, 3 * floorH, 96, 1, true), mat.band); band.position.set(cylCentre.x, podiumH + 1.5 * floorH, cylCentre.z); g.add(band); /* restaurant floors 3–6 */
    const cap = new Mesh(new CylinderGeometry(cylR, cylR, 0.6, 96), mat.stone); cap.position.set(cylCentre.x, cylH + 0.3, cylCentre.z); g.add(cap);
    return g;
  }
  function makeCrown() {
    const g = new Group(), y = cylH + 1.4, out = Math.atan2(0.7, -0.7), span = Math.PI * 1.35, a0 = out - span / 2;
    [cylR + 1.2, cylR + 2.8, cylR + 4.4].forEach((rr, i) => { const ring = new Mesh(new TorusGeometry(rr, 0.24, 6, 96, span), mat.stoneLight); ring.rotation.x = Math.PI / 2; ring.rotation.z = -a0; ring.position.set(cylCentre.x, y + i * 0.05, cylCentre.z); g.add(ring); });
    const finGeo = new BoxGeometry(5.6, 0.3, 0.34), fins = new InstancedMesh(finGeo, mat.stoneLight, 29), fo = new Object3D();
    for (let i = 0; i <= 28; i++) { const a = a0 + span * i / 28; fo.position.set(cylCentre.x + Math.sin(a) * (cylR + 2.4), y, cylCentre.z + Math.cos(a) * (cylR + 2.4)); fo.rotation.set(0, a, 0); fo.updateMatrix(); fins.setMatrixAt(i, fo.matrix); }
    fins.instanceMatrix.needsUpdate = true; g.add(fins);
    for (let i = 0; i < 8; i++) { const a = a0 + span * i / 7; const post = new Mesh(new CylinderGeometry(0.16, 0.16, 3.2, 8), mat.stoneLight); post.position.set(cylCentre.x + Math.sin(a) * (cylR + 4.4), y - 1.6, cylCentre.z + Math.cos(a) * (cylR + 4.4)); g.add(post); }
    return g;
  }
  kit.add(makeCylinderTower(), makeCrown());

  /* ---------- roof plant on the wings, set back ---------- */
  [[-30, 12], [15, -6]].forEach(([e, n]) => { const box = new Mesh(new BoxGeometry(12, 2.6, 8), mat.stoneLight); box.position.set(e, wingH + 1.9, -n); kit.add(box); });

  /* ---------- instanced LED strips and lit interiors ---------- */
  function makeLedEdges() {
    const geo = new BoxGeometry(1, 0.32, 0.32), mesh = new InstancedMesh(geo, mat.led, ledPlacements.length), o = new Object3D();
    ledPlacements.forEach((p, i) => { o.position.set(p.e, p.y, -p.n); o.rotation.set(0, p.yaw, p.vertical ? Math.PI / 2 : 0); o.scale.set(p.len, 1, 1); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); });
    mesh.instanceMatrix.needsUpdate = true; return mesh;
  }
  function makeLitPanels() {
    const geo = new PlaneGeometry(1, 1), mesh = new InstancedMesh(geo, mat.lit, Math.max(1, litPlacements.length)), o = new Object3D();
    litPlacements.forEach((p, i) => { o.position.set(p.e, p.y, -p.n); o.rotation.set(0, p.yaw, 0); o.scale.set(p.w, p.h, 1); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); });
    mesh.instanceMatrix.needsUpdate = true; return mesh;
  }
  const ledMesh = makeLedEdges(); kit.add(ledMesh, makeLitPanels());

  /* ---------- plaza, kerb, palms, lamps, context ---------- */
  function makePlaza() {
    const g = new Group();
    const ground = new Mesh(new PlaneGeometry(900, 900), mat.ground); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; g.add(ground);
    g.add(new Mesh(extrudePlan(pts.map(([e, n]) => [e * 1.16, n * 1.16]), 0.18), mat.kerb));   /* sidewalk around the block */
    return g;
  }
  function makePalms() {
    const g = new Group(), trunkGeo = new CylinderGeometry(0.22, 0.34, 7, 8), frondGeo = new ConeGeometry(0.9, 4.2, 5);
    const frontage = [pts[arcIdx[arcIdx.length - 1]], pts[0], pts[1], pts[2]];   /* street façade: cylinder end → bend → west */
    for (let s = 0; s < frontage.length - 1; s++) {
      const a = frontage[s], b = frontage[s + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), count = Math.max(1, Math.round(L / 22));
      for (let k = 0; k < count; k++) {
        const t = (k + 0.5) / count, ux = (b[0] - a[0]) / L, un = (b[1] - a[1]) / L, ox = un, on = -ux;
        const e = a[0] + ux * t * L + ox * 13, n = a[1] + un * t * L + on * 13;
        const palm = new Group(); const trunk = new Mesh(trunkGeo, mat.trunk); trunk.position.y = 3.5; palm.add(trunk);
        for (let f = 0; f < 7; f++) { const fr = new Mesh(frondGeo, mat.frond); fr.position.set(Math.sin(f * 0.9) * 1.4, 7.6, Math.cos(f * 0.9) * 1.4); fr.rotation.set(Math.PI * 0.42 * Math.cos(f * 0.9), 0, -Math.PI * 0.42 * Math.sin(f * 0.9)); palm.add(fr); }
        palm.position.set(e, 0, -n); g.add(palm);
      }
    }
    return g;
  }
  function makeLamps() {
    const g = new Group(), poleGeo = new CylinderGeometry(0.12, 0.16, 8, 8), headGeo = new BoxGeometry(0.9, 0.3, 0.5);
    const a = pts[arcIdx[arcIdx.length - 1]], b = pts[2];
    for (let k = 0; k < 5; k++) { const t = (k + 0.5) / 5, e = a[0] + (b[0] - a[0]) * t, n = a[1] + (b[1] - a[1]) * t + 24;
      const pole = new Mesh(poleGeo, mat.trunk); pole.position.set(e, 4, -n); g.add(pole);
      const head = new Mesh(headGeo, mat.lampHead); head.position.set(e, 8.1, -n); g.add(head); }
    return g;
  }
  function makeContext() {
    const g = new Group(); if (!ctxData) return g;
    ctxData.buildings.forEach((b) => { if (b.footprint.length < 3) return; g.add(new Mesh(extrudePlan(b.footprint, b.height_m), mat.context)); });
    return g;
  }
  const contextGroup = makeContext();
  world.add(makePlaza(), makePalms(), makeLamps(), contextGroup);

  /* ---------- optional real model (GLB) replaces the procedural kit ---------- */
  const modelUrl = section.getAttribute("data-model");
  if (modelUrl) {
    try {
      const gltf = await new GLTFLoader().loadAsync(modelUrl);
      kit.visible = false; world.add(gltf.scene);
      gltf.scene.traverse((o) => { if (!o.isMesh) return; const nm = o.name || ""; if (nm.startsWith("glass_")) o.material = mat.glass; else if (nm.startsWith("led_")) o.material = mat.led; else if (nm.startsWith("lit_")) o.material = mat.lit; else if (nm.startsWith("gold_")) o.material = mat.gold; else if (/^(stone_|crown_|roof_)/.test(nm)) o.material = mat.stone; });
      section.setAttribute("data-3d-source", "glb");
    } catch (e) { console.warn("[taj-park-3d] GLB failed, procedural kit kept", e); section.setAttribute("data-3d-source", "procedural"); }
  } else section.setAttribute("data-3d-source", "procedural");

  /* ---------- lights / scheme ---------- */
  const hemi = new HemisphereLight(T.white, T.grey, 1.0); scene.add(hemi);
  const sun = new DirectionalLight(T.white, 1.6); sun.position.set(-160, 180, 140); scene.add(sun); /* south-west */
  let dirty = true;
  function applyScheme() {
    const dark = scheme() === "dark";
    scene.background = sky[dark ? "dark" : "light"]; scene.environment = sky[dark ? "dark" : "light"];
    scene.fog = new Fog(dark ? T.black : T.grey, dark ? 380 : 420, dark ? 1100 : 1400);
    hemi.intensity = dark ? 0.3 : 1.0; sun.intensity = dark ? 0.18 : 1.6;
    mat.led.emissiveIntensity = dark ? 2.2 : 0; mat.led.color.setHex(dark ? T.white : T.beige);
    mat.lit.emissiveIntensity = dark ? 0.55 : 0; mat.lit.color.setHex(dark ? T.black : T.darkBlue);
    mat.band.emissiveIntensity = dark ? 0.4 : 0; mat.band.color.setHex(dark ? T.black : T.darkBlue);
    mat.gold.emissiveIntensity = dark ? 0.9 : 0;
    mat.podiumGlass.color.setHex(dark ? T.black : T.darkBlue); mat.podiumGlass.opacity = dark ? 0.4 : 0.55;
    mat.interior.emissiveIntensity = dark ? 0.6 : 0;
    mat.lampHead.emissiveIntensity = dark ? 1.0 : 0;
    mat.ground.color.setHex(dark ? T.black : T.borderDark);
    mat.context.color.setHex(dark ? T.borderDark : T.grey); mat.context.opacity = dark ? 0.6 : 0.55;
    mat.glass.color.setHex(dark ? T.black : T.darkBlue); mat.glassCyl.color.setHex(dark ? T.black : T.darkBlue);
    mat.glass.envMapIntensity = dark ? 0.5 : 3.2; mat.glassCyl.envMapIntensity = dark ? 0.6 : 2.8;
    dirty = true;
  }

  /* ---------- camera path: street corner looking up at the cylinder → ¾ aerial (azimuth measured from south, mirrored by dir) ---------- */
  const K = {
    start: { az: MathUtils.degToRad(132), polar: MathUtils.degToRad(80), radius: 175, target: new Vector3(cylCentre.x - 10, 48, cylCentre.z + 4) },
    end: { az: MathUtils.degToRad(135 + 70), polar: MathUtils.degToRad(50), radius: 300, target: new Vector3(-10, 30, 6) }
  };
  let scrollT = 0, azimuth = 0, azimuthGoal = 0, dragOffset = 0, visible = true;
  const cur = { polar: K.start.polar, radius: K.start.radius, target: K.start.target.clone() };
  /* keyframes: [{ t, az (deg from south), polar (deg), radius, target: [east offset from the cylinder, y, north offset] }] */
  let keys = [{ t: 0, ...K.start }, { t: 1, ...K.end }];
  function setKeyframes(list) {
    keys = list.map((k) => ({ t: k.t, az: MathUtils.degToRad(k.az), polar: MathUtils.degToRad(k.polar), radius: k.radius, target: new Vector3(cylCentre.x + (k.target ? k.target[0] : 0), k.target ? k.target[1] : 40, cylCentre.z - (k.target ? k.target[2] : 0)) })).sort((a, b) => a.t - b.t);
    if (typeof setScroll === "function") setScroll(scrollT);
  }
  function goal(t) {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1].t) i++;
    const a = keys[i], b = keys[i + 1], u = MathUtils.clamp((t - a.t) / Math.max(1e-6, b.t - a.t), 0, 1), e = u * u * (3 - 2 * u);
    const base0 = keys[0].az;
    return { az: base0 + (a.az - base0 + (b.az - a.az) * e) * dir(), polar: MathUtils.lerp(a.polar, b.polar, e), radius: MathUtils.lerp(a.radius, b.radius, e), target: a.target.clone().lerp(b.target, e) };
  }
  function place() {
    const a = azimuth + dragOffset;
    camera.position.set(cur.target.x + cur.radius * Math.sin(cur.polar) * Math.sin(a), cur.target.y + cur.radius * Math.cos(cur.polar), cur.target.z + cur.radius * Math.sin(cur.polar) * Math.cos(a));
    camera.lookAt(cur.target);
  }
  function setScroll(t) { scrollT = MathUtils.clamp(t, 0, 1); azimuthGoal = goal(scrollT).az; dirty = true; }
  try { const attr = section.getAttribute("data-camera-keys"); if (attr) setKeyframes(JSON.parse(attr)); } catch (e) { console.warn("[taj-park-3d] data-camera-keys ignored", e); }
  let controls = null;
  if (section.getAttribute("data-orbit") === "drag") {
    controls = new OrbitControls(camera, canvas);
    controls.enableZoom = false; controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.addEventListener("change", () => { dirty = true; });
    controls.addEventListener("start", () => { section.setAttribute("data-dragging", "true"); controls.target.copy(cur.target); controls.minPolarAngle = controls.maxPolarAngle = cur.polar; });
    controls.addEventListener("end", () => { dragOffset = controls.getAzimuthalAngle() - azimuth; section.removeAttribute("data-dragging"); });
  }

  function resize() { const r = canvas.parentElement.getBoundingClientRect(); const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = camera.aspect < 1 ? 50 : 36; camera.updateProjectionMatrix(); dirty = true; }
  new ResizeObserver(resize).observe(canvas.parentElement);
  new IntersectionObserver((es) => { es.forEach((e) => { visible = e.isIntersecting; if (visible) { dirty = true; loop(); } }); }).observe(section);
  document.addEventListener("deafah:themechange", applyScheme);
  document.addEventListener("deafah:langchange", () => setScroll(scrollT));
  if (window.ScrollTrigger && window.gsap && !opts.reduce) window.ScrollTrigger.create({ trigger: section, start: "top bottom", end: "bottom top", scrub: 1, onUpdate: (st) => setScroll(st.progress) });
  else { const onScroll = () => { const r = section.getBoundingClientRect(); setScroll((window.innerHeight - r.top) / (window.innerHeight + r.height)); }; window.addEventListener("scroll", onScroll, { passive: true }); onScroll(); }

  let raf = 0, first = true;
  function frame() {
    raf = 0; if (!visible) return;
    const g = goal(scrollT);
    const moving = Math.abs(azimuthGoal - azimuth) > 0.0005 || Math.abs(g.radius - cur.radius) > 0.05 || Math.abs(g.polar - cur.polar) > 0.0005 || cur.target.distanceTo(g.target) > 0.05;
    if (moving) { azimuth += (azimuthGoal - azimuth) * 0.08; cur.polar += (g.polar - cur.polar) * 0.08; cur.radius += (g.radius - cur.radius) * 0.08; cur.target.lerp(g.target, 0.08); dirty = true; }
    const dragging = controls && section.hasAttribute("data-dragging");
    if (dragging) { controls.update(); dirty = true; }
    if (dirty) {
      if (!dragging) place();
      const t0 = performance.now(); renderer.render(scene, camera);
      const ms = performance.now() - t0; stats.frames++; stats.total += ms; stats.last.push(ms); if (stats.last.length > 120) stats.last.shift(); if (ms > stats.max) stats.max = ms;
      if (stats.frames === 31 && !section.hasAttribute("data-quality")) {
        const avg = stats.last.slice(1, 31).reduce((s, v) => s + v, 0) / 30; /* the first frame is shader compilation, skipped */
        if (avg > 12) { renderer.setPixelRatio(1); ledMesh.visible = false; section.setAttribute("data-quality", "reduced"); resize(); }
        else section.setAttribute("data-quality", "full");
        stats.adaptive = { avgFirst30: +avg.toFixed(2), quality: section.getAttribute("data-quality") };
      }
      dirty = false;
      if (first) { first = false; performance.mark("tp3d:first-frame"); section.setAttribute("data-3d", "live"); canvas.hidden = false; }
    }
    raf = requestAnimationFrame(frame);
  }
  function loop() { if (!raf) raf = requestAnimationFrame(frame); }

  applyScheme(); resize(); setScroll(scrollT); azimuth = azimuthGoal; place(); loop();

  const api = {
    renderPoster(width = 1400, height = 875, t = 0.1) {
      renderer.setPixelRatio(1); renderer.setSize(width, height, false); camera.aspect = width / height; camera.fov = 36; camera.updateProjectionMatrix();
      const g = goal(t); azimuth = azimuthGoal = g.az; cur.polar = g.polar; cur.radius = g.radius; cur.target.copy(g.target); dragOffset = 0; place(); renderer.render(scene, camera);
      return canvas.toDataURL("image/png");
    },
    /* explicit camera for the quality-gate comparisons: azimuth in degrees from south (counter-clockwise seen from above), polar in degrees from the zenith */
    renderView(width, height, az, polarDeg, radius, targetY, targetE = cylCentre.x, targetN = -cylCentre.z, fov = 36, clearNear = 0) {
      renderer.setPixelRatio(1); renderer.setSize(width, height, false); camera.aspect = width / height; camera.fov = fov; camera.updateProjectionMatrix();
      azimuth = azimuthGoal = MathUtils.degToRad(az); cur.polar = MathUtils.degToRad(polarDeg); cur.radius = radius; cur.target.set(targetE, targetY, -targetN); dragOffset = 0; place();
      const hidden = [];
      if (clearNear > 0) contextGroup.children.forEach((m) => { m.geometry.computeBoundingSphere(); const c = m.geometry.boundingSphere.center; if (c.distanceTo(camera.position) < clearNear) { m.visible = false; hidden.push(m); } });
      renderer.render(scene, camera); hidden.forEach((m) => { m.visible = true; });
      return canvas.toDataURL("image/png");
    },
    setScheme: applyScheme, setScroll, setKeyframes, getStats: () => Object.assign(getStats(), { adaptive: stats.adaptive || null }), scene, camera, renderer, cylinder: { centre: cylCentre, radius: cylR, height: cylH }
  };
  window.DeafahTajPark3D = api;
  return api;
}

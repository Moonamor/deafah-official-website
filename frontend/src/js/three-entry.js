// Three.js bundle entry — ONLY what js/taj-park-3d.js imports (Phase 5). Bundled by `npm run build:three`
// into frontend/vendor/three.min.js (ESM, minified, tree-shaken, no sourcemap). Add an export here before using it.
export {
  Scene, PerspectiveCamera, WebGLRenderer, Color, Group, Vector3, MathUtils,
  Shape, ExtrudeGeometry, BoxGeometry, PlaneGeometry, Mesh, InstancedMesh, Matrix4, Object3D,
  MeshStandardMaterial, MeshBasicMaterial, HemisphereLight, DirectionalLight,
  CanvasTexture, RepeatWrapping, SRGBColorSpace, Fog
} from "three";
export { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

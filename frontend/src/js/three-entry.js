// Three.js bundle entry — ONLY what js/taj-park-3d.js imports (Phase 5.1). Bundled by `npm run build:three`
// into frontend/vendor/three.min.js (ESM, minified, tree-shaken, no sourcemap). Add an export here before using it.
export {
  Scene, PerspectiveCamera, WebGLRenderer, Color, Group, Vector3, MathUtils, Path, Shape,
  ExtrudeGeometry, BoxGeometry, PlaneGeometry, CylinderGeometry, ConeGeometry, TorusGeometry,
  Mesh, InstancedMesh, Object3D, MeshStandardMaterial, MeshBasicMaterial, HemisphereLight, DirectionalLight,
  CanvasTexture, EquirectangularReflectionMapping, SRGBColorSpace, Fog, DoubleSide
} from "three";
export { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
export { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Three.js bundle entry — ONLY what the Taj Park scene uses (Phase 5). Bundled by `npm run build:three`
// into frontend/vendor/three.min.js (ESM, minified, tree-shaken, no sourcemap). Add an export here before using it.
export {
  Scene, PerspectiveCamera, WebGLRenderer, Color, Group, Vector2, Vector3, MathUtils, Clock,
  Shape, Path, ExtrudeGeometry, BoxGeometry, PlaneGeometry, CylinderGeometry, EdgesGeometry,
  Mesh, InstancedMesh, LineSegments, Matrix4, Object3D,
  MeshStandardMaterial, MeshBasicMaterial, LineBasicMaterial,
  AmbientLight, DirectionalLight, HemisphereLight, PointLight,
  CanvasTexture, TextureLoader, RepeatWrapping, SRGBColorSpace, DoubleSide, Fog,
  PCFSoftShadowMap, ACESFilmicToneMapping
} from "three";
export { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

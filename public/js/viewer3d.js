// Visor 3D de productos: carga un .glb subido desde el admin o arma un hotel genérico
import * as THREE from 'three';
import { OrbitControls } from '/vendor/three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from '/vendor/three/examples/jsm/loaders/GLTFLoader.js';

const C = { green: 0x193f3a, honey: 0xe1aa2a, indigo: 0x2b2561, wood: 0xe9b97a, woodDark: 0xc58c4a, post: 0x8b5a2b, hole: 0x4a3020, cream: 0xfbf3ec };

function hotelModel(size = 1) {
  const g = new THREE.Group();
  const mat = (color, rough = 0.8) => new THREE.MeshStandardMaterial({ color, roughness: rough });
  const w = 1.6 * size, h = 1.6 * size, d = 0.9;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(C.wood));
  body.position.y = h / 2; g.add(body);
  // techo a dos aguas
  const roofLen = w * 0.62;
  for (const s of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(roofLen * 1.08, 0.08, d + 0.25), mat(C.green, 0.6));
    roof.position.set(s * w * 0.27, h + w * 0.24, 0);
    roof.rotation.z = -s * 0.72;
    g.add(roof);
  }
  const gable = new THREE.Shape();
  gable.moveTo(-w / 2, 0); gable.lineTo(w / 2, 0); gable.lineTo(0, w * 0.5); gable.closePath();
  for (const z of [d / 2 - 0.02, -d / 2 + 0.02]) {
    const tri = new THREE.Mesh(new THREE.ShapeGeometry(gable), mat(C.woodDark));
    tri.position.set(0, h, z); if (z < 0) tri.rotation.y = Math.PI; g.add(tri);
  }
  // tubos (habitaciones)
  const cols = Math.round(5 * size), rows = Math.round(4 * size);
  const r = (w / cols) * 0.36;
  const tubeMat = mat(C.cream, 0.9), holeMat = mat(C.hole, 1), bamboo = mat(0xd9c28f, 0.7);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols - (j % 2); i++) {
    const x = -w / 2 + (w / cols) * (i + 0.5 + (j % 2) * 0.5), y = h - (h / rows) * (j + 0.5);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.12, 20), (i + j) % 3 ? tubeMat : bamboo);
    tube.rotation.x = Math.PI / 2; tube.position.set(x, y, d / 2 + 0.04); g.add(tube);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(r * 0.55, 20), holeMat);
    hole.position.set(x, y, d / 2 + 0.105); g.add(hole);
  }
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.6, 0.22), mat(C.post));
  post.position.y = -0.8; g.add(post);
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.08, 48), mat(0x8fbf8a, 1));
  ground.position.y = -1.62; g.add(ground);
  g.position.y = -0.2;
  return g;
}

function beeModel() {
  const b = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 16), new THREE.MeshStandardMaterial({ color: C.honey, roughness: 0.5 }));
  body.scale.set(1.4, 1, 1); b.add(body);
  for (const x of [-0.04, 0.06]) {
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.022, 8, 24), new THREE.MeshStandardMaterial({ color: C.indigo }));
    stripe.rotation.y = Math.PI / 2; stripe.position.x = x; b.add(stripe);
  }
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
  const wings = [-1, 1].map((s) => { const w = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), wingMat); w.position.set(0, 0.1, s * 0.06); w.rotation.x = Math.PI / 2 + s * 0.5; b.add(w); return w; });
  b.userData.wings = wings;
  return b;
}

export function mountViewer(el, { model, size = 1 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(3.2, 2.2, 4.4);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xeedcd2, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(4, 6, 5); scene.add(sun);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 1.6;
  controls.minDistance = 2.5; controls.maxDistance = 9; controls.target.set(0, 0.6, 0);
  renderer.domElement.addEventListener('pointerdown', () => (controls.autoRotate = false));

  const bees = [];
  if (model) {
    new GLTFLoader().load(model, (gltf) => {
      const obj = gltf.scene;
      const box = new THREE.Box3().setFromObject(obj), s = 3 / Math.max(...box.getSize(new THREE.Vector3()).toArray());
      obj.scale.setScalar(s);
      const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
      obj.position.sub(c).add(new THREE.Vector3(0, 0.6, 0));
      scene.add(obj);
    }, undefined, () => { scene.add(hotelModel(size)); });
  } else {
    scene.add(hotelModel(size));
    for (let i = 0; i < 4; i++) { const b = beeModel(); b.userData.phase = i * 1.6; b.userData.radius = 1.6 + i * 0.25; scene.add(b); bees.push(b); }
  }

  const resize = () => { const w = el.clientWidth, h = el.clientHeight || w; renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; camera.aspect = w / h; camera.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(el); resize();
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();
    for (const b of bees) {
      const a = t * 0.7 + b.userData.phase, r = b.userData.radius;
      b.position.set(Math.cos(a) * r, 0.9 + Math.sin(t * 2 + b.userData.phase) * 0.35, Math.sin(a) * r);
      b.rotation.y = -a;
      b.userData.wings.forEach((w, k) => (w.rotation.x = Math.PI / 2 + (k ? 1 : -1) * (0.3 + Math.abs(Math.sin(t * 40)) * 0.6)));
    }
    controls.update(); renderer.render(scene, camera);
  });
}

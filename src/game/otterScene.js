// 3D stage behind the UI: a grey-box otter on a Highland hill until lane 3's Meshy otter lands.
// If public/assets/models/otter.glb exists it replaces the placeholder automatically.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createLoop } from './loop.js';

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9fc6e8');
  scene.fog = new THREE.Fog('#9fc6e8', 18, 45);
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.2, 7);
  camera.lookAt(0, 0.4, 0); // otter sits in the upper half, clear of the prompt card

  scene.add(new THREE.HemisphereLight('#ffffff', '#5b7a4a', 1.6));
  const sun = new THREE.DirectionalLight('#fff4dd', 2);
  sun.position.set(4, 8, 5);
  scene.add(sun);

  // Rolling green hills + distant purple mountains (Highlands placeholder)
  const grass = new THREE.MeshStandardMaterial({ color: '#6fa85a', flatShading: true });
  const hill = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), grass);
  hill.position.set(0, -29.6, 0);
  scene.add(hill);
  const mountMat = new THREE.MeshStandardMaterial({ color: '#7b6f9e', flatShading: true });
  for (const [x, z, h] of [[-12, -22, 7], [-4, -26, 9], [7, -24, 8], [15, -20, 6]]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(h * 0.9, h, 6), mountMat);
    m.position.set(x, h / 2 - 1.5, z);
    scene.add(m);
  }

  // Placeholder otter built from primitives
  const otter = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: '#7a5233', flatShading: true });
  const belly = new THREE.MeshStandardMaterial({ color: '#d8b48a', flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: '#1d1410' });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.8, 6, 12), fur);
  body.position.y = 0.9;
  const front = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.55, 6, 12), belly);
  front.position.set(0, 0.85, 0.2);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), fur);
  head.position.y = 1.85;
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), belly);
  muzzle.position.set(0, 1.75, 0.34);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), dark);
  nose.position.set(0, 1.82, 0.55);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), dark);
  eyeL.position.set(-0.15, 1.95, 0.36);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.15;
  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), fur);
  earL.position.set(-0.32, 2.15, 0);
  const earR = earL.clone();
  earR.position.x = 0.32;
  // tartan-ish bonnet
  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.42, 0.14, 16),
    new THREE.MeshStandardMaterial({ color: '#2f5aa8', flatShading: true }),
  );
  hat.position.set(0, 2.25, 0);
  const bobble = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 6),
    new THREE.MeshStandardMaterial({ color: '#d33b3b' }),
  );
  bobble.position.set(0, 2.36, 0);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.9, 8), fur);
  tail.rotation.x = Math.PI / 2.4;
  tail.position.set(0, 0.35, -0.6);
  otter.add(body, front, head, muzzle, nose, eyeL, eyeR, earL, earR, hat, bobble, tail);
  scene.add(otter);

  // Swap in the Meshy otter when it exists
  new GLTFLoader().load(
    'assets/models/otter.glb',
    (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const s = 2.3 / Math.max(size.y, 0.001);
      model.scale.setScalar(s);
      box.setFromObject(model);
      model.position.y -= box.min.y;
      otter.clear();
      otter.add(model);
    },
    undefined,
    () => {},
  );

  // Reactions: 'idle' | 'talk' | 'good' | 'ok' | 'bad' | 'suspicious'
  let mood = 'idle';
  let moodT = 0;
  let t = 0;
  const react = (m) => {
    mood = m;
    moodT = 0;
  };

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  createLoop({
    update(dt) {
      t += dt;
      moodT += dt;
      let y = Math.sin(t * 2) * 0.03;
      let tilt = 0;
      let squash = 1;
      if (mood === 'talk') y += Math.abs(Math.sin(t * 14)) * 0.04;
      if (mood === 'good') {
        const k = Math.max(0, 1 - moodT * 1.6);
        y += Math.abs(Math.sin(moodT * 10)) * 0.5 * k;
        squash = 1 + Math.sin(moodT * 20) * 0.06 * k;
      }
      if (mood === 'ok') tilt = Math.sin(moodT * 3) * 0.12 * Math.max(0, 1 - moodT / 2);
      if (mood === 'bad' || mood === 'suspicious') {
        tilt = -0.18 * Math.min(1, moodT * 4);
        otter.position.x = Math.sin(moodT * 30) * 0.04 * Math.max(0, 1 - moodT * 2);
      } else otter.position.x *= 0.9;
      otter.position.y = y;
      otter.rotation.z = tilt;
      otter.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      otter.rotation.y = Math.sin(t * 0.6) * 0.12;
    },
    render() {
      renderer.render(scene, camera);
    },
  }).start();

  return { react, setVisible: (v) => (otter.visible = v) };
}

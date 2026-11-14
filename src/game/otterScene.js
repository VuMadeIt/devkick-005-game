// 3D stage behind the UI: a grey-box otter on a Highland hill until lane 3's Meshy otter lands.
// If public/assets/models/otter.glb exists it replaces the placeholder automatically.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createLoop } from './loop.js';

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b9c3cc'); // overcast Glasgow sky (Rosebud skybox replaces it)
  scene.fog = new THREE.Fog('#b9c3cc', 22, 85);
  // soft reflections so the wet paving and windows catch the grey sky (cheap: one prefiltered env map)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4;

  // Rain: one draw call of short falling streaks around the camera
  const RAIN = window.innerWidth < 900 ? 900 : 1800;
  const rainPos = new Float32Array(RAIN * 6);
  const rainSpeed = new Float32Array(RAIN);
  const drop = (i, anyHeight) => {
    const x = (Math.random() - 0.5) * 30;
    const z = 9 - Math.random() * 40;
    const y = anyHeight ? Math.random() * 16 : 16 + Math.random() * 2;
    rainPos.set([x, y, z, x - 0.04, y + 0.45, z], i * 6);
    rainSpeed[i] = 16 + Math.random() * 6;
  };
  for (let i = 0; i < RAIN; i += 1) drop(i, true);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(
    rainGeo,
    new THREE.LineBasicMaterial({ color: '#dfe7ee', transparent: true, opacity: 0.6, fog: true }),
  );
  rain.frustumCulled = false;
  scene.add(rain);
  const updateRain = (dt) => {
    for (let i = 0; i < RAIN; i += 1) {
      const dy = rainSpeed[i] * dt;
      const o = i * 6;
      rainPos[o + 1] -= dy;
      rainPos[o + 4] -= dy;
      rainPos[o] -= dy * 0.08;
      rainPos[o + 3] -= dy * 0.08;
      if (rainPos[o + 1] < 0) drop(i, false);
    }
    rainGeo.attributes.position.needsUpdate = true;
  };
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 2.3, 8.2);
  camera.lookAt(0, 1.1, -2); // otter in the upper-middle, clear of the prompt card; street recedes behind

  scene.add(new THREE.HemisphereLight('#f4f1ea', '#5d5a57', 1.7));
  const sun = new THREE.DirectionalLight('#fff1dc', 1.6);
  sun.position.set(4, 8, 5);
  scene.add(sun);

  // Low-poly Glasgow street placeholder (Sadman's Meshy/Blender glasgow.glb replaces it)
  const street = new THREE.Group();
  const flat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });
  const road = new THREE.Mesh(new THREE.BoxGeometry(60, 0.2, 60), flat('#4a4d52'));
  road.position.y = -0.1;
  const pavement = new THREE.Mesh(new THREE.BoxGeometry(60, 0.3, 4), flat('#9a958c'));
  pavement.position.set(0, -0.05, 0.5);
  street.add(road, pavement);
  // tenement row behind the otter: red and blond sandstone, 4 storeys, bay windows
  const stone = ['#a0473a', '#c9a46c', '#8f3f34', '#d1b07a', '#9c4a3b'];
  const glass = flat('#3a4a5a');
  for (let i = 0; i < 7; i += 1) {
    const x = (i - 3) * 6.2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(6, 11, 4), flat(stone[i % stone.length]));
    b.position.set(x, 5.5, -5);
    street.add(b);
    for (let f = 0; f < 4; f += 1) {
      for (const wx of [-1.8, 0, 1.8]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(1, 1.4, 0.1), glass);
        w.position.set(x + wx, 1.6 + f * 2.5, -2.95);
        street.add(w);
      }
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.5, 4.2), flat('#3b3a40'));
    roof.position.set(x, 11.2, -5);
    street.add(roof);
  }
  // lamp posts
  for (const x of [-4.5, 4.5]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6), flat('#2b2e33'));
    pole.position.set(x, 1.6, 1.6);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), flat('#ffe7a6'));
    lamp.position.set(x, 3.3, 1.6);
    street.add(pole, lamp);
  }
  // the statue with the traffic cone (Glasgow's best-known joke)
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.4), flat('#7d7a74'));
  plinth.position.set(-6.5, 0.8, -1.5);
  const rider = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 4, 8), flat('#4e5a52'));
  rider.position.set(-6.5, 2.3, -1.5);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 8), flat('#f26b21'));
  cone.position.set(-6.5, 3.3, -1.5);
  street.add(plinth, rider, cone);
  scene.add(street);
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(
    'assets/models/glasgow.glb',
    (gltf) => {
      scene.remove(street);
      scene.add(gltf.scene);
    },
    undefined,
    () => {},
  );

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
      // Meshy animations: match clips by name so any naming works (idle, talk, cheer/happy, angry/sad...)
      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(model);
        const find = (...words) =>
          gltf.animations.find((c) => words.some((w) => c.name.toLowerCase().includes(w)));
        const idle = find('idle', 'stand', 'breath') || gltf.animations[0];
        clips = {
          idle,
          talk: find('talk', 'speak', 'gesture', 'explain') || idle,
          good: find('cheer', 'happy', 'clap', 'jump', 'dance', 'victory') || idle,
          ok: find('think', 'shrug', 'nod', 'look') || idle,
          bad: find('angry', 'sad', 'disappoint', 'shake', 'no') || idle,
          suspicious: find('suspicious', 'angry', 'look', 'think') || idle,
        };
        playClip('idle');
      }
    },
    undefined,
    () => {},
  );

  let mixer = null;
  let clips = null;
  let current = null;
  function playClip(name) {
    if (!mixer || !clips?.[name]) return;
    const next = mixer.clipAction(clips[name]);
    if (current === next) return;
    next.reset().fadeIn(0.2).play();
    current?.fadeOut(0.2);
    current = next;
  }

  // Reactions: 'idle' | 'talk' | 'good' | 'ok' | 'bad' | 'suspicious'
  let mood = 'idle';
  let moodT = 0;
  let t = 0;
  const react = (m) => {
    mood = m;
    moodT = 0;
    playClip(m);
  };

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  createLoop({
    update(dt) {
      mixer?.update(dt);
      updateRain(dt);
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

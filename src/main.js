// Entry point. Placeholder scene that proves the build, render loop and resize work.
// Replace the contents of src/game/ with the real game once the idea is picked.
import * as THREE from 'three';
import { createLoop } from './game/loop.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap for phone performance
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1b2230');
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 4, 8);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight('#ffffff', '#334', 1.2));
const sun = new THREE.DirectionalLight('#ffffff', 1.5);
sun.position.set(5, 10, 4);
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.CylinderGeometry(4, 4, 0.5, 48),
  new THREE.MeshStandardMaterial({ color: '#8a93a6' }),
);
floor.position.y = -0.25;
scene.add(floor);

const box = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: '#f2b134' }),
);
box.position.y = 0.5;
scene.add(box);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

createLoop({
  update(dt) {
    box.rotation.y += dt;
  },
  render() {
    renderer.render(scene, camera);
  },
}).start();

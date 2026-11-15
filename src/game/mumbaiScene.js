// Mumbai set for the 3D stage (preview): a warm-evening street, no rain. Built from boxes like the
// Glasgow placeholder; returns a group the stage shows when Mumbai is picked.
import * as THREE from 'three';

export function buildMumbaiSet() {
  const set = new THREE.Group();
  const flat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });
  const road = new THREE.Mesh(new THREE.BoxGeometry(60, 0.2, 60), flat('#5a5048'));
  road.position.y = -0.1;
  const pavement = new THREE.Mesh(new THREE.BoxGeometry(60, 0.3, 4), flat('#b59f86'));
  pavement.position.set(0, -0.05, 0.5);
  set.add(road, pavement);
  const walls = ['#e8c07a', '#d98c6a', '#9fc2b5', '#f0d9b5', '#c97b84'];
  for (let i = 0; i < 7; i += 1) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(6, 10, 4), flat(walls[i % walls.length]));
    b.position.set((i - 3) * 6.2, 5, -5);
    set.add(b);
  }
  return set;
}

// Warm evening light: dusk (low trust) to golden hour (high trust).
export const MUMBAI_SKY = { low: '#d9926b', high: '#f4c27f' };

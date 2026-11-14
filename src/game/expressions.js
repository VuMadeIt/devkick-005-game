// Face expressions for the Meshy otter: its rig moves the body only, so the face gets eyebrows and blush
// attached to the head bone. Moods: idle, talk, good (happy + blush), ok (one brow up), bad / suspicious (angry V).
import * as THREE from 'three';

const POSES = {
  //          y lift, inner-end tilt (rad, + = inner end up), left extra lift, blush
  idle: { lift: 0, tilt: 0.05, left: 0, blush: 0 },
  talk: { lift: 0.15, tilt: 0.1, left: 0, blush: 0 },
  good: { lift: 0.45, tilt: 0.3, left: 0, blush: 1 },
  ok: { lift: 0.05, tilt: 0, left: 0.45, blush: 0 },
  bad: { lift: -0.25, tilt: -0.45, left: 0, blush: 0 },
  suspicious: { lift: -0.15, tilt: -0.35, left: 0.25, blush: 0 },
};

export function addExpressions(model) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const H = box.max.y - box.min.y;
  const cx = (box.min.x + box.max.x) / 2;
  let head = null;
  model.traverse((o) => {
    if (o.isBone && /head$/i.test(o.name) && !head) head = o;
  });
  // find the face surface in front of each eye with a ray from the front
  const meshes = [];
  model.traverse((o) => o.isMesh && meshes.push(o));
  const ray = new THREE.Raycaster();
  const faceZ = (x, y) => {
    ray.set(new THREE.Vector3(x, y, box.max.z + 1), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObjects(meshes, false)[0];
    return hit ? hit.point.z : box.max.z;
  };
  const browY = box.min.y + 0.775 * H;
  const eyeDX = 0.1 * H;
  const parent = head || model;
  const ink = new THREE.MeshBasicMaterial({ color: '#1a120c' });
  const blushMat = new THREE.MeshBasicMaterial({ color: '#ff6f8a', transparent: true, opacity: 0, depthWrite: false });
  const browGeo = new THREE.CapsuleGeometry(0.012 * H, 0.055 * H, 4, 8);
  const brows = [-1, 1].map((side) => {
    const x = cx + side * eyeDX;
    const world = new THREE.Vector3(x, browY, faceZ(x, browY) + 0.004 * H);
    const b = new THREE.Mesh(browGeo, ink);
    b.rotation.z = Math.PI / 2;
    const pivot = new THREE.Group();
    pivot.position.copy(parent.worldToLocal(world.clone()));
    // cancel the bone's rotation/scale so the brow keeps its world size and faces forward
    const q = new THREE.Quaternion();
    parent.getWorldQuaternion(q);
    pivot.quaternion.copy(q.invert());
    const s = new THREE.Vector3();
    parent.getWorldScale(s);
    pivot.scale.set(1 / s.x, 1 / s.y, 1 / s.z);
    pivot.add(b);
    parent.add(pivot);
    return { pivot, mesh: b, side, base: pivot.position.clone() };
  });
  const blushes = [-1, 1].map((side) => {
    const x = cx + side * 0.15 * H;
    const y = box.min.y + 0.69 * H;
    const world = new THREE.Vector3(x, y, faceZ(x, y) + 0.006 * H);
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.035 * H, 16), blushMat);
    const g = new THREE.Group();
    g.position.copy(parent.worldToLocal(world));
    g.quaternion.copy(brows[0].pivot.quaternion);
    g.scale.copy(brows[0].pivot.scale);
    g.add(m);
    parent.add(g);
    return g;
  });

  let target = POSES.idle;
  const cur = { ...POSES.idle };
  let t = 0;
  return {
    set(mood) {
      target = POSES[mood] || POSES.idle;
    },
    update(dt) {
      t += dt;
      const k = 1 - Math.exp(-dt * 12);
      for (const key of Object.keys(cur)) cur[key] += (target[key] - cur[key]) * k;
      const wiggle = target === POSES.talk ? Math.sin(t * 9) * 0.08 : 0;
      for (const b of brows) {
        const lift = (cur.lift + wiggle + (b.side < 0 ? cur.left : 0)) * 0.05 * H;
        // move up in world space: brow pivots are counter-rotated, so local y is world y
        b.mesh.position.y = lift / Math.max(b.pivot.scale.y, 1e-6) * b.pivot.scale.y;
        b.mesh.rotation.y = 0;
        b.mesh.rotation.x = 0;
        b.mesh.rotation.z = Math.PI / 2 - b.side * cur.tilt;
      }
      blushMat.opacity = cur.blush * 0.45;
      void blushes;
    },
  };
}

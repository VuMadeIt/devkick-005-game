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
  const browY = box.min.y + 0.785 * H;
  const eyeDX = 0.1 * H;
  const parent = head || model;
  const ink = new THREE.MeshBasicMaterial({ color: '#1a120c' });
  const blushMat = new THREE.MeshBasicMaterial({ color: '#ff6f8a', transparent: true, opacity: 0, depthWrite: false });
  const browGeo = new THREE.CapsuleGeometry(0.019 * H, 0.075 * H, 4, 10);
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

  const facePart = (mesh, x, y, push) => {
    const world = new THREE.Vector3(x, y, faceZ(x, y) + push * H);
    const g = new THREE.Group();
    g.position.copy(parent.worldToLocal(world));
    g.quaternion.copy(brows[0].pivot.quaternion);
    g.scale.copy(brows[0].pivot.scale);
    g.add(mesh);
    parent.add(g);
    return g;
  };

  // mouth: a dark opening with a tongue, under the nose; opens with the voice
  const mouthY = box.min.y + 0.648 * H;
  const mouth = new THREE.Mesh(
    new THREE.CircleGeometry(0.03 * H, 20),
    new THREE.MeshBasicMaterial({ color: '#3a1411' }),
  );
  const tongue = new THREE.Mesh(
    new THREE.CircleGeometry(0.016 * H, 16),
    new THREE.MeshBasicMaterial({ color: '#e0707a' }),
  );
  tongue.position.set(0, -0.012 * H, 0.001 * H);
  mouth.add(tongue);
  facePart(mouth, cx, mouthY, 0.008);
  mouth.scale.set(1, 0.001, 1);

  // eyelids in fur colour that close over the eyes for blinks
  const eyeY = box.min.y + 0.722 * H;
  const lidR = 0.05 * H;
  const lidMat = new THREE.MeshBasicMaterial({ color: '#d98f45' });
  const lids = [-1, 1].map((side) => {
    const lid = new THREE.Mesh(new THREE.CircleGeometry(lidR, 20), lidMat);
    facePart(lid, cx + side * 0.103 * H, eyeY, 0.012);
    lid.scale.set(1, 0.001, 1);
    return lid;
  });
  let nextBlink = 1.5 + Math.random() * 2;
  let blinkT = -1;

  let target = POSES.idle;
  const cur = { ...POSES.idle };
  let t = 0;
  return {
    set(mood) {
      target = POSES[mood] || POSES.idle;
    },
    update(dt, level = 0) {
      t += dt;
      // mouth follows the voice loudness, smoothed so it reads as syllables
      const open = Math.min(1, level * 1.4);
      mouth.userData.o = (mouth.userData.o || 0) + (open - (mouth.userData.o || 0)) * Math.min(1, dt * 22);
      const o = mouth.userData.o;
      mouth.scale.set(0.75 + 0.35 * o, Math.max(0.001, o), 1);
      // blinks every 2-5 s (and a double blink now and then)
      nextBlink -= dt;
      if (nextBlink <= 0 && blinkT < 0) {
        blinkT = 0;
        nextBlink = 2 + Math.random() * 3 + (Math.random() < 0.2 ? -1.8 : 0);
      }
      let b = 0;
      if (blinkT >= 0) {
        blinkT += dt;
        b = blinkT < 0.07 ? blinkT / 0.07 : blinkT < 0.16 ? 1 - (blinkT - 0.07) / 0.09 : 0;
        if (blinkT >= 0.16) blinkT = -1;
      }
      // a happy squint on good answers, a narrowed look when annoyed
      const hold = target === POSES.good ? 0.35 : target === POSES.bad || target === POSES.suspicious ? 0.3 : 0;
      const lid = Math.max(b, hold);
      for (const l of lids) {
        l.scale.y = Math.max(0.001, lid);
        l.position.y = lidR * (1 - lid);
      }
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

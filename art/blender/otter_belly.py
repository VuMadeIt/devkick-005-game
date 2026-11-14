# Paints the Devin otter's cream belly patch, perfectly centred, onto the Meshy texture, then optimises the
# model for the web and exports public/assets/models/otter.glb (rig + animations kept).
# Run: blender -b -P art/blender/otter_belly.py -- <meshy_download.glb>
import bpy
import math
import os
import sys

import numpy as np

SRC = sys.argv[sys.argv.index('--') + 1]
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'assets', 'models', 'otter.glb'))
CREAM = np.array([0.93, 0.84, 0.68])  # muzzle tan, sRGB 0..1
TEX = 1024  # web texture size

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
print('OTTER: meshes', [m.name for m in meshes], 'anims', [a.name for a in bpy.data.actions])
ob = max(meshes, key=lambda o: len(o.data.polygons))
me = ob.data

# rest-pose world coordinates
coords = np.array([ob.matrix_world @ v.co for v in me.vertices])
mn, mx = coords.min(0), coords.max(0)
H = mx[2] - mn[2]
cx = (mn[0] + mx[0]) / 2
# which way is the front? Meshy faces glTF +Z = Blender -Y. Check the muzzle side: the front has the
# furthest-forward vertices around head height.
head = coords[coords[:, 2] > mn[2] + 0.6 * H]
front_sign = -1 if abs(head[:, 1].min() - (mn[1] + mx[1]) / 2) > abs(head[:, 1].max() - (mn[1] + mx[1]) / 2) else 1
print('OTTER: H', round(H, 3), 'cx', round(cx, 3), 'front_sign', front_sign)

ZC = mn[2] + 0.47 * H  # belly centre height (between chin ~0.56H and kilt top ~0.36H)
RX, RZ = 0.085 * H, 0.095 * H

# base colour image
img = None
for slot in ob.material_slots:
    for n in slot.material.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image is not None:
            links = [l for l in slot.material.node_tree.links if l.from_node == n]
            if any(l.to_socket.name == 'Base Color' for l in links):
                img = n.image
assert img is not None, 'no base colour texture'
w, h = img.size
px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
print('OTTER: texture', img.name, w, h)

uv = me.uv_layers.active.data
me.calc_loop_triangles()
painted = 0
for tri in me.loop_triangles:
    p = coords[list(tri.vertices)]
    c = p.mean(0)
    if abs(c[0] - cx) > RX * 1.6 or abs(c[2] - ZC) > RZ * 1.6:
        continue
    n = (ob.matrix_world.to_3x3() @ tri.normal)
    if n[1] * front_sign < 0.25:  # must face the front
        continue
    t = np.array([uv[l].uv[:] for l in tri.loops]) * [w, h]
    x0, y0 = np.floor(t.min(0)).astype(int)
    x1, y1 = np.ceil(t.max(0)).astype(int)
    xs, ys = np.meshgrid(np.arange(max(x0, 0), min(x1 + 1, w)), np.arange(max(y0, 0), min(y1 + 1, h)))
    P = np.stack([xs + 0.5, ys + 0.5], -1).reshape(-1, 2)
    (ax, ay), (bx, by), (qx, qy) = t
    det = (by - qy) * (ax - qx) + (qx - bx) * (ay - qy)
    if abs(det) < 1e-9:
        continue
    l1 = ((by - qy) * (P[:, 0] - qx) + (qx - bx) * (P[:, 1] - qy)) / det
    l2 = ((qy - ay) * (P[:, 0] - qx) + (ax - qx) * (P[:, 1] - qy)) / det
    l3 = 1 - l1 - l2
    inside = (l1 >= -0.02) & (l2 >= -0.02) & (l3 >= -0.02)
    if not inside.any():
        continue
    P3 = l1[inside, None] * p[0] + l2[inside, None] * p[1] + l3[inside, None] * p[2]
    d = np.sqrt(((P3[:, 0] - cx) / RX) ** 2 + ((P3[:, 2] - ZC) / RZ) ** 2)
    a = np.clip((1.08 - d) / 0.22, 0, 1)  # soft fluffy edge
    if not (a > 0).any():
        continue
    pi = P[inside].astype(int)
    col = px[pi[:, 1], pi[:, 0], :3]
    lum = col.mean(1, keepdims=True)
    detail = np.clip(lum / max(float(lum.mean()), 1e-3), 0.75, 1.2)  # keep the fur's light/dark texture
    new = np.clip(CREAM * detail, 0, 1)
    px[pi[:, 1], pi[:, 0], :3] = col * (1 - a[:, None]) + new * a[:, None]
    painted += int((a > 0).sum())
print('OTTER: painted pixels', painted)
img.pixels[:] = px.ravel()
img.update()
if w > TEX:
    img.scale(TEX, TEX)
img.file_format = 'JPEG'
img.pack()

# keep only one mesh? leave rig + all meshes; export
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_animations=True, export_image_format='JPEG',
                          export_jpeg_quality=85)
print('OTTER: wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')

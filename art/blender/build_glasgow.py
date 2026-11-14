# Builds a detailed but web-light Glasgow street (Buchanan Street style, from Sadman's trip photos in
# art/ref/glasgow/) and exports public/assets/models/glasgow.glb.
# Run: blender -b -P art/blender/build_glasgow.py
# Detail comes from real geometry (bay windows, window surrounds, sills, cornices, chimneys, ornate lamps,
# a domed corner building); everything merges into one mesh with a handful of shared materials so the
# browser draws it in ~20 draw calls.
import bpy
import math
import os
import random

random.seed(14)
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'assets', 'models', 'glasgow.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------- textures (procedural, small repeats: granite setts and ashlar stone) ----------
import numpy as np

TEX_DIR = os.path.join(os.path.dirname(__file__), '..', 'tex')
os.makedirs(TEX_DIR, exist_ok=True)
rng = np.random.default_rng(14)


def save_tex(name, rgb):
    h, w, _ = rgb.shape
    img = bpy.data.images.new(name, w, h, alpha=False)
    rgba = np.concatenate([np.clip(rgb, 0, 1), np.ones((h, w, 1))], axis=2)
    img.pixels.foreach_set(rgba[::-1].astype(np.float32).ravel())
    path = os.path.abspath(os.path.join(TEX_DIR, name + '.jpg'))
    img.filepath_raw = path
    img.file_format = 'JPEG'
    img.save()
    img.pack()
    return img


def hexl(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def noise(n, scale):
    small = rng.random((n // scale + 2, n // scale + 2))
    big = np.kron(small, np.ones((scale, scale)))[:n, :n]
    return big


def paving_tex(n=512):
    # 2.4 m square: setts 0.6 x 0.3 m (4 across, 8 down), running bond, warm pink/grey granite like Buchanan St
    cols = [hexl('#8d6b63'), hexl('#7b7372'), hexl('#9c8a82'), hexl('#6a5f5d'), hexl('#a07a6c'), hexl('#837e7e')]
    img = np.zeros((n, n, 3))
    rows, per = 8, 4
    rh, cw = n // rows, n // per
    for r in range(rows):
        off = (cw // 2) if r % 2 else 0
        for c in range(-1, per + 1):
            x0 = c * cw + off
            col = cols[rng.integers(len(cols))] * rng.uniform(0.9, 1.08)
            xs = slice(max(0, x0), min(n, x0 + cw))
            if xs.start >= xs.stop:
                continue
            img[r * rh:(r + 1) * rh, xs] = col
            img[r * rh:(r + 1) * rh, xs.start:xs.start + 2] = hexl('#3a3434')
        img[r * rh:r * rh + 2, :] = hexl('#3a3434')
    speck = rng.random((n, n, 1))
    img *= 0.88 + 0.2 * speck  # granite grain
    img *= (0.92 + 0.12 * noise(n, 32))[..., None]  # wet patches / wear
    return img


def stone_tex(base, n=512):
    # 3 m square of ashlar: courses 0.375 m (8), blocks 0.75-1.5 m, thin darker joints, soot streaks
    b = hexl(base)
    img = np.ones((n, n, 3)) * b
    rows = 8
    rh = n // rows
    for r in range(rows):
        x = -rng.integers(0, 120)
        while x < n:
            w = int(rng.integers(128, 256))
            xs = slice(max(0, x), min(n, x + w))
            if xs.start < xs.stop:
                img[r * rh:(r + 1) * rh, xs] *= rng.uniform(0.9, 1.08)
                img[r * rh:(r + 1) * rh, xs.start:xs.start + 2] = b * 0.62
            x += w
        img[r * rh:r * rh + 2, :] = b * 0.62
    img *= (0.9 + 0.14 * rng.random((n, n, 1)))
    streak = np.kron(rng.random((1, n // 8)), np.ones((n, 8)))
    img *= (0.88 + 0.12 * (streak * 0.6 + noise(n, 64) * 0.4))[..., None]
    return img


TEX = {
    'paving': save_tex('paving_setts', paving_tex()),
    'red': save_tex('stone_red', stone_tex('#9a4a3c')),
    'blond': save_tex('stone_blond', stone_tex('#c4a173')),
    'grey': save_tex('stone_grey', stone_tex('#a39b8e')),
}
UV_SCALE = {'paving_setts': 2.4, 'red_sandstone': 3.0, 'blond_sandstone': 3.0, 'grey_stone': 3.0}

# ---------- materials ----------
MATS = {}


def tmat(name, img, rough=0.85):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = img
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    MATS[name] = m
    return m


def mat(name, color, rough=0.85, metal=0.0, emit=None):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = 2.0
    MATS[name] = m
    return m


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


RED = tmat('red_sandstone', TEX['red'])
RED_TRIM = mat('red_sandstone_trim', srgb('#b56452'))
BLOND = tmat('blond_sandstone', TEX['blond'])
BLOND_TRIM = mat('blond_sandstone_trim', srgb('#dcc297'))
GREY = tmat('grey_stone', TEX['grey'])
GLASS = mat('window_glass', srgb('#2b3640'), rough=0.08, metal=0.6)
SHOPGLASS = mat('shop_glass', srgb('#2a3238'), rough=0.05, metal=0.5)
FRAME = mat('white_frame', srgb('#ece6da'), rough=0.6)
SLATE = mat('slate_roof', srgb('#4a4b52'), rough=0.7)
CHIMNEY_POT = mat('chimney_pot', srgb('#a8573a'))
IRON = mat('black_iron', srgb('#1c1e22'), rough=0.45, metal=0.7)
LAMP = mat('lamp_glow', srgb('#ffe2a0'), rough=0.3, emit=srgb('#ffd27a'))
PAVE = tmat('paving_setts', TEX['paving'], rough=0.2)
STEEL = mat('brushed_steel', srgb('#9ea3a8'), rough=0.3, metal=0.9)
POLE = mat('lamp_column_grey', srgb('#6d7176'), rough=0.5, metal=0.5)
PLANTER = mat('planter_black', srgb('#16181a'), rough=0.6)
BANNER = mat('banner_navy', srgb('#141b2e'), rough=0.7)
SCREEN = mat('kiosk_screen', srgb('#3aa0d8'), rough=0.2, emit=srgb('#4ab0e8'))
GRATE = mat('drain_grate', srgb('#2a2a2c'), rough=0.6, metal=0.6)
KERB = mat('kerb', srgb('#7a7672'))
LEAF = mat('leaf', srgb('#4f7a3a'), rough=0.9)
BARK = mat('bark', srgb('#4a3a2c'))
WOOD = mat('bench_wood', srgb('#7a5534'))
SIGNS = [mat('sign_black', srgb('#1a1b1d'), rough=0.4), mat('sign_cream', srgb('#e6dfd2'), rough=0.5),
         mat('sign_navy', srgb('#1f2a44'), rough=0.5), mat('sign_green', srgb('#23382c'), rough=0.5),
         mat('sign_charcoal', srgb('#3a3b3e'), rough=0.4, metal=0.3)]
CONE = mat('traffic_cone', srgb('#f26b21'), rough=0.5)
BRONZE = mat('statue_bronze', srgb('#3f4a40'), rough=0.5, metal=0.6)
FLOWERS = mat('flowers', srgb('#c8508a'), rough=0.9)
SUBWAY = mat('subway_orange', srgb('#ff6a13'), rough=0.5)

# ---------- geometry accumulator (one merged mesh) ----------
verts, faces, fmats = [], [], []
mat_index = {}


def mi(m):
    if m.name not in mat_index:
        mat_index[m.name] = len(mat_index)
    return mat_index[m.name]


def add(vs, fs, m):
    o = len(verts)
    verts.extend(vs)
    k = mi(m)
    for f in fs:
        faces.append(tuple(i + o for i in f))
        fmats.append(k)


def box(m, x0, y0, z0, x1, y1, z1):
    vs = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
          (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    fs = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    add(vs, fs, m)


def cbox(m, cx, cy, cz, sx, sy, sz):
    box(m, cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2)


def cyl(m, cx, cy, z0, r0, h, seg=12, r1=None, cap=True):
    r1 = r0 if r1 is None else r1
    vs = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        vs.append((cx + r0 * math.cos(a), cy + r0 * math.sin(a), z0))
    for i in range(seg):
        a = 2 * math.pi * i / seg
        vs.append((cx + r1 * math.cos(a), cy + r1 * math.sin(a), z0 + h))
    fs = [(i, (i + 1) % seg, seg + (i + 1) % seg, seg + i) for i in range(seg)]
    if cap:
        fs.append(tuple(reversed(range(seg))))
        if r1 > 0:
            fs.append(tuple(range(seg, 2 * seg)))
    add(vs, fs, m)


def dome(m, cx, cy, z0, r, seg=16, rings=6, squash=1.0):
    vs = [(cx, cy, z0 + r * squash)]
    for j in range(1, rings + 1):
        p = (math.pi / 2) * j / rings
        for i in range(seg):
            a = 2 * math.pi * i / seg
            vs.append((cx + r * math.sin(p) * math.cos(a), cy + r * math.sin(p) * math.sin(a), z0 + r * squash * math.cos(p)))
    fs = [(0, 1 + i, 1 + (i + 1) % seg) for i in range(seg)]
    for j in range(rings - 1):
        a0 = 1 + j * seg
        a1 = 1 + (j + 1) * seg
        for i in range(seg):
            fs.append((a0 + i, a1 + i, a1 + (i + 1) % seg, a0 + (i + 1) % seg))
    add(vs, fs, m)


def blob(m, cx, cy, cz, r):
    # rounded leaf clump: an icosphere-ish dome pair
    dome(m, cx, cy, cz, r, seg=10, rings=4)
    vs_before = len(verts)
    dome(m, cx, cy, cz, r, seg=10, rings=4, squash=-0.6)
    # flip winding of the lower half
    for k in range(len(faces) - 10 - 30, len(faces)):
        faces[k] = tuple(reversed(faces[k]))
    _ = vs_before


def prism_roof(m, x0, x1, y0, y1, z, h):
    # ridge along y, slopes toward x
    xm = (x0 + x1) / 2
    vs = [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z), (xm, y0, z + h), (xm, y1, z + h)]
    fs = [(0, 1, 4), (2, 3, 5), (1, 2, 5, 4), (3, 0, 4, 5), (0, 3, 2, 1)]
    add(vs, fs, m)


# ---------- the street ----------
HALF = 7.0  # facades at x = +/-7 (pedestrian street ~14 m wide)
Y0, Y1 = -14.0, 86.0
TILE = 1.25

# paving: per-tile colours like Buchanan Street's pink/grey granite
add([(-HALF, Y0, 0), (HALF, Y0, 0), (HALF, Y1, 0), (-HALF, Y1, 0)], [(0, 1, 2, 3)], PAVE)
for (gx, gy) in ((1.8, 2.0), (-2.6, 14.0), (2.2, 30.0), (-1.5, 47.0), (2.8, 61.0)):
    box(GRATE, gx - 0.9, gy - 0.45, 0, gx + 0.9, gy + 0.45, 0.01)  # drain / utility covers
for s in (-1, 1):
    box(KERB, s * HALF - 0.15, Y0, -0.05, s * HALF + 0.15, Y1, 0.06)


def window(side, fx, y, z, w, h, stone_trim, fancy):
    """side=+1 facade faces -x (right side of street), -1 faces +x."""
    d = -side  # outward direction (toward street centre)
    # surround
    xs = fx + d * 0.05
    box(stone_trim, min(fx, xs), y - w / 2 - 0.14, z - 0.12, max(fx, xs), y + w / 2 + 0.14, z + h + 0.12)
    # glass (slightly recessed look: sits just proud of the surround's inner area)
    xg = fx + d * 0.07
    box(GLASS, min(xs, xg), y - w / 2, z, max(xs, xg), y + w / 2, z + h)
    # sash frame: centre mullion + transom
    xf = fx + d * 0.09
    box(FRAME, min(xg, xf), y - 0.03, z, max(xg, xf), y + 0.03, z + h)
    box(FRAME, min(xg, xf), y - w / 2, z + h * 0.62 - 0.03, max(xg, xf), y + w / 2, z + h * 0.62 + 0.03)
    # sill
    xsl = fx + d * 0.22
    box(stone_trim, min(fx, xsl), y - w / 2 - 0.2, z - 0.2, max(fx, xsl), y + w / 2 + 0.2, z - 0.08)
    # lintel / pediment
    if fancy:
        xl = fx + d * 0.2
        box(stone_trim, min(fx, xl), y - w / 2 - 0.25, z + h + 0.12, max(fx, xl), y + w / 2 + 0.25, z + h + 0.3)
        # small triangular pediment
        ym = y
        zb = z + h + 0.3
        vs = [(fx, ym - w / 2 - 0.25, zb), (fx, ym + w / 2 + 0.25, zb), (fx, ym, zb + 0.45),
              (xl, ym - w / 2 - 0.25, zb), (xl, ym + w / 2 + 0.25, zb), (xl, ym, zb + 0.45)]
        add(vs, [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)], stone_trim)


def building(side, y0, width):
    fx = side * HALF
    depth = 9.0
    red = random.random() < 0.45
    body = RED if red else (BLOND if random.random() < 0.75 else GREY)
    trim = RED_TRIM if red else BLOND_TRIM
    floors = random.choice([5, 5, 6, 6, 7])
    gf = 4.6
    fh = 3.5
    top = gf + floors * fh
    bx0, bx1 = (fx, fx + depth) if side > 0 else (fx - depth, fx)
    box(body, bx0, y0, 0, bx1, y0 + width, top)
    d = -side
    # rusticated ground floor band + shopfronts
    box(trim, min(fx, fx + d * 0.06), y0, 0, max(fx, fx + d * 0.06), y0 + width, gf)
    bays = max(1, int(width // 3.6))
    bw = width / bays
    sign = random.choice(SIGNS)
    for b in range(bays):
        yc = y0 + bw * (b + 0.5)
        box(SHOPGLASS, min(fx, fx + d * 0.1), yc - bw / 2 + 0.35, 0.3, max(fx, fx + d * 0.1), yc + bw / 2 - 0.35, gf - 1.2)
        box(sign, min(fx, fx + d * 0.18), yc - bw / 2 + 0.25, gf - 1.1, max(fx, fx + d * 0.18), yc + bw / 2 - 0.25, gf - 0.45)
        # pilaster
        box(trim, min(fx, fx + d * 0.2), y0 + bw * b - 0.18, 0, max(fx, fx + d * 0.2), y0 + bw * b + 0.18, gf - 0.3)
    box(trim, min(fx, fx + d * 0.2), y0 + width - 0.18, 0, max(fx, fx + d * 0.2), y0 + width + 0.18, gf - 0.3)
    # fascia cornice over shops
    box(trim, min(fx, fx + d * 0.35), y0, gf - 0.35, max(fx, fx + d * 0.35), y0 + width, gf)
    # bay window column (classic Glasgow tenement) on wider buildings
    has_bay = width > 8.5 and random.random() < 0.7
    bay_y = y0 + width / 2
    bay_w = 3.0
    ncols = max(3, int(width // 1.9))
    fancy = random.random() < 0.5
    for f in range(floors):
        z = gf + f * fh + 0.55
        wh = fh - 1.25 if f < floors - 1 else fh - 1.45
        for c in range(ncols):
            yc = y0 + width * (c + 0.5) / ncols
            if has_bay and abs(yc - bay_y) < bay_w / 2 + 0.6:
                continue
            window(side, fx, yc, z, 0.95, wh, trim, fancy and f in (0, 2))
        # string course
        zc = gf + (f + 1) * fh - 0.12
        box(trim, min(fx, fx + d * 0.12), y0, zc, max(fx, fx + d * 0.12), y0 + width, zc + 0.18)
    for c in range(0, ncols + 1, 2):
        yp = y0 + width * c / ncols
        box(trim, min(fx, fx + d * 0.16), yp - 0.16, gf, max(fx, fx + d * 0.16), yp + 0.16, top - 0.1)
    if has_bay:
        bfx = fx + d * 1.1
        box(body, min(fx, bfx), bay_y - bay_w / 2, gf, max(fx, bfx), bay_y + bay_w / 2, top - fh * 0.15)
        for f in range(floors):
            z = gf + f * fh + 0.55
            window(side, bfx, bay_y, z, 1.7, fh - 1.3, trim, False)
            zc = gf + (f + 1) * fh - 0.12
            box(trim, min(bfx, bfx + d * 0.12), bay_y - bay_w / 2, zc, max(bfx, bfx + d * 0.12), bay_y + bay_w / 2, zc + 0.18)
    # main cornice + balustrade parapet
    box(trim, min(fx, fx + d * 0.45), y0, top - 0.1, max(fx, fx + d * 0.45), y0 + width, top + 0.35)
    for k in range(int(width / 0.6)):
        yb = y0 + 0.3 + k * 0.6
        cyl(trim, fx + d * 0.25, yb, top + 0.35, 0.1, 0.55, seg=6)
    box(trim, min(fx, fx + d * 0.4), y0, top + 0.9, max(fx, fx + d * 0.4), y0 + width, top + 1.05)
    # slate roof + dormers + chimneys
    rx0, rx1 = (fx + 0.6, fx + depth) if side > 0 else (fx - depth, fx - 0.6)
    prism_roof(SLATE, rx0, rx1, y0, y0 + width, top, 2.6)
    if random.random() < 0.6:
        for k in range(max(1, int(width // 4))):
            yd = y0 + 2 + k * 4
            if yd > y0 + width - 1.5:
                break
            dx = fx + side * 1.8
            box(SLATE, min(dx, dx + side * 1.4), yd - 0.7, top + 0.2, max(dx, dx + side * 1.4), yd + 0.7, top + 1.7)
            window(side, dx, yd, top + 0.45, 0.8, 0.95, FRAME, False)
    for yc in (y0 + 0.4, y0 + width - 0.4):
        cx = fx + side * (depth * 0.55)
        box(body, cx - 0.5, yc - 0.6, top + 1.4, cx + 0.5, yc + 0.6, top + 3.6)
        box(trim, cx - 0.6, yc - 0.7, top + 3.6, cx + 0.6, yc + 0.7, top + 3.8)
        for p in range(3):
            cyl(CHIMNEY_POT, cx, yc - 0.4 + p * 0.4, top + 3.8, 0.13, 0.5, seg=8)
    return top


for side in (-1, 1):
    y = Y0 - 4
    while y < Y1 - 6:
        w = random.uniform(7.5, 11.5)
        building(side, y, w)
        y += w


# domed corner building closing the vista (like the photos' corner building)
def domed_building(yc):
    w = 2 * HALF + 6
    d = 10
    gf = 4.8
    fh = 3.4
    floors = 4
    top = gf + floors * fh
    box(BLOND, -w / 2, yc, 0, w / 2, yc + d, top)
    for b in range(5):
        x = -w / 2 + w * (b + 0.5) / 5
        box(SHOPGLASS, x - 1.4, yc - 0.1, 0.3, x + 1.4, yc, gf - 1.0)
        dome(GLASS, x, yc - 0.01, gf - 1.0, 1.4, seg=12, rings=3)
    box(BLOND_TRIM, -w / 2, yc - 0.35, gf - 0.3, w / 2, yc, gf)
    for f in range(floors):
        z = gf + f * fh + 0.55
        for c in range(9):
            x = -w / 2 + w * (c + 0.5) / 9
            # facade faces -y here: build windows as thin boxes
            box(BLOND_TRIM, x - 0.65, yc - 0.05, z - 0.12, x + 0.65, yc, z + fh - 1.1)
            box(GLASS, x - 0.5, yc - 0.08, z, x + 0.5, yc - 0.05, z + fh - 1.35)
            box(FRAME, x - 0.03, yc - 0.1, z, x + 0.03, yc - 0.08, z + fh - 1.35)
            box(BLOND_TRIM, x - 0.7, yc - 0.22, z - 0.2, x + 0.7, yc, z - 0.08)
        box(BLOND_TRIM, -w / 2, yc - 0.12, gf + (f + 1) * fh - 0.12, w / 2, yc, gf + (f + 1) * fh + 0.06)
    box(BLOND_TRIM, -w / 2, yc - 0.45, top - 0.1, w / 2, yc, top + 0.4)
    # central tower + dome + lantern + spire
    box(BLOND, -2.6, yc - 0.6, top, 2.6, yc + 4, top + 4.5)
    for x in (-1.3, 1.3):
        box(GLASS, x - 0.45, yc - 0.65, top + 1.2, x + 0.45, yc - 0.6, top + 3.6)
    box(BLOND_TRIM, -2.9, yc - 0.9, top + 4.5, 2.9, yc + 4.3, top + 5.0)
    cyl(BLOND_TRIM, 0, yc + 1.7, top + 5.0, 2.3, 0.8, seg=20)
    dome(SLATE, 0, yc + 1.7, top + 5.8, 2.3, seg=20, rings=7, squash=1.1)
    cyl(BLOND_TRIM, 0, yc + 1.7, top + 8.3, 0.5, 1.2, seg=10)
    dome(SLATE, 0, yc + 1.7, top + 9.5, 0.55, seg=10, rings=4)
    cyl(IRON, 0, yc + 1.7, top + 10.0, 0.05, 1.6, seg=6, r1=0.0)
    prism_roof(SLATE, -w / 2, w / 2, yc + 0.6, yc + d, top + 0.4, 0) if False else None


domed_building(Y1 - 6)


# ---------- street furniture ----------
def lamp(x, y):
    cyl(IRON, x, y, 0, 0.28, 0.6, seg=10, r1=0.2)
    cyl(IRON, x, y, 0.6, 0.09, 4.2, seg=8, r1=0.07)
    for k in range(4):  # decorative rings
        cyl(IRON, x, y, 0.9 + k * 0.9, 0.12, 0.08, seg=8)
    box(IRON, x - 0.9, y - 0.05, 4.6, x + 0.9, y + 0.05, 4.7)
    for s in (-1, 1):
        lx = x + s * 0.85
        cyl(IRON, lx, y, 4.25, 0.05, 0.35, seg=6)
        cyl(LAMP, lx, y, 3.85, 0.18, 0.45, seg=6, r1=0.24)
        cyl(IRON, lx, y, 4.3, 0.27, 0.12, seg=6, r1=0.05)
    cyl(IRON, x, y, 4.8, 0.08, 0.5, seg=6, r1=0.0)


def tree(x, y, s=1.0):
    cyl(BARK, x, y, 0, 0.18 * s, 2.6 * s, seg=8, r1=0.12 * s)
    for (dx, dy, dz, r) in [(0, 0, 3.4, 1.4), (0.8, 0.3, 3.0, 0.95), (-0.7, -0.4, 3.1, 1.0), (0.2, -0.8, 3.8, 0.9), (-0.3, 0.7, 3.9, 0.85)]:
        blob(LEAF, x + dx * s, y + dy * s, dz * s, r * s)
    cyl(IRON, x, y, 0, 0.75, 0.08, seg=12)  # tree grate


def bench(x, y):
    box(WOOD, x - 0.25, y - 1.0, 0.42, x + 0.25, y + 1.0, 0.5)
    box(WOOD, x + 0.2, y - 1.0, 0.5, x + 0.27, y + 1.0, 0.95)
    for yy in (y - 0.85, y + 0.85):
        box(IRON, x - 0.25, yy - 0.04, 0, x + 0.27, yy + 0.04, 0.45)


def planter(x, y):
    box(GREY, x - 0.7, y - 0.7, 0, x + 0.7, y + 0.7, 0.7)
    blob(LEAF, x, y, 0.75, 0.7)
    for k in range(6):
        a = k * 1.05
        cbox(FLOWERS, x + 0.45 * math.cos(a), y + 0.45 * math.sin(a), 1.05, 0.22, 0.22, 0.22)


def column_lamp(x, y, side):
    # modern Buchanan St lighting column: tall grey pole, collar bands, angled arm with a flat lantern
    cyl(POLE, x, y, 0, 0.16, 9.0, seg=10, r1=0.11)
    for z in (3.0, 3.3):
        cyl(STEEL, x, y, z, 0.17, 0.12, seg=10)
    ax = x - side * 1.6
    box(POLE, min(x, ax), y - 0.05, 8.6, max(x, ax), y + 0.05, 8.72)
    box(STEEL, ax - 0.45, y - 0.3, 8.45, ax + 0.45, y + 0.3, 8.6)
    box(LAMP, ax - 0.4, y - 0.25, 8.42, ax + 0.4, y + 0.25, 8.45)


def black_planter(x, y):
    box(PLANTER, x - 1.0, y - 0.75, 0, x + 1.0, y + 0.75, 0.95)
    box(PLANTER, x - 1.05, y - 0.8, 0.95, x + 1.05, y + 0.8, 1.0)
    for k in range(5):
        blob(LEAF, x - 0.7 + k * 0.35, y + random.uniform(-0.3, 0.3), 1.0, 0.35)
    for k in range(7):
        cbox(FLOWERS, x + random.uniform(-0.8, 0.8), y + random.uniform(-0.55, 0.55), 1.3, 0.14, 0.14, 0.14)


def bollard(x, y):
    cyl(STEEL, x, y, 0, 0.09, 1.0, seg=10)
    cyl(STEEL, x, y, 1.0, 0.09, 0.04, seg=10, r1=0.07)


def kiosk(x, y, face):
    box(IRON, x - 0.1, y - 0.6, 0, x + 0.1, y + 0.6, 2.7)
    box(SCREEN, x + face * 0.1, y - 0.5, 0.9, x + face * 0.12, y + 0.5, 2.5)


def flagpole(fx, y, side, z):
    # angled flag pole out of the facade with a long dark banner (the shopfront flags in the photos)
    d = -side
    tip = fx + d * 2.0
    for k in range(6):
        t0, t1 = k / 6, (k + 1) / 6
        box(IRON, fx + d * 2.0 * t0 - 0.03, y - 0.03, z + 1.2 * t0, fx + d * 2.0 * t1 + 0.03, y + 0.03, z + 1.2 * t1 + 0.06)
    xb0, xb1 = fx + d * 0.6, tip
    add([(xb0, y, z + 0.36), (xb1, y, z + 1.2), (xb1, y, z - 0.4), (xb0, y, z - 1.0)], [(0, 1, 2, 3), (3, 2, 1, 0)], BANNER)


for y in range(0, 82, 15):
    column_lamp(-5.8, y, -1)
    column_lamp(5.8, y + 7, 1)
for y in (30, 58):
    lamp(0, y)
tree(-3.2, 40, 1.15)
tree(3.0, 66, 1.05)
for y in (24, 52):
    bench(-4.6, y)
for y in (16, 36, 56, 74):
    black_planter(-4.4, y)
    black_planter(4.4, y - 6)
for y in range(8, 84, 6):
    for x in (-2.4, 2.4):
        bollard(x + random.uniform(-0.3, 0.3), y + 3)
kiosk(4.9, 6, -1)
kiosk(-4.9, 34, 1)
for y in range(-4, 40, 3):
    flagpole(-HALF, y, -1, 6.4)
# overhead catenary wires across the street (they carry the lights in the photos)
for y in range(-2, 82, 9):
    box(IRON, -HALF, y - 0.01, 10.5, HALF, y + 0.01, 10.53)

# Glasgow Subway entrance (orange "S" sign on a pole)
box(IRON, 4.0, 18, 0, 6.6, 21, 0.9)
box(GLASS, 4.0, 18, 0.9, 6.6, 21, 2.6)
box(IRON, 3.9, 17.9, 2.6, 6.7, 21.1, 2.75)
cyl(IRON, 4.3, 17.6, 0, 0.06, 3.3, seg=6)
cbox(SUBWAY, 4.3, 17.6, 3.6, 0.15, 0.8, 0.8)

# The Duke of Wellington statue with its traffic cone (just left of the otter, near the camera)
SX, SY = -5.0, 9.0
box(GREY, SX - 1.2, SY - 1.8, 0, SX + 1.2, SY + 1.8, 1.0)
box(GREY, SX - 1.0, SY - 1.6, 1.0, SX + 1.0, SY + 1.6, 2.2)
box(GREY, SX - 1.15, SY - 1.75, 2.2, SX + 1.15, SY + 1.75, 2.4)
# horse
box(BRONZE, SX - 0.35, SY - 0.9, 3.2, SX + 0.35, SY + 0.9, 3.9)
for lx, ly in ((-0.22, -0.7), (0.22, -0.7), (-0.22, 0.7), (0.22, 0.7)):
    box(BRONZE, SX + lx - 0.08, SY + ly - 0.08, 2.4, SX + lx + 0.08, SY + ly + 0.08, 3.25)
box(BRONZE, SX - 0.18, SY - 1.25, 3.6, SX + 0.18, SY - 0.8, 4.4)  # neck
box(BRONZE, SX - 0.16, SY - 1.6, 4.2, SX + 0.16, SY - 1.1, 4.5)  # head
cyl(BRONZE, SX, SY + 0.95, 3.0, 0.07, 0.8, seg=6)  # tail
# rider
box(BRONZE, SX - 0.28, SY - 0.2, 3.9, SX + 0.28, SY + 0.25, 4.9)
dome(BRONZE, SX, SY, 4.9, 0.2, seg=10, rings=3)
blob(BRONZE, SX, SY, 5.05, 0.18)
cyl(CONE, SX, SY, 5.15, 0.24, 0.62, seg=12, r1=0.03)
cyl(FRAME, SX, SY, 5.33, 0.17, 0.09, seg=12, r1=0.15)

# ---------- build the object ----------
me = bpy.data.meshes.new('glasgow_street')
me.from_pydata(verts, [], faces)
me.update()
ordered = sorted(mat_index.items(), key=lambda kv: kv[1])
for name, _ in ordered:
    me.materials.append(bpy.data.materials[name])
for p, k in zip(me.polygons, fmats):
    p.material_index = k
ob = bpy.data.objects.new('GlasgowStreet', me)
bpy.context.scene.collection.objects.link(ob)
bpy.context.view_layer.objects.active = ob
ob.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')
for p in me.polygons:
    p.use_smooth = False

# box-projected UVs in metres so the tiling textures stay true to scale
import bmesh
bm = bmesh.new()
bm.from_mesh(me)
uvl = bm.loops.layers.uv.new('UVMap')
names = [m.name for m in me.materials]
for f in bm.faces:
    sc = UV_SCALE.get(names[f.material_index], 1.0)
    n = f.normal
    ax = max(range(3), key=lambda i: abs(n[i]))
    for lp in f.loops:
        co = lp.vert.co
        if ax == 2:
            u, v = co.x, co.y
        elif ax == 0:
            u, v = co.y, co.z
        else:
            u, v = co.x, co.z
        lp[uvl].uv = (u / sc, v / sc)
bm.to_mesh(me)
bm.free()

tris = sum(len(p.vertices) - 2 for p in me.polygons)
print(f'GLASGOW: {len(me.vertices)} verts, {tris} tris, {len(me.materials)} materials')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=True, export_image_format='JPEG',
                          export_meshopt_compression_enable=True)
print('GLASGOW: wrote', os.path.abspath(OUT), os.path.getsize(os.path.abspath(OUT)) // 1024, 'KB')

# Shrinks a Meshy NPC for the web: textures down to 1024 px JPEG, rig + animations kept.
# blender -b -P art/blender/npc_web.py -- <in.glb> <out.glb>
import bpy, sys, os

SRC, OUT = sys.argv[sys.argv.index('--') + 1:][:2]
TEX = 1024

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
for img in bpy.data.images:
    if img.size[0] > TEX or img.size[1] > TEX:
        img.scale(TEX, TEX)
        img.pack()
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_animations=True, export_image_format='JPEG',
                          export_jpeg_quality=85)
print('NPC: wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')

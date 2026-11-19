# Turn a VRoid template avatar into a light, tintable game character.
#   blender -b --python build.py -- in.glb out.glb
import bpy, sys, numpy as np
src, out = sys.argv[sys.argv.index('--')+1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

# 1. drop what the game does not need
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o.name.startswith('Icosphere'):
        bpy.data.objects.remove(o, do_unlink=True)
KEEP = ('Fcl_EYE_Close', 'Fcl_ALL_Joy', 'Fcl_MTH_A')
for o in bpy.data.objects:
    if o.type == 'MESH' and o.data.shape_keys:
        for kb in list(o.data.shape_keys.key_blocks)[1:]:
            if kb.name not in KEEP:
                o.shape_key_remove(kb)

# 2. hair is the heaviest part: thin it where it will not be seen
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name.startswith('Hair'):
        m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = 0.55
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier='dec')

# 3. cloth and hair textures become light greys, so the game can dye them any colour;
#    every texture is halved or more (these are seen from a few metres, not in close-up)
def grey(img, lift):
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    lum = px[:, 0] * 0.3 + px[:, 1] * 0.59 + px[:, 2] * 0.11
    vis = px[:, 3] > 0.05
    if vis.any():
        hi = np.percentile(lum[vis], 96)
        lum = np.clip(lum / max(hi, 1e-3), 0, 1) ** 0.7
        lum = lift + (1 - lift) * lum
    px[:, 0] = px[:, 1] = px[:, 2] = lum
    img.pixels[:] = px.reshape(-1)
for img in bpy.data.images:
    if not img.size[0]: continue
    n = img.name
    if any(k in n for k in ('Tops', 'Bottoms', 'Shoes', 'Onepiece', 'Accessory')): grey(img, 0.25)
    elif 'Hair' in n: grey(img, 0.35)
    limit = 512 if any(k in n for k in ('Body', 'Tops', 'Face_', 'Onepiece')) else 256
    if img.size[0] > limit: img.scale(limit, limit * img.size[1] // img.size[0])
    img.pack()

bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='WEBP', export_morph=True,
                          export_animations=False, export_skins=True, export_yup=True)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
print('BUILT', out, 'tris', tris)

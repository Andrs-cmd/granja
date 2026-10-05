import bpy, os
B = os.path.dirname(os.path.abspath(__file__))
for nombre in ['Dog', 'Cat']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.open_mainfile(filepath=os.path.join(B, 'quat', 'Animal Pack Vol.2 by @Quaternius', 'Blends', nombre + '.blend'))
    print(nombre, 'acciones:', [a.name for a in bpy.data.actions], 'mallas:', [(o.name, len(o.data.polygons)) for o in bpy.data.objects if o.type == 'MESH'])
    bpy.ops.export_scene.gltf(filepath=os.path.join(B, f'quat_{nombre.lower()}.glb'), export_format='GLB', export_animations=True, export_animation_mode='ACTIONS')
for nombre in ['dog', 'cat']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(B, 'styloo', 'stylooanimalassetpack', 'glb', nombre + '.glb'))
    print('styloo', nombre, 'acciones:', [a.name for a in bpy.data.actions], 'mallas:', [(o.name, len(o.data.polygons)) for o in bpy.data.objects if o.type == 'MESH'])

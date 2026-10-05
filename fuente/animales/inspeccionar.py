import bpy, os
B = os.path.dirname(os.path.abspath(__file__))
for n in ['cat', 'dog']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(B, 'styloo', 'stylooanimalassetpack', 'glb', n + '.glb'))
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    me = max([o for o in bpy.data.objects if o.type == 'MESH'], key=lambda o: len(o.data.vertices))
    ws = [me.matrix_world @ v.co for v in me.data.vertices]
    print(n, 'malla x', round(min(w.x for w in ws),3), round(max(w.x for w in ws),3), 'y', round(min(w.y for w in ws),3), round(max(w.y for w in ws),3), 'z', round(min(w.z for w in ws),3), round(max(w.z for w in ws),3))
    for b in ['DEF-spine.009', 'DEF-spine.011', 'DEF-spine', 'DEF-spine.003', 'DEF-thigh.L', 'DEF-front_thigh.L', 'DEF-shin.L', 'DEF-front_shin.L']:
        if b in arm.data.bones:
            bb = arm.data.bones[b]; h = arm.matrix_world @ bb.head_local; t = arm.matrix_world @ bb.tail_local
            print('  ', b, 'cabeza', tuple(round(c, 3) for c in h), 'cola', tuple(round(c, 3) for c in t))

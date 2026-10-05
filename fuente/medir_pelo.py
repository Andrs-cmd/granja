import bpy, os
B=os.path.dirname(os.path.abspath(__file__)); U=os.path.join(B,'ubc','Universal Base Characters[Standard]')
bpy.ops.wm.read_factory_settings(use_empty=True)
for cuerpo in ['Superhero_Male_FullBody.gltf','Superhero_Female_FullBody.gltf']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(U,'Base Characters','Godot - UE',cuerpo))
    arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
    hz=(arm.matrix_world @ arm.data.bones['Head'].head_local).z
    mallas=[o for o in bpy.data.objects if o.type=='MESH']; c=max(mallas,key=lambda o:len(o.data.vertices))
    zs=[(c.matrix_world@v.co).z for v in c.data.vertices]
    print(cuerpo,'cabeza z',round(hz,3),'altura',round(max(zs),3))
    antes=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(U,'Hairstyles','Rigged to Head Bone','glTF (Godot -Unreal)','Hair_Long.gltf'))
    h=[o for o in bpy.data.objects if o not in antes and o.type=='MESH'][0]
    hzs=[(h.matrix_world@v.co).z for v in h.data.vertices]
    print('  pelo largo z', round(min(hzs),3), '..', round(max(hzs),3))

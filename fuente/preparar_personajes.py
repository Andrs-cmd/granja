# Prepara a Andrés y María para la granja a partir de Universal Base Characters (Quaternius, CC0).
# - cuerpo atlético con esqueleto humanoide de 65 huesos
# - peinado y barba "amarrados" al hueso de la cabeza, teñidos según la ficha
# - ropa pintada por zonas del cuerpo (según el hueso que más mueve cada cara)
# - texturas reducidas para la web
# Uso: blender -b -P preparar_personajes.py
import bpy, bmesh, os, sys, math
from mathutils import Vector, noise

BASE = os.path.dirname(os.path.abspath(__file__))
UBC = os.path.join(BASE, 'ubc', 'Universal Base Characters[Standard]')
CUERPOS = os.path.join(UBC, 'Base Characters', 'Godot - UE')
PELOS = os.path.join(UBC, 'Hairstyles', 'Rigged to Head Bone', 'glTF (Godot -Unreal)')
TEX = os.path.join(UBC, 'Base Characters', 'Textures')
SALIDA = os.path.join(BASE, '..', 'modelo')

def hexc(h, a=1.0):
    c = [((h >> s) & 255) / 255 for s in (16, 8, 0)]
    # a lineal (los colores de la ficha están en sRGB)
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (a,)

PERSONAJES = {
    'andres': {
        'cuerpo': 'Superhero_Male_FullBody.gltf', 'piel': 'T_Superhero_Male_Ligh.png',
        # pelo rubio un poco largo (a la altura de la mandíbula, sin llegar a los hombros) y barba
        'pelos': ['Hair_Long.gltf', 'Hair_Beard.gltf', 'Eyebrows_Regular.gltf'], 'colorPelo': 0xd9b45e, 'escalaPelo': 1.05, 'cortePelo': (0.075, 0.35),
        # zona → (color, huesos)
        # zona → (color, huesos, tela de Poly Haven CC0, teñir)
        'ropa': [('camiseta', 0x4a7cc4, ['spine', 'clavicle', 'upperarm'], 'cotton_jersey', True), ('pantalon', 0x2b3550, ['pelvis', 'thigh', 'calf'], 'denim_fabric', False), ('zapatos', 0x3a2a20, ['foot', 'ball'], 'brown_leather', False)],
    },
    'maria': {
        'cuerpo': 'Superhero_Female_FullBody.gltf', 'piel': 'T_Superhero_Female_Light_BaseColor.png',
        # silueta más femenina: el cuerpo base es de proporción "superhéroe"
        # hueso → (cuánto se acerca la carne al hueso, cuánto se abre/cierra a lo ancho)
        'figura': {'upperarm': (0.8, 0.94), 'lowerarm': (0.82, 1), 'hand': (0.92, 1), 'clavicle': (0.9, 0.9), 'neck': (0.82, 1),
                   'spine_03': (0.93, 0.92), 'spine_02': (0.92, 0.95), 'spine_01': (0.86, 0.9), 'pelvis': (1.0, 1.08), 'thigh': (0.95, 1.04), 'calf': (0.93, 1)},
        # pelo negro hasta los hombros
        'pelos': ['Hair_Long.gltf', 'Eyebrows_Female.gltf'], 'colorPelo': 0x15120f, 'estirarPelo': 1.7,
        'ropa': [('polera', 0xd2694c, ['spine', 'clavicle', 'upperarm'], 'cotton_jersey', True), ('calzas', 0x3b4232, ['pelvis', 'thigh', 'calf'], 'cotton_jersey', True), ('botas', 0x2a221c, ['foot', 'ball'], 'brown_leather', False)],
        'ajustada': True,   # ropa pegada al cuerpo, tipo licra
    },
}

def limpiar():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def importar(ruta):
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=ruta)
    return [o for o in bpy.data.objects if o not in antes]

def material_plano(nombre, color, rugosidad=0.8):
    m = bpy.data.materials.new(nombre); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value = hexc(color); b.inputs['Roughness'].default_value = rugosidad
    return m

TELAS = os.path.join(BASE, 'telas')
def material_tela(nombre, color, tela, tenir, repetir=7.0):   # (las prendas de licra llevan la trama más fina)
    # textura de tela real (color + relieve), repetida sobre el cuerpo; se puede teñir con el color de la ficha
    m = bpy.data.materials.new(nombre); m.use_nodes = True
    N, Lk = m.node_tree.nodes, m.node_tree.links
    b = N.get('Principled BSDF'); b.inputs['Roughness'].default_value = 0.9 if 'leather' not in tela else 0.55
    if nombre.endswith(('polera', 'calzas')): b.inputs['Roughness'].default_value = 0.42   # brillo suave de licra
    uv = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping'); r2 = repetir * (2 if nombre.endswith(('polera', 'calzas')) else 1); mp.inputs['Scale'].default_value = (r2, r2, 1)
    Lk.new(uv.outputs['UV'], mp.inputs['Vector'])
    dif = next(f for f in os.listdir(TELAS) if f.startswith(tela) and ('_diff_' in f or '_albedo_' in f))
    nor = next(f for f in os.listdir(TELAS) if f.startswith(tela) and '_nor_gl_' in f)
    tc = N.new('ShaderNodeTexImage'); tc.image = bpy.data.images.load(os.path.join(TELAS, dif)); Lk.new(mp.outputs['Vector'], tc.inputs['Vector'])
    if tenir:
        mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1.0
        mx.inputs[7].default_value = hexc(color)
        Lk.new(tc.outputs['Color'], mx.inputs[6]); Lk.new(mx.outputs[2], b.inputs['Base Color'])
    else: Lk.new(tc.outputs['Color'], b.inputs['Base Color'])
    tn = N.new('ShaderNodeTexImage'); tn.image = bpy.data.images.load(os.path.join(TELAS, nor)); tn.image.colorspace_settings.name = 'Non-Color'
    Lk.new(mp.outputs['Vector'], tn.inputs['Vector'])
    nm = N.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.5 if nombre.endswith(('polera', 'calzas')) else 1.6
    Lk.new(tn.outputs['Color'], nm.inputs['Color']); Lk.new(nm.outputs['Normal'], b.inputs['Normal'])
    for im in (tc.image, tn.image):
        if im.size[0] > 512: im.scale(512, 512)
    return m

def preparar(clave, P):
    limpiar()
    objs = importar(os.path.join(CUERPOS, P['cuerpo']))
    arm = next(o for o in objs if o.type == 'ARMATURE')
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    # el cuerpo es la malla con más vértices
    mallas = [o for o in objs if o.type == 'MESH']
    cuerpo = max(mallas, key=lambda o: len(o.data.vertices))
    # piel clara de la ficha, reducida
    for m in cuerpo.data.materials:
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                es_color = not any(k in n.image.name for k in ('Normal', 'Rough'))
                if es_color and 'Eye' not in n.image.name: n.image = bpy.data.images.load(os.path.join(TEX, P['piel']))
                elif es_color: pass
                else:
                    for l in list(n.outputs['Color'].links): m.node_tree.links.remove(l)   # sin mapas normales/rugosidad: pesan mucho para la web
    # figura: se acerca la carne a cada hueso (menos músculo) y se ajusta el ancho (hombros, cintura, caderas)
    if P.get('figura'):
        F = P['figura']; nomb = {g.index: g.name for g in cuerpo.vertex_groups}
        mw, inv = cuerpo.matrix_world, cuerpo.matrix_world.inverted()
        seg = {}
        for b in arm.data.bones: seg[b.name] = (arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local)
        def cerca(pt, a, b):
            ab = b - a; t = max(0.0, min(1.0, (pt - a).dot(ab) / max(ab.length_squared, 1e-9))); return a + ab * t
        for v in cuerpo.data.vertices:
            w = mw @ v.co; delta = Vector((0, 0, 0)); tot = 0.0
            for g in v.groups:
                n = nomb.get(g.group, ''); zona = next((k for k in F if n.startswith(k)), None)
                if not zona or n not in seg or g.weight <= 0: continue
                hacia, ancho = F[zona]; c = cerca(w, *seg[n])
                objetivo = c + (w - c) * hacia
                objetivo.x = objetivo.x * ancho if zona not in ('upperarm', 'lowerarm', 'hand') else objetivo.x + (c.x * ancho - c.x)
                delta += (objetivo - w) * g.weight; tot += g.weight
            if tot > 0: v.co = inv @ (w + delta / max(tot, 1.0))
    # ropa: cada cara toma la zona del hueso que más la mueve
    nombres = {g.index: g.name for g in cuerpo.vertex_groups}
    zonas = []
    for nombre, color, huesos, tela, tenir in P['ropa']:
        cuerpo.data.materials.append(material_tela(f'{clave}_{nombre}', color, tela, tenir)); zonas.append((len(cuerpo.data.materials) - 1, huesos))
    me = cuerpo.data
    for poly in me.polygons:
        peso = {}
        for vi in poly.vertices:
            for g in me.vertices[vi].groups: peso[g.group] = peso.get(g.group, 0) + g.weight
        if not peso: continue
        top = nombres.get(max(peso, key=peso.get), '')
        for idx, huesos in zonas:
            if any(top.startswith(h) for h in huesos): poly.material_index = idx; break
    # ropa de verdad: cada prenda es una malla aparte, holgada, con arrugas y grosor (sigue al esqueleto)
    for (idx, huesos), (nombre, color, *_ ) in zip(zonas, P['ropa']):
        prenda = cuerpo.copy(); prenda.data = cuerpo.data.copy(); prenda.name = f'{clave}_{nombre}'
        bpy.context.collection.objects.link(prenda)
        bm = bmesh.new(); bm.from_mesh(prenda.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != idx], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        # la tela no calca los músculos: se suaviza la superficie (más en los zapatos, para borrar los dedos)
        for _ in range(28 if nombre in ('zapatos', 'botas') else (1 if P.get('ajustada') else 14)):
            bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
        bm.normal_update()
        bm.to_mesh(prenda.data); bm.free()
        mat = cuerpo.data.materials[idx]
        prenda.data.materials.clear(); prenda.data.materials.append(mat)
        for poly in prenda.data.polygons: poly.material_index = 0
        mp = prenda.data; nom = {g.index: g.name for g in prenda.vertex_groups}
        mw = prenda.matrix_world
        zs = [(mw @ v.co).z for v in mp.vertices]; zmin = min(zs)
        zapato = nombre in ('zapatos', 'botas')
        nuevos = []
        for v, z in zip(mp.vertices, zs):
            gs = sorted(((g.weight, nom.get(g.group, '')) for g in v.groups), reverse=True)
            top = gs[0][1] if gs else ''; junta = 1 - (gs[0][0] if gs else 1)   # cerca de una articulación los pesos se reparten
            hol = 0.012 if zapato else 0.016
            if P.get('ajustada') and not zapato:
                nuevos.append(v.co + v.normal * 0.0045); continue   # licra: pegada a la piel
            if top.startswith(('spine_01', 'pelvis')): hol = 0.03            # cintura suelta
            elif top.startswith('spine'): hol = 0.024
            elif top.startswith('upperarm'): hol = 0.026                     # mangas
            elif top.startswith('thigh'): hol = 0.02
            elif top.startswith('calf'): hol = 0.026
            if not zapato:
                if z - zmin < 0.07: hol += 0.022 * (1 - (z - zmin) / 0.07)   # el ruedo y los bajos caen y se abren
                co = mw @ v.co
                ruido = noise.noise(co * 22.0)
                pliegue = math.sin(co.z * 68 + ruido * 2.5) * (0.003 + 0.018 * junta) + ruido * 0.004   # arrugas, más fuertes en codos, rodillas y cintura
                hol += pliegue
            nuevos.append(v.co + v.normal * hol)
        for v, c in zip(mp.vertices, nuevos): v.co = c
        sol = prenda.modifiers.new('grosor', 'SOLIDIFY'); sol.thickness = 0.005 if not zapato else 0.008; sol.offset = 1
        while prenda.modifiers[0].name != 'grosor': bpy.context.view_layer.objects.active = prenda; bpy.ops.object.modifier_move_up(modifier='grosor')
        for poly in mp.polygons: poly.use_smooth = True
    # pelo, barba y cejas: se re-amarran al esqueleto del personaje
    for f in P['pelos']:
        nuevos = importar(os.path.join(PELOS, f))
        harm = next((o for o in nuevos if o.type == 'ARMATURE'), None)
        # el peinado viene amarrado a otro esqueleto: se alinea su cabeza con la del personaje
        delta = Vector((0, 0, 0))
        if harm and 'Head' in harm.data.bones:
            delta = (arm.matrix_world @ arm.data.bones['Head'].head_local) - (harm.matrix_world @ harm.data.bones['Head'].head_local)
            print('  ', f, 'ajuste de cabeza', tuple(round(v, 3) for v in delta))
        cab = arm.matrix_world @ arm.data.bones['Head'].head_local
        for o in nuevos:
            if o.type != 'MESH': continue
            inv = o.matrix_world.inverted()
            for v in o.data.vertices:
                w = o.matrix_world @ v.co + delta
                if f.startswith('Hair_Long'):
                    w = cab + (w - cab) * P.get('escalaPelo', 1.0)
                    if w.z < cab.z: w.z = cab.z - (cab.z - w.z) * P.get('estirarPelo', 1.0)   # más largo hacia los hombros
                    if P.get('cortePelo'):
                        ref = cab.z + P['cortePelo'][0]
                        if w.z < ref: w.z = ref - (ref - w.z) * P['cortePelo'][1]      # más corto: por debajo de las orejas
                v.co = inv @ w
            mw = o.matrix_world.copy()
            o.parent = arm; o.matrix_world = mw
            for md in o.modifiers:
                if md.type == 'ARMATURE': md.object = arm
            mat = material_plano(f'{clave}_pelo', P['colorPelo'], 0.6)
            o.data.materials.clear(); o.data.materials.append(mat)
        for o in nuevos:
            if o.type == 'ARMATURE': bpy.data.objects.remove(o)
        for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    # texturas chicas
    for img in bpy.data.images:
        if img.size[0] > 1024: img.scale(1024, 1024)
    # exportar
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.data.objects:
        if o.type in ('ARMATURE', 'MESH'): o.select_set(True)
    ruta = os.path.join(SALIDA, f'{clave}.glb')
    bpy.ops.export_scene.gltf(filepath=ruta, export_format='GLB', use_selection=True, export_animations=False, export_apply=True, export_image_format='JPEG', export_jpeg_quality=82)
    print('EXPORTADO', ruta, os.path.getsize(ruta) // 1024, 'KB', 'triángulos', sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'))

def animaciones():
    limpiar()
    objs = importar(os.path.join(BASE, 'ual', 'Universal Animation Library[Standard]', 'Unreal-Godot', 'UAL1_Standard.glb'))
    QUEDAN = {'Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sitting_Idle_Loop', 'Sitting_Talking_Loop', 'Idle_Talking_Loop', 'Swim_Fwd_Loop', 'Swim_Idle_Loop',
              'Fixing_Kneeling', 'PickUp_Table', 'Interact', 'Push_Loop', 'Crouch_Idle_Loop', 'Dance_Loop', 'Punch_Jab', 'Punch_Cross', 'Jump_Loop'}
    for a in list(bpy.data.actions):
        base = a.name.split('|')[-1] if '|' in a.name else a.name
        if base not in QUEDAN: bpy.data.actions.remove(a)
    for o in objs:
        if o.type == 'MESH': bpy.data.objects.remove(o)
    print('ACCIONES', sorted(a.name for a in bpy.data.actions))
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.data.objects:
        if o.type == 'ARMATURE': o.select_set(True)
    ruta = os.path.join(SALIDA, 'animaciones.glb')
    bpy.ops.export_scene.gltf(filepath=ruta, export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True, export_optimize_animation_size=True)
    print('EXPORTADO', ruta, os.path.getsize(ruta) // 1024, 'KB')

for k, P in PERSONAJES.items(): preparar(k, P)
animaciones()

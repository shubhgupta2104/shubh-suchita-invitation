"""Render the licensed coloured wedding scan inside the original ruby velvet theatre."""

import argparse
import json
import math
from pathlib import Path
import random
import sys

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_colored_vrml import create_blender_mesh, read_colored_vrml


TAU = math.tau
FPS = 24
LAST_FRAME = 162
CURTAINS_CLEAR_FRAME = 61
TURN_START_FRAME = 2 * FPS + 1
SETTLED_FRAME = 145
CAMERA_HEIGHT = 7.0
FRAME_ASPECT = .5
STAGE_TOP = .057
SCAN_FACING_DEGREES = 205
SCAN_FIT_FACING_DEGREES = -25
SCAN_SHA256 = "d7218e2a955644d364e1f72af36088ec67cfecb8c03ece181de7121d73add40f"
random.seed(2612027)


def material(name, color, roughness=.5, metallic=0, sheen=0):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Sheen Weight"].default_value = sheen
    return result


def fabric(name, color, roughness=.5, sheen=.3):
    result = material(name, color, roughness, sheen=sheen)
    nodes, links = result.node_tree.nodes, result.node_tree.links
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 320
    noise.inputs["Detail"].default_value = 2
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .1
    bump.inputs["Distance"].default_value = .003
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], nodes.get("Principled BSDF").inputs["Normal"])
    return result


def velvet_material():
    result = fabric("Deep ruby velvet with woven gold dust", (.075, .0014, .008), .72, .3)
    nodes, links = result.node_tree.nodes, result.node_tree.links
    velvet = nodes.get("Principled BSDF")
    velvet.inputs["Sheen Tint"].default_value = (.36, .065, .11, 1)
    velvet.inputs["Specular IOR Level"].default_value = .26
    uv = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeVectorMath")
    mapping.operation = "MULTIPLY"
    mapping.inputs[1].default_value = (curtain_span() / 3.55, 2.7, 1)
    links.new(uv.outputs["UV"], mapping.inputs[0])
    cells = nodes.new("ShaderNodeTexVoronoi")
    cells.inputs["Scale"].default_value = 155
    links.new(mapping.outputs["Vector"], cells.inputs["Vector"])
    cluster = nodes.new("ShaderNodeTexNoise")
    cluster.inputs["Scale"].default_value = 3.6
    cluster.inputs["Detail"].default_value = 3
    links.new(mapping.outputs["Vector"], cluster.inputs["Vector"])
    radius = nodes.new("ShaderNodeMapRange")
    radius.inputs["From Min"].default_value = .25
    radius.inputs["From Max"].default_value = .78
    radius.inputs["To Min"].default_value = .013
    radius.inputs["To Max"].default_value = .105
    links.new(cluster.outputs["Fac"], radius.inputs["Value"])
    dots = nodes.new("ShaderNodeMath")
    dots.operation = "LESS_THAN"
    links.new(cells.outputs["Distance"], dots.inputs[0])
    links.new(radius.outputs["Result"], dots.inputs[1])
    foil = nodes.new("ShaderNodeBsdfPrincipled")
    foil.inputs["Base Color"].default_value = (.63, .24, .055, 1)
    foil.inputs["Roughness"].default_value = .27
    foil.inputs["Metallic"].default_value = .85
    foil.inputs["Emission Color"].default_value = (.55, .15, .02, 1)
    foil.inputs["Emission Strength"].default_value = .18
    mix = nodes.new("ShaderNodeMixShader")
    links.new(dots.outputs[0], mix.inputs[0])
    links.new(velvet.outputs[0], mix.inputs[1])
    links.new(foil.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], nodes.get("Material Output").inputs["Surface"])
    return result


def finish(obj, name, mat, parent=None):
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    if parent:
        obj.parent = parent
    return obj


def mesh(name, vertices, faces, mat, parent=None):
    geometry = bpy.data.meshes.new(name)
    geometry.from_pydata(vertices, [], faces)
    geometry.update()
    obj = bpy.data.objects.new(name, geometry)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat, parent)


def curve(name, points, radius, mat, parent=None):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 16
    data.bevel_depth = radius
    data.bevel_resolution = 4
    data.use_fill_caps = True
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat, parent)


def import_scan(path, facing):
    scan = read_colored_vrml(path, SCAN_SHA256)
    if len(scan.coordinates) != 1090343:
        raise ValueError("The approved scan's vertex count does not match its published metadata")
    source = scan.coordinates
    low, high = source.min(axis=0), source.max(axis=0)
    scan.coordinates = np.column_stack((
        source[:, 0] - (low[0] + high[0]) / 2,
        -(source[:, 2] - (low[2] + high[2]) / 2),
        source[:, 1] - low[1],
    )).astype(np.float32)
    obj = create_blender_mesh(scan)
    obj.rotation_euler.z = math.radians(facing)
    mat = material("Photographic scan colour with matte relighting", (.5, .5, .5), .80)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    color = nodes.new("ShaderNodeVertexColor")
    color.layer_name = "ScanColor"
    albedo = nodes.new("ShaderNodeVectorMath")
    albedo.operation = "SCALE"
    albedo.inputs["Scale"].default_value = .78
    links.new(color.outputs["Color"], albedo.inputs[0])
    shader = nodes["Principled BSDF"]
    shader.inputs["Specular IOR Level"].default_value = .10
    links.new(albedo.outputs["Vector"], shader.inputs["Base Color"])
    # A small colour-preserving fill keeps baked scan shadows from being lit twice.
    links.new(color.outputs["Color"], shader.inputs["Emission Color"])
    shader.inputs["Emission Strength"].default_value = .16
    obj.data.materials.append(mat)
    scan.metadata.update({
        "title": "The groom and bride",
        "creator": "3dklon",
        "source_url": "https://sketchfab.com/3d-models/the-groom-and-bride-7e4b1e8d7bed46fbae6cba904455936b",
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "attribution_required": True,
        "axis_mapping": "source (X,Y,Z) -> Blender (X,-Z,Y), preserving handedness",
        "horizontal_center_source_xz": [float((low[0] + high[0]) / 2), float((low[2] + high[2]) / 2)],
        "source_floor_y": float(low[1]),
        "facing_degrees": facing,
        "color_handling": "Embedded RGB interpreted as sRGB, converted once to linear and stored in a FLOAT_COLOR point attribute.",
        "point_color_attribute": "ScanColor",
        "material_albedo_factor": .78,
        "material_baked_shadow_fill": .16,
        "material_roughness": .80,
        "pose": "The supplied static scanned pose, rotated together as one pair.",
    })
    return obj, scan


def fit_scan(scene, root, obj, scan):
    bpy.context.view_layer.update()
    camera_inverse = scene.camera.matrix_world.inverted()
    up = np.asarray(camera_inverse[1][:3], dtype=np.float64)
    raw = scan.coordinates.astype(np.float64)
    curve_z = next(curve for curve in root.animation_data.action.fcurves if curve.array_index == 2)
    low, high = float("inf"), -float("inf")
    for frame in range(1, LAST_FRAME + 1):
        # Keep the accepted fit when changing only the pair's viewing angle.
        angle = curve_z.evaluate(frame) + math.radians(SCAN_FIT_FACING_DEGREES)
        x_coefficient = up[0] * math.cos(angle) + up[1] * math.sin(angle)
        y_coefficient = -up[0] * math.sin(angle) + up[1] * math.cos(angle)
        vertical = raw[:, 0] * x_coefficient + raw[:, 1] * y_coefficient + raw[:, 2] * up[2]
        low, high = min(low, float(vertical.min())), max(high, float(vertical.max()))
    bottom, top = .042, 1 - .615
    scale = (top - bottom) * CAMERA_HEIGHT / (high - low)
    offset = bottom - scale * low / CAMERA_HEIGHT
    ground_y = ((offset - .5) * CAMERA_HEIGHT - camera_inverse[1][3] - up[2] * STAGE_TOP) / up[1]
    root.scale = (scale, scale, scale)
    root.location = (0, ground_y, STAGE_TOP)
    if abs(ground_y) + scale * float(np.linalg.norm(raw[:, :2], axis=1).max()) > 1.62:
        raise ValueError("The complete scan would exceed the flat stage; inspect placement before rendering")
    scan.metadata.update({
        "uniform_source_to_scene_scale": scale,
        "model_height_scene_units": scale * float(raw[:, 2].max()),
        "root_location": list(root.location),
        "target_clear_upper_image_percent": 61.5,
        "target_bottom_clearance_percent": 4.2,
        "fit_reference_facing_degrees": SCAN_FIT_FACING_DEGREES,
        "camera_modified_for_scan": False,
    })
    bpy.context.view_layer.update()


def curtain_span():
    return CAMERA_HEIGHT * FRAME_ASPECT / 2 + 1.8


def cloth_position(side, u, v, progress):
    z = 8.05 - 9.45 * v
    span = curtain_span()
    closed_x = -.085 + span * u
    gathering = CAMERA_HEIGHT * FRAME_ASPECT / 2 + .33 + .32 * math.exp(-((z - 3.0) / 2.6) ** 2)
    opened_x = gathering + .83 * u + .065 * math.sin(v * 9 + u * 4) * math.sin(u * math.pi)
    x = side * ((1 - progress) * closed_x + progress * opened_x)
    pleat_count = 9 * span / 3.55
    pleat = .14 * math.sin(TAU * pleat_count * u + .26 * math.sin(v * 5))
    pleat += .025 * math.sin(TAU * pleat_count * 2 * u + v * .8)
    depth = -2.30 + pleat * (1 + .42 * progress)
    depth += progress * .24 * math.sin(v * math.pi) * math.sin(u * math.pi)
    depth += math.sin(progress * math.pi) * .14 * math.sin(v * 6 + u * 3)
    z += progress * .23 * v ** 4 * math.sin(u * math.pi)
    return Vector((x, depth, z))


def animate_cloth(obj, coordinates):
    obj.shape_key_add(name="Fully closed with overscan")
    halfway = obj.shape_key_add(name="Billowing draw")
    gathered = obj.shape_key_add(name="Settled gathered folds")
    closed, middle, opened = coordinates(0), coordinates(.53), coordinates(1)
    for index, (start, mid, end) in enumerate(zip(closed, middle, opened)):
        halfway.data[index].co = start + mid - start.lerp(end, .53)
        gathered.data[index].co = end
    for key, values in [
        (halfway, [(1, 0), (9, 0), (35, 1), (CURTAINS_CLEAR_FRAME, 0), (LAST_FRAME, 0)]),
        (gathered, [(1, 0), (9, 0), (35, .53), (CURTAINS_CLEAR_FRAME, 1), (LAST_FRAME, 1)])
    ]:
        for frame, value in values:
            key.value = value
            key.keyframe_insert("value", frame=frame)
        for fcurve in obj.data.shape_keys.animation_data.action.fcurves:
            for keyframe in fcurve.keyframe_points:
                keyframe.handle_left_type = "AUTO_CLAMPED"
                keyframe.handle_right_type = "AUTO_CLAMPED"


def curtain(side):
    columns, rows = round(144 * curtain_span() / 3.55), 112
    coordinates = lambda progress: [
        cloth_position(side, column / (columns - 1), row / (rows - 1), progress)
        for row in range(rows) for column in range(columns)]
    faces = []
    for row in range(rows - 1):
        for column in range(columns - 1):
            a = row * columns + column
            faces.append((a, a + 1, a + columns + 1, a + columns))
    obj = mesh(("Left" if side < 0 else "Right") + " opaque gathered ruby velvet",
               coordinates(0), faces, velvet)
    uv = obj.data.uv_layers.new(name="Cloth attached sparkle coordinates")
    for polygon in obj.data.polygons:
        for index in polygon.loop_indices:
            vertex = obj.data.loops[index].vertex_index
            uv.data[index].uv = (vertex % columns / (columns - 1), vertex // columns / (rows - 1))
    animate_cloth(obj, coordinates)
    sub = obj.modifiers.new("Rounded velvet pleats", "SUBSURF")
    sub.levels = 1
    solid = obj.modifiers.new("Opaque velvet backing", "SOLIDIFY")
    solid.thickness = .017
    solid.offset = side
    flakes = []
    for index in range(round(12500 * curtain_span() / 3.55)):
        u, v = random.random(), random.random()
        cluster = .48 + .28 * math.sin(u * 18 + 2 * math.sin(v * 13)) * math.sin(v * 17)
        if random.random() > cluster:
            continue
        size = random.uniform(.0028, .0075) * (.8 + .4 * v)
        flakes.append((u, v, size, random.random() * TAU))

    def fleck_vertices(progress):
        points = []
        for u, v, size, angle in flakes:
            center = cloth_position(side, u, v, progress)
            tangent = (cloth_position(side, u + .0001, v, progress) - center).normalized()
            vertical = (cloth_position(side, u, v + .0001, progress) - center).normalized()
            center.y -= .008
            for index in range(4):
                theta = angle + TAU * index / 4
                points.append(center + size * (math.cos(theta) * tangent + math.sin(theta) * vertical))
        return points

    flake_faces = [tuple(4 * index + corner for corner in range(4)) for index in range(len(flakes))]
    flake_obj = mesh(("Left" if side < 0 else "Right") + " sewn ruby and gold facets",
                     fleck_vertices(0), flake_faces, gold)
    flake_obj.data.materials.append(ruby_foil)
    flake_obj.data.materials.append(glint)
    for polygon in flake_obj.data.polygons:
        choice = random.random()
        polygon.material_index = 0 if choice < .66 else 1 if choice < .97 else 2
    animate_cloth(flake_obj, fleck_vertices)
    return [obj, flake_obj]


def light(name, kind, location, energy, color, target, size, receivers=None):
    data = bpy.data.lights.new(name, kind)
    data.energy, data.color = energy, color
    if kind == "AREA":
        data.shape, data.size = "DISK", size
    else:
        data.shadow_soft_size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    if receivers:
        obj.light_linking.receiver_collection = receivers
    return obj


def stage(args):
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.026))
    finish(bpy.context.object, "Dark velvet theatre floor", floor)
    bpy.ops.mesh.primitive_cylinder_add(vertices=192, radius=1.67, depth=.08, location=(0, .12, .017))
    platform = finish(bpy.context.object, "Low circular bridal stage", floor)
    bevel = platform.modifiers.new("Rounded stage edge", "BEVEL")
    bevel.width, bevel.segments = .04, 4
    curve("Subtle antique gold stage inlay", [
        (1.635 * math.cos(TAU * i / 192), .12 + 1.635 * math.sin(TAU * i / 192), .06)
        for i in range(193)], .004, stage_gold)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 2.2, 3.5))
    backdrop = finish(bpy.context.object, "Unlit midnight burgundy backdrop", background)
    backdrop.scale = (16, .1, 12)
    curtain_objects = curtain(-1) + curtain(1)
    cloth_receivers = bpy.data.collections.new("Only front velvet receives the ruby lighting")
    for obj in curtain_objects:
        cloth_receivers.objects.link(obj)
    root = bpy.data.objects.new("Visible seventy-five degree bridal turn", None)
    bpy.context.collection.objects.link(root)
    scan_obj, scan = import_scan(args.scan, args.scan_facing)
    scan_obj.parent = root
    for frame, angle in [(1, -50), (TURN_START_FRAME, -50),
                         (SETTLED_FRAME, 25), (LAST_FRAME, 25)]:
        root.rotation_euler.z = math.radians(angle)
        root.keyframe_insert("rotation_euler", frame=frame)
    for fcurve in root.animation_data.action.fcurves:
        for keyframe in fcurve.keyframe_points:
            keyframe.interpolation = "LINEAR"
    stage_receivers = bpy.data.collections.new("Stage surfaces without atmospheric fill")
    for obj in bpy.context.scene.objects:
        if obj.type in {"MESH", "CURVE"} and obj not in curtain_objects:
            stage_receivers.objects.link(obj)
    if FRAME_ASPECT > 1:
        for side in [-1, 1]:
            x = side * CAMERA_HEIGHT * FRAME_ASPECT * .32
            light("Wide velvet softbox", "AREA", (x, -6.5, 4.8), 500,
                  (1, .77, .59), (x, -2.3, 4.0), 6.0, cloth_receivers)
        light("Wide velvet upper glint", "AREA", (0, -6, 7.3), 180,
              (1, .85, .62), (0, -2.3, 5.5), 4.0, cloth_receivers)
    else:
        light("Velvet broad golden softbox", "AREA", (-2.3, -4.5, 4.4), 155,
              (1, .77, .59), (-.5, -2.3, 3.8), 3.8, cloth_receivers)
        light("Velvet right raking light", "AREA", (2.5, -3.3, 3.1), 110,
              (1, .48, .30), (.8, -2.3, 2.6), 2.5, cloth_receivers)
        light("Velvet upper glint", "AREA", (.3, -4.3, 7.3), 75,
              (1, .85, .62), (0, -2.3, 5.5), 1.4, cloth_receivers)
    light("Ivory sculpting key", "AREA", (-1.8, -1.3, 3.8), 140,
          (1, .91, .80), (-.1, 0, 1.9), 1.1, stage_receivers)
    light("Golden silk and veil rim", "AREA", (1.0, 1.5, 4.0), 220,
          (1, .84, .59), (-.2, 0, 1.8), 1.0, stage_receivers)
    light("Quiet midnight jacket fill", "AREA", (1.8, -1.1, 2.7), 35,
          (.79, .85, 1), (.6, .1, 1.9), 1.7, stage_receivers)
    spot = light("Ivory diagonal shaft and luminous floor pool", "SPOT", (-1.75, .3, 5.8), 3200,
                 (1, .93, .80), (.65, 0, .1), .12)
    spot.data.spot_size = math.radians(20)
    spot.data.spot_blend = .60
    haze = bpy.data.materials.new("Spotlight-only theatrical atmosphere")
    haze.use_nodes = True
    nodes = haze.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    volume = nodes.new("ShaderNodeVolumeScatter")
    texcoord = nodes.new("ShaderNodeTexCoord")
    separate = nodes.new("ShaderNodeSeparateXYZ")
    fade = nodes.new("ShaderNodeMapRange")
    fade.inputs["From Min"].default_value = .75
    fade.inputs["From Max"].default_value = 1
    fade.inputs["To Min"].default_value = .04
    fade.inputs["To Max"].default_value = 0
    haze.node_tree.links.new(texcoord.outputs["Generated"], separate.inputs[0])
    haze.node_tree.links.new(separate.outputs["Z"], fade.inputs["Value"])
    haze.node_tree.links.new(fade.outputs["Result"], volume.inputs["Density"])
    volume.inputs["Anisotropy"].default_value = .10
    haze.node_tree.links.new(volume.outputs["Volume"], output.inputs["Volume"])
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, .35, 3.2))
    box = finish(bpy.context.object, "Contained theatre atmosphere", haze)
    box.scale = (CAMERA_HEIGHT * FRAME_ASPECT + 4 if FRAME_ASPECT > 1 else 6, 3.8, 7)
    return root, scan_obj, scan


def configure(args):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    scene.cycles.adaptive_threshold = .025
    scene.cycles.max_bounces = 6
    scene.cycles.transparent_max_bounces = 8
    scene.cycles.volume_bounces = 1
    scene.cycles.seed = 261
    preferences = bpy.context.preferences.addons["cycles"].preferences
    preferences.compute_device_type = "METAL"
    preferences.get_devices()
    for device in preferences.devices:
        device.use = device.type != "CPU"
    if any(device.use for device in preferences.devices):
        scene.cycles.device = "GPU"
    print("Rendering devices:", [(device.name, device.type, device.use) for device in preferences.devices])
    scene.render.resolution_x, scene.render.resolution_y = args.width, args.height
    scene.render.resolution_percentage = 100
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 1, LAST_FRAME
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.use_persistent_data = True
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.012, .007, .012, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .14
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = .1
    bpy.ops.object.camera_add(location=(0, -14, 5.08))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((0, 0, 3.22)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = CAMERA_HEIGHT * max(1, FRAME_ASPECT)
    scene.camera = camera
    scene.use_nodes = True
    nodes, links = scene.node_tree.nodes, scene.node_tree.links
    nodes.clear()
    render = nodes.new("CompositorNodeRLayers")
    glow = nodes.new("CompositorNodeGlare")
    glow.glare_type = "FOG_GLOW"
    glow.quality = "HIGH"
    glow.threshold, glow.size, glow.mix = 1.2, 8, -.82
    links.new(render.outputs["Image"], glow.inputs["Image"])
    output = nodes.new("CompositorNodeComposite")
    links.new(glow.outputs["Image"], output.inputs["Image"])
    return scene


def make_materials():
    global velvet, floor, background, stage_gold, gold, ruby_foil, glint
    velvet = velvet_material()
    floor = material("Dark polished theatre stage", (.065, .030, .018), .44)
    background = material("Dark burgundy backdrop", (.003, .0007, .002), 1)
    stage_gold = material("Antique gold inlay", (.24, .125, .043), .36, .65)
    gold = material("Sewn antique gold facets", (.72, .36, .074), .26, .85)
    ruby_foil = material("Sewn garnet facets", (.29, .008, .024), .29, .68)
    gold_shader = gold.node_tree.nodes.get("Principled BSDF")
    gold_shader.inputs["Emission Color"].default_value = (.7, .28, .042, 1)
    gold_shader.inputs["Emission Strength"].default_value = .65
    ruby_shader = ruby_foil.node_tree.nodes.get("Principled BSDF")
    ruby_shader.inputs["Emission Color"].default_value = (.45, .014, .032, 1)
    ruby_shader.inputs["Emission Strength"].default_value = .45
    glint = material("Rare champagne glints", (.8, .62, .3), .22, .75)
    shader = glint.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Emission Color"].default_value = (1, .50, .12, 1)
    shader.inputs["Emission Strength"].default_value = 1.6


def main():
    global FRAME_ASPECT
    arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scan", type=Path, required=True,
                        help="Explicit path to the approved coloured 3dklon VRML scan")
    parser.add_argument("--scan-facing", type=float, default=SCAN_FACING_DEGREES)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--width", type=int, default=720)
    parser.add_argument("--height", type=int, default=1440)
    parser.add_argument("--samples", type=int, default=80)
    parser.add_argument("--frames", default="1,49,97,145,162")
    parser.add_argument("--animation", action="store_true")
    args = parser.parse_args(arguments)
    if args.width <= 0 or args.height <= 0 or args.samples <= 0 or not math.isfinite(args.scan_facing):
        parser.error("Dimensions and samples must be positive, and scan facing must be finite")
    if args.animation and (args.width % 2 or args.height % 2):
        parser.error("H.264 output requires even image dimensions")
    if args.output.resolve().is_relative_to(Path(__file__).resolve().parents[1]):
        parser.error("Raw scene output must be outside the repository, in a private render directory")
    FRAME_ASPECT = args.width / args.height
    args.output.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    make_materials()
    root, scan_obj, scan = stage(args)
    scene = configure(args)
    fit_scan(scene, root, scan_obj, scan)
    (args.output / "scan-metadata.json").write_text(json.dumps(scan.metadata, indent=2) + "\n")
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output / "opening.blend"))
    if args.animation:
        scene.render.image_settings.file_format = "FFMPEG"
        scene.render.ffmpeg.format = "MPEG4"
        scene.render.ffmpeg.codec = "H264"
        scene.render.ffmpeg.audio_codec = "NONE"
        scene.render.ffmpeg.constant_rate_factor = "HIGH"
        scene.render.ffmpeg.ffmpeg_preset = "BEST"
        scene.render.filepath = str(args.output / "opening.mp4")
        bpy.ops.render.render(animation=True)
    else:
        for frame in [int(value) for value in args.frames.split(",")]:
            scene.frame_set(frame)
            scene.render.filepath = str(args.output / f"proof-{frame:04d}.png")
            bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()

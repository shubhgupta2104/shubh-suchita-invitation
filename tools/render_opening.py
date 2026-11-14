"""Render an original ruby velvet reveal and a sculpted bridal stage in Blender 4.5."""

import argparse
import math
from pathlib import Path
import random
import sys

import bpy
from mathutils import Matrix, Vector


TAU = math.tau
FPS = 24
LAST_FRAME = 162
CURTAINS_CLEAR_FRAME = 61
TURN_START_FRAME = 2 * FPS + 1
SETTLED_FRAME = 145
CAMERA_HEIGHT = 7.0
FRAME_ASPECT = .5
STAGE_TOP = .057
FIGURE_SCALE = .93 * .9
LOCAL_FLOOR = STAGE_TOP / .93
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


def ellipsoid(name, location, scale, mat, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, location=location)
    obj = finish(bpy.context.object, name, mat, parent)
    obj.scale = scale
    return obj


def curve(name, points, radius, mat, parent=None, radii=None):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 16
    data.bevel_depth = radius
    data.bevel_resolution = 4
    data.use_fill_caps = True
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for index, (point, coordinate) in enumerate(zip(spline.bezier_points, points)):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
        if radii:
            point.radius = radii[index]
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat, parent)


def rings(name, center, sections, mat, parent=None, subdiv=2):
    vertices, faces = [], []
    columns = 64
    for z, rx, ry, offset in sections:
        for index in range(columns):
            angle = TAU * index / columns
            vertices.append((center[0] + rx * math.cos(angle),
                             center[1] + ry * math.sin(angle) + offset, z))
    for row in range(len(sections) - 1):
        for column in range(columns):
            nxt = (column + 1) % columns
            faces.append((row * columns + column, row * columns + nxt,
                          (row + 1) * columns + nxt, (row + 1) * columns + column))
    faces.append(tuple(reversed(range(columns))))
    faces.append(tuple((len(sections) - 1) * columns + index for index in range(columns)))
    obj = mesh(name, vertices, faces, mat, parent)
    if subdiv:
        modifier = obj.modifiers.new("Continuous sculpted surface", "SUBSURF")
        modifier.levels = subdiv
    return obj


def arm(name, points, radius, mat, parent):
    shoulder, elbow, wrist = [Vector(point) for point in points]
    return curve(name, [shoulder, shoulder.lerp(elbow, .45), elbow,
                        elbow.lerp(wrist, .52), wrist], radius, mat, parent,
                 [1.28, 1.08, .84, .76, .57])


def hand(name, wrist, end, mat, parent):
    wrist, end = Vector(wrist), Vector(end)
    direction = (end - wrist).normalized()
    obj = ellipsoid(name, wrist.lerp(end, .5), (.034, .021, (end - wrist).length * .6), mat, parent)
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    across = direction.cross(Vector((0, -1, 0))).normalized()
    for index in range(4):
        offset = across * (index - 1.5) * .012
        curve(name + " relaxed finger", [end - direction * .027 + offset,
                                         end + direction * .01 + offset,
                                         end + direction * .03 + offset + Vector((0, .008, -.004))],
              .0065, mat, parent, [1, .9, .55])
    curve(name + " thumb", [wrist.lerp(end, .35) - across * .023,
                            wrist.lerp(end, .65) - across * .046,
                            end - across * .03], .009, mat, parent, [1, .85, .5])


def united_skin(objects, name):
    # A single remeshed surface avoids seams at the neck, shoulders and upper arms.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    remesh = obj.modifiers.new("Joined anatomical transitions", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = .008
    remesh.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = obj.modifiers.new("Gentle sculpt smoothing", "SMOOTH")
    smooth.factor = .7
    smooth.iterations = 5
    subdiv = obj.modifiers.new("Skin finish", "SUBSURF")
    subdiv.levels = 1
    return obj


def short_tapered_hair(center, parent):
    x, y, z = center
    profile = [
        (-.10, .121, .113), (-.02, .135, .124), (.05, .136, .126),
        (.135, .119, .111), (.19, .064, .065), (.208, 0, 0)
    ]

    def surface(t, angle):
        hairline = .03 + .065 * math.sin(angle) - .03 * max(0, -math.sin(angle)) ** 2
        level = hairline + (.208 - hairline) * math.cos(t * math.pi / 2)
        for lower, upper in zip(profile, profile[1:]):
            if level <= upper[0]:
                blend = max(0, (level - lower[0]) / (upper[0] - lower[0]))
                rx = lower[1] + blend * (upper[1] - lower[1])
                ry = lower[2] + blend * (upper[2] - lower[2])
                break
        if level >= .05:
            cap = math.sqrt(max(0, 1 - ((level - .04) / .168) ** 2))
            rx, ry = .137 * cap, .128 * cap
        thickness = .003 + .008 * (1 - t) ** 2
        lift = .019 * math.sin(math.pi * t) * max(0, math.sin(angle)) * max(0, -math.cos(angle))
        return Vector((x + (rx + thickness * t) * math.cos(angle) - .014 * (1 - t) ** 2,
                       y + (ry + thickness * t) * math.sin(angle) - .006 + .01 * (1 - t) ** 2,
                       z + level + lift + .0025 * math.sin(math.pi * t) * math.sin(7 * angle + 4 * t)))

    cropped = material("Short tapered chestnut hair", (.021, .010, .006), .65, sheen=.08)
    cropped.node_tree.nodes["Principled BSDF"].inputs["Specular IOR Level"].default_value = .18
    nodes, links = cropped.node_tree.nodes, cropped.node_tree.links
    uv = nodes.new("ShaderNodeTexCoord")
    separate = nodes.new("ShaderNodeSeparateXYZ")
    fade = nodes.new("ShaderNodeValToRGB")
    fade.color_ramp.elements[0].position = .55
    fade.color_ramp.elements[0].color = (.021, .010, .006, 1)
    fade.color_ramp.elements[1].position = 1
    fade.color_ramp.elements[1].color = (.42, .27, .18, 1)
    links.new(uv.outputs["UV"], separate.inputs[0])
    links.new(separate.outputs["Y"], fade.inputs[0])
    links.new(fade.outputs["Color"], nodes["Principled BSDF"].inputs["Base Color"])
    columns, rows = 96, 40
    vertices = [surface(.002 + .998 * row / (rows - 1), TAU * column / columns)
                for row in range(rows) for column in range(columns)]
    faces = []
    for row in range(rows - 1):
        for column in range(columns):
            nxt = (column + 1) % columns
            faces.append((row * columns + column, row * columns + nxt,
                          (row + 1) * columns + nxt, (row + 1) * columns + column))
    faces.append(tuple(reversed(range(columns))))
    obj = mesh("Groom tapered nape and swept crown", vertices, faces, cropped, parent)
    taper = obj.vertex_groups.new(name="Scalp-conforming taper")
    for row in range(rows):
        blend = max(0, min(1, (row / (rows - 1) - .45) / .55))
        weight = blend * blend * (3 - 2 * blend)
        taper.add(list(range(row * columns, (row + 1) * columns)), weight, "REPLACE")
    uv_layer = obj.data.uv_layers.new(name="Nape taper")
    for polygon in obj.data.polygons:
        for index in polygon.loop_indices:
            vertex = obj.data.loops[index].vertex_index
            uv_layer.data[index].uv = (vertex % columns / columns, vertex // columns / (rows - 1))
    strand = material("Fine swept chestnut strands", (.065, .035, .020), .68)
    strand.node_tree.nodes["Principled BSDF"].inputs["Specular IOR Level"].default_value = .16
    for index in range(22):
        points = []
        for step in range(15):
            t = step / 14
            angle = (5.8 - index * .035) * (1 - t) + (3.8 + index * .025) * t
            polar = (.12 + index * .009) * (1 - t) + (.75 - index * .006) * t
            point = surface(polar, angle)
            point += (point - Vector(center)).normalized() * .001
            points.append(point)
        curve("Swept crown fibre", points, .0011 + .00025 * math.sin(index * 2.3), strand, parent)
    part = material("Subtle dark side part", (.009, .004, .002), .8)
    curve("Natural crown side part", [
        surface(.32 + .52 * abs(index / 20 - .5), 1.15 - 2.2 * index / 20)
        for index in range(21)], .0013, part, parent)


def head(name, center, female, parent):
    existing = set(bpy.data.objects)
    x, y, z = center
    skin_parts = [rings(name + " head", (x, y), [
        (z - .185, .036, .053, .021), (z - .145, .084, .083, .02),
        (z - .07, .118, .105, .006), (z + .055, .129, .116, 0),
        (z + .142, .105, .10, -.006), (z + .192, .035, .043, -.009)
    ], skin, parent)]
    for side in [-1, 1]:
        skin_parts.append(ellipsoid(name + " ear", (x + side * .122, y, z - .02),
                                    (.019, .025, .043), skin, parent))
    # Faces point into the stage. The camera reads profiles and the detailed updo.
    skin_parts.append(ellipsoid(name + " nose", (x, y + .106, z - .025),
                                (.019, .027, .037), skin, parent))
    if female:
        columns, rows = 80, 32
        vertices, faces = [], []
        for row in range(rows):
            t = row / (rows - 1)
            for column in range(columns):
                angle = TAU * column / columns
                back = (1 - math.sin(angle)) / 2
                maximum = 1.47 + .61 * back
                polar = .012 + maximum * t
                vertices.append((x + .144 * math.sin(polar) * math.cos(angle),
                                 y + .132 * math.sin(polar) * math.sin(angle),
                                 z + .02 + .203 * math.cos(polar)))
        for row in range(rows - 1):
            for column in range(columns):
                nxt = (column + 1) % columns
                faces.append((row * columns + column, row * columns + nxt,
                              (row + 1) * columns + nxt, (row + 1) * columns + column))
        mesh(name + " shaped hair cap", vertices, faces, hair, parent)
        for index in range(46):
            angle = TAU * index / 46
            back = (1 - math.sin(angle)) / 2
            points = []
            for row in range(11):
                polar = .14 + (1.36 + .59 * back) * row / 10
                swept = angle + .25 * math.sin(polar)
                points.append((x + .145 * math.sin(polar) * math.cos(swept),
                               y + .134 * math.sin(polar) * math.sin(swept),
                               z + .021 + .205 * math.cos(polar)))
            curve(name + " combed hair", points, .0015, hair_glint, parent)
        ellipsoid("Braided bridal chignon", (x, y - .139, z - .047),
                  (.102, .064, .076), hair, parent)
        for index in range(28):
            angle = TAU * index / 28
            curve("Woven chignon strand", [
                (x + .099 * math.cos(angle), y - .143, z - .047 + .074 * math.sin(angle)),
                (x + .093 * math.cos(angle + .5), y - .201, z - .047 + .069 * math.sin(angle + .5)),
                (x + .04 * math.cos(angle + 1), y - .206, z - .047 + .04 * math.sin(angle + 1))
            ], .002, hair_glint, parent)
        for index in range(13):
            angle = math.pi * .12 + math.pi * .76 * index / 12
            ellipsoid("Pearl hair comb", (x + .112 * math.cos(angle), y - .143,
                                         z - .024 + .081 * math.sin(angle)),
                      (.0055, .0055, .007), pearl, parent)
        for side in [-1, 1]:
            ellipsoid("Pearl drop earring", (x + side * .128, y - .009, z - .081),
                      (.008, .008, .016), pearl, parent)
    else:
        short_tapered_hair(center, parent)
    pivot = Vector((x, y, z - .19))
    rotation = Matrix.Rotation(math.radians(11 if female else -9), 4, "Y")
    rotation @= Matrix.Rotation(math.radians(-38 if female else 42), 4, "Z")
    transform = Matrix.Translation(pivot) @ rotation @ Matrix.Translation(-pivot)
    bpy.context.view_layer.update()
    transforms = [(obj, obj.matrix_world.copy()) for obj in set(bpy.data.objects) - existing]
    for obj, original in transforms:
        obj.matrix_world = transform @ original
    return skin_parts


BRIDE = (-.35, -.13)
GROOM = (.63, .16)


def skirt_point(t, angle):
    x, y = BRIDE
    fold = .026 * t ** 1.5 * math.cos(18 * angle + 1.1 * t)
    fold += .012 * t * t * math.sin(31 * angle - 2 * t)
    radius = .168 + (.68 - .13 * max(0, math.cos(angle))) * t ** 1.4 + fold
    # The train pools away from the groom, rather than crossing his trousers.
    left = max(0, -math.cos(angle))
    train = .12 * left ** 3 * t ** 5
    return (x + (radius + train) * math.cos(angle) - .03 * t * t,
            y + (.126 + .65 * t ** 1.6 + .6 * fold) * math.sin(angle) + .11 * t * t,
            1.80 - 1.69 * t + .015 * t ** 3 * math.cos(18 * angle + 1.1 * t))


def gown(parent):
    columns, rows = 192, 64
    vertices = [skirt_point(row / (rows - 1), TAU * column / columns)
                for row in range(rows) for column in range(columns)]
    faces = []
    for row in range(rows - 1):
        for column in range(columns):
            nxt = (column + 1) % columns
            faces.append((row * columns + column, row * columns + nxt,
                          (row + 1) * columns + nxt, (row + 1) * columns + column))
    obj = mesh("Couture silk skirt and pooled train", vertices, faces, ivory, parent)
    sub = obj.modifiers.new("Silk folds", "SUBSURF")
    sub.levels = 1
    solid = obj.modifiers.new("Finished silk hem", "SOLIDIFY")
    solid.thickness = .003
    curve("Scalloped embroidered hem", [skirt_point(.986, TAU * i / 240) for i in range(241)],
          .004, champagne, parent)
    for column in range(24):
        angle = TAU * column / 24 + .09
        points = [Vector(skirt_point(.06 + .88 * row / 36, angle + .017 * math.sin(row * .35)))
                  for row in range(37)]
        outward = Vector((math.cos(angle), math.sin(angle), .06)) * .004
        curve("Fine silk panel seam", [point + outward for point in points], .0018, silk_trim, parent)
    for column in range(34):
        angle = TAU * column / 34
        for row in range(10):
            t = .72 + row * .024
            middle = Vector(skirt_point(t, angle)) + Vector((0, -.002, .005))
            leaf = [
                Vector(skirt_point(t - .009, angle - .009)),
                Vector(skirt_point(t - .025, angle - .03)),
                Vector(skirt_point(t - .04, angle - .005)),
                middle
            ]
            curve("Botanical hem embroidery", leaf, .002, champagne, parent)
            if row % 2 == 0:
                ellipsoid("Sewn seed pearl", middle, (.0035, .0035, .0035), pearl, parent)
    x, y = BRIDE
    sections = [
        (1.765, .169, .131, 0), (1.81, .168, .133, 0),
        (1.91, .172, .129, 0), (2.055, .195, .14, 0),
        (2.18, .225, .148, 0), (2.31, .243, .142, 0),
        (2.40, .242, .132, 0)
    ]
    bodice = rings("Fitted silk bodice with dipped back", BRIDE, sections, ivory, parent)
    for vertex in bodice.data.vertices:
        if vertex.co.z > 2.30:
            back = max(0, (y - vertex.co.y) / .142)
            vertex.co.z -= .21 * back ** 3 * ((vertex.co.z - 2.30) / .10)
    neckline = []
    for index in range(97):
        angle = TAU * index / 96
        back = max(0, -math.sin(angle))
        neckline.append((x + .242 * math.cos(angle), y + .133 * math.sin(angle),
                         2.397 - .21 * back ** 3))
    curve("Beaded dipped neckline", neckline, .0045, pearl, parent)
    curve("Silk waist binding", [(x + .172 * math.cos(TAU * i / 96),
                                  y + .135 * math.sin(TAU * i / 96), 1.79) for i in range(97)],
          .005, silk_trim, parent)
    for index in range(13):
        z = 1.84 + index * .025
        ellipsoid("Covered back button", (x, y - .145, z), (.008, .004, .008), pearl, parent)
    for side in [-1, 1]:
        for row in range(8):
            z = 1.92 + row * .035
            xx = x + side * (.075 + .03 * math.sin(row * .5))
            curve("Bodice leaf embroidery", [(xx, y - .145, z),
                                             (xx + side * .031, y - .139, z + .021),
                                             (xx + side * .008, y - .146, z + .04)],
                  .002, champagne, parent)


def bridal_veil(parent):
    x, y = BRIDE
    rows, columns = 64, 48

    def position(t, u):
        width = .071 + .35 * t ** .65
        return (x + width * u - .41 * t ** 1.6,
                y - .207 - .10 * math.sin(t * math.pi) + .032 * math.cos(u * 15 + t * 5),
                2.84 - 2.665 * t + .025 * t * t * math.cos(u * 13))

    vertices = [position(row / (rows - 1), 2 * column / (columns - 1) - 1)
                for row in range(rows) for column in range(columns)]
    faces = []
    for row in range(rows - 1):
        for column in range(columns - 1):
            a = row * columns + column
            faces.append((a, a + 1, a + columns + 1, a + columns))
    obj = mesh("Airy cathedral veil", vertices, faces, tulle, parent)
    sub = obj.modifiers.new("Soft tulle waves", "SUBSURF")
    sub.levels = 1
    for side in [-1, 1]:
        curve("Veil rolled silk edge", [position(i / 80, side) for i in range(81)],
              .0019, silk_trim, parent)


def bride(parent):
    x, y = BRIDE
    body = rings("Bride continuous shoulders and neck", BRIDE, [
        (1.78, .153, .114, 0), (2.08, .192, .123, 0),
        (2.29, .23, .128, 0), (2.39, .255, .129, 0),
        (2.445, .251, .123, 0), (2.48, .166, .098, 0),
        (2.525, .073, .067, 0), (2.64, .064, .063, .008),
        (2.725, .066, .068, .009)
    ], skin, parent)
    limbs = [
        arm("Bride relaxed outer arm", [(x - .241, y, 2.415), (-.76, -.21, 2.14),
                                        (-.54, -.36, 1.945)], .051, skin, parent),
        arm("Bride lifted inner arm", [(x + .238, y, 2.418), (.015, -.19, 2.49),
                                       (.135, -.08, 2.78)], .052, skin, parent)
    ]
    shoulders = [ellipsoid("Soft bridal shoulder", (x + side * .239, y, 2.412),
                           (.067, .06, .064), skin, parent) for side in [-1, 1]]
    skin_parts = [body, *shoulders, *limbs,
                  *head("Bride", (x + .022, y + .018, 2.835), True, parent)]
    united_skin(skin_parts, "Bride uninterrupted sculpt")
    hand("Bride resting hand", (-.54, -.36, 1.945), (-.44, -.385, 1.925), skin, parent)
    hand("Bride joined hand", (.135, -.08, 2.78), (.171, -.066, 2.864), skin, parent)
    gown(parent)
    bridal_veil(parent)


def tailored_trousers(parent):
    x, y = GROOM
    pelvis = rings("Trouser waist and continuous seat", GROOM, [
        (1.345, .035, .038, 0), (1.38, .130, .085, 0),
        (1.43, .200, .115, 0), (1.48, .214, .122, 0),
        (1.64, .208, .118, 0), (1.80, .200, .112, 0)
    ], suit, parent)
    pieces = [pelvis]
    for side in [-1, 1]:
        stagger = .04 if side < 0 else -.05
        foot_x = x + (-.13 if side < 0 else .15)
        sections = [
            (.18, foot_x, y + stagger, .078, .080),
            (.23, foot_x, y + stagger, .076, .077),
            (.34, foot_x, y + stagger * .95, .078, .083),
            (.55, foot_x, y + stagger * .90, .087, .094),
            (.78, x + side * .133, y + stagger * .85, .090, .095),
            (.96, x + side * .130, y + stagger * .65, .092, .096),
            (1.14, x + side * .126, y + stagger * .45, .100, .107),
            (1.30, x + side * .120, y + stagger * .20, .105, .114),
            (1.44, x + side * .115, y, .105, .115),
            (1.59, x + side * .110, y, .099, .109)
        ]
        vertices, faces = [], []
        columns = 64
        for z, cx, cy, rx, ry in sections:
            for index in range(columns):
                angle = TAU * index / columns
                crease = .003 * abs(math.sin(angle)) ** 14
                vertices.append((cx + rx * math.cos(angle),
                                 cy + (ry + crease) * math.sin(angle), z))
        for row in range(len(sections) - 1):
            for index in range(columns):
                nxt = (index + 1) % columns
                faces.append((row * columns + index, row * columns + nxt,
                              (row + 1) * columns + nxt, (row + 1) * columns + index))
        faces.append(tuple(reversed(range(columns))))
        faces.append(tuple((len(sections) - 1) * columns + index for index in range(columns)))
        leg = mesh("Shaped cloth trouser leg", vertices, faces, suit, parent)
        sub = leg.modifiers.new("Soft trouser tailoring", "SUBSURF")
        sub.levels = 2
        pieces.append(leg)
        for front in [-1, 1]:
            curve("Subtle pressed cloth crease", [
                (cx, cy + front * (ry + .0035), z)
                for z, cx, cy, rx, ry in sections[1:-2]], .0012, suit, parent)
        formal_shoe((foot_x, y + stagger), side, parent)
    united_skin(pieces, "Single continuous tailored trousers")


def formal_shoe(ankle, side, parent):
    sections = [
        (-.105, .050, .105), (-.095, .071, .135), (-.04, .073, .150),
        (.025, .077, .135), (.085, .084, .085), (.16, .085, .057),
        (.225, .067, .041), (.255, .026, .030)
    ]
    yaw = -side * math.radians(7)

    def point(dx, dy, z):
        return (ankle[0] + dx * math.cos(yaw) - dy * math.sin(yaw),
                ankle[1] + dx * math.sin(yaw) + dy * math.cos(yaw), z)

    footprint = [(-width, along) for along, width, _ in sections]
    footprint += [(width, along) for along, width, _ in reversed(sections)]
    vertices = [point(dx, dy, z) for z in [LOCAL_FLOOR, LOCAL_FLOOR + .018]
                for dx, dy in footprint]
    count = len(footprint)
    faces = [tuple(reversed(range(count))), tuple(range(count, 2 * count))]
    faces += [(index, (index + 1) % count, (index + 1) % count + count, index + count)
              for index in range(count)]
    sole = mesh("Grounded leather outsole", vertices, faces, patent, parent)
    bevel = sole.modifiers.new("Soft leather sole edge", "BEVEL")
    bevel.width, bevel.segments = .003, 2
    vertices, faces = [], []
    columns = 48
    for along, width, height in sections:
        for index in range(columns):
            angle = TAU * index / columns
            vertices.append(point(width * math.cos(angle), along,
                                  LOCAL_FLOOR + .017 + height * max(0, math.sin(angle)) ** .75))
    for row in range(len(sections) - 1):
        for index in range(columns):
            nxt = (index + 1) % columns
            faces.append((row * columns + index, row * columns + nxt,
                          (row + 1) * columns + nxt, (row + 1) * columns + index))
    faces.append(tuple(reversed(range(columns))))
    faces.append(tuple((len(sections) - 1) * columns + index for index in range(columns)))
    upper = mesh("Forward-facing sculpted Oxford upper", vertices, faces, patent, parent)
    sub = upper.modifiers.new("Rounded leather upper", "SUBSURF")
    sub.levels = 2


def groom(parent):
    x, y = GROOM
    tailored_trousers(parent)
    jacket = rings("Sculpted tailored dinner jacket", GROOM, [
        (1.47, .239, .138, 0), (1.505, .243, .142, 0),
        (1.64, .234, .148, 0), (1.88, .216, .14, 0),
        (2.14, .257, .156, 0), (2.40, .304, .159, 0),
        (2.52, .323, .149, 0), (2.585, .303, .139, 0),
        (2.625, .182, .093, .006), (2.65, .081, .077, .005)
    ], suit, parent)
    neck = rings("Groom neck", GROOM, [
        (2.60, .068, .063, .007), (2.68, .068, .065, .007),
        (2.81, .064, .067, .009), (2.88, .072, .065, .009)
    ], skin, parent)
    scalp = united_skin([neck, *head("Groom", (x - .014, y + .012, 2.98), False, parent)],
                        "Groom joined head and neck")
    hair_cap = bpy.data.objects["Groom tapered nape and swept crown"]
    taper = hair_cap.modifiers.new("Close-cropped scalp transition", "SHRINKWRAP")
    taper.target = scalp
    taper.vertex_group = "Scalp-conforming taper"
    taper.wrap_method = "NEAREST_SURFACEPOINT"
    taper.wrap_mode = "OUTSIDE_SURFACE"
    taper.offset = .0015
    rings("Fitted ivory collar", GROOM, [
        (2.614, .083, .078, .007), (2.628, .083, .078, .007),
        (2.69, .078, .076, .007), (2.706, .074, .072, .007)
    ], shirt, parent)
    curve("Satin collar seam", [(x - .185, y - .10, 2.59), (x - .071, y - .077, 2.64),
                                (x, y - .075, 2.65), (x + .071, y - .077, 2.64),
                                (x + .185, y - .10, 2.59)], .015, satin, parent)
    curve("Jacket centre seam", [(x, y - .132, 1.51), (x, y - .138, 1.87),
                                 (x, y - .148, 2.26), (x, y - .144, 2.57)],
          .0018, suit_trim, parent)
    for side in [-1, 1]:
        curve("Tailored shoulder seam", [(x + side * .065, y - .09, 2.636),
                                         (x + side * .18, y - .103, 2.603),
                                         (x + side * .269, y - .069, 2.559)],
              .002, suit_trim, parent)
    raised_sleeve = arm("Groom lifted left sleeve", [(x - .29, y, 2.54), (.225, .05, 2.63),
                                                    (.19, -.044, 2.815)], .086, suit, parent)
    hand("Groom joined hand", (.19, -.044, 2.815), (.174, -.054, 2.886), skin, parent)
    curve("Raised ivory cuff", [(.197, -.041, 2.79), (.19, -.044, 2.817)],
          .045, shirt, parent)
    relaxed_sleeve = arm("Groom relaxed right sleeve", [(x + .29, y, 2.54), (1.041, .105, 2.18),
                                                       (.947, -.003, 1.853)], .087, suit, parent)
    shoulders = [ellipsoid("Tailored shoulder cap", (x + side * .292, y, 2.527),
                           (.092, .093, .085), suit, parent) for side in [-1, 1]]
    united_skin([jacket, *shoulders, raised_sleeve, relaxed_sleeve],
                "Continuous jacket and tailored sleeves")
    curve("Relaxed ivory cuff", [(.953, .006, 1.88), (.947, -.003, 1.847)],
          .041, shirt, parent)
    hand("Groom relaxed hand", (.947, -.003, 1.847), (.94, -.012, 1.729), skin, parent)
    for z in [1.985, 2.025, 2.065]:
        ellipsoid("Sleeve covered button", (.996, .03, z), (.005, .005, .005), satin, parent)


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
    # Larger facets share the exact cloth deformation. None are free particles.
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


def stage():
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
    bride(root)
    groom(root)
    # Scale the joined couple 10% around the unchanged stage-contact plane.
    root.scale = (FIGURE_SCALE, FIGURE_SCALE, FIGURE_SCALE)
    root.location.z = STAGE_TOP * (1 - .9)
    for frame, angle in [(1, -50), (TURN_START_FRAME, -50),
                         (SETTLED_FRAME, 25), (LAST_FRAME, 25)]:
        root.rotation_euler.z = math.radians(angle)
        root.keyframe_insert("rotation_euler", frame=frame)
    for fcurve in root.animation_data.action.fcurves:
        for keyframe in fcurve.keyframe_points:
            # Keep the visible turn steady through the fixed endpoint.
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
    global velvet, ivory, silk_trim, champagne, pearl, tulle, suit, suit_trim
    global satin, skin, hair, hair_glint, shirt, patent, floor, background
    global stage_gold, gold, ruby_foil, glint
    velvet = velvet_material()
    ivory = fabric("Pearl ivory duchess silk", (.77, .71, .61), .34, .38)
    silk_trim = material("Ivory silk stitched edges", (.64, .53, .36), .4)
    champagne = material("Subtle champagne botanical embroidery", (.66, .53, .33), .38, .48)
    pearl = material("Warm seed pearls", (.83, .76, .62), .24, .18)
    tulle = material("Transparent ivory tulle", (.86, .8, .69), .66)
    nodes, links = tulle.node_tree.nodes, tulle.node_tree.links
    mix = nodes.new("ShaderNodeMixShader")
    mix.inputs[0].default_value = .075
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(nodes.get("Principled BSDF").outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], nodes.get("Material Output").inputs["Surface"])
    suit = fabric("Midnight black tailored wool", (.012, .016, .024), .55, .19)
    suit.node_tree.nodes.get("Principled BSDF").inputs["Specular IOR Level"].default_value = .12
    suit_trim = material("Dark tailored stitching", (.035, .041, .055), .58)
    satin = material("Midnight silk satin collar", (.022, .026, .033), .43)
    satin.node_tree.nodes.get("Principled BSDF").inputs["Specular IOR Level"].default_value = .2
    skin = material("Warm sculpted skin", (.42, .27, .18), .54)
    skin.node_tree.nodes.get("Principled BSDF").inputs["Subsurface Weight"].default_value = .08
    skin.node_tree.nodes.get("Principled BSDF").inputs["Specular IOR Level"].default_value = .18
    hair = fabric("Deep chestnut hair", (.021, .010, .006), .62, .10)
    hair.node_tree.nodes.get("Principled BSDF").inputs["Specular IOR Level"].default_value = .2
    hair_glint = material("Fine chestnut hair strands", (.05, .027, .014), .46)
    shirt = material("Ivory cotton shirt", (.67, .66, .62), .62)
    patent = material("Black patent leather shoes", (.006, .008, .011), .22)
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
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--width", type=int, default=720)
    parser.add_argument("--height", type=int, default=1440)
    parser.add_argument("--samples", type=int, default=80)
    parser.add_argument("--frames", default="1,35,61,103,145,162")
    parser.add_argument("--animation", action="store_true")
    args = parser.parse_args(arguments)
    FRAME_ASPECT = args.width / args.height
    args.output.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    make_materials()
    stage()
    scene = configure(args)
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

import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Vector4 } from '@babylonjs/core/Maths/math.vector';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { Materials, random, type Surface } from './scene';
import type { Troop } from './types';
import { marchingFormation } from './marches';

type Roof = 'gable' | 'round' | 'spire' | 'terrace';
interface Culture { roof: Roof; wall: string; wood: string; accent: string }
const architecture: { foundation: Surface; wall: Surface; roof: Surface; pitch: number }[] = [
  { foundation: 'dirt', wall: 'oldWood', roof: 'thatch', pitch: .25 },
  { foundation: 'mossStone', wall: 'wood', roof: 'thatch', pitch: .34 },
  { foundation: 'stone', wall: 'ashlar', roof: 'slate', pitch: .27 },
  { foundation: 'ashlar', wall: 'ashlar', roof: 'slate', pitch: .45 },
  { foundation: 'brick', wall: 'brick', roof: 'iron', pitch: .17 },
  { foundation: 'ashlar', wall: 'iron', roof: 'slate', pitch: .09 },
  { foundation: 'ashlar', wall: 'iron', roof: 'iron', pitch: .30 },
];
const styles: Record<string, Culture> = {
  aurel: { roof: 'gable', wall: '#d6bc91', wood: '#5f4937', accent: '#9b6450' },
  sylva: { roof: 'spire', wall: '#b6ad82', wood: '#4f4c33', accent: '#446b55' },
  grak: { roof: 'gable', wall: '#987964', wood: '#532f25', accent: '#aa4733' },
  brindle: { roof: 'round', wall: '#dcc6a0', wood: '#704f33', accent: '#818e42' },
  veil: { roof: 'spire', wall: '#aca8c3', wood: '#574f6a', accent: '#8378b6' },
  root: { roof: 'round', wall: '#a28962', wood: '#5b4a36', accent: '#57703e' },
  goa: { roof: 'terrace', wall: '#ceb076', wood: '#77502e', accent: '#38848d' },
  pam: { roof: 'round', wall: '#d3adc1', wood: '#675064', accent: '#b75e9d' },
  abra: { roof: 'terrace', wall: '#d3ad86', wood: '#593d32', accent: '#c3633c' },
  andro: { roof: 'spire', wall: '#b6c4cc', wood: '#425668', accent: '#647faf' },
  matrix: { roof: 'terrace', wall: '#97ac9b', wood: '#314943', accent: '#408e76' },
  avatar: { roof: 'spire', wall: '#a2bdba', wood: '#3c6973', accent: '#448eae' },
  dwarf: { roof: 'terrace', wall: '#b3ac9f', wood: '#6a5949', accent: '#b5784b' },
  insect: { roof: 'round', wall: '#aaa170', wood: '#464c30', accent: '#b9b752' },
};

export class Model {
  readonly root: TransformNode;
  private readonly parts: Mesh[] = [];

  constructor(name: string, readonly materials: Materials) {
    this.root = new TransformNode(name, materials.scene);
  }

  private part(mesh: Mesh, x: number, y: number, z: number, tone: string, glow = false, surface?: Surface) {
    mesh.material = this.materials.get(tone, glow, surface);
    mesh.position.set(x, y, z);
    this.parts.push(mesh);
    return mesh;
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, tone: string, angle = 0, surface?: Surface) {
    const uv = (a: number, b: number) => new Vector4(0, 0, Math.max(.15, a / 1.8), Math.max(.15, b / 1.8));
    const faceUV = surface ? [uv(w, h), uv(w, h), uv(d, h), uv(d, h), uv(w, d), uv(w, d)] : undefined;
    const mesh = this.part(CreateBox('Bauteil', { width: w, height: h, depth: d, faceUV }, this.materials.scene), x, y, z, tone, false, surface);
    mesh.rotation.y = angle;
    return mesh;
  }

  cone(x: number, y: number, z: number, size: number, h: number, tone: string, sides = 8, top = 0, glow = false, surface?: Surface) {
    return this.part(CreateCylinder('Körper', { diameterBottom: size, diameterTop: top, height: h, tessellation: sides },
      this.materials.scene), x, y, z, tone, glow, surface);
  }

  sphere(x: number, y: number, z: number, diameter: number, tone: string, surface?: Surface) {
    return this.part(CreateSphere('Kugel', { diameter, segments: surface === 'chitin' ? 8 : 6 }, this.materials.scene), x, y, z, tone, false, surface);
  }

  gables(x: number, y: number, z: number, width: number, depth: number, rise: number, tone: string) {
    const mesh = new Mesh('Giebel', this.materials.scene);
    const data = new VertexData();
    const half = width / 2, end = depth / 2;
    data.positions = [-half, 0, -end, 0, rise, -end, half, 0, -end, -half, 0, end, 0, rise, end, half, 0, end];
    data.indices = [0, 2, 1, 3, 4, 5];
    const normals: number[] = [];
    VertexData.ComputeNormals(data.positions, data.indices, normals);
    data.normals = normals;
    data.uvs = [0, 0, width * .28, rise * .5, width * .56, 0, 0, 0, width * .28, rise * .5, width * .56, 0];
    data.applyToMesh(mesh);
    this.part(mesh, x, y, z, tone, false, 'wood');
  }

  finish(metadata: unknown, shadows?: ShadowGenerator | null, pickable = true) {
    const byMaterial = new Map<string, Mesh[]>();
    for (const part of this.parts) {
      const key = part.material!.name;
      if (!byMaterial.has(key)) byMaterial.set(key, []);
      byMaterial.get(key)!.push(part);
    }
    for (const group of byMaterial.values()) {
      const mesh = group.length === 1 ? group[0] : Mesh.MergeMeshes(group, true, true);
      if (!mesh) continue;
      mesh.parent = this.root;
      mesh.metadata = metadata;
      mesh.isPickable = pickable;
      mesh.receiveShadows = true;
      shadows?.addShadowCaster(mesh);
    }
    return this.root;
  }
}

function house(model: Model, x: number, z: number, w: number, d: number, h: number, culture: Culture, age: number) {
  const { roof, wall, wood, accent } = culture;
  const era = architecture[age] ?? architecture[0];
  model.box(x, .10, z, w * 1.09, .20, d * 1.09, '#78796b', 0, era.foundation);
  model.box(x, h / 2 + .18, z, w, h, d, age ? wall : '#a68a66', 0, era.wall);
  model.box(x, h + .16, z, w * 1.09, .12, d * 1.09, wood, 0, age >= 4 ? 'iron' : 'wood');
  model.box(x, .41 * h + .15, z - d / 2 - .012, w * .24, h * .77, .07, '#302b26');
  if (age >= 4) {
    const rail = age === 4 ? '#6b5d51' : '#708a90';
    for (const side of [-1, 1]) {
      const face = x + w * .504 * side;
      model.box(face, h * .70 + .14, z, .056, h * .29, d * .77, age === 4 ? '#666b63' : '#608da0');
      for (const bay of [-.33, 0, .33]) model.box(face, h * .70 + .14, z + bay * d, .074, h * .33, .05, rail);
    }
    if (age === 4) {
      model.box(x, h + .27, z, w * 1.12, .19, d * 1.12, '#82796e', 0, era.roof);
      model.cone(x + w * .29, h + .58, z + d * .27, w * .13, Math.min(1.22, h * .95), '#63564d', 10, w * .10, false, 'brick');
    } else if (age === 5) {
      model.box(x, h + .27, z, w * 1.16, .21, d * 1.14, '#92a4a2', 0, 'iron');
      for (const side of [-1, 1]) {
        const panel = model.box(x + side * w * .24, h + .47, z, w * .41, .08, d * .78, '#496d83');
        panel.rotation.z = .14 * side;
      }
    } else {
      model.cone(x, h + .32, z, w * 1.29, .37, accent, 6, w * .83, false, 'iron').scaling.z = d / w;
      model.cone(x, h + .67, z, w * .72, .52, '#5e8c9b', 6, w * .41, false).scaling.z = d / w;
      model.box(x, h + .30, z - d * .535, w * .60, .06, .07, '#8ccbd6', 0);
    }
    return;
  }
  for (const side of [-1, 1]) {
    model.box(x + w * .44 * side, h / 2 + .17, z - d * .51, .11, h, .09, wood, 0, 'wood');
    if (age || w > 1.4) {
      model.box(x + w * .31 * side, h * .68, z - d * .51, w * .13, .19 * h, .07, age > 3 ? '#81c2cb' : '#554433');
    }
  }
  if (w > 2.2) {
    for (const side of [-1, 1]) {
      const end = z + side * d * .505;
      for (const column of [-.44, -.16, .16, .44]) {
        model.box(x + w * column, h * .50 + .15, end, .088, h, .075, wood, 0, 'wood');
      }
      for (const edge of [-1, 1]) {
        timber(model, [x + edge * w * .43, h * .23, end], [x + edge * w * .16, h * .86, end], .076, wood);
        model.box(x + w * .30 * edge, h * .59, end + side * .027, .29, .28, .043, '#3b3628', 0, 'oldWood');
        for (const mullion of [-1, 1]) {
          model.box(x + (w * .30 + .14 * mullion) * edge, h * .59, end + side * .055, .04, .32, .041, wall, 0, 'wood');
        }
      }
    }
  }
  const tone = age ? accent : '#aa8c57';
  const surface = era.roof;
  if (roof === 'gable') {
    const rise = w * era.pitch;
    const half = w * .58;
    const pitch = Math.atan2(rise, half);
    model.gables(x, h + .14, z, w, d, rise * .9, wood);
    for (const side of [-1, 1]) {
      const slope = model.box(x + side * half / 2, h + .17 + rise / 2, z, Math.hypot(half, rise) + .04, .093, d * 1.2, tone, 0, surface);
      slope.rotation.z = -side * pitch;
      model.box(x + side * half, h + .158, z, .074, .079, d * 1.21, wood, 0, 'wood');
      if (w > 2 && age >= 1) for (let course = 0; course < 7; course++) {
        const offset = (course + .56) / 7;
        for (let tile = 0; tile < 5; tile++) {
          const grain = random(course * 13 + tile * 19 + side);
          const strip = model.box(x + side * half * offset, h + .228 + rise * (1 - offset), z + (tile - 2) * d * .226,
            Math.hypot(half, rise) * .148, .035 + grain * .022, d * (.226 + grain * .043),
            age < 2 ? grain > .57 ? '#9b814d' : '#b5975e' : grain > .57 ? '#8c7762' : accent, 0, surface);
          strip.rotation.z = -side * pitch;
        }
      }
    }
    model.box(x, h + .19 + rise, z, .093, .105, d * 1.24, wood, 0, 'wood');
  } else if (roof === 'terrace' && age > 0) {
    model.box(x, h + .28, z, w * 1.1, .18, d * 1.1, tone, 0, 'stone');
    model.box(x, h + .48, z, w * .81, .25, d * .82, wall, 0, 'stone');
    model.box(x, h + .63, z, w * .65, .09, d * .65, tone, 0, surface);
  } else {
    const tall = roof === 'spire' ? w * .73 : w * .45;
    const hood = model.cone(x, h + .15 + tall / 2, z, w * 1.54, tall, tone, roof === 'spire' ? 8 : 14, roof === 'spire' ? .05 : w * .18, false, surface);
    hood.scaling.z = d / w;
  }
  if (age === 1) {
    for (const side of [-1, 1]) model.box(x + side * w * .15, h * .54 + .16, z - d * .535, .09, h * .87, .09, '#ad7951');
  } else if (age === 2) {
    model.box(x, .64 * h + .18, z - d * .523, w * .33, .13, .13, '#a19987', 0, 'stone');
  }
  if (age > 2) {
    model.cone(x + w * .31, h + .64, z + d * .23, .22, .76, wood, 4, .19, false, 'brick');
    model.cone(x + w * .31, h + 1, z + d * .23, .26, .10, wall, 4, .25, false, 'ashlar');
  }
}

function tower(model: Model, x: number, z: number, h: number, culture: Culture, cap = true) {
  model.cone(x, h / 2, z, .91, h, culture.wall, 7, .74, false, 'ashlar');
  model.cone(x, h, z, 1.04, .19, culture.wood, 7, 1.04);
  if (cap) model.cone(x, h + .31, z, 1.12, .57, culture.accent, 7, 0, false, 'slate');
  else for (let index = 0; index < 6; index++) {
    const angle = index * Math.PI / 3;
    model.box(x + Math.cos(angle) * .42, h + .18, z + Math.sin(angle) * .42, .22, .25, .22, culture.wall);
  }
}

function timber(model: Model, a: [number, number, number], b: [number, number, number], width: number, tone: string) {
  const [dx, dy, dz] = b.map((value, axis) => value - a[axis]);
  const beam = model.box(a[0] + dx / 2, a[1] + dy / 2, a[2] + dz / 2,
    width, width, Math.hypot(dx, dy, dz), tone, Math.atan2(dx, dz), 'wood');
  beam.rotation.x = -Math.atan2(dy, Math.hypot(dx, dz));
}

function fence(model: Model, x: number, z: number, w: number, d: number, culture: Culture, gate: number) {
  const west = x - w / 2, east = x + w / 2, front = z - d / 2, back = z + d / 2;
  const sections = [
    [west, front, x - gate, front], [x + gate, front, east, front],
    [west, back, east, back], [west, front, west, back], [east, front, east, back],
  ];
  for (const [ax, az, bx, bz] of sections) {
    for (const height of [.24, .46]) timber(model, [ax, height, az], [bx, height + .03, bz], .075, culture.wood);
    const posts = Math.ceil(Math.hypot(bx - ax, bz - az) / .95);
    for (let i = 0; i <= posts; i++) {
      const s = i / Math.max(1, posts), height = .50 + random(i * 11 + ax) * .19;
      model.box(ax + (bx - ax) * s, height / 2, az + (bz - az) * s, .10, height, .11, culture.wood, i * .17, 'wood');
    }
  }
}

function hallDetails(model: Model, culture: Culture, tint: string, level: number) {
  const front = -2.17;
  model.box(0, .17, front, 4.05, .34, 1.17, '#948478', 0, 'stone');
  for (let step = 0; step < 3; step++) model.box(0, .05 + step * .055, -3.01 + step * .14, 1.68,
    .11 + step * .105, .30, '#a49787', 0, 'stone');
  const canopy = model.box(0, 1.68, -2.20, 4.37, .095, 1.46, '#c7aa65', 0, 'thatch');
  canopy.rotation.x = -.15;
  for (const x of [-1.8, -.83, .83, 1.8]) {
    model.box(x, .96, -2.72, .14, 1.31, .16, culture.wood, 0, 'wood');
    model.box(x, .39, -2.72, .22, .19, .22, '#887d6c', 0, 'stone');
  }
  for (const side of [-1, 1]) {
    timber(model, [side * 1.78, 1.16, -2.72], [side * 1.35, 1.56, -2.72], .093, culture.wood);
    model.box(side * 1.27, .48, -2.29, .68, .14, .25, culture.wood, 0, 'wood');
    const standard = side * 2.12;
    model.cone(standard, 1.05, -2.8, .055, 2.10, culture.wood, 6, .036, false, 'wood');
    model.box(standard, 1.58, -2.79, .38, .59, .038, tint);
    model.box(standard, 1.52, -2.817, .088, .24, .017, '#c5a971');
  }
  for (let i = 0; i < level; i++) {
    model.cone(-1.7 + i * .39, .27, .72, .31, .49, '#9a5d3d', 10, .23);
    model.cone(-1.7 + i * .39, .53, .72, .30, .068, '#5a4133', 10, .31);
  }
}

function barracks(model: Model, culture: Culture, tint: string, age: number, detail: number) {
  model.box(0, .035, 0, 5.65, .07, 4.8, '#988066', 0, 'dirt');
  fence(model, 0, 0, 5.60, 4.75, culture, .72);
  model.box(-.95, .49, 1.89, 3.25, .96, .14, culture.wood, 0, 'wood');
  for (const x of [-2.48, -1.0, .55]) {
    model.box(x, .71, .69, .12, 1.46, .15, culture.wood, 0, 'wood');
    timber(model, [x, 1.08, .69], [x, 1.40, 1.13], .09, culture.wood);
  }
  const cover = model.box(-.96, 1.38, 1.31, 3.44, .105, 1.66, '#ba9f63', 0, age >= 4 ? 'iron' : age >= 2 ? 'slate' : 'thatch');
  cover.rotation.x = -.25;
  for (let i = 0; i < 3; i++) {
    const x = -1.86 + i * .76;
    model.cone(x, .54, -.42, .074, 1.02, culture.wood, 6, .07, false, 'wood');
    for (const [size, tone] of [[.48, '#8d704b'], [.35, '#cba678'], [.19, '#aa5637']] as const) {
      const target = model.cone(x, .77, -.42 - (.48 - size) * .13, size, .028, tone, 12, size);
      target.rotation.x = Math.PI / 2;
    }
  }
  for (let i = 0; i < detail + 2; i++) {
    const z = .40 + i * .26;
    timber(model, [1.64, .04, z], [1.94, 1.31, z], .042, culture.wood);
    model.cone(1.94, 1.39, z, .10, .19, '#786a59', 4);
  }
  model.box(2.15, .58, -.78, .05, .67, .48, tint, 0, 'cloth');
  if (age >= 3) tower(model, 2.03, 1.52, 1.58, culture);
}

function logYard(model: Model, culture: Culture, age: number, detail: number) {
  model.box(0, .029, 0, 5.7, .055, 4.7, '#8f775f', -.08, 'dirt');
  house(model, -1.35, 1.10, 2.43, 1.49, .86, culture, age);
  for (let layer = 0; layer < Math.min(3, detail + 1); layer++) {
    for (let index = 0; index < 4 - layer; index++) {
      const x = .55 + (index + layer * .5) * .42;
      const z = -.64 + (random(index + layer * 7) - .5) * .38;
      const length = 1.8 + random(index * 13 + layer) * .54;
      const log = model.cone(x, .18 + layer * .28, z, .37, length, '#6c4e3a', 9, .32, false, 'wood');
      log.rotation.x = Math.PI / 2;
      const edge = model.cone(x, .18 + layer * .28, z - length / 2 - .012, .26, .034, '#ad8258', 10, .23);
      edge.rotation.x = Math.PI / 2;
    }
  }
  for (const x of [-1.86, -.82]) {
    timber(model, [x, .03, -.83], [x, .76, -1.41], .124, culture.wood);
    timber(model, [x, .03, -1.65], [x, .76, -1.12], .124, culture.wood);
  }
  timber(model, [-2.28, .73, -1.28], [-.46, .73, -1.28], .16, culture.wood);
}

function shell(model: Model, x: number, y: number, z: number, width: number, height: number, depth: number, tone: string) {
  const layer = model.sphere(x, y, z, 1, tone, 'chitin');
  layer.scaling.set(width, height, depth);
  return layer;
}

function broodHouse(model: Model, x: number, z: number, width: number, height: number, age: number) {
  const tone = ['#89815a', '#a08b50', '#a69561', '#a99968', '#8e8a55', '#70957b', '#659b86'][age];
  const shellHeight = height * (1.1 + age * .052);
  const base = model.cone(x, height * .11, z, width * 1.15, height * .22, '#ab9969', 10, width * 1.02, false, age >= 4 ? 'ashlar' : 'stone');
  base.scaling.z = .85;
  model.cone(x, shellHeight * .22, z, width * .99, shellHeight * .27, '#8e7853', 10, width * .94, false, age >= 4 ? 'ashlar' : 'oldWood').scaling.z = .86;
  shell(model, x, shellHeight * .44, z, width, shellHeight, width * .83, tone);
  for (let i = 0; i < (age >= 3 ? 4 : 3); i++) {
    const proportion = 1 - i * .15;
    shell(model, x, shellHeight * (.40 + i * .15), z + width * i * .015, width * proportion, shellHeight * .30,
      width * (.86 - i * .10), i % 2 ? '#b0a574' : tone);
  }
  const entrance = z - width * .421;
  shell(model, x, shellHeight * .24, entrance, width * .30, shellHeight * .51, width * .18, '#45472c');
  const resin = age >= 5 ? '#9cd6be' : '#cfa44a';
  model.box(x, shellHeight * .18, entrance - width * .095, width * .13, shellHeight * .30, .036, resin);
  for (const side of [-1, 1]) {
    const rib = model.cone(x + side * width * .112, shellHeight * .268, entrance - width * .09, width * .066,
      shellHeight * .49, '#d2ad70', 5, width * .025, false, 'chitin');
    rib.rotation.z = side * .26;
  }
  if (width >= 2.5) {
    for (const angle of [-1.24,-.79,.79,1.24]) {
      const sideX = x + Math.sin(angle) * width * .46, sideZ = z - Math.cos(angle) * width * .405;
      model.box(sideX, shellHeight * .235, sideZ, width * .094, shellHeight * .17, .06, resin, -angle);
      const brace = model.cone(sideX, shellHeight * .20, sideZ, width * .054, shellHeight * .36, '#b69664',
        5, width * .018, false, 'chitin');
      brace.rotation.z = .27 * Math.sign(angle);
    }
    model.box(x, shellHeight * .065, entrance - width * .16, width * .29, shellHeight * .11, width * .28, '#b9a274', 0, 'stone');
    if (age >= 2) {
      const crest = model.cone(x, shellHeight * .99, z + width * .10, width * .16, shellHeight * .36, '#bb9e62', 6,
        width * .023, false, 'chitin');
      crest.rotation.x = -.26;
    }
  }
  if (age >= 4) for (const side of [-1, 1]) {
    const pylon = model.cone(x + side * width * .35, shellHeight * .70, z + width * .12, width * .16, shellHeight * .74, tone, 6, width * .04, false, 'chitin');
    pylon.rotation.z = side * .24;
    if (age >= 5) model.cone(x + side * width * .43, shellHeight * 1.02, z + width * .12, width * .08, shellHeight * .31, '#9bdbc1', 6, .02, age === 6);
  }
}

function insectSite(model: Model, id: string, age: number, level: number, tint: string) {
  if (['farm', 'range', 'quarry', 'lumber'].includes(id)) {
    model.cone(0, .047, 0, 5.36, .09, '#857a50', 10, 5.30, false, 'soil');
    broodHouse(model, 1.25, .65, 1.73, .94 + level * .13, age);
    for (let row = 0; row < 3; row++) for (let column = 0; column < 4; column++) {
      const x = -2 + column * .53, z = -.94 + row * .73;
      const r = random(row * 17 + column * 13);
      const top = id === 'farm' ? '#c8ad70' : id === 'range' ? '#83954c' : '#827762';
      model.cone(x, .16, z, .13 + r * .13, .29 + r * .27, '#a39b6f', 7, .08, false, 'chitin');
      shell(model, x, .28 + r * .24, z, .26 + r * .25, id === 'range' ? .45 : .22, .31 + r * .16, top);
    }
  } else {
    const hall = id === 'hall', chamber = id === 'sig-site-insect';
    const tall = ['watch', 'observatory', 'gate', 'temple'].includes(id);
    const industry = ['forge', 'factory', 'foundry', 'lab', 'mine'].includes(id);
    const broad = ['barracks', 'stable', 'market', 'granary', 'academy'].includes(id);
    broodHouse(model, 0, broad || chamber ? .40 : 0, hall ? 4.36 : tall ? 2.58 : 3.28,
      (hall ? 2.54 : tall ? 3.03 : 1.58) + Math.min(level, 4) * .23, age);
    if (hall || chamber || broad || industry) for (const side of [-1, 1]) {
      const x = side * (hall ? 1.98 : 1.50);
      broodHouse(model, x, industry ? .96 : -.70, chamber ? 1.57 : 1.21, (chamber ? 1.78 : 1.12) + level * .11, age);
    }
    if (industry) for (const side of [-1, 1]) {
      const stalk = model.cone(side * 1.13, 1.49, 1.17, .27, 2.47 + level * .19, '#686b45', 8, .16, false, 'chitin');
      stalk.rotation.z = side * .23;
    }
    if (id === 'market') for (const side of [-1, 1]) {
      const silk = model.box(side * 1.28, .81, -1.12, .98, .08, .86, tint, 0, 'cloth');
      silk.rotation.x = -.24;
    }
    if (hall || chamber) {
      shell(model, 0, .31, -1.91, .53, .54, .57, '#d6b64e');
      for (const side of [-1, 1]) model.cone(side * .86, .46, -1.91, .13, .79, '#c0a250', 6, .05, age > 4);
    }
  }
}

export function settlement(materials: Materials, faction: string, color: string, age: number, level: number, capital: boolean, fortified: boolean, tile: string) {
  const culture = styles[faction] || styles.aurel;
  const model = new Model('Siedlung', materials);
  model.cone(0, .035, 0, 2.53, .10, '#77745b', 14, 2.41, false, 'dirt');
  if (faction === 'insect') {
    broodHouse(model, 0, .10, capital ? 1.48 : 1.21, 1.21 + level * .12, age);
    for (const side of [-1, 1]) broodHouse(model, side * .79, .45, .66, .80, age);
    if (fortified) for (let i = 0; i < 12; i++) {
      const angle = (i + .5) * Math.PI / 6;
      if (i === 8 || i === 9) continue;
      model.cone(Math.cos(angle) * 1.13, .21, Math.sin(angle) * .94, .37, .45, '#928456', 7, .13, false, 'chitin');
    }
    return model.finish({ tile });
  }
  house(model, 0, .13, 1.14, .92, .61 + .11 * level, culture, age);
  for (const side of [-1, 1]) house(model, .76 * side, -.24, .58, .56, .36, culture, age);
  if (capital || fortified || level > 1) {
    if (age < 2) {
      for (const side of [-1, 1]) {
        model.box(side * .99, .31, .51, .23, .58, .24, culture.wood, 0, 'oldWood');
        model.cone(side * .99, .64, .51, .37, .19, culture.accent, 4, .025, false, 'thatch');
      }
    } else for (const side of [-1, 1]) tower(model, side * 1.03, .46, .81 + age * .085, culture, !fortified);
    if (fortified) {
      model.box(0, .29, .76, 2.03, .49, .16, culture.wall, 0, architecture[age].wall);
      for (const x of [-.77, -.43, .43, .77]) model.box(x, .57, .76, .14, .17, .16, culture.wood);
    }
  }
  if (age >= 4) {
    const height = .94 + .19 * age;
    model.box(-.56, height / 2, .83, .29, height, .4, culture.wall);
    model.cone(-.56, height, .83, .42, .15, culture.accent, 5, .36);
    if (age >= 5) {
      model.box(.59, height * .55, .84, .45, height * 1.1, .4, '#647884');
      model.cone(.59, height * 1.1 + .17, .84, .25, .39, color, 6, .075, true);
    }
  }
  model.cone(0, 1.54 + age * .074, -.17, .045, 1.16, '#bc9e65', 6, .035);
  model.box(.21, 1.92 + age * .074, -.17, .45, .27, .044, color);
  return model.finish({ tile });
}

export function buildingModel(materials: Materials, faction: string, tint: string, age: number, id: string, level: number, shadows: ShadowGenerator | null) {
  const culture = styles[faction] || styles.aurel;
  const model = new Model(id, materials);
  const detail = Math.min(4, level);
  if (faction === 'insect') {
    insectSite(model, id, age, level, tint);
  } else if (age === 6 && ['hall', 'academy', 'factory', 'lab', 'foundry'].includes(id)) {
    model.cone(0, .225, 0, 6.02, .45, '#848f97', 8, 5.4, false, 'iron').scaling.z = .82;
    model.cone(0, 1.03, .13, 4.84, 1.27, culture.wall, 8, 4.02, false, 'iron').scaling.z = .75;
    model.cone(0, 1.92, .14, 4.04, .65, '#527c96', 8, 3.35).scaling.z = .75;
    const height = 2.52 + detail * .27 + (id === 'hall' ? .53 : 0);
    model.cone(0, (height + 2.16) / 2, .33, 1.90, height - 2.16, culture.accent, 8, .78, false, 'iron');
    model.cone(0, height + .15, .33, .82, .43, tint, 8, .30, true);
    for (const side of [-1, 1]) {
      model.box(side * 2.07, 1.08, -.30, .16, 1.53, 1.72, tint).rotation.z = side * .19;
      model.box(side * .63, .86, -1.67, .10, 1.30, .13, tint);
    }
  } else if (age === 5 && ['hall', 'academy', 'factory', 'lab', 'foundry'].includes(id)) {
    model.box(0, .14, 0, 5.3, .28, 4.26, '#788687');
    model.box(0, .71, 0, 4.75, .92, 3.54, culture.wall);
    model.box(0, 1.43, .48, 3.28, .54, 2.16, '#557785');
    for (const side of [-1, 1]) {
      const height = 2.2 + detail * .39 + (id === 'hall' ? .53 : 0);
      model.cone(side * 1.17, height / 2, .46, 1.31, height, culture.wall, 6, .66);
      model.cone(side * 1.17, height + .09, .46, 1.01, .25, tint, 6, .62, age >= 6);
      model.cone(side * 1.17, height + .35, .46, .41, .38, '#b8d9d7', 6, .08, true);
    }
    for (let bay = 0; bay < 5; bay++) model.box(-1.66 + bay * .83, .75, -1.781, .55, .34, .04, '#456e7a');
  } else if (id === 'barracks') {
    barracks(model, culture, tint, age, detail);
  } else if (id === 'lumber') {
    logYard(model, culture, age, detail);
  } else if (id === 'farm') {
    model.box(0, .032, .05, 5.45, .07, 4.20, '#876747', 0, 'soil');
    fence(model, 0, 0, 5.55, 4.30, culture, .52);
    const harvest = age >= 5 ? ['#47764f', '#6b9857', '#8cb066'] : ['#94783f', '#bd9f51', '#c8b26c'];
    for (let row = 0; row < 9; row++) {
      const x = -2.35 + row * .58 + (row >= 4 ? .25 : 0);
      const short = row >= 7;
      model.box(x, .085, short ? .5 : .07, .40, .085, short ? 2.45 : 3.78, '#7f694c', 0, age >= 6 ? 'iron' : 'soil');
      for (let grain = 0; grain < (age === 0 ? (short ? 8 : 13) : (short ? 12 : 18)); grain++) {
        const seed = row * 83 + grain * 7;
        const y = .18 + random(seed + 1) * .17;
        const z = 1.74 - grain * .197 + (random(seed + 2) - .5) * .11;
        const blade = model.cone(x + (random(seed) - .5) * .31, y, z,
          .085 + random(seed + 3) * .042, y * 1.42, harvest[(row + grain) % harvest.length], 4, .035);
        blade.rotation.z = (random(seed + 4) - .5) * .78;
      }
    }
    house(model, 1.83, -1.40, 1.20, .98, .63, culture, age);
    if (age <= 1) {
      for (let i = 0; i < detail + 1; i++) model.cone(.32 + i * .34, .19, -1.85, .32, .35, '#d7b768', 8, .13, false, 'thatch');
    } else if (age <= 3) {
      model.box(-.50, .055, .10, .17, .085, 3.54, '#678378');
      if (age === 3) {
        model.cone(-2.16, .21, -1.69, .56, .39, '#9e9481', 9, .54, false, 'stone');
        model.cone(-2.16, .42, -1.69, .42, .05, '#627572', 9, .42);
      }
    } else {
      model.cone(-2.06, .69, -1.66, .67, 1.29, '#8d9ca0', 10, .63, false, 'iron');
      model.box(-1.12, .19, .19, .09, .10, 3.25, '#5f8290', 0, 'iron');
      if (age >= 5) for (const z of [-.93, .16, 1.25]) {
        for (const x of [-.90, .98]) model.box(x, .68, z, .08, 1.28, .09, '#92a6a0', 0, 'iron');
        model.box(.04, 1.32, z, 2.03, .07, .76, age === 6 ? '#6eafaa' : '#567a8b');
      }
    }
  } else if (id === 'quarry' || id === 'mine') {
    model.box(0, .045, 0, 5.65, .10, 4.2, '#918475', 0, 'dirt');
    for (let i = 0; i < 16; i++) {
      const rock = model.cone((random(i) - .5) * 4.5, .12 + random(i + 1) * .26, (random(i + 2) - .5) * 3.5,
        .3 + random(i + 1) * 1.02, .27 + random(i + 2) * .68, i % 2 ? '#938d80' : '#b0a496', 5, .21, false, 'stone');
      rock.rotation.y = i * .61;
    }
    house(model, 1.45, -.86, 1.67, 1.4, .82, culture, age);
  } else if (id === 'watch') {
    const height = 2 + .35 * detail;
    if (age < 2) {
      for (const x of [-.65, .65]) for (const z of [-.66, .66])
        model.box(x, height / 2, z, .15, height, .16, culture.wood, 0, 'oldWood');
      model.box(0, height, 0, 1.58, .19, 1.61, culture.wood, 0, 'wood');
      model.cone(0, height + .68, 0, 2.25, .63, culture.accent, 4, .15, false, 'thatch').rotation.y = Math.PI / 4;
    } else if (age <= 3) {
      tower(model, 0, 0, height + .68, culture, age === 3);
      model.box(0, .18, 0, 1.80, .36, 1.38, culture.wall, 0, 'ashlar');
    } else {
      model.box(0, height / 2, 0, .83, height, .93, culture.wall, 0, architecture[age].wall);
      model.box(0, height, 0, 1.48, .52, 1.29, '#4d7182', 0, 'iron');
      model.cone(0, height + .52, 0, .095, .74, culture.wood, 6, .047);
      if (age >= 5) model.cone(0, height + .91, 0, .43, .27, tint, 8, .18, age === 6);
    }
  } else if (id === 'gate' || id.startsWith('sig-site') || id === 'observatory') {
    model.cone(0, .13, 0, 5.25, .26, culture.wall, 12, 4.7);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      const x = Math.cos(angle) * 1.7, z = Math.sin(angle) * 1.7;
      model.cone(x, 1.0, z, .53, 1.82, culture.wood, 6, .43, false, architecture[age].wall);
      model.cone(x, 2.09, z, .56, .48, tint, 6, 0, age > 3);
    }
    model.cone(0, 1.46, 0, 1.46, 2.4, tint, 6, .17, age > 2);
  } else if (id === 'market') {
    model.box(0, .043, 0, 5.72, .085, 4.39, '#a9937a', 0, 'dirt');
    for (const [i, x] of [-1.78, 0, 1.78].entries()) {
      const z = i === 1 ? .47 : -.31;
      const frame = age >= 4 ? 'iron' : age === 3 ? 'ashlar' : 'wood';
      for (const dx of [-.63, .63]) for (const dz of [-.57, .57]) model.box(x + dx, .85, z + dz, age === 3 ? .15 : .08, 1.55, .093, culture.wood, 0, frame);
      model.box(x, .60, z, 1.25, .17, 1.02, culture.wood, 0, frame);
      for (let stripe = 0; stripe < 7; stripe++) {
        const awning = model.box(x + (stripe - 3) * .216, 1.48, z - .17, .21, .068, 1.60,
          age >= 5 ? '#7799a0' : stripe % 2 ? '#bbad80' : i === 2 ? '#855a47' : tint, 0, age === 4 ? 'iron' : undefined);
        awning.rotation.x = age >= 5 ? -.10 : -.20;
      }
      if (age === 6) model.box(x, 1.68, z - .51, 1.09, .22, .10, tint);
      for (let good = 0; good < 3; good++) {
        model.cone(x + good * .33 - .33, .79, z - .19 + good % 2 * .32, .27, .30, i % 2 ? '#826b4e' : '#a9704b', 8, .19);
      }
      model.box(x + .45, .21, 1.62, .51, .40, .48, culture.wood, i * .21, 'wood');
    }
  } else if (id === 'range') {
    model.box(0, .035, 0, 5.65, .065, 4.46, '#a18461', 0, 'dirt');
    fence(model, 0, 0, 5.66, 4.40, culture, .88);
    for (const x of [-1.72, 0, 1.72]) {
      timber(model, [x - .36, 0, 1.73], [x, 1.26, 1.39], .07, culture.wood);
      timber(model, [x + .36, 0, 1.73], [x, 1.26, 1.39], .07, culture.wood);
      model.box(x, .85, 1.38, .68, .64, .20, '#ba9b5f', 0, 'thatch');
      model.box(x, .86, 1.261, .23, .25, .04, '#97533a');
      model.box(x, .11, -1.44, .76, .16, .23, '#83746a', 0, 'stone');
    }
  } else if (id === 'granary') {
    model.box(0, .05, 0, 4.88, .10, 3.96, '#9a8b69', 0, 'dirt');
    for (const x of [-1.26, 1.26]) {
      for (const dx of [-.58, .58]) for (const z of [-.61, .61]) {
        model.box(x + dx, .34, z, .19, .68, .20, culture.wood, 0, 'wood');
      }
      model.cone(x, 1.12, 0, 1.64, 1.01 + detail * .14, culture.wall, 11, 1.55, false, 'wood');
      model.cone(x, 2.00 + detail * .07, 0, 2.05, .89, '#b8975c', 12, .16, false, 'thatch');
      model.box(x, .80, -.82, .37, .35, .06, '#50473b', 0, 'wood');
    }
    for (const x of [-.21, .21]) timber(model, [x, .025, -1.76], [x, .89, -.80], .065, culture.wood);
    for (let rung = 0; rung < 6; rung++) model.box(0, .085 + rung * .139, -1.66 + rung * .155, .54, .047, .087, culture.wood, 0, 'wood');
  } else if (id === 'temple') {
    for (let step = 0; step < 3; step++) model.box(0, .08 + step * .14, .33, 4.86 - step * .40, .16, 3.74 - step * .36, '#b3a18f', 0, 'stone');
    for (const x of [-1.55, -.53, .53, 1.55]) for (const z of [-.92, 1.65]) {
      model.box(x, 1.28, z, .37, 1.97, .36, culture.wall, 0, 'stone');
      model.box(x, 2.22, z, .56, .19, .52, culture.wall, 0, 'stone');
    }
    model.box(0, 2.40, .34, 4.00, .23, 3.22, culture.accent, 0, 'stone');
    model.box(0, .84, .54, 1.84, .85, .79, '#a79383', 0, 'stone');
    model.cone(0, 1.52, .47, .41, .57, tint, 6, .05, age >= 3);
  } else if (id === 'academy') {
    model.box(0, .18, .43, 4.70, .36, 3.66, '#b0a597', 0, 'ashlar');
    house(model, .17, .81, 4.02, 2.49, 1.56 + detail * .16, culture, age);
    for (const x of [-1.59, -.53, .53, 1.59]) {
      model.box(x, 1.15, -.82, .22, 1.60, .24, culture.wall, 0, 'stone');
      model.box(x, 1.96, -.82, .39, .18, .40, '#b0a597', 0, 'ashlar');
    }
    model.box(0, 2.13, -.62, 4.36, .25, .83, culture.accent, 0, 'oldWood');
    for (let i = 0; i < 3; i++) model.box(0, .07 + i * .075, -1.78 + i * .18, 2.62, .14, .36, '#a69c8d', 0, 'ashlar');
    for (const x of [-1.98, 1.98]) {
      model.box(x, .60, -.72, .13, .57, .12, culture.wood, 0, 'oldWood');
      model.box(x, .86, -.72, .31, .30, .055, tint);
    }
  } else if (id === 'mint') {
    house(model, -.55, .23, 2.62, 2.80, 1.27 + detail * .12, culture, age);
    model.box(1.22, .59, .47, 1.65, 1.18, 2.45, '#8b8071', 0, 'ashlar');
    model.box(1.22, 1.27, .47, 1.76, .24, 2.60, '#9e927f', 0, 'ashlar');
    model.box(1.22, .49, -.77, .68, .92, .13, '#514941', 0, 'oldWood');
    for (let i = 0; i < 4; i++) model.box(.97 + i * .16, .63, -.85, .047, .58, .045, '#8b8579');
    model.cone(-.55, 1.05, -1.20, .33, .075, '#c6a36d', 10, .33).rotation.x = Math.PI / 2;
  } else {
    const hall = id === 'hall';
    const industry = ['forge', 'factory', 'foundry', 'lab'].includes(id);
    const monument = ['temple', 'academy', 'granary'].includes(id);
    house(model, 0, 0, hall ? 3.8 : 2.85, hall ? 3.2 : 2.64, 1.06 + detail * .42, culture, age);
    if (monument || detail > 1 || hall) {
      for (const side of [-1, 1]) house(model, side * 1.88, .92, 1.21, 1.31, 1.02, culture, age);
    }
    if (industry) for (const side of [-1, 1]) tower(model, side * 1.55, 1.11, 1.83 + .28 * detail, culture, false);
    if (hall) {
      hallDetails(model, culture, tint, detail);
    }
  }
  // The outside fixtures use the same materials as the buildings of their era.
  const yard = ['farm', 'range', 'quarry', 'mine', 'lumber', 'barracks'].includes(id);
  const x = yard ? -2.64 : 1.87, front = yard ? -1.70 : -1.58;
  const sign = (height: number, tone: string, surface?: Surface) =>
    model.box(x, height, front, yard ? .29 : .47, .22, .14, tone, 0, surface);
  if (age === 1) {
    model.box(x, .31, front, .085, .62, .084, culture.wood, 0, 'oldWood');
    sign(.54, '#ad7953');
  } else if (age === 2) {
    model.box(x, .25, front, .30, .50, .25, '#979387', 0, 'stone');
    sign(.48, culture.accent, 'ashlar');
  } else if (age === 3) {
    model.box(x, .48, front, .08, .96, .085, culture.wood, 0, 'wood');
    sign(.90, '#bb9865');
    model.cone(x, 1.03, front, .18, .085, '#6e5e4b', 4, .05);
  } else if (age === 4) {
    model.box(x, .29, front, .38, .58, .25, '#736f61', 0, 'iron');
    sign(.53, '#ac8f5d', 'iron');
  } else if (age === 5) {
    model.box(x, .37, front, .28, .74, .24, '#798d91', 0, 'iron');
    sign(.67, '#4b7685');
  } else if (age === 6) {
    model.cone(x, .46, front, .33, .87, '#798d91', 6, .16, false, 'iron');
    model.cone(x, .96, front, .22, .28, tint, 6, .075, true);
  }
  if (detail > 1) for (let i = 0; i < detail - 1; i++) {
    model.box(-1.2 + i * .9, .24, -1.88, .51, .48, .48, culture.wood, i * .18);
    model.box(-1.2 + i * .9, .47, -1.88, .56, .10, .52, tint, i * .18);
  }
  return model.finish({ site: id }, shadows);
}

export function armyModel(materials: Materials, faction: string, tint: string, troops: Troop[], sea: boolean, march: number) {
  const culture = styles[faction] || styles.aurel;
  if (sea) {
    const model = new Model('Marschverband', materials);
    model.box(0, .23, 0, .90, .34, 1.38, culture.wood);
    const bow = model.cone(0, .25, -.77, .88, .84, culture.wood, 4);
    bow.rotation.x = -Math.PI / 2;
    model.cone(0, .76, 0, .05, 1.24, '#725539', 6, .04);
    model.box(.23, 1.02, 0, .49, .58, .07, tint);
    return model.finish({ march });
  }
  return marchingFormation(materials, faction, tint, troops, march);
}

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Scene } from '@babylonjs/core/scene';
import type { Tile, WorldGeometry } from './types';
import { clamp, color, Geometry, random } from './scene';
import { AURELHOLM, regionalHeight, riverX, VALLEY_SCALE } from './aurelholm';
import type { GroundGeometry } from './ground';

export const SCALE = 1 / 24;
const palette: Record<string, [string, string]> = {
  plain: ['#a5ac78', 'grass_ground'],
  forest: ['#9ba66e', 'forest_floor'],
  jungle: ['#78a16b', 'forest_ground_05'],
  taiga: ['#839879', 'forest_floor'],
  savanna: ['#c9b272', 'grass_ground'],
  steppe: ['#c9ae81', 'grass_ground'],
  marsh: ['#8d9e7c', 'forest_ground_05'],
  coast: ['#d2bc90', 'sand_01'],
  desert: ['#e6b978', 'sand_01'],
  mountain: ['#c8bda9', 'rocky_terrain'],
  highland: ['#aaa885', 'rocky_terrain'],
  tundra: ['#c2c7be', 'rocky_terrain'],
};

export const biomeTint = (biome: string) => color((palette[biome] || palette.plain)[0]);
const noise = (x: number, y: number) =>
  Math.sin(x * .058 + Math.sin(y * .034) * 2.3) * Math.cos(y * .043 - x * .027)
  + Math.sin(y * .081 + x * .067) * .24;

export class ReliefGeometry {
  private readonly masses;
  private readonly grid;
  private readonly materials = new Map<string, StandardMaterial>();

  constructor(readonly world: WorldGeometry, readonly scene: Scene) {
    this.masses = new Map(world.landmasses.map(mass => [mass.name, mass]));
    this.grid = new Map(world.map.map(tile => [`${tile.col}:${tile.row}`, tile]));
  }

  nearest(x: number, y: number) {
    const row = Math.round((y - 96) / (1.5 * this.world.radius));
    let best: Tile | undefined;
    let distance = this.world.radius ** 2 * 1.16;
    for (let r = row - 1; r <= row + 1; r++) {
      const c = Math.round((x - 72) / this.world.step - .5 * (r % 2));
      const tile = this.grid.get(`${c}:${r}`);
      if (!tile) continue;
      const squared = (tile.x - x) ** 2 + (tile.y - y) ** 2;
      if (squared < distance) { best = tile; distance = squared; }
    }
    return best;
  }

  height(tile: Tile, x = tile.x, y = tile.y) {
    const mass = this.masses.get(tile.continent)!;
    const { mountain, latitude, moisture } = this.world.geography(mass, x, y);
    const coast = this.world.coastField(mass, x, y);
    const cliff = clamp((coast + 24) / 88, .055);
    const fold = 1 - Math.abs(Math.sin(x * .036 - y * .026 + noise(x, y) * .89));
    const watercuts = Math.abs(Math.sin(x * .095 + y * .067 + noise(y, x) * 1.71));
    const upland = Math.pow(Math.max(0, mountain - .22), 1.45);
    const dunes = clamp((.43 - moisture) * 7) * clamp((.365 - latitude) * 9) * clamp(1 - upland * 4) *
      Math.pow(.5 + .5 * Math.sin(x * .108 + y * .054 + noise(x, y) * 1.75), 2.4) * .36;
    const relief = upland * (3.5 + 12.4 * Math.pow(fold, 1.19) + watercuts * 2.2);
    const height = .055 + cliff * (.34 + .30 * noise(x, y) + relief + dunes);
    const capital = this.world.lookup[AURELHOLM];
    if (!capital || tile.continent !== capital.continent || Math.abs(x - capital.x) > 440 || Math.abs(y - capital.y) > 485) return height;
    return regionalHeight((x - capital.x) / VALLEY_SCALE, (capital.y - y) / VALLEY_SCALE, height);
  }

  valleyRiver(known: ReadonlySet<string>) {
    const bed = new Geometry();
    const anchor = this.world.lookup[AURELHOLM];
    if (!anchor) return bed;
    let previous: number[] | undefined;
    const tints = [color('#49685a'), color('#2a5460'), color('#4a6b5b')];
    for (let i = -46; i <= 44; i++) {
      const z = i * .84;
      const x = anchor.x + riverX(z) * VALLEY_SCALE;
      const y = anchor.y - z * VALLEY_SCALE;
      const tile = this.nearest(x, y);
      if (!tile || !known.has(tile.id)) { previous = undefined; continue; }
      const width = VALLEY_SCALE * (.47 + .17 * Math.sin(Math.PI * (i + 46) / 90) + .08 * Math.sin(z * .56));
      const row = [-1, 0, 1].map((offset, j) => {
        const wet = this.nearest(x + offset * width, y);
        if (!wet || !known.has(wet.id)) offset = 0;
        const sampleX = x + offset * width;
        return bed.vertex(this.point(tile, sampleX, y, .086), tints[j]);
      });
      if (previous) for (let j = 0; j < 2; j++) {
        bed.indices.push(previous[j], row[j], previous[j + 1], previous[j + 1], row[j], row[j + 1]);
      }
      previous = row;
    }
    return bed;
  }

  point(tile: Tile, x = tile.x, y = tile.y, lift = 0) {
    return new Vector3(x * SCALE, this.height(tile, x, y) + lift, -y * SCALE);
  }

  boundary(tile: Tile) {
    const vertices = Array.from({ length: 18 }, (_, index) => {
      const side = Math.floor(index / 3);
      const ratio = (index % 3) / 3;
      const corner = (n: number) => {
        const radians = (n % 6) * Math.PI / 3 + Math.PI / 6;
        return [tile.x + this.world.radius * Math.cos(radians), tile.y + this.world.radius * Math.sin(radians)];
      };
      const a = corner(side), b = corner(side + 1);
      const x = a[0] + (b[0] - a[0]) * ratio;
      const y = a[1] + (b[1] - a[1]) * ratio;
      return [x + 5 * noise(x, y), y + 4 * noise(y, x)];
    });
    return vertices;
  }

  tile(geo: GroundGeometry, tile: Tile, fog: number, politicalColor?: string) {
    const firstFace = geo.indices.length / 3;
    const tint = politicalColor ? Color3.Lerp(Color3.White(), color(politicalColor), .31) : Color3.White();
    const mass = this.masses.get(tile.continent)!;
    const boundary = this.boundary(tile);
    const add = (x: number, y: number) => {
      const point = this.point(tile, x, y);
      const normal = new Vector3(
        (this.height(tile, x - 1, y) - this.height(tile, x + 1, y)) / (2 * SCALE), 1,
        (this.height(tile, x, y + 1) - this.height(tile, x, y - 1)) / (2 * SCALE),
      ).normalize();
      const climate = this.world.geography(mass, x, y);
      const coast = this.world.coastField(mass, x, y);
      const rain = climate.moisture + .029 * noise(x * .58, y * .58);
      const dryness = clamp((.55 - rain) * 6.7);
      const woodland = clamp((rain - .49) * 5.3) * clamp((normal.y - .38) * 2.0);
      const wet = clamp((rain - .61) * 5.8) * clamp((.76 - point.y) * 1.3);
      const gravel = clamp((.86 - normal.y) * 1.61 + (point.y - 1.08) * .28);
      const moss = clamp((rain - .43) * 2.4) * clamp(1 - (point.y - 1.3) * .21);
      const beach = clamp((34 - coast) / 30) * clamp(1.16 - point.y * 1.3);
      const cracked = clamp((.39 - rain) * 5.2) * dryness * (.72 + noise(y, x) * .16);
      const snow = clamp((point.y - 4.35 + climate.latitude * 3.5 + noise(y * .49, x * .49) * .58) * .77) *
        clamp((normal.y + .22) * 1.65);
      geo.soils.push(Math.max(.04, (1 - dryness) * (1 - woodland) * (1 - wet)), dryness, woodland, wet);
      geo.slopes.push(gravel, moss, beach, cracked);
      geo.weather.push(snow, fog);
      return geo.vertex(point, tint, normal);
    };
    const centre = add(tile.x, tile.y);
    let prior: number[] = [];
    const rings = ['mountain', 'highland', 'tundra'].includes(tile.biome) ? [.20, .39, .59, .80, 1] : [.26, .51, .75, 1];
    for (const fraction of rings) {
      const ring = boundary.map(([x, y]) => add(tile.x + (x - tile.x) * fraction, tile.y + (y - tile.y) * fraction));
      for (let i = 0; i < ring.length; i++) {
        const next = (i + 1) % ring.length;
        if (prior.length) geo.indices.push(prior[i], ring[next], ring[i], prior[i], prior[next], ring[next]);
        else geo.indices.push(centre, ring[next], ring[i]);
      }
      prior = ring;
    }
    for (let face = firstFace; face < geo.indices.length / 3; face++) geo.faces.push(tile.id);
  }

  material(biome: string) {
    const [, asset] = palette[biome] || palette.plain;
    const cached = this.materials.get(asset);
    if (cached) return cached;
    const material = new StandardMaterial(asset, this.scene);
    material.diffuseColor = color('#e7e8d7');
    material.specularColor = Color3.Black();
    material.backFaceCulling = false;
    material.diffuseTexture = new Texture(`assets/3d/${asset}.jpg`, this.scene, false, true,
      Texture.TRILINEAR_SAMPLINGMODE, undefined, () => { material.diffuseTexture = null; });
    material.diffuseTexture.anisotropicFilteringLevel = 8;
    if (asset === 'rocky_terrain') {
      material.bumpTexture = new Texture('assets/3d/rocky_terrain-normal.jpg', this.scene);
      material.bumpTexture.level = .32;
    }
    this.materials.set(asset, material);
    return material;
  }

  shore(cliff: Geometry, waves: CoastalStrip, tile: Tile, fog: number) {
    const edge = this.boundary(tile);
    for (let side = 0; side < 6; side++) {
      const angle = (side + 1) * Math.PI / 3;
      if (this.nearest(tile.x + Math.cos(angle) * this.world.step, tile.y + Math.sin(angle) * this.world.step)) continue;
      let previous: [number, number, number, number] | undefined;
      for (let segment = 0; segment <= 3; segment++) {
        const [x, y] = edge[(side * 3 + segment) % 18];
        const direction = new Vector3(x - tile.x, 0, tile.y - y).normalize();
        const top = this.point(tile, x, y);
        const steep = clamp((top.y - .19) * 2.8);
        const skirt = top.add(direction.scale(.025 + (1 - steep) * .18));
        skirt.y = .006;
        const materialColor = Color3.Lerp(color('#e2c89a'), color('#7c7b75'), steep).scale(fog);
        const normal = direction.add(new Vector3(0, .29 + (1 - steep) * .65, 0)).normalize();
        const a = cliff.vertex(top, materialColor.scale(.84), normal);
        const b = cliff.vertex(skirt, materialColor, normal);
        const inner = skirt.clone();
        inner.y = .016;
        const outer = inner.add(direction.scale(.41 + (1 - steep) * .51));
        const c = waves.vertex(inner, 0, fog);
        const d = waves.vertex(outer, 1, fog);
        if (previous) {
          const [p, q, r, s] = previous;
          cliff.indices.push(p, a, b, p, b, q);
          waves.indices.push(r, c, d, r, d, s);
        }
        previous = [a, b, c, d];
      }
    }
  }
}

export class CoastalStrip {
  readonly positions: number[] = [];
  readonly uvs: number[] = [];
  readonly indices: number[] = [];

  vertex(point: Vector3, offshore: number, visibility: number) {
    const index = this.positions.length / 3;
    this.positions.push(point.x, point.y, point.z);
    this.uvs.push(offshore, visibility);
    return index;
  }

  mesh(scene: Scene, material: ShaderMaterial) {
    const mesh = new Mesh('Brandung und Flachwasser', scene);
    const data = new VertexData();
    data.positions = this.positions;
    data.uvs = this.uvs;
    data.indices = this.indices;
    data.applyToMesh(mesh);
    mesh.material = material;
    mesh.isPickable = false;
    return mesh;
  }
}

export function surfMaterial(scene: Scene) {
  const material = new ShaderMaterial('Küstenbrandung', scene, {
    vertexSource: `precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform mat4 worldViewProjection;
      varying vec2 worldPoint;
      varying vec2 shore;
      void main() {
        worldPoint = position.xz;
        shore = uv;
        gl_Position = worldViewProjection * vec4(position, 1.);
      }`,
    fragmentSource: `precision highp float;
      varying vec2 worldPoint;
      varying vec2 shore;
      uniform float time;
      void main() {
        float along = dot(worldPoint, vec2(3.1, 4.7));
        float ripple = sin(along + time*1.2 + sin(along*.28)*1.48);
        float breakUp = smoothstep(-.5, .59, ripple + sin(along*2.3)*.31);
        float foamLine = abs(shore.x - (.10 + .065 * ripple));
        float foam = (1. - smoothstep(.025, .115, foamLine)) * (.29 + .52 * breakUp);
        float bed = clamp(1. - shore.x, 0., 1.);
        vec3 shallow = mix(vec3(.035,.18,.21), vec3(.16,.47,.43), bed);
        vec3 white = mix(shallow, vec3(.86,.94,.88), foam);
        gl_FragColor = vec4(white * (.45 + .55 * shore.y), pow(bed, 1.35) * shore.y * (.62 + .35 * foam));
      }`,
  }, { attributes: ['position', 'uv'], uniforms: ['worldViewProjection', 'time'], needAlphaBlending: true });
  material.backFaceCulling = false;
  return material;
}

export function ocean(scene: Scene, world: WorldGeometry) {
  const water = CreateGround('Elyndras Meere', { width: 1700, height: 1700 }, scene);
  water.position.set(world.bounds.width * SCALE / 2, 0, -world.bounds.height * SCALE / 2);
  water.isPickable = false;
  const material = new ShaderMaterial('Meer', scene, {
    vertexSource: `
      precision highp float;
      attribute vec3 position;
      uniform mat4 worldViewProjection;
      varying vec2 waterPosition;
      void main() {
        waterPosition = position.xz;
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }`,
    fragmentSource: `
      precision highp float;
      varying vec2 waterPosition;
      uniform float time;
      void main() {
        vec2 p = waterPosition;
        float swell = sin(p.x*.28 + p.y*.47 + time*.31) * cos(p.y*.62 - time*.55);
        float wave = sin(p.y*3.7 + p.x*2.9 + swell*1.7 - time*.91);
        float chop = cos(p.x*1.8 - p.y*.79 + .64*sin(p.y*.9) + time*.48);
        float light = pow(max(0., wave), 8.) * pow(max(0., chop), 3.) * (.4+.6*swell*swell);
        vec3 blue = mix(vec3(.027,.073,.112),vec3(.055,.161,.218), .52+.28*swell);
        gl_FragColor = vec4(blue + light*.026, 1.);
      }`,
  }, { attributes: ['position'], uniforms: ['worldViewProjection', 'time'] });
  water.material = material;
  return (now: number) => material.setFloat('time', now / 1000);
}

export function vegetation(geo: Geometry, relief: ReliefGeometry, tile: Tile, fog: number, reserved: boolean) {
  const forest = ['forest', 'taiga', 'jungle'].includes(tile.biome);
  const amount = forest ? 46 : ['plain', 'marsh', 'highland', 'savanna'].includes(tile.biome) ? 10 : 0;
  for (let i = 0; i < amount; i++) {
    const seed = tile.seed * 43 + i * 26;
    const theta = random(seed) * Math.PI * 2;
    const radius = (reserved ? .49 + random(seed + 2) * .33 : Math.sqrt(random(seed + 2)) * .84) * relief.world.radius;
    const base = relief.point(tile, tile.x + Math.cos(theta) * radius, tile.y + Math.sin(theta) * radius);
    const height = .17 + random(seed + 3) * (forest ? .55 : .32);
    const tint = color(tile.biome === 'taiga' ? '#465f51' : tile.biome === 'savanna' ? '#81824b' : tile.biome === 'jungle' ? '#386744' : '#547243')
      .scale(fog * (.71 + random(seed + 6) * .44));
    if (tile.biome === 'jungle' || tile.biome === 'forest' || tile.biome === 'savanna') {
      const broad = tile.biome === 'savanna' ? .43 : .37;
      for (let crown = 0; crown < 3; crown++) {
        const angle = theta + crown * Math.PI * 2 / 3;
        const centre = base.add(new Vector3(Math.cos(angle) * height * .21, height * (.63 + crown * .075), Math.sin(angle) * height * .21));
        const peak = geo.vertex(centre.add(new Vector3(0, height * .21, 0)), tint.scale(1.14));
        const low = geo.vertex(centre.add(new Vector3(0, -height * .20, 0)), tint.scale(.71));
        const rim = Array.from({ length: 6 }, (_, branch) => {
          const a = angle + branch * Math.PI / 3;
          return geo.vertex(centre.add(new Vector3(Math.cos(a) * broad * height, 0, Math.sin(a) * broad * height)), tint,
            new Vector3(Math.cos(a), .15, Math.sin(a)).normalize());
        });
        rim.forEach((point, j) => geo.indices.push(peak, point, rim[(j + 1) % rim.length], low, rim[(j + 1) % rim.length], point));
      }
      continue;
    }
    for (const layer of [0, .34]) {
      const tip = geo.vertex(base.add(new Vector3(0, height * (.72 + layer), 0)), tint);
      const ring = Array.from({ length: 5 }, (_, branch) => {
        const angle = branch * Math.PI * .4;
        const span = height * (.29 - layer * .24);
        return geo.vertex(base.add(new Vector3(Math.cos(angle) * span, height * (.19 + layer), Math.sin(angle) * span)),
          tint.scale(.73 + branch * .05), new Vector3(Math.cos(angle), .8, Math.sin(angle)).normalize());
      });
      ring.forEach((corner, j) => geo.indices.push(tip, corner, ring[(j + 1) % ring.length]));
    }
  }
}

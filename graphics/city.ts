import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { CityState } from './types';
import { biomeTint } from './terrain';
import { color, Geometry, Materials, random, setup } from './scene';
import { buildingModel, Model } from './models';
import { Props, type Placement } from './props';
import { cityWall } from './city-wall';
import { AURELHOLM, nearValleyLot, riverLevel, riverX, valleyHeight, valleyLot } from './aurelholm';

// The gate faces south. The main street leads to the square and the hall.
const districtLots: Record<string, [number, number, number]> = {
  hall: [0, 5, -.08], market: [5.5, 1, .15], temple: [-5.5, 6, -.12], academy: [6.4, 8, .08],
  mint: [0, 12, .13], spy: [-6.8, 13, -.16], signature: [7.2, 15, .1],
  barracks: [-6.4, -4, .16], range: [-13, -5, -.12], stable: [6.7, -8, -.12], watch: [-6.3, -11, .08],
  farm: [13.3, -6.5, -.14], granary: [12, .4, .12], lumber: [-12.8, 1.5, .19], forge: [-12.8, 8, -.18],
  quarry: [-19.7, .3, -.12], mine: [-18.4, 7.3, .13], foundry: [-18, 14, -.15], factory: [-12, 15, .16],
  lab: [12.6, 9, -.24], observatory: [-5.5, 20.4, -.11], gate: [1, 21, .09],
};
const districtLot = (key: string) => districtLots[key.startsWith('sig-site') ? 'signature' : key] ?? districtLots.hall;
const hiveCapital = 'g:46:16';
const nearDistrictLot = (x: number, z: number, distance: number) =>
  Object.values(districtLots).some(([px, pz]) => Math.hypot(x - px, z - pz) < distance);

const waterway = (z: number) => 25.7 + 2.4 * Math.sin(z * .158) + .94 * Math.sin(z * .29 + .7);

function hillside(x: number, z: number) {
  const edge = Math.max(0, Math.hypot(x * .74, z) - 12.5);
  const hill = Math.min(6.8, edge * .24) * (.55 + Math.sin(x * .16 + z * .095) * .32 + Math.cos(z * .24 - x * .12) * .22);
  const bank = Math.max(0, 1 - Math.abs(x - waterway(z)) / 4.5);
  return hill * (1 - bank) - bank * bank * .93;
}

function hiveRelief(x: number, z: number) {
  const rise = (cx: number, cz: number, rx: number, rz: number) =>
    Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2));
  const escarpment = 7.1 * rise(-22, 13, 9, 20) + 5.0 * rise(-11, 27, 14, 10);
  const strata = .81 + .14 * Math.sin(x * .72 + z * .26) + .08 * Math.cos(x - z * .47);
  const bank = Math.min(1, Math.abs(x - waterway(z)) / 5.5);
  return hillside(x, z) + bank * (1.84 * rise(-.5, 4.7, 11.5, 11.0) + escarpment * strata);
}

const hivePlots = Object.values(districtLots).map(([x, z]) => [x, z, hiveRelief(x, z)]);
function hiveHeight(x: number, z: number) {
  let height = hiveRelief(x, z);
  for (const [px, pz, plotHeight] of hivePlots) {
    const distance = (x - px) ** 2 + (z - pz) ** 2;
    if (distance >= 16) continue;
    const edge = Math.max(0, Math.min(1, (4 - Math.sqrt(distance)) / 1.3));
    height += (plotHeight - height) * edge * edge * (3 - 2 * edge);
  }
  return height;
}

function brookMesh(scene: Scene) {
  const water = new Mesh('Bachlauf', scene);
  const surface = new ShaderMaterial('Bachoberfläche', scene, {
    vertexSource: `precision highp float;
    attribute vec3 position;
    uniform mat4 worldViewProjection;
    varying vec2 samplePoint;
    void main() {
      samplePoint = position.xz;
      gl_Position = worldViewProjection * vec4(position, 1.);
    }`,
    fragmentSource: `precision highp float;
    varying vec2 samplePoint;
    uniform float clock;
    void main() {
      float u = samplePoint.x, v = samplePoint.y;
      float ripples = sin(u * 3.8 + v * 2.6 - clock * 1.25 + sin(v * .88) * 2.2) * cos(u * 1.98 - v * .9 + clock * .43);
      float current = sin(u * .96 - v * .62 + clock * .53) * cos(v * .82 + clock * .61);
      vec3 tone = mix(vec3(.036,.115,.124), vec3(.17,.36,.31), .57 + .18 * current);
      tone += pow(max(0.,ripples), 6.) * vec3(.057,.083,.078);
      gl_FragColor = vec4(tone, 1.);
    }`,
  }, { attributes: ['position'], uniforms: ['worldViewProjection', 'clock'] });
  surface.backFaceCulling = false;
  water.material = surface;
  water.isPickable = false;
  function follow(channel: (z: number) => number, waterHeight: (z: number) => number) {
    const data = new VertexData();
    const points: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 255; i++) {
      const z = -102 + i * .8, x = channel(z), y = waterHeight(z);
      const width = 2.58 + .34 * Math.sin(z * .23);
      points.push(x - width, y, z, x + width, y, z);
      if (i) indices.push(i * 2 - 2, i * 2, i * 2 - 1, i * 2 - 1, i * 2, i * 2 + 1);
    }
    data.positions = points;
    data.indices = indices;
    data.applyToMesh(water);
  }
  return { water, surface, follow };
}

export class CityView {
  private readonly renderer;
  private readonly materials;
  private readonly groundMaterial;
  private readonly ground;
  private readonly grassMaterial;
  private readonly pathMaterial;
  private readonly brook;
  private readonly trees;
  private readonly firs;
  private readonly rocks;
  private imported?: { watch?: Props; timber?: Props; workshop?: TransformNode };
  private importKey = '';
  private wall?: ReturnType<typeof cityWall>;
  private readonly buildings = new Map<string, {
    model: TransformNode; label: HTMLButtonElement; key: string; labelHeight: number; imported?: Props;
  }>();
  private state?: CityState;
  private landscape?: TransformNode;
  private lanes?: TransformNode;
  private roads?: Mesh;
  private texture?: Texture;
  private readonly events = new AbortController();
  private readonly buildingHud = document.getElementById('buildingHud')!;
  private down?: { x: number; y: number };
  private lastLabels = 0;

  constructor(private canvas: HTMLCanvasElement, private labels: HTMLElement, private onPick: (id: string) => void) {
    this.renderer = setup(canvas, true);
    this.materials = new Materials(this.renderer.scene);
    this.groundMaterial = new StandardMaterial('Siedlungsgrund', this.renderer.scene);
    this.grassMaterial = new StandardMaterial('Gräser', this.renderer.scene);
    this.grassMaterial.diffuseColor = color('#c3bc9a');
    this.grassMaterial.specularColor.set(0, 0, 0);
    this.grassMaterial.backFaceCulling = false;
    this.pathMaterial = new StandardMaterial('Verdichteter Wegeboden', this.renderer.scene);
    this.pathMaterial.diffuseTexture = new Texture('assets/3d/brown_mud_dry.jpg', this.renderer.scene);
    this.pathMaterial.diffuseTexture.anisotropicFilteringLevel = 8;
    this.pathMaterial.backFaceCulling = false;
    this.pathMaterial.specularColor.set(0, 0, 0);
    this.pathMaterial.emissiveColor.set(.26, .205, .14);
    this.pathMaterial.zOffset = -1;
    this.brook = brookMesh(this.renderer.scene);
    this.brook.water.setEnabled(false);
    this.trees = new Props('pine-sapling', this.renderer.scene, this.renderer.shadows);
    this.firs = new Props('fir-sapling', this.renderer.scene, this.renderer.shadows);
    this.rocks = new Props('namaqualand-boulder', this.renderer.scene, this.renderer.shadows);
    this.groundMaterial.specularColor.set(0, 0, 0);
    this.ground = CreateGround('Siedlungsland', { width: 204, height: 204, subdivisions: 204, updatable: true }, this.renderer.scene);
    this.ground.material = this.groundMaterial;
    this.ground.isPickable = false;
    this.ground.receiveShadows = true;
    const options = { signal: this.events.signal };
    canvas.addEventListener('pointerdown', event => { this.down = { x: event.clientX, y: event.clientY }; }, options);
    canvas.addEventListener('pointerup', event => {
      if (event.button !== 0 || !this.down || Math.hypot(event.clientX - this.down.x, event.clientY - this.down.y) > 6) return;
      const box = canvas.getBoundingClientRect();
      const site = this.renderer.scene.pick(event.clientX - box.left, event.clientY - box.top)?.pickedMesh?.metadata?.site;
      if (site) this.onPick(site);
    }, options);
    this.renderer.engine.runRenderLoop(() => this.frame());
  }

  private get inValley() { return this.state?.id === AURELHOLM; }
  private get inHive() { return this.state?.id === hiveCapital; }
  private elevation(x: number, z: number) {
    return this.inValley ? valleyHeight(x, z, true) : this.inHive ? hiveHeight(x, z) : hillside(x, z);
  }
  private channel(z: number) { return this.inValley ? riverX(z) : waterway(z); }
  private lot(site: string) {
    const layout = this.inValley ? valleyLot(site) : undefined;
    if (layout) return new Vector3(layout.x, layout.y, layout.z);
    const [x, z] = districtLot(site);
    return new Vector3(x, this.elevation(x, z), z);
  }
  private angle(site: string) { return (this.inValley ? valleyLot(site)?.angle : undefined) ?? districtLot(site)[2]; }

  private sculpt() {
    const ground = this.ground;
    const points = ground.getVerticesData(VertexBuffer.PositionKind)!;
    const normals = ground.getVerticesData(VertexBuffer.NormalKind)!;
    const groundTint: number[] = [];
    for (let i = 0; i < points.length; i += 3) {
      const x = points[i], z = points[i + 2];
      points[i + 1] = this.elevation(x, z);
      const shore = this.inValley ? Math.max(0, 1 - Math.abs(x - this.channel(z)) / 4.0) : 0;
      const shade = .79 + Math.sin(x * .24 + z * .18) * .083 + Math.cos(x * .32 - z * .2) * .10;
      const sandstone = this.inHive ? .14 * Math.min(1, Math.max(0, points[i + 1]) / 3.5) : 0;
      groundTint.push(shade + .08 + shore * .10 + sandstone, shade + .09 - shore * .06, shade - shore * .08 - sandstone, 1);
    }
    VertexData.ComputeNormals(points, ground.getIndices()!, normals);
    ground.updateVerticesData(VertexBuffer.PositionKind, points, true);
    ground.updateVerticesData(VertexBuffer.NormalKind, normals);
    ground.setVerticesData(VertexBuffer.ColorKind, groundTint);
    ground.updateCoordinateHeights();
    this.brook.follow(z => this.channel(z), this.inValley ? riverLevel : () => -.218);
  }

  reset() {
    if (this.inValley && this.buildings.size <= 6 && !this.wall) {
      const camera = this.renderer.camera;
      camera.setTarget(new Vector3(2, 1.35, .5), false, false, true);
      camera.alpha = -1.43;
      camera.beta = .96;
      camera.radius = 32;
      return;
    }
    const positions = [...this.buildings.values()].map(({ model }) => model.position);
    const x = positions.map(point => point.x), z = positions.map(point => point.z);
    const left = this.wall?.bounds.west ?? Math.min(0, ...x), right = this.wall?.bounds.east ?? Math.max(0, ...x);
    const near = this.wall?.bounds.south ?? Math.min(0, ...z), far = this.wall?.bounds.north ?? Math.max(0, ...z);
    this.renderer.camera.setTarget(new Vector3((left + right) / 2, .68, (near + far) / 2), false, false, true);
    this.renderer.camera.alpha = -1.21;
    this.renderer.camera.beta = this.wall ? .91 : 1.01;
    const width = this.canvas.clientWidth || this.canvas.parentElement?.parentElement?.clientWidth || 650;
    const aspect = width / Math.max(235, this.canvas.clientHeight || Math.min(420, innerHeight * .42));
    this.renderer.camera.radius = (this.wall ? 15.5 : 12.5)
      + Math.max((right - left) * Math.max(.64, 1.13 / Math.max(aspect, 1)), (far - near) * 1.1);
  }

  zoom(factor: number) {
    const camera = this.renderer.camera;
    camera.radius = Math.max(camera.lowerRadiusLimit!, Math.min(camera.upperRadiusLimit!, camera.radius / factor));
  }

  private backdrop(biome: string) {
    const earth = biomeTint(biome);
    this.groundMaterial.diffuseColor = earth.scale(.91);
    this.texture?.dispose();
    const forest = ['forest', 'taiga', 'jungle', 'marsh'].includes(biome);
    const dry = ['coast', 'desert'].includes(biome);
    this.brook.water.setEnabled(biome !== 'desert');
    const mountain = ['highland', 'mountain', 'tundra'].includes(biome);
    const asset = biome === 'tundra' ? 'snow_floor' : biome === 'marsh' ? 'aerial_mud_1'
      : dry ? 'sand_01' : mountain ? 'mossy_rock' : forest ? 'forest_floor'
      : biome === 'steppe' || biome === 'savanna' ? 'withered_grass' : 'grass_ground';
    this.texture = new Texture(`assets/3d/${asset}.jpg`, this.renderer.scene, false, true,
      Texture.TRILINEAR_SAMPLINGMODE, undefined, () => { this.groundMaterial.diffuseTexture = null; });
    this.texture.uScale = this.texture.vScale = 23;
    this.texture.anisotropicFilteringLevel = 8;
    this.groundMaterial.diffuseTexture = this.texture;
    this.landscape?.dispose();
    const landscape = new Geometry();
    const trees: Placement[] = [];
    const rocks: Placement[] = [];
    for (let i = 0; i < 88; i++) {
      const x = (random(i * 5) - .5) * 51, z = (random(i * 5 + 1) - .5) * 42;
      const reserved = this.inValley ? nearValleyLot(x, z, 4.7) : nearDistrictLot(x, z, 3.7);
      if (reserved || z < -7 && Math.abs(x) < 7.5 || Math.abs(x - this.channel(z)) < 2.8) continue;
      const size = .52 + random(i * 5 + 2) * 1.37;
      const y = this.elevation(x, z);
      const isRock = dry ? i % 6 !== 0 : mountain ? i % 2 === 0 : i % 5 === 0;
      (isRock ? rocks : trees).push({
        id: `${biome}/${i}`, position: new Vector3(x, y - .018, z), angle: i * 1.6,
        size: size * (isRock ? 1.43 : forest ? 1.38 : .96),
      });
    }
    for (let i = 0; i < 27; i++) {
      const z = -23 + i * 1.73;
      const x = this.channel(z) + (i % 3 === 0 ? -1 : 1) * (2.35 + random(370 + i) * 2.38);
      if (this.inValley ? nearValleyLot(x, z, 4.5) : nearDistrictLot(x, z, 3.9)) continue;
      rocks.push({
        id: `${biome}/Bachufer/${i}`, position: new Vector3(x, this.elevation(x, z) - .064, z),
        angle: i * 2.14, size: .82 + random(671 + i) * (mountain ? 3.85 : 2.71),
      });
    }
    for (let i = 0; i < (mountain ? 19 : 10); i++) {
      const x = (this.inValley ? -26 : -16.4) - random(i + 34) * 9.5;
      const z = 1.9 + random(i + 126) * 20.1;
      if (!this.inValley && nearDistrictLot(x, z, 5.75)) continue;
      rocks.push({
        id: `${biome}/Hang/${i}`, position: new Vector3(x, this.elevation(x, z) - .31, z),
        angle: random(i + 19) * Math.PI * 2, size: 2.6 + random(i + 493) * 5.1,
      });
    }
    const grassTone = color(dry ? '#9e8b58' : forest ? '#717e48' : '#938955');
    for (let i = 0; i < (dry ? 140 : 395); i++) {
      const seed = i * 11;
      const x = (random(seed) - .5) * 44, z = (random(seed + 1) - .5) * 36;
      const reserved = this.inValley ? nearValleyLot(x, z) : nearDistrictLot(x, z, 2.75);
      if (reserved || Math.abs(x - this.channel(z)) < 2.9) continue;
      const shade = .7 + random(seed + 2) * .48;
      for (let leaf = 0; leaf < 4; leaf++) {
        const angle = seed + leaf * 1.91;
        const base = new Vector3(x + Math.sin(angle) * .13, this.elevation(x, z) - .02, z + Math.cos(angle) * .13);
        const tone = grassTone.scale(shade);
        const a = landscape.vertex(base, tone.scale(.71));
        const b = landscape.vertex(base.add(new Vector3(.046 * Math.cos(angle), 0, -.046 * Math.sin(angle))), tone.scale(.81));
        const tip = landscape.vertex(base.add(new Vector3(.235 * Math.sin(angle), .17 + random(seed + leaf + 6) * .26, .24 * Math.cos(angle))), tone);
        landscape.indices.push(a, b, tip);
      }
    }
    if (this.inValley) {
      const crowns = ['#3f5736', '#465d38', '#546542', '#374e37'].map(color);
      for (let i = 0; i < 82; i++) {
        const seed = 1023 + i * 17;
        const x = i % 3 === 0 ? 22 + random(seed) * 13 : -34 + random(seed) * 18;
        const z = -11 + random(seed + 1) * 39;
        if (nearValleyLot(x, z, 4.25) || Math.abs(x - this.channel(z)) < 3.2) continue;
        const y = this.elevation(x, z);
        const size = 1.36 + random(seed + 2) * 2.65;
        const pigment = crowns[i % crowns.length];
        for (let tier = 0; tier < 5; tier++) {
          const angle = i * 2.5 + tier * .57, base = size * (.23 + tier * .14);
          const spread = size * (.23 - tier * .035);
          const top = landscape.vertex(new Vector3(x, y + base + size * .22, z), pigment.scale(1.06));
          const bottom = landscape.vertex(new Vector3(x, y + base - size * .07, z), pigment.scale(.49));
          const rim = Array.from({ length: 8 }, (_, twig) => {
            const turn = angle + twig * Math.PI / 4;
            const length = spread * (.68 + random(seed + tier * 8 + twig) * .60);
            const dx = Math.cos(turn), dz = Math.sin(turn);
            return landscape.vertex(new Vector3(x + dx * length, y + base + random(seed + twig) * size * .065, z + dz * length),
              pigment.scale(.63 + random(seed + twig + tier) * .40), new Vector3(dx, .66, dz).normalize());
          });
          rim.forEach((point, j) => landscape.indices.push(top, point, rim[(j + 1) % rim.length], bottom, rim[(j + 1) % rim.length], point));
        }
      }
    }
    const grass = landscape.mesh('Gräser und bodennahe Vegetation', this.renderer.scene, this.grassMaterial);
    grass.isPickable = false;
    this.landscape = grass;
    this.trees.sync(trees);
    this.rocks.sync(rocks);
  }

  private buildPaths(state: CityState) {
    this.lanes?.dispose();
    this.roads?.dispose();
    const road = new Geometry();
    const model = new Model('Wege und Plätze', this.materials);
    const insect = state.faction === 'insect';
    const hall = this.lot('hall');
    const plaza = hall.add(new Vector3(0, 0, this.inValley ? -3.85 : -4.45));
    const ribbon = (a: Vector3, control: Vector3, b: Vector3, width: number) => {
      const segments = Math.max(16, Math.ceil(Vector3.Distance(a, b) * 4.4));
      const tone = color(insect ? '#ddbb76' : state.age >= 3 ? '#e5d3b2' : '#dcc39f');
      let prior: number | undefined;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const start = Vector3.Lerp(a, control, t), end = Vector3.Lerp(control, b, t);
        const p = Vector3.Lerp(start, end, t);
        const direction = end.subtract(start).normalize();
        const span = width * (.49 + .038 * Math.sin(t * 13.7) + .024 * Math.sin(t * 28.8));
        const left = road.positions.length / 3;
        for (const side of [-1, -.5, 0, .5, 1]) {
          const x = p.x + direction.z * span * side, z = p.z - direction.x * span * side;
          const height = this.ground.getHeightAtCoordinates(x, z);
          road.vertex(new Vector3(x, height + .054, z), tone.scale(.97 - Math.abs(side) * .16));
        }
        if (prior !== undefined) for (let k = 0; k < 4; k++) {
          road.indices.push(prior + k, left + k, left + k + 1, prior + k, left + k + 1, prior + k + 1);
        }
        prior = left;
      }
    };
    const sideStreets = new Set<number>();
    for (const [index, site] of state.sites.entries()) {
      const lot = this.lot(site.id);
      if (site.id === 'hall' || site.id === 'wall') continue;
      const angle = this.angle(site.id);
      const front = ['farm', 'barracks', 'range'].includes(site.id) ? 2.53 : 2.12;
      const entrance = lot.add(new Vector3(-Math.sin(angle) * front, 0, -Math.cos(angle) * front));
      const sideStreet = lot.z > hall.z ? new Vector3(hall.x + (lot.x < hall.x ? -3.7 : 3.7), 0, hall.z + .3) : undefined;
      const origin = sideStreet ?? plaza;
      if (sideStreet && !sideStreets.has(sideStreet.x)) {
        ribbon(plaza, new Vector3(sideStreet.x, 0, plaza.z), sideStreet, .86);
        sideStreets.add(sideStreet.x);
      }
      const control = new Vector3((origin.x + entrance.x) * .5, 0, Math.min(origin.z, entrance.z) - .9);
      ribbon(origin, control, entrance, .79 + random(index * 23) * .26);
      for (const side of [-1, 1]) {
        const corner = lot.add(new Vector3(side * 2.66, 0, -1.72));
        const y = this.elevation(corner.x, corner.z);
        if (insect) {
          model.cone(corner.x, y + .20, corner.z, .20, .40, '#72774c', 6, .09, false, 'chitin');
          model.cone(corner.x, y + .42, corner.z, .26, .16, '#d1af5f', 7, .04, state.age >= 3);
        } else model.cone(corner.x, y + .10, corner.z, .36, .19, '#9b9178', 5, .17, false, 'stone');
      }
    }
    const square = (x: number, z: number) => road.vertex(new Vector3(x, this.ground.getHeightAtCoordinates(x, z) + .059, z),
      color('#e1cba5'));
    const center = square(plaza.x, plaza.z);
    const rim = Array.from({ length: 24 }, (_, i) => {
      const angle = i * Math.PI / 12;
      return square(plaza.x + Math.cos(angle) * 2.38, plaza.z + Math.sin(angle) * 1.65);
    });
    rim.forEach((vertex, i) => road.indices.push(center, rim[(i + 1) % rim.length], vertex));
    if (insect) {
      const x = plaza.x + 1.35, z = plaza.z + .13, y = this.ground.getHeightAtCoordinates(x, z);
      model.cone(x, y + .14, z, .97, .27, '#a49d66', 10, .86, false, 'chitin');
      model.cone(x, y + .52, z, .50, .53, '#bd994e', 6, .23, state.age >= 3);
      for (const offset of [-.36, .36]) {
        const spire = model.cone(x + offset, y + .44, z, .24, .65, '#73794c', 6, .03, false, 'chitin');
        spire.rotation.z = -offset;
      }
      for (let i = 0; i < 12; i++) {
        const x = plaza.x - 1.42 - random(i * 31 + 5) * 1.88;
        const z = plaza.z + 1.18 + random(i * 31 + 8) * 1.45;
        const y = this.ground.getHeightAtCoordinates(x, z);
        const h = .11 + random(i * 31 + 2) * .22;
        model.cone(x, y + h / 2, z, .064, h, '#957d59', 5, .045);
        model.cone(x, y + h, z, h * 1.30, h * .30, i % 3 ? '#b59b63' : '#85708a', 8, h * .25);
      }
    } else if (state.age >= 1) {
      const x = plaza.x + 1.28, z = plaza.z - .16, y = this.ground.getHeightAtCoordinates(x, z);
      model.cone(x, y + .14, z, .88, .34, '#8d8170', 9, .77, false, 'stone');
      model.cone(x, y + .305, z, .64, .036, '#323734', 9, .63);
      for (const side of [-1, 1]) model.box(x + side * .30, y + .58, z, .08, .77, .08, '#715741', 0, 'oldWood');
      model.box(x, y + .94, z, .74, .095, .10, '#715741', 0, 'oldWood');
    }
    const plots = state.sites.filter(site => site.id !== 'wall').map(site => this.lot(site.id));
    const gateX = hall.x - (this.inValley ? 3.75 : 0);
    const wall = state.sites.find(site => site.id === 'wall');
    this.wall?.model.dispose();
    this.wall = wall ? cityWall(this.materials, this.renderer.shadows, [hall, ...plots], gateX, state.age, wall.level,
      (x, z) => this.ground.getHeightAtCoordinates(x, z), state.biome === 'desert' ? undefined : z => this.channel(z) - 3.18,
      insect) : undefined;
    const gatePoint = new Vector3(gateX, 0, this.wall?.position.z ?? -15);
    ribbon(plaza, new Vector3(gateX, 0, plaza.z - .30), gatePoint, 1.48);
    ribbon(gatePoint, gatePoint.add(new Vector3(0, 0, -2)), gatePoint.add(new Vector3(0, 0, -5.6)), 1.48);
    if (road.indices.length) {
      this.roads = road.mesh('Geländewege', this.renderer.scene, this.pathMaterial);
      this.roads.isPickable = false;
    }
    this.lanes = model.finish(null, null, false);
    const dry = ['coast', 'desert'].includes(state.biome);
    const valleyTrees = Array.from({ length: 36 }, (_, i) => i % 3 === 0
      ? [21 + random(i * 9) * 9.6, -13 + random(i * 7 + 1) * 38]
      : [-34 + random(i * 9) * 11, -9 + random(i * 7 + 1) * 37]);
    const grove = (dry ? [] : this.inValley ? valleyTrees : [[-9.9, 3.1], [-10.7, 4.7], [-7.5, 5.8], [-4.1, 6.3], [-3.25, 7.7], [8.3, 2.9], [9.5, 4.2], [12.6, 2.3], [12.0, -5.7]])
      .flatMap(([x, z], i) => {
        if (plots.some(lot => Math.hypot(lot.x - x, lot.z - z) < 2.9)) return [];
        return [{ id: `${state.id}/${i}`, position: new Vector3(x, this.elevation(x, z) - .035, z),
          angle: i * 2.51, size: .99 + random(i + 67) * 1.06 }];
      });
    this.firs.sync(grove);
  }

  private decorateBuildings(state: CityState) {
    const stock = new Map(state.sites.map(({ id, level }) => [id, level]));
    const key = `${state.id}/${state.age}/${stock.get('barracks') || 0}/${stock.get('lumber') || 0}/${stock.get('watch') || 0}/${stock.get('forge') || 0}`;
    if (key === this.importKey) return;
    this.importKey = key;
    const assets = this.imported ??= {};
    const make = (name: 'castle-watch' | 'cut-timber') => new Props(name, this.renderer.scene, this.renderer.shadows);
    const at = (site: string, index: number, x: number, z: number, size: number, angle: number): Placement => ({
      id: `${key}/${site}/${index}`, site,
      position: new Vector3(x, this.ground.getHeightAtCoordinates(x, z) - .04, z), size, angle,
    });
    const wood: Placement[] = [];
    for (const site of ['barracks', 'lumber']) {
      if (!stock.has(site)) continue;
      const lot = this.lot(site);
      wood.push(at(site, 0, lot.x + 2.04, lot.z + 1.73, .66, .21));
      if (site === 'lumber') wood.push(at(site, 1, lot.x + 1.49, lot.z - 1.78, .79, -.58));
    }
    if (wood.length) assets.timber ??= make('cut-timber');
    assets.timber?.sync(wood);
    const stone = this.inValley && state.age >= 2;
    const watch = stone && stock.has('watch') ? [at('watch', 0, this.lot('watch').x + 1.95, this.lot('watch').z + 1.9, 1.34, this.angle('watch'))] : [];
    if (watch.length) assets.watch ??= make('castle-watch');
    assets.watch?.sync(watch);
    assets.workshop?.dispose();
    assets.workshop = undefined;
    if (state.age === 3 && stock.has('forge')) {
      const lot = this.lot('forge'), x = lot.x, z = lot.z - 3.6;
      const y = this.ground.getHeightAtCoordinates(x, z);
      const machine = new Model('Wurfmaschine im Werkhof', this.materials);
      for (const side of [-1, 1]) {
        const offset = x + side * .47;
        machine.box(offset, y + .23, z, .17, .21, 1.61, '#75583e', 0, 'oldWood');
        machine.box(offset, y + .55, z + .17, .15, .66, .15, '#75583e', 0, 'oldWood');
        machine.box(offset, y + .50, z - .12, .14, .79, .13, '#75583e', 0, 'oldWood').rotation.x = -.63;
        for (const dz of [-.58, .56]) {
          machine.cone(offset + side * .09, y + .175, z + dz, .36, .12, '#5c4c3f', 10, .36).rotation.z = Math.PI / 2;
        }
      }
      machine.box(x, y + .80, z + .17, 1.11, .16, .15, '#766c60');
      machine.box(x, y + .89, z - .06, .13, 1.47, .12, '#7f644a', 0, 'oldWood').rotation.x = -1.04;
      assets.workshop = machine.finish({ site: 'forge' }, this.renderer.shadows);
    }
  }

  sync(state: CityState) {
    const previous = this.state;
    this.state = state;
    const changedCity = previous?.id !== state.id;
    if (changedCity) this.sculpt();
    if (changedCity || previous.biome !== state.biome) this.backdrop(state.biome);
    const pathState = (city: CityState) => city.sites.map(site => site.id === 'wall' ? `wall:${site.level}` : site.id).join();
    if (changedCity || previous.faction !== state.faction || previous.age !== state.age || pathState(previous) !== pathState(state)) {
      this.buildPaths(state);
    }
    this.decorateBuildings(state);
    const keep = new Set(state.sites.map(site => site.id));
    for (const [id, entry] of this.buildings) {
      if (keep.has(id)) continue;
      entry.imported?.dispose();
      entry.model.dispose();
      entry.label.remove();
      this.buildings.delete(id);
    }
    for (const site of state.sites) {
      let entry = this.buildings.get(site.id);
      const key = JSON.stringify([state.id, state.faction, state.age, site.level]);
      if (!entry || entry.key !== key) {
        entry?.imported?.dispose();
        entry?.model.dispose();
        const label = entry?.label || document.createElement('button');
        if (!entry) {
          label.type = 'button';
          label.className = 'city3d-label';
          label.addEventListener('click', () => this.onPick(site.id));
          this.labels.append(label);
        }
        label.textContent = `${site.name.split(' · ')[0]} · ${site.level}`;
        label.title = `${site.name} · Stufe ${site.level}`;
        const model = site.id === 'wall' ? new TransformNode('Stadttor-Beschriftung', this.renderer.scene)
          : buildingModel(this.materials, state.faction, state.color, state.age, site.id, site.level, this.renderer.shadows);
        model.position.copyFrom(this.lot(site.id));
        model.rotation.y = this.angle(site.id);
        label.dataset.site = site.id;
        const labelHeight = model.getHierarchyBoundingVectors().max.y - model.position.y + .37;
        entry = { model, label, key, labelHeight };
        if (state.faction === 'aurel' && state.age === 3 && (site.id === 'forge' || site.id === 'lumber' && this.inValley)) {
          const sawmill = site.id === 'lumber';
          const imported = new Props(sawmill ? 'summer-sawmill' : 'summer-smithy', this.renderer.scene,
            this.renderer.shadows, sawmill ? 'Sawing' : undefined);
          entry.imported = imported;
          const size = .36 + Math.min(4, site.level) * .05;
          imported.sync([{
            id: `${state.id}/${site.id}`, site: site.id, position: model.position.clone(),
            size, angle: model.rotation.y,
            onReady: () => {
              const current = this.buildings.get(site.id);
              if (current?.imported !== imported) return;
              model.setEnabled(false);
              current.labelHeight = size * (sawmill ? 9.29 : 9.8) + .37;
            },
          }]);
        }
        this.buildings.set(site.id, entry);
      }
      if (site.id === 'wall' && this.wall) {
        entry.model.position.copyFrom(this.wall.position);
        entry.labelHeight = this.wall.labelHeight;
      }
      entry.label.dataset.selected = String(state.selected === site.id);
    }
    this.canvas.dataset.sites = String(this.buildings.size);
    if (changedCity || Boolean(this.wall) !== previous.sites.some(site => site.id === 'wall')) this.reset();
  }

  private frame() {
    const { scene, engine, camera } = this.renderer;
    if (!this.state || !this.canvas.clientWidth || !this.canvas.clientHeight || document.hidden) return;
    this.brook.surface.setFloat('clock', performance.now() / 1000);
    scene.render();
    const now = performance.now();
    if (now - this.lastLabels < 33) return;
    this.lastLabels = now;
    const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    for (const [id, { model, label, labelHeight }] of this.buildings) {
      const point = Vector3.Project(model.position.add(new Vector3(0, labelHeight, 0)),
        Matrix.IdentityReadOnly, scene.getTransformMatrix(), viewport);
      const x = point.x * this.canvas.clientWidth / viewport.width;
      const y = point.y * this.canvas.clientHeight / viewport.height;
      label.hidden = point.z < 0 || point.z > 1 || x < 18 || y < 14 || x > this.canvas.clientWidth - 18 || y > this.canvas.clientHeight - 14;
      if (!label.hidden) { label.style.left = `${x}px`; label.style.top = `${y}px`; }
      if (id === this.state.selected && !this.buildingHud.hidden) {
        const width = this.buildingHud.offsetWidth, height = this.buildingHud.offsetHeight;
        const left = label.hidden ? this.canvas.clientWidth - width - 12
          : Math.min(this.canvas.clientWidth - width - 12, x + label.offsetWidth / 2 + 12);
        const top = label.hidden ? 132 : Math.min(this.canvas.clientHeight - height - 80, y - 18);
        this.buildingHud.style.left = `${Math.max(12, left)}px`;
        this.buildingHud.style.top = `${Math.max(114, top)}px`;
      }
    }
  }

  dispose() {
    this.events.abort();
    this.trees.dispose();
    this.firs.dispose();
    this.rocks.dispose();
    this.wall?.model.dispose();
    this.imported?.watch?.dispose();
    this.imported?.timber?.dispose();
    this.imported?.workshop?.dispose();
    for (const building of this.buildings.values()) building.imported?.dispose();
    this.renderer.dispose();
  }
}

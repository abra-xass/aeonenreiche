import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { ArcRotateCameraPointersInput } from '@babylonjs/core/Cameras/Inputs/arcRotateCameraPointersInput';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Material } from '@babylonjs/core/Materials/material';

export const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
export const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 71.345) * 43758.5453;
  return value - Math.floor(value);
};
export const color = (hex: string) => Color3.FromHexString(hex);

export function setup(canvas: HTMLCanvasElement, city: boolean) {
  const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(.047, .086, .116, 1);
  if (city) {
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = .009;
    scene.fogColor = color('#4a5a54');
  }
  scene.skipPointerMovePicking = true;
  const camera = new ArcRotateCamera('Kamera', -Math.PI / 2, city ? .86 : .76, city ? 47 : 20, Vector3.Zero(), scene);
  camera.lowerBetaLimit = .24;
  camera.upperBetaLimit = 1.22;
  camera.lowerRadiusLimit = city ? 15 : 11;
  camera.upperRadiusLimit = city ? 90 : 295;
  camera.minZ = .25;
  camera.maxZ = 950;
  camera.wheelDeltaPercentage = city ? .035 : .022;
  camera.panningSensibility = city ? 180 : 430;
  camera.panningInertia = .62;
  camera.inertia = .67;
  camera.angularSensibilityX = city ? 1900 : 3200;
  camera.angularSensibilityY = city ? 2200 : 3800;
  if (!city) {
    const pointers = camera.inputs.attached.pointers as ArcRotateCameraPointersInput;
    pointers.buttons = [1];
    camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
    camera.attachControl(false, false, 0);
  } else {
    camera.attachControl(false, false, 1);
  }
  const sky = new HemisphericLight('Himmelslicht', Vector3.Up(), scene);
  sky.diffuse = color('#d4e4ff');
  sky.groundColor = color('#7d7366');
  sky.intensity = city ? .78 : .86;
  const sun = new DirectionalLight('Sonne', new Vector3(.52, -1, .48), scene);
  sun.position = new Vector3(-65, 90, -50);
  sun.diffuse = color('#ffe0b0');
  sun.intensity = city ? 1.31 : 1.22;
  const shadows = city ? new ShadowGenerator(1536, sun) : null;
  if (shadows) {
    shadows.usePercentageCloserFiltering = true;
    shadows.bias = .0006;
    shadows.normalBias = .03;
  }
  const resize = new ResizeObserver(() => {
    if (canvas.clientWidth && canvas.clientHeight) engine.resize();
  });
  resize.observe(canvas);
  return {
    engine, scene, camera, shadows,
    dispose() { resize.disconnect(); engine.dispose(); },
  };
}

const surfaces = {
  wood: ['wood_plank_wall', .44, .18],
  thatch: ['thatch_roof_angled', .52, .22],
  slate: ['roof_slates_02', .55, .26],
  stone: ['rustic_stone_wall', .59, .29],
  dirt: ['stony_dirt_path', .49, .20],
  soil: ['farm_soil', .51, .24],
  oldWood: ['old_planks_02', .41, .24],
  ashlar: ['medieval_blocks_05', .45, .32],
  mossStone: ['mossy_stone_wall', .38, .27],
  cloth: ['hessian_380', .60, .15],
  iron: ['corrugated_iron', .52, .25],
  brick: ['brick_wall_11', .51, .30],
  chitin: ['insect_chitin', .84, .28],
} as const;

export type Surface = keyof typeof surfaces;

export function loadSurface(url: string, scene: Scene) {
  const texture = new Texture(`assets/3d/${url}.jpg`, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
  texture.anisotropicFilteringLevel = 8;
  return texture;
}

export class Materials {
  private readonly cache = new Map<string, StandardMaterial>();
  private readonly textures = new Map<Surface, [Texture, Texture]>();

  constructor(readonly scene: Scene) {}

  get(hex: string, glow = false, surface?: Surface) {
    const key = `${hex}/${glow}/${surface ?? ''}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const material = new StandardMaterial(key, this.scene);
    const pigment = color(hex);
    material.diffuseColor = surface ? Color3.Lerp(Color3.White(), pigment, surfaces[surface][1]) : pigment.scale(.76);
    material.specularColor = surface ? Color3.Black() : color('#191c1a');
    if (surface) {
      let textures = this.textures.get(surface);
      if (!textures) {
        const [name, , relief] = surfaces[surface];
        textures = [loadSurface(name, this.scene), loadSurface(`${name}-normal`, this.scene)];
        textures[1].level = relief;
        this.textures.set(surface, textures);
      }
      [material.diffuseTexture, material.bumpTexture] = textures;
    }
    if (glow) material.emissiveColor = color(hex).scale(.64);
    material.freeze();
    this.cache.set(key, material);
    return material;
  }
}

export class Geometry {
  readonly positions: number[] = [];
  readonly indices: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly colors: number[] = [];

  vertex(point: Vector3, tint: Color3, normal = Vector3.Up()) {
    const index = this.positions.length / 3;
    this.positions.push(point.x, point.y, point.z);
    this.normals.push(normal.x, normal.y, normal.z);
    this.uvs.push(point.x / 2.6, point.z / 2.6);
    this.colors.push(tint.r, tint.g, tint.b, 1);
    return index;
  }

  mesh(name: string, scene: Scene, material: Material) {
    const mesh = new Mesh(name, scene);
    const data = new VertexData();
    data.positions = this.positions;
    data.indices = this.indices;
    data.normals = this.normals;
    data.uvs = this.uvs;
    data.colors = this.colors;
    data.applyToMesh(mesh);
    mesh.material = material;
    mesh.receiveShadows = true;
    return mesh;
  }
}

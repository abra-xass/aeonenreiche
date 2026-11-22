import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { Geometry, loadSurface } from './scene';

export class GroundGeometry extends Geometry {
  readonly soils: number[] = [];
  readonly slopes: number[] = [];
  readonly weather: number[] = [];
  readonly faces: string[] = [];

  build(name: string, scene: Scene, material: ShaderMaterial) {
    const ground = this.mesh(name, scene, material);
    ground.setVerticesData('soils', this.soils, false, 4);
    ground.setVerticesData('slopes', this.slopes, false, 4);
    ground.setVerticesData('weather', this.weather, false, 2);
    ground.metadata = { provinces: this.faces };
    return ground;
  }
}

export function terrainMaterial(scene: Scene) {
  const layers = {
    grass: 'grass_ground', dryGrass: 'withered_grass', forest: 'forest_floor', wet: 'aerial_mud_1',
    rock: 'rocky_terrain', moss: 'mossy_rock', snow: 'snow_floor', sand: 'sand_01', drySoil: 'brown_mud_dry',
  };
  const material = new ShaderMaterial('Überblendete Geländeoberflächen', scene, {
    vertexSource: `
      precision highp float;
      attribute vec3 position;
      attribute vec3 normal;
      attribute vec4 color;
      attribute vec4 soils;
      attribute vec4 slopes;
      attribute vec2 weather;
      uniform mat4 worldViewProjection;
      varying vec3 groundPoint;
      varying vec3 groundNormal;
      varying vec3 tint;
      varying vec4 soilWeights;
      varying vec4 slopeWeights;
      varying vec2 visibility;
      void main() {
        groundPoint = position;
        groundNormal = normal;
        tint = color.rgb;
        soilWeights = soils;
        slopeWeights = slopes;
        visibility = weather;
        gl_Position = worldViewProjection * vec4(position, 1.);
      }`,
    fragmentSource: `
      precision highp float;
      uniform sampler2D grass, dryGrass, forest, wet, rock, moss, snow, sand, drySoil;
      varying vec3 groundPoint;
      varying vec3 groundNormal;
      varying vec3 tint;
      varying vec4 soilWeights;
      varying vec4 slopeWeights;
      varying vec2 visibility;
      void main() {
        vec2 p = groundPoint.xz;
        vec2 warp = vec2(sin(p.y * .97 + cos(p.x * 1.11)), cos(p.x * .88 + sin(p.y * 1.03))) * .09;
        vec2 uv = p * .64 + warp;
        float flecks = sin(p.x * 7.6 + sin(p.y * 6.9)) * cos(p.y * 8.9 + p.x * 4.1);
        vec3 n = normalize(groundNormal);
        vec3 triplanar = pow(abs(n), vec3(5.));
        triplanar /= dot(triplanar, vec3(1.));
        vec3 stone = texture2D(rock, groundPoint.yz * .86).rgb * triplanar.x
          + texture2D(rock, uv * 1.13).rgb * triplanar.y
          + texture2D(rock, groundPoint.xy * .86).rgb * triplanar.z;
        vec4 ground = max(soilWeights + vec4(flecks*.09,-flecks*.06,flecks*.05,0.), 0.);
        ground /= max(.01, dot(ground, vec4(1.)));
        vec3 vegetation = texture2D(grass, uv).rgb * ground.x
          + texture2D(dryGrass, uv * .88).rgb * ground.y
          + texture2D(forest, uv * .86).rgb * ground.z
          + texture2D(wet, uv * .60).rgb * ground.w;
        vegetation = mix(vegetation, texture2D(drySoil, uv * 1.06).rgb, slopeWeights.w);
        vec3 cliff = mix(stone, texture2D(moss, uv * 1.12).rgb, clamp(slopeWeights.y, 0., 1.));
        vec3 surface = mix(vegetation, texture2D(sand, uv * 1.48).rgb, slopeWeights.z);
        surface = mix(surface, cliff, slopeWeights.x);
        surface = mix(surface, texture2D(snow, uv * 1.31).rgb, visibility.x);
        float diffuse = max(0., dot(n, normalize(vec3(-.61, .71, -.46))));
        float horizon = .91 + sin(p.x * .24 + sin(p.y*.41)) * cos(p.y*.29) * .09;
        vec3 base = surface * vec3(1.16, 1.12, 1.04) * (vec3(.61,.68,.70) + diffuse * vec3(.63,.57,.46));
        gl_FragColor = vec4(base * tint * horizon * visibility.y, 1.);
      }`,
  }, {
    attributes: ['position', 'normal', 'color', 'soils', 'slopes', 'weather'],
    uniforms: ['worldViewProjection'], samplers: Object.keys(layers),
  });
  for (const [sampler, name] of Object.entries(layers)) material.setTexture(sampler, loadSurface(name, scene));
  material.backFaceCulling = false;
  return material;
}

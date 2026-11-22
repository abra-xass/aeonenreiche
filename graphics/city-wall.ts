import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { Model } from './models';
import type { Materials } from './scene';

export function cityWall(materials: Materials, shadows: ShadowGenerator | null, lots: Vector3[], gateX: number,
  age: number, level: number, heightAt: (x: number, z: number) => number, eastLimit?: (z: number) => number, insect = false) {
  const west = Math.min(...lots.map(lot => lot.x)) - 4.8, east = Math.max(...lots.map(lot => lot.x)) + 4.8;
  const south = Math.min(...lots.map(lot => lot.z)) - 4.65, north = Math.max(...lots.map(lot => lot.z)) + 4.65;
  const opening = 1.15, corner = 2.8;
  const masonry = age >= 2;
  const height = 1.08 + Math.min(level, 5) * .21 + age * .047;
  const surface = insect ? 'chitin' : age >= 5 ? 'iron' : age === 4 ? 'brick' : age === 3 ? 'ashlar' : age === 2 ? 'stone' : 'oldWood';
  const wall = new Model('Umlaufende Stadtbefestigung', materials);
  const tones = ['#806449', '#ae8459', '#8b8f83', '#a39a89', '#938176', '#8b9a9f', '#a1adb2'];
  const tone = insect ? '#a9a165' : tones[age] ?? tones[0];
  const keepAshore = (point: Vector3) => {
    if (eastLimit) point.x = Math.min(point.x, eastLimit(point.z));
    return point;
  };
  const points = [new Vector3(gateX + opening, 0, south)];
  const tower = (x: number, z: number) => {
    x = keepAshore(new Vector3(x, 0, z)).x;
    const y = heightAt(x, z), towerHeight = height + .71;
    wall.box(x, y + towerHeight / 2 - .07, z, .92, towerHeight + .14, .92, tone, 0, surface);
    if (insect) {
      wall.cone(x, y + towerHeight + .07, z, 1.38, .80 + age * .08, '#9f9959', 8, .16, false, 'chitin');
      wall.cone(x, y + towerHeight + .60 + age * .05, z, .24, .27, '#d4c465', 5, .055, age >= 5);
    } else if (age >= 4) {
      wall.box(x, y + towerHeight + .035, z, 1.23, .27, 1.23, '#6c868e', 0, 'iron');
      if (age >= 5) {
        wall.cone(x, y + towerHeight + .23, z, .83, .39, '#659095', 6, .46, false, 'iron');
        if (age === 6) wall.cone(x, y + towerHeight + .49, z, .43, .29, '#8de2dd', 6, .24, true);
      }
    } else if (masonry) {
      wall.box(x, y + towerHeight, z, 1.08, .22, 1.08, '#b0a695', 0, 'ashlar');
      for (const dx of [-.4, .4]) for (const dz of [-.4, .4])
        wall.box(x + dx, y + towerHeight + .20, z + dz, .28, .25, .28, tone, 0, surface);
    } else {
      wall.cone(x, y + towerHeight + .20, z, 1.37, .63, '#65563e', 4, .04);
    }
  };
  const corners = [[east - corner, south + corner], [east - corner, north - corner],
    [west + corner, north - corner], [west + corner, south + corner]];
  for (const [index, [x, z]] of corners.entries()) {
    for (let i = 0; i <= 5; i++) {
      const angle = (index - 1 + i / 5) * Math.PI / 2;
      points.push(new Vector3(x + corner * Math.cos(angle), 0, z + corner * Math.sin(angle)));
    }
    const angle = (index - .5) * Math.PI / 2;
    tower(x + corner * Math.cos(angle), z + corner * Math.sin(angle));
  }
  points.push(new Vector3(gateX - opening, 0, south));
  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1], end = points[i];
    const count = Math.max(1, Math.ceil(Vector3.Distance(start, end) / (masonry ? .86 : .35)));
    for (let j = 0; j < count; j++) {
      const a = keepAshore(Vector3.Lerp(start, end, j / count)), b = keepAshore(Vector3.Lerp(start, end, (j + 1) / count));
      const angle = Math.atan2(a.z - b.z, b.x - a.x);
      const p = Vector3.Center(a, b), low = Math.min(heightAt(a.x, a.z), heightAt(b.x, b.z), heightAt(p.x, p.z)) - .11;
      const top = Math.max(heightAt(a.x, a.z), heightAt(b.x, b.z)) + height;
      const length = Vector3.Distance(a, b) + .095;
      const depth = masonry ? .55 : .33;
      wall.box(p.x, (low + top) / 2, p.z, length, top - low, depth, tone, angle, surface);
      if (!masonry) wall.cone(p.x, top + .13, p.z, .40, .36, '#927451', 4, .04);
      else if (age >= 4) wall.box(p.x, top + .07, p.z, length, .15, depth + .12, age === 6 ? '#71b8bc' : '#78858a', angle, 'iron');
      else if (j % 2 === 0) wall.box(p.x, top + .105, p.z, length * .56, .26, .55, tone, angle, surface);
    }
  }
  const pillar = opening;
  for (const side of [-1, 1]) tower(gateX + side * pillar, south);
  const y = heightAt(gateX, south);
  wall.box(gateX, y + height + .46, south, 2 * pillar, .37, .55, tone, 0, surface);
  wall.box(gateX, y + height + .71, south, 2 * pillar + .14, .15, .69, '#6c5a42', 0, 'oldWood');
  return { model: wall.finish({ site: 'wall' }, shadows), position: new Vector3(gateX, y, south),
    labelHeight: height + 1.24, bounds: { west, east, south, north } };
}

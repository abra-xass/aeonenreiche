import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import '@babylonjs/core/Culling/ray';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import '@babylonjs/core/Particles/particleSystemComponent';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { MapActions, MapState, March, OrderRoute, Province, Tile, WorldGeometry } from './types';
import { clamp, color, Geometry, Materials, random, setup } from './scene';
import { CoastalStrip, ocean, ReliefGeometry, SCALE, surfMaterial, vegetation } from './terrain';
import { armyModel, settlement } from './models';
import { animateMarch } from './marches';
import { Props } from './props';
import { GroundGeometry, terrainMaterial } from './ground';

interface Marker {
  signature: string;
  model?: TransformNode;
  label: HTMLButtonElement;
}
interface Trail { cloud: ParticleSystem; emitter: Vector3; sea: boolean }
const panKeys: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1],
};

export class CampaignView {
  private readonly scene;
  private readonly relief;
  private readonly materials;
  private readonly updateWater;
  private readonly surf;
  private readonly vegetationMaterial;
  private readonly groundMaterial;
  private readonly rocks;
  private readonly trees;
  private readonly birches;
  private dragons?: Props;
  private readonly marks = new Map<string, Marker>();
  private readonly marching = new Map<number, Marker>();
  private readonly meshGroups = new Map<string, { signature: string; meshes: AbstractMesh[] }>();
  private readonly visible = new Map<string, Province>();
  private readonly geometryGroups = new Map<string, Province[]>();
  private overlays: AbstractMesh[] = [];
  private overlayKey = '';
  private riverKey = '';
  private river?: AbstractMesh;
  private readonly riverMaterial;
  private state?: MapState;
  private political = false;
  private lastLabelFrame = 0;
  private viewKey = '';
  private down?: { id: number; x: number; y: number; dragging: boolean };
  private readonly keys = new Set<string>();
  private lastFrame = 0;
  private move?: { from: Vector3; to: Vector3; radius: number; goal: number; start: number; duration: number };
  private readonly events = new AbortController();
  private hoverId?: string;
  private hoverOutline?: AbstractMesh;
  private lastHover = 0;
  private readonly routeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  private routePaths: { shape: SVGPathElement; arrow: SVGPathElement; ground: Vector3[] }[] = [];
  private routeKey = '';
  private readonly trailEffects = new Map<number, Trail>();
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  private trailTexture?: DynamicTexture;

  constructor(private canvas: HTMLCanvasElement, private labels: HTMLElement, private world: WorldGeometry,
    private actions: MapActions, selected: string) {
    const setupResult = setup(canvas, false);
    this.scene = setupResult;
    this.relief = new ReliefGeometry(world, setupResult.scene);
    this.materials = new Materials(setupResult.scene);
    this.groundMaterial = terrainMaterial(setupResult.scene);
    this.riverMaterial = new StandardMaterial('Fluss bei Aurelholm', setupResult.scene);
    this.riverMaterial.backFaceCulling = false;
    this.riverMaterial.specularColor.set(.12, .16, .15);
    this.riverMaterial.emissiveColor.set(.075, .11, .11);
    this.vegetationMaterial = new StandardMaterial('Baumkronen', setupResult.scene);
    this.vegetationMaterial.backFaceCulling = false;
    this.vegetationMaterial.specularColor.set(0, 0, 0);
    this.updateWater = ocean(setupResult.scene, world);
    this.surf = surfMaterial(setupResult.scene);
    this.rocks = new Props('namaqualand-boulder', setupResult.scene);
    this.trees = new Props('pine-sapling', setupResult.scene);
    this.birches = new Props('summer-birch', setupResult.scene);
    this.routeLayer.classList.add('route-layer');
    this.routeLayer.setAttribute('aria-hidden', 'true');
    labels.prepend(this.routeLayer);
    this.resetCamera(selected);
    const options = { signal: this.events.signal };
    canvas.addEventListener('pointerdown', event => {
      this.move = undefined;
      if (event.button === 0 && event.isPrimary) {
        this.stopMomentum();
        this.down = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
      }
    }, options);
    canvas.addEventListener('wheel', () => { this.move = undefined; }, { ...options, passive: true });
    canvas.addEventListener('pointerup', event => {
      if (event.pointerId !== this.down?.id) return;
      const start = this.down;
      this.down = undefined;
      canvas.classList.remove('dragging');
      if (event.button !== 0 || start.dragging || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
      this.pick(event, false);
    }, options);
    const cancelDrag = () => { this.down = undefined; canvas.classList.remove('dragging'); };
    canvas.addEventListener('pointercancel', cancelDrag, options);
    canvas.addEventListener('lostpointercapture', cancelDrag, options);
    canvas.addEventListener('pointermove', event => {
      const drag = this.down;
      if (drag?.id === event.pointerId && event.buttons) {
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (!drag.dragging && Math.hypot(dx, dy) < 4) return;
        if (!drag.dragging) {
          drag.dragging = true;
          canvas.setPointerCapture(event.pointerId);
          this.hover();
          canvas.classList.add('dragging');
        }
        this.pan(-dx, dy);
        drag.x = event.clientX;
        drag.y = event.clientY;
        return;
      }
      if (event.pointerType !== 'mouse' || event.buttons || performance.now() - this.lastHover < 55) return;
      this.lastHover = performance.now();
      this.hover(this.hit(event, false).tile);
    }, options);
    canvas.addEventListener('pointerleave', () => this.hover(), options);
    canvas.addEventListener('contextmenu', event => { event.preventDefault(); this.pick(event, true); }, options);
    document.addEventListener('keydown', event => {
      const direction = panKeys[event.key];
      if (!direction || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || !canvas.offsetWidth
        || document.querySelector('dialog[open]') || (event.target as Element | null)?.closest?.('input,textarea,select,[contenteditable],#mapContext,#mapOrder')) return;
      event.preventDefault();
      if (this.keys.has(event.key)) return;
      this.move = undefined;
      this.stopMomentum();
      this.keys.add(event.key);
      this.pan(direction[0] * 33, direction[1] * 33);
    }, options);
    document.addEventListener('keyup', event => this.keys.delete(event.key), options);
    window.addEventListener('blur', () => { this.keys.clear(); cancelDrag(); }, options);
    setupResult.engine.runRenderLoop(() => this.frame());
  }

  get camera() { return this.scene.camera; }

  private pan(x: number, y: number) {
    const camera = this.camera;
    const scale = 2 * camera.radius * Math.tan(camera.fov / 2) / Math.max(1, this.canvas.clientHeight);
    const sin = Math.sin(camera.alpha), cos = Math.cos(camera.alpha);
    const forward = y / Math.max(.42, Math.cos(camera.beta));
    camera.target.x += (-sin * x - cos * forward) * scale;
    camera.target.z += (cos * x - sin * forward) * scale;
  }

  firstFrame() {
    const { scene } = this.scene;
    return new Promise<void>(resolve => {
      let finished = false;
      const complete = () => {
        if (finished) return;
        finished = true;
        clearTimeout(deadline);
        resolve();
      };
      const deadline = setTimeout(complete, 8000);
      scene.executeWhenReady(() => {
        if (!finished) scene.onAfterRenderObservable.addOnce(complete);
      });
    });
  }

  private stopMomentum() {
    const camera = this.camera;
    camera.inertialAlphaOffset = camera.inertialBetaOffset = camera.inertialRadiusOffset = 0;
    camera.inertialPanningX = camera.inertialPanningY = 0;
  }

  private glide(to: Vector3, goal: number, duration: number) {
    this.stopMomentum();
    this.move = {
      from: this.camera.target.clone(), to: to.clone(), radius: this.camera.radius, goal, start: performance.now(),
      duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : duration,
    };
  }

  focusTile(id: string) {
    const tile = this.world.lookup[id];
    if (tile) this.glide(this.relief.point(tile), this.camera.radius, 390);
  }

  focus(x: number, y: number) { this.glide(new Vector3(x * SCALE, 0, -y * SCALE), this.camera.radius, 390); }

  zoom(factor: number) {
    const goal = clamp((this.move?.goal ?? this.camera.radius) / Math.pow(factor, .62), 11, 285);
    this.glide(this.move?.to ?? this.camera.target, goal, 210);
  }

  overview(id: string) {
    const tile = this.world.lookup[id];
    if ((this.move?.goal ?? this.camera.radius) >= 155 && tile) this.glide(this.relief.point(tile), 20, 670);
    else this.glide(new Vector3(this.world.bounds.width * SCALE / 2, 0, -this.world.bounds.height * SCALE / 2), 253, 670);
  }

  togglePolitical(active: boolean) {
    this.political = active;
    if (this.state) this.sync(this.state);
  }

  resetCamera(id: string) {
    this.move = undefined;
    this.stopMomentum();
    this.camera.alpha = -Math.PI / 2;
    this.camera.beta = .76;
    this.camera.radius = 20;
    const tile = this.world.lookup[id];
    if (tile) this.camera.setTarget(this.relief.point(tile), false, false, true);
  }

  private hit(event: MouseEvent, context: boolean) {
    const bounds = this.canvas.getBoundingClientRect();
    const hit = this.scene.scene.pick(event.clientX - bounds.left, event.clientY - bounds.top,
      mesh => mesh.isPickable && mesh.isEnabled() && mesh.isVisible
        && Boolean(mesh.metadata?.provinces || mesh.metadata?.tile || !context && mesh.metadata?.march !== undefined),
      false, this.camera);
    const metadata = hit?.pickedMesh?.metadata;
    return { march: metadata?.march as number | undefined, tile: (metadata?.tile || (hit && metadata?.provinces?.[hit.faceId])) as string | undefined };
  }

  private pick(event: PointerEvent | MouseEvent, context: boolean) {
    const { march, tile } = this.hit(event, context);
    if (!context && march !== undefined) { this.actions.march(march); return; }
    if (tile && this.visible.has(tile)) this.actions.pick(tile, context ? 'context' : 'province', event);
  }

  private hover(id?: string) {
    if (id && !this.visible.has(id)) id = undefined;
    if (id === this.hoverId) return;
    this.hoverId = id;
    this.canvas.style.cursor = id ? 'pointer' : '';
    this.hoverOutline?.dispose();
    this.hoverOutline = undefined;
    if (!id) return;
    const tile = this.world.lookup[id];
    const boundary = this.relief.boundary(tile).map(([x, y]) => this.relief.point(tile, x, y, .16));
    const highlight = CreateLineSystem('Provinz unter dem Zeiger', { lines: [[...boundary, boundary[0]]] }, this.scene.scene);
    highlight.color = color('#e5cf9f');
    highlight.alpha = .67;
    highlight.isPickable = false;
    this.hoverOutline = highlight;
  }

  private refreshTerrain() {
    const known = new Set([...this.visible.values()].filter(province => province.discovered).map(province => province.id));
    const riverKey = [...known].join('|');
    if (this.riverKey !== riverKey) {
      this.riverKey = riverKey;
      this.river?.dispose();
      const bed = this.relief.valleyRiver(known);
      this.river = bed.indices.length ? bed.mesh('Aurelholmer Fluss', this.scene.scene, this.riverMaterial) : undefined;
      if (this.river) this.river.isPickable = false;
    }
    for (const [name, group] of this.geometryGroups) {
      const signature = group.map(province => `${province.id}/${+province.visible}/${+(province.city > 0)}/${this.political ? province.color : ''}`).join('|');
      if (this.meshGroups.get(name)?.signature === signature) continue;
      this.meshGroups.get(name)?.meshes.forEach(mesh => mesh.dispose());
      const ground = new GroundGeometry();
      const plants = new Geometry();
      const shore = new Geometry(), cliffs = new Geometry();
      const waves = new CoastalStrip();
      for (const province of group) {
        const tile = this.world.lookup[province.id];
        const fog = province.visible ? 1 : .43;
        this.relief.tile(ground, tile, fog, this.political && province.owner ? province.color : undefined);
        this.relief.shore(['mountain', 'highland', 'tundra'].includes(tile.biome) ? cliffs : shore, waves, tile, fog);
        vegetation(plants, this.relief, tile, fog, province.city > 0);
      }
      const meshes = [ground.build(name, this.scene.scene, this.groundMaterial)];
      for (const [geometry, name, biome] of [[shore, 'Strand', 'coast'], [cliffs, 'Klippen', 'mountain']] as const) {
        if (!geometry.indices.length) continue;
        const margin = geometry.mesh(name, this.scene.scene, this.relief.material(biome));
        margin.isPickable = false;
        meshes.push(margin);
      }
      if (waves.indices.length) meshes.push(waves.mesh(this.scene.scene, this.surf));
      if (plants.indices.length) {
        const canopy = plants.mesh('Vegetation', this.scene.scene, this.vegetationMaterial);
        canopy.isPickable = false;
        meshes.push(canopy);
      }
      meshes.forEach(mesh => mesh.freezeWorldMatrix());
      this.meshGroups.set(name, { signature, meshes });
    }
    for (const [name, { meshes }] of this.meshGroups) {
      if (this.geometryGroups.has(name)) continue;
      meshes.forEach(mesh => mesh.dispose());
      this.meshGroups.delete(name);
    }
  }

  private refreshBorders(state: MapState) {
    const key = state.provinces.filter(p => p.own || p.reachable || this.political && p.owner)
      .map(p => `${p.id}/${p.owner}/${+p.reachable}`).join('|') + JSON.stringify([state.selected, state.crossings, this.political,
        state.marches.map(march => [march.id, march.from, march.to, march.returning, march.turnaround])]);
    if (key === this.overlayKey) return;
    this.overlayKey = key;
    this.overlays.forEach(mesh => mesh.dispose());
    this.overlays = [];
    const edges = new Map<string, Map<string, Vector3[]>>();
    const active: Vector3[][] = [];
    for (const province of state.provinces) {
      if (!province.own && !province.reachable && province.id !== state.selected && !(this.political && province.owner)) continue;
      const tile = this.world.lookup[province.id];
      const points = this.relief.boundary(tile).map(([x, y]) => this.relief.point(tile, x, y, .075));
      const tint = province.own ? '#8eead0' : province.color;
      if (province.own || this.political && province.owner) {
        if (!edges.has(tint)) edges.set(tint, new Map());
        const group = edges.get(tint)!;
        for (let i = 0; i < 18; i += 3) {
          const side = [points[i], points[i + 1], points[i + 2], points[(i + 3) % 18]];
          const edgeKey = [side[0], side[3]].map(point => `${point.x.toFixed(3)}:${point.z.toFixed(3)}`).sort().join('/');
          if (group.has(edgeKey)) group.delete(edgeKey);
          else group.set(edgeKey, side);
        }
      }
      if (province.reachable || province.id === state.selected) active.push([...points, points[0]].map(point => point.add(new Vector3(0, .105, 0))));
    }
    for (const [tint, parts] of edges) this.lines('Reichsgrenze', [...parts.values()], tint);
    this.lines('Auswahl', active, '#ffe0a3');
    this.lines('Seewege', state.crossings.flatMap(([from, to]) => {
      const [a, b] = [this.world.lookup[from], this.world.lookup[to]];
      const start = this.relief.point(a, a.x, a.y, .15), end = this.relief.point(b, b.x, b.y, .15);
      const at = (p: number) => Vector3.Lerp(start, end, p);
      return Array.from({ length: 28 }, (_, i) => [at(i / 28), at((i + .55) / 28)]);
    }), '#a4a793');
    for (const march of state.marches) {
      const point = (p: number) => this.marchPosition(march, march.started + (march.due - march.started) * p)
        .add(new Vector3(0, .09, 0));
      this.lines('Marschroute', Array.from({ length: 20 }, (_, index) =>
        [point(index / 20), point((index + .65) / 20)]), march.color);
    }
  }

  routes(links: OrderRoute[]) {
    const key = JSON.stringify(links);
    if (key === this.routeKey) return;
    this.routeKey = key;
    this.routeLayer.replaceChildren();
    this.routePaths = links.map(link => {
      const group = document.createElementNS(this.routeLayer.namespaceURI, 'g');
      group.setAttribute('class', `route-${link.kind}${link.selected ? ' route-selected' : ''}`);
      const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      shape.classList.add('route-flow');
      arrow.classList.add('route-head');
      group.append(shape, arrow);
      this.routeLayer.append(group);
      const a = this.world.lookup[link.from], b = this.world.lookup[link.to];
      const ground = Array.from({ length: 13 }, (_, i) => {
        const p = .20 + .55 * i / 12;
        const x = a.x + (b.x - a.x) * p;
        const y = a.y + (b.y - a.y) * p + (link.sea ? Math.sin(p * Math.PI) * 19 : 0);
        const tile = link.sea ? undefined : i < 7 ? a : b;
        return new Vector3(x * SCALE, (tile ? this.relief.height(tile, x, y) : .08) + .33, -y * SCALE);
      });
      return { shape, arrow, ground };
    });
  }

  private drawRoutes() {
    if (!this.routePaths.length) return;
    const { engine, scene, camera } = this.scene;
    const width = engine.getRenderWidth(), height = engine.getRenderHeight();
    const viewport = camera.viewport.toGlobal(width, height);
    this.routeLayer.setAttribute('viewBox', `0 0 ${this.canvas.clientWidth} ${this.canvas.clientHeight}`);
    for (const { shape, arrow, ground } of this.routePaths) {
      const points = ground.map(point => Vector3.Project(point, Matrix.IdentityReadOnly, scene.getTransformMatrix(), viewport));
      if (points.some(point => point.z < 0 || point.z > 1)) { shape.removeAttribute('d'); arrow.removeAttribute('d'); continue; }
      const projected = points.map(point => [point.x * this.canvas.clientWidth / width, point.y * this.canvas.clientHeight / height]);
      shape.setAttribute('d', projected.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
      const [x, y] = projected.at(-1)!, [px, py] = projected.at(-2)!;
      const angle = Math.atan2(y - py, x - px) * 180 / Math.PI;
      arrow.setAttribute('d', 'M-8,-5 L1,0 L-8,5');
      arrow.setAttribute('transform', `translate(${x} ${y}) rotate(${angle})`);
    }
  }

  private marchTrail(id: number, sea: boolean, position: Vector3, speed: number, amount: number) {
    let trail = this.trailEffects.get(id);
    if (trail && trail.sea !== sea) { trail.cloud.dispose(false); this.trailEffects.delete(id); trail = undefined; }
    if (!trail) {
      const scene = this.scene.scene;
      if (!this.trailTexture) {
        const image = new DynamicTexture('Staubpartikel', 64, scene, false);
        const context = image.getContext();
        for (const [x, y, radius] of [[29,31,28],[22,25,18],[41,34,19],[30,44,16]]) {
          const glow = context.createRadialGradient(x, y, 1, x, y, radius);
          glow.addColorStop(0,'rgba(255,255,255,.26)');
          glow.addColorStop(.58,'rgba(255,255,255,.11)');
          glow.addColorStop(1,'rgba(255,255,255,0)');
          context.fillStyle = glow;
          context.fillRect(0, 0, 64, 64);
        }
        image.hasAlpha = true;
        image.update();
        this.trailTexture = image;
      }
      const cloud = new ParticleSystem(sea ? 'Sprühwasser' : 'Marschstaub', 36, scene);
      cloud.particleTexture = this.trailTexture;
      const emitter = position.clone();
      cloud.emitter = emitter;
      cloud.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      cloud.color1 = sea ? new Color4(.78,.92,.96,.42) : new Color4(.76,.58,.38,.49);
      cloud.color2 = sea ? new Color4(.51,.71,.78,.28) : new Color4(.51,.44,.35,.34);
      cloud.colorDead = new Color4(.51,.44,.35,0);
      cloud.minLifeTime = .50; cloud.maxLifeTime = sea ? 1.17 : 1.55;
      cloud.minSize = .17; cloud.maxSize = sea ? .65 : .89;
      cloud.minEmitPower = .14; cloud.maxEmitPower = .46;
      cloud.direction1 = new Vector3(-.7, .23, -.7);
      cloud.direction2 = new Vector3(.7, .59, .7);
      cloud.minEmitBox = new Vector3(-.34,0,-.16);
      cloud.maxEmitBox = new Vector3(.34,.07,.16);
      cloud.emitRate = 0;
      cloud.start();
      trail = { cloud, emitter, sea };
      this.trailEffects.set(id,trail);
    }
    trail.emitter.copyFrom(position);
    trail.emitter.y += .04;
    trail.cloud.emitRate = speed > 0 ? Math.min(32, 5 + amount * .65) : 0;
  }

  private lines(name: string, lines: Vector3[][], tint: string) {
    if (!lines.length) return;
    const mesh = CreateLineSystem(name, { lines }, this.scene.scene);
    mesh.color = color(tint);
    mesh.isPickable = false;
    this.overlays.push(mesh);
  }

  private makeLabel(className: string, onClick: (event: MouseEvent) => void) {
    const label = document.createElement('button');
    label.type = 'button';
    label.className = className;
    label.hidden = true;
    label.addEventListener('click', onClick);
    this.labels.append(label);
    return label;
  }

  private updateProvince(province: Province) {
    const tile = this.world.lookup[province.id];
    let mark = this.marks.get(province.id);
    if (!mark) {
      const label = this.makeLabel('map3d-label', event => {
        this.actions.pick(province.id, (event.target as HTMLElement).closest('.map3d-count') ? 'garrison' : 'province', event);
      });
      label.dataset.provinceId = province.id;
      label.addEventListener('contextmenu', event => this.actions.pick(province.id, 'context', event));
      label.addEventListener('keydown', event => {
        if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
        event.preventDefault();
        const rect = label.getBoundingClientRect();
        this.actions.pick(province.id, 'context', new MouseEvent('contextmenu', {
          clientX: rect.left + rect.width / 2, clientY: rect.bottom,
        }));
      });
      mark = { signature: '', label };
      this.marks.set(province.id, mark);
    }
    const modelKey = JSON.stringify([province.city, province.age, province.fortified, province.owner, province.visible]);
    if (mark.signature !== modelKey) {
      mark.signature = modelKey;
      mark.model?.dispose();
      mark.model = province.city ? settlement(this.materials, province.owner || '', province.color, province.age,
        province.city, tile.capital, province.fortified, tile.id) : undefined;
      if (mark.model) {
        mark.model.position.copyFrom(this.relief.point(tile));
        const scale = tile.capital ? .90 : .72;
        mark.model.scaling.setAll(scale);
      }
    }
    const label = mark.label;
    const active = this.state?.selected === province.id;
    label.dataset.selected = String(active);
    label.dataset.city = String(Boolean(province.city));
    label.dataset.memory = String(!province.visible);
    label.dataset.minor = String(!province.own && !province.city && !active && !province.reachable);
    label.style.setProperty('--province-color', province.own ? '#8eead0' : province.color);
    label.replaceChildren();
    if (province.encounter) {
      const icon = document.createElement('span');
      icon.className = `map3d-encounter ${province.encounter}`;
      icon.title = province.encounter === 'dragon' ? 'Drache' : 'Schatz';
      label.append(icon);
    }
    if (province.count) label.append(this.count(province.count, province.strength));
    const name = document.createElement('span');
    name.className = 'map3d-name';
    name.textContent = province.discovered ? tile.name.split(' · ')[0] : 'Unerkundete Provinz';
    label.append(name);
    label.title = `${tile.name}${province.count ? ` · ${province.count} Truppen · ${province.strength} Grundstärke` : ''}`;
    if (!province.discovered) label.title = 'Unerkundete Provinz';
    label.setAttribute('aria-label', label.title);
  }

  private count(value: number, strength: number) {
    const chip = document.createElement('span');
    chip.className = 'map3d-count';
    chip.textContent = String(value);
    chip.style.setProperty('--strength', `${100 * strength / (strength + 90)}%`);
    return chip;
  }

  private updateMarch(march: March) {
    let marker = this.marching.get(march.id);
    const signature = JSON.stringify([march.owner, march.sea, march.roster, march.strength]);
    if (!marker || marker.signature !== signature) {
      marker?.model?.dispose();
      marker?.label.remove();
      const markerLabel = this.makeLabel('map3d-label moving', () => this.actions.march(march.id));
      const figures = march.roster.slice().sort((a, b) => b.count - a.count).slice(0, 4);
      if (figures.length === 1 && march.count > 1) figures.push(figures[0]);
      const model = armyModel(this.materials, march.owner, march.color, figures, march.sea, march.id);
      model.scaling.setAll(march.sea ? 1.13 : 1.31);
      marker = { signature, model, label: markerLabel };
      this.marching.set(march.id, marker);
      markerLabel.title = march.roster.map(unit => `${unit.count} × ${unit.name}`).join(' · ');
      markerLabel.setAttribute('aria-label', `Marschverband · ${markerLabel.title}`);
      markerLabel.append(this.count(march.count, march.strength));
      markerLabel.style.setProperty('--province-color', march.color);
    }
    marker.label.dataset.selected = String(this.state?.selectedMarch === march.id);
  }

  sync(state: MapState) {
    this.state = state;
    this.visible.clear();
    this.geometryGroups.clear();
    for (const province of state.provinces) {
      this.visible.set(province.id, province);
      if (province.discovered) {
        const tile = this.world.lookup[province.id];
        const group = `${tile.continent}/${tile.col >> 3}/${tile.row >> 3}`;
        if (!this.geometryGroups.has(group)) this.geometryGroups.set(group, []);
        this.geometryGroups.get(group)!.push(province);
      }
      this.updateProvince(province);
    }
    this.refreshTerrain();
    this.refreshBorders(state);
    const detailProps = (prop: 'rock' | 'tree' | 'birch', biomes: string[], maximum: number) => state.provinces
      .filter(province => province.visible && province.discovered && biomes.includes(this.world.lookup[province.id].biome))
      .slice(0, maximum)
      .flatMap(province => {
        const tile = this.world.lookup[province.id];
        const count = prop === 'tree' ? 3 : 2;
        return Array.from({ length: count }, (_, index) => {
          const seed = tile.seed + 31 * (1 + index);
          const theta = random(seed) * Math.PI * 2;
          const radius = .62 * this.world.radius;
          return {
            id: `${prop}/${tile.id}/${index}`, angle: theta,
            size: prop === 'rock' ? .30 + random(seed + 4) * .28 : prop === 'tree'
              ? .15 + random(seed + 4) * .17 : .21 + random(seed + 4) * .27,
            position: this.relief.point(tile, tile.x + Math.cos(theta) * radius, tile.y + Math.sin(theta) * radius, -.015),
          };
        });
      });
    this.rocks.sync(detailProps('rock', ['mountain', 'highland', 'tundra', 'desert', 'steppe'], 24));
    this.trees.sync(detailProps('tree', ['taiga', 'jungle'], 16));
    this.birches.sync(detailProps('birch', ['forest'], 16));
    const dragons = state.provinces
      .filter(province => province.visible && province.discovered && province.encounter === 'dragon')
      .slice(0, 10)
      .map(province => {
        const tile = this.world.lookup[province.id];
        return { id: `dragon/${tile.id}`, position: this.relief.point(tile, tile.x, tile.y, .16),
          size: .143, angle: random(tile.seed) * Math.PI * 2 };
      });
    if (dragons.length) this.dragons ??= new Props('summer-dragon', this.scene.scene, null, 'Idle');
    this.dragons?.sync(dragons);
    for (const [id, marker] of this.marks) {
      if (this.visible.has(id)) continue;
      marker.model?.dispose();
      marker.label.remove();
      this.marks.delete(id);
    }
    state.marches.forEach(march => this.updateMarch(march));
    const current = new Set(state.marches.map(march => march.id));
    for (const [id, marker] of this.marching) {
      if (current.has(id)) continue;
      marker.model?.dispose();
      marker.label.remove();
      this.marching.delete(id);
    }
    this.canvas.dataset.provinces = String(state.provinces.filter(p => p.discovered).length);
    this.canvas.dataset.cities = String(state.provinces.filter(p => p.city).length);
    this.canvas.dataset.marches = String(state.marches.length);
  }

  private project(label: HTMLElement, point: Vector3) {
    const { engine, scene, camera } = this.scene;
    const p = Vector3.Project(point, Matrix.IdentityReadOnly, scene.getTransformMatrix(),
      camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
    const x = p.x * this.canvas.clientWidth / engine.getRenderWidth();
    const y = p.y * this.canvas.clientHeight / engine.getRenderHeight();
    label.hidden = p.z < 0 || p.z > 1 || x < 12 || y < 13 || x > this.canvas.clientWidth - 12 || y > this.canvas.clientHeight - 14;
    if (!label.hidden) { label.style.left = `${x}px`; label.style.top = `${y}px`; }
  }

  private marchPosition(march: March, tick: number) {
    const a = this.world.lookup[march.from], b = this.world.lookup[march.to];
    const p = clamp((tick - march.started) / Math.max(1, march.due - march.started));
    const progress = march.returning ? 1 - march.turnaround * (1 - p) : p;
    const x = a.x + (b.x - a.x) * progress;
    const y = a.y + (b.y - a.y) * progress + (march.sea ? Math.sin(progress * Math.PI) * 19 : 0);
    const tile = this.relief.nearest(x, y);
    return new Vector3(x * SCALE, (tile && (!march.sea || progress < .12 || progress > .9) ? this.relief.height(tile, x, y) : 0) + .05, -y * SCALE);
  }

  private frame() {
    if (!this.canvas.clientWidth || !this.canvas.clientHeight || document.hidden) { this.keys.clear(); this.lastFrame = 0; return; }
    const now = performance.now();
    const dt = this.lastFrame ? Math.min(.066, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    let x = 0, y = 0;
    for (const key of this.keys) { x += panKeys[key][0]; y += panKeys[key][1]; }
    if (x || y) {
      const stride = 610 * dt / Math.hypot(x, y);
      this.pan(x * stride, y * stride);
    }
    if (this.move) {
      const { from, to, radius, goal, start, duration } = this.move;
      const t = clamp((now - start) / duration);
      const eased = t * t * (3 - 2 * t);
      Vector3.LerpToRef(from, to, eased, this.camera.target);
      this.camera.radius = radius * Math.pow(goal / radius, eased);
      if (t === 1) this.move = undefined;
    }
    const target = this.camera.target;
    target.x = clamp(target.x, 0, this.world.bounds.width * SCALE);
    target.z = clamp(target.z, -this.world.bounds.height * SCALE, 0);
    this.updateWater(now);
    this.surf.setFloat('time', now / 1000);
    const tick = this.actions.tick(now);
    const activeTrails = new Set<number>();
    for (const march of this.state?.marches || []) {
      const model = this.marching.get(march.id)?.model;
      if (!model) continue;
      const position = this.marchPosition(march, tick);
      const moving = Vector3.DistanceSquared(position, model.position) > .000001;
      model.position.copyFrom(position);
      const a = this.world.lookup[march.from], b = this.world.lookup[march.to];
      model.rotation.y = Math.atan2(-(b.x - a.x), b.y - a.y);
      model.rotation.z = march.sea ? Math.sin(tick * 1.4 + march.id) * .035 : 0;
      if (!march.sea) animateMarch(model,this.reducedMotion.matches?0:tick*10+march.id,
        this.camera.radius < 69 && Vector3.DistanceSquared(position,target) < this.camera.radius ** 2);
      if (!this.reducedMotion.matches && this.camera.radius < 66 && activeTrails.size < 12
        && Vector3.DistanceSquared(position,target) < this.camera.radius ** 2 && !march.roster.every(troop => troop.role === 'air')) {
        this.marchTrail(march.id, march.sea, position, +moving, march.count);
        activeTrails.add(march.id);
      }
    }
    for (const [id, trail] of this.trailEffects) if (!activeTrails.has(id)) {
      trail.cloud.dispose(false);
      this.trailEffects.delete(id);
    }
    this.scene.scene.render();
    if (now - this.lastLabelFrame < 29) return;
    this.lastLabelFrame = now;
    this.drawRoutes();
    const radius = this.camera.radius;
    const centre = this.camera.target;
    const viewKey = [centre.x, centre.z, radius].map(value => Math.round(value * 3)).join('/');
    if (viewKey !== this.viewKey) {
      this.viewKey = viewKey;
      this.actions.view(centre.x / SCALE, -centre.z / SCALE, radius / SCALE);
    }
    for (const [id, marker] of this.marks) {
      const province = this.visible.get(id)!;
      const important = province.id === this.state?.selected || province.reachable || province.city;
      if (!important && (radius > 58 || !province.visible && !province.own
        || !province.own && !province.count && !province.encounter)) { marker.label.hidden = true; continue; }
      const tile = this.world.lookup[id];
      this.project(marker.label, this.relief.point(tile, tile.x, tile.y, province.city ? 2.16 : .43));
    }
    for (const marker of this.marching.values()) {
      if (!marker.model) continue;
      this.project(marker.label, marker.model.position.add(new Vector3(0, 1.62, 0)));
    }
  }

  dispose() {
    this.events.abort();
    this.rocks.dispose();
    this.trees.dispose();
    this.birches.dispose();
    this.dragons?.dispose();
    for (const trail of this.trailEffects.values()) trail.cloud.dispose(false);
    this.trailTexture?.dispose();
    this.scene.dispose();
    this.labels.replaceChildren();
  }
}

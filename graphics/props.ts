import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { InstantiatedEntries } from '@babylonjs/core/assetContainer';
import type { Scene } from '@babylonjs/core/scene';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import '@babylonjs/loaders/glTF/glTFFileLoader';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_texture_transform';
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_ior';
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_specular';
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_emissive_strength';

export type PropKind = 'namaqualand-boulder' | 'pine-sapling' | 'fir-sapling' | 'castle-gate' | 'castle-watch' | 'cut-timber'
  | 'summer-birch' | 'summer-smithy' | 'summer-sawmill' | 'summer-dragon';

export interface Placement {
  id: string;
  position: Vector3;
  size: number;
  angle: number;
  site?: string;
  onReady?: () => void;
}

export class Props {
  private scenery: TransformNode | undefined;
  private template: AssetContainer | undefined;
  private placements: Placement[] = [];
  private meshes = new Map<string, { instance: TransformNode; entries: InstantiatedEntries }>();
  private disposed = false;

  constructor(kind: PropKind, scene: Scene, private shadows?: ShadowGenerator | null, private animation?: string) {
    this.scenery = new TransformNode(kind, scene);
    void LoadAssetContainerAsync(`assets/3d/${kind}.glb`, scene).then(container => {
      if (this.disposed) { container.dispose(); return; }
      this.template = container;
      this.sync(this.placements);
    }).catch(error => {
      if (!this.disposed) console.warn(`Das Dekorationsmodell ${kind} konnte nicht geladen werden.`, error);
    });
  }

  sync(placements: Placement[]) {
    this.placements = placements;
    if (!this.template || !this.scenery) return;
    const keep = new Set(placements.map(placement => placement.id));
    for (const [id, { instance, entries }] of this.meshes) {
      if (keep.has(id)) continue;
      entries.dispose();
      instance.dispose();
      this.meshes.delete(id);
    }
    for (const placement of placements) {
      if (this.meshes.has(placement.id)) continue;
      const instance = new TransformNode(placement.id, this.scenery.getScene());
      instance.parent = this.scenery;
      instance.position.copyFrom(placement.position);
      instance.scaling.setAll(placement.size);
      instance.rotation.y = placement.angle;
      const entries = this.template.instantiateModelsToScene(name => `${placement.id}/${name}`);
      entries.rootNodes.forEach(node => { node.parent = instance; });
      instance.getChildMeshes().forEach(mesh => {
        mesh.isPickable = Boolean(placement.site);
        if (placement.site) mesh.metadata = { ...mesh.metadata, site: placement.site };
        mesh.receiveShadows = true;
        this.shadows?.addShadowCaster(mesh);
      });
      entries.animationGroups.find(group => group.name === `${placement.id}/${this.animation}`)?.start(true);
      this.meshes.set(placement.id, { instance, entries });
      placement.onReady?.();
    }
  }

  dispose() {
    this.disposed = true;
    this.sync([]);
    this.scenery?.dispose();
    this.scenery = undefined;
    this.template?.dispose();
  }
}

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Materials, type Surface } from './scene';
import type { Troop } from './types';

type Motion = (time: number) => void;
type Paint = [string, Surface?];
const armor: Paint = ['#596166', 'iron'];
const leather: Paint = ['#5e4833', 'cloth'];
const wood: Paint = ['#826649', 'oldWood'];
const shell: Paint = ['#797d47', 'chitin'];
const hoof: Paint = ['#4a3c31'];
const metalAges = new Set(['spear','guard','knight','iron','rifle','exosuit']);
const machines = new Set(['tank','carrier','mech','artillery','drone','orbital','siege']);
const animations = new WeakMap<TransformNode,{ motions:Motion[]; units:TransformNode[]; detailed:boolean }>();

export function animateMarch(root: TransformNode, time: number, detailed: boolean) {
  const formation = animations.get(root);
  if (!formation) return;
  if (formation.detailed !== detailed) {
    formation.detailed = detailed;
    for (const unit of formation.units) unit.setEnabled(detailed);
  }
  if (detailed) for (const motion of formation.motions) motion(time);
}

export function marchingFormation(materials: Materials, faction: string, tint: string, troops: Troop[], id: number) {
  const root = new TransformNode('Marschverband', materials.scene);
  const motions: Motion[] = [];
  const joint = (name: string, parent: TransformNode, x: number, y: number, z: number) => {
    const node = new TransformNode(name, materials.scene);
    node.parent = parent;
    node.position.set(x,y,z);
    return node;
  };
  const finish = (mesh: Mesh, node: TransformNode, paint: Paint, x: number, y: number, z: number) => {
    mesh.parent = node;
    mesh.position.set(x,y,z);
    mesh.material = materials.get(paint[0], false, paint[1]);
    mesh.metadata = { march: id };
    return mesh;
  };
  const oval = (node: TransformNode, paint: Paint, x: number, y: number, z: number, w: number, h: number, d: number) => {
    const mesh = finish(CreateSphere('Profil', { diameter:1, segments:7 }, materials.scene), node, paint, x,y,z);
    mesh.scaling.set(w,h,d);
    return mesh;
  };
  const box = (node: TransformNode, paint: Paint, x: number, y: number, z: number, w: number, h: number, d: number) =>
    finish(CreateBox('Beschlag', { width:w, height:h, depth:d }, materials.scene), node, paint, x,y,z);
  const shaft = (node: TransformNode, paint: Paint, x: number, y: number, z: number, h: number, top: number, bottom: number) =>
    finish(CreateCylinder('Segment', { height:h, diameterTop:top, diameterBottom:bottom,tessellation:7 }, materials.scene), node, paint, x,y,z);
  const banner = joint('Standarte',root,0,0,.43);
  shaft(banner,wood,0,.70,0,1.4,.025,.038);
  box(banner,[tint,'cloth'],.18,1.24,0,.37,.21,.029);

  function soldier(node: TransformNode, unit: Troop, seated = false): Motion {
    const armed = metalAges.has(unit.id) || unit.role === 'heavy';
    const skin: Paint = [({grak:'#77815b',veil:'#adb5bf',root:'#80664a',pam:'#aa8ba1'} as Record<string,string>)[faction] || '#bd926c'];
    const tunic: Paint = [tint,'cloth'];
    const cloth: Paint = armed ? armor : leather;
    const chest = joint('Brust und Ausrüstung',node,0,seated?.55:.64,0);
    oval(chest,tunic,0,.17,0,.36,.41,.24);
    oval(chest,cloth,0,.20,-.045,.34,.29,.20);
    box(chest,leather,0,.015,-.112,.35,.058,.066);
    box(chest,armor,.026,.014,-.151,.072,.066,.026);
    for (const side of [-1,1]) oval(chest,cloth,.175*side,.28,.014,.16,.15,.18);
    const cloak = oval(chest,tunic,-.045,.12,.13,.30,.49,.078);
    cloak.rotation.x = -.24;
    const head = joint('Kopf',chest,0,.43,-.014);
    oval(head,skin,0,.029,0,.16,.21,.174);
    oval(head,skin,0,.015,-.084,.064,.079,.065);
    oval(head,armed?armor:leather,0,.103,.014,.192,.117,.191);
    if(armed) shaft(head,armor,0,.055,0,.046,.205,.198);
    const arms = [-1,1].map(side=>{
      const arm = joint('Schulter',chest,side*.201,.265,0);
      oval(arm,cloth,0,-.106,0,.114,.27,.145);
      const elbow = joint('Ellbogen',arm,0,-.20,0);
      elbow.rotation.x = -.34;
      oval(elbow,armed?cloth:skin,0,-.092,0,.096,.196,.103);
      oval(elbow,skin,0,-.183,0,.078,.089,.078);
      if(side===1){
        const spear=unit.role==='spear';
        const ranged=unit.role==='ranged'||unit.id==='rifle';
        if(ranged) {
          const barrel=shaft(elbow,wood,.018,-.12,-.12,.48,.041,.052);
          barrel.rotation.x = Math.PI/2;
          if(unit.id==='rifle')shaft(elbow,armor,.018,-.101,-.265,.34,.026,.026).rotation.x=Math.PI/2;
        } else {
          const handle=shaft(elbow,wood,.02,-.13,-.15,spear?1.05:.48,spear?.04:.079,.040);
          handle.rotation.x=-.34;
          if(spear)shaft(elbow,armor,.02,.37,-.325,.19,.003,.089).rotation.x=-.34;
          else oval(elbow,armed?armor:wood,.014,.062,-.209,.105,.142,.111);
        }
      } else if (armed) {
        oval(elbow,wood,-.023,-.10,-.099,.273,.37,.091);
        oval(elbow,armor,-.023,-.10,-.150,.089,.097,.050);
      }
      return arm;
    });
    const legs = [-1,1].map(side=>{
      const upper = joint('Hüfte',node,side*.096,.64,0);
      oval(upper,leather,0,-.132,0,.146,.31,.159);
      const knee = joint('Knie',upper,0,-.264,0);
      oval(knee,cloth,0,-.135,0,.122,.31,.136);
      oval(knee,leather,0,-.293,-.042,.128,.106,.202);
      return {upper,knee};
    });
    return t=>{
      const step=Math.sin(t);
      chest.position.y=(seated?.55:.64)+Math.abs(step)*.035;
      chest.rotation.y=step*.10;
      head.rotation.y=-chest.rotation.y*.7;
      for(let i=0;i<2;i++){
        const leg=legs[i], stride=step*(i?1:-1);
        leg.upper.rotation.x=seated?-1.1:stride*.64;
        leg.knee.rotation.x=seated?.93:Math.max(0,-stride)*.78;
        arms[i].rotation.x=seated?-.57:stride*-.48-(unit.role==='spear'?.31:.10);
      }
    };
  }

  function mount(node: TransformNode, unit: Troop): Motion {
    const coat: Paint = ['#897051','cloth'];
    oval(node,coat,0,.70,.032,.38,.43,.84);
    oval(node,leather,0,.85,.058,.40,.13,.36);
    const neck=oval(node,coat,0,.91,-.29,.24,.55,.24);
    neck.rotation.x=-.42;
    oval(node,coat,0,1.08,-.47,.20,.23,.34);
    for(const side of [-1,1])shaft(node,coat,side*.067,1.21,-.36,.15,.025,.084).rotation.z=side*.17;
    const legs=[-.26,.27].flatMap((z,i)=>[-1,1].map((side,j)=>{
      const jointNode=joint('Hengstlauf',node,side*.136,.66,z);
      oval(jointNode,coat,0,-.164,0,.13,.34,.15);
      const fetlock=joint('Fessel',jointNode,0,-.30,.018);
      shaft(fetlock,hoof,0,-.128,0,.264,.10,.079);
      oval(fetlock,hoof,0,-.278,-.027,.11,.093,.148);
      return {jointNode,fetlock,phase:(i+j)*Math.PI*.83};
    }));
    const rider=joint('Reiter',node,0,.43,.035);
    rider.scaling.setAll(.76);
    const pose=soldier(rider,unit,true);
    return t=>{
      pose(t);
      for(const leg of legs){
        const step=Math.sin(t+leg.phase);
        leg.jointNode.rotation.x=step*.65;
        leg.fetlock.rotation.x=Math.max(0,-step)*.75;
      }
    };
  }

  function insect(node: TransformNode, airborne: boolean, heavy: boolean): Motion {
    const height=airborne?.72:.43;
    const width=heavy?.47:.34;
    oval(node,shell,0,height+.09,.10,width,.44,.73);
    oval(node,shell,0,height+.16,-.30,width*.65,.25,.27);
    const legs=[-.26,.02,.27].flatMap((z,i)=>[-1,1].map(side=>{
      const leg=joint('Chitingelenk',node,side*width*.40,height,z);
      shaft(leg,shell,side*.081,-.117,0,.29,.095,.054).rotation.z=side*.60;
      shaft(leg,leather,side*.171,-.315,0,.25,.066,.035).rotation.z=-side*.15;
      return {leg,phase:(i+(side+1)/2)*Math.PI};
    }));
    const wings=[-1,1].map(side=>oval(node,shell,side*width*.44,height+.27,.14,width*.65,.072,.57));
    return t=>{
      for(const {leg,phase} of legs)leg.rotation.x=Math.sin(t+phase)*.48;
      wings.forEach((wing,i)=>wing.rotation.z=(i?1:-1)*(airborne?Math.sin(t*4)*.75:.14));
    };
  }

  function machine(node: TransformNode, unit: Troop): Motion {
    if(unit.role==='air'){
      oval(node,armor,0,.89,0,.38,.20,.72);
      oval(node,[tint,'iron'],0,.99,-.07,.22,.15,.31);
      const rotors=[-1,1].map(side=>{
        box(node,armor,side*.31,.87,0,.64,.062,.24).rotation.y=side*.21;
        const rotor=joint('Rotor',node,side*.37,.97,.04);
        box(rotor,armor,0,0,0,.49,.023,.061);
        if(unit.id==='orbital')box(node,[tint,'iron'],side*.245,.86,.28,.13,.12,.32);
        return rotor;
      });
      return t=>rotors.forEach((rotor,i)=>rotor.rotation.y=t*7*(i?1:-1));
    }
    const siege=unit.role==='siege';
    const primitive=unit.id==='siege';
    const hull:Paint=primitive?wood:[tint,'iron'];
    box(node,hull,0,.30,.03,.62,.25,.85);
    oval(node,hull,0,.46,-.026,.54,.21,.69);
    const wheels=[-.29,.29].flatMap(x=>[-.27,0,.27].map(z=>{
      const wheel=joint('Laufrad',node,x,.16,z);
      shaft(wheel,primitive?wood:armor,0,0,0,.14,.29,.29).rotation.z=Math.PI/2;
      box(wheel,leather,.071,0,0,.028,.220,.044);
      return wheel;
    }));
    const barrel=shaft(node,primitive?wood:armor,0,siege?.67:.56,-.24,primitive?.79:.62,.085,.13);
    barrel.rotation.x=primitive?-.64:Math.PI/2+.16;
    if(siege)for(const side of [-1,1])shaft(node,hull,side*.19,.51,.18,.48,.053,.084).rotation.x=.48;
    return t=>wheels.forEach(wheel=>wheel.rotation.x=t*.77);
  }

  const formation = troops.slice(0,4);
  const units=formation.map((unit,index)=>{
    const person=joint(unit.name,root,(index-(formation.length-1)/2)*.64,0,index%2*.33);
    const rig=faction==='insect'&&(!machines.has(unit.id)||unit.role==='air')
      ? insect(person,unit.role==='air',unit.id==='elite'||unit.role==='heavy')
      : machines.has(unit.id)?machine(person,unit):unit.id==='horse'?mount(person,unit):soldier(person,unit);
    motions.push(t=>rig(t+index*1.74));
    return person;
  });
  animations.set(root,{motions,units,detailed:true});
  return root;
}

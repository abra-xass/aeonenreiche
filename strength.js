// Völkerstärke: wie viele Einheiten braucht ein Volk (Angriff) bzw. sein Gegner (Verteidigung) für 50 % Siegchance?
// Aufruf: node strength.js
const Engine=require('./engine');
const World=require('./world');
const {map,neighbors,peoples}=World;
const base=Engine.create([],'standard');
const cross=new Set(World.crossings.flat());
const tileFor={};
for(const tile of map) if(!tileFor[tile.biome]&&!tile.capital&&neighbors[tile.id].length===6&&neighbors[tile.id].every(id=>!cross.has(id))) tileFor[tile.biome]=tile;
const techs=['bronze','masonry','steel','cartography'];
const mix=(sig,scale)=>{
  const comp={rifle:6,guard:sig?2:5,archer:4,knight:3,artillery:1,tank:1};
  if(sig) comp['sig-unit-'+sig]=3;
  return Object.fromEntries(Object.entries(comp).map(([k,v])=>[k,Math.max(1,Math.round(v*scale))]));
};
function duel({attacker,defender,attackSig,defendSig,biome,wall,attackScale,defendScale,attackBlessing,defendBlessing}){
  const g=JSON.parse(JSON.stringify(base));
  const target=tileFor[biome];
  const [from]=neighbors[target.id].filter(id=>!cross.has(id));
  for(const id of [target.id,...neighbors[target.id]]){g.tiles[id].army={};g.tiles[id].owner=null;g.tiles[id].dragon=null;}
  g.tiles[target.id].owner=defender;g.tiles[target.id].army=mix(defendSig,defendScale);g.tiles[target.id].sites={hall:1,wall};
  if(defendBlessing)g.tiles[target.id].blessing={style:defender,rank:1,started:0,due:99999};
  g.tiles[from].owner=attacker;
  for(const id of [attacker,defender]){g.factions[id].tech=[...techs];g.factions[id].stock.food=500;}
  const visible=new Set(Object.keys(g.tiles));
  return Engine.battle(g,attacker,mix(attackSig,attackScale),target.id,attackBlessing?attacker:undefined,0,1,undefined,{from,visible}).chance;
}
const search=f=>{for(let s=.3;s<=4;s+=.05) if(f(s)>=.5) return s; return 4;};
const refA='aurel',refSigNone=undefined;
const biomes=['plain','forest','mountain','steppe','jungle'];
const rows=[];
for(const folk of peoples){
  let atk=0,def=0;
  for(const biome of biomes){
    // Angriff: Volk gegen Referenz-Garnison (Orks, ohne Segen, ohne Signatur), 20 Einheiten
    atk+=1/search(s=>duel({attacker:folk.id,defender:'grak',attackSig:folk.id,defendSig:undefined,biome,wall:1,attackScale:s,defendScale:1,attackBlessing:true}));
    // Verteidigung: Referenz-Angreifer (Orks, ohne Segen) gegen Garnison des Volks mit Segen und Signatur
    def+=search(s=>duel({attacker:'grak',defender:folk.id,attackSig:undefined,defendSig:folk.id,biome,wall:1,attackScale:s,defendScale:1,defendBlessing:true}));
  }
  rows.push({id:folk.id,atk:atk/biomes.length,def:def/biomes.length});
}
const mean=k=>rows.reduce((s,r)=>s+r[k],0)/rows.length;
const ma=mean('atk'),md=mean('def');
console.log('Volk       Angriff   Verteidigung   Gesamt (Mittel = 1,00)');
for(const r of rows) console.log(r.id.padEnd(9),(r.atk/ma).toFixed(2).padStart(8),(r.def/md).toFixed(2).padStart(13),(((r.atk/ma)+(r.def/md))/2).toFixed(2).padStart(10));

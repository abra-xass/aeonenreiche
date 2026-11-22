// Gefechts-Messung: Wie viele Angreifer braucht man (Siegchance >= 50 %) gegen eine feste Verteidigung?
// Aufruf: node duel.js            (Standardtabelle)
//         node duel.js units      (Einheit-gegen-Einheit bei gleichen Kosten)
const Engine=require('./engine');
const World=require('./world');
const {map,neighbors,units,peoples}=World;

const game=Engine.create([],'standard');
const biomeTile={};
for(const tile of map) if(!biomeTile[tile.biome]&&!tile.capital&&neighbors[tile.id].length===6&&neighbors[tile.id].every(id=>!World.crossings.flat().includes(id))) biomeTile[tile.biome]=tile;

const unitById=id=>units.find(unit=>unit.id===id);
const total=cost=>Object.values(cost).reduce((sum,value)=>sum+value,0);

function setup({biome='plain',wall=0,flank=0,attackTech=[],defendTech=[],defender='grak',attacker='aurel',defenders,flankUnits}){
  const g=JSON.parse(JSON.stringify(game));
  const target=biomeTile[biome]||biomeTile.plain;
  const [from,side]=neighbors[target.id].filter(id=>!World.crossings.flat().includes(id));
  for(const id of [target.id,...neighbors[target.id]]){g.tiles[id].army={};g.tiles[id].owner=null;g.tiles[id].dragon=null;}
  g.tiles[target.id].owner=defender;
  g.tiles[target.id].army={...defenders};
  g.tiles[target.id].sites={hall:1,...(wall?{wall}:{})};
  g.factions[attacker].tech=[...attackTech];
  g.factions[defender].tech=[...defendTech];
  g.factions[attacker].stock.food=500;g.factions[defender].stock.food=500;
  g.tiles[from].owner=attacker;
  if(flank){
    const helpers=neighbors[target.id].filter(id=>id!==from&&!World.crossings.flat().includes(id)).slice(0,flank);
    for(const id of helpers){g.tiles[id].owner=defender;g.tiles[id].army={...(flankUnits||defenders)};}
  }
  return {g,target,from};
}

function needed(config,unit,defenders){
  const {g,target,from}=setup({...config,defenders:{[unit]:defenders}});
  const visible=new Set(Object.keys(g.tiles));
  let low=1,high=defenders*6;
  for(let n=1;n<=high;n++){
    const {chance}=Engine.battle(g,config.attacker||'aurel',{[unit]:n},target.id,undefined,0,1,undefined,{from,visible});
    if(chance>=.5)return n;
  }
  return Infinity;
}

const unitsToTest=['club','spear','knight','archer','rifle','tank'];
const age={club:[],spear:['bronze'],knight:['bronze','masonry'],archer:['bronze','masonry'],rifle:['bronze','masonry','steel'],tank:['bronze','masonry','steel']};
const rows=[];
const scenarios=[
  ['Ebene, keine Mauer, keine Flanke',{biome:'plain'}],
  ['Ebene, Mauer 1, keine Flanke',{biome:'plain',wall:1}],
  ['Ebene, Mauer 1, 1 Flanke (gleich stark)',{biome:'plain',wall:1,flank:1}],
  ['Wald, Mauer 2, 1 Flanke',{biome:'forest',wall:2,flank:1}],
  ['Gebirge, Mauer 3, 2 Flanken',{biome:'mountain',wall:3,flank:2}],
  ['Dschungel, Mauer 3, 2 Flanken',{biome:'jungle',wall:3,flank:2}],
];
if(process.argv[2]==='units'){
  console.log('Angreifer-Zahl für 50 % Siegchance gegen 20 gleiche Verteidiger (gleiche Technik beider Seiten):');
  for(const unit of unitsToTest){
    const out=[];
    for(const [label,config] of scenarios){
      const tech=age[unit];
      const n=needed({...config,attackTech:tech,defendTech:tech},unit,20);
      out.push(`${(n/20).toFixed(2)}×`);
    }
    console.log(unit.padEnd(8),out.join('  '));
  }
  console.log('Spalten:',scenarios.map(([label])=>label).join(' | '));
} else {
  console.log('Faktor = nötige Angreifer / Verteidiger (gleicher Einheitentyp, gleiche Technik). Ziel: etwa 1,3 bis 1,6 im Alltag.');
  for(const [label,config] of scenarios){
    const factors=['spear','knight','rifle'].map(unit=>{
      const tech=age[unit];
      return `${unit} ${(needed({...config,attackTech:tech,defendTech:tech},unit,20)/20).toFixed(2)}×`;
    });
    console.log(label.padEnd(42),factors.join('   '));
  }
}

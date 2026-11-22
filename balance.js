const {create,advance,owned,economy,difficulties}=require('./engine');
const {peoples}=require('./world');

const runs=Number(process.argv[2]||5);
const limit=Number(process.argv[3]||600);
const level=process.argv[4]||'standard';
if(!Number.isInteger(runs)||runs<1||runs>50||!Number.isInteger(limit)||limit<1||limit>4000||!Object.hasOwn(difficulties,level)){
  console.error('Usage: node balance.js [runs: 1–50] [ticks: 1–4000] [relaxed|standard|veteran]');
  process.exitCode=1;
  return;
}
const results=Object.fromEntries(peoples.map(folk=>[folk.id,{wins:0,age:0,provinces:0,capitals:0,supply:0,food:0}]));
let inconclusive=0;
for(let run=1;run<=runs;run++){
  let seed=run;
  const sample=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const game=create([],level);
  while(game.tick<limit&&!game.winner) advance(game,sample);
  if(!game.winner) inconclusive++;
  else results[game.winner].wins++;
  const summary=peoples.map(({id})=>{
    const provinces=owned(game,id);
    const capitals=provinces.filter(tile=>game.tiles[tile.id].sites.hall).length;
    const ledger=economy(game,id,provinces);
    const stats=results[id];
    stats.age+=game.factions[id].age+1;
    stats.provinces+=provinces.length;
    stats.capitals+=capitals;
    stats.supply+=ledger.supplyUsed;
    stats.food+=ledger.net.food;
    return `${id}:${provinces.length}/${capitals}/A${game.factions[id].age+1}`;
  });
  console.log(`Seed ${run} · Takt ${game.tick} · ${game.winner||'offen'} · ${summary.join(' ')}`);
}
console.log(`${inconclusive}/${runs} Partien ohne Sieg bis zum Taktlimit. Reihenfolge: Provinzen / Städte / Zeitalter.`);
for(const stats of Object.values(results)) for(const key of Object.keys(stats)) if(key!=='wins') stats[key]=Number((stats[key]/runs).toFixed(1));
console.table(results);

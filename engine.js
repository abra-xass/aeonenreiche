(() => {
  const world = typeof module !== 'undefined' ? require('./world') : globalThis.World;
  const {peoples,ages,eraCost,milestones,terrain,buildings,buildingTech,buildingTime,units,unitTech,techs,technologyLinks,durationByAge,factions,governments,faiths,resources,roles,matchups,counters,map,neighbors,lookup,crossings} = world;
  const byId = (list,id) => list.find(item => item.id===id);
  const count = (army) => Object.values(army || {}).reduce((sum,amount) => sum+amount,0);
  const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
  const relationKey = (first,second) => [first,second].sort().join('/');
  const relation = (game,first,second) => game.relations[relationKey(first,second)] || 'peace';
  const owned = (game,faction) => map.filter(tile => game.tiles[tile.id].owner===faction);
  const owns = (game,faction,building) => owned(game,faction).some(tile => game.tiles[tile.id].sites[building]);
  const seaRoute = (first,second)=>crossings.some(([from,to])=>from===first&&to===second||from===second&&to===first);
  const offerTerms=(game,first,second)=>{
    const offer=game.offers[relationKey(first,second)];
    return offer&&(offer.until??Infinity)>game.tick?offer:null;
  };
  const amulets={ember:['Glutamulett','infantry'],wind:['Sturmamulett','ranged'],stone:['Felsamulett','heavy'],fang:['Fangamulett','mobile'],veil:['Nebelamulett','air']};
  const difficulties={
    relaxed:{label:'Entspannt',description:'Späte Kriege, langsame Ausbreitung und geringere Versorgungskosten.',interval:5,truce:240,claimGap:46,attackGap:55,targetGap:45,mobilize:32,risk:.10},
    standard:{label:'Standard',description:'Fünf Minuten bis zu KI-Kriegserklärungen, danach mit Vorwarnzeit und Angriffspausen.',interval:3,truce:150,claimGap:30,attackGap:38,targetGap:30,mobilize:20,risk:0},
    veteran:{label:'Veteran',description:'Früherer Druck, riskantere Angriffe und höherer Unterhalt für alle Reiche.',interval:2,truce:36,claimGap:6,attackGap:0,targetGap:0,mobilize:0,risk:-.08},
  };
  const difficulty=(game)=>difficulties[game.difficulty]||difficulties.standard;
  const upkeepRules={relaxed:[8,12,28,5,2],standard:[6,9,30,4,3],veteran:[5,8,18,3,4]};
  const economyInterval=(game)=>(upkeepRules[game.difficulty]||upkeepRules.standard)[4];
  const defeated=(game,id)=>Object.hasOwn(game.eliminated||{},id);
  const capitalInCampaign=(game,tile)=>tile.capital&&(!game.roster||game.roster.includes(tile.owner));
  const heroLevel=(xp=0)=>1+Math.min(4,Math.floor(xp/4));
  const veteranLevel=(xp=0)=>xp>=75?3:xp>=45?2:xp>=20?1:0;
  const raidCooldown=18;
  const raidDuration=150;
  const scoutReportTicks=12;
  function sight(game,id) {
    const visible=new Set();
    const state=game.factions[id];
    const reveal=(place,range)=>{
      let frontier=[place];
      const visited=new Set(frontier);
      for(let ring=0;ring<=range;ring++){
        const next=[];
        for(const tile of frontier){
          visible.add(tile);
          for(const neighbor of neighbors[tile]) if(!visited.has(neighbor)&&!seaRoute(tile,neighbor)){
            visited.add(neighbor);
            next.push(neighbor);
          }
        }
        frontier=next;
      }
    };
    for(const tile of owned(game,id)){
      const local=game.tiles[tile.id];
      reveal(tile.id,1+Number(Boolean(local.sites.watch||local.army.scout||id==='pam'&&local.army[factions[id].unit]))+Number(Boolean(local.sites.watch&&state.tech.includes('optics'))));
    }
    for(const [tile,until] of Object.entries(state.scouted)) if(until>game.tick) reveal(tile,1);
    for(const march of game.marches) if(march.owner===id&&!march.scout&&!seaRoute(march.from,march.to)) reveal(march.to,0);
    return visible;
  }
  function revealMap(game,id,visible=sight(game,id)){
    const explored=game.factions[id].explored;
    for(const place of visible) {
      const tile=game.tiles[place];
      explored[place]={owner:tile.owner,city:Boolean(tile.sites.hall),dragon:tile.dragon,treasure:tile.treasure,seen:game.tick};
    }
    return visible;
  }
  function view(game,id,since=0) {
    const visible=revealMap(game,id);
    const explored=game.factions[id].explored;
    const blank={owner:null,army:{},sites:{},build:null,train:null,blessing:null,dragon:null,treasure:false};
    const tiles=Object.fromEntries(map.map(({id:place})=>{
      if(!visible.has(place)) return [place,{...blank,...explored[place]}];
      const tile=game.tiles[place];
      if(!tile.owner||tile.owner===id) return [place,tile];
      const defender=game.factions[tile.owner];
      const relics=Object.fromEntries(Object.keys(roles).map(role=>[role,relicStrength(defender.amulets,role)]));
      const {buildQueue,trainQueue,...visibleTile}=tile;
      return [place,{...visibleTile,defenseProfile:{masonry:defender.tech.includes('masonry'),relics,research:defender.tech.reduce((sum,key)=>sum+({bronze:.08,steel:.16,fusion:.20}[key]||0),0)}}];
    }));
    const knownPairs=(entries)=>Object.fromEntries(Object.entries(entries).filter(([pair])=>pair.split('/').includes(id)));
    const newEvents=[];
    for(const event of game.events){
      if(event.id<=since)break;
      if(!event.party.length||event.party.includes(id))newEvents.push(event);
    }
    return {...game,tiles,visibility:[...visible],relations:knownPairs(game.relations),offers:knownPairs(game.offers),factions:{[id]:game.factions[id]},marches:game.marches.filter(march=>march.owner===id||visible.has(march.to)&&visible.has(march.from)),expeditions:(game.expeditions||[]).filter(item=>item.owner===id),events:newEvents};
  }
  const unitList = (faction) => {
    const folk = byId(peoples,faction);
    if (!folk) return units.filter(unit=>!unit.faction);
    const style=folk.role;
    const late=style==='air'||faction==='matrix';
    const site=style==='air'?'gate':faction==='matrix'?'factory':style==='siege'?'forge':'barracks';
    const starter={aurel:'Kronenwache',sylva:'Sternenholz-Wächter',grak:'Aschenkeulen',brindle:'Heckenwache',veil:'Nebelwachen',root:'Wurzelhüter',goa:'Sonnenwachen',pam:'Prismengarde',abra:'Basaltwachen',andro:'Sternenhafen-Wache',matrix:'Matrix-Schildknoten',avatar:'Hainwächter',dwarf:'Tiefenhallen-Wache',insect:'Brutwächter'};
    return [...units.filter(unit=>!unit.faction||unit.faction===faction).map(unit=>unit.id==='club'?{...unit,name:starter[faction]}:unit),{id:'elite',name:folk.elite,role:style,age:style==='air'?6:faction==='matrix'?5:3,site,level:site==='barracks'?2:1,atk:late?190:96,def:late?150:78,cost:{food:late?60:45,metal:late?110:60,coin:late?90:55},icon:'✦'}];
  };
  const newFaction=()=>({age:0,stock:{food:175,wood:145,stone:95,metal:22,coin:80,science:8,influence:30},tech:[],study:null,government:'tribe',faith:'none',heroReady:0,heroXP:0,scouted:{},explored:{},amulets:[]});
  function hydrate(game){
    if(!game.nextEventId){
      game.events.forEach((event,index)=>{event.id=game.events.length-index;});
      game.nextEventId=game.events.length+1;
    }
    game.eliminated||={};
    game.expeditions||=[];
    game.roster||=Object.keys(game.factions);
    for(const {id} of peoples) if(!game.factions[id]){
      game.factions[id]=newFaction();
      game.eliminated[id]=game.tick;
    }
    for(const tile of map) if(!game.tiles[tile.id]) game.tiles[tile.id]=tileState(tile);
    for(const region of Object.values(game.tiles)){
      for(const job of [region.build,region.train,region.blessing]) if(job) job.started??=game.tick;
      const job=region.train;
      if(job&&job.key!=='drill'&&!job.ends){
        job.ends=splitTraining(job.due-job.started,job.amount||1).map(end=>job.started+end);
      }
    }
    for(const state of Object.values(game.factions)){
      for(const job of [state.study,state.mentoring]) if(job) job.started??=game.tick;
    }
    if(!game.aiPacing){
      game.aiPacing=1;
      const rules=difficulty(game);
      if(rules.mobilize) for(const [id,state] of Object.entries(game.factions)){
        if(game.humans.includes(id))continue;
        state.nextAttack=Math.max(state.nextAttack||0,game.tick+rules.mobilize);
        state.nextClaim=Math.max(state.nextClaim||0,game.tick+Math.floor(rules.claimGap/2));
      }
    }
    if(game.cityRules!==2) initializeCities(game,true);
    return game;
  }
  const relicStrength=(items,role)=>Math.min(.36,(items||[]).filter(key=>amulets[key]?.[1]===role).length*.12);
  const armyStrength=(owner,army,xp=0)=>Math.round(unitList(owner).reduce((total,unit)=>total+(army[unit.id]||0)*(unit.atk+unit.def)/2,(army.dragon||0)*115)*(1+veteranLevel(xp)*.06));
  function combineArmies(first,xp,second,otherXP){
    const total=count(first)+count(second);
    const army={...first};
    for(const [key,amount] of Object.entries(second))army[key]=(army[key]||0)+amount;
    return {army,xp:total?Math.round((count(first)*(xp||0)+count(second)*(otherXP||0))/total):0};
  }
  const log = (game,text,party = [],type = 'info',detail) => {
    game.events.unshift({id:game.nextEventId++,time:game.tick,text,party,type,...(detail?{detail}:{})});
  };
  function tileState(tile){
    const dragon=!tile.owner&&tile.biome==='mountain'&&tile.seed%7===0?Object.keys(amulets)[tile.seed%5]:null;
    return {owner:tile.owner,army:dragon?{dragon:1}:tile.capital?{club:8,sling:3}:tile.owner?{club:2}:tile.barbarian?{club:4,sling:2}:{club:1},sites:tile.capital?{hall:1,farm:1,barracks:1}:{},build:null,train:null,blessing:null,dragon,treasure:!tile.owner&&!dragon&&tile.seed%17===0};
  }
  const landNeighbors=place=>neighbors[place].filter(other=>!seaRoute(place,other));
  function allocateCity(game,place,footprint){
    game.tiles[place].cityFootprint=footprint;
    for(const member of footprint) game.tiles[member].cityClaim=place;
  }
  function initializeCities(game,migrate=false){
    game.cityRules=2;
    const previous=new Map();
    if(migrate) for(const {id} of map){
      const region=game.tiles[id];
      if(region.cityFootprint)previous.set(id,region.cityFootprint);
      delete region.cityClaim;
      delete region.cityFootprint;
    }
    for(const tile of map.filter(region=>region.capital)){
      const footprint=[tile.id,...landNeighbors(tile.id).filter(place=>lookup[place].owner===tile.owner)];
      allocateCity(game,tile.id,footprint);
    }
    if(!migrate)return;
    const demoted=new Set();
    for(const tile of map){
      if(tile.capital)continue;
      const region=game.tiles[tile.id];
      const {sites,build,train,buildQueue,trainQueue,pendingFoundation}=region;
      if(!Object.keys(sites).length&&!build&&!train&&!buildQueue?.length&&!trainQueue?.length&&!pendingFoundation)continue;
      const footprint=previous.get(tile.id);
      const ring=[tile.id,...landNeighbors(tile.id)];
      const surrounding=new Set(ring.slice(1).flatMap(landNeighbors));
      const valid=footprint?.length===8&&new Set(footprint).size===8&&ring.every(place=>footprint.includes(place))
        &&footprint.every(place=>game.tiles[place]&&!game.tiles[place].cityClaim&&(ring.includes(place)||surrounding.has(place)));
      if(valid&&(sites.hall||pendingFoundation&&build?.key==='hall')){
        allocateCity(game,tile.id,footprint);
        continue;
      }
      if(Object.keys(sites).some(key=>key!=='hall')||sites.hall>1||build||train||buildQueue?.length||trainQueue?.length){
        region.legacyCity={sites,build,train,buildQueue,trainQueue};
      }
      region.sites={};
      region.build=null;
      region.train=null;
      delete region.buildQueue;
      delete region.trainQueue;
      delete region.pendingFoundation;
      demoted.add(tile.id);
    }
    for(const state of Object.values(game.factions)){
      for(const place of demoted)if(state.explored[place])state.explored[place].city=false;
    }
  }
  function create(humans = ['aurel'],level='standard') {
    const game={version:2,tick:0,humans,tiles:Object.fromEntries(map.map(tile=>[tile.id,tileState(tile)])),factions:Object.fromEntries(peoples.map(folk => [folk.id,newFaction()])),marches:[],expeditions:[],relations:{},offers:{},events:[],nextEventId:1,winner:null,nextId:1};
    log(game,'Die Reiche erwachen. Baue deine Hauptstadt aus oder entsende deine erste Armee.');
    game.difficulty=Object.hasOwn(difficulties,level)?level:'standard';
    game.aiPacing=1;
    game.roster=peoples.map(folk=>folk.id);
    game.eliminated={};
    initializeCities(game);
    game.startPeaceUntil=2400;
    for(const first of peoples) for(const second of peoples){
      if(first.id>=second.id)continue;
      const a=map.find(tile=>tile.capital&&tile.owner===first.id),b=map.find(tile=>tile.capital&&tile.owner===second.id);
      if(a&&b&&a.continent===b.continent) game.relations[relationKey(first.id,second.id)]='peace';
    }
    for(const folk of peoples) revealMap(game,folk.id);
    return game;
  }
  const blankLedger=()=>Object.fromEntries(Object.keys(resources).map(key=>[key,0]));
  const supplyWeight={infantry:2,ranged:2,spear:2,mobile:3,heavy:3,siege:4,air:5};
  const supply=(army,entries)=>entries.reduce((total,unit)=>total+(army[unit.id]||0)*(unit.id.startsWith('sig-unit-')?2:supplyWeight[unit.role]),0);
  const terrainYield={
    plain:{food:1,wood:.15},forest:{wood:1,food:.5},taiga:{wood:1,food:.5,stone:.15},jungle:{wood:1,food:.5},mountain:{stone:1},
    marsh:{food:1,wood:.25},coast:{coin:1,food:.4},savanna:{food:1,wood:.25,stone:.15},steppe:{food:1,wood:.2,stone:.2},tundra:{stone:1,food:.25},highland:{stone:1,wood:.25,food:.15},desert:{coin:1,stone:.25},
  };
  function economy(game,faction,domains=owned(game,faction)) {
    const state=game.factions[faction];
    const land=blankLedger(),infrastructure=blankLedger(),policy=blankLedger(),upkeep=blankLedger();
    const has=(key)=>Number(state.tech.includes(key));
    const entries=unitList(faction);
    let supplyUsed=0;
    let activeCities=0;
    let developed=0;
    let occupied=0;
    for(const tile of domains){
      const {sites,army,settledAt}=game.tiles[tile.id];
      supplyUsed+=supply(army,entries);
      {const room=game.tiles[tile.id].sites.hall?50+25*game.tiles[tile.id].sites.hall:30;supplyUsed+=Math.max(0,count(army)-room);}
      if(settledAt>game.tick){occupied++;continue;}
      activeCities++;
      const hall=sites.hall||0;
      if(hall) developed++;
      const bonus=terrainYield[tile.biome]||{};
      land.food+=1+Number(Boolean(hall))+(bonus.food||0);
      land.wood+=Number(Boolean(hall))+(bonus.wood||0);
      land.stone+=Number(Boolean(hall))+(bonus.stone||0);
      land.coin+=Number(Boolean(hall))+(bonus.coin||0);
      land.metal+=Number(tile.biome==='mountain'&&state.age>=1);
      const before={...infrastructure};
      infrastructure.food+=4*(sites.farm||0)+3*(sites.granary||0);
      infrastructure.wood+=3*(sites.lumber||0);
      infrastructure.stone+=3*(sites.quarry||0);
      infrastructure.metal+=3*(sites.mine||0)+5*(sites.foundry||0);
      infrastructure.coin+=3*hall+4*(sites.market||0)+5*(sites.mint||0);
      infrastructure.science+=hall+4*(sites.academy||0)+8*(sites.lab||0)+5*(sites.observatory||0);
      infrastructure.influence+=sites.temple||0;
      const specialty=factions[faction];
      if(specialty) infrastructure[specialty.resource]+=({influence:1,science:2,coin:2,metal:2}[specialty.resource]||3)*(sites[specialty.building]||0);
      if(hall){
        const supporters=Math.max(0,(game.tiles[tile.id].cityFootprint?.length||7)-1);
        const factor=Math.min(1,.70+.05*supporters);
        for(const key of Object.keys(infrastructure)) infrastructure[key]=before[key]+Math.floor((infrastructure[key]-before[key])*factor+.5);
      }
      if(hall){
        policy.food+=has('irrigation')+has('cultivation')+2*Number(state.faith==='grove');
        policy.wood+=has('carpentry');
        policy.metal+=2*has('prospecting')*Number(Boolean(sites.mine||tile.biome==='mountain'));
        policy.coin+=2*has('ledger')+(state.government==='republic'?2:state.government==='kingdom'?-1:0);
        policy.science+=has('printing')+3*has('network')+2*Number(state.faith==='stars')+2*Number(state.government==='council');
      }
    }
    for(const march of game.marches) if(march.owner===faction) supplyUsed+=supply(march.army,entries);
    for(const expedition of game.expeditions||[])if(expedition.owner===faction)supplyUsed+=supply(expedition.army,entries);
    const reach=22/(22+Math.max(0,activeCities-8));
    for(const key of Object.keys(land)) land[key]=Math.floor(land[key]*reach);
    const [foodRate,logisticsRate,coinRate,governmentRate]=upkeepRules[game.difficulty]||upkeepRules.standard;
    upkeep.food=Math.floor(supplyUsed/(has('logistics')?logisticsRate:foodRate));
    upkeep.coin=Math.floor(supplyUsed/coinRate)+Math.floor(Math.max(0,activeCities-12)/governmentRate);
    const net=Object.fromEntries(Object.keys(resources).map(key=>[key,land[key]+infrastructure[key]+policy[key]-upkeep[key]]));
    const reserve={food:280,wood:225,stone:210,metal:145,coin:260,science:210,influence:85};
    const growth={food:38,wood:28,stone:25,metal:31,coin:47,science:40,influence:12};
    const capacity=Object.fromEntries(Object.keys(resources).map(key=>[key,reserve[key]+growth[key]*state.age]));
    for(const tile of domains){
      const {sites,settledAt}=game.tiles[tile.id];
      if(settledAt>game.tick)continue;
      const hall=sites.hall||0;
      if(hall){
        capacity.food+=14*hall;
        capacity.wood+=8*hall;
        capacity.stone+=8*hall;
      }
      capacity.food+=42*(sites.granary||0);
      capacity.metal+=24*(sites.mine||0)+30*(sites.foundry||0);
      capacity.coin+=24*(sites.market||0);
      capacity.science+=32*(sites.academy||0)+45*(sites.lab||0);
      capacity.influence+=18*(sites.temple||0);
    }
    const actual=Object.fromEntries(Object.keys(resources).map(key=>[key,net[key]<0?-Math.min(state.stock[key],-net[key]):Math.min(net[key],Math.max(0,capacity[key]-state.stock[key]))]));
    return {net,actual,capacity,land,infrastructure,policy,upkeep,supplyUsed,activeCities,occupied,developed,foodRate:has('logistics')?logisticsRate:foodRate,coinRate};
  }
  const income=(game,faction)=>economy(game,faction).net;
  const canPay = (state,cost) => Object.entries(cost).every(([key,amount]) => state.stock[key]>=amount);
  const pay = (state,cost) => Object.entries(cost).forEach(([key,amount]) => {state.stock[key]-=amount;});
  const siteLabel=([id,level])=>`${byId(buildings,id).name} St. ${level}`;
  const maxProjectTicks=2400;
  function studyPlan(game,id,key) {
    const state=game.factions[id];
    const era=key==='age';
    const tech=byId(techs,key);
    const requirements=era?milestones[state.age]:technologyLinks[key];
    const cost=era?eraCost[state.age]:tech?.cost;
    const time=era&&requirements?Math.min(maxProjectTicks,Math.round(durationByAge[state.age+1]*(.95+requirements.time/120)))
      :tech?Math.min(maxProjectTicks,Math.round(durationByAge[tech.age]*(.95+tech.cost/850))):0;
    const checkedTech=(requirements?.tech||[]).map(key=>({type:'tech',key,label:byId(techs,key).name,ok:state.tech.includes(key)}));
    const sites=era?(requirements?.sites||[]):requirements?.site?[requirements.site]:[];
    const provinces=sites.length||era?owned(game,id):[];
    const settled=provinces.filter(tile=>(game.tiles[tile.id].settledAt||0)<=game.tick);
    const developed=settled.filter(tile=>game.tiles[tile.id].sites.hall).length;
    const checks=[...checkedTech,...sites.map(site=>({type:'site',key:site[0],level:site[1],label:siteLabel(site),ok:settled.some(tile=>(game.tiles[tile.id].sites[site[0]]||0)>=site[1])}))];
    if(era&&requirements) for(const [label,value,min] of [['Provinzen unter Kontrolle',provinces.length,requirements.land],['Produktive Ratshäuser',developed,requirements.settled],['Abgeschlossene Technologien',new Set(state.tech).size,requirements.research]]){
      checks.push({type:'progress',label:`${label}: ${value}/${min}`,ok:value>=min});
    }
    const materials=era?requirements?.materials:tech?techResources(tech):{};
    const payment=cost?{science:cost,...materials}:{};
    const needed=checks.filter(check=>!check.ok).map(check=>check.label);
    const shortage=Object.entries(payment).filter(([key,amount])=>state.stock[key]<amount).map(([key,amount])=>`${resources[key][0]} +${amount-state.stock[key]}`);
    const scheduled=Boolean(state.study?.key===key||state.studyQueue?.some(job=>job.key===key));
    const why=!cost?'Nicht verfügbar':tech?.faction&&tech.faction!==id?'Nicht für dieses Volk':!era&&state.tech.includes(key)?'Erforscht'
      :scheduled?'Forschung bereits eingeplant':!era&&state.age<tech.age?ages[tech.age]:needed.length?needed.join(' + ')
      :state.study?'Andere Forschung läuft':shortage.length?`Es fehlen: ${shortage.join(', ')}`:'';
    return {cost,time,why,needed,requirements,checks,payment,shortage,scheduled};
  }
  function techResources(tech){
    const workshop=['prospectingEarly','bronze','ironworking','steel','engineering','electricity','rocketry','fusion'];
    if(workshop.includes(tech.id)){
      const resource=tech.age>=2?'metal':tech.id==='bronze'?'metal':'stone';
      return {[resource]:8+tech.age*7};
    }
    return tech.age>=2?{coin:12+tech.age*8}:tech.faction?{wood:15}:{};
  }
  function tradePlan(game,id,key,side,ledger=economy(game,id)){
    const state=game.factions[id];
    if(!['food','wood','stone','metal'].includes(key)||!['buy','sell'].includes(side))return {price:0,why:'Ungültiger Handel'};
    const buying=side==='buy';
    const base=(key==='metal'?21:14)-Number(state.government==='republic')*2;
    const scarcity=1-clamp(state.stock[key]/ledger.capacity[key],0,1);
    const price=Math.max(1,Math.round(base*(.92+.20*scarcity)*(buying?1:.62)));
    const why=!owns(game,id,'market')?'Kein Markt':buying&&state.stock.coin<price?'Zu wenig Kronen':!buying&&state.stock[key]<12?'Zu wenig Rohstoffe':buying&&state.stock[key]+12>ledger.capacity[key]?'Zu wenig Lagerplatz':!buying&&state.stock.coin+price>ledger.capacity.coin?'Schatzkammer voll':'';
    return {price,why};
  }
  const workQueueLimit=10;
  const trainingGroupLimit=10;
  const splitTraining=(duration,amount)=>Array.from({length:amount},(_,index)=>Math.ceil(duration*(index+1)/amount));
  const queueFor=(region,type)=>region?.[type+'Queue']||[];
  const siteReady=(sites,site,level)=>(sites?.[site]||0)>=level;
  function plannedStage(region,key) {
    const planned=queueFor(region,'build').findLast(job=>job.key===key);
    return planned?.stage??(region?.build?.key===key?region.build.stage:region?.sites[key]||0);
  }
  function workChecks(state,region,age,technologies,sites,cost) {
    return [
      {label:`${ages[age]} erreichen`,ok:state.age>=age},
      ...technologies.map(key=>({kind:'research',key,label:`Forschung ${byId(techs,key).name}`,ok:state.tech.includes(key)})),
      ...sites.map(([site,level])=>({kind:'site',key:site,level,label:`${siteLabel([site,level])} in dieser Provinz`,ok:siteReady(region?.sites,site,level),planned:plannedStage(region,site)>=level})),
      ...Object.entries(cost).filter(([key,amount])=>state.stock[key]<amount)
        .map(([key,amount])=>({label:`${amount-state.stock[key]} ${resources[key][0]} fehlen (${state.stock[key]}/${amount})`,ok:false})),
    ];
  }
  function workReason(checks,notice) {
    return notice||checks.filter(check=>!check.ok&&!check.planned).map(check=>check.label).join(' · ');
  }
  function foundationPlan(game,id,place){
    const ring=[place,...landNeighbors(place)];
    const isFree=tile=>game.tiles[tile].owner===id&&!game.tiles[tile].cityClaim;
    const beyond=[...new Set(ring.slice(1).flatMap(landNeighbors))].filter(tile=>!ring.includes(tile)&&isFree(tile)).sort();
    const required=Math.max(0,8-ring.length);
    const free=ring.filter(isFree).length;
    const remaining=Math.max(0,(game.tiles[place].settledAt||0)-game.tick);
    const checks=[
      {label:`Gründungsgebiet: ${free+Math.min(required,beyond.length)}/8 freie eigene Provinzen`,ok:free===ring.length&&beyond.length>=required},
      ...ring.filter(tile=>!isFree(tile)).map(tile=>{
        const local=game.tiles[tile];
        return {label:local.owner!==id?`Übernimm ${lookup[tile].name}`:`${lookup[tile].name} gehört bereits zum Stadtgebiet von ${lookup[local.cityClaim].name}`,ok:false};
      }),
      {label:remaining?`Besatzungszeit des Dorfes: noch ${remaining*2} Spielsekunden`:'Besatzungszeit des Dorfes abgeschlossen',ok:remaining===0},
    ];
    return {checks,footprint:checks.every(check=>check.ok)?[...ring,...beyond.slice(0,required)]:null};
  }
  function construction(game,id,place,building) {
    const region = game.tiles[place];
    const state = game.factions[id];
    const stage=plannedStage(region,building.id)+1;
    const cost = Object.fromEntries(Object.entries(building.cost).map(([key,amount]) => [key,Math.round(amount*(1+.65*(stage-1)))]));
    const age=Math.min(building.id==='lab'?5:6,building.age+stage-1);
    const base=durationByAge[age]*(.93+buildingTime[building.id]*.035)*(1+.13*(stage-1));
    const time=Math.min(maxProjectTicks,Math.ceil(base*(state.tech.includes('engineering')?.82:1)));
    const hallLevel=building.req?.[0]==='hall'?building.req[1]:0;
    const sites=building.req&&building.req[0]!=='hall'?[building.req]:[];
    const hall=Math.max(hallLevel,building.id!=='hall'&&stage>1?stage:0);
    if(hall) sites.push(['hall',hall]);
    const checks=stage<=building.max?workChecks(state,region,age,buildingTech[building.id]||[],sites,cost):[];
    const founding=building.id==='hall'&&stage===1&&region?.owner===id?foundationPlan(game,id,place):null;
    if(founding)checks.unshift(...founding.checks);
    const notice=building.faction&&building.faction!==id?'Nicht für dieses Volk':region?.owner!==id?'Nicht in deinem Besitz'
      :!region.sites.hall&&!founding?'Bauen erst nach Fertigstellung des Ratshauses'
      :stage>building.max?(region.sites[building.id]>=building.max?'Maximalstufe erreicht':'Maximalstufe bereits eingeplant')
      :queueFor(region,'build').length>=workQueueLimit?'Bauwarteschlange voll':'';
    return {stage,cost,time,checks,notice,footprint:founding?.footprint,why:workReason(checks,notice)};
  }
  function buildPlan(game,id,place,building) {
    const initial=construction(game,id,place,building);
    if(initial.notice||!initial.why||initial.checks.some(check=>!check.ok&&!check.planned&&!check.kind))return initial;
    const state=game.factions[id];
    const region=game.tiles[place];
    const scheduledResearch=[state.study,...(state.studyQueue||[])].filter(job=>job&&job.key!=='age').map(job=>job.key);
    const projected={...state,stock:{...state.stock},tech:[...state.tech,...scheduledResearch],study:null,studyQueue:[]};
    const mock={...game,factions:{...game.factions,[id]:projected},tiles:Object.create(game.tiles)};
    const provinces=owned(game,id);
    for(const tile of provinces){
      const from=game.tiles[tile.id];
      const sites={...from.sites};
      for(const job of [from.build,...queueFor(from,'build')]) if(job) sites[job.key]=job.stage;
      mock.tiles[tile.id]={...from,sites,build:null,buildQueue:[]};
    }
    const steps=[];
    const visiting=new Set();
    let failure='';
    function addSite(key,stage){
      const site=byId(buildings,key);
      const local=mock.tiles[place];
      while(!siteReady(local.sites,key,stage)&&!failure){
        const token=`build:${key}`;
        if(visiting.has(token)){failure=`Abhängigkeit im Kreis bei ${site.name}`;return;}
        visiting.add(token);
        const before=construction(mock,id,place,site);
        for(const check of before.checks){
          if(check.ok||failure)continue;
          if(check.kind==='research') addResearch(check.key);
          if(check.kind==='site') addSite(check.key,check.level);
        }
        const plan=construction(mock,id,place,site);
        if(!failure&&plan.why)failure=`${site.name} · ${plan.why}`;
        if(!failure){
          pay(projected,plan.cost);
          local.sites[key]=plan.stage;
          steps.push({type:'build',key,stage:plan.stage,time:plan.time,cost:plan.cost,research:buildingTech[key]||[],label:`${site.name} St. ${plan.stage}`});
        }
        visiting.delete(token);
      }
    }
    function addResearch(key){
      if(projected.tech.includes(key)||failure)return;
      const item=byId(techs,key);
      if(visiting.has(key)){failure=`Abhängigkeit im Kreis bei ${item.name}`;return;}
      if(item.age>state.age){failure=`${item.name} benötigt das Zeitalter ${ages[item.age]}`;return;}
      visiting.add(key);
      const requirements=technologyLinks[key];
      for(const other of requirements?.tech||[]) addResearch(other);
      if(requirements?.site&&!provinces.some(tile=>{
        const local=mock.tiles[tile.id];
        return (local.settledAt||0)<=game.tick&&siteReady(local.sites,...requirements.site);
      }))addSite(...requirements.site);
      const plan=studyPlan(mock,id,key);
      if(!failure&&plan.why)failure=`${item.name} · ${plan.why}`;
      if(!failure){
        pay(projected,plan.payment);
        projected.tech.push(key);
        steps.push({type:'study',key,time:plan.time,cost:plan.payment,label:`Forschung ${item.name}`});
      }
      visiting.delete(key);
    }
    addSite(building.id,initial.stage);
    const builds=steps.filter(step=>step.type==='build');
    const queued=queueFor(region,'build');
    const startsNow=!region.build&&!queued.length&&builds[0]?.research.every(key=>state.tech.includes(key));
    if(!failure&&queued.length+builds.length-Number(startsNow)>workQueueLimit)failure='Für alle Voraussetzungen zusammen fehlen freie Plätze in der Bauwarteschlange';
    if(failure) return {...initial,notice:failure,why:failure};
    const total=Object.fromEntries(Object.keys(resources).filter(key=>state.stock[key]!==projected.stock[key])
      .map(key=>[key,state.stock[key]-projected.stock[key]]));
    const existing=initial.checks.filter(check=>check.kind==='research'&&!check.ok&&scheduledResearch.includes(check.key));
    const checks=initial.checks.map(check=>!check.ok&&check.kind?{...check,planned:true,automatic:!check.planned&&!existing.includes(check)}:check);
    return {...initial,why:'',steps,total,existing,checks};
  }
  function recruitment(game,id,place,unit) {
    const region = game.tiles[place];
    const state = game.factions[id];
    const time = Math.max(2,2*(2+unit.age+Number(['heavy','siege','air'].includes(unit.role))*2+Number(unit.id==='elite')*3)-2*Number(state.tech.includes('automation')));
    const tech=unit.id==='elite'?[unit.role==='air'?'fusion':id==='matrix'?'automation':'siegecraft']:unitTech[unit.id]||[];
    const eliteCount=unit.id!=='elite'?0:owned(game,id).reduce((sum,{id:tile})=>{
      const local=game.tiles[tile];
      return sum+(local.army.elite||0)+(local.train?.key==='elite'?local.train.amount||1:0)+queueFor(local,'train').filter(job=>job.key==='elite').reduce((n,job)=>n+(job.amount||1),0);
    },0)+[...game.marches,...(game.expeditions||[])].filter(march=>march.owner===id).reduce((sum,march)=>sum+(march.army.elite||0),0);
    const currentElite=eliteCount>=3;
    const queue=queueFor(region,'train');
    const tail=queue.at(-1)||region?.train;
    const group=tail?.key===unit.id&&(tail.amount||1)<trainingGroupLimit?tail:null;
    const checks=workChecks(state,region,unit.age,tech,[[unit.site,unit.level]],unit.cost);
    const notice=region?.owner!==id?'Nicht in deinem Besitz':!region.sites.hall?'Dörfer können Truppen aufnehmen. Rekrutieren kannst du in Städten.':currentElite?'Höchstens drei Super-Einheiten pro Volk'
      :!group&&queue.length>=workQueueLimit?'Rekrutierungswarteschlange voll':'';
    return {time,checks,notice,group,why:workReason(checks,notice)};
  }
  function startWork(region,type,tick,state) {
    const queue=region[type+'Queue'];
    const next=queue?.[0];
    if(region[type]||!next||type==='train'&&!siteReady(region.sites,next.site,next.level)
      ||type==='build'&&next.research?.some(key=>!state?.tech.includes(key)))return;
    const {duration,unitTimes,...order}=queue.shift();
    const job={...order,started:tick,due:tick+duration};
    if(type==='train'){
      let end=tick;
      job.ends=unitTimes?unitTimes.map(time=>end+=time):splitTraining(duration,job.amount||1).map(time=>tick+time);
    }
    region[type]=job;
  }
  function workOrders(game,place,type) {
    const region=game.tiles[place];
    const state=game.factions[region.owner];
    const active=region[type];
    let due=active?.due??game.tick;
    const buildingOrders=type==='train'?workOrders(game,place,'build'):[];
    const waiting=queueFor(region,type).map(job=>{
      const building=type==='train'&&!siteReady(region.sites,job.site,job.level)
        ?buildingOrders.find(order=>order.key===job.site&&order.stage>=job.level):null;
      const research=job.research?.find(key=>!state?.tech.includes(key));
      const researchDue=research&&state?.study?.key===research?state.study.due:null;
      const unknown=due===null||building&&building.due===null||research&&!researchDue;
      const start=unknown?null:Math.max(due,building?.due??game.tick,researchDue??game.tick);
      due=start===null?null:start+job.duration;
      return {...job,start,due,dependency:building?siteLabel([job.site,job.level]):research?`Forschung ${byId(techs,research).name}`:''};
    });
    return active?[{...active,active:true},...waiting]:waiting;
  }
  function rushPlan(game,id,type,place){
    const state=game.factions[id];
    const region=game.tiles[place];
    const job=type==='study'?state.study:type==='mentor'?state.mentoring:['build','train'].includes(type)&&region?.owner===id?region[type]:null;
    const left=job?job.due-game.tick:0;
    const price=Math.max(0,left)*(type==='study'?3:2);
    return {saved:left,price,why:!job?'Kein Auftrag':left<=0?'Auftrag wird abgeschlossen':state.stock.coin<price?`Es fehlen ${price-state.stock.coin} Kronen`:'',job};
  }
  const reinforce=(region,army,xp=0)=>{
    if(!count(army))return;
    const combined=combineArmies(region.army,region.armyXP,army,xp);
    region.army=combined.army;
    region.armyXP=combined.xp;
  };
  function completeStudy(game,id){
    const state=game.factions[id];
    const {key}=state.study;
    if(key==='age')state.age++;
    else state.tech.push(key);
    state.study=null;
    log(game,`Abgeschlossen: ${key==='age'?ages[state.age]:byId(techs,key).name}.`,[id],'success');
  }
  function startStudy(game,id){
    const state=game.factions[id];
    if(state.study||!state.studyQueue?.length)return;
    const ready=state.studyQueue.findIndex(job=>!studyPlan(game,id,job.key).needed.length);
    if(ready<0)return;
    const [next]=state.studyQueue.splice(ready,1);
    state.study={key:next.key,started:game.tick,due:game.tick+next.duration};
  }
  function completeMentoring(game,id){
    const state=game.factions[id];
    state.mentoring=null;
    state.heroXP=Math.min(16,(state.heroXP||0)+2);
    log(game,`${byId(peoples,id).hero} hat das Akademietraining abgeschlossen: +2 EP.`,[id],'success');
  }
  function updateWork(game,tile){
    const region=game.tiles[tile.id];
    if(region.build?.due<=game.tick){
      const {key,stage}=region.build;
      region.sites[key]=stage;
      region.build=null;
      if(key==='hall'&&stage===1)delete region.pendingFoundation;
      log(game,`${byId(buildings,key).name} St. ${stage} in ${tile.name} fertig.`,[region.owner],'success');
    }
    startWork(region,'build',game.tick,game.factions[region.owner]);
    const training=region.train;
    if(training&&(training.ends?.[0]??training.due)<=game.tick){
      const {key}=training;
      if(key==='drill'){
        region.train=null;
        if(count(region.army)) region.armyXP=Math.max(region.armyXP||0,Math.min(45,(region.armyXP||0)+12));
        log(game,`Manöver in ${tile.name} abgeschlossen.`,[region.owner]);
      } else {
        const amount=training.ends?training.ends.filter(end=>end<=game.tick).length:training.amount||1;
        if(training.ends&&amount<training.ends.length){
          training.ends.splice(0,amount);
          training.amount=training.ends.length;
          training.started=game.tick;
        } else region.train=null;
        reinforce(region,{[key]:amount});
        log(game,`${amount} × ${byId(unitList(region.owner),key).name} in ${tile.name} rekrutiert.`,[region.owner],'success');
      }
    }
    startWork(region,'train',game.tick);
  }
  const battlePhases=['Fernkampf','Hauptgefecht','Entscheidung'];
  const defenseBonus=1.04;
  const phaseStrength={
    infantry:[.92,1.10,1.05],ranged:[1.14,1,.86],spear:[.88,1.16,.94],
    mobile:[.90,1.02,1.22],heavy:[.80,1.18,1.04],siege:[1.30,1,.80],air:[1.16,1.08,1.08],
  };
  const exposure={infantry:1.12,ranged:.88,spear:1.08,mobile:1,heavy:.82,siege:1.12,air:.85};
  const combatRolls=21;

  function defenseSupport(game,target,from,visible){
    const region=game.tiles[target];
    if(!region.owner)return {groups:[],unknown:false};
    const center=lookup[target];
    const approach=lookup[from];
    const dx=approach?center.x-approach.x:1;
    const dy=approach?center.y-approach.y:0;
    const neighborsOnLand=neighbors[target].filter(place=>place!==from&&!seaRoute(target,place));
    const possible=neighborsOnLand.filter(place=>(!visible||visible.has(place))&&game.tiles[place].owner===region.owner&&count(game.tiles[place].army))
      .map(place=>{
        const x=lookup[place].x-center.x;
        const y=lookup[place].y-center.y;
        const side=dx*y-dy*x;
        const lateral=Math.abs(side)/Math.hypot(x,y);
        return {place,side,lateral};
      }).sort((a,b)=>b.lateral-a.lateral||a.place.localeCompare(b.place));
    const left=possible.find(item=>item.side<-.001);
    const right=possible.find(item=>item.side>.001);
    const selected=[left,right].filter(Boolean);
    // Prefer one contributor per flank. An available neighbor can cover a missing flank.
    for(const candidate of possible) {
      if(selected.length===2)break;
      if(!selected.includes(candidate))selected.push(candidate);
    }
    const groups=selected.map(({place})=>{
      const troops=game.tiles[place].army;
      const share=.3;
      const detachment=Object.fromEntries(Object.entries(troops).map(([key,amount])=>[key,Math.floor(amount*share)]).filter(([,amount])=>amount>0));
      let remaining=Math.round(count(troops)*share)-count(detachment);
      for(const [key,amount] of Object.entries(troops)){
        if(remaining<=0)break;
        if(amount-(detachment[key]||0)>0){detachment[key]=(detachment[key]||0)+1;remaining--;}
      }
      return {place,army:detachment,amount:count(detachment)};
    });
    return {groups,unknown:Boolean(visible&&selected.length<neighborsOnLand.length&&neighborsOnLand.some(place=>!visible.has(place)))};
  }

  function battle(game,id,army,target,blessing,reserveXP=0,heroRank=heroLevel(game.factions[id].heroXP),random,{from,visible}={}) {
    const region = game.tiles[target];
    const {biome} = lookup[target];
    const attacker = game.factions[id];
    const defender = game.factions[region.owner];
    const wall = region.sites.wall||0;
    const effectiveWall = blessing==='goa'?0:wall;
    const enemyUnits = region.dragon?[...unitList(region.owner),{id:'dragon',name:'Uralter Drache',role:'air',atk:120,def:110}]:unitList(region.owner);
    const allyUnits = unitList(id);
    const support=defenseSupport(game,target,from,visible);
    const refuge=region.owner&&neighbors[target].some(place=>(!visible||visible.has(place))&&game.tiles[place].owner===region.owner);
    const refugeUnknown=Boolean(region.owner&&!refuge&&visible&&neighbors[target].some(place=>!visible.has(place)));
    const mobilized={...region.army};
    for(const group of support.groups)for(const [key,amount] of Object.entries(group.army))mobilized[key]=(mobilized[key]||0)+amount;
    const defenderPower=region.blessing?.style;
    const heroBonus = (power,role,defense) => {
      if (power==='aurel') return 1.24;
      if (power==='sylva') return ['forest','taiga','jungle'].includes(biome)?1.30:1.10;
      if (power==='grak') return ['infantry','heavy'].includes(role)?1.28:1.08;
      if (power==='brindle') return role==='ranged'?1.52:1.05;
      if (power==='root') return defense?1.27:1.14;
      if (power==='goa') return 1.20;
      if (power==='pam') return 1.10;
      if (power==='abra') return role==='siege'?1.55:['desert','steppe'].includes(biome)?1.20:1;
      if (power==='andro') return role==='air'?1.45:role==='ranged'?1.42:1.06;
      if (power==='matrix') return ['mobile','heavy'].includes(role)?1.42:1.12;
      if (power==='avatar') return ['forest','taiga','jungle'].includes(biome)?defense?1.38:1.28:1.05;
      if (power==='insect') return ['infantry','spear'].includes(role)?1.36:1.13;
      if (power==='dwarf') return ['heavy','siege'].includes(role)?biome==='mountain'?1.40:1.30:1;
      return 1;
    };
    const formation = (troops,entries,opposing,opponentList,defense,garrison) => {
      const rows = [];
      const enemyProtection={};
      let totalProtection=0;
      for(const unit of opponentList){
        const weight=(opposing[unit.id]||0)*unit.def;
        enemyProtection[unit.role]=(enemyProtection[unit.role]||0)+weight;
        totalProtection+=weight;
      }
      const opponentShare=role=>(enemyProtection[role]||0)/(totalProtection||1);
      const woods=['forest','taiga','jungle'].includes(biome);
      for (const [key,amount] of Object.entries(troops)) {
        const unit = byId(entries,key);
        if (!unit || !amount) continue;
        const effect=unit.effect||{};
        const specialty=1+(defense?(effect.defense||0):(effect.attack||0))+(woods?(effect.woods||0)+(effect.woodRider||0):0)
          +(defense&&(woods||biome==='marsh')?effect.cover||0:0)+(defense&&effectiveWall?effect.fortress||0:0)
          +(['desert','steppe'].includes(biome)?effect.dry||0:0)+(!defense&&effectiveWall?effect.breach||0:0)
          +(biome==='mountain'?effect.highlands||0:0)+opponentShare('ranged')*(effect.antiRanged||0)
          +(count(troops)>=10?effect.swarm||0:0)+opponentShare('heavy')*(effect.antiHeavy||0)+opponentShare('siege')*(effect.antiSiege||0);
        const mobility = unit.role==='mobile' ? (woods&&effect.woodRider?1:['forest','marsh','mountain','highland','taiga','jungle','tundra'].includes(biome)?.76:1.15) : 1;
        const position = defense && biome==='mountain' && unit.role==='ranged'?1.08:1;
        const rank=defense?region.blessing?.rank||1:heroRank;
        const hero = 1+(heroBonus(defense?defenderPower:blessing,unit.role,defense)-1)*(1+.1*(rank-1));
        const enemyEffect = (defense?blessing:defenderPower)==='veil'?(['ranged','air'].includes(unit.role)?.68:.86):1;
        const relicBonus=1+(defense&&!defender?region.defenseProfile?.relics?.[unit.role]||0:relicStrength((defense?defender:attacker)?.amulets,unit.role));
        const veteran=1+veteranLevel(defense?game.tiles[garrison].armyXP:reserveXP)*.06;
        const base=defense?Math.max(unit.atk,unit.def):unit.atk;
        const strength=base*mobility*position*hero*enemyEffect*relicBonus*veteran*specialty;
        const vulnerability=exposure[unit.role]*clamp(Math.sqrt(unit.atk/unit.def),.8,1.25);
        const detail=random?{base,attack:unit.atk,protection:unit.def,modifiers:{mobility,position,hero,enemyEffect,relicBonus,veteran,specialty},
          vulnerability,experience:defense?game.tiles[garrison].armyXP||0:reserveXP}:null;
        rows.push({key,name:unit.name,amount,strength,role:unit.role,protection:unit.def,vulnerability,garrison,detail});
      }
      return rows;
    };
    const offense = formation(army,allyUnits,mobilized,enemyUnits,false);
    const defense = [
      ...formation(region.army,enemyUnits,army,allyUnits,true,target),
      ...support.groups.flatMap(group=>formation(group.army,enemyUnits,army,allyUnits,true,group.place)),
    ];
    for(const [rows,enemy] of [[offense,defense],[defense,offense]]){
      for(const row of rows) row.matchups=enemy.map(other=>matchups[row.role][other.role]??1);
    }
    const boosts = {bronze:.08,steel:.16,fusion:.20};
    const researchOf=side=>side?side.tech.reduce((sum,key) => sum+(boosts[key]||0),0):0;
    const research = researchOf(attacker);
    const provision=attacker.stock.food<=0?.85:1;
    const doctrine=(1+research+(attacker.faith==='sun'?.08:0)+(attacker.government==='kingdom'?.08:attacker.government==='republic'?-.05:0))*provision;
    const defenderProvision=defender&&defender.stock.food<=0?.85:1;
    const defenderDoctrine=defender?(1+researchOf(defender)+(defender.faith==='sun'?.08:0)+(defender.government==='kingdom'?.08:defender.government==='republic'?-.05:0))*defenderProvision:1+(region.defenseProfile?.research||0);
    const masonry=defender?defender.tech.includes('masonry'):region.defenseProfile?.masonry;
    const terrainBonus=1+(terrain[biome][2]-1)*.5;
    const defensiveGround=defenseBonus*terrainBonus*(masonry?1.05:1)*defenderDoctrine*(lookup[target].capital?1.10:1)*(defender&&game.provinceCount&&game.provinceCount[defender.id]<.4*game.provinceMax?1.12:1);
    const fortification=breach=>defensiveGround*(1+.08*effectiveWall*(1-breach));
    const attackerStart=offense.map(row=>row.amount);
    const defenderStart=defense.map(row=>row.amount);
    const matchupFactor=(row,enemy,enemyLeft,weight)=>{
      if(!weight)return 1;
      let weighted=0;
      for(let i=0;i<enemy.length;i++) weighted+=enemyLeft[i]*enemy[i].protection*row.matchups[i];
      return weighted/weight;
    };
    const protection=(rows,left)=>rows.reduce((sum,row,i)=>sum+row.protection*left[i],0);
    const opening=(rows,left,enemy,enemyLeft,modifier)=>{
      const weight=protection(enemy,enemyLeft);
      return rows.map((row,i)=>{
        const factor=matchupFactor(row,enemy,enemyLeft,weight);
        const value=left[i]*row.strength*phaseStrength[row.role][0]*factor*modifier;
        return {name:row.name,amount:row.amount,value,counter:Math.round((factor-1)*100),garrison:row.garrison};
      });
    };
    const attackRows=opening(offense,attackerStart,defense,defenderStart,doctrine);
    const defendRows=opening(defense,defenderStart,offense,attackerStart,fortification(0));
    const attack=attackRows.reduce((sum,row)=>sum+row.value,0);
    const defend=defendRows.reduce((sum,row)=>sum+row.value,0);
    const power=(rows,left,enemy,enemyLeft,index)=>{
      const weight=protection(enemy,enemyLeft);
      let total=0;
      for(let i=0;i<rows.length;i++){
        const row=rows[i];
        total+=left[i]*row.strength*phaseStrength[row.role][index]*matchupFactor(row,enemy,enemyLeft,weight);
      }
      return total;
    };
    const survivorCount=(left,holds)=>Math.max(Number(holds&&left.length>0),Math.round(left.reduce((sum,value)=>sum+value,0)));
    // Round the formation total once, then allocate the remaining places by fractional remainder.
    const survivors=(rows,left,total)=>{
      const saved=left.map(Math.floor);
      const remainder=total-saved.reduce((sum,value)=>sum+value,0);
      const order=rows.map((_,i)=>i).sort((a,b)=>(left[b]-saved[b])-(left[a]-saved[a])||rows[b].strength-rows[a].strength);
      for(let n=0;n<remainder;n++) saved[order[n]]++;
      return saved;
    };
    const engage=(roll,report=false)=>{
      let atkLeft=attackerStart;
      let defLeft=defenderStart;
      let breach=0;
      let atkPower=attack;
      let defPower=defend;
      const phases=[];
      if(attack&&defend) for(let index=0;index<battlePhases.length;index++){
        atkPower=power(offense,atkLeft,defense,defLeft,index)*doctrine*roll;
        defPower=power(defense,defLeft,offense,atkLeft,index)*fortification(breach);
        const pressure=atkPower/(atkPower+defPower);
        const attrition=(rows,left,enemyPressure,protectedBy)=>left.map((amount,i)=>
          amount*(1-.28*enemyPressure**2*rows[i].vulnerability*(protectedBy==='pam'?.66:1)));
        atkLeft=attrition(offense,atkLeft,1-pressure,blessing);
        defLeft=attrition(defense,defLeft,pressure,defenderPower);
        if(report) phases.push({name:battlePhases[index],attack:Math.round(atkPower),defend:Math.round(defPower),breach:Math.round(breach*100),
          attackPower:atkPower,defendPower:defPower,attackRemaining:atkLeft,defendRemaining:defLeft,pressure});
        if(effectiveWall&&index<battlePhases.length-1){
          const siege=offense.reduce((sum,row,i)=>sum+(row.role==='siege'?row.strength*atkLeft[i]:0),0)*doctrine;
          breach=Math.min(.85,breach+1.2*siege/(siege+defPower+16*effectiveWall));
        }
      }
      if(attack&&defend){
        const last=battlePhases.length-1;
        atkPower=power(offense,atkLeft,defense,defLeft,last)*doctrine*roll;
        defPower=power(defense,defLeft,offense,atkLeft,last)*fortification(breach);
      }
      const victory=atkPower>defPower;
      const atkAfterCombat=report?survivorCount(atkLeft,victory):0;
      const defAfterCombat=report?survivorCount(defLeft,!victory):0;
      if(attack&&defend){
        // The losing side breaks contact. Light and mobile troops escape more easily.
        const withdraw=(rows,left,own,enemy,protectedBy)=>{
          const recovery=own/(own+enemy);
          return left.map((amount,i)=>amount*Math.min(1,.78+.24*recovery+(rows[i].role==='mobile'||rows[i].role==='air'?.12:0)+(protectedBy==='pam'?.12:0)));
        };
        if(victory) defLeft=withdraw(defense,defLeft,defPower,atkPower,defenderPower);
        else atkLeft=withdraw(offense,atkLeft,atkPower,defPower,blessing);
      }
      const atkSaved=survivorCount(atkLeft,victory);
      const defSaved=survivorCount(defLeft,!victory);
      if(!report) return {victory,atkSaved,defSaved};
      const atkUnits=survivors(offense,atkLeft,atkSaved);
      const defUnits=survivors(defense,defLeft,defSaved);
      const atkRemain=Object.fromEntries(offense.map((row,i)=>[row.key,atkUnits[i]]));
      const garrisons=Object.fromEntries([target,...support.groups.map(group=>group.place)].map(place=>[place,{}]));
      defense.forEach((row,i)=>{garrisons[row.garrison][row.key]=defUnits[i];});
      const supports=support.groups.map(group=>({...group,remain:garrisons[group.place]}));
      const record=(rows,saved,openingRows)=>rows.map(({key,name,amount,role,garrison,detail},i)=>
        ({key,name,amount,role,garrison,saved:saved[i],openingStrength:openingRows[i].value,openingCounterPercent:openingRows[i].counter,...detail}));
      return {victory,atkRemain,defRemain:garrisons[target],supports,phases,
        atkAfterCombat,defAfterCombat,finalAttack:Math.round(atkPower),finalDefend:Math.round(defPower),
        report:{roll,attackingUnits:record(offense,atkUnits,attackRows),defendingUnits:record(defense,defUnits,defendRows),
          attackModifiers:{doctrine,provision,research,faith:attacker.faith,government:attacker.government,hero:blessing,heroRank},
          defenseModifiers:{base:defenseBonus,terrain:terrainBonus,masonry:Boolean(masonry),wall,effectiveWall,hero:defenderPower,heroRank:region.blessing?.rank||1},
          finalStrength:{attack:atkPower,defense:defPower}}};
    };
    let wins=0, attackerLosses=0, defenderLosses=0;
    const atkCount=count(army), defCount=count(mobilized);
    const rollAt=index=>.80+.40*index/(combatRolls-1);
    for(let index=0;index<combatRolls;index++){
      const outcome=engage(rollAt(index));
      wins+=Number(outcome.victory);
      attackerLosses+=atkCount-outcome.atkSaved;
      defenderLosses+=defCount-(outcome.victory&&!refuge&&!refugeUnknown?0:outcome.defSaved);
    }
    return {attack,defend,chance:wins/combatRolls,wall,effectiveWall,provision,defenseBonus,terrainBonus,masonry,attackRows,defendRows,support,defCount,refugeUnknown,
      attackerLosses:attackerLosses/combatRolls,defenderLosses:defenderLosses/combatRolls,
      outcome:random?engage(rollAt(Math.min(combatRolls-1,Math.floor(random()*combatRolls))),true):null};
  }
  function action(game,id,command) {
    const state = game.factions[id];
    if (!state || !command || typeof command!=='object' || game.winner) return 'Die Partie ist beendet oder der Befehl ungültig.';
    if(defeated(game,id)) return 'Dein Volk hat seine letzte Stadt verloren und ist vernichtet.';
    const {type,place,key,target} = command;
    const region = Object.hasOwn(game.tiles,place) ? game.tiles[place] : null;
    const myCity = region?.owner===id;
    const enemy = byId(peoples,target);
    const folk = byId(peoples,id);
    if (type==='build') {
      const item=byId(buildings,key);
      if(!item||!myCity)return 'Wähle eine eigene Provinz.';
      const plan=buildPlan(game,id,place,item);
      if(plan.why)return plan.why;
      if(plan.footprint){
        allocateCity(game,place,plan.footprint);
        region.pendingFoundation={cost:plan.cost};
      }
      const steps=plan.steps||[{type:'build',key,stage:plan.stage,time:plan.time,cost:plan.cost}];
      for(const step of steps){
        pay(state,step.cost);
        if(step.type==='study'){
          (state.studyQueue||=[]).push({key:step.key,duration:step.time});
          startStudy(game,id);
        } else {
          (region.buildQueue||=[]).push({key:step.key,stage:step.stage,research:step.research,duration:step.time});
          startWork(region,'build',game.tick,state);
        }
      }
    } else if (type==='train') {
      const item = byId(unitList(id),key);
      if (!item || !myCity) return 'Wähle eine eigene Provinz.';
      const info = recruitment(game,id,place,item);
      if (info.why) return info.why;
      pay(state,item.cost);
      if(info.group){
        const previousAmount=info.group.amount||1;
        info.group.amount=(info.group.amount||1)+1;
        if(info.group===region.train){
          info.group.started??=game.tick;
          info.group.ends||=splitTraining(info.group.due-info.group.started,previousAmount).map(time=>info.group.started+time);
          info.group.due+=info.time;
          info.group.ends.push(info.group.due);
        } else {
          if(!info.group.unitTimes){
            const ends=splitTraining(info.group.duration,previousAmount);
            info.group.unitTimes=ends.map((end,index)=>end-(ends[index-1]||0));
          }
          info.group.duration+=info.time;
          info.group.unitTimes.push(info.time);
        }
      } else {
        const job={key,amount:1,site:item.site,level:item.level,duration:info.time,unitTimes:[info.time]};
        (region[type+'Queue']||=[]).push(job);
        startWork(region,type,game.tick);
      }
    } else if (type==='study') {
      const plan=studyPlan(game,id,key);
      if(plan.why) return plan.why;
      pay(state,plan.payment);
      state.study={key,started:game.tick,due:game.tick+plan.time};
    } else if(type==='mentor'){
      if((state.heroXP||0)>=16||state.mentoring||!owns(game,id,'academy')) return 'Heldentraining braucht eine Akademie, einen freien Auftrag und einen Helden unter Stufe 5.';
      if(!canPay(state,{science:24,influence:12})) return 'Heldentraining kostet 24 Wissen und 12 Einfluss.';
      pay(state,{science:24,influence:12});
      state.mentoring={started:game.tick,due:game.tick+8};
    } else if(type==='drill'){
      if(!myCity||!region.sites.barracks||!count(region.army)||region.train||queueFor(region,'train').length||(region.armyXP||0)>=45) return 'Manöver brauchen eine freie Kaserne, eine Garnison und weniger als 45 EP.';
      const drillCost={food:10+2*count(region.army),coin:8+count(region.army)};
      if(!canPay(state,drillCost)) return `Für Manöver brauchst du ${drillCost.food} Nahrung und ${drillCost.coin} Kronen.`;
      pay(state,drillCost);
      region.train={key:'drill',started:game.tick,due:game.tick+4};
    } else if (type==='rush') {
      const plan=rushPlan(game,id,key,place);
      if(plan.why) return plan.why;
      state.stock.coin-=plan.price;
      plan.job.due=game.tick;
      if(plan.job.ends) plan.job.ends.fill(game.tick);
      log(game,`Auftrag sofort abgeschlossen (−${plan.price} Kronen).`,[id]);
      if(key==='study'){
        completeStudy(game,id);
        for(const tile of owned(game,id)) updateWork(game,tile);
        startStudy(game,id);
      }
      else if(key==='mentor') completeMentoring(game,id);
      else{
        updateWork(game,lookup[place]);
        startStudy(game,id);
      }
    } else if(type==='recall'){
      const march=game.marches.find(item=>item.id===Number(place)&&item.owner===id);
      if(!march||march.returning) return 'Nur ein eigenes Heer auf dem Hinweg kann umkehren.';
      const started=march.started??march.due-3;
      const gone=Math.max(0,game.tick-started);
      const duration=Math.max(1,march.due-started);
      [march.from,march.to]=[march.to,march.from];
      march.returnFraction=Math.min(1,gone/duration);
      march.returning=true;
      march.started=game.tick;
      march.due=game.tick+Math.max(1,gone);
      log(game,`Das Heer kehrt nach ${lookup[march.to].name} zurück.`,[id]);
    } else if(type==='raid'){
      const plan=expeditionPlan(game,id,place,command.army);
      if(plan.why)return plan.why;
      state.stock.food-=plan.food;
      for(const [unit,amount] of Object.entries(plan.army))region.army[unit]-=amount;
      (game.expeditions||=[]).push({owner:id,from:place,started:game.tick,due:game.tick+plan.time,army:plan.army,armyXP:region.armyXP||0,chance:plan.chance});
      if(!count(region.army))region.armyXP=0;
      log(game,`Raubzug aus ${lookup[place].name} aufgebrochen: ${count(plan.army)} Einheiten, fünf Minuten abseits der Karte.`,[id]);
    } else if (type==='march') {
      if (!myCity || !neighbors[place].includes(target)) return 'Armeen können nur in Nachbarprovinzen marschieren.';
      const destination = game.tiles[target];
      const reinforceOnly=command.reinforce===true;
      const scouting=command.scout===true;
      if(reinforceOnly&&scouting)return 'Wähle Verstärkung oder Erkundung.';
      if(reinforceOnly&&destination.owner!==id) return 'Verstärkung ist nur für eigene Provinzen möglich.';
      if (!scouting&&destination.owner && destination.owner!==id && relation(game,id,destination.owner)!=='war' && sight(game,id).has(target)) return 'Für einen Angriff musst du zuerst den Krieg erklären.';
      const army=selectArmy(id,region,command.army);
      if(!army) return 'Keine gültige Truppenauswahl.';
      if (!count(army)) return 'Wähle mindestens eine Einheit.';
      if(scouting&&count(army)!==army.scout)return 'Aufklärung ist nur mit Kundschaftern möglich.';
      if (game.marches.some(march => march.owner===id && march.to===target&&Boolean(march.scout)===scouting)) return 'In diese Provinz ist bereits ein gleicher Marsch unterwegs.';
      for (const [unit,amount] of Object.entries(army)) region.army[unit]-=amount;
      const crossing = seaRoute(place,target);
      const delay = Math.max(1,(crossing?10:lookup[target].biome==='mountain'?7:5)-Number(state.tech.includes('cartography'))-Number(scouting||region.blessing?.style==='brindle'));
      game.marches.push({id:game.nextId++,owner:id,from:place,to:target,started:game.tick,due:game.tick+delay,army,armyXP:region.armyXP||0,
        ...(scouting?{scout:true}:{blessing:region.blessing?.style,heroRank:region.blessing?.rank||1}),
        ...(reinforceOnly?{reinforce:true}:{})});
      if(!count(region.army)) region.armyXP=0;
      if(!scouting||!count(region.army))region.blessing=null;
    } else if (type==='hero') {
      if (!myCity || !count(region.army) || game.tick<state.heroReady || region.blessing || state.stock.influence<8) return 'Der Held benötigt eine Armee, 8 Einfluss und eine freie Fähigkeit.';
      state.stock.influence-=8;
      state.heroReady=game.tick+30;
      region.blessing={style:id,started:game.tick,due:game.tick+10,rank:heroLevel(state.heroXP)};
      log(game,`${folk.hero} wirkt ${folk.power} in ${lookup[place].name}.`,[id],'success');
    } else if (type==='government' || type==='faith') {
      const policy = type==='government'?governments:faiths;
      if (!Object.hasOwn(policy,key) || state[type]===key || state.stock.influence<10 || (type==='government'?state.age<policy[key][2]:!owns(game,id,'temple'))) return 'Diese Staatsreform ist nicht verfügbar.';
      state.stock.influence-=10;
      state[type]=key;
      log(game,`${type==='government'?'Regierung':'Staatsglaube'} eingeführt: ${policy[key][0]}.`,[id],'success');
    } else if (type==='trade') {
      const plan=tradePlan(game,id,key,command.side);
      if(plan.why)return plan.why;
      const modifier = command.side==='buy'?1:-1;
      state.stock[key]+=12*modifier;
      state.stock.coin-=plan.price*modifier;
    } else if (['war','alliance','peace','accept','decline','withdraw'].includes(type)) {
      if (!enemy || enemy.id===id || !owned(game,enemy.id).length) return 'Ungültiger Verhandlungspartner.';
      const pair = relationKey(id,target);
      const pendingOffer=offerTerms(game,id,target);
      if (game.humans.includes(id) && !Object.values(state.explored).some(tile=>tile.owner===target) && !game.relations[pair] && !pendingOffer) return 'Ihr habt noch keinen Kontakt zu diesem Reich.';
      const status = relation(game,id,target);
      if(type==='decline'||type==='withdraw'){
        if(!pendingOffer||pendingOffer[type==='withdraw'?'from':'to']!==id) return 'Kein passendes Angebot vorhanden.';
        delete game.offers[pair];
        log(game,`${folk.realm}: Angebot ${type==='withdraw'?'zurückgezogen':'abgelehnt'}.`,[id,target]);
        return '';
      }
      if (type==='accept') {
        const offer = pendingOffer;
        if (!offer || offer.from!==target || offer.to!==id) return 'Kein Angebot vorhanden.';
        game.relations[pair]=offer.type;
        if(offer.type==='peace')(game.peaceSince||={})[pair]=game.tick;
        delete game.offers[pair];
      } else if (type==='war') {
        if (status==='war') return 'Ihr seid bereits im Krieg.';
        if (status==='alliance') return 'Beende zuerst das Bündnis, bevor du einem Verbündeten den Krieg erklärst.';
        if ((game.peaceSince?.[pair]??-99)+24>game.tick) return 'Der Friedensvertrag bindet noch einige Takte.';
        if (game.tick<(game.startPeaceUntil||0)&&game.relations[pair]==='peace') return 'Der Startfrieden zwischen Nachbarvölkern gilt noch bis zur Frühphase des Spiels.';
        game.relations[pair]='war';
        (game.warSince||={})[pair]=game.tick;
        delete game.offers[pair];
      } else {
        if (type===status || (type==='alliance' && status==='war') || state.stock.influence<12 || pendingOffer) return 'Verhandlung nicht möglich.';
        if (!game.humans.includes(target) && type==='alliance' && owned(game,id).length+2<owned(game,target).length) return 'Das Reich lehnt ab: Dein Einflussgebiet ist noch zu klein.';
        state.stock.influence-=12;
        if (game.humans.includes(target)) game.offers[pair]={from:id,to:target,type,until:game.tick+40};
        else{
          if(type==='peace'&&status==='war'&&(game.warSince?.[pair]??-99)+30>game.tick) return 'Das Reich lehnt ab: Der Krieg ist noch zu jung für Frieden.';
          if(type==='peace'&&status==='war'&&owned(game,target).length>owned(game,id).length*1.6) return 'Das Reich lehnt ab: Es fühlt sich überlegen.';
          game.relations[pair]=type;
          if(type==='peace')(game.peaceSince||={})[pair]=game.tick;
        }
      }
      const labels = {war:'Krieg',alliance:'Bündnis',peace:'Frieden'};
      const offer = game.offers[pair];
      log(game,`${folk.realm} und ${enemy.realm}: ${offer?'Angebot für '+labels[offer.type]:labels[game.relations[pair]]}.`,[id,target],type==='war'?'danger':'info');
    } else if (type==='spy') {
      const victim = Object.hasOwn(game.tiles,target) ? game.tiles[target] : null;
      if (!victim || !state.explored[target] || victim.owner===id || state.stock.coin<22 || !owns(game,id,'spy') || !['scout','sabotage'].includes(key)) return 'Spionage erfordert eine bekannte Provinz, den Nachrichtendienst und 22 Kronen.';
      if (key==='sabotage' && (!victim.owner || relation(game,id,victim.owner)!=='war' || (!victim.build && !victim.train))) return 'Sabotage erfordert ein feindliches Bau- oder Rekrutierungsprojekt.';
      state.stock.coin-=22;
      if (key==='scout') {
        state.scouted[target]=game.tick+12;
        const names=unitList(victim.owner).filter(unit=>victim.army[unit.id]).map(unit=>`${victim.army[unit.id]} × ${unit.name}`);
        const work=[victim.build&&byId(buildings,victim.build.key)?.name,victim.train&&(victim.train.key==='drill'?'Garnisonsmanöver':byId(unitList(victim.owner),victim.train.key)?.name)].filter(Boolean);
        log(game,`Späher in ${lookup[target].name}: ${victim.dragon?'Uralter Drache':names.join(', ')||'keine Garnison'} · Mauern St. ${victim.sites.wall||0} · Aufträge: ${work.join(', ')||'keine'}.`,[id]);
      } else {
        const job=victim.build||victim.train;
        job.due+=4;
        if(job.ends) job.ends=job.ends.map(end=>end+4);
        log(game,`Sabotage in ${lookup[target].name}: Das Projekt verzögert sich um 4 Takte.`,[id],'success');
        log(game,`Ein Projekt in ${lookup[target].name} wurde sabotiert.`,[victim.owner],'danger');
      }
    } else return 'Unbekannter Befehl.';
    return '';
  }
  function selectArmy(id,region,selection){
    if(!selection||typeof selection!=='object')return null;
    const army={};
    for(const unit of unitList(id)){
      const amount=selection[unit.id]??0;
      if(!Number.isSafeInteger(amount)||amount<0||amount>(region.army[unit.id]||0))return null;
      if(amount)army[unit.id]=amount;
    }
    return army;
  }
  function expeditionPlan(game,id,place,selection){
    const region=game.tiles[place];
    const army=region?.owner===id?selectArmy(id,region,selection):null;
    const size=count(army);
    const food=22+size*2;
    const power=armyStrength(id,army||{},region?.armyXP);
    const resistance=35+game.factions[id].age*30;
    const chance=clamp(.28+.60*power/(power+resistance),.28,.87);
    const why=!army||size<3?'Mindestens drei Truppen aus einer eigenen Provinz wählen':(game.expeditions||[]).some(item=>item.owner===id)?'Ein Raubzug läuft bereits':game.factions[id].stock.food<food?'Zu wenig Nahrung':'';
    return {why,army,time:raidDuration,food,chance};
  }
  function advance(game,random = Math.random) {
    if (game.winner) return;
    game.tick++;
    game.eliminated||={};
    for(const [pair,offer] of Object.entries(game.offers)){
      if(offer.until<=game.tick){
        delete game.offers[pair];
        log(game,'Ein diplomatisches Angebot ist verfallen.',[offer.from,offer.to]);
      }
    }
    const survivors = (army,rate) => Object.fromEntries(Object.entries(army).map(([key,amount]) => {
      const precise = amount*rate;
      return [key,Math.floor(precise)+Number(random()<precise%1)];
    }));
    const retreat = (march,army) => {
      const candidates=neighbors[march.to].filter(tile=>game.tiles[tile].owner===march.owner);
      const home = candidates.includes(march.from)?march.from:candidates[0];
      if (home) reinforce(game.tiles[home],army,march.armyXP);
      return Boolean(home);
    };
    for (const folk of peoples) {
      const state = game.factions[folk.id];
      for(const [place,until] of Object.entries(state.scouted)) if(until<=game.tick) delete state.scouted[place];
      if(game.tick%economyInterval(game)===0){
        const earnings=economy(game,folk.id).actual;
        for(const key of Object.keys(earnings))state.stock[key]+=earnings[key];
        if(state.stock.food<=0){
          let lost=0;
          for(const tile of owned(game,folk.id)){
            const army=game.tiles[tile.id].army;
            const biggest=Object.entries(army).filter(([key])=>key!=='dragon').sort((a,b)=>b[1]-a[1])[0];
            if(biggest&&count(army)>3){army[biggest[0]]-=Math.max(1,Math.floor(biggest[1]*.06));lost++;if(army[biggest[0]]<=0)delete army[biggest[0]];}
          }
          if(lost&&game.humans.includes(folk.id))log(game,`Hunger: Truppen desertieren in ${lost} Provinzen.`,[folk.id],'danger');
        }
      }
      if(state.study?.due<=game.tick) completeStudy(game,folk.id);
      if(state.mentoring?.due<=game.tick) completeMentoring(game,folk.id);
    }
    for (const tile of map) {
      const region = game.tiles[tile.id];
      if (region.blessing?.due<=game.tick) region.blessing=null;
      updateWork(game,tile);
    }
    for(const {id} of peoples) startStudy(game,id);
    const arrivals = game.marches.filter(march => march.due<=game.tick);
    game.marches = game.marches.filter(march => march.due>game.tick);
    const eliminate=(id)=>{
      game.eliminated[id]=game.tick;
      game.factions[id].study=null;
      delete game.factions[id].studyQueue;
      game.factions[id].mentoring=null;
      game.marches=game.marches.filter(item=>item.owner!==id);
      game.expeditions=(game.expeditions||[]).filter(item=>item.owner!==id);
      for(const pair of Object.keys(game.offers)) if(pair.split('/').includes(id)) delete game.offers[pair];
      let released=0;
      for(const tile of map){
        const region=game.tiles[tile.id];
        if(region.owner!==id)continue;
        released++;
        region.owner=null;region.army=tile.barbarian?{club:3,sling:1}:{club:2};region.armyXP=0;
        region.sites={};region.build=null;region.train=null;region.blessing=null;region.settledAt=0;
        delete region.buildQueue;delete region.trainQueue;delete region.cityClaim;delete region.cityFootprint;delete region.pendingFoundation;
      }
      log(game,`${byId(peoples,id).realm} hat die letzte Stadt verloren und ist vernichtet. ${released?`${released} Dörfer lösen sich zu Barbarensiedlungen auf.`:''} Verbliebene Heere lösen sich auf.`,[],'danger');
    };
    const cities=id=>owned(game,id).filter(tile=>game.tiles[tile.id].sites.hall).length;
    for (const march of arrivals) {
      if(defeated(game,march.owner)) continue;
      const region = game.tiles[march.to];
      if(march.returning){
        if(region.owner===march.owner){
          reinforce(region,march.army,march.armyXP);
          if(march.scout)log(game,`Kundschafter in ${lookup[march.to].name} zurückgekehrt.`,[march.owner]);
        }
        else if(!retreat(march,march.army)) log(game,'Die Rückkehr scheitert: kein eigener Rückzugsort.',[march.owner],'danger');
        continue;
      }
      if(march.scout){
        const state=game.factions[march.owner];
        state.scouted[march.to]=Math.max(state.scouted[march.to]||0,game.tick+scoutReportTicks);
        const returnTime=Math.max(1,game.tick-march.started);
        game.marches.push({...march,from:march.to,to:march.from,returnFraction:1,returning:true,started:game.tick,due:game.tick+returnTime});
        log(game,`Kundschafterbericht aus ${lookup[march.to].name}: Ziel und angrenzende Gebiete aufgeklärt. Die Kundschafter kehren zurück.`,[march.owner],'success');
        continue;
      }
      game.factions[march.owner].scouted[march.to]=Math.max(game.factions[march.owner].scouted[march.to]||0,game.tick+2);
      if(march.raid&&(region.owner===march.owner||region.dragon||(region.raidReady||0)>game.tick)){
        retreat(march,march.army);
        log(game,`Raubzug nach ${lookup[march.to].name} abgebrochen: kein geeignetes Ziel mehr.`,[march.owner]);
        continue;
      }
      if (region.owner===march.owner) {
        reinforce(region,march.army,march.armyXP);
        log(game,`${lookup[march.to].name}: Heer und Garnison vereinigt – ${count(region.army)} Einheiten.`,[march.owner]);
        continue;
      }
      if(march.reinforce){
        const returned=retreat(march,march.army);
        log(game,`Verstärkung nach ${lookup[march.to].name} abgebrochen: Zielprovinz verloren. ${returned?'Die Truppen ziehen sich zurück.':'Ohne eigenen Rückzugsort löst sich das Heer auf.'}`,[march.owner],'danger');
        continue;
      }
      if (region.owner && relation(game,march.owner,region.owner)!=='war') {
        const returned=retreat(march,march.army);
        log(game,`Marsch nach ${lookup[march.to].name} beendet: ${returned?'Ohne Kriegserklärung zieht sich das Heer zurück.':'Kein eigener Rückzugsort: Das Heer löst sich auf.'}`,[march.owner]);
        continue;
      }
      const {defend,chance,outcome,defCount,attackerLosses,defenderLosses}=battle(game,march.owner,march.army,march.to,march.blessing,march.armyXP,march.heroRank,random,{from:march.from});
      const {victory,atkRemain,phases,atkAfterCombat,defAfterCombat,finalAttack,finalDefend}=outcome;
      const old = region.owner;
      const refuge = old && neighbors[march.to].find(tile => game.tiles[tile].owner===old);
      const defRemain = victory&&!refuge&&!march.raid?{}:outcome.defRemain;
      let flankSurvivors=0;
      const flankReport=[];
      for(const group of outcome.supports){
        if(!group.amount)continue;
        const local=game.tiles[group.place];
        for(const [key,amount] of Object.entries(group.army))local.army[key]-=amount-(group.remain[key]||0);
        const saved=count(group.remain);
        flankSurvivors+=saved;
        if(count(local.army)&&saved) local.armyXP=Math.min(100,(local.armyXP||0)+(victory?4:8));
        else if(!count(local.army)) local.armyXP=0;
        flankReport.push(`${lookup[group.place].name}: ${group.amount} beteiligt, ${group.amount-saved} verloren`);
      }
      if(defend>0){
        march.armyXP=Math.min(100,(march.armyXP||0)+(victory?14:7));
        region.armyXP=Math.min(100,(region.armyXP||0)+(victory?7:14));
        const attacker=game.factions[march.owner];
        if(march.blessing&&count(atkRemain)) attacker.heroXP=Math.min(16,(attacker.heroXP||0)+(victory?2:1));
        if(old&&region.blessing&&count(defRemain)) game.factions[old].heroXP=Math.min(16,(game.factions[old].heroXP||0)+(victory?1:2));
      }
      const returned=(!victory||march.raid)?retreat(march,atkRemain):false;
      const attackerSaved=victory&&!march.raid||returned?count(atkRemain):0;
      const startAttack=count(march.army);
      const losses=`${startAttack-attackerSaved} / ${defCount-count(defRemain)-flankSurvivors} Verluste (Angriff / Verteidigung)`;
      const combatLosses=`${startAttack-atkAfterCombat} / ${defCount-defAfterCombat}`;
      const withdrawalLosses=`${atkAfterCombat-count(atkRemain)} / ${defAfterCombat-count(outcome.defRemain)-flankSurvivors}`;
      const stranded=`${count(atkRemain)-attackerSaved} / ${count(outcome.defRemain)-count(defRemain)}`;
      const detail={kind:'battle',rules:'combat-2026-11-21-balanced',from:march.from,target:march.to,terrain:lookup[march.to].biome,
        attacker:march.owner,defender:old,victory,phase:phases,forecast:{chance,attackerLosses,defenderLosses,rollCount:combatRolls},
        losses:{
          attack:{started:startAttack,combat:startAttack-atkAfterCombat,withdrawal:atkAfterCombat-count(atkRemain),stranded:count(atkRemain)-attackerSaved,survivors:attackerSaved},
          defense:{started:defCount,combat:defCount-defAfterCombat,withdrawal:defAfterCombat-count(outcome.defRemain)-flankSurvivors,
            stranded:count(outcome.defRemain)-count(defRemain),survivors:count(defRemain)+flankSurvivors}},
        attackerReturned:returned,defenderRefuge:refuge||null,flanks:outcome.supports,...outcome.report};
      if(victory&&march.raid){
        region.army=defRemain;
        region.raidReady=game.tick+raidCooldown;
        const stock=game.factions[march.owner].stock;
        const victim=old?game.factions[old].stock:null;
        const loot={coin:Math.min(victim?.coin??25,25),food:Math.min(victim?.food??18,18)};
        if(returned&&count(atkRemain)) for(const [key,amount] of Object.entries(loot)){stock[key]+=amount;if(victim)victim[key]-=amount;}
        log(game,`Raubzug: ${lookup[march.to].name} behält seinen Besitzer. ${returned&&count(atkRemain)?`Beute: ${loot.coin} Kronen und ${loot.food} Nahrung.`:'Keine Beute kehrt zurück.'}`,[march.owner,old],'success');
      } else if (victory) {
        const state=game.factions[march.owner];
        const center=game.tiles[region.cityClaim];
        if(center?.pendingFoundation){
          const charter=region.cityClaim;
          for(const member of center.cityFootprint) delete game.tiles[member].cityClaim;
          for(const [key,amount] of Object.entries(center.pendingFoundation.cost)) game.factions[center.owner].stock[key]+=amount;
          delete center.cityFootprint;
          delete center.pendingFoundation;
          if(center.build?.key==='hall'&&center.build.stage===1)center.build=null;
          log(game,`Stadtgründung in ${lookup[charter].name} abgebrochen: Ein Teil des Gründungsgebiets ging verloren. Baukosten erstattet.`,[center.owner],'danger');
        }
        if(region.dragon){
          state.amulets.push(region.dragon);
          log(game,`Drache besiegt: ${amulets[region.dragon][0]} erbeutet! ${roles[amulets[region.dragon][1]]} erhält +12 % Stärke (bis +36 %).`,[march.owner],'success');
          region.dragon=null;
        }
        if(region.treasure){
          state.stock.coin+=85;
          state.stock.science+=25;
          log(game,`Schatz in ${lookup[march.to].name}: +85 Kronen und +25 Wissen.`,[march.owner],'success');
          region.treasure=false;
        }
        if (refuge) reinforce(game.tiles[refuge],defRemain,region.armyXP);
        region.owner=march.owner;
        region.settledAt=game.tick+(capitalInCampaign(game,lookup[march.to])?14:8);
        region.army=atkRemain;
        region.armyXP=count(atkRemain)?march.armyXP||0:0;
        region.build=null;
        region.train=null;
        delete region.buildQueue;
        delete region.trainQueue;
        if(old&&!defeated(game,old)&&!cities(old)) eliminate(old);
      } else {
        region.army=defRemain;
      }
      region.blessing=null;
      const odds = Math.round(chance*100);
      const rounds=phases.map(phase=>`${phase.name} ${phase.attack} : ${phase.defend}${phase.breach?` (${phase.breach} % Mauerschutz gebrochen)`:''}`).join(' · ');
      log(game,`${lookup[march.to].name}: ${victory?march.raid?'Raubzug gelungen':'Erobert':'Angriff abgewehrt'} · ${startAttack} gegen ${defCount} Einheiten · ${odds} % Angriffschance · ${losses}.${rounds?` Gefecht ${combatLosses} · Rückzug ${withdrawalLosses}${stranded!=='0 / 0'?` · ohne Rückzugsort ${stranded}`:''}. ${rounds} · Schlussstärke ${finalAttack} : ${finalDefend}.`:''}${flankReport.length?` Flanken: ${flankReport.join(' · ')}.`:''}`,[march.owner,old],victory?'success':'danger',detail);
    }
    const finished=(game.expeditions||[]).filter(item=>item.due<=game.tick);
    game.expeditions=(game.expeditions||[]).filter(item=>item.due>game.tick);
    for(const group of finished){
      const home=game.tiles[group.from].owner===group.owner?lookup[group.from]:owned(game,group.owner).sort((first,second)=>Math.hypot(first.x-lookup[group.from].x,first.y-lookup[group.from].y)-Math.hypot(second.x-lookup[group.from].x,second.y-lookup[group.from].y))[0];
      if(!home)continue;
      const roll=random();
      const success=roll<group.chance;
      const survival=success?.83+random()*.15:.47+random()*.22;
      const survivorsArmy=survivors(group.army,survival);
      const returned=count(survivorsArmy);
      const earned=success?16:8;
      reinforce(game.tiles[home.id],survivorsArmy,Math.min(100,group.armyXP+earned));
      const stock=game.factions[group.owner].stock;
      const {capacity}=economy(game,group.owner);
      const loot=success&&returned?Object.entries({food:Math.min(48,12+returned*4),wood:Math.min(45,10+returned*3),coin:Math.min(65,15+returned*5)}).map(([key,amount])=>{
        const gained=Math.max(0,Math.min(amount,capacity[key]-stock[key]));
        stock[key]+=gained;
        return [resources[key][0],gained];
      }).filter(([,amount])=>amount>0):[];
      log(game,`Raubzug beendet in ${home.name}: ${returned} zurück, ${count(group.army)-returned} verloren. ${returned?`+${earned} EP für Rückkehrer.`:'Keine Überlebenden.'} ${loot.length?`Beute: ${loot.map(([label,value])=>`${value} ${label}`).join(', ')}.`:success&&returned?'Kein Lagerplatz für Beute.':'Keine Beute.'}`,[group.owner],success?'success':'danger',
        {kind:'expedition',owner:group.owner,from:group.from,returnedTo:home.id,success,chance:group.chance,roll,survival,army:group.army,survivors:survivorsArmy,experience:earned,loot});
    }
    if (game.tick%6===0) for (const tile of map) {
      const region = game.tiles[tile.id];
      if (!region.owner && !region.dragon && tile.barbarian && count(region.army)<7) reinforce(region,{club:1});
    }
    const territories=new Map(peoples.map(({id})=>[id,[]]));
    for(const tile of map) territories.get(game.tiles[tile.id].owner)?.push(tile);
    for(const folk of peoples) if(!defeated(game,folk.id)&&game.roster.includes(folk.id)&&!cities(folk.id)) eliminate(folk.id);
    game.provinceCount=Object.fromEntries(peoples.map(({id})=>[id,territories.get(id).length]));
    game.provinceMax=Math.max(1,...Object.values(game.provinceCount));
    const remaining=peoples.filter(folk=>game.roster.includes(folk.id)&&!defeated(game,folk.id));
    if(remaining.length===1){
      game.winner=remaining[0].id;
      log(game,`${remaining[0].realm} bleibt als letztes Reich bestehen!`,[],'success');
      return;
    }
    if (game.tick%difficulty(game).interval===0) for (const folk of remaining) if (!game.humans.includes(folk.id)) ai(game,folk.id,random);
    for(const folk of peoples) revealMap(game,folk.id);
  }
  function ai(game,id,random) {
    const state=game.factions[id];
    const provinces=owned(game,id);
    const city=provinces.find(tile=>tile.capital)||provinces[0];
    if(!city) return;
    const seen=sight(game,id);
    const ledger=economy(game,id,provinces);
    const stance=byId(peoples,id).doctrine;
    const rules=difficulty(game);
    const region=value=>game.tiles[value];
    const campaign=provinces.length>=24;
    const canAttack=enemy=>game.tick>=(state.nextAttack||0)&&game.tick>=(game.factions[enemy]?.nextIncomingAI||0);
    const isRival=(place)=>seen.has(place)&&region(place).owner&&region(place).owner!==id&&relation(game,id,region(place).owner)!=='alliance';
    const frontier=provinces.filter(tile=>neighbors[tile.id].some(place=>region(place).owner!==id));
    const basePriority=['farm','lumber','quarry','hall','mine','range','barracks','academy','stable','market','forge','wall','temple','lab','gate','granary','watch','mint','foundry','observatory','factory',factions[id].building];
    const hostileMarches=game.marches.filter(march=>!march.returning&&!march.reinforce&&!march.scout&&region(march.to).owner===id
      &&relation(game,id,march.owner)==='war'&&seen.has(march.from));
    const incoming=new Set(hostileMarches.map(march=>march.to));
    const threatenedCapital=place=>region(place).sites.hall&&neighbors[place].some(other=>
      seen.has(other)&&relation(game,id,region(other).owner)==='war');
    const era=milestones[state.age];
    const agePlan=era?studyPlan(game,id,'age'):null;
    const goalTech=new Set();
    const goalSites=new Map();
    const addTech=(key)=>{
      if(goalTech.has(key)||state.tech.includes(key))return;
      goalTech.add(key);
      const link=technologyLinks[key];
      for(const prerequisite of link?.tech||[])addTech(prerequisite);
      if(link?.site)addSite(...link.site);
    };
    function addSite(key,level){
      if((goalSites.get(key)||0)>=level||provinces.some(tile=>(region(tile.id).sites[key]||0)>=level&&(region(tile.id).settledAt||0)<=game.tick))return;
      goalSites.set(key,level);
      const item=byId(buildings,key);
      if(item.req)addSite(...item.req);
      if(level>1&&key!=='hall')addSite('hall',level);
      for(const unlock of buildingTech[key]||[])addTech(unlock);
    }
    for(const key of era?.tech||[])addTech(key);
    for(const site of era?.sites||[])addSite(...site);
    const saving=Boolean(agePlan&&!state.study&&!agePlan.needed.length&&agePlan.shortage.length);
    const protectedPayment=saving?agePlan.payment:{};
    const withinBudget=(price)=>Object.entries(price).every(([key,amount])=>state.stock[key]>=amount+(protectedPayment[key]||0));
    if(!state.study&&action(game,id,{type:'study',key:'age'})&&!saving){
      const priority=[...goalTech,'cultivation','carpentry','prospectingEarly','bronze','barter','masonry','ledger','ironworking','siegecraft','printing','engineering','steel','electricity','electronics','network','rocketry','fusion',factions[id].research];
      const next=[...new Set([...priority,...techs.filter(tech=>!tech.faction||tech.faction===id).map(tech=>tech.id)])].find(key=>!studyPlan(game,id,key).why);
      if(next) action(game,id,{type:'study',key:next});
    }
    const assault=campaign?frontier.flatMap(tile=>neighbors[tile.id].filter(place=>{
      const enemy=region(place).owner;
      return region(place).sites.hall&&isRival(place)&&canAttack(enemy)&&(game.tick>=rules.truce||relation(game,id,enemy)==='war');
    }).map(place=>({tile,place,army:count(region(tile.id).army)}))).sort((first,second)=>second.army-first.army)[0]:null;
    const pressure=(tile)=>Number(incoming.has(tile.id))*20+Number(campaign&&neighbors[tile.id].some(isRival))*12+(tile.id===assault?.tile.id?26:0);
    const border=frontier.filter(tile=>tile.id!==city.id&&(!region(tile.id).settledAt||region(tile.id).settledAt<=game.tick)).sort((first,second)=>pressure(second)-pressure(first)||count(region(second.id).army)-count(region(first.id).army))[0];
    const citySite=provinces.length>=8&&!provinces.some(tile=>region(tile.id).pendingFoundation)?provinces.find(tile=>
      !region(tile.id).sites.hall&&!region(tile.id).cityClaim&&foundationPlan(game,id,tile.id).footprint):null;
    if(citySite&&withinBudget(byId(buildings,'hall').cost))action(game,id,{type:'build',place:citySite.id,key:'hall'});
    for(const place of [city,...(border&&region(border.id).sites.hall?[border]:[])]){
      if(region(place.id).build||queueFor(region(place.id),'build').length) continue;
      const options=basePriority.map((key,index)=>{
        const calc=construction(game,id,place.id,byId(buildings,key));
        let score=36-index*.42-calc.stage*5;
        if((goalSites.get(key)||0)>=calc.stage&&place===city) score+=48;
        if(key==='hall'&&!region(place.id).sites.hall&&era&&ledger.developed<era.settled) score+=34;
        if(key===stance.build) score+=6;
        if(key==='farm'&&(ledger.net.food<5||state.stock.food<80)) score+=28;
        if(key==='wall'&&incoming.has(place.id)) score+=24;
        if(key==='hall'&&!region(place.id).sites.hall&&place===border) score+=30;
        if(key==='barracks'&&place===border) score+=13;
        if(key==='hall'&&calc.stage===2&&state.age>=2) score+=12;
        return {key,calc,score};
      }).filter(item=>!item.calc.why&&withinBudget(item.calc.cost)).sort((first,second)=>second.score-first.score);
      if(options[0]) action(game,id,{type:'build',place:place.id,key:options[0].key});
    }
    if(state.stock.influence>35&&!peoples.some(folk=>relation(game,id,folk.id)==='war')){
      if(state.age>=1&&stance.build==='market'&&state.government==='tribe') action(game,id,{type:'government',key:'republic'});
    }
    if(state.stock.food<65&&state.stock.coin>=45&&owns(game,id,'market')) action(game,id,{type:'trade',key:'food',side:'buy'});
    const recruitAt=[city,...(border?[border]:[])];
    for(const place of recruitAt){
      if(region(place.id).train||queueFor(region(place.id),'train').length) continue;
      const garrison=region(place.id).army;
      const total=count(garrison);
      if(total>(place.id===assault?.tile.id?25:incoming.has(place.id)?18:12+state.age)||state.stock.food<28||ledger.net.food<-3&&state.stock.food<95) continue;
      const enemyMix={};
      for(const neighbor of neighbors[place.id]){
        if(!seen.has(neighbor)||!region(neighbor).owner||region(neighbor).owner===id) continue;
        for(const unit of unitList(region(neighbor).owner)) enemyMix[unit.role]=(enemyMix[unit.role]||0)+(region(neighbor).army[unit.id]||0);
      }
      const unit=unitList(id).filter(item=>withinBudget(item.cost)&&!recruitment(game,id,place.id,item).why).map(item=>{
        const weight=Object.entries(item.cost).reduce((sum,[key,value])=>sum+value*(state.stock[key]<value*2?1.6:1),0);
        const counter=counters[item.role].reduce((sum,role)=>sum+(enemyMix[role]||0),0);
        const score=(item.atk+item.def)/(1+Math.sqrt(weight)*.07)+Math.min(12,counter)*2+Number(item.role===stance.role)*7-(garrison[item.id]||0)*1.8;
        return {id:item.id,score};
      }).sort((first,second)=>second.score-first.score)[0];
      if(unit) action(game,id,{type:'train',place:place.id,key:unit.id});
    }
    const outbound=game.marches.filter(march=>march.owner===id);
    const canExpand=game.tick>=(state.nextClaim||0)&&!outbound.some(march=>march.claim);
    const destinations=new Set(outbound.map(march=>march.to));
    const committed=new Set(outbound.map(march=>march.from));
    const keep=(tile)=>{
      const army={...region(tile.id).army};
      let reserve=threatenedCapital(tile.id)?7:tile.capital?3:1;
      for(const key of Object.keys(army).sort((first,second)=>army[second]-army[first])){
        if(key==='elite') continue;
        const kept=Math.min(army[key],reserve);
        army[key]-=kept;reserve-=kept;
        if(!reserve) break;
      }
      return army;
    };
    if(game.tick>=state.heroReady&&state.stock.influence>=8){
      const threat=hostileMarches.find(march=>!region(march.to).blessing&&count(region(march.to).army)
        &&march.due-game.tick<10&&(lookup[march.to].capital||count(march.army)>=count(region(march.to).army)));
      if(threat) action(game,id,{type:'hero',place:threat.to});
    }
    const opportunities=[];
    for(const tile of frontier){
      if(committed.has(tile.id)||incoming.has(tile.id)) continue;
      const army=keep(tile);
      if(count(army)<3) continue;
      for(const target of neighbors[tile.id]){
        if(tile.id===assault?.tile.id&&target!==assault.place) continue;
        if(region(target).owner===id||destinations.has(target)) continue;
        if(!seen.has(target)){
          if(canExpand&&seaRoute(tile.id,target)&&count(army)>=5) opportunities.push({place:tile.id,target,army,claim:true,score:.46});
          continue;
        }
        const enemy=region(target).owner;
        if(!enemy&&!canExpand)continue;
        if(enemy&&!canAttack(enemy))continue;
        if(enemy&&region(target).sites.hall&&game.tick<3000)continue;
        const status=relation(game,id,enemy);
        if(status==='alliance') continue;
        const peace=enemy&&status!=='war';
        if(peace&&(game.tick<rules.truce||count(army)<7)) continue;
        const {blessing,armyXP}=region(tile.id);
        const position={from:tile.id,visible:seen};
        const normal=battle(game,id,army,target,blessing?.style,armyXP,blessing?.rank||1,undefined,position);
        const hero=!blessing&&game.tick>=state.heroReady&&state.stock.influence>=12;
        const boosted=hero?battle(game,id,army,target,id,armyXP,undefined,undefined,position):normal;
        const odds=boosted.chance;
        const escalation=Math.min(.16,Math.max(0,game.tick-2500)/60000);
        const threshold=Math.min(.98,(peace?(campaign?.76:.90):stance.nerve)+rules.risk-escalation);
        if(odds<threshold) continue;
        const value=(region(target).sites.hall?.6:0)+(region(target).dragon?.20:region(target).treasure?.15:0)+(campaign&&enemy?.48:0);
        const warPenalty=peace?(campaign?.12:.30):0;
        const usesHero=boosted!==normal&&(odds-normal.chance>.12||normal.chance<threshold||normal.attackerLosses-boosted.attackerLosses>=2);
        const forecast=usesHero?boosted:normal;
        const cost=forecast.attackerLosses/count(army);
        opportunities.push({place:tile.id,target,army,enemy,peace,claim:!enemy,hero:usesHero,score:forecast.chance+value-warPenalty-.30*cost+.08*random()});
      }
    }
    const chosen=opportunities.sort((first,second)=>second.score-first.score)[0];
    if(chosen&&(!assault||chosen.target===assault.place||outbound.length<2)){
      if(chosen.peace){
        if(action(game,id,{type:'war',target:chosen.enemy}))return;
        if(rules.mobilize){
          state.nextAttack=game.tick+rules.mobilize;
          game.factions[chosen.enemy].nextIncomingAI=state.nextAttack;
          log(game,`${byId(peoples,id).realm} sammelt Truppen. Ein KI-Angriff ist frühestens in ${rules.mobilize*2} Spielsekunden möglich.`,[id,chosen.enemy],'danger');
          return;
        }
      }
      if(chosen.hero) action(game,id,{type:'hero',place:chosen.place});
      if(action(game,id,{...chosen,type:'march'}))return;
      if(chosen.claim){
        game.marches.at(-1).claim=true;
        state.nextClaim=game.tick+rules.claimGap+Math.min(6,Math.floor(Math.max(0,provinces.length-7)/14));
      } else if(chosen.enemy&&rules.attackGap){
        state.nextAttack=game.tick+rules.attackGap;
        game.factions[chosen.enemy].nextIncomingAI=game.tick+rules.targetGap;
      }
      return;
    }
    const forward=frontier.filter(tile=>!destinations.has(tile.id)&&count(region(tile.id).army)<(tile.id===assault?.tile.id?20:9)).sort((first,second)=>pressure(second)-pressure(first));
    if(!forward.length) return;
    const routes=new Map(forward.map(tile=>[tile.id,null]));
    const queue=forward.map(tile=>tile.id);
    for(let index=0;index<queue.length;index++){
      const current=queue[index];
      for(const place of neighbors[current]) if(region(place).owner===id&&!routes.has(place)){
        routes.set(place,current);queue.push(place);
      }
    }
    const source=provinces.filter(tile=>routes.get(tile.id)&&!destinations.has(routes.get(tile.id))&&!committed.has(tile.id)&&count(region(tile.id).army)>=6).sort((first,second)=>count(region(second.id).army)-count(region(first.id).army))[0];
    if(source){
      const army=keep(source);
      if(count(army)>=4) action(game,id,{type:'march',place:source.id,target:routes.get(source.id),army});
    }
  }
  const api={create,hydrate,advance,action,income,economy,economyInterval,construction,buildPlan,recruitment,workOrders,workQueueLimit,trainingGroupLimit,scoutReportTicks,studyPlan,tradePlan,rushPlan,battle,relation,relationKey,owned,count,unitList,armyStrength,combineArmies,expeditionPlan,revealMap,view,amulets,difficulties,difficulty,defeated,heroLevel,veteranLevel,capitalInCampaign};
  if (typeof module!=='undefined') module.exports=api;
  else globalThis.Engine=api;
})();

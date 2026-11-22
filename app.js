(async () => {
  const {peoples,powers,ages,eraCost,milestones,terrain,buildings,buildingTech,unitTech,technologyLinks,techs,factions,governments,faiths,resources,roles,counters,map,neighbors,lookup,crossings,landmarks} = World;
  const {create,hydrate,advance,action,economy,buildPlan,recruitment,studyPlan,rushPlan,battle,relation,relationKey,owned,count,unitList,revealMap,amulets,difficulties,difficulty,defeated,heroLevel,veteranLevel} = Engine;
  const {createClock,tickMs}=GameClock;
  const [terrainTexture,townArt]=await Promise.all([Relief.loadTextures(),Relief.loadTownArt()]);
  const get = (id) => document.getElementById(id);
  const folk = (id) => peoples.find(item => item.id===id);
  const building = (id) => buildings.find(item => item.id===id);
  const tech = (id) => techs.find(item => item.id===id);
  const saveKey = 'aeonenreiche-v2';
  const largeSaves=new Map();
  const saveDatabase=await new Promise(resolve=>{
    if(!globalThis.indexedDB){resolve(null);return;}
    try{
      const open=indexedDB.open('aeonenreiche-saves',1);
      open.onupgradeneeded=()=>open.result.createObjectStore('snapshots');
      open.onerror=open.onblocked=()=>resolve(null);
      open.onsuccess=()=>{
        const db=open.result;
        const cursor=db.transaction('snapshots').objectStore('snapshots').openCursor();
        cursor.onerror=()=>resolve(null);
        cursor.onsuccess=()=>{
          const entry=cursor.result;
          if(entry){largeSaves.set(entry.key,entry.value);entry.continue();}
          else resolve(db);
        };
      };
    }catch{resolve(null);}
  });
  const readSave = (key=saveKey) => {
    try {
      let local=null;
      try{local=JSON.parse(localStorage.getItem(key));}catch{}
      const large=JSON.parse(largeSaves.get(key)||'null');
      const slot=large&&(!local||large.writtenAt>= (local.writtenAt||0))?large:local;
      const snapshot=slot?.game;
      return snapshot?.version===2&&folk(slot.player)&&Number.isSafeInteger(snapshot.tick)&&snapshot.tick>=0&&Array.isArray(snapshot.events)&&Array.isArray(snapshot.marches)&&snapshot.factions?.[slot.player]?.explored&&map.every(tile=>tile.id.startsWith('g:')||snapshot.tiles?.[tile.id]?.sites&&snapshot.tiles[tile.id].army)?slot:null;
    } catch {return null;}
  };
  const saved = readSave();
  let campaignStarted=Boolean(saved);
  let resumeOnBoot=Boolean(saved&&saved.speed>0);
  let player = folk(saved?.player)?.id || 'aurel';
  let game = saved?.game?.version===2?hydrate(saved.game):create([player]);
  const capital = (id) => map.find(tile => tile.capital && tile.owner===id).id;
  let selected = capital(player);
  let screen = 'province';
  let tab = 'build';
  let army = {};
  let origin = null;
  let orderMode='march';
  let speed = 0;
  let simulationClock=createClock(performance.now());
  const regionalZoom=9;
  let zoom = regionalZoom;
  let focus = Relief.position(lookup[selected]);
  let cityOpen=false;
  let cityFilter='overview';
  let unitFilter='all';
  let researchFilter='current';
  let selectedSite=null;
  let visible=new Set();
  let drag = null;
  let ignoreMapClick = false;
  let room = null;
  let roomStarts=0;
  let clockRoom=null, clockTick=-1, clockSample=0;
  let marchTracks=new Map();
  let polling = false;
  let pending = false;
  let roomCommands=Promise.resolve();
  let recruitmentSpending={}, recruitmentReset;
  let revision = 0;
  let choose = player;
  let chooseLevel=game.difficulty||'standard';
  let selectedNode='';
  let selectedMarch=null;
  let resourceKey='food';
  let toastTimer;
  let historyPage=0, historyFilter='all', historySelection=null;
  let pressedControl=null;
  const nav = [['province',7,'Weltkarte'],['city',8,'Stadt'],['research',9,'Forschung'],['council',10,'Staatsrat'],['diplomacy',11,'Diplomatie'],['market',12,'Handel'],['economy',0,'Rohstoffbilanz']];
  const disabled = (why) => why?`disabled title="${why}"`:'';
  const button = (label,kind,data='',why='',style='ghost') => `<button type="button" class="${style}" data-do="${kind}" ${data} ${disabled(why)}>${label}</button>`;
  const data = (key) => `data-key="${key}"`;
  const cost = (items) => Object.entries(items).map(([key,value])=>`${resources[key][1]} ${value}`).join(' · ');
  const duration=(seconds)=>seconds<60?`${seconds} s`:`${Math.floor(seconds/60)} min ${seconds%60} s`;
  const time = (ticks) => `${duration(ticks*2)} bei 1×`;
  const clock = (tick) => `${String(Math.floor(tick*tickMs/60000)).padStart(2,'0')}:${String(Math.floor(tick*tickMs/1000)%60).padStart(2,'0')}`;
  const countdown = (job) => {
    const left=Math.max(0,job.due-game.tick);
    return speed>1?`${duration(Math.ceil(left*2/speed))} bei ${speed}×`:time(left);
  };
  const match = () => game.factions[player];
  const region = () => game.tiles[selected];
  const orderTarget=id=>origin&&orderMode!=='raid'&&neighbors[origin].includes(id)
    &&(orderMode!=='reinforce'||game.tiles[id].owner===player);
  const orderTargetHint=()=>orderMode==='reinforce'?'Wähle eine markierte eigene Nachbarprovinz.':orderMode==='scout'?'Wähle eine markierte Nachbarprovinz zum Aufklären.':'Wähle ein goldumrandetes Nachbargebiet.';
  const orderArmy=source=>orderMode==='scout'?{scout:source.army.scout||0}:source.army;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  function swap(id,html) {
    const node = get(id);
    if (node._rendered===html || pressedControl&&node.contains(pressedControl)) return;
    const buttonFocus = document.activeElement;
    const focusable = buttonFocus?.tagName==='BUTTON' && node.contains(buttonFocus) && buttonFocus.dataset.do;
    const queueScroll=Object.fromEntries([...node.querySelectorAll('[data-work-orders]')].map(queue=>[queue.dataset.workOrders,queue.scrollLeft]));
    node.innerHTML=html;
    node._rendered=html;
    for(const queue of node.querySelectorAll('[data-work-orders]')) queue.scrollLeft=queueScroll[queue.dataset.workOrders]||0;
    if (focusable) [...node.querySelectorAll('button')].find(entry=>entry.dataset.do===buttonFocus.dataset.do && entry.dataset.key===buttonFocus.dataset.key && entry.dataset.side===buttonFocus.dataset.side)?.focus({preventScroll:true});
  }
  let saveStamp=0;
  async function storeSave(key){
    saveStamp=Math.max(Date.now(),saveStamp+1);
    const text=JSON.stringify({game,player,speed,writtenAt:saveStamp});
    if(!saveDatabase||text.length<1500000&&!largeSaves.has(key))try{localStorage.setItem(key,text);return;}catch{}
    if(!saveDatabase)throw new Error('Kein freier Browserspeicher');
    await new Promise((resolve,reject)=>{
      const transaction=saveDatabase.transaction('snapshots','readwrite');
      transaction.objectStore('snapshots').put(text,key);
      transaction.oncomplete=()=>{largeSaves.set(key,text);resolve();};
      transaction.onerror=transaction.onabort=()=>reject(transaction.error);
    });
  }
  let saveWarning=0;
  function save() {
    if(!room)void storeSave(saveKey).catch(()=>{
      if(Date.now()-saveWarning<15000)return;
      saveWarning=Date.now();
      notice('Der Browser kann gerade nicht speichern. Die laufende Chronik lässt sich exportieren.');
    });
  }
  const saveSlots=[1,2,3];
  const slotKey=(slot)=>`${saveKey}-slot-${slot}`;
  const saveSummary=(snapshot)=>snapshot?`${folk(snapshot.player).name} · ${ages[snapshot.game.factions[snapshot.player].age]} · ${clock(snapshot.game.tick)} · ${difficulty(snapshot.game).label}`:'Leer';
  function notice(text) {
    get('toast').textContent=text;
    get('toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>get('toast').classList.remove('visible'),3500);
  }
  const mapNodes = {};
  const points = Object.fromEntries(map.map(tile=>[tile.id,Relief.position(tile)]));
  const seaRoutes=new Set(crossings.flatMap(([from,to])=>[`${from}/${to}`,`${to}/${from}`]));
  const between=(from,to,ratio)=>from.map((value,index)=>value+(to[index]-value)*ratio);
  function route(from,to){
    const start=points[from],end=points[to];
    const control=seaRoutes.has(`${from}/${to}`)?[(start[0]+end[0])/2+15,(start[1]+end[1])/2+18]:null;
    return {start,end,control};
  }
  const routePath=({start,end,control})=>`M${start.join(' ')}${control?`Q${control.join(' ')} `:'L'}${end.join(' ')}`;
  function routePosition({start,end,control},progress){
    return control?between(between(start,control,progress),between(control,end,progress),progress):between(start,end,progress);
  }
  const polygons=Object.fromEntries(map.map(tile=>[tile.id,Relief.border(tile)]));
  const boundaryEdges=Object.fromEntries(map.map(tile=>{
    const vertices=polygons[tile.id].split(' ');
    const samples=vertices.length/6;
    const edges=Array.from({length:6},(_,side)=>{
      const first=side*samples;
      const end=(first+samples)%vertices.length;
      const key=[vertices[first],vertices[end]].sort().join(' ');
      return [key,`M${vertices.slice(first,first+samples).join(' L')} L${vertices[end]}`];
    });
    return [tile.id,edges];
  }));
  function drawMap(texture){
    const {width,height}=Relief;
    const relief=Relief.paint(texture);
    const imageSize=`width="${width}" height="${height}"`;
    const routes=crossings.map(([from,to],index)=>`<path id="route-${index}" d="${routePath(route(from,to))}"/>`).join('');
    const territories=map.map(tile=>{
      const [x,y]=points[tile.id];
      return `<g class="territory ${tile.capital?'capital':''}" data-tile="${tile.id}" role="button" tabindex="-1" hidden><title></title><polygon class="territory-land" points="${polygons[tile.id]}" mask="url(#land-mask)"/><g class="settlement" transform="translate(${x} ${y})"><circle class="marker-halo" r="${tile.capital?15:12}"/><svg class="map-town" x="-11" y="-11" width="22" height="22" viewBox="0 0 1 1"><image href="assets/settlements.webp" width="4" height="2" preserveAspectRatio="none"/></svg><svg class="encounter" x="-10" y="-34" width="20" height="20" viewBox="2 3 1 1"><image href="assets/interface.webp" width="6" height="4" preserveAspectRatio="none"/></svg><text class="place-name" y="22" text-anchor="middle"></text><g class="army-stack" data-garrison="${tile.id}" transform="translate(15 -11)"><rect class="stack" x="-8" y="-6" width="16" height="12" rx="4"/><text class="stack-text" y="3" text-anchor="middle"></text><rect class="map-strength-track" x="-8" y="7" width="16" height="3" rx="1"/><rect class="map-strength-fill" x="-8" y="7" width="0" height="3" rx="1"/></g></g></g>`;
    }).join('');
    get('map').innerHTML=`<defs><mask id="land-mask" mask-type="alpha" maskUnits="userSpaceOnUse" x="0" y="0" ${imageSize}><image ${imageSize} href="${relief.mask}"/></mask><clipPath id="known-land"></clipPath><filter id="frontier-blur" x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation="12"/></filter><mask id="known-feather" maskUnits="userSpaceOnUse" x="0" y="0" ${imageSize}><g id="fogSoft" fill="white" filter="url(#frontier-blur)"></g></mask><marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0l10 5-10 5z" fill="#f2d18a"/></marker></defs><image class="landscape" ${imageSize} href="${relief.image}" clip-path="url(#known-land)" mask="url(#known-feather)"/><g id="fogMemory"></g><g class="ocean-routes">${routes}</g><g class="atlas-labels" id="regionLabels"></g><g class="territories">${territories}</g><g id="orderRoute" pointer-events="none"></g><g id="marches"></g>`;
    get('orderRoute').insertAdjacentHTML('beforebegin','<g id="ownFrontier" mask="url(#land-mask)" pointer-events="none" aria-hidden="true"></g>');
    get('frontier-blur').firstElementChild.setAttribute('stdDeviation','6');
    for (const node of get('map').querySelectorAll('[data-tile]')) mapNodes[node.dataset.tile]={node,stack:node.querySelector('.army-stack'),number:node.querySelector('.stack-text'),label:node.querySelector('.place-name'),encounter:node.querySelector('.encounter'),town:node.querySelector('.map-town'),title:node.querySelector('title')};
  }
  function renderMap() {
    const explored=match().explored;
    const discovered=Object.keys(explored);
    const ownLand=discovered.filter(id=>game.tiles[id].owner===player);
    const frontier=new Map();
    for(const id of ownLand) for(const [key,path] of boundaryEdges[id]){
      if(frontier.has(key)) frontier.delete(key);
      else frontier.set(key,path);
    }
    const borderPath=[...frontier.values()].join(' ');
    swap('ownFrontier',borderPath?`<path class="frontier-shadow" d="${borderPath}"/><path class="frontier-line" d="${borderPath}"/>`:'');
    get('ownLegend').textContent=`Eigenes Reich · ${ownLand.length} ${ownLand.length===1?'Provinz':'Provinzen'}`;
    const outlines=discovered.map(id=>`<polygon points="${polygons[id]}"/>`).join('');
    swap('known-land',outlines);
    swap('fogSoft',outlines);
    swap('fogMemory',discovered.filter(id=>!visible.has(id)).map(id=>`<polygon points="${polygons[id]}"/>`).join(''));
    const regions = new Set(discovered.map(id=>lookup[id].continent.toUpperCase()));
    swap('regionLabels',landmarks.filter(([name])=>regions.has(name)).map(([name,x,y])=>`<text class="continent-label" x="${x}" y="${y}" text-anchor="middle">${name}</text>`).join(''));
    crossings.forEach(([from,to],index)=>{
      const active=origin===from||origin===to;
      const endpoint=origin===from?to:from;
      const route=get(`route-${index}`);
      route.style.display=explored[from]&&explored[to]?'':'none';
      route.classList.toggle('route-ready',active&&Boolean(explored[endpoint]));
    });
    for (const tile of map) {
      const nodes = mapNodes[tile.id];
      const local = game.tiles[tile.id];
      const known=explored[tile.id];
      const inView=visible.has(tile.id);
      const next=orderTarget(tile.id);
      const blindRoute=next&&!known;
      if(!known&&!blindRoute){
        if(!nodes.node.hasAttribute('hidden')) nodes.node.setAttribute('hidden','');
        continue;
      }
      nodes.node.removeAttribute('hidden');
      nodes.node.setAttribute('tabindex','0');
      const owner = folk(known?.owner);
      const active = tile.id===selected;
      const color = owner?.color || (tile.barbarian?'#c29370':'#c7c098');
      nodes.node.style.setProperty('--owner',color);
      nodes.node.classList.toggle('selected',active);
      nodes.node.classList.toggle('reachable',Boolean(next));
      nodes.node.classList.toggle('claimed',Boolean(owner));
      nodes.node.classList.toggle('player-land',local.owner===player);
      nodes.node.classList.toggle('remembered',!inView);
      const city=Boolean(inView?local.sites.hall:known?.city||tile.capital);
      nodes.node.classList.toggle('city-marker',city);
      nodes.town.style.display=city?'':'none';
      nodes.town.previousElementSibling.style.display=city?'':'none';
      const size=city?(tile.capital?40:34):22;
      nodes.town.setAttribute('x',-size/2);
      nodes.town.setAttribute('y',-size/2);
      nodes.town.setAttribute('width',size);
      nodes.town.setAttribute('height',size);
      nodes.town.previousElementSibling.setAttribute('r',size/2+1);
      nodes.label.setAttribute('y',size/2+12);
      nodes.stack.setAttribute('transform',city?`translate(${size/2+5} ${-size/2})`:'translate(0 -2)');
      if(city){
        const town=inView&&local.sites.lab?3:inView&&local.sites.factory?2:
          inView&&local.sites.wall?4:inView&&local.sites.hall===1?0:1;
        const culture=owner&&inView&&local.sites.hall>=2&&!local.sites.factory&&!local.sites.lab&&!local.sites.wall?folkIndex(owner.id):-1;
        const sprite=nodes.town.firstElementChild;
        const file=culture>=0?'cultures':'settlements';
        const cell=culture>=0?culture:town;
        const art=townArt[file][cell];
        const source=art||`assets/${file}.webp`;
        if(sprite.getAttribute('href')!==source)sprite.setAttribute('href',source);
        sprite.setAttribute('width',art?'1':'4');
        sprite.setAttribute('height',art?'1':culture>=0?'4':'2');
        nodes.town.setAttribute('viewBox',art?'0 0 1 1':`${cell%4} ${Math.floor(cell/4)} 1 1`);
      }
      nodes.node.classList.toggle('blind-route',Boolean(blindRoute));
      nodes.label.textContent=known?tile.name.split(' · ')[0]:'Seeweg';
      nodes.title.textContent=known?`${tile.name} · ${city?tile.capital?'Hauptstadt':'Stadt':known.owner?'Dorf':'Freie Provinz'}${local.owner===player?' · Eigenes Reich':''}`:'Unerkundeter Seeweg';
      nodes.encounter.style.display=known?.dragon||known?.treasure?'':'none';
      nodes.encounter.setAttribute('viewBox',known?.dragon?'3 3 1 1':'2 3 1 1');
      nodes.node.setAttribute('aria-label',known?`${tile.name}, ${local.owner===player?'Eigenes Reich':owner?.name||'Neutral'}, ${terrain[tile.biome][0]}`:'Unerkundeter Seeweg');
      nodes.node.setAttribute('aria-pressed',String(active));
      const show = inView;
      nodes.stack.style.display = show && count(local.army)?'':'none';
      nodes.number.textContent = count(local.army);
      if(show&&count(local.army)){
        const strength=Engine.armyStrength(local.owner,local.army,local.armyXP);
        nodes.stack.querySelector('.map-strength-fill').setAttribute('width',meterWidth(strength,16));
        nodes.stack.setAttribute('aria-label',`Garnison: ${count(local.army)} Truppen, Grundstärke ${strength}`);
      }
    }
    const tracks=new Map();
    swap('marches',game.marches.flatMap(march=>{
      if (march.owner!==player && (!visible.has(march.from)||!visible.has(march.to))) return [];
      const previous=marchTracks.get(march.id);
      const sameLeg=previous?.march.from===march.from&&previous.march.to===march.to&&previous.march.started===march.started;
      let path=route(march.from,march.to);
      let turnaround;
      if(march.returning){
        const outbound=route(march.to,march.from);
        const previousProgress=previous?.march.from===march.to&&previous.march.to===march.from?previous.progress:0;
        turnaround=sameLeg?previous.turnaround:Math.max(march.returnFraction||0,previousProgress||0);
        path={start:routePosition(outbound,turnaround),end:outbound.start,
          control:outbound.control?between(outbound.start,outbound.control,turnaround):null};
      }
      tracks.set(march.id,{march:{...march},path,turnaround,progress:sameLeg?previous.progress:0});
      const color=folk(march.owner).color;
      const label=march.scout?(march.returning?'Kundschafter auf Rückweg':'Erkundung'):march.returning?'Rückmarsch':march.reinforce?'Verstärkung':march.raid?'Raubzug':'Marsch';
      const roster=armyRoster(march.owner,march.army);
      const summary=escapeHtml(`${label} · ${roster.map(unit=>`${march.army[unit.id]} × ${unit.name}`).join(' · ')}`);
      return `<path class="march-arrow" d="${routePath(path)}" stroke="${color}" stroke-width="3" marker-end="url(#arrow)"/><g class="march-token${selectedMarch===march.id?' active':''}" data-march="${march.id}" role="button" tabindex="0" aria-label="${summary}" style="--army-color:${color}"><title>${summary}</title><rect class="march-halo" x="${roster.length>2?-28:roster.length>1?-20:-15}" y="-15" width="${roster.length>2?56:roster.length>1?40:30}" height="36" rx="8"/>${marchArt(march.owner,roster)}<rect class="map-strength-track" x="-14" y="22" width="28" height="3" rx="1.5"/><rect class="map-strength-fill" x="-14" y="22" width="${meterWidth(Engine.armyStrength(march.owner,march.army,march.armyXP),28)}" height="3" rx="1.5"/><rect class="march-count" x="-10" y="7" width="20" height="13" rx="4"/><text x="0" y="17" text-anchor="middle">${count(march.army)}</text></g>`;
    }).join(''));
    for(const node of get('marches').querySelectorAll('[data-march]'))tracks.get(Number(node.dataset.march)).node=node;
    marchTracks=tracks;
    get('mapHint').textContent=origin?`Marsch aus ${lookup[origin].name} · Markiertes Ziel wählen`:'Ziehen zum Erkunden · Scrollen zum Zoomen';
    drawMinimap();
    renderMapOrder();
    animateMarches(performance.now());
  }
  const meterWidth=(strength,pixels)=>pixels*strength/(strength+90);
  function mapSplit(source){
    return `<div class="map-split"><strong id="mapOrderCount"></strong><div class="action-row">${[['quarter','25 %'],['half','50 %'],['most','75 %'],['all','100 %']].map(([key,label])=>button(label,'troop-preset',data(key))).join('')}</div><div class="map-unit-list">${armyRoster(player,orderArmy(source)).map(unit=>`<label class="unit-selection"><span>${unit.name}</span><input type="number" min="0" max="${source.army[unit.id]}" value="${Math.min(army[unit.id]||0,source.army[unit.id])}" data-army="${unit.id}" data-map-army aria-label="${unit.name}: Anzahl entsenden"><small>/ ${source.army[unit.id]}</small></label>`).join('')}</div></div>`;
  }
  function paintMapOrder(source,heading,title,live){
    const host=get('mapOrder');
    const editing=host.contains(document.activeElement)&&document.activeElement.matches('[data-map-army]');
    if(!editing)swap('mapOrder',`<span class="eyebrow">${heading}</span><strong>${title}</strong>${mapSplit(source)}<div id="mapOrderLive"></div>`);
    const total=Object.entries(army).reduce((sum,[key,amount])=>sum+Math.min(amount,source.army[key]||0),0);
    get('mapOrderCount').textContent=`${total} entsenden · ${count(source.army)-total} bleiben zurück`;
    swap('mapOrderLive',live);
  }
  function renderMapOrder(){
    const source=origin&&game.tiles[origin];
    if(screen==='province'&&orderMode==='raid'&&source?.owner===player){
      get('mapOrder').hidden=false;
      swap('orderRoute','');
      paintMapOrder(source,'ABSEITS DER WELTKARTE','Raubzug vorbereiten',raidControls(source));
      return;
    }
    const active=screen==='province'&&source?.owner===player;
    get('mapOrder').hidden=!active;
    if(!active){swap('orderRoute','');return;}
    if(!orderTarget(selected)){
      swap('orderRoute','');
      paintMapOrder(source,orderMode==='reinforce'?'VERSTÄRKUNG VORBEREITEN':orderMode==='scout'?'ERKUNDUNG VORBEREITEN':'MARSCH VORBEREITEN',lookup[origin].name,`<p>${orderTargetHint()}</p>${button('Abbrechen','cancel')}`);
      return;
    }
    const station=region();
    const routePreview=route(origin,selected);
    const [endX,endY]=routePreview.end;
    const troops=Object.fromEntries(Object.entries(army).map(([key,amount])=>[key,Math.min(amount,source.army[key]||0)]));
    const own=station.owner===player;
    const known=visible.has(selected);
    if(orderMode==='scout'){
      swap('orderRoute',`<path class="preview-route scouting" d="${routePath(routePreview)}" marker-end="url(#arrow)"/><circle class="preview-target" cx="${endX}" cy="${endY}" r="20"/>`);
      paintMapOrder(source,'ERKUNDUNG',known?lookup[selected].name:'Unbekanntes Ziel',scoutControls(troops));
      return;
    }
    const blocked=known&&Boolean(station.owner)&&!own&&relation(game,player,station.owner)!=='war';
    swap('orderRoute',`<path class="preview-route ${own?'friendly':blocked?'blocked':''}" d="${routePath(routePreview)}" marker-end="url(#arrow)"/><circle class="preview-target" cx="${endX}" cy="${endY}" r="20"/>`);
    const moving=Engine.armyStrength(player,troops,source.armyXP);
    const standing=own?Engine.armyStrength(player,station.army,station.armyXP):0;
    const result=!own&&known?battle(game,player,troops,selected,source.blessing?.style,source.armyXP,source.blessing?.rank||1,undefined,{from:origin,visible}):null;
    const max=result?Math.max(result.attack,result.defend):moving+standing;
    const bar=(name,value,css='')=>`<div class="comparison-bar ${css}"><span>${name}</span><b>${Math.round(value)}</b><i style="--strength:${Math.min(100,value/Math.max(max,1)*100)}%"></i></div>`;
    const why=!count(troops)?'Keine Truppen ausgewählt':blocked?'Zuerst Krieg erklären':'';
    const merged=own?Engine.combineArmies(station.army,station.armyXP,troops,source.armyXP):null;
    const movingRoster=merged?armyRoster(player,troops):[];
    const compare=merged?bar('Ankommende Grundstärke',moving)+bar('Garnison vor Ankunft',standing)+`<p>${count(merged.army)} Truppen nach Vereinigung · Grundstärke ${Engine.armyStrength(player,merged.army,merged.xp)}</p>${movingRoster.length?`<div class="reinforcement-roster" aria-label="Entsandte Einheiten">${movingRoster.map(unit=>`<span class="reinforcement-unit" data-unit="${unit.id}" title="${escapeHtml(unit.name)}">${unitArt(unit.id)}<b>${troops[unit.id]} × ${unit.name}</b></span>`).join('')}</div>`:''}`:result?bar(`Dein Angriff · ${count(troops)}`,result.attack)+bar(`Verteidigung · ${result.defCount}`,result.defend,'enemy-bar')+`<p>${Math.round(result.chance*100)} % Siegchance · Grundbonus der Verteidigung +${percentBonus(result.defenseBonus)} %</p>${defenseForces(result,station)}<p>Ø ${forecastNumber(result.attackerLosses)} / ${forecastNumber(result.defenderLosses)} Verluste (Angriff / Abwehr)</p>`:`<p>Keine Feindsicht · ${count(troops)} Truppen ausgewählt.</p>`;
    paintMapOrder(source,own?'TRUPPEN VEREINEN':known?'GEFECHTSVORSCHAU':'ERKUNDUNG',match().explored[selected]?lookup[selected].name:'Unbekanntes Ziel',`${compare}${blocked?'<p class="negative">Erkläre zuerst den Krieg.</p>':''}<div class="action-row">${button(own?'Verstärken':known?'Angreifen':'Erkunden','march','',why,'primary')}${blocked?button('Krieg erklären','war',data(station.owner)):''}${button('Abbrechen','cancel')}</div>`);
  }
  function raidControls(source){
    const troops=Object.fromEntries(Object.entries(army).map(([key,amount])=>[key,Math.min(amount,source.army[key]||0)]));
    const plan=Engine.expeditionPlan(game,player,origin,troops);
    return `<p>${count(troops)} Einheiten · ${time(plan.time)} · ${plan.food} Nahrung · ${Math.round(plan.chance*100)} % Beutechance. Auch bei Erfolg sind Verluste möglich.${plan.why?` ${plan.why}.`:''}</p><div class="action-row">${button('Raubzug starten','raid','',plan.why,'primary')}${button('Abbrechen','cancel')}</div>`;
  }
  function scoutControls(troops){
    return `<p>Deine Kundschafter decken das Ziel und seine Landnachbarn für ${time(Engine.scoutReportTicks)} auf und treten sofort den Rückweg an. Es kommt nicht zum Kampf.</p><div class="action-row">${button('Erkunden','march','',troops.scout?'':'Wähle mindestens einen Kundschafter','primary')}${button('Abbrechen','cancel')}</div>`;
  }
  function animateMarches(now){
    if(screen!=='province')return;
    const tick=game.tick+visualPhase(now);
    for(const track of marchTracks.values()){
      if(!track.node)continue;
      const {march,path}=track;
      const started=march.started??march.due-3;
      const progress=Math.max(track.progress,Math.min(1,(tick-started)/Math.max(1,march.due-started)));
      if(progress===track.progress&&track.node.hasAttribute('transform'))continue;
      track.progress=progress;
      const [x,y]=routePosition(path,progress);
      track.node.setAttribute('transform',`translate(${x} ${y})`);
    }
  }
  function animationFrame(now){
    if(marchTracks.size)animateMarches(now);
    requestAnimationFrame(animationFrame);
  }
  function render() {
    const mine = folk(player);
    const state = match();
    const ledger=economy(game,player);
    const earnings=ledger.actual;
    swap('economy',Object.entries(resources).map(([key,[name]],index)=>{
      const spent=recruitmentSpending[key]||0;
      const change=spent?`−${spent}`:`${earnings[key]>0?'+':''}${earnings[key]}`;
      const tip=spent?`Rekrutierung: −${spent} ${name} · ${earnings[key]} je Rohstoffrunde`:`${name}: ${earnings[key]} je Rohstoffrunde`;
      return button(`${uiArt(index)}<b>${Math.floor(state.stock[key])}</b><small>${name} <em class="${spent||earnings[key]<0?'negative':'positive'}">${change}</em></small>`,'resource',`${data(key)} title="${tip}"`,'',`resource ${screen==='economy'&&resourceKey===key?'active':''}`);
    }).join(''));
    swap('realm',`<div class="realm"><span class="emblem" style="--folk:${mine.color}">${peopleArt(player)}</span><div><h2>${mine.realm}</h2><small>${ages[state.age]}</small></div></div>`);
    swap('navigation',nav.map(([key,icon,name])=>button(`${uiArt(icon)}${name}`,'screen',data(key),'',`nav-item${screen===key?' active':''}`)).join(''));
    const domains = owned(game,player);
    {const alive=Object.keys(game.factions).filter(key=>game.roster.includes(key)&&!defeated(game,key)).length;const total=game.roster.length;const cityCount=domains.filter(tile=>game.tiles[tile.id].sites.hall).length;swap('objective',`<div class="meter"><span style="width:${Math.min(100,(total-alive)/Math.max(1,total-1)*100)}%"></span></div><small>${total-alive}/${total-1} Völker vernichtet · ${alive} verbleibend · deine Städte: ${cityCount}</small>`);}
    swap('legend',peoples.map(item=>button(`<i style="--folk:${item.color}"></i>${item.name}`,'realm',data(item.id),!match().explored[capital(item.id)]?'Hauptstadt noch unentdeckt':'')).join(''));
    swap('speed',`<small id="gameTime">${clock(game.tick)}</small>${room?'<span class="tag" id="lanTime">LIVE</span>':[[0,13,'','Pause'],[1,14,'1×','Normales Tempo'],[2,15,'2×','Doppeltes Tempo'],[4,15,'4×','Vierfaches Tempo']].map(([value,icon,label,description])=>button(`${uiArt(icon)}${label}`,'speed',`${data(value)} aria-label="${description}" aria-pressed="${speed===value}"`,'',speed===value?'active':'')).join('')}`);
    get('modeLabel').textContent=room?`LAN · ${room.code}`:`${difficulty(game).label}${speed?'':' · pausiert'}`;
    const latest=[];
    for(const event of game.events){
      if(event.party.length&&!event.party.includes(player))continue;
      latest.push(historyRow(event));
      if(latest.length===30)break;
    }
    swap('messages',latest.join(''));
    visible=room?new Set(game.visibility):revealMap(game,player);
    renderCity();
    if(screen==='province') renderMap();
    renderPanel();
    renderWorkspace();
    updateTimeLabel();
  }
  const row = (icon,title,desc,act='',requirements='')=>`<div class="entry"><span class="symbol">${icon}</span><div><strong>${title}</strong><small>${desc}</small>${requirements}</div>${act}</div>`;
  const status = (text)=>`<div class="status-card">${text}</div>`;
  function offerActions(offer,target){
    const deadline=Number.isFinite(offer.until)?` · ${countdown({due:offer.until})}`:'';
    return offer.to===player?button('Annehmen','accept',data(target))+button('Ablehnen','decline',data(target))+`<small>Angebot${deadline}</small>`:button('Zurückziehen','withdraw',data(target))+`<small>Angebot ausstehend${deadline}</small>`;
  }
  function rushControl(type,place=selected){
    const plan=rushPlan(game,player,type,place);
    if(!plan.job) return '';
    return ` <span class="rush-action">${button(`Sofort · ${plan.price} Kronen`,'rush',data(type),plan.why)}${plan.why?`<small>${plan.why}</small>`:''}</span>`;
  }
  function paintJobClock(node,tick){
    const {jobFrom,jobDue}=node.dataset;
    const elapsed=Math.min(1,Math.max(0,(tick-Number(jobFrom))/Math.max(1,jobDue-jobFrom)));
    node.style.setProperty('--job-elapsed',`${elapsed*100}%`);
    const seconds=Math.max(0,Math.ceil((jobDue-tick)*2/(room?1:speed||1)));
    const text=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
    const timer=node.querySelector('.job-clock');
    if(timer.textContent!==text) timer.textContent=text;
  }
  function progressArt(art,job,amount){
    if(!job) return art;
    const due=job.ends?.[0]??job.due;
    const active=Number.isFinite(job.started)&&Number.isFinite(due)&&job.started<due;
    return `<span class="job-art${active?' timed':' queued'}"${active?` data-job-from="${job.started}" data-job-due="${due}"`:''}>${art}
      <span class="job-shade" aria-hidden="true"></span>
      ${amount?`<span class="job-quantity" aria-label="${amount} Einheiten offen">${amount}</span>`:''}
      ${active?'<span class="job-clock" role="timer" aria-label="Restzeit"></span>': '<span class="job-clock" aria-label="Eingeplant">◷</span>'}
    </span>`;
  }
  const heading = (text)=>`<h3 class="section-name">${text}</h3>`;
  const note = (text)=>`<p class="hint">${text}</p>`;
  function workChecklist(plan,full=false,inline=false) {
    const checks=full?plan.checks:plan.checks.filter(check=>!check.ok);
    const list=inline?'span':'ul', item=inline?'span':'li', notice=inline?'span':'p';
    return `${plan.notice?`<${notice} class="work-blocker">${escapeHtml(plan.notice)}</${notice}>`:''}${checks.length?`<${list} class="work-checks" aria-label="Voraussetzungen">${checks.map(check=>`<${item} class="${check.ok?'met':check.planned?'planned':'missing'}"><span aria-hidden="true">${check.ok?'✓':check.planned?'◷':'○'}</span> ${escapeHtml(check.label)}${!check.ok&&check.planned?(check.automatic?' · wird eingeplant':' · eingeplant'):''}</${item}>`).join('')}</${list}>`:''}`;
  }
  function buildBundle(plan){
    if(!plan.steps) return '';
    return `<div class="work-bundle"><b>Gemeinsam einplanen</b>${plan.existing.length?`<div>Wartet auf ${plan.existing.map(check=>check.label).join(', ')} · bereits eingeplant</div>`:''}
      <ol>${plan.steps.map(step=>`<li>${step.label} · ${time(step.time)}</li>`).join('')}</ol><span>Gesamtkosten ${cost(plan.total)}</span></div>`;
  }
  function workQueue(type) {
    const orders=Engine.workOrders(game,selected,type);
    const waiting=orders.filter(job=>!job.active).length;
    const heading=type==='build'?'Bauwarteschlange':'Rekrutierungswarteschlange';
    return `<section class="work-queue" aria-label="${heading}"><header><b>${heading}</b><small>${waiting}/${Engine.workQueueLimit} wartend</small></header><div class="work-orders" data-work-orders="${type}:${selected}" tabindex="0" aria-label="${heading} · Aufträge">${orders.map(job=>{
      const title=type==='build'?`${cultureBuilding(building(job.key))} · St. ${job.stage}`:trainingName(job,player);
      const state=job.active?'Läuft':job.dependency?`Wartet auf ${job.dependency}`:'Eingeplant';
      const art=type==='build'?siteArt(job.key):job.key==='drill'?uiArt(7):unitArt(job.key);
      return `<div class="work-order ${job.active?'active':''}">${progressArt(art,job,type==='train'&&job.key!=='drill'?job.amount||1:0)}<div><b>${title}</b><small>${state}${!job.active&&job.due?` · fertig in ${countdown(job)}`:''}</small>${job.active?rushControl(type):''}</div></div>`;
    }).join('')||'<p>Keine offenen Aufträge</p>'}</div></section>`;
  }
  function researchChecklist(plan,links=false){
    const check=(ok,label)=>`<li class="${ok?'checked':'missing'}"><span aria-hidden="true">${ok?'✓':'○'}</span> ${label}</li>`;
    const rows=plan.checks.map(item=>check(item.ok,links&&item.type!=='progress'?button(item.label,item.type==='site'?'show-site':'node',data(item.key)):item.label));
    const funds=plan.scheduled?[]:Object.entries(plan.payment).map(([key,amount])=>check(match().stock[key]>=amount,`${resources[key][0]}: ${match().stock[key]}/${amount}`));
    return `<p>${time(plan.time)} · ${plan.scheduled?'bereits bezahlt':'fällig beim Start'}</p><ul class="milestone-list" aria-label="Voraussetzungen">${rows.join('')}${funds.join('')}</ul>`;
  }
  const districts={
    economy:['farm','lumber','quarry','market','mine','granary','mint','foundry'],
    military:['barracks','range','wall','stable','forge','watch','factory','gate',...Object.values(factions).map(path=>path.building)],
    culture:['hall','temple','academy','spy','lab','observatory'],
  };
  const artCells=['hall','farm','lumber','quarry','market','mine','temple','wall','barracks','range','stable','academy','forge','spy','lab','gate','granary','watch','mint','foundry','observatory','factory','citadel','reactor'];
  const artPosition=(key)=>{
    const cell=artCells.indexOf(key);
    return `--art-x:${cell%6*20}%;--art-y:${Math.floor(cell/6)*100/3}%`;
  };
  const buildingArt=(key,css='')=>`<span aria-hidden="true" class="building-art ${css}" style="${artPosition(key)}"></span>`;
  const unitCells=['club','sling','spear','archer','horse','knight','siege','rifle','artillery','tank','drone','orbital','scout','skirmish','guard','carrier','exosuit','iron','mech'];
  const atlasArt=(sheet,cell,cols,rows)=>`<span aria-hidden="true" class="atlas-art atlas-${sheet}" style="--art-x:${cell%cols*100/(cols-1)}%;--art-y:${Math.floor(cell/cols)*100/(rows-1)}%;--art-size:${cols*100}% ${rows*100}%"></span>`;
  const uiArt=(index)=>atlasArt('interface',index,6,4);
  const folkIndex=(id)=>peoples.findIndex(item=>item.id===(id==='insect'?'abra':id));
  const peoplePortrait=(id,elite=false)=>{
    const index=folkIndex(id);
    return index<8?['peoples',index+(elite?8:0),4,4]:['newfolk',index-8+(elite?5:0),5,2];
  };
  const peopleArt=(id,elite=false)=>atlasArt(...peoplePortrait(id,elite));
  const unitPortrait=(id,owner)=>id==='elite'?peoplePortrait(owner,true):id.startsWith('sig-unit-')?['specialists',folkIndex(id.slice(9)),4,4]
    :id==='club'?['guards',folk(owner)?folkIndex(owner):14,4,4]:id==='spear'?['folk-spears',folk(owner)?folkIndex(owner):13,4,4]:['units',unitCells.indexOf(id),6,4];
  const unitArt=(id,owner=player)=>atlasArt(...unitPortrait(id,owner));
  const armyRoster=(owner,army)=>unitList(owner).filter(unit=>army[unit.id]>0);
  function marchArt(owner,roster){
    const portraits=roster.slice(0,3);
    const stride=portraits.length===1?0:18;
    const size=portraits.length===1?26:18;
    const art=portraits.map((unit,index)=>{
      const x=index*stride-((portraits.length-1)*stride+size)/2;
      return `<foreignObject class="march-portrait" data-unit="${unit.id}" x="${x}" y="${portraits.length>1?-12:-13}" width="${size}" height="${size}" aria-hidden="true"><div xmlns="http://www.w3.org/1999/xhtml" class="march-sprite">${unitArt(unit.id,owner)}</div></foreignObject>`;
    }).join('');
    return art+(roster.length>3?`<text x="14" y="-11" text-anchor="middle">+${roster.length-3}</text>`:'');
  }
  const primitiveSites=['hall','farm','lumber','quarry','barracks','range','granary','watch','market'];
  const siteArt=(id,css='')=>{
    if(id.startsWith('sig-site-')) return atlasArt('specialSites',folkIndex(id.slice(9)),4,4);
    if(match().age===0&&primitiveSites.includes(id))return atlasArt('primitive',primitiveSites.indexOf(id),3,3);
    if(id==='barracks'||id==='market')return atlasArt(id==='market'?'folk-markets':'folk-barracks',folkIndex(player),4,4);
    return buildingArt(id,css);
  };
  const cultureBuilding=(item)=>['hall','barracks','temple'].includes(item.id)?`${item.name} · ${folk(player).culture}`:item.name;
  const trainingName=(job,owner)=>job.key==='drill'?'Garnisonsmanöver':`${job.amount||1} × ${unitList(owner).find(item=>item.id===job.key)?.name||'Rekrutierung'}`;
  function graphArt(key){
    if(key.startsWith('sig-tech-')) return atlasArt('specialists',folkIndex(key.slice(9)),4,4);
    if(key.startsWith('sig-site-'))return siteArt(key,'graph-art');
    if(artCells.includes(key)) return buildingArt(key,'graph-art');
    if(folk(key)) return peopleArt(key);
    if(key==='hero') return peopleArt(player);
    const technology=techs.findIndex(item=>item.id===key);
    if(technology>=0) return atlasArt('technology',technology,6,5);
    const illustration={
      'government:tribe':['knowledge',0,4,3],'government:republic':['knowledge',11,4,3],
      'government:kingdom':['knowledge',8,4,3],'government:council':['interface',11,6,4],
      'faith:none':['interface',5,6,4],'faith:sun':['knowledge',1,4,3],
      'faith:grove':['terrain',1,3,3],'faith:stars':['interface',9,6,4],
      contact:['interface',7,6,4],peace:['interface',6,6,4],alliance:['knowledge',10,4,3],
      war:['knowledge',3,4,3],truce:['interface',23,6,4],amulets:['interface',22,6,4],
    }[key];
    if(illustration)return atlasArt(...illustration);
    const theme=key==='age'?Math.min(6,match().age+1):key.startsWith('era-')?Number(key.slice(4)):key==='trade'?11:null;
    return theme===null?'':atlasArt('knowledge',theme,4,3);
  }
  const filters=(entries,current,kind)=>`<div class="tabs filter-tabs">${entries.map(([key,label])=>button(label,kind,data(key),'',current===key?'active':'')).join('')}</div>`;
  function chooseCity(){
    if(region().owner!==player||!region().sites.hall){
      const cities=owned(game,player).filter(tile=>game.tiles[tile.id].sites.hall);
      const home=cities.find(tile=>tile.capital)||cities[0];
      if(!home){notice('Wähle auf der Weltkarte ein Dorf, um die Gründungsvoraussetzungen zu prüfen.');return false;}
      selected=home.id;
      selectedSite=null;
    }
    cityOpen=true;
    screen='city';
    origin=null;
    return true;
  }
  function renderCity(){
    if(cityOpen&&(region().owner!==player||!region().sites.hall)){cityOpen=false;screen='province';}
    get('cityView').hidden=!cityOpen;
    const onMap=screen==='province';
    if(!onMap) get('mapContext').hidden=true;
    get('canvas').hidden=!onMap;
    get('workspace').hidden=onMap||cityOpen;
    get('stageLabel').innerHTML=cityOpen?'<i></i> STADTVERWALTUNG':onMap?'<i></i> KAMPAGNE <b> / </b> WELTKARTE':'<i></i> REICHSVERWALTUNG <b> / </b> '+ages[match().age].toUpperCase();
    get('stageTitle').textContent=cityOpen?lookup[selected].name.split(' · ')[0]:onMap?'Elyndra':nav.find(entry=>entry[0]===screen)[2];
    if(!onMap) get('mapHint').textContent='Knoten auswählen: Voraussetzungen, Wirkung und nächster Schritt.';
    get('ownLegend').hidden=!onMap;
    for(const id of ['zoomIn','zoomOut','borders']) get(id).hidden=!onMap;
    get('worldView').textContent=onMap?'Welt':'Zur Weltkarte';
    if(!cityOpen) return;
    const local=region();
    const tile=lookup[selected];
    const options=buildings.filter(item=>!item.faction||item.faction===player);
    const queued=Engine.workOrders(game,selected,'build');
    const list=cityFilter==='overview'?options.filter(item=>local.sites[item.id]||queued.some(job=>job.key===item.id)):options.filter(item=>item.age<=match().age&&districts[cityFilter]?.includes(item.id));
    const display=list;
    const art=(item,built)=>item.id==='hall'&&local.sites.hall>=2?atlasArt('cultures',folkIndex(player),4,4):siteArt(item.id,built?'built':'planned');
    const item=building(selectedSite);
    const level=local.sites[item?.id]||0;
    const plan=item&&buildPlan(game,player,selected,item);
    const links=item?buildings.filter(entry=>entry.req?.[0]===item.id):[];
    const stateText=(entry)=>{
      if(local.build?.key===entry.id) return 'Im Bau';
      const next=queued.find(job=>job.key===entry.id);
      if(next) return `St. ${next.stage} eingeplant · ${countdown(next)}`;
      if(local.sites[entry.id]) return `Stufe ${local.sites[entry.id]}`;
      const plan=buildPlan(game,player,selected,entry);
      return plan.why?'Voraussetzungen fehlen':plan.steps?'Mit Voraussetzungen planbar':'Bauplatz bereit';
    };
    const upgrade=item?`<div class="city-upgrade"><div><h3>${item.name}</h3><p>${item.desc}</p></div><div class="level-path">${Array.from({length:item.max},(_,index)=>`<span class="${index<level?'complete':index===plan.stage-1?'next':''}">${index<level?'✓ ':index<plan.stage-1?'◷ ':''}Stufe ${index+1}</span>`).join('')}</div>${links.length?`<p>Ermöglicht: ${links.map(entry=>`${entry.name} (ab St. ${entry.req[1]})`).join(', ')}</p>`:''}${plan.stage<=item.max?`<p>${cost(plan.cost)} · ${time(plan.time)}</p><h4>Voraussetzungen für Stufe ${plan.stage}</h4>`:''}${workChecklist(plan,true)}${buildBundle(plan)}${plan.stage<=item.max?button(item.id==='hall'&&plan.stage===1?'Stadt gründen':plan.stage>1?`Auf Stufe ${plan.stage} ausbauen`:'Bauen','build',data(item.id),plan.why,'primary'):''}</div>`:'';
    swap('cityView',`<div class="city-scene" data-city-age="${match().age}" style="--faction-tint:${folk(player).color}"><div class="city-hero" style="--epoch-x:${match().age%2*100}%;--epoch-y:${Math.floor(match().age/2)*100/3}%"><div class="city-top"><span class="eyebrow">${tile.continent.toUpperCase()} / ${terrain[tile.biome][0].toUpperCase()}</span><span class="tag">${Object.keys(local.sites).length} Gebäude · ${ages[match().age]}</span></div><div class="city-banner">${match().age>=2?atlasArt('cultures',folkIndex(player),4,4):peopleArt(player)}<span class="eyebrow">${local.sites.hall?'STADT & BAUWESEN':'SIEDLUNGSPLATZ'}</span><h2>${tile.name.split(' · ')[0]}</h2><p>${folk(player).realm} · ${ages[match().age]}</p></div></div><div class="city-controls"><div class="city-districts">${filters([['overview','Bestand'],['economy','Wirtschaft'],['military','Militär'],['culture','Verwaltung']],cityFilter,'district')}</div>${workQueue('build')}<div class="buildings-board">${display.map(entry=>button(`${progressArt(art(entry,local.sites[entry.id]),queued.find(job=>job.key===entry.id))}<strong>${cultureBuilding(entry)}</strong><small>${stateText(entry)}</small>`,'site',data(entry.id),'',`city-building ${item?.id===entry.id?'active':''}`)).join('')||note('Keine Bauwerke in dieser Auswahl.')}</div>${upgrade}</div></div>`);
  }
  function renderWorkspace(){
    if(['province','city'].includes(screen)) return;
    const state=match();
    const card=(key,icon,name,summary,stateLabel='')=>{
      const job=screen==='research'?(state.study?.key===key?state.study:state.studyQueue?.find(order=>order.key===key))
        :key==='hero'?state.mentoring:null;
      return button(`${progressArt(graphArt(key),job)}<span class="graph-icon">${icon}</span><strong>${name}</strong><small>${summary}</small>${job||stateLabel?`<em>${job?(job.started!==undefined?'In Arbeit':'Eingeplant'):stateLabel}</em>`:''}`,'node',data(key),'',`graph-node${selectedNode===key?' active':''}`);
    };
    const section=(title,nodes,style='')=>`<section class="graph-section ${style}"><h3>${title}</h3><div class="graph-row">${nodes}</div></section>`;
    const arrow='<span class="graph-arrow" aria-hidden="true">→</span>';
    let body='';
    let detail='';
    const jump=(label,destination)=>button(label,'screen',data(destination));
    if(screen==='research'){
      const agePlan=studyPlan(game,player,'age');
      body+=section('Zeitalter',ages.map((name,index)=>card(index===state.age+1?'age':`era-${index}`,'✧',name,index===state.age?'Aktuell':index<state.age?'Erreicht':index===state.age+1?'Nächster Meilenstein':'Zukünftig')).join(arrow),'age-road');
      const tracks=[
        ['Wirtschaft und Verwaltung',['cultivation','irrigation','barter','ledger','printing','automation']],
        ['Rohstoffe und Industrie',['carpentry','prospectingEarly','bronze','prospecting','ironworking','steel','electricity']],
        ['Militär und Erkundung',['logistics','horsemanship','masonry','bowcraft','siegecraft','gunpowder','cartography','optics','engineering']],
        ['Information und Raumfahrt',['electronics','network','rocketry','fusion']],
        ['Volksentwicklung',[factions[player].research]],
      ];
      for(const [title,keys] of tracks){
        const entries=keys.map(tech).filter(item=>item.age<=state.age);
        if(entries.length) body+=section(title,entries.map(item=>{
          const plan=studyPlan(game,player,item.id);
          const requirements=technologyLinks[item.id];
          const prereqs=[...(requirements?.tech||[]).map(key=>tech(key).name),...(requirements?.site?[`${building(requirements.site[0]).name} St. ${requirements.site[1]}`]:[])];
          return card(item.id,'✦',item.name,prereqs.length?`Benötigt: ${prereqs.join(' + ')}`:'Keine Vorforschung',state.tech.includes(item.id)?'✓ Erforscht':plan.why?'○ Gesperrt':'● Bereit');
        }).join(''));
      }
      const item=tech(selectedNode);
      const requirements=selectedNode==='age'?agePlan.requirements:technologyLinks[item?.id];
      if(selectedNode==='age'&&requirements||item&&item.age<=state.age){
        const plan=selectedNode==='age'?agePlan:studyPlan(game,player,item.id);
        const unlocks=item?[...buildings.filter(entry=>(!entry.faction||entry.faction===player)&&buildingTech[entry.id]?.includes(item.id)),...unitList(player).filter(entry=>unitTech[entry.id]?.includes(item.id)),...techs.filter(entry=>(!entry.faction||entry.faction===player)&&technologyLinks[entry.id]?.tech?.includes(item.id))].map(entry=>entry.name):[];
        detail=`<h3>${item?.name||ages[state.age+1]}</h3>${item?`<p>${item.desc}</p>`:''}${researchChecklist(plan,true)}${unlocks.length?`<p>Schaltet frei: ${unlocks.join(', ')}</p>`:''}${state.study?.key===(item?.id||'age')?rushControl('study'):button(item?'Forschen':'Aufsteigen','study',data(item?.id||'age'),plan.why,'primary')}`;
      } else if(selectedNode.startsWith('era-')) {
        const index=Number(selectedNode.slice(4));
        detail=`<h3>${ages[index]}</h3><p>${index===state.age?'Aktives Zeitalter':index<state.age?'Bereits erreicht':'Schließe zuerst die vorherigen Meilensteine ab.'}</p>`;
      }
    } else if(screen==='council'){
      body+=section('Regierungsformen',Object.entries(governments).map(([key,[name,desc,age]])=>card(`government:${key}`,'⚜',name,desc,state.government===key?'✓ Aktiv':ages[age])).join(''));
      body+=section('Glaubenspfade',[card('temple','☉','Heiligtum','Ab Bronzezeit · erzeugt Einfluss',domainsHave('temple')?'✓ Gebaut':'○ Benötigt Bau'),arrow,...Object.entries(faiths).map(([key,[name,desc]])=>card(`faith:${key}`,'✦',name,desc,state.faith===key?'✓ Aktiv':'10 Einfluss'))].join(''));
      body+=section('Helden & Relikte',card('hero','✦',folk(player).hero,folk(player).power)+card('amulets','◆','Amulette',`${state.amulets.length} erbeutet`));
      const [type,key]=selectedNode.split(':');
      const policy=(type==='government'?governments:type==='faith'?faiths:{})[key];
      if(policy){
        const [name,desc,age]=policy;
        const why=state[type]===key?'Bereits aktiv':type==='government'&&state.age<age?`Benötigt: ${ages[age]}`:type==='faith'&&!domainsHave('temple')?'Benötigt: Heiligtum':state.stock.influence<10?'Es fehlen Einfluss-Punkte':'';
        detail=`<h3>${name}</h3><p>${desc}</p><p>Voraussetzung: ${type==='faith'?'Heiligtum':ages[age]} · 10 Einfluss</p>${why?`<p>${why}</p>`:''}${button('Einführen',type,data(key),why,'primary')}`;
      } else if(selectedNode==='temple') detail=`<h3>Heiligtum</h3><p>Erzeugt je Stufe einen Einfluss pro Takt und öffnet die Glaubenspfade.</p>${jump('Zur Stadt','city')}`;
      else if(selectedNode==='hero'){
        const why=state.mentoring?'Training läuft':state.heroXP>=16?'Maximalstufe':!domainsHave('academy')?'Akademie fehlt':state.stock.science<24||state.stock.influence<12?'Zu wenig Wissen oder Einfluss':'';
        detail=`<h3>${folk(player).hero} · Stufe ${heroLevel(state.heroXP)}</h3><p>${powers[player]} Aktiviere die Fähigkeit im Heer deiner Provinz. Erfahrung gibt es durch Gefechte oder die Akademie.</p><p>${state.heroXP||0}/16 EP · ${state.mentoring?'Akademietraining läuft':'Akademietraining: +2 EP · 24 Wissen / 12 Einfluss · 16 s bei 1×'}</p>${state.mentoring?rushControl('mentor'):button('Held trainieren','mentor','',why,'primary')}`;
      }
      else if(selectedNode==='amulets') detail=`<h3>Amulette</h3><p>${state.amulets.map(key=>amulets[key][0]).join(' · ')||'Noch keine Amulette. Besiege einen Drachen, um eines zu erbeuten.'}</p>`;
    } else if(screen==='diplomacy'){
      body+=section('Vom Erstkontakt zum Vertrag',card('contact','◉','Erstkontakt','Fremdes Gebiet erkunden')+arrow+card('peace','◇','Frieden','Verhandlungen möglich')+arrow+card('alliance','⚖','Bündnis','12 Einfluss für ein Angebot'));
      body+=section('Konfliktpfad',card('war','⚔','Krieg','Erklärung beendet bestehende Abkommen')+arrow+card('truce','⚑','Friedensangebot','12 Einfluss · danach erneut verhandeln'));
      const contacts=new Set(Object.values(state.explored).map(place=>place.owner));
      const known=peoples.filter(item=>item.id!==player&&(contacts.has(item.id)||relation(game,player,item.id)!=='peace'||game.offers[relationKey(player,item.id)]));
      const labels={war:'Krieg',peace:'Frieden',alliance:'Bündnis'};
      body+=section('Bekannte Reiche',known.map(item=>card(item.id,item.icon,item.realm,labels[relation(game,player,item.id)])).join('')||note('Noch kein Kontakt. Erkunde die Karte und nutze Seewege.'));
      const target=known.find(item=>item.id===selectedNode);
      if(target){
        const standing=relation(game,player,target.id);
        const offer=game.offers[relationKey(player,target.id)];
        const low=state.stock.influence<12?'Zu wenig Einfluss':'';
        const acts=offer?offerActions(offer,target.id):standing==='war'?button('Frieden anbieten','peace',data(target.id),low):button('Krieg erklären','war',data(target.id))+(standing==='peace'?button('Bündnis anbieten','alliance',data(target.id),low):'');
        detail=`<h3>${target.realm}</h3><p>Aktueller Status: ${labels[standing]}</p><div class="action-row">${acts}</div>`;
      } else if(selectedNode) detail=`<h3>Diplomatischer Pfad</h3><p>${selectedNode==='contact'?'Ein Reich wird zum Verhandlungspartner, sobald du eines seiner Gebiete erkundest.':selectedNode==='war'?'Kriegserklärungen wirken sofort. Nun kannst du fremde Provinzen angreifen.':'Wähle ein bekanntes Reich. Angebote an Menschen benötigen deren Zustimmung.'}</p>`;
    } else if(screen==='economy'){
      const ledger=economy(game,player);
      const signed=value=>value>0?`+${value}`:String(value);
      const [name]=resources[resourceKey];
      const hints={
        food:'Ackerland +4 und Kornspeicher +3 je Stufe. Heereslogistik senkt den Nahrungsunterhalt um ein Drittel. Ohne Vorrat greifen deine Truppen mit −18 % Stärke an.',
        wood:'Holzfällerlager +3 je Stufe. Wälder, Taiga und Regenwald liefern einen Zusatzpunkt. Holzverarbeitung bringt +1 je Stadt mit Ratshaus.',
        stone:'Steinbruch +3 je Stufe. Gebirge und Tundra geben +1 Stein je Takt.',
        metal:'Erzmine +3 und Hochofen +5 je Stufe. Ab Bronzezeit liefern Gebirge +1 Metall. Prospektion kann diesen Ertrag an geeigneten Standorten erhöhen.',
        coin:'Ratshaus +1, Markt +3 und Münzstätte +4 je Stufe. Kronen werden auch für Truppenunterhalt, Handel und Eilaufträge gebraucht.',
        science:'Ratshaus +1, Akademie +4, Sternwarte +5 und Labor +8 je Stufe. Wissen bezahlt Technologien und Zeitalteraufstiege.',
        influence:'Heiligtümer erzeugen einen Einfluss pro Stufe. Einfluss bezahlt Regierungswechsel, Glauben, Bündnisse und Heldenfähigkeiten.',
      };
      body+=section('Rohstoffrunden',Object.entries(resources).map(([key,[label]],index)=>button(`${uiArt(index)}<strong>${label}</strong><small>${state.stock[key]} auf Lager · ${signed(ledger.net[key])}/Runde</small>`,'resource',data(key),'',`graph-node resource-node ${key===resourceKey?'active':''}`)).join(''));
      detail=`<h3>${name}: ${signed(ledger.net[resourceKey])} je Rohstoffrunde · alle ${Engine.economyInterval(game)*2} s bei 1×</h3><p>Vorrat ${state.stock[resourceKey]} / ${ledger.capacity[resourceKey]} · tatsächliche Änderung ${signed(ledger.actual[resourceKey])}/Runde.</p><dl class="resource-breakdown">${[['Land & Gelände',ledger.land[resourceKey]],['Gebäude',ledger.infrastructure[resourceKey]],['Forschung & Politik',ledger.policy[resourceKey]],['Unterhalt & Verwaltung',-ledger.upkeep[resourceKey]]].map(([label,value])=>`<div><dt>${label}</dt><dd>${signed(value)}</dd></div>`).join('')}</dl><p>${hints[resourceKey]}</p><p>${ledger.developed} mit Ratshaus / ${ledger.activeCities} produktive Provinzen · ${ledger.occupied} im Wiederaufbau · ${ledger.supplyUsed} Versorgungspunkte</p><p>Ohne Ratshaus: nur 1 Nahrung und der Geländeertrag. Bei vollem Lager verfällt zusätzliche Produktion; erbeutete Vorräte gehen nicht verloren.</p><div class="action-row">${jump('Gebäude ausbauen','city')}${jump('Technologien ansehen','research')}${jump('Waren handeln','market')}</div>`;
      body+=section('Aufträge schneller abschließen',card('acceleration','⏩','Eilauftrag','Laufenden Auftrag mit Kronen abschließen')+card('efficiency','⚙','Dauerhafte Boni','Mechanische Werkzeuge und Automatisierung'));
      if(selectedNode==='acceleration') detail='<h3>Eilauftrag</h3><p>„Sofort“ schließt den laufenden Auftrag direkt ab. Bau und Ausbildung kosten zwei Kronen pro Resttakt, Forschung drei. Der Preis sinkt mit der Restzeit. Die Spielgeschwindigkeiten 2× und 4× gelten im Einzelspieler für alle Reiche.</p>';
      if(selectedNode==='efficiency') detail='<h3>Dauerhafte Boni</h3><p>Mechanische Werkzeuge senken die berechnete Bauzeit um 18 %, bevor die Obergrenze von 80 Minuten greift. Automatisierung spart zwei Rekrutierungstakt. Kartografie spart einen Marschtakt.</p>';
    } else {
      const plan=studyPlan(game,player,'barter');
      body+=section('Handelsweg',card('barter','✧',tech('barter').name,'Steinzeit · 16 Wissen',state.tech.includes('barter')?'✓ Erforscht':'○ Offen')+arrow+card('market','⚖','Markt','Ratshaus St. 1 + Tauschhandel',domainsHave('market')?'✓ Gebaut':'○ Offen')+arrow+card('trade','◉','Warenbörse','Lose zu 12 Rohstoffen'));
      if(selectedNode==='barter') detail=`<h3>${tech('barter').name}</h3><p>${tech('barter').desc}</p><p>✧ ${plan.cost} · ${time(plan.time)}${plan.why?` · ${plan.why}`:''}</p>${button('Tauschhandel erforschen','study',data('barter'),plan.why,'primary')}`;
      else if(selectedNode==='market') detail=`<h3>Markt</h3><p>Steinzeit · Ratshaus Stufe 1 · Tauschhandel.</p>${button('Zum Markt-Bauplatz','show-site',data('market'))}`;
      else if(selectedNode==='trade'){
        detail=`<h3>Warenbörse</h3><p>${domainsHave('market')?'Kaufen und verkaufen über die Warenangebote rechts.':'Es fehlt ein eigener Markt.'}</p>`;
      }
    }
    swap('workspace',`<div class="graph-layout"><div class="workspace-banner" data-screen="${screen}"><span class="eyebrow">ÄONENREICHE / ${ages[state.age].toUpperCase()}</span><h2>${nav.find(entry=>entry[0]===screen)[2]}</h2></div><div class="graph-detail">${detail||'<p>Wähle einen Knoten, um Aktionen und Voraussetzungen zu sehen.</p>'}</div><div class="graph-board">${body}</div></div>`);
  }
  function drawMinimap(){
    if(!visible||!get('map').viewBox.baseVal.width) return;
    const canvas=get('minimap');
    const ctx=canvas.getContext('2d');
    const {width,height}=Relief;
    ctx.fillStyle='#0a1420';ctx.fillRect(0,0,canvas.width,canvas.height);
    const own=[];
    for(const [id,known] of Object.entries(match().explored)){
      const [x,y]=points[id];
      if(game.tiles[id].owner===player){
        own.push([x/width*canvas.width,y/height*canvas.height]);
        continue;
      }
      ctx.globalAlpha=visible.has(id)?1:.46;
      ctx.fillStyle=folk(known.owner)?.color||'#65765d';
      ctx.fillRect(x/width*canvas.width-1,y/height*canvas.height-1,3,3);
    }
    ctx.globalAlpha=1;
    ctx.fillStyle='#122b2a';
    for(const [x,y] of own) ctx.fillRect(x-2.5,y-2.5,5,5);
    ctx.fillStyle='#87f5d1';
    for(const [x,y] of own) ctx.fillRect(x-1.5,y-1.5,3,3);
    const box=get('map').viewBox.baseVal;
    ctx.strokeStyle='#f4d899';
    ctx.strokeRect(box.x/width*canvas.width,box.y/height*canvas.height,box.width/width*canvas.width,box.height/height*canvas.height);
  }
  function renderPanel(force=false) {
    const tile = lookup[selected];
    const known = match().explored[selected];
    const inView=visible.has(selected);
    const local = inView?region():{owner:known?.owner,army:{},sites:{}};
    const state = match();
    const mine = folk(player);
    const owner = folk(local.owner);
    const myLand = local.owner===player;
    const settlement=local.sites.hall||!inView&&known?.city?tile.capital?'HAUPTSTADT':'STADT':owner?'DORF':'FREIE PROVINZ';
    const section = nav.find(entry=>entry[0]===screen);
    const province=screen==='province'||screen==='city';
    const title = province?(known?tile.name:'Unerkundeter Seeweg'):section[2];
    const labels = {research:'Entwicklung von der Steinzeit bis zur Raumfahrt.',council:'Regierung, Religion und die Helden deines Volkes.',diplomacy:'Krieg, Frieden und Bündnisse zwischen den Reichen.',market:'Tausche Rohstoffe gegen Kronen.',economy:'Erträge, Aufträge und Heeresunterhalt.'};
    swap('inspector',`<div class="province"><span class="eyebrow">${province?(known?settlement:'KRIEGSNEBEL'):'REICHSVERWALTUNG'}</span><h2>${title}</h2><p>${province?(owner?`<span style="color:${owner.color}">${owner.icon}</span> ${owner.realm}`:known?(tile.barbarian?'Barbarengebiet':'Unabhängiges Gebiet'):'Kein Aufklärungsbericht'):labels[screen]}</p>${province&&known?`${myLand?'<span class="tag own-tag">Eigenes Reich</span>':''}<span class="tag">${terrain[tile.biome][0]}</span><span class="tag">${!inView?'Zuletzt gesehen':myLand?count(local.army)+' Einheiten':known.dragon?'Drachenhort':known.treasure?'Schatz':'Verteidigung +' + Math.round((terrain[tile.biome][2]-1)*100)+' %'}</span>${myLand&&local.cityClaim&&local.cityClaim!==selected?`<p>Stadtgebiet von ${escapeHtml(lookup[local.cityClaim].name)}</p>`:''}`:`<span class="tag">${ages[state.age]}</span>`}</div>`);
    let body = game.winner?status(`${folk(game.winner).realm} siegt. Starte im Hauptmenü eine neue Kampagne.`):'';
    if(defeated(game,player)) body+=status(`Dein Volk ist vernichtet. ${button('Neustart oder Spielstand','home-menu')}`);
    if (province) {
      const expedition=game.marches.find(item=>item.id===selectedMarch&&(item.owner===player||visible.has(item.from)&&visible.has(item.to)));
    if(expedition){
      const formations=armyRoster(expedition.owner,expedition.army).map(unit=>`<div class="formation-card" data-unit="${unit.id}">${unitArt(unit.id,expedition.owner)}<b>${expedition.army[unit.id]} × ${unit.name}</b><small>${roles[unit.role]}</small></div>`).join('');
      body+=`<div class="order"><span class="eyebrow">${expedition.returning?'RÜCKMARSCH':expedition.raid?'RAUBZUG':'HEER UNTERWEGS'}</span><b>${folk(expedition.owner).realm}</b><p>${lookup[expedition.from].name} → ${match().explored[expedition.to]?lookup[expedition.to].name:'Unerkundetes Ziel'} · ${countdown(expedition)} · Rang ${veteranLevel(expedition.armyXP)}</p><div class="formation-grid">${formations}</div><div class="action-row">${expedition.owner===player&&!expedition.returning?button('Heer zurückrufen','recall',data(expedition.id)):''}${button('Heerkarte schließen','close-march')}</div></div>`;
    }
      const chosen = ['build','train','army'];
      body+=`<div class="tabs">${chosen.map((key,index)=>button([myLand&&!local.sites.hall?'Gründung':'Stadtbau','Rekrutieren','Heer'][index],'tab',data(key),'',tab===key?'active':'')).join('')}</div>`;
      if(myLand&&!cityOpen&&count(local.army)&&!origin) body+=`<div class="action-row map-quick">${button('Heer entsenden','prepare','','','primary')}${button('Raubzug','prepare-raid')}${button('Garnison ansehen','tab',data('army'))}</div>`;
      if(myLand&&!cityOpen&&!origin&&local.army.scout) body+=`<div class="action-row">${button('Kundschafter entsenden','prepare-scout')}</div>`;
      const expeditionOffMap=(game.expeditions||[]).find(item=>item.owner===player);
      if(expeditionOffMap)body+=row(progressArt(uiArt(7),expeditionOffMap),'Raubzug',`${count(expeditionOffMap.army)} Truppen unterwegs`);
      if(myLand&&local.sites.hall&&!cityOpen&&tab!=='army') body+=`<p class="open-city">${button('Stadt öffnen','screen',data('city'),'','primary')}</p>`;
      if (origin) body+=marchPanel();
      if (!myLand) {
        const office = owned(game,player).some(item=>game.tiles[item.id].sites.spy);
        if(known?.dragon) body+=row(atlasArt('units',23,6,4),'Uralter Drache','Bewacht ein Amulett. Erobere den Hort, um es zu bergen.');
        body+=note(inView?`Sichtbar: ${count(local.army)} Einheiten · Befestigung St. ${local.sites.wall||0}.`:known?'Außer Sicht. Besatzung und Besitz können sich geändert haben.':'Erst nach der Ankunft wird die Küstenprovinz sichtbar.');
        if(known&&!inView&&Number.isFinite(known.seen))body+=note(`Zuletzt gesehen: ${clock(known.seen)}. Es werden keine alten Truppenstärken als aktuelle Werte angezeigt.`);
        if(inView){
          const intel=unitList(local.owner).filter(unit=>local.army[unit.id]);
          if(intel.length) body+=note(`Garnison: ${intel.map(unit=>`${local.army[unit.id]} × ${unit.name}`).join(' · ')}. Ausbildungsrang ${veteranLevel(local.armyXP)}.`);
          if(state.scouted[selected]>game.tick) body+=status(`Späherbericht aktiv · ${countdown({due:state.scouted[selected]})} · Bau: ${local.build?building(local.build.key).name:'kein Auftrag'} · Ausbildung: ${local.train?trainingName(local.train,local.owner):'keine'}`);
        }
        if (office&&known) body+=`<div class="action-row">${button('Aufklären · 22 ◉','spy',data('scout'))}${button('Sabotage · 22 ◉','spy',data('sabotage'))}</div>`;
        if (owner && relation(game,player,local.owner)!=='war') body+=`<div class="action-row">${button('Zur Diplomatie','screen',data('diplomacy'))}</div>`;
      } else if (tab==='build') {
        if(!cityOpen) body+=workQueue('build');
        body+=heading('Bauwerke');
        const buildingJobs=Engine.workOrders(game,selected,'build');
        const options=buildings.filter(item=>!local.sites.hall?item.id==='hall':(!item.faction||item.faction===player)&&item.age<=state.age&&(cityOpen&&selectedSite?item.id===selectedSite:cityOpen&&cityFilter!=='overview'?districts[cityFilter].includes(item.id):true));
        body+=options.map(item=>{
          const calc=buildPlan(game,player,selected,item);
          const current = local.sites[item.id]||0;
          const job=buildingJobs.find(order=>order.key===item.id);
          return row(progressArt(siteArt(item.id),job),`${item.name}${current?` · St. ${current}`:''}`,`${item.desc}${calc.stage<=item.max?`<br><span class="cost">St. ${calc.stage} · ${cost(calc.cost)} · ${time(calc.time)}</span>`:''}`,button(item.id==='hall'&&calc.stage===1?'Gründen':calc.stage>1?'Ausbau':'Bauen','build',data(item.id),calc.why),workChecklist(calc,cityOpen&&selectedSite===item.id)+buildBundle(calc));
        }).join('')||note('Für dieses Stadtviertel stehen in deinem Zeitalter noch keine Bauplätze bereit.');
      } else if (tab==='train'&&!local.sites.hall) {
        body+=note('Dörfer können Truppen aufnehmen. Rekrutieren kannst du in einer Stadt mit fertiggestelltem Ratshaus.');
      } else if (tab==='train') {
        body+=workQueue('train');
        body+=heading('Einheiten & Konter');
        const trainingJobs=Engine.workOrders(game,selected,'train');
        body+=filters([['all','Alle'],['ground','Fußtruppen'],['mobile','Mobil'],['advanced','Spezial']],unitFilter,'unit-filter');
        body+=unitList(player).filter(unit=>unit.age<=state.age&&(unitFilter==='all'||unitFilter==='ground'&&['infantry','ranged','spear','heavy'].includes(unit.role)&&unit.id!=='elite'||unitFilter==='mobile'&&unit.role==='mobile'&&unit.id!=='elite'||unitFilter==='advanced'&&(['siege','air'].includes(unit.role)||unit.id==='elite'))).map(unit=>{
          const calc = recruitment(game,player,selected,unit);
          const job=trainingJobs.find(order=>order.key===unit.id);
          const content=`<span class="training-portrait">${progressArt(unitArt(unit.id),job,job?.amount||0)}</span>
            <span class="training-copy"><strong>${unit.name}${unit.id==='elite'?' · Super-Einheit':''}</strong>
            <span class="training-description">${roles[unit.role]} · Angriff ${unit.atk} / Schutz ${unit.def}${unit.ability?`<br><span class="positive">Fähigkeit: ${unit.ability}</span>`:''}<br>Stark gegen: ${counters[unit.role].map(role=>roles[role]).join(', ')}<br><span class="cost">${cost(unit.cost)} · ${time(calc.time)} je Einheit</span></span>
            ${workChecklist(calc,false,true)}</span><span class="training-add"><span class="visually-hidden">Rekrutieren </span>+1</span>`;
          return button(content,'train',data(unit.id),calc.why,'training-tile');
        }).join('')||note('In diesem Zeitalter ist noch keine Einheit dieser Kategorie verfügbar.');
      } else {
        const rest = Math.max(0,state.heroReady-game.tick);
        const heroTimer=local.blessing||state.mentoring||(rest?{started:state.heroReady-18,due:state.heroReady}:null);
        body+=`<div class="hero-card">${progressArt(peopleArt(player),heroTimer)}<span class="eyebrow">✦ HELD DES VOLKES</span><b>${mine.hero} · Stufe ${heroLevel(state.heroXP)}</b><p>${state.heroXP||0}/16 Helden-EP · Erfahrung gibt es nach Gefechten mit aktiver Fähigkeit.</p><p>${mine.power}: ${powers[player]}</p>${local.blessing?'<p>Fähigkeit aktiv</p>':button(rest?'Fähigkeit lädt':'Wirken · 8 ⚜','hero','',rest?'Fähigkeit lädt':!count(local.army)?'Keine Einheiten':state.stock.influence<8?'Zu wenig Einfluss':'')}</div>`;
        body+= note(`Garnison: Ausbildungsrang ${veteranLevel(local.armyXP)} · ${local.armyXP||0}/100 EP. Je Rang +6 % Kampfstärke. Neue Rekruten beginnen bei 0 EP.`);
        const drillReason=!local.sites.barracks?'Kaserne fehlt':!count(local.army)?'Keine Garnison':local.train||local.trainQueue?.length?'Ausbildung belegt':local.armyXP>=45?'Maximaler Übungsrang':state.stock.food<25||state.stock.coin<18?'Zu wenig Vorräte':'';
        if(local.train?.key==='drill')body+=row(progressArt(uiArt(7),local.train),'Garnisonsmanöver','Ausbildung läuft',rushControl('train'));
        else body+=`<div class="action-row">${button(`Manöver · ${10+2*count(local.army)} Nahrung / ${8+count(local.army)} Kronen`,'drill','',drillReason)}</div>`;
        body+=heading('Garnison')+(count(local.army)?unitList(player).filter(unit=>local.army[unit.id]).map(unit=>row(unitArt(unit.id),unit.name,`${local.army[unit.id]} Einheiten · ${roles[unit.role]}`)).join(''):note('Hier stehen keine Truppen. Rekrutiere Einheiten oder verlege Verstärkung.'));
        if (!origin) body+=button('Marsch vorbereiten','prepare','',count(local.army)?'':'Keine Einheiten','primary');
      }
      const marches = game.marches.filter(item=>item.owner===player&&(item.from===selected||item.to===selected));
      if (marches.length) body+=heading('Unterwegs')+marches.map(item=>row(progressArt(uiArt(7),item),`${lookup[item.from].name} → ${lookup[item.to].name}`,`${count(item.army)} Truppen`)).join('');
    } else if (screen==='research') {
      body+=heading('Chronik der Zeitalter');
      body+=`<div class="era-track">${ages.map((name,index)=>`<span class="${index===state.age?'current':index<state.age?'past':''}" title="${name}">${index+1}</span>`).join('')}</div>`;
      if(milestones[state.age]){
        const plan=studyPlan(game,player,'age');
        body+=`<div class="order"><span class="eyebrow">NÄCHSTER MEILENSTEIN</span><b>${ages[state.age+1]}</b>${researchChecklist(plan)}${state.study?.key==='age'?rushControl('study'):button('Aufsteigen','study',data('age'),plan.why,'primary')}</div>`;
      }
      body+=heading('Technologiepfade');
      body+=filters([['current','Im Zeitalter'],['ready','Ohne Hürden'],['done','Erforscht']],researchFilter,'research-filter');
      const researchRows=techs.filter(item=>!item.faction||item.faction===player).map(item=>({item,plan:studyPlan(game,player,item.id)})).filter(({item,plan})=>item.age<=state.age&&(researchFilter==='done'?state.tech.includes(item.id):!state.tech.includes(item.id)&&(researchFilter!=='ready'||!plan.needed.length)));
      body+=researchRows.map(({item,plan})=>{
        const unlocks=[
          ...buildings.filter(entry=>buildingTech[entry.id]?.includes(item.id)).map(entry=>entry.name),
          ...unitList(player).filter(entry=>unitTech[entry.id]?.includes(item.id)).map(entry=>entry.name),
          ...techs.filter(entry=>technologyLinks[entry.id]?.tech?.includes(item.id)).map(entry=>entry.name),
        ];
        const extra=unlocks.length?`<br><span class="positive">Öffnet: ${unlocks.join(', ')}</span>`:'';
        const active=state.study?.key===item.id;
        const job=active?state.study:state.studyQueue?.find(order=>order.key===item.id);
        return row(progressArt(graphArt(item.id),job),item.name,`${item.desc}<br>${ages[item.age]} · ${cost(plan.payment)} · ${time(plan.time)}${plan.why&&!active&&plan.why!=='Erforscht'?`<br>${plan.why}`:''}${extra}`,active?rushControl('study'):state.tech.includes(item.id)?'<small>Fertig</small>':button('Forschen','study',data(item.id),plan.why));
      }).join('')||note('In diesem Filter gibt es noch keine Technologien.');
    } else if (screen==='council') {
      body+=heading('Amulette')+(state.amulets.length?state.amulets.map(key=>row(uiArt(22),amulets[key][0],`${roles[amulets[key][1]]}: +12 % Stärke (bis +36 % je Rolle)`)).join(''):note('Besiege Drachen, um dauerhafte Verstärkungen für deine Truppen zu erbeuten.'));
      body+=`<div class="hero-card"><span class="eyebrow">✦ ${mine.name.toUpperCase()}</span><b>${mine.hero} · ${mine.power}</b><p>Aktiviere die Fähigkeit in einer eigenen Provinz mit Truppen unter „Heer“.</p><b>${mine.elite}</b><p>Volksgebundene Super-Einheit. Rekrutiere sie nach dem Ausbau der passenden Militäranlage.</p></div>`;
      const policies = (title,type,options,eligible)=>heading(title)+Object.entries(options).map(([key,[name,desc,age]])=>row('⚜',name,`${desc}${age?` · ${ages[age]}`:''}`,state[type]===key?'<small>Aktiv</small>':button('10 ⚜',type,data(key),eligible(age)?state.stock.influence<10?'Zu wenig Einfluss':'':'Voraussetzung fehlt'))).join('');
      body+=policies('Regierung','government',governments,age=>state.age>=age)+policies('Staatsglaube','faith',faiths,()=>domainsHave('temple'));
    } else if (screen==='diplomacy') {
      const labels = {war:'Krieg',peace:'Frieden',alliance:'Bündnis'};
      body+=note('Bündnisse verhindern Angriffe, solange sie gelten. Kriegserklärungen brechen Abkommen sofort. Friedens- und Bündnisangebote kosten 12 Einfluss.');
      const discoveredOwners=new Set(Object.values(state.explored).map(place=>place.owner));
      body+=peoples.filter(item=>item.id!==player&&(discoveredOwners.has(item.id)||relation(game,player,item.id)!=='peace'||game.offers[relationKey(player,item.id)])).map(item=>{
        const standing = relation(game,player,item.id);
        const offer = game.offers[relationKey(player,item.id)];
        const controls = offer?offerActions(offer,item.id):standing==='war'?button('Frieden anbieten','peace',data(item.id),state.stock.influence<12?'Zu wenig Einfluss':''):button('Krieg erklären','war',data(item.id))+(standing==='peace'?button('Bündnis anbieten','alliance',data(item.id),state.stock.influence<12?'Zu wenig Einfluss':''):'');
        return `<div class="order"><b style="color:${item.color}">${item.icon}</b> <b>${item.realm}</b><p>${labels[standing]} · ${Object.values(state.explored).filter(place=>place.owner===item.id).length} zuletzt bekannte Provinzen</p><div class="action-row">${controls}</div></div>`;
      }).join('')||note('Du hast noch kein fremdes Reich entdeckt.');
    } else if(screen==='economy'){
      const ledger=economy(game,player);
      body+=heading('Versorgung')+note(`Aktive Armee und Garnisonen: ${ledger.supplyUsed} Versorgungspunkte. Bei ${difficulty(game).label} kostet je ${ledger.foodRate} Versorgungspunkte 1 Nahrung und je ${ledger.coinRate} Punkte 1 Krone. Zusammen mit der Verwaltung zahlt das Reich ${ledger.upkeep.food} Nahrung und ${ledger.upkeep.coin} Kronen je Rohstoffrunde.`);
      body+=note(`Eine Rohstoffrunde dauert ${Engine.economyInterval(game)*2} Sekunden bei 1×. Bau und Forschung zählen weiter in Zwei-Sekunden-Takten. Klick oben auf eine Ressource, um ihre Bilanz zu öffnen.`);
      if(state.stock.food<=0) body+=status('Nahrungsvorrat leer: −18 % Angriffsstärke.');
    } else {
      const market = domainsHave('market');
      const marketLedger=economy(game,player);
      body+=note(market?'Lose je 12 Rohstoffe. Die Handelsrepublik zahlt niedrigere Kaufpreise.':state.tech.includes('barter')?'Baue einen Markt in einer eigenen Stadt mit Ratshaus Stufe 1.':'Erforsche in der Steinzeit zuerst Tauschhandel. Danach kannst du einen Markt bauen.');
      body+=['food','wood','stone','metal'].map(key=>{
        const buy=Engine.tradePlan(game,player,key,'buy',marketLedger);
        const sell=Engine.tradePlan(game,player,key,'sell',marketLedger);
        return `<div class="order"><b>${resources[key][1]} ${resources[key][0]}</b><p>${state.stock[key]} / ${marketLedger.capacity[key]} auf Lager</p><div class="action-row">${button(`+12 · ${buy.price} ◉`,'trade',`${data(key)} data-side="buy"`,buy.why)}${button(`−12 · +${sell.price} ◉`,'trade',`${data(key)} data-side="sell"`,sell.why)}</div></div>`;
      }).join('');
    }
    if (!force && get('details').contains(document.activeElement) && document.activeElement.tagName==='INPUT') {
      updateForecast();
      return;
    }
    const wasOpen = get('forecast')?.querySelector('details')?.open;
    swap('details',body);
    if (wasOpen && get('forecast')?.querySelector('details')) get('forecast').querySelector('details').open=true;
  }
  const domainsHave = (id)=>owned(game,player).some(item=>game.tiles[item.id].sites[id]);
  function marchPanel() {
    const source = game.tiles[origin];
    if (source.owner!==player) return note('Ausgangsprovinz verloren.')+button('Abbrechen','cancel');
    const heading=orderMode==='raid'?'RAUBZUG AUS':orderMode==='reinforce'?'VERSTÄRKUNG AUS':orderMode==='scout'?'ERKUNDUNG AUS':'MARSCH AUS';
    return `<div class="order"><span class="eyebrow">${heading} ${lookup[origin].name.toUpperCase()}</span><p>${orderMode==='raid'?'Wähle die Truppen. Es wird keine Zielprovinz benötigt.':orderTargetHint()}</p>${armyRoster(player,orderArmy(source)).map(unit=>`<label class="unit-selection"><span>${unit.name} / ${source.army[unit.id]}</span><input type="number" min="0" max="${source.army[unit.id]}" value="${Math.min(army[unit.id]||0,source.army[unit.id])}" data-army="${unit.id}"></label>`).join('')}<div class="action-row">${button('Alle','troop-preset',data('all'))}${button('Hälfte','troop-preset',data('half'))}${button('Auswahl leeren','troop-preset',data('none'))}</div><div id="forecast">${forecast()}</div>${button('Abbrechen','cancel')}</div>`;
  }
  const forecastNumber = new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format;
  const percentBonus=multiplier=>Math.round((multiplier-1)*100);
  function defenseForces(result,region){
    if(!region.owner)return '<p>Freie Provinz · Nur die örtliche Garnison verteidigt.</p>';
    const flanks=result.support.groups.map(group=>`${lookup[group.place].name} +${group.amount}`).join(' · ');
    return `<p>Reichsgebiet · ${count(region.army)} vor Ort${flanks?` · Flanken: ${flanks}`:' · Keine flankierende Garnison in Sicht'}</p>${result.support.unknown?'<p>Nachbarprovinzen liegen im Kriegsnebel. Weitere Verteidiger sind möglich.</p>':''}`;
  }
  function forecast() {
    if(orderMode==='raid'&&origin&&game.tiles[origin].owner===player)return raidControls(game.tiles[origin]);
    if(!orderTarget(selected)) return `<p>${orderTargetHint()}</p>`;
    const source = game.tiles[origin];
    const target = region();
    const troops = Object.fromEntries(Object.entries(army).map(([key,amount])=>[key,Math.min(amount,source.army[key]||0)]));
    const num = count(troops);
    if(orderMode==='scout')return scoutControls(troops);
    if(!visible.has(selected)) return `<div class="forecast"><b>Erkundungsmarsch</b><p>Kein aktueller Bericht. Die Siegchance ist unbekannt.</p>${button('Truppen entsenden','march','',!num?'Keine Einheiten':'','primary')}</div>`;
    const friend = target.owner===player;
    const blocked = target.owner && !friend && relation(game,player,target.owner)!=='war';
    const breakdown = rows=>rows.map(item=>`<dd>${item.amount} × ${item.name} · ${Math.round(item.value)} Stärke${item.counter?` (${item.counter>0?'+':'−'}${Math.abs(item.counter)} % gegen diese Formation)`:''}${item.garrison&&item.garrison!==selected?` · ${lookup[item.garrison].name}`:''}</dd>`).join('')||'<dd>Keine Einheiten</dd>';
    const result = !friend&&num?battle(game,player,troops,selected,source.blessing?.style,source.armyXP,source.blessing?.rank||1,undefined,{from:origin,visible}):null;
    const detail=result?`<strong>${Math.round(result.chance*100)} %</strong>
      <p>Siegchance bei ${num} Angreifern gegen ${result.defCount} sichtbare Verteidiger</p>
      ${defenseForces(result,target)}
      <p>Ø ${forecastNumber(result.attackerLosses)} eigene / ${forecastNumber(result.defenderLosses)} gegnerische Verluste</p>
      <p>+${percentBonus(result.defenseBonus)} % Grundbonus für Verteidiger · ${terrain[lookup[selected].biome][0]} +${percentBonus(result.terrainBonus)} %${result.masonry?' · +10 % durch Steinmetzkunst':''}</p>
      <p>Befestigung St. ${result.wall}${result.wall!==result.effectiveWall?' (durch Sonnenfeuer umgangen)':result.effectiveWall?` · +${result.effectiveWall*16} % Mauerschutz vor Belagerung`:''}</p>
      ${result.provision<1?'<p class="negative">Kein Nahrungsvorrat · −18 % Angriff</p>':''}
      <details><summary>Gefechtsphasen und Stärkewerte</summary>
      <p>Verteidiger nutzen als Basis den höheren Angriffs- oder Schutzwert und erhalten darauf den Grundbonus. Hoher Schutz senkt zudem die Verluste. Die verbleibende Kampfstärke nach allen drei Phasen entscheidet. Belagerung schwächt den Mauerschutz.</p>
      <dl><dt>Angriff zu Gefechtsbeginn</dt>${breakdown(result.attackRows)}<dt>Verteidigung zu Gefechtsbeginn</dt>${breakdown(result.defendRows)}</dl>
      <p>Die Vorschau berücksichtigt Angriffswürfe von 80 bis 120 %. Die Lage kann sich vor der Ankunft ändern.${result.refugeUnknown?' Der Rückzugsort der Verteidiger ist ungeklärt.':''}</p></details>`:friend?'<b>Verstärkung</b>':'<p>Wähle Truppen für die Gefechtsvorschau.</p>';
    return `<div class="forecast">${detail}${blocked?'<p class="negative">Erkläre zuerst den Krieg.</p>':''}${button(friend?'Verstärken':'Angriff befehlen','march','',!num?'Keine Einheiten':blocked?'Nicht im Krieg':'','primary')}</div>`;
  }
  function tileSelection(id) {
    selected=id;
    selectedMarch=null;
    cityOpen=false;
    selectedSite=null;
    screen='province';
    if (origin) tab='army';
    render();
  }
  function setSpeed(value) {
    if(!room) pumpClock(false);
    speed=game.winner?0:value;
    simulationClock.speed(speed,performance.now());
    save();
    render();
  }
  function updateTimeLabel(){
    const readout=get('gameTime');
    const phase=visualPhase(performance.now());
    for(const node of document.querySelectorAll('[data-job-due]')) paintJobClock(node,game.tick+phase);
    if(readout){
      readout.textContent=clock(game.tick+phase);
      readout.title=game.winner?'Partie beendet':room?'Serverzeit':speed?'Spielzeit':'Pausiert';
    }
    if(room&&get('lanTime')) {
      const left=Math.max(0,Math.ceil((roomStarts-Date.now())/1000));
      get('lanTime').textContent=game.winner?'ENDE':left?`Start in ${left} s`:'LIVE';
    }
  }
  function syncRoomClock(snapshot){
    clockRoom=room;
    clockTick=snapshot.game.tick;
    clockSample=performance.now()-(snapshot.phase||0)*tickMs;
  }
  function acceptRoomState(snapshot){
    snapshot.game.events=snapshot.game.events.concat(game.events);
    game=snapshot.game;
    syncRoomClock(snapshot);
  }
  function visualPhase(now){
    if(!room)return simulationClock.fraction(now);
    if(game.winner||Date.now()<roomStarts||room!==clockRoom||game.tick!==clockTick)return 0;
    return Math.min(1,Math.max(0,(now-clockSample)/tickMs));
  }
  function pumpClock(paint=true){
    if(room||game.winner){if(paint)updateTimeLabel();return;}
    const ticks=simulationClock.take(performance.now());
    for(let index=0;index<ticks&&!game.winner;index++) advance(game);
    if(game.winner){speed=0;simulationClock.speed(0,performance.now());}
    if(ticks){save();if(paint)render();}
    else if(paint) updateTimeLabel();
  }
  function openDialog(type) {
    const titles={help:'Deine ersten Befehle',menu:'Hauptmenü',setup:'Neue Partie',saves:'Spielstände',history:'Chronik'};
    let body='';
    if(type==='help') body=`<ol><li>Wähle „1×“, um die Zeit zu starten. Ein Takt dauert zwei Sekunden.</li><li>Öffne „Stadt“ und wähle ein Gebäude oder Baugrundstück. Parallel kannst du Truppen rekrutieren oder im Reich Wissen investieren.</li><li>Wähle „Heer → Marsch vorbereiten“, klicke auf eine Nachbarprovinz und entscheide anhand der Vorschau. Eine Reise läuft weiter, während du andere Städte verwaltest.</li><li>Gegen ein anderes Reich brauchst du eine Kriegserklärung. Unabhängige Gebiete und Barbaren kannst du direkt angreifen.</li><li>Unter Staatsrat und Diplomatie änderst du Regierung und Religion oder verhandelst Bündnisse. Ein Markt ermöglicht Handel, ein Nachrichtendienst Spionage.</li><li>Du gewinnst, wenn alle anderen Völker vernichtet sind. Minikarte und Weltkarte zeigen nur entdeckte Gebiete. Drachen bewachen Amulette.</li><li>Ein Volk ist vernichtet, sobald es keine Stadt mehr hat. Seine Dörfer werden dann zu unbesetzten Barbarendörfern. Verteidiger haben Vorteile durch Gelände, Mauern und Nachbarprovinzen, der Angreifer braucht dafür etwa das 1,5-Fache an Truppen.</li></ol>`;
    else if(type==='setup'){
      choose=player;
      chooseLevel=game.difficulty||'standard';
      body=`<section id="factionPicker" class="faction-carousel" aria-label="Völkerauswahl" aria-roledescription="Karussell"><div class="faction-carousel-visual"><div id="factionPortrait" class="faction-portrait"></div><div class="faction-controls">${button('‹','faction-step',`${data(-1)} aria-label="Vorheriges Volk"`)}<span id="factionPosition" class="faction-position"></span>${button('›','faction-step',`${data(1)} aria-label="Nächstes Volk"`)}</div></div><div id="factionDetails" class="faction-details"></div><span id="factionAnnouncement" class="visually-hidden" role="status"></span></section><h3 class="faction-difficulty-title">Schwierigkeitsgrad</h3><div id="difficultyPicker" class="difficulty-picker"></div><div class="dialog-actions">${button('Neue Einzelpartie','solo','','','primary')}${button('LAN-Raum erstellen','host', '',location.protocol==='file:'?'Starte zuerst den Node-Server':'')}</div><div class="dialog-actions"><label class="room-label">LAN-Code <input id="roomCode" class="room-input" maxlength="6" autocomplete="off" spellcheck="false" value="${escapeHtml((new URLSearchParams(location.search).get('raum')||'').slice(0,6))}"></label>${button('Beitreten','join','',location.protocol==='file:'?'Starte zuerst den Node-Server':'')}</div>${room?`<div class="dialog-actions"><span class="tag">Raum ${room.code}</span>${button('Einladungslink kopieren','invite')}</div>`:''}`;
    } else if(type==='history'){
      body='<div id="historyContents"></div>';
    } else if(type==='saves'){
      body=`<p>Automatik und manuelle Speicherplätze sind getrennt. LAN-Partien sind serverseitig und lassen sich hier nicht speichern.</p><div id="saveList"></div>`;
    } else {
      const lost=Boolean((campaignStarted||room)&&defeated(game,player));
      const subtitle=room?`LAN · ${room.code} · ${difficulty(game).label}`:campaignStarted?`${folk(player).realm} · ${difficulty(game).label} · ${clock(game.tick)}`:'Noch keine Kampagne gestartet';
      body=`<div class="menu-campaign"><span class="eyebrow">DIE GROSSE WELTKARTE</span><strong>Äonenreiche</strong><p>${subtitle}</p></div>${lost?status('Diese Kampagne ist verloren. Starte neu oder lade einen früheren Spielstand.'):''}<div class="main-menu">${button('Neue Kampagne','setup','','','primary')}${button(lost?'Als Zuschauer öffnen':'Partie fortsetzen','resume','',campaignStarted||room?'':'Keine laufende Partie')}${button('Speichern / Laden','saves','',campaignStarted||saveSlots.some(slot=>readSave(slotKey(slot)))?'':'Keine Spielstände')}${button(lost?'Neu starten – gleiche Regeln':'Diese Partie neu starten','restart','',room?'Im LAN einen neuen Raum erstellen':campaignStarted?'':'Keine laufende Partie')}${room?button('Einladungslink kopieren','invite'):''}${button('Spielhilfe','guide')}</div>`;
    }
    get('dialogContent').innerHTML=`<header><div><span class="eyebrow">ÄONENREICHE / KAMPAGNE</span><h2 id="dialogTitle">${titles[type]}</h2></div><div class="dialog-actions">${type!=='menu'?button('Hauptmenü','home-menu'):''}${button('×','close','aria-label="Schließen"')}</div></header>${body}<p class="dialog-status" id="dialogStatus" role="status"></p>`;
    if(type==='setup'){drawChoices();drawDifficulty();}
    if(type==='saves') drawSaves();
    if(type==='history')drawHistory();
    if (!get('dialog').open) get('dialog').showModal();
  }
  const visibleHistory=()=>game.events.filter(event=>!event.party.length||event.party.includes(player));
  const historyRow=event=>button(`<b>${clock(event.time)}</b><span>${escapeHtml(event.text)}</span>`,'history-entry',data(event.id),'',`message history-row ${event.type}`);
  function historyReport(event){
    const detail=event.detail;
    const title=`<h3>${clock(event.time)} · Eintrag ${event.id}</h3><p>${escapeHtml(event.text)}</p>`;
    if(!detail)return title;
    let summary='';
    if(detail.kind==='battle'){
      const place=lookup[detail.target];
      const realm=id=>folk(id)?.realm||'Freie Provinz';
      const forces=(title,rows)=>`<section><h4>${title}</h4><ul>${rows.map(row=>`<li>${row.amount} × ${escapeHtml(row.name)} · ${row.saved} nach Gefecht und Rückzug${row.garrison&&row.garrison!==detail.target?` · ${escapeHtml(lookup[row.garrison].name)}`:''}</li>`).join('')||'<li>Keine Einheiten</li>'}</ul></section>`;
      const losses=(side,label)=>`<tr><th scope="row">${label}</th><td>${side.started}</td><td>${side.combat}</td><td>${side.withdrawal}</td><td>${side.stranded}</td><td>${side.survivors}</td></tr>`;
      summary=`<p>${escapeHtml(realm(detail.attacker))} gegen ${escapeHtml(realm(detail.defender))} · ${escapeHtml(place.name)} · ${terrain[detail.terrain][0]}</p>
        <p>Angriffschance ${Math.round(detail.forecast.chance*100)} % · Angriffswurf ${Math.round(detail.roll*100)} % · Schlussstärke ${Math.round(detail.finalStrength.attack)} : ${Math.round(detail.finalStrength.defense)}</p>
        <div class="history-forces">${forces('Angriff',detail.attackingUnits)}${forces('Verteidigung',detail.defendingUnits)}</div>
        <div class="history-table"><table><thead><tr><th>Seite</th><th>Anfang</th><th>Gefecht</th><th>Rückzug</th><th>Ohne Rückweg</th><th>Überlebt</th></tr></thead>
        <tbody>${losses(detail.losses.attack,'Angriff')}${losses(detail.losses.defense,'Verteidigung')}</tbody></table></div>
        <ul>${detail.phase.map(phase=>`<li>${phase.name} · ${phase.attack} : ${phase.defend} Stärke${phase.breach?` · ${phase.breach} % Mauerschutz gebrochen`:''}</li>`).join('')}</ul>`;
    }
    return `${title}${summary}<details><summary>Berechnungsdaten und Modifikatoren</summary><pre>${escapeHtml(JSON.stringify(detail,null,2))}</pre></details>`;
  }
  function drawHistory(){
    const all=visibleHistory();
    const filtered=historyFilter==='battle'?all.filter(event=>event.detail||event.text.includes('Verluste (Angriff / Verteidigung)')):all;
    const pages=Math.max(1,Math.ceil(filtered.length/30));
    historyPage=Math.min(historyPage,pages-1);
    const entry=all.find(event=>event.id===historySelection);
    swap('historyContents',`<div class="history-controls">${filters([['all','Alle'],['battle','Gefechte und Raubzüge']],historyFilter,'history-filter')}
      ${button('JSON exportieren','history-export')}</div><p>${filtered.length} Einträge</p>
      ${entry?`<article class="history-report">${historyReport(entry)}</article>`:''}
      <div class="history-list">${filtered.slice(historyPage*30,historyPage*30+30).map(historyRow).join('')||'<p>Keine Einträge.</p>'}</div>
      <div class="history-pages">${button('Neuer','history-page',data(-1),historyPage===0?'Neueste Einträge':'')}<span>Seite ${historyPage+1} / ${pages}</span>${button('Älter','history-page',data(1),historyPage+1===pages?'Älteste Einträge':'')}</div>`);
  }
  function exportHistory(){
    const payload={format:'aeonenreiche-chronik-v1',player,difficulty:game.difficulty,tick:game.tick,tickMs,
      realms:Object.fromEntries(peoples.map(item=>[item.id,item.realm])),entries:visibleHistory().reverse()};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`aeonenreiche-chronik-${player}-${game.tick}.json`;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function drawDifficulty(){
    swap('difficultyPicker',Object.entries(difficulties).map(([key,{label,description}])=>button(`<b>${label}</b><small>${description}</small>`,'difficulty',`${data(key)} aria-pressed="${key===chooseLevel}"`,'',key===chooseLevel?'active':'')).join(''));
  }
  function drawSaves(){
    const rows=[['auto','Automatisch',readSave()],...saveSlots.map(slot=>[slot,`Speicherplatz ${slot}`,readSave(slotKey(slot))])];
    swap('saveList',rows.map(([slot,label,snapshot])=>`<section class="save-row"><div><strong>${label}</strong><small>${saveSummary(snapshot)}</small></div><div class="action-row">${slot!=='auto'?button('Speichern','save-slot',data(slot),room?'LAN-Partie':''):''}${button('Laden','load-slot',data(slot),snapshot?'':'Kein Spielstand')}</div></section>`).join(''));
  }
  function drawChoices(direction=0) {
    const index=folkIndex(choose);
    const item=peoples[index];
    const path=factions[item.id];
    const roster=unitList(item.id);
    const special=roster.find(unit=>unit.id===path.unit);
    const elite=roster.find(unit=>unit.id==='elite');
    get('factionPicker').style.setProperty('--folk',item.color);
    swap('factionPortrait',`<div class="faction-slide" style="--slide-from:${direction*28}px">${peopleArt(item.id)}<span class="faction-emblem" aria-hidden="true">${item.icon}</span></div>`);
    get('factionPosition').textContent=`${index+1} / ${peoples.length}`;
    get('factionAnnouncement').textContent=`${item.name}, Volk ${index+1} von ${peoples.length}`;
    swap('factionDetails',`<div class="faction-profile"><div class="eyebrow">${item.realm}</div><h3>${item.name}</h3><p>${item.description}</p><dl>
      <dt>${item.hero} · ${item.power}</dt><dd>${powers[item.id]}</dd>
      <dt>${special.name} · ${ages[special.age]}</dt><dd>${special.ability} ${tech(path.research).name} schaltet die Einheit frei. ${building(path.building).name} erzeugt +1 ${resources[path.resource][0]} je Stufe und Rohstoffrunde.</dd>
      <dt>${elite.name} · Super-Einheit</dt><dd>${roles[elite.role]} ab ${ages[elite.age]}.</dd>
      </dl></div>`);
  }
  function rotateFaction(direction){
    const next=(folkIndex(choose)+direction+peoples.length)%peoples.length;
    choose=peoples[next].id;
    drawChoices(direction);
  }
  function loadMatch(nextGame,nextPlayer,nextRoom,starts=0,initialSpeed=1) {
    revision++;
    clearTimeout(recruitmentReset);
    recruitmentSpending={};
    marchTracks.clear();
    campaignStarted=true;
    resumeOnBoot=false;
    game=nextRoom?nextGame:hydrate(nextGame);
    player=nextPlayer;
    room=nextRoom;
    roomStarts=starts;
    simulationClock=createClock(performance.now());
    selected=capital(player);
    cityOpen=false;
    cityFilter='overview';
    selectedSite=null;
    selectedMarch=null;
    selectedNode='';
    unitFilter='all';
    researchFilter='current';
    resourceKey='food';
    drag=null;
    ignoreMapClick=false;
    get('map').classList.remove('dragging','political');
    get('borders').setAttribute('aria-pressed','false');
    clearTimeout(toastTimer);
    get('toast').classList.remove('visible');
    for(const id of ['details','cityView','workspace','messages'])get(id).scrollTop=0;
    zoom=regionalZoom;
    centerOn(selected);
    screen='province';
    tab='build';
    origin=null;
    army={};
    setSpeed(room?0:[0,1,2,4].includes(initialSpeed)?initialSpeed:1);
    save();
    if (get('dialog').open) get('dialog').close();
  }
  async function api(path,body) {
    const response = await fetch(`/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(4500)});
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error||'Serverfehler'),{status:response.status});
    return result;
  }
  const remember = (value) => {try {sessionStorage.setItem('aeonenreiche-room',JSON.stringify(value));} catch {}};
  async function connect(kind) {
    if (pending) return;
    const state = get('dialogStatus');
    const code = get('roomCode').value.trim().toUpperCase();
    if (kind==='join' && !/^[A-F0-9]{6}$/.test(code)) {state.textContent='Gib den sechsstelligen Raumcode ein.';return;}
    pending=true;
    state.textContent='Verbindung wird aufgebaut …';
    try {
      const result=await api(kind,{code,faction:choose,level:chooseLevel});
      const connection={code:result.code,token:result.token,faction:result.faction};
      remember(connection);
      loadMatch(result.game,result.faction,connection,result.starts);
      syncRoomClock(result);
      notice(`Raum ${connection.code} · Einladungslink im Partiemenü`);
    } catch (error) {state.textContent=error.message==='Failed to fetch'?'LAN-Server nicht erreichbar.':error.message;}
    finally {pending=false;}
  }
  function send(command) {
    if(!room) return sendNow(command);
    const connection=room;
    const request=roomCommands.then(()=>connection===room?sendNow(command):undefined);
    roomCommands=request.catch(()=>{});
    return request;
  }
  async function sendNow(command) {
    if (pending) return;
    let result;
    if (room) {
      revision++;
      pending=true;
      const previous=room;
      try {const response=await api('action',{...room,command,since:game.nextEventId-1}); if (room!==previous) return; acceptRoomState(response); result=response.error;}
      catch {notice('LAN-Server nicht erreichbar.'); return;}
      finally {pending=false;}
    } else {
      pumpClock(false);
      result=action(game,player,command);
      save();
    }
    if (result) notice(result);
    else {
      if(command.type==='train'){
        const unit=unitList(player).find(entry=>entry.id===command.key);
        for(const [key,amount] of Object.entries(unit.cost))recruitmentSpending[key]=(recruitmentSpending[key]||0)+amount;
        clearTimeout(recruitmentReset);
        recruitmentReset=setTimeout(()=>{recruitmentSpending={};render();},2400);
      }
      if (command.type==='march'||command.type==='raid') origin=null;
      if (!speed && !room && ['march','raid'].includes(command.type)) notice('Befehl erteilt. Starte die Zeit mit „1×“.');
    }
    render();
  }
  async function handleClick(event) {
    if(!get('mapContext').contains(event.target)) get('mapContext').hidden=true;
    const march=event.target.closest('[data-march]');
    if(march&&!ignoreMapClick){selectedMarch=Number(march.dataset.march);origin=null;render();return;}
    const stack=event.target.closest('[data-garrison]');
    if(stack&&!ignoreMapClick){tab='army';tileSelection(stack.dataset.garrison);return;}
    const board = event.target.closest('[data-tile]');
    if (board) {if (!ignoreMapClick) tileSelection(board.dataset.tile);return;}
    const control = event.target.closest('button[data-do]');
    if (!control || control.disabled) return;
    const {do:kind,key,side} = control.dataset;
    if(kind==='resume'){
      get('dialog').close();
      if(resumeOnBoot&&!room&&!defeated(game,player)&&owned(game,player).length) setSpeed([1,2,4].includes(saved?.speed)?saved.speed:1);
      resumeOnBoot=false;
      return;
    }
    if(kind==='home-menu'||kind==='guide'||kind==='setup'||kind==='saves'){
      openDialog(kind==='home-menu'?'menu':kind==='guide'?'help':kind);
      return;
    }
    if(kind==='difficulty'){chooseLevel=key;drawDifficulty();return;}
    if(['save-slot','load-slot','restart'].includes(kind)){
      if(pending) return;
      const message=get('dialogStatus');
      const checkpoint=key==='auto'?readSave():readSave(slotKey(key));
      const confirm=(text)=>{
        if(control.dataset.confirm==='yes') return true;
        control.dataset.confirm='yes';
        control.textContent='Bestätigen';
        message.textContent=text;
        return false;
      };
      if(kind==='save-slot'){
        if(room||!saveSlots.includes(Number(key)))return;
        if(checkpoint&&!confirm('Diesen Speicherplatz überschreiben?'))return;
        pumpClock(false);
        try {
          await storeSave(slotKey(key));
          message.textContent=`Spielstand ${key} gespeichert.`;
          get('saveList')._rendered=null;
          drawSaves();
        } catch {message.textContent='Speichern fehlgeschlagen. Prüfe den verfügbaren Browserspeicher.';}
      } else if(kind==='load-slot'){
        if(!checkpoint||!confirm('Diesen Stand laden? Der aktuelle automatische Stand wird ersetzt.'))return;
        remember(null);
        loadMatch(checkpoint.game,checkpoint.player,null,0,checkpoint.speed);
      } else if(!room&&confirm('Neu starten? Die automatische Sicherung wird ersetzt, manuelle bleiben erhalten.')){
        const level=game.difficulty||'standard';
        remember(null);
        loadMatch(create([player],level),player,null);
      }
      return;
    }
    if (kind==='faction-step') {rotateFaction(Number(key));return;}
    if(kind==='history'||kind==='history-entry'){
      const already=get('dialogTitle')?.textContent==='Chronik'&&get('dialog').open;
      historySelection=kind==='history-entry'?Number(key):null;
      if(already){drawHistory();get('historyContents').scrollIntoView({block:'start'});}
      else {historyPage=0;historyFilter='all';openDialog('history');}
      return;
    }
    if(kind==='history-filter'){historyFilter=key;historyPage=0;historySelection=null;drawHistory();return;}
    if(kind==='history-page'){historyPage+=Number(key);historySelection=null;drawHistory();return;}
    if(kind==='history-export'){exportHistory();return;}
    if (kind==='close') {get('dialog').close();return;}
    if (kind==='solo') {
      if (pending) return;
      if (savedOrProgress() && control.dataset.confirm!=='yes') {
        control.dataset.confirm='yes';
        control.textContent='Spielstand ersetzen';
        get('dialogStatus').textContent='Die neue Einzelpartie ersetzt deinen lokalen Spielstand. Klicke zur Bestätigung erneut.';
        return;
      }
      remember(null);
      loadMatch(create([choose],chooseLevel),choose,null);
      return;
    }
    if (kind==='host'||kind==='join') {await connect(kind);return;}
    if (kind==='invite') {
      const url=new URL(location.pathname,location.origin);
      url.searchParams.set('raum',room.code);
      get('roomCode').value=room.code;
      try {await navigator.clipboard.writeText(url.href);notice('Einladung kopiert.');} catch {get('dialogStatus').textContent=`Einladung: ${url.href}`;}
      return;
    }
    if (kind==='speed') {if(!campaignStarted&&!room){openDialog('menu');return;}setSpeed(Number(key));return;}
    if (kind==='screen') {
      selectedNode='';
      if(key==='city'){if(!chooseCity())return;tab='build';}
      else {screen=key;origin=null;cityOpen=false;}
    }
    else if (kind==='realm') {selected=capital(key);screen='province';origin=null;cityOpen=false;selectedSite=null;centerOn(selected);}
    else if(kind==='district'){cityFilter=key;selectedSite=null;tab='build';}
    else if(kind==='site'){selectedSite=key;tab='build';}
    else if(kind==='node')selectedNode=key;
    else if(kind==='close-march')selectedMarch=null;
    else if(kind==='recall'){await send({type:'recall',place:key});return;}
    else if(kind==='troop-preset'&&origin){
      const fraction={quarter:.25,half:.50,most:.75,all:1}[key]||0;
      const stationed=orderArmy(game.tiles[origin]);
      const proportions=Object.entries(stationed).map(([id,amount])=>[id,amount*fraction]);
      army=Object.fromEntries(proportions.map(([id,amount])=>[id,Math.floor(amount)]));
      let missing=Math.round(count(stationed)*fraction)-count(army);
      for(const [id] of proportions.sort((first,second)=>second[1]%1-first[1]%1)){
        if(missing<=0)break;
        army[id]++;
        missing--;
      }
    }
    else if(kind==='resource'){resourceKey=key;selectedNode='';screen='economy';cityOpen=false;origin=null;}
    else if(kind==='show-site'){
      if(!chooseCity())return;
      selectedSite=key;
      cityFilter=Object.keys(districts).find(district=>districts[district].includes(key))||'overview';
      tab='build';
    }
    else if(kind==='unit-filter')unitFilter=key;
    else if(kind==='research-filter')researchFilter=key;
    else if (kind==='tab') {tab=key;if (key!=='army') origin=null;}
    else if (['prepare','prepare-raid','prepare-reinforce','prepare-scout'].includes(kind)) {
      const source=key||selected;
      if(game.tiles[source]?.owner!==player||!count(game.tiles[source].army))return;
      if(kind==='prepare-scout'&&!game.tiles[source].army.scout)return;
      get('mapContext').hidden=true;
      selected=origin=source;orderMode={'prepare-raid':'raid','prepare-reinforce':'reinforce','prepare-scout':'scout'}[kind]||'march';army={...orderArmy(region())};cityOpen=false;screen='province';tab='army';
    }
    else if (kind==='cancel') origin=null;
    else if (kind==='march'||kind==='raid') {
      if(!origin||kind==='march'&&!orderTarget(selected))return;
      const stationed=orderArmy(game.tiles[origin]);
      const troops=Object.fromEntries(Object.entries(army).map(([unit,amount])=>[unit,Math.min(amount,stationed[unit]||0)]));
      const march=kind==='march'?{target:selected,scout:orderMode==='scout',reinforce:orderMode!=='scout'&&game.tiles[selected].owner===player}:{};
      await send({type:kind,place:origin,...march,army:troops});
      return;
    } else {
      await send({type:kind,place:selected,key,target:kind==='spy'?selected:key,side});
      return;
    }
    render();
    if(kind==='node') get('workspace').scrollTop=0;
  }
  const savedOrProgress = () => Boolean(readSave() || (!room && game.tick));
  document.addEventListener('click',handleClick);
  get('dialog').addEventListener('keydown',event=>{
    if(!get('factionPicker')?.contains(event.target)||!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();
    rotateFaction(event.key==='ArrowLeft'?-1:1);
  });
  document.addEventListener('pointerdown',event=>{
    if(event.isPrimary&&event.button===0) pressedControl=event.target.closest('button[data-do]');
  });
  for(const type of ['pointerup','pointercancel']) window.addEventListener(type,event=>{
    if(event.isPrimary&&pressedControl){
      pressedControl=null;
      setTimeout(render,0);
    }
  });
  window.addEventListener('blur',()=>{pressedControl=null;});
  function updateForecast() {
    const panel=get('forecast');
    if (!panel) return;
    const wasOpen=panel.querySelector('details')?.open;
    panel.innerHTML=forecast();
    if (wasOpen && panel.querySelector('details')) panel.querySelector('details').open=true;
    renderMapOrder();
  }
  document.addEventListener('input',event=>{
    if (!event.target.matches('[data-army]') || !origin) return;
    const key=event.target.dataset.army;
    army[key]=Math.max(0,Math.min(game.tiles[origin].army[key]||0,Math.floor(Number(event.target.value)||0)));
    const other=get('details').querySelector(`[data-army="${key}"]`);
    if(other&&other!==event.target)other.value=army[key];
    updateForecast();
  });
  const mapView=get('map');
  function provinceMenu(event,tile) {
    const id=tile?.dataset.tile;
    if(!id) return;
    event.preventDefault();
    const menu=get('mapContext');
    menu.hidden=true;
    if(orderTarget(id)&&(orderMode!=='march'||game.tiles[id].owner!==player)){
      tileSelection(id);
      get('mapOrder')?.querySelector('[data-do="march"]:not([disabled])')?.focus({preventScroll:true});
      return;
    }
    if(game.tiles[id].owner!==player)return;
    origin=null;
    tileSelection(id);
    const noArmy=count(game.tiles[id].army)?'':'Keine Truppen in der Garnison';
    const noNeighbor=neighbors[id].some(adjacent=>game.tiles[adjacent].owner===player)?'':'Keine eigene Nachbarprovinz';
    swap('mapContext',`<b>${escapeHtml(lookup[id].name)}</b>${button('Angreifen','prepare',data(id),noArmy,'primary')}${button('Verstärken','prepare-reinforce',data(id),noArmy||noNeighbor)}${game.tiles[id].army.scout?button('Erkunden','prepare-scout',data(id)):''}${noArmy||noNeighbor?`<small>${noArmy||noNeighbor}</small>`:''}`);
    menu.hidden=false;
    const bounds=get('canvas').getBoundingClientRect();
    const target=tile.getBoundingClientRect();
    const x=(event.clientX||target.left+target.width/2)-bounds.left;
    const y=(event.clientY||target.top+target.height/2)-bounds.top;
    menu.style.left=`${Math.max(6,Math.min(x,bounds.width-menu.offsetWidth-6))}px`;
    menu.style.top=`${Math.max(6,Math.min(y,bounds.height-menu.offsetHeight-6))}px`;
    menu.querySelector('button:not([disabled])')?.focus({preventScroll:true});
  }
  mapView.addEventListener('contextmenu',event=>provinceMenu(event,event.target.closest('[data-tile]')));
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||get('dialog').open||screen!=='province')return;
    if(!get('mapContext').hidden){get('mapContext').hidden=true;mapNodes[selected]?.node.focus({preventScroll:true});}
    else if(origin){origin=null;render();}
  });
  mapView.addEventListener('keydown',event=>{
    const march=event.target.closest('[data-march]');
    if(march&&['Enter',' '].includes(event.key)){event.preventDefault();selectedMarch=Number(march.dataset.march);origin=null;render();return;}
    const tile=event.target.closest('[data-tile]');
    if(tile&&(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10')){provinceMenu(event,tile);return;}
    if (tile && ['Enter',' '].includes(event.key)) {
      event.preventDefault();
      tileSelection(tile.dataset.tile);
      centerOn(tile.dataset.tile);
    }
    const movement={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if (movement) {
      event.preventDefault();
      focus=focus.map((value,index)=>value+movement[index]*110/zoom);
      updateCamera();
    }
  });
  function updateCamera() {
    if(!mapView.clientWidth||!mapView.clientHeight) return;
    const {width,height}=Relief;
    const aspect=(mapView.clientWidth||850)/(mapView.clientHeight||620);
    const viewWidth=Math.max(width,height*aspect)/zoom;
    const viewHeight=viewWidth/aspect;
    focus=focus.map((value,index)=>{
      const extent=index?height:width;
      const span=index?viewHeight:viewWidth;
      return span>=extent?extent/2:Math.max(span/2,Math.min(extent-span/2,value));
    });
    mapView.setAttribute('viewBox',`${focus[0]-viewWidth/2} ${focus[1]-viewHeight/2} ${viewWidth} ${viewHeight}`);
    mapView.classList.toggle('overview',zoom<3.8);
    mapView.classList.toggle('local-detail',zoom>=6);
    get('zoomOut').disabled=zoom<=1;
    get('zoomIn').disabled=zoom>=12;
    drawMinimap();
  }
  function centerOn(id) {focus=[...points[id]];updateCamera();}
  function mapPosition(event) {
    return new DOMPoint(event.clientX,event.clientY).matrixTransform(mapView.getScreenCTM().inverse());
  }
  function changeZoom(factor,event) {
    const before=event&&mapPosition(event);
    zoom=Math.max(1,Math.min(12,zoom*factor));
    updateCamera();
    if (before && zoom>1) {
      const after=mapPosition(event);
      focus=[focus[0]+before.x-after.x,focus[1]+before.y-after.y];
      updateCamera();
    }
  }
  mapView.addEventListener('wheel',event=>{
    if (event.ctrlKey) return;
    event.preventDefault();
    changeZoom(event.deltaY<0?1.22:1/1.22,event);
  },{passive:false});
  mapView.addEventListener('pointerdown',event=>{
    if (!event.isPrimary || event.button!==0) return;
    ignoreMapClick=false;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,focus:[...focus],scale:mapView.getScreenCTM().a};
  });
  mapView.addEventListener('pointermove',event=>{
    if (drag?.id!==event.pointerId) return;
    const dx=event.clientX-drag.x;
    const dy=event.clientY-drag.y;
    if (!ignoreMapClick && Math.hypot(dx,dy)<5) return;
    if (!ignoreMapClick) mapView.setPointerCapture(event.pointerId);
    ignoreMapClick=true;
    mapView.classList.add('dragging');
    focus=[drag.focus[0]-dx/drag.scale,drag.focus[1]-dy/drag.scale];
    updateCamera();
  });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) window.addEventListener(name,event=>{
    if (drag?.id!==event.pointerId) return;
    drag=null;
    mapView.classList.remove('dragging');
    setTimeout(()=>{ignoreMapClick=false;},0);
  });
  get('zoomIn').addEventListener('click',()=>changeZoom(1.38));
  get('zoomOut').addEventListener('click',()=>changeZoom(1/1.38));
  get('worldView').addEventListener('click',()=>{
    if(screen!=='province'){cityOpen=false;screen='province';render();updateCamera();return;}
    if (zoom===1) {zoom=regionalZoom;centerOn(selected);}
    else {zoom=1;updateCamera();}
  });
  get('borders').addEventListener('click',event=>{
    event.currentTarget.setAttribute('aria-pressed',String(mapView.classList.toggle('political')));
  });
  new ResizeObserver(updateCamera).observe(mapView);
  get('miniControl').addEventListener('click',event=>{
    const canvas=get('minimap');
    if(event.detail===0||event.target!==canvas){zoom=regionalZoom;centerOn(selected);return;}
    const box=canvas.getBoundingClientRect();
    zoom=Math.max(zoom,4);
    focus=[(event.clientX-box.left)/box.width*Relief.width,(event.clientY-box.top)/box.height*Relief.height];
    updateCamera();
  });
  get('help').addEventListener('click',()=>openDialog('help'));
  get('menu').addEventListener('click',()=>openDialog('menu'));
  for(const [id,icon,label] of [['help',18,''],['menu',19,'Hauptmenü'],['zoomOut',16,''],['zoomIn',17,'']]) get(id).innerHTML=uiArt(icon)+label;
  setInterval(async()=>{
    if (!room || pending || polling) return;
    const previous=room;
    const snapshot=revision;
    polling=true;
    try {const result=await api('state',{...room,since:game.nextEventId-1});if (room===previous && !pending && revision===snapshot && result.game.tick>=game.tick) {roomStarts=result.starts;acceptRoomState(result);render();}}
    catch {if (room===previous) get('modeLabel').textContent=`LAN · Verbindung unterbrochen`;}
    finally {polling=false;}
  },1000);
  drawMap(terrainTexture);
  updateCamera();
  render();
  const inviteCode=new URLSearchParams(location.search).get('raum');
  openDialog(inviteCode?'setup':'menu');
  setInterval(pumpClock,120);
  requestAnimationFrame(animationFrame);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)pumpClock();});
  if (location.protocol!=='file:') {
    let restored;
    try {restored=JSON.parse(sessionStorage.getItem('aeonenreiche-room'));} catch {}
    if (restored && (!inviteCode || restored.code===inviteCode)) {
      const snapshot=revision;
      api('state',restored).then(result=>{
        if (revision===snapshot && !room && !pending){
          loadMatch(result.game,restored.faction,restored,result.starts);
          syncRoomClock(result);
        }
      }).catch(error=>{
        if(revision!==snapshot||room) return;
        if(error.status===403||error.status===404) remember(null);
        else notice('LAN vorübergehend nicht erreichbar. Lade die Seite neu, um erneut zu verbinden.');
      });
    }
  }
})();

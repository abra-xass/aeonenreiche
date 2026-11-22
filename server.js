const http = require('node:http');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {randomBytes} = require('node:crypto');
const Engine = require('./engine');
const {createClock}=require('./clock');
const {peoples} = require('./world');

const host = process.argv.includes('--lan')?'0.0.0.0':'127.0.0.1';
const port = Number(process.env.PORT || 4173);
const rooms = new Map();
const website = new Map([
  ['/',['index.html','text/html']],['/index.html',['index.html','text/html']],['/style.css',['style.css','text/css']],
  ['/art.css',['art.css','text/css']],
  ['/assets/settlement.webp',['assets/settlement.webp','image/webp']],
  ['/assets/buildings.webp',['assets/buildings.webp','image/webp']],
  ['/assets/terrain.webp',['assets/terrain.webp','image/webp']],
  ['/assets/units.webp',['assets/units.webp','image/webp']],
  ['/assets/knowledge.webp',['assets/knowledge.webp','image/webp']],
  ['/assets/technology.webp',['assets/technology.webp','image/webp']],
  ['/assets/peoples.webp',['assets/peoples.webp','image/webp']],
  ['/assets/interface.webp',['assets/interface.webp','image/webp']],
  ['/assets/settlements.webp',['assets/settlements.webp','image/webp']],
  ['/assets/cultures.webp',['assets/cultures.webp','image/webp']],
  ['/assets/newfolk.webp',['assets/newfolk.webp','image/webp']],
  ['/assets/guards.webp',['assets/guards.webp','image/webp']],
  ['/assets/specialists.webp',['assets/specialists.webp','image/webp']],
  ['/assets/special-sites.webp',['assets/special-sites.webp','image/webp']],
  ['/assets/epochs.webp',['assets/epochs.webp','image/webp']],
  ['/assets/primitive.webp',['assets/primitive.webp','image/webp']],
  ...['folk-barracks','folk-markets','folk-spears'].map(name=>[`/assets/${name}.webp`,[`assets/${name}.webp`,'image/webp']]),
  ...['world','engine','relief','clock','app'].map(name=>[`/${name}.js`,[`${name}.js`,'text/javascript']]),
].map(([path,[filename,contentType]])=>[path,{bytes:readFileSync(join(__dirname,filename)),contentType}]));

const respond = (response,status,body) => {
  response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  response.end(JSON.stringify(body));
};
async function bodyOf(request) {
  if (request.headers['content-type']?.split(';')[0]!=='application/json') return null;
  let size=0;
  const chunks=[];
  for await (const chunk of request) {
    size+=chunk.length;
    if (size>8192) return null;
    chunks.push(chunk);
  }
  try {return JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {return null;}
}
const server = http.createServer(async (request,response)=>{
  const path = request.url.split('?')[0];
  try {
    if (request.method==='GET' || request.method==='HEAD') {
      const asset=website.get(path);
      if (!asset) return respond(response,404,{error:'Nicht gefunden.'});
      response.writeHead(200,{'Content-Type':`${asset.contentType}; charset=utf-8`,'Content-Length':asset.bytes.length,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",'Cache-Control':'no-cache','Referrer-Policy':'no-referrer'});
      return response.end(request.method==='HEAD'?undefined:asset.bytes);
    }
    if (request.method!=='POST' || !['/api/host','/api/join','/api/state','/api/action'].includes(path)) return respond(response,404,{error:'Nicht gefunden.'});
    if (request.headers.origin && request.headers.origin!==`http://${request.headers.host}`) return respond(response,403,{error:'Anfrage von fremder Website abgelehnt.'});
    const body=await bodyOf(request);
    if (!body || typeof body!=='object' || Array.isArray(body)) return respond(response,400,{error:'Ungültige Anfrage.'});
    let code=body.code;
    let room=rooms.get(code);
    if (path==='/api/host' || path==='/api/join') {
      if (!peoples.some(folk=>folk.id===body.faction)) return respond(response,400,{error:'Wähle ein gültiges Volk.'});
      if (path==='/api/host') {
        if (rooms.size>=20) return respond(response,503,{error:'Zu viele offene LAN-Räume.'});
        do {code=randomBytes(3).toString('hex').toUpperCase();} while (rooms.has(code));
        const now=performance.now();
        const clock=createClock(now,now+10000);
        clock.speed(1,now);
        room={game:Engine.create([],body.level),tokens:new Map(),active:Date.now(),starts:Date.now()+10000,clock};
        rooms.set(code,room);
      } else if (!room) return respond(response,404,{error:'Raum nicht gefunden. Prüfe Adresse und Raumcode.'});
      if (room.game.winner || room.game.humans.includes(body.faction) || !Engine.owned(room.game,body.faction).length) return respond(response,409,{error:'Das Volk ist vergeben, ausgeschieden oder die Partie ist beendet.'});
      const token=randomBytes(24).toString('hex');
      room.tokens.set(token,body.faction);
      room.game.humans.push(body.faction);
      room.active=Date.now();
      return respond(response,200,{game:Engine.view(room.game,body.faction),starts:room.starts,phase:room.clock.fraction(performance.now()),code,token,faction:body.faction});
    }
    if (!room) return respond(response,404,{error:'Raum nicht gefunden.'});
    const faction=room.tokens.get(body.token);
    if (!faction) return respond(response,403,{error:'Kein gültiger Platz in diesem Raum.'});
    const since=Number.isSafeInteger(body.since)&&body.since>=0?body.since:0;
    room.active=Date.now();
    if (path==='/api/action') {
      const command=body.command;
      if (!command || typeof command.type!=='string' || ['place','key','target','side'].some(key=>command[key]!=null && typeof command[key]!=='string')) return respond(response,400,{error:'Ungültiger Befehl.'});
      const error=Engine.action(room.game,faction,command);
      return respond(response,200,{game:Engine.view(room.game,faction,since),starts:room.starts,phase:room.clock.fraction(performance.now()),error});
    }
    return respond(response,200,{game:Engine.view(room.game,faction,since),starts:room.starts,phase:room.clock.fraction(performance.now())});
  } catch {
    if (!response.headersSent && !response.destroyed) respond(response,400,{error:'Die Anfrage konnte nicht verarbeitet werden.'});
  }
});
const timer=setInterval(()=>{
  const now=Date.now();
  for (const [code,room] of rooms) {
    if (now-room.active>30*60*1000) rooms.delete(code);
    else if(!room.game.winner){
      const ticks=room.clock.take(performance.now());
      for(let index=0;index<ticks&&!room.game.winner;index++) Engine.advance(room.game);
    }
  }
},150);
timer.unref();
server.requestTimeout=10000;
server.listen(port,host,()=>{
  console.log(`Äonenreiche: http://127.0.0.1:${port}`);
  if (host==='0.0.0.0') {
    const {networkInterfaces}=require('node:os');
    for (const addresses of Object.values(networkInterfaces())) for (const address of addresses || []) {
      if (!address.internal && address.family==='IPv4') console.log(`LAN: http://${address.address}:${port}`);
    }
  }
});

(() => {
  const peoples = [
    ['aurel','Menschen','#69b0de','♜','Aurelische Liga','Elara Kronwacht','Heerbann','Sonnenlanze','heavy'],
    ['sylva','Elben','#7cbd92','✦','Sylvanischer Bund','Nyriel Mondfeder','Waldschleier','Sternenbogengarde','ranged'],
    ['grak','Orks','#e68668','⚒','Grakhor-Khanat','Gorak Aschefaust','Blutrausch','Aschekoloss','heavy'],
    ['brindle','Hobbits','#e0b765','❋','Brindelmark','Pippa Dornfuß','Hinterhalt','Dornpfad-Plänkler','ranged'],
    ['veil','Spirits','#b99ade','◈','Schleierreich','Vael Nebelkind','Seelensturm','Schleierleviathan','air'],
    ['root','Ents','#a4bb6f','♣','Wurzelkonklave','Altborke','Wurzelwall','Weltenbaumwächter','heavy'],
    ['goa','Goa Uhls','#e5a764','☉','Goa-Uhl-Dynastie','Seth-Ra','Sonnenfeuer','Sonnenbarke','air'],
    ['pam','Pampegons','#db8cb8','⬡','Pampegon-Kollektiv','Mira Quarzherz','Prismenschild','Prismenläufer','mobile'],
    ['abra','Abraxianer','#df7864','◆','Abrax-Dominion','Azrak Glutschuppe','Basaltzorn','Basaltbrecher','siege'],
    ['andro','Andromedaner','#76cbea','✺','Andromeda-Konklave','Lyra Sternsegel','Sternenformation','Sichelkreuzer','air'],
    ['matrix','Matrixianer','#65c6ab','▣','Matrix-Knoten','Kern Neun','Adaptive Matrix','Schienenläufer','mobile'],
    ['avatar','Avatarer','#9c9cee','✿','Hainpakt der Avatarer','Saela Geistweber','Lebender Wall','Astralhirsch','heavy'],
    ['dwarf','Zwerge','#e8ad77','⛏','Bund der Tiefenhallen','Borin Runenschmied','Runensegen','Eisengolem','heavy'],
    ['insect','Insektoiden','#b9d43c','❂','Schwarmstaat der Insektoiden','Königin Zzyra','Schwarmgeist','Chitinkoloss','infantry'],
  ].map(([id,name,color,icon,realm,hero,power,elite,role],index) => {
    const [build,preferred,nerve,style]=[
      ['market','infantry',.78,'Handel und ausgewogene Heere'],['range','ranged',.79,'Fernkampf und Landschaftsschutz'],
      ['barracks','heavy',.76,'Früher militärischer Druck'],['farm','ranged',.80,'Wachstum und sichere Feldzüge'],
      ['academy','air',.80,'Wissen und spätere Lufthoheit'],['wall','heavy',.80,'Befestigte Grenzen'],
      ['mint','siege',.75,'Währung und Belagerung'],['factory','mobile',.76,'Industrie und bewegliche Truppen'],
      ['forge','siege',.74,'Belagerung und trockene Grenzlande'],['farm','ranged',.76,'Fernkampf, Ausbau und spätere Luftstreitkräfte'],
      ['factory','mobile',.74,'Mobile und schwere Verbände'],['watch','ranged',.79,'Waldverteidigung und Erkundung'],
      ['quarry','heavy',.77,'Festungen und schwere Infanterie'],
      ['farm','infantry',.76,'Masse, schneller Ausbau und Überzahl'],
    ][index];
    const culture=['Kronenbund','Sternenholz','Aschenclan','Heckenmark','Nebelreich','Wurzelhain','Sonnenhof','Prismabund','Basaltbund','Sternenflotte','Netzknoten','Hainpakt','Tiefenhallen','Schwarmhort'][index];
    const description=[
      'Die Aurelische Liga verbindet Handelsstädte mit vielseitigen Heeren. Ihr Heerbann stärkt alle Truppengattungen zugleich.',
      'Der Sylvanische Bund spielt seine Stärke mit Fernkämpfern in bewaldeten Provinzen aus. Nyriels Waldschleier macht Wälder besonders wertvoll.',
      'Das Grakhor-Khanat setzt auf druckvolle Feldzüge mit Infanterie, schweren Truppen und beweglichen Ascheneber-Reitern.',
      'Die Brindelmark setzt auf Fernkampf aus der Deckung. Pippas Hinterhalt hilft, schneller anzukommen und Fernkämpfer im richtigen Moment zu stärken.',
      'Das Schleierreich verbindet Wissensgewinn mit Fernkampfabwehr. Vael schwächt feindliche Schützen und Flieger besonders stark.',
      'Das Wurzelkonklave hält befestigte Grenzprovinzen mit schweren Truppen. Altborkes Wurzelwall ist in der Verteidigung am stärksten.',
      'Die Goa-Uhl-Dynastie ist auf Durchbrüche gegen befestigte Ziele ausgerichtet. Seth-Ra kann bei einem Angriff gegnerische Mauern umgehen.',
      'Das Pampegon-Kollektiv setzt auf bewegliche Verbände und Aufklärung. Miras Prismenschild hält Truppen im Gefecht länger einsatzfähig.',
      'Das Abrax-Dominion verbindet Belagerungswaffen mit Feldzügen in Wüste und Steppe. Azrak verstärkt besonders die Belagerung.',
      'Das Andromeda-Konklave nutzt Fernkampf und im späteren Spiel Lufteinheiten. Lyras Formation verstärkt beide Truppengattungen.',
      'Der Matrix-Knoten setzt auf mobile und schwere Verbände. Kern Neun stärkt beide, während Schildnetz-Sentinels auf gegnerische Belagerung reagieren.',
      'Der Hainpakt kontrolliert bewaldete Grenzen. Saelas Fähigkeit stärkt dort Angriffe und besonders die Verteidigung.',
      'Der Bund der Tiefenhallen setzt auf schwere Truppen und Belagerung. Borins Runensegen entfaltet im Gebirge seine größte Wirkung.',
      'Der Schwarmstaat der Insektoiden überwältigt mit Masse. Königin Zzyras Schwarmgeist stärkt Infanterie und Speertruppen, und große Heere kämpfen mit Schwarmtaktik noch besser.',
    ][index];
    return {id,name,color,icon,realm,hero,power,elite,role,culture,description,doctrine:{build,role:preferred,nerve,style}};
  });
  const powers = {
    aurel:'Alle eigenen Einheiten erhalten +24 % Kampfstärke.',
    sylva:'Eigene Einheiten erhalten im Wald +30 %, sonst +10 % Kampfstärke.',
    grak:'Infanterie und schwere Einheiten erhalten +28 %, alle übrigen +8 % Kampfstärke.',
    brindle:'Verkürzt den Marsch um einen Takt und stärkt Fernkämpfer um 52 %, alle übrigen um 5 %.',
    veil:'Schwächt feindlichen Fernkampf und Lufteinheiten um 32 %, übrige Gegner um 14 %.',
    root:'Eigene Einheiten erhalten bei der Verteidigung +27 %, beim Angriff +14 % Kampfstärke.',
    goa:'Alle eigenen Einheiten erhalten +20 % Kampfstärke; beim Angriff werden gegnerische Mauern ignoriert.',
    pam:'Alle eigenen Einheiten erhalten +10 % Kampfstärke, erleiden ein Drittel weniger Gefechtsverluste vor Rundung und ziehen sich geordneter zurück.',
    abra:'Belagerung erhält +55 %, andere Einheiten erhalten in Wüste und Steppe +20 % Stärke.',
    andro:'Lufteinheiten erhalten +45 %, Fernkampf +42 %, alle übrigen +6 % Stärke.',
    matrix:'Mobile und schwere Truppen erhalten +42 % Stärke, alle übrigen +12 %.',
    avatar:'Im Wald, in Taiga und Regenwald erhalten Verteidiger +38 % Stärke, Angreifer +28 %, außerhalb davon +5 %.',
    dwarf:'Schwere Einheiten und Belagerungswaffen erhalten +30 % Stärke, im Gebirge +40 %.',
    insect:'Infanterie und Speertruppen erhalten +36 %, alle übrigen +13 % Kampfstärke.',
  };
  const ages = ['Steinzeit','Bronzezeit','Eisenzeit','Mittelalter','Industriezeitalter','Informationszeitalter','Weltraumzeitalter'];
  const eraCost = [25,55,90,145,215,305];
  const milestones = [
    {tech:['cultivation','carpentry'],sites:[['hall',1],['lumber',1]],land:8,settled:1,research:2,materials:{food:75,wood:45},time:6},
    {tech:['bronze'],sites:[['mine',1],['quarry',1]],land:10,settled:1,research:5,materials:{food:95,stone:60,metal:25},time:9},
    {tech:['masonry','ledger'],sites:[['hall',2],['market',1]],land:12,settled:2,research:8,materials:{food:115,stone:95,coin:100},time:13},
    {tech:['printing','engineering'],sites:[['forge',1],['academy',1]],land:15,settled:2,research:12,materials:{wood:125,metal:100,coin:160},time:18},
    {tech:['steel','electricity'],sites:[['factory',1],['foundry',1]],land:18,settled:3,research:16,materials:{metal:155,coin:220},time:23},
    {tech:['network','rocketry'],sites:[['lab',2],['academy',2]],land:21,settled:3,research:20,materials:{metal:235,coin:325},time:30},
  ];
  const terrain = {plain:['Ebene','#69854b',1],forest:['Wald','#2e563c',1.20],highland:['Hochland','#827d70',1.18],mountain:['Gebirge','#656979',1.22],desert:['Wüste','#c8914d',1.06],marsh:['Marschland','#526f59',1.26],coast:['Küste','#789079',1.08],tundra:['Tundra','#9a9c8e',1.12],taiga:['Taiga','#41615b',1.20],jungle:['Regenwald','#26774a',1.32],savanna:['Savanne','#a69748',1.06],steppe:['Steppe','#a58255',1.04]};
  const buildings = [
    ['hall','Ratshaus','♜',0,3,{wood:75,stone:35},null,'Steuern, Wissen und Zugang zu höheren Baustufen.'],
    ['farm','Ackerland','❋',0,3,{wood:45},null,'+4 Nahrung je Stufe je Rohstoffrunde.'],
    ['lumber','Holzfällerlager','♣',0,3,{wood:35,food:15},null,'+3 Holz je Stufe je Rohstoffrunde.'],
    ['quarry','Steinbruch','◆',0,3,{wood:50},null,'+3 Stein je Stufe je Rohstoffrunde.'],
    ['barracks','Kaserne','⚔',0,3,{wood:60,stone:20},['hall',1],'Schaltet Infanterie und Eliteeinheiten frei.'],
    ['range','Schießplatz','➹',0,3,{wood:55,stone:20},['barracks',1],'Schaltet Fernkampfeinheiten frei.'],
    ['market','Markt','⚖',0,3,{wood:70,stone:35},['hall',1],'Ein Tauschplatz ab der Steinzeit. Ermöglicht Warenhandel und erzeugt Kronen.'],
    ['mine','Erzmine','◇',1,3,{wood:75,stone:30},['quarry',1],'+3 Metall je Stufe je Rohstoffrunde.'],
    ['temple','Heiligtum','☉',1,3,{wood:60,stone:60},['hall',1],'Erzeugt Einfluss und ermöglicht die Wahl eines Glaubens.'],
    ['wall','Befestigung','▥',1,3,{wood:25,stone:80},['hall',1],'+16 % Verteidigung je Stufe vor Belagerung.'],
    ['stable','Stallungen','♞',2,2,{food:70,wood:85},['barracks',1],'Ermöglicht Kavallerie.'],
    ['academy','Akademie','✧',2,3,{wood:95,coin:60},['hall',2],'+4 Wissen je Stufe je Rohstoffrunde.'],
    ['forge','Belagerungswerkstatt','⚙',3,3,{metal:65,stone:85},['mine',1],'Baut Wurfmaschinen; mit neuer Forschung auch Geschütze.'],
    ['spy','Nachrichtendienst','◉',3,2,{coin:100,metal:25},['hall',2],'Erlaubt Aufklärung und Sabotage.'],
    ['lab','Forschungslabor','⌬',5,2,{coin:125,metal:120},['academy',2],'+8 Wissen je Stufe je Rohstoffrunde; ermöglicht Drohnen.'],
    ['gate','Orbitalwerft','⦿',6,2,{coin:200,metal:160},['lab',1],'Ermöglicht Orbitaltruppen und Luft-Eliteeinheiten.'],
    ['granary','Kornspeicher','▤',0,3,{wood:65,stone:20},['farm',1],'+3 Nahrung je Stufe je Rohstoffrunde.'],
    ['watch','Wachturm','▲',0,3,{wood:50,stone:45},['hall',1],'Erweitert die lokale Sichtweite ab Stufe 1.'],
    ['mint','Münzstätte','◉',2,3,{wood:55,metal:35},['market',1],'+4 Kronen je Stufe je Rohstoffrunde.'],
    ['foundry','Hochofen','♨',4,3,{stone:95,metal:70},['forge',1],'+5 Metall je Stufe je Rohstoffrunde.'],
    ['observatory','Sternwarte','✶',3,3,{stone:85,coin:95},['academy',1],'+5 Wissen je Stufe je Rohstoffrunde.'],
    ['factory','Fahrzeugwerk','▣',4,3,{metal:90,coin:115},['foundry',1],'Schaltet Panzer und motorisierte Einheiten frei.'],
  ].map(([id,name,icon,age,max,cost,req,desc]) => ({id,name,icon,age,max,cost,req,desc}));
  const buildingTech={
    granary:['cultivation'],watch:['carpentry'],market:['barter'],mine:['prospectingEarly'],
    range:['carpentry'],wall:['bronze'],stable:['horsemanship'],academy:['ledger'],
    forge:['siegecraft'],spy:['cartography'],observatory:['optics'],mint:['ledger'],
    foundry:['steel'],factory:['electricity'],lab:['electronics'],gate:['fusion'],
  };
  const buildingTime={hall:5,farm:2,lumber:3,quarry:4,barracks:5,range:4,market:6,mine:8,temple:7,wall:9,stable:6,academy:8,forge:10,spy:8,lab:14,gate:26,granary:4,watch:4,mint:7,foundry:14,observatory:10,factory:16};
  const units = [
    ['club','Keulenträger','infantry',0,'hall',1,7,6,{food:22},'⚔'],['sling','Schleuderer','ranged',0,'range',1,10,5,{food:15,stone:11},'➹'],
    ['spear','Bronzespeerwache','spear',1,'barracks',1,11,12,{food:24,metal:9},'♠'],['archer','Langbogenschützen','ranged',3,'range',2,23,12,{food:26,wood:22},'➹'],
    ['horse','Kavallerie','mobile',2,'stable',1,25,18,{food:45,metal:12},'♞'],['knight','Ritterorden','heavy',3,'barracks',2,32,35,{food:40,metal:30},'♜'],
    ['siege','Trebuchet','siege',3,'forge',1,51,14,{wood:55,metal:25},'⚙'],['rifle','Linieninfanterie','infantry',4,'barracks',2,37,31,{food:28,metal:32},'✛'],
    ['artillery','Feldartillerie','siege',4,'forge',2,65,29,{metal:52,coin:28},'✹'],['tank','Kampfpanzer','mobile',4,'factory',1,86,62,{metal:72,coin:41},'▣'],
    ['drone','Kampfdrohne','air',5,'lab',1,75,44,{metal:51,coin:40},'⬡'],['orbital','Orbitallegion','air',6,'gate',1,125,108,{metal:87,coin:80},'⦿'],
    ['scout','Kundschafter','mobile',0,'hall',1,5,4,{food:18,wood:10},'◉','Erweitert die örtliche Sicht um einen Kartenring. Kann Nachbarprovinzen ohne Kampf erkunden.'],
    ['skirmish','Jägertrupp','ranged',1,'range',1,15,10,{food:24,wood:16},'➶'],
    ['guard','Pikenbataillon','spear',3,'barracks',2,24,32,{metal:25,food:32},'♠'],
    ['carrier','Spähfahrzeug','mobile',4,'factory',1,57,34,{metal:39,coin:31},'◇'],
    ['exosuit','Exogarde','heavy',6,'lab',2,113,131,{metal:98,coin:67},'♜'],
    ['iron','Eisenschildwache','heavy',2,'barracks',2,18,25,{food:34,metal:18},'▣'],
    ['mech','Verbundpanzer','mobile',5,'factory',2,101,79,{metal:83,coin:46},'▣'],
  ].map(([id,name,role,age,site,level,atk,def,cost,icon,ability]) => ({id,name,role,age,site,level,atk,def,cost,icon,...(ability?{ability}:{})}));
  const unitTech={spear:['bronze'],horse:['horsemanship'],archer:['bowcraft'],knight:['masonry'],siege:['siegecraft'],rifle:['gunpowder'],artillery:['gunpowder','steel'],tank:['electricity','steel'],drone:['network'],orbital:['fusion'],guard:['siegecraft'],carrier:['electricity'],exosuit:['fusion'],iron:['ironworking'],mech:['automation']};
  const techs = [
    ['cultivation','Feldbau',0,14,'+1 Nahrung je Stadt mit Ratshaus und Rohstoffrunde.'],['carpentry','Holzverarbeitung',0,18,'+1 Holz je Stadt mit Ratshaus und Rohstoffrunde.'],
    ['logistics','Heereslogistik',1,28,'Heeresunterhalt sinkt um ein Drittel.'],['bronze','Bronzeguss',1,35,'+8 % Angriff und Verteidigung.'],
    ['masonry','Steinmetzkunst',2,50,'+5 % Verteidigung.'],['ledger','Buchführung',2,55,'+2 Kronen je Stadt mit Ratshaus und Rohstoffrunde.'],
    ['cartography','Kartografie',3,70,'Marschdauer sinkt um einen Takt (Märsche dauern 5, im Gebirge 7 und über See 10 Takte).'],['printing','Buchdruck',3,80,'+1 Wissen je Stadt mit Ratshaus und Rohstoffrunde.'],
    ['steel','Stahlproduktion',4,115,'+16 % Angriff und Verteidigung.'],['engineering','Mechanische Werkzeuge',3,96,'Senkt die berechnete Bauzeit um 18 %, bevor die Obergrenze von 80 Minuten greift.'],
    ['network','Datennetze',5,170,'+3 Wissen je Stadt mit Ratshaus und Rohstoffrunde.'],['fusion','Fusionsantrieb',6,245,'+20 % Angriff und Verteidigung.'],
    ['irrigation','Bewässerung',1,32,'+1 Nahrung je Stadt mit Ratshaus und Rohstoffrunde.'],
    ['prospecting','Prospektion',2,47,'+2 Metall aus Gebirgen und Erzminen.'],
    ['optics','Optik',3,75,'Wachtürme decken einen weiteren Ring auf.'],
    ['automation','Automatisierung',5,170,'Rekrutierung dauert zwei Takte weniger.'],
    ['barter','Tauschhandel',0,16,'Schaltet den Markt frei. Ratshaus Stufe 1 genügt für den ersten Tauschplatz.'],
    ['prospectingEarly','Erzkunde',1,24,'Schaltet Erzminen frei und ermöglicht anschließend den Bronzeguss.'],
    ['ironworking','Eisenverhüttung',2,45,'Schaltet die Eisenschildwache frei.'],
    ['horsemanship','Reitkunst',2,37,'Schaltet Stallungen und Kavallerie frei.'],
    ['bowcraft','Bogenbau',3,49,'Schaltet Langbogenschützen frei.'],
    ['siegecraft','Belagerungsmechanik',3,60,'Schaltet die Belagerungswerkstatt, Trebuchets und Pikenbataillone frei.'],
    ['gunpowder','Schießpulver und Geschützguss',3,88,'Ermöglicht im Industriezeitalter Linieninfanterie und Feldartillerie.'],
    ['electricity','Elektrifizierung',4,120,'Schaltet das Fahrzeugwerk frei.'],
    ['electronics','Halbleitertechnik',5,138,'Schaltet das Forschungslabor frei.'],
    ['rocketry','Orbitalraketen',5,195,'Ermöglicht den Aufstieg ins Weltraumzeitalter.'],
  ].map(([id,name,age,cost,desc]) => ({id,name,age,cost,desc}));
  const technologyLinks={
    irrigation:{tech:['cultivation'],site:['farm',1]},logistics:{tech:['cultivation'],site:['barracks',1]},
    bronze:{tech:['prospectingEarly'],site:['mine',1]},masonry:{tech:['carpentry'],site:['quarry',1]},
    ledger:{tech:['barter'],site:['market',1]},prospecting:{tech:['prospectingEarly'],site:['mine',1]},
    ironworking:{tech:['bronze'],site:['mine',1]},horsemanship:{tech:['logistics']},
    bowcraft:{tech:['carpentry'],site:['range',1]},siegecraft:{tech:['masonry','ironworking'],site:['barracks',1]},
    cartography:{tech:['ledger'],site:['academy',1]},printing:{tech:['ledger'],site:['academy',1]},
    optics:{tech:['cartography'],site:['academy',1]},engineering:{tech:['siegecraft'],site:['forge',1]},
    steel:{tech:['ironworking','engineering'],site:['forge',1]},gunpowder:{tech:['siegecraft'],site:['forge',1]},
    electricity:{tech:['steel'],site:['foundry',1]},electronics:{tech:['electricity'],site:['academy',2]},
    network:{tech:['electronics'],site:['lab',1]},automation:{tech:['network'],site:['factory',2]},
    rocketry:{tech:['electronics','steel'],site:['lab',2]},fusion:{tech:['rocketry','network'],site:['lab',2]},
  };
  const durationByAge=[90,190,360,600,950,1500,2100];
  const paths=[
    ['Kronen-Exerzierhof','Schildordnung','Kronen-Phalanx','spear','stone','Verteidigt mit +22 % Stärke.',{defense:.22}],
    ['Sternenholz-Halle','Weißholzsehnen','Weißholz-Schildwacht','ranged','wood','+30 % Stärke in Wald, Taiga und Regenwald.',{woods:.30}],
    ['Eberzwinger der Asche','Eberkeil','Ascheneber-Reiter','mobile','food','+24 % Stärke beim Angriff.',{attack:.24}],
    ['Heckenpfad-Wacht','Dornenhinterhalt','Heckenpfad-Schleuderer','ranged','food','+24 % Schutz im Wald, Regenwald oder Moor.',{cover:.24}],
    ['Schwebender Nebelaltar','Schleierflug','Schleiergleiter','air','science','+20 % Stärke gegen Garnisonen mit Fernkampf.',{antiRanged:.20}],
    ['Lebender Wall','Wurzelpanzerung','Wurzelwall-Hüter','heavy','wood','+22 % Schutz in befestigten Provinzen.',{fortress:.22}],
    ['Sonnenwagen-Hof','Speicheninschrift','Sonnenspeer-Wagen','mobile','coin','+25 % Stärke in Wüste und Steppe.',{dry:.25}],
    ['Prismenlinsen-Halle','Lichtbrechung','Lichtbogen-Späher','mobile','influence','Erweitert die örtliche Sichtweite um einen Ring; +12 % Stärke im Angriff.',{scout:1,attack:.12}],
    ['Basalt-Wurfwerk','Glutmechanik','Glutballisten-Trupp','siege','metal','+28 % Angriff auf Provinzen mit Mauern.',{breach:.28}],
    ['Sternenwinkel-Station','Bogenentladung','Bogenblitz-Schützen','ranged','science','+20 % Stärke gegen schwere Verbände.',{antiHeavy:.20}],
    ['Matrix-Abwehrknoten','Adaptiver Schild','Schildnetz-Sentinel','heavy','coin','+28 % Stärke gegen Belagerungsgarnisonen.',{antiSiege:.28}],
    ['Geweihhalle','Pfad durch Wurzeln','Hirschpfad-Späher','mobile','food','Kein Mobilitätsmalus im Wald; +12 % Stärke dort.',{woodRider:.12}],
    ['Runenschmiede','Schlagrunen','Runenschildbrecher','heavy','stone','+27 % Stärke im Gebirge.',{highlands:.27}],
    ['Brutkammer','Schwarmtaktik','Schwarmkrieger','infantry','food','+25 % Stärke in Heeren ab 10 Einheiten.',{swarm:.25}],
  ];
  const factions=Object.fromEntries(peoples.map((folk,index)=>{
    const [building,research,unit,role,resource,ability,effect]=paths[index];
    const buildingKey=`sig-site-${folk.id}`;
    const researchKey=`sig-tech-${folk.id}`;
    const unitKey=`sig-unit-${folk.id}`;
    buildings.push({id:buildingKey,name:building,icon:folk.icon,age:1,max:2,cost:{wood:72,stone:38},req:['barracks',1],desc:`Exklusiv für ${folk.name}. +${({influence:1,science:2,coin:2,metal:2}[resource]||3)} ${resource==='science'?'Wissen':resource==='coin'?'Kronen':resource==='food'?'Nahrung':resource==='wood'?'Holz':resource==='stone'?'Stein':resource==='metal'?'Metall':'Einfluss'} je Stufe und Rohstoffrunde.`,faction:folk.id});
    buildingTime[buildingKey]=7;
    techs.push({id:researchKey,name:research,age:1,cost:36,desc:`Schaltet ${unit} frei. ${ability}`,faction:folk.id});
    technologyLinks[researchKey]={tech:['carpentry'],site:[buildingKey,1]};
    units.push({id:unitKey,name:unit,role,age:1,site:buildingKey,level:1,atk:21+(role==='siege'?4:0),def:20+(role==='heavy'?4:0),cost:{food:32,wood:12,metal:10},icon:folk.icon,ability,effect,faction:folk.id});
    unitTech[unitKey]=[researchKey];
    return [folk.id,{building:buildingKey,research:researchKey,unit:unitKey,resource}];
  }));
  const governments = {tribe:['Stammesrat','Ausgewogen.',0],republic:['Handelsrepublik','+2 Kronen je Stadt mit Ratshaus; −8 % Angriff.',1],kingdom:['Erbmonarchie','+12 % Angriff; −1 Krone je Stadt mit Ratshaus.',2],council:['Föderaler Rat','+2 Wissen je Stadt mit Ratshaus.',4]};
  const faiths = {none:['Kein Staatsglaube','Kein Effekt.'],sun:['Sonnenpfad','+12 % Angriff.'],grove:['Hainbund','+2 Nahrung je Stadt mit Ratshaus.'],stars:['Sternenbund','+2 Wissen je Stadt mit Ratshaus.']};
  const resources = {food:['Nahrung','❋'],wood:['Holz','♣'],stone:['Stein','◆'],metal:['Metall','◇'],coin:['Kronen','◉'],science:['Wissen','✧'],influence:['Einfluss','⚜']};
  const roles = {infantry:'Infanterie',ranged:'Fernkampf',spear:'Speertruppen',mobile:'Mobil',heavy:'Schwer',siege:'Belagerung',air:'Luft'};
  // Multipliers for each offensive role against the opposing unit's protection profile.
  const matchups = {
    infantry:{spear:1.22,siege:1.32,heavy:.78,air:.82},
    ranged:{infantry:1.16,spear:1.38,heavy:.72,air:1.12},
    spear:{mobile:1.58,heavy:1.18,ranged:.82,air:.78},
    mobile:{ranged:1.38,siege:1.48,spear:.68},
    heavy:{infantry:1.28,ranged:1.18,siege:.80},
    siege:{heavy:1.26,mobile:.70,air:.72},
    air:{siege:1.32,mobile:1.22,ranged:.82},
  };
  const counters = Object.fromEntries(Object.entries(matchups).map(([role,targets]) =>
    [role,Object.keys(targets).filter(target=>targets[target]>1)]));
  const continents = [
    {name:'Nordmark',col:10,row:8,wide:9,tall:7,seed:11},
    {name:'Frostheim',col:32,row:6,wide:9.4,tall:6.4,seed:22},
    {name:'Elyndra',col:50,row:10,wide:9,tall:7.2,seed:33},
    {name:'Sonnenlande',col:12,row:24,wide:9.8,tall:7.3,seed:44},
    {name:'Grünmeer',col:33,row:20,wide:8.1,tall:7.3,seed:55},
    {name:'Ostland',col:54,row:27,wide:9,tall:7.3,seed:66},
    {name:'Südmark',col:31,row:34,wide:11,tall:5.7,seed:77},
  ];
  const capitals = [
    [18,17,'Aurelholm',true],
    [59,35,'Silvenhain',true],
    [79,21,'Aschengrat',true],
    [57,42,'Dornfurt',true],
    [57,15,'Nebelwacht',true],
    [49,59,'Urwurzel',true],
    [26,40,'Sonnenpforte',true],
    [93,48,'Prismaar',true],
    [21,44,'Basaltkrone',true],
    [85,24,'Sternenhafen',true],
    [86,49,'Nullpunkt',true],
    [24,20,'Geisthain',true],
    [56,57,'Tiefentor',true],
    [52,18,'Schwarmhort',true],
  ];
  const names = ['Falkenau','Moosgrund','Steinkamm','Morgenwacht','Schattental','Eschenfurt','Weitmark','Rabenfels','Goldhain','Dunstmoor','Nebelstrand','Silberlauf','Hochweide','Grauengrat','Rotfeld','Dornbruch','Mondkamm','Sturmkliff','Wolfsgrund','Salzmark','Sternenrast','Bernsteintal','Fichtenwall','Flusswacht','Blaumoor','Staubsenke','Abendfeld','Erlenbruch','Windklippe','Kieselau','Glutwacht','Sichelwald','Torfbucht','Smaragdtrift','Weidenfurt'];
  const map=[];
  const radius=39;
  const step=Math.sqrt(3)*radius;
  const bounds={width:7550,height:4300};
  const hash=(value)=>{const calc=Math.sin(value*91.79+12.34)*43758.5453;return calc-Math.floor(calc);};
  const position=(col,row)=>[72+step*(col+.5*(row%2)),96+row*1.5*radius];
  const distance=(first,second)=>{
    const axial=(tile)=>tile[0]-(tile[1]-tile[1]%2)/2;
    const dx=axial(first)-axial(second);
    const dy=first[1]-second[1];
    return Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dx+dy));
  };
  const legacyLand=new Map();
  for(const continent of continents) for(let row=Math.floor(continent.row-continent.tall-2);row<=continent.row+continent.tall+2;row++){
    for(let col=Math.floor(continent.col-continent.wide-2);col<=continent.col+continent.wide+2;col++){
      const across=(col+.5*(row%2)-continent.col)/continent.wide;
      const down=(row-continent.row)/continent.tall;
      const angle=Math.atan2(down,across);
      if(Math.hypot(across,down)<(1+.13*Math.sin(angle*3+continent.seed)+.09*Math.cos(angle*5+continent.seed)+.06*Math.sin(angle*8))*.85) legacyLand.set(`${col}:${row}`,continent.name);
    }
  }
  const landmasses=continents.map((continent,index)=>{
    const offsetCol=Math.round(continent.col*.57)+5;
    const offsetRow=Math.round(continent.row*.57/2)*2+6;
    const [x,y]=position(continent.col+offsetCol,continent.row+offsetRow);
    return {...continent,index,offsetCol,offsetRow,x,y,rx:continent.wide*step*1.30,ry:continent.tall*1.5*radius*1.35};
  });
  function coastField(mass,x,y){
    const dx=(x-mass.x)/mass.rx;
    const dy=(y-mass.y)/mass.ry;
    if(Math.abs(dx)>1.45||Math.abs(dy)>1.45) return -150;
    const a=Math.atan2(dy,dx);
    const edge=1+.15*Math.sin(a*3+mass.seed)+.09*Math.cos(a*5+mass.seed)+.055*Math.sin(a*8)
      +.045*Math.sin(a*12+mass.seed*.4)+.026*Math.cos(a*19+mass.seed);
    return (edge-Math.hypot(dx,dy))*Math.min(mass.rx,mass.ry);
  }
  function geography(mass,x,y){
    const across=(x-mass.x)/mass.rx;
    const down=(y-mass.y)/mass.ry;
    const latitude=Math.abs(y/bounds.height-.49);
    const spine=.14*Math.sin(down*3.9+mass.seed)+.23*down+.10*Math.cos(down*7+mass.seed);
    const folded=Math.abs(across-spine);
    const continuity=.63+.37*Math.sin(down*4.2+mass.seed+across);
    const mountain=Math.exp(-folded*folded*17)*continuity*Math.max(.15,1-Math.abs(down)*.47);
    const dryBelt=Math.max(0,1-Math.abs(latitude-.205)/.17);
    const equatorialRain=Math.max(0,1-latitude/.19);
    const rainShadow=Math.max(0,across-spine)*.13;
    const moisture=.65+.19*equatorialRain-.20*dryBelt-rainShadow
      +.08*Math.sin(down*2.7+mass.seed)+.04*Math.cos(x/210+y/290)
      -(mass.name==='Sonnenlande'?.17:0);
    const biome=mountain>.57?'mountain':mountain>.425?'highland':latitude>.39?'tundra':
      moisture<.34&&latitude<.32?'desert':moisture<.47?'steppe':
      latitude>.29&&moisture>.54?'taiga':
      latitude<.12&&moisture>.63?'jungle':latitude<.18?'savanna':moisture>.55?'forest':'plain';
    return {biome,mountain,moisture,latitude};
  }
  function surfaceBiome(geo,coastal){
    if(!coastal||geo.mountain>=.40||geo.latitude>.38||geo.moisture<.43)return geo.biome;
    return geo.mountain<.26&&geo.moisture>.64?'marsh':'coast';
  }
  const directions=(col,row)=>[[col-1,row],[col+1,row],[col,row-1],[col,row+1],[col+(row%2?1:-1),row-1],[col+(row%2?1:-1),row+1]];
  const land=new Map();
  const transformedCapitals=capitals.map(([col,row,name,final])=>{
    if(final)return [col,row,name];
    const mass=landmasses.find(item=>item.name===legacyLand.get(`${col}:${row}`));
    return [col+mass.offsetCol,row+mass.offsetRow,name];
  });
  for(const mass of landmasses){
    const centreCol=mass.col+mass.offsetCol;
    const centreRow=mass.row+mass.offsetRow;
    for(let row=Math.floor(centreRow-mass.tall*1.85);row<=centreRow+mass.tall*1.85;row++){
      for(let col=Math.floor(centreCol-mass.wide*1.85);col<=centreCol+mass.wide*1.85;col++){
        const [x,y]=position(col,row);
        const oldKey=`${col-mass.offsetCol}:${row-mass.offsetRow}`;
        const legacy=legacyLand.get(oldKey)===mass.name;
        const field=coastField(mass,x,y);
        const cellKey=`${col}:${row}`;
        if(!legacy&&field<12)continue;
        if(!land.has(cellKey)||legacy||!land.get(cellKey).legacy&&field>land.get(cellKey).field){
          land.set(cellKey,{id:legacy?oldKey:`g:${cellKey}`,col,row,x,y,mass,legacy,field});
        }
      }
    }
  }
  const grid={};
  for(const [cell,{id,col,row,x,y,mass}] of land){
    const capIndex=transformedCapitals.findIndex(([left,top])=>left===col&&top===row);
    const nearby=transformedCapitals.findIndex(capital=>distance([col,row],capital)===1);
    const owner=capIndex>=0?peoples[capIndex].id:nearby>=0?peoples[nearby].id:null;
    const coastal=directions(col,row).some(([left,top])=>!land.has(`${left}:${top}`));
    const local=geography(mass,x,y);
    const biome=capIndex>=0&&local.biome==='mountain'?'highland':surfaceBiome(local,coastal);
    const seed=/^g:/.test(id)?5000+row*107+col:Number(id.split(':')[1])*67+Number(id.split(':')[0])+100;
    const name=capIndex>=0?transformedCapitals[capIndex][2]:`${names[seed%names.length]} · ${mass.name} ${String.fromCharCode(65+(row%26))}${col+1}`;
    const tile={id,col,row,x,y,seed,name,owner,capital:capIndex>=0,biome,coastal,continent:mass.name,barbarian:!owner&&hash(seed+69)>.67};
    grid[cell]=tile;
    map.push(tile);
  }
  const lookup=Object.fromEntries(map.map(tile=>[tile.id,tile]));
  const neighbors=Object.fromEntries(map.map(tile=>[tile.id,directions(tile.col,tile.row).map(([col,row])=>grid[`${col}:${row}`]?.id).filter(Boolean)]));
  const crossings=[];
  const passages=[[0,1],[0,3],[1,2],[1,4],[2,5],[3,4],[3,6],[4,5],[4,6],[5,6]];
  for(const [first,second] of passages){
    const coasts=(index)=>map.filter(tile=>tile.continent===continents[index].name&&tile.coastal);
    let best=null;
    for(const from of coasts(first)) for(const to of coasts(second)){
      const span=(from.x-to.x)**2+(from.y-to.y)**2;
      if(!best||span<best.span) best={from:from.id,to:to.id,span};
    }
    crossings.push([best.from,best.to]);
    if(!neighbors[best.from].includes(best.to)) neighbors[best.from].push(best.to);
    if(!neighbors[best.to].includes(best.from)) neighbors[best.to].push(best.from);
  }
  const landmarks=landmasses.map(mass=>[mass.name.toUpperCase(),mass.x,mass.y-mass.ry-38]);
  const output={peoples,powers,ages,eraCost,milestones,terrain,buildings,buildingTech,buildingTime,units,unitTech,techs,technologyLinks,durationByAge,factions,governments,faiths,resources,roles,matchups,counters,map,neighbors,lookup,grid,crossings,radius,step,hash,bounds,landmarks,landmasses,coastField,geography,surfaceBiome};
  if (typeof module !== 'undefined') module.exports = output;
  else globalThis.World = output;
})();

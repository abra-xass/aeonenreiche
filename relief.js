(() => {
  const {radius,hash,bounds,landmasses,coastField,geography,surfaceBiome,terrain}=World;
  const {width,height}=bounds;
  const mix=(first,second,value)=>first+(second-first)*value;
  const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,value));
  const smooth=(value)=>{const ratio=clamp(value);return ratio*ratio*(3-2*ratio);};
  const lattice=new Float32Array(65536);
  for (let index=0;index<lattice.length;index++) lattice[index]=hash(index);
  const noise=(x,y,scale,seed=0)=>{
    const cellX=Math.floor(x/scale);
    const cellY=Math.floor(y/scale);
    const across=smooth(x/scale-cellX);
    const down=smooth(y/scale-cellY);
    const index=cellX+cellY*157+seed*2987;
    return mix(mix(lattice[index&65535],lattice[(index+1)&65535],across),mix(lattice[(index+157)&65535],lattice[(index+158)&65535],across),down);
  };
  const warp=(x,y)=>[x+(noise(x,y,73,1)-.5)*36+(noise(x,y,25,2)-.5)*13,y+(noise(x,y,79,3)-.5)*44+(noise(x,y,27,4)-.5)*13];
  const position=(tile)=>warp(tile.x,tile.y);
  function border(tile) {
    const vertices=Array.from({length:6},(_,index)=>{
      const angle=(index*60-90)*Math.PI/180;
      return [tile.x+Math.cos(angle)*radius,tile.y+Math.sin(angle)*radius];
    });
    return vertices.flatMap(([x,y],index)=>{
      const [nextX,nextY]=vertices[(index+1)%6];
      return [0,.2,.4,.6,.8].map(ratio=>warp(mix(x,nextX,ratio),mix(y,nextY,ratio)).map(value=>value.toFixed(1)).join(','));
    }).join(' ');
  }

  const palette=Object.fromEntries(Object.entries(terrain).map(([key,[,hex]])=>
    [key,[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16))]));
  // The generated atlas is followed by savanna, steppe and foothills.
  const material={plain:0,forest:1,mountain:2,desert:3,marsh:4,coast:5,tundra:6,taiga:7,jungle:8,savanna:9,steppe:10,highland:11};
  const stride=8;
  const cols=Math.ceil(width/stride)+2;
  const rows=Math.ceil(height/stride)+2;
  const fieldsStride=5;
  function fields(){
    const result=new Float32Array(cols*rows*fieldsStride);
    const biomes=new Uint8Array(cols*rows);
    for(let row=0;row<rows;row++){
      const y=row*stride;
      const nearby=landmasses.filter(mass=>Math.abs(y-mass.y)<mass.ry*1.46);
      for(let col=0;col<cols;col++){
        const x=col*stride;
        const ux=x+(noise(x,y,112,7)-.5)*24+(noise(x,y,34,1)-.5)*12;
        const uy=y+(noise(x,y,126,5)-.5)*24+(noise(x,y,32,6)-.5)*12;
        let land=-150;
        let continent=null;
        for(const mass of nearby){
          const field=coastField(mass,ux,uy);
          if(field>land){land=field;continent=mass;}
        }
        const offset=(row*cols+col)*fieldsStride;
        result[offset]=land;
        if(!continent||land<-12)continue;
        const geo=geography(continent,ux,uy);
        const biome=surfaceBiome(geo,land<radius*.85);
        biomes[row*cols+col]=material[biome];
        const colors=palette[biome];
        for(let index=0;index<3;index++)result[offset+1+index]=colors[index];
        result[offset+4]=geo.mountain;
      }
    }
    return {result,biomes};
  }
  function drainage(sample){
    const cell=26;
    const across=Math.ceil(width/cell);
    const down=Math.ceil(height/cell);
    const stepCount=across*down;
    const altitude=new Float32Array(stepCount);
    const shore=new Float32Array(stepCount);
    const distance=new Float32Array(stepCount).fill(Infinity);
    const next=new Int32Array(stepCount).fill(-1);
    const queue=[];
    const point=(index)=>[(index%across+.5)*cell,(Math.floor(index/across)+.5)*cell];
    const links=(index)=>{
      const col=index%across,row=Math.floor(index/across);
      return [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]].flatMap(([dx,dy])=>col+dx>=0&&col+dx<across&&row+dy>=0&&row+dy<down?[index+dx+dy*across]:[]);
    };
    const push=(pair)=>{
      let cursor=queue.length;queue.push(pair);
      while(cursor>0){const parent=(cursor-1)>>1;if(queue[parent][0]<=pair[0])break;queue[cursor]=queue[parent];cursor=parent;}
      queue[cursor]=pair;
    };
    const pop=()=>{
      const nearest=queue[0];
      const tail=queue.pop();
      if(queue.length){
        let parent=0;
        while(parent*2+1<queue.length){
          let child=parent*2+1;
          if(child+1<queue.length&&queue[child+1][0]<queue[child][0])child++;
          if(queue[child][0]>=tail[0])break;
          queue[parent]=queue[child];parent=child;
        }
        queue[parent]=tail;
      }
      return nearest;
    };
    for(let index=0;index<stepCount;index++){
      const [x,y]=point(index);
      if(x>=width||y>=height){shore[index]=-100;continue;}
      shore[index]=sample(x,y,0);
      altitude[index]=Math.max(0,Math.min(1,shore[index]/70))*(sample(x,y,4)*125+noise(x,y,150,41)*26+noise(x,y,62,42)*12);
    }
    for(let index=0;index<stepCount;index++)if(shore[index]>0){
      const outlet=links(index).find(other=>shore[other]<=0);
      if(outlet!==undefined){distance[index]=0;next[index]=outlet;push([0,index]);}
    }
    while(queue.length){
      const [current,index]=pop();
      if(current>distance[index]+.001)continue;
      for(const upstream of links(index)){
        if(shore[upstream]<=0)continue;
        const cost=current+1+Math.max(0,altitude[index]-altitude[upstream])*.19+altitude[index]*.009;
        if(cost+.001>=distance[upstream])continue;
        distance[upstream]=cost;next[upstream]=index;push([cost,upstream]);
      }
    }
    const courses=[];
    const footprint=new Set();
    for(const mass of landmasses){
      for(const rowOffset of [-.44,-.06,.33,.60]){
        const candidates=[];
        for(let index=0;index<stepCount;index++){
          const [x,y]=point(index);
          if(shore[index]>68&&Math.abs(x-mass.x)<mass.rx*.52&&Math.abs(y-mass.y-mass.ry*rowOffset)<mass.ry*.13&&altitude[index]>33&&Number.isFinite(distance[index])){
            candidates.push([distance[index]+altitude[index]*.075,index]);
          }
        }
        candidates.sort((first,second)=>second[0]-first[0]);
        const start=candidates.find(([,index])=>!footprint.has(index));
        if(!start)continue;
        const chain=[];
        for(let index=start[1];index>=0&&chain.length<130;index=next[index]){
          chain.push(index);
          if(footprint.has(index)||shore[index]<=0)break;
        }
        if(chain.length<7)continue;
        const coords=chain.map(point);
        let path=`M${coords[0].join(' ')}`;
        for(let index=1;index<coords.length-1;index++){
          const [x,y]=coords[index], [endX,endY]=coords[index+1];
          path+=`Q${x} ${y} ${(x+endX)/2} ${(y+endY)/2}`;
        }
        path+=`L${coords.at(-1).join(' ')}`;
        for(const index of chain)footprint.add(index);
        courses.push(path);
      }
    }
    return courses;
  }
  function paint(textureImage) {
    const pixelScale=.72;
    const width=Math.round(bounds.width*pixelScale);
    const height=Math.round(bounds.height*pixelScale);
    const canvas=document.createElement('canvas');
    canvas.width=width;
    canvas.height=height;
    const mask=canvas.cloneNode();
    const context=canvas.getContext('2d');
    const maskContext=mask.getContext('2d');
    const pixels=context.createImageData(width,height);
    const alpha=maskContext.createImageData(width,height);
    const {result:coarse,biomes}=fields();
    let textures;
    const tileSize=256;
    if(textureImage){
      const sheet=canvas.cloneNode();
      sheet.width=tileSize*3;
      sheet.height=tileSize*4;
      const surface=sheet.getContext('2d',{willReadFrequently:true});
      surface.drawImage(textureImage,0,0,sheet.width,tileSize*3);
      for(const [col,sourceCol,sourceRow,blend] of [[0,0,1,.38],[1,0,1,.63],[2,2,0,.68]]){
        surface.globalAlpha=1;
        surface.drawImage(sheet,0,0,tileSize,tileSize,col*tileSize,3*tileSize,tileSize,tileSize);
        surface.globalAlpha=blend;
        surface.drawImage(sheet,sourceCol*tileSize,sourceRow*tileSize,tileSize,tileSize,col*tileSize,3*tileSize,tileSize,tileSize);
      }
      // Keep tundra rocky. Snow is applied separately only above the mountain snowline.
      surface.globalAlpha=1;
      surface.drawImage(textureImage,textureImage.naturalWidth*2/3,textureImage.naturalHeight/3,
        textureImage.naturalWidth/3,textureImage.naturalHeight/3,0,tileSize*2,tileSize,tileSize);
      textures=surface.getImageData(0,0,sheet.width,sheet.height).data;
    }
    const mirror=(value)=>{
      const at=value&(tileSize*2-1);
      return at<tileSize?at:tileSize*2-1-at;
    };
    const atlasOffsets=Object.values(material).map(index=>((index%3)*tileSize+Math.floor(index/3)*tileSize*tileSize*3)*4);
    const elevation=new Float32Array(width*height);
    const shore=new Float32Array(width*height);
    const interpolate=(x,y,channel)=>{
      const col=Math.floor(x/stride);
      const row=Math.floor(y/stride);
      const index=(row*cols+col)*fieldsStride+channel;
      return mix(mix(coarse[index],coarse[index+fieldsStride],x%stride/stride),mix(coarse[index+cols*fieldsStride],coarse[index+cols*fieldsStride+fieldsStride],x%stride/stride),y%stride/stride);
    };
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      const index=y*width+x;
      const wx=x/pixelScale;
      const wy=y/pixelScale;
      const land=interpolate(wx,wy,0)+(noise(wx,wy,19,12)-.5)*8;
      shore[index]=land;
      if(land<=0) continue;
      const ridge=1-Math.abs(noise(wx+wy*.22,wy,74,13)*2-1);
      const folds=1-Math.abs(noise(wx+wy*.64,wy,28,14)*2-1);
      const ridges=(ridge**2.5)*(.69+.31*folds);
      const mountain=interpolate(wx,wy,4);
      const hills=(9+12*mountain)*noise(wx,wy,154,15)+(3+13*mountain)*noise(wx,wy,51,16);
      elevation[index]=smooth(land/55)*(3+hills+mountain**1.55*(65+122*ridges));
    }
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      const index=y*width+x;
      const offset=index*4;
      const land=shore[index];
      const grain=(lattice[index&65535]-.5)*7;
      if(land<=0){
        const shelf=smooth((land+88)/88);
        const deep=noise(x,y,142,19)*12+noise(x,y,30,20)*3+grain*.31;
        const ripple=Math.sin(y*.35+noise(x,y,76,21)*13)*1.45*shelf;
        pixels.data.set([10+shelf*37+deep,30+shelf*66+deep+ripple,49+shelf*62+deep+ripple,255],offset);
        continue;
      }
      const z=elevation[index];
      const left=elevation[y*width+Math.max(0,x-2)];
      const up=elevation[Math.max(0,y-2)*width+x];
      const wx=x/pixelScale;
      const wy=y/pixelScale;
      const light=clamp((z-left)*.28+(z-up)*.44,-.67,.69);
      const brightness=1+light*.43;
      const mountain=interpolate(wx,wy,4);
      const snowline=124-Math.abs(wy/bounds.height-.49)*83;
      const snow=smooth((mountain-.57)/.16)*smooth((z-snowline)/28);
      const rock=smooth((z-66)/53)*(1-snow);
      const sand=(1-smooth(land/5))*.75;
      const base=[interpolate(wx,wy,1),interpolate(wx,wy,2),interpolate(wx,wy,3)];
      let topLeft,topRight,bottomLeft,bottomRight,txBlend,tyBlend;
      if(textures){
        const tx=mirror(Math.round(wx*2.10+wy*.52));
        const ty=mirror(Math.round(wy*2.04-wx*.43));
        const sample=(ty*tileSize*3+tx)*4;
        const corner=Math.floor(wy/stride)*cols+Math.floor(wx/stride);
        topLeft=sample+atlasOffsets[biomes[corner]];
        topRight=sample+atlasOffsets[biomes[corner+1]];
        bottomLeft=sample+atlasOffsets[biomes[corner+cols]];
        bottomRight=sample+atlasOffsets[biomes[corner+cols+1]];
        txBlend=smooth(wx%stride/stride);
        tyBlend=smooth(wy%stride/stride);
      }
      for(let channel=0;channel<3;channel++){
        let ground=base[channel];
        if(textures){
          const materialColor=topLeft===topRight&&topLeft===bottomLeft&&topLeft===bottomRight?textures[topLeft+channel]
            :mix(mix(textures[topLeft+channel],textures[topRight+channel],txBlend),mix(textures[bottomLeft+channel],textures[bottomRight+channel],txBlend),tyBlend);
          ground=mix(ground,materialColor,.94)+(base[channel]-128)*.16;
        }
        const surface=mix(mix(ground,[132,133,136][channel],rock*.22),[241,244,245][channel],snow*.93);
        pixels.data[offset+channel]=mix(surface,[190,172,122][channel],sand)*brightness+grain;
      }
      pixels.data[offset+3]=255;
      alpha.data[offset+3]=Math.round(smooth(land/1.5)*255);
    }
    context.putImageData(pixels,0,0);
    maskContext.putImageData(alpha,0,0);
    const riverLayer=canvas.cloneNode();
    const rivers=riverLayer.getContext('2d');
    rivers.lineCap='round';
    rivers.scale(pixelScale,pixelScale);
    for (const course of drainage(interpolate)) {
      const line=new Path2D(course);
      rivers.strokeStyle='#314c40';rivers.lineWidth=7;rivers.stroke(line);
      rivers.strokeStyle='#79a9a2';rivers.lineWidth=3;rivers.stroke(line);
    }
    rivers.globalCompositeOperation='destination-in';
    rivers.resetTransform();
    rivers.drawImage(mask,0,0);
    context.drawImage(riverLayer,0,0);
    return {image:canvas.toDataURL('image/jpeg',.99),mask:mask.toDataURL()};
  }
  async function loadImage(path){
    const image=new Image();
    image.src=path;
    try{await image.decode();return image;}catch{return null;}
  }
  const loadTextures=()=>loadImage('assets/terrain.webp');
  async function loadTownArt(){
    const layouts=[['settlements',4,2],['cultures',4,4]];
    return Object.fromEntries(await Promise.all(layouts.map(async ([file,columns,rows])=>{
      const image=await loadImage(`assets/${file}.webp`);
      if(!image)return [file,[]];
      const size=144, canvas=document.createElement('canvas');
      canvas.width=canvas.height=size;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const w=image.width/columns,h=image.height/rows;
      const cutouts=Array.from({length:columns*rows},(_,cell)=>{
        ctx.clearRect(0,0,size,size);
        ctx.drawImage(image,cell%columns*w+.8,Math.floor(cell/columns)*h+.8,w-1.6,h-1.6,0,0,size,size);
        const pixels=ctx.getImageData(0,0,size,size);
        const seen=new Uint8Array(size*size);
        const queue=[];
        const visit=index=>{
          if(seen[index])return;
          seen[index]=1;
          const i=index*4;
          const red=pixels.data[i], green=pixels.data[i+1], blue=pixels.data[i+2];
          if(red<54&&green<72&&blue<76&&green>=red-3&&blue>=red-5){
            pixels.data[i+3]=0;
            queue.push(index);
          }
        };
        for(let i=0;i<size;i++){
          visit(i);visit((size-1)*size+i);visit(i*size);visit(i*size+size-1);
        }
        for(let head=0;head<queue.length;head++){
          const index=queue[head], x=index%size;
          if(x)visit(index-1);
          if(x<size-1)visit(index+1);
          if(index>=size)visit(index-size);
          if(index+size<size*size)visit(index+size);
        }
        ctx.putImageData(pixels,0,0);
        return canvas.toDataURL('image/png');
      });
      return [file,cutouts];
    })));
  }
  globalThis.Relief={width,height,position,border,paint,loadTextures,loadTownArt};
})();

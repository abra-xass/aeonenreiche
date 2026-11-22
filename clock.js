(() => {
  const tickMs=2000;
  function createClock(now,start=now){
    let last=now;
    let elapsed=0;
    let speed=0;
    const collect=(at)=>{
      elapsed+=Math.max(0,at-Math.max(last,start))*speed;
      last=Math.max(last,at);
    };
    return {
      speed(value,at){collect(at);speed=value;},
      take(at,limit=12){
        collect(at);
        const ready=Math.min(limit,Math.floor(elapsed/tickMs));
        elapsed-=ready*tickMs;
        return ready;
      },
      fraction(at=last){return Math.min(1,(elapsed+Math.max(0,at-Math.max(last,start))*speed)/tickMs);},
    };
  }
  const api={createClock,tickMs};
  if(typeof module!=='undefined') module.exports=api;
  else globalThis.GameClock=api;
})();

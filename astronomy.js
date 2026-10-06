(()=>{
'use strict';

const DEG=Math.PI/180;
const TAU=Math.PI*2;
const TWILIGHT_EPSILON=0.045;
const MAX_NIGHT_ALPHA=0.57;

let canvas,ctx,galaxy,galaxyCtx,lightCanvas,lightCtx;
let raf=0,w=0,h=0,dpr=1,started=false;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const smoothstep=t=>t*t*(3-2*t);

function vecFromLonLat(lon,lat){
  const p=lat*DEG,l=lon*DEG,c=Math.cos(p);
  return[c*Math.cos(l),c*Math.sin(l),Math.sin(p)];
}

function cameraBasis(){
  const c=map.getCenter(),p=c.lat*DEG,l=c.lng*DEG;
  const cp=Math.cos(p),sp=Math.sin(p),cl=Math.cos(l),sl=Math.sin(l);
  return{
    forward:[cp*cl,cp*sl,sp],
    east:[-sl,cl,0],
    north:[-sp*cl,-sp*sl,cp]
  };
}

function astronomyEnabled(){
  try{return dayNightEnabled!==false}catch(e){return true}
}

function addStyle(){
  const s=document.createElement('style');
  s.textContent='#sunVisual{display:none!important}#astronomyScene{position:fixed;inset:0;z-index:10;pointer-events:none;width:100%;height:100%;contain:strict}';
  document.head.appendChild(s);
}

function ensureCanvas(){
  if(canvas)return;
  canvas=document.createElement('canvas');
  canvas.id='astronomyScene';
  canvas.setAttribute('aria-hidden','true');
  document.body.appendChild(canvas);
  ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});

  galaxy=document.createElement('canvas');
  galaxyCtx=galaxy.getContext('2d',{alpha:true});

  lightCanvas=document.createElement('canvas');
  lightCtx=lightCanvas.getContext('2d',{alpha:true});
  resize();
}

function seeded(seed){
  let a=seed>>>0;
  return()=>{
    a|=0;a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return((t^t>>>14)>>>0)/4294967296;
  };
}

function buildGalaxy(){
  if(!galaxyCtx)return;
  galaxy.width=Math.max(1,Math.round(w*dpr));
  galaxy.height=Math.max(1,Math.round(h*dpr));
  const g=galaxyCtx;
  g.setTransform(dpr,0,0,dpr,0,0);
  g.clearRect(0,0,w,h);

  const veils=[
    [.18,.22,.95,'rgba(120,92,255,.10)'],
    [.82,.38,.72,'rgba(80,157,255,.07)'],
    [.50,.78,.86,'rgba(197,101,255,.055)']
  ];
  for(const [x,y,r,col] of veils){
    const gr=g.createRadialGradient(w*x,h*y,0,w*x,h*y,Math.max(w,h)*r);
    gr.addColorStop(0,col);
    gr.addColorStop(.55,'rgba(80,100,220,.018)');
    gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gr;
    g.fillRect(0,0,w,h);
  }

  const rnd=seeded(0x574f524c);
  const count=clamp(Math.round(w*h/2200),90,230);
  for(let i=0;i<count;i++){
    const x=rnd()*w,y=rnd()*h;
    const r=rnd()<.08?.8+rnd()*1.15:.25+rnd()*.65;
    const a=.16+rnd()*.54;
    g.beginPath();
    g.arc(x,y,r,0,TAU);
    g.fillStyle=`rgba(${210+Math.floor(rnd()*45)},${220+Math.floor(rnd()*35)},255,${a})`;
    g.fill();
  }

  for(let i=0;i<12;i++){
    const x=rnd()*w,y=rnd()*h,r=1+rnd()*1.25;
    const gr=g.createRadialGradient(x,y,0,x,y,r*4);
    gr.addColorStop(0,'rgba(255,255,255,.75)');
    gr.addColorStop(.18,'rgba(190,205,255,.36)');
    gr.addColorStop(1,'rgba(120,100,255,0)');
    g.fillStyle=gr;
    g.fillRect(x-r*4,y-r*4,r*8,r*8);
  }
}

function resize(){
  ensureCanvas();
  const r=map.getContainer().getBoundingClientRect();
  w=Math.max(1,r.width);
  h=Math.max(1,r.height);
  dpr=Math.min(window.devicePixelRatio||1,1.5);
  const pw=Math.round(w*dpr),ph=Math.round(h*dpr);
  if(canvas.width!==pw||canvas.height!==ph){
    canvas.width=pw;
    canvas.height=ph;
    canvas.style.width=w+'px';
    canvas.style.height=h+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    buildGalaxy();
  }
  schedule();
}

function destinationPoint(lon,lat,bearingDeg,distanceDeg=89.5){
  const p1=lat*DEG,l1=lon*DEG,b=bearingDeg*DEG,d=distanceDeg*DEG;
  const sp1=Math.sin(p1),cp1=Math.cos(p1),sd=Math.sin(d),cd=Math.cos(d);
  const p2=Math.asin(sp1*cd+cp1*sd*Math.cos(b));
  const l2=l1+Math.atan2(Math.sin(b)*sd*cp1,cd-sp1*Math.sin(p2));
  let lo=l2/DEG;
  while(lo>180)lo-=360;
  while(lo<-180)lo+=360;
  return[lo,p2/DEG];
}

function earthGeometry(){
  const center=map.getCenter();
  const pc=map.project([center.lng,center.lat]);
  const cx=pc.x,cy=pc.y;
  const radii=[];

  try{
    for(let bearing=0;bearing<360;bearing+=45){
      const ll=destinationPoint(center.lng,center.lat,bearing);
      const p=map.project(ll);
      const rr=Math.hypot(p.x-cx,p.y-cy);
      if(Number.isFinite(rr)&&rr>18&&rr<Math.max(w,h)*3)radii.push(rr);
    }
  }catch(e){}

  let radius=0;
  if(radii.length>=3){
    radii.sort((a,b)=>a-b);
    radius=radii[Math.floor(radii.length/2)];
  }
  if(!Number.isFinite(radius)||radius<18){
    radius=Math.min(w,h)*.335*Math.pow(2,map.getZoom()-1.65);
  }
  return{cx,cy,r:clamp(radius,24,Math.max(w,h)*4)};
}

function sunState(){
  const solar=solarSubpoint(new Date());
  const sunVec=vecFromLonLat(solar.lon,solar.lat);
  const basis=cameraBasis();
  const g=earthGeometry();

  const lx=dot(sunVec,basis.east);
  const ly=dot(sunVec,basis.north);
  const lz=dot(sunVec,basis.forward);

  const orbit=g.r*1.72;
  const x=g.cx+lx*orbit;
  const y=g.cy-ly*orbit;
  const sunR=clamp(g.r*.19,21,48);

  return{...g,x,y,depth:lz,lx,ly,lz,sunR,solar};
}

function drawSun(x,y,r){
  ctx.save();
  const halo=ctx.createRadialGradient(x,y,r*.5,x,y,r*2.75);
  halo.addColorStop(0,'rgba(255,220,104,.26)');
  halo.addColorStop(.38,'rgba(255,175,54,.12)');
  halo.addColorStop(1,'rgba(255,128,32,0)');
  ctx.fillStyle=halo;
  ctx.beginPath();
  ctx.arc(x,y,r*2.75,0,TAU);
  ctx.fill();

  const core=ctx.createRadialGradient(x-r*.28,y-r*.30,r*.05,x,y,r);
  core.addColorStop(0,'#fffef1');
  core.addColorStop(.18,'#fff6b0');
  core.addColorStop(.58,'#ffd65b');
  core.addColorStop(.84,'#f6aa2f');
  core.addColorStop(1,'#df7919');
  ctx.fillStyle=core;
  ctx.beginPath();
  ctx.arc(x,y,r,0,TAU);
  ctx.fill();
  ctx.strokeStyle='rgba(255,238,168,.76)';
  ctx.lineWidth=Math.max(1,r*.025);
  ctx.stroke();
  ctx.restore();
}

function eraseEarth(g){
  ctx.save();
  ctx.globalCompositeOperation='destination-out';
  ctx.beginPath();
  ctx.arc(g.cx,g.cy,g.r*1.012,0,TAU);
  ctx.fill();
  ctx.restore();
}

function buildEarthLighting(state){
  const size=clamp(Math.round(state.r*.72),128,224);
  if(lightCanvas.width!==size||lightCanvas.height!==size){
    lightCanvas.width=size;
    lightCanvas.height=size;
  }

  const image=lightCtx.createImageData(size,size);
  const data=image.data;
  const half=size/2;
  const eps=TWILIGHT_EPSILON;

  for(let py=0;py<size;py++){
    const sy=(half-(py+.5))/half;
    for(let px=0;px<size;px++){
      const sx=((px+.5)-half)/half;
      const rr=sx*sx+sy*sy;
      if(rr>1)continue;

      const sz=Math.sqrt(Math.max(0,1-rr));
      const ndl=sx*state.lx+sy*state.ly+sz*state.lz;

      let alpha=0;
      if(ndl<=-eps){
        const depth=clamp((-ndl-eps)/(1-eps),0,1);
        alpha=.49+.08*depth;
      }else if(ndl<eps){
        const t=clamp((eps-ndl)/(2*eps),0,1);
        alpha=MAX_NIGHT_ALPHA*smoothstep(t);
      }

      if(alpha<=0)continue;
      const i=(py*size+px)*4;
      data[i]=2;
      data[i+1]=8;
      data[i+2]=20;
      data[i+3]=Math.round(clamp(alpha,0,MAX_NIGHT_ALPHA)*255);
    }
  }

  lightCtx.putImageData(image,0,0);
}

function drawEarthLighting(state){
  buildEarthLighting(state);
  ctx.save();
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(lightCanvas,state.cx-state.r,state.cy-state.r,state.r*2,state.r*2);
  ctx.restore();
}

function hideLegacyLighting(){
  try{
    for(const id of ['twilight-18-fill','twilight-12-fill','twilight-6-fill','night-side-fill']){
      if(map.getLayer(id))map.setPaintProperty(id,'fill-opacity',0);
    }
    if(map.getLayer('terminator-line'))map.setPaintProperty('terminator-line','line-opacity',0);
  }catch(e){}
}

function render(){
  raf=0;
  if(!canvas||!ctx)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);

  /* Galaxy is permanent and remains visible even with realtime astronomy off. */
  if(galaxy)ctx.drawImage(galaxy,0,0,galaxy.width,galaxy.height,0,0,w,h);

  const state=sunState();
  const enabled=astronomyEnabled();

  /* Far-side Sun first; erasing the Earth disc gives natural eclipse occlusion. */
  if(enabled&&state.depth<0)drawSun(state.x,state.y,state.sunR);

  /* Keep the map globe clear of the Galaxy overlay in both toggle states. */
  eraseEarth(state);

  if(!enabled)return;

  /* Single source of truth: the same solar vector drives Sun position and Earth light. */
  drawEarthLighting(state);

  if(state.depth>=0)drawSun(state.x,state.y,state.sunR);
}

function schedule(){
  if(!raf)raf=requestAnimationFrame(render);
}

function tuneMap(){
  try{
    map.setFog({
      color:'rgb(1,4,9)',
      'high-color':'rgb(8,13,25)',
      'horizon-blend':.04,
      'space-color':'rgb(0,1,6)',
      'star-intensity':0
    });
  }catch(e){}
  hideLegacyLighting();
}

function accelerateRealtime(){
  try{
    clearInterval(solarTimer);
    solarTimer=setInterval(()=>{
      if(astronomyEnabled()){
        try{syncDayNight()}catch(e){}
        hideLegacyLighting();
      }
      if(current)updateNowPlayingMarker(current);
      schedule();
    },15000);
  }catch(e){
    setInterval(schedule,15000);
  }
}

function start(){
  if(started)return;
  started=true;
  addStyle();
  ensureCanvas();

  try{
    map.off('move',updateSunVisual);
    map.off('resize',updateSunVisual);
    updateSunVisual=schedule;
  }catch(e){}

  map.on('move',schedule);
  map.on('zoom',schedule);
  map.on('resize',resize);
  map.on('moveend',()=>{hideLegacyLighting();schedule()});

  const ready=()=>{
    resize();
    tuneMap();
    accelerateRealtime();
    try{syncDayNight()}catch(e){}
    hideLegacyLighting();
    schedule();
  };

  if(map.loaded())ready();
  else map.once('load',ready);

  window.addEventListener('orientationchange',()=>setTimeout(resize,120),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
  setInterval(schedule,5000);
}

try{start()}catch(e){console.warn('Worldio astronomy final fallback',e)}
})();
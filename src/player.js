import{registerClick}from'./radio.js';
const audio=document.querySelector('#audio');
let current=null,state='idle',timeoutId=null;
const listeners=new Set();
const emit=extra=>listeners.forEach(fn=>fn({station:current,state,...extra}));
export const onPlayerState=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
function setState(next,extra){state=next;emit(extra)}
export function getCurrent(){return current}
export async function playStation(station){current=station;clearTimeout(timeoutId);setState('connecting');audio.src=station.url_resolved||station.url;audio.volume=+document.querySelector('#volume')?.value||.85;timeoutId=setTimeout(()=>{if(state==='connecting'||state==='buffering'){audio.pause();setState('error',{message:'接続がタイムアウトしました'})}},6500);try{await audio.play();registerClick(station.stationuuid)}catch(e){clearTimeout(timeoutId);setState('error',{message:'この局は再生できません'});throw e}}
export async function toggle(){if(!current)throw Error('NO_STATION');if(audio.paused)return audio.play();audio.pause()}
export function setVolume(v){audio.volume=+v}
audio.addEventListener('waiting',()=>setState('buffering'));audio.addEventListener('stalled',()=>setState('buffering'));audio.addEventListener('playing',()=>{clearTimeout(timeoutId);setState('playing')});audio.addEventListener('pause',()=>{if(state!=='error')setState('paused')});audio.addEventListener('error',()=>{clearTimeout(timeoutId);setState('error',{message:'ストリーム接続に失敗しました'})});
if('mediaSession'in navigator){onPlayerState(({station,state})=>{if(!station||state!=='playing')return;navigator.mediaSession.metadata=new MediaMetadata({title:station.name||'Worldio Radio',artist:[station.city,station.country].filter(Boolean).join(' · '),album:'Worldio'});});try{navigator.mediaSession.setActionHandler('play',()=>audio.play());navigator.mediaSession.setActionHandler('pause',()=>audio.pause())}catch{}}

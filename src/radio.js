import{RADIO_MIRRORS,FAST_STATION_LIMIT,FULL_STATION_LIMIT}from'./config.js';
let mirrorIndex=0;
async function request(path,timeout=5500){let last;for(let i=0;i<RADIO_MIRRORS.length;i++){const base=RADIO_MIRRORS[(mirrorIndex+i)%RADIO_MIRRORS.length];try{const c=new AbortController();const t=setTimeout(()=>c.abort(),timeout);const r=await fetch(base+path,{signal:c.signal,headers:{Accept:'application/json'}});clearTimeout(t);if(!r.ok)throw Error(String(r.status));mirrorIndex=(mirrorIndex+i)%RADIO_MIRRORS.length;return await r.json()}catch(e){last=e}}throw last||Error('Radio API unavailable')}
const valid=s=>s&&s.stationuuid&&s.url_resolved&&Number.isFinite(+s.geo_lat)&&Number.isFinite(+s.geo_long)&&Math.abs(+s.geo_lat)<=90&&Math.abs(+s.geo_long)<=180;
const clean=list=>list.filter(valid);
export async function loadFastStations(){return clean(await request(`/json/stations/search?hidebroken=true&has_geo_info=true&order=clickcount&reverse=true&limit=${FAST_STATION_LIMIT}`))}
export async function loadMoreStations(){return clean(await request(`/json/stations/search?hidebroken=true&has_geo_info=true&order=clickcount&reverse=true&limit=${FULL_STATION_LIMIT}`,7000))}
export async function searchStations(q){const query=q.trim();if(!query)return[];const [name,country,tag]=await Promise.allSettled([
request('/json/stations/search?hidebroken=true&limit=60&order=clickcount&reverse=true&name='+encodeURIComponent(query)),
request('/json/stations/search?hidebroken=true&limit=40&order=clickcount&reverse=true&country='+encodeURIComponent(query)),
request('/json/stations/search?hidebroken=true&limit=40&order=clickcount&reverse=true&tag='+encodeURIComponent(query))]);
const all=[name,country,tag].flatMap(x=>x.status==='fulfilled'?x.value:[]);return[...new Map(all.filter(s=>s.stationuuid&&s.url_resolved).map(s=>[s.stationuuid,s])).values()].slice(0,100)}
export function mergeStations(a,b){return[...new Map([...a,...b].filter(valid).map(s=>[s.stationuuid,s])).values()]}
export async function registerClick(stationuuid){try{await request('/json/url/'+encodeURIComponent(stationuuid),3000)}catch{}}

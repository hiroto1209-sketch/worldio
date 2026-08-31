import{APP_VERSION}from'./config.js';
import{loadFavorites,saveFavorites,loadRecent,saveRecent,loadStationCache,saveStationCache}from'./storage.js';
import{loadFastStations,loadMoreStations,searchStations,mergeStations}from'./radio.js';
import{initMap,setStations,focusStation,getCenter,isReady}from'./map.js';
import{playStation,toggle,setVolume,onPlayerState}from'./player.js';
const $=s=>document.querySelector(s),hud=$('#hud'),sheet=$('#sheet'),results=$('#results');
let stations=loadStationCache(),favorites=loadFavorites(),recent=loadRecent(),current=null;
const status=t=>hud.textContent=t;
const esc=s=>String(s||'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),1700)}
function showBootError(message='地球エンジンを起動できませんでした。'){const e=$('#bootError');e.querySelector('[data-message]').textContent=message;e.classList.add('show')}
function renderList(list,title='Radio stations'){ $('#panelTitle').textContent=title;results.innerHTML=list.length?list.slice(0,80).map(s=>`<div class="result"><div class="resultArt">${s.favicon?`<img src="${esc(s.favicon)}" loading="lazy" onerror="this.remove()">`:'◉'}</div><div class="resultMeta"><div class="resultName">${esc(s.name||'Unknown')}</div><div class="resultSub">${esc([s.city,s.country,s.tags?.split(',')[0]].filter(Boolean).join(' · '))}</div></div><button class="resultPlay" data-id="${esc(s.stationuuid)}">▶</button></div>`).join(''):'<div class="empty">ラジオ局が見つかりません</div>';sheet.classList.add('show');results.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{const s=[...stations,...favorites,...recent].find(x=>x.stationuuid===b.dataset.id);if(s){sheet.classList.remove('show');chooseStation(s,true)}})}
function updatePlayer(station){current=station;$('#stationName').textContent=station.name||'Unknown station';$('#stationSub').textContent=[station.city,station.country,station.codec].filter(Boolean).join(' · ');$('#art').innerHTML=station.favicon?`<img src="${esc(station.favicon)}" onerror="this.parentElement.textContent='◉'">`:'◉';$('#favBtn').textContent=favorites.some(x=>x.stationuuid===station.stationuuid)?'♥':'♡'}
async function chooseStation(s,fly=false){updatePlayer(s);recent=[s,...recent.filter(x=>x.stationuuid!==s.stationuuid)].slice(0,40);saveRecent(recent);if(fly&&Number.isFinite(+s.geo_lat)&&Number.isFinite(+s.geo_long))focusStation(s);try{await playStation(s)}catch{}}
onPlayerState(({station,state,message})=>{if(station&&station!==current)updatePlayer(station);const map={idle:'',connecting:'CONNECTING…',buffering:'BUFFERING…',playing:'LIVE',paused:'PAUSED',error:'ERROR'};$('#playState').textContent=message||map[state]||'';$('#playBtn').textContent=state==='playing'||state==='buffering'?'Ⅱ':'▶';if(state==='playing'&&station)status(`${station.name} を再生中`);if(state==='error'&&message)toast(message)});
function distance(a,b,c,d){const R=6371,rad=x=>x*Math.PI/180,x=rad(c-a),y=rad(d-b),z=Math.sin(x/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(z))}
async function refreshFast(){try{const fresh=await loadFastStations();stations=mergeStations(fresh,stations).slice(0,1600);saveStationCache(stations);setStations(stations);status(`${fresh.length.toLocaleString()}局を表示 · すぐ使えます`);scheduleMore()}catch(e){if(stations.length){setStations(stations);status(`${stations.length.toLocaleString()}局をキャッシュから表示`)}else status('局データを取得できませんでした')}}
function scheduleMore(){const work=async()=>{try{const more=await loadMoreStations();stations=mergeStations(stations,more).slice(0,1600);saveStationCache(stations);setStations(stations);status(`${stations.length.toLocaleString()}局 · 準備完了`)}catch{}};if('requestIdleCallback'in window)requestIdleCallback(work,{timeout:3500});else setTimeout(work,1800)}
async function boot(){status(`地球を起動しています… V${APP_VERSION}`);if(stations.length)status('保存済みの局を準備しています…');try{await initMap({onStation:s=>chooseStation(s,true),onReady:()=>{status('地球を表示しました · すぐ使えます');if(stations.length)setStations(stations);setTimeout(refreshFast,80)},onError:e=>showBootError(e.message)});}catch(e){showBootError(e.message)}}
$('#searchForm').onsubmit=async e=>{e.preventDefault();const q=$('#search').value.trim();if(!q)return;status(`「${q}」を検索中…`);try{const list=await searchStations(q);renderList(list,`「${q}」の検索結果`);status(`${list.length}局見つかりました`)}catch{toast('検索に失敗しました')}};
$('#closeSheet').onclick=()=>sheet.classList.remove('show');sheet.onclick=e=>{if(e.target===sheet)sheet.classList.remove('show')};
$('#favListBtn').onclick=()=>renderList(favorites,'お気に入り');
$('#favBtn').onclick=()=>{if(!current)return toast('先に局を選んでください');const i=favorites.findIndex(x=>x.stationuuid===current.stationuuid);if(i>=0){favorites.splice(i,1);toast('お気に入りから削除')}else{favorites.unshift(current);toast('お気に入りに追加')}saveFavorites(favorites);updatePlayer(current)};
$('#randomBtn').onclick=()=>{if(!stations.length)return toast('局を読み込み中です');const pool=stations.slice(0,Math.min(900,stations.length));chooseStation(pool[Math.floor(Math.random()*pool.length)],true)};
$('#nearBtn').onclick=()=>{if(!stations.length)return toast('局を読み込み中です');const c=getCenter();const list=stations.map(s=>({s,d:distance(c.lat,c.lng,+s.geo_lat,+s.geo_long)})).sort((a,b)=>a.d-b.d).slice(0,50).map(x=>x.s);renderList(list,'この場所の近く')};
$('#playBtn').onclick=async()=>{if(!current)return toast('地球から局を選んでください');try{await toggle()}catch{toast('再生できません')}};
$('#volume').oninput=e=>setVolume(e.target.value);
$('#retryBoot').onclick=()=>location.reload();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
boot();

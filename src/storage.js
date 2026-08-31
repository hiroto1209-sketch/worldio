import{FAVORITES_KEY,RECENT_KEY,STATION_CACHE_KEY}from'./config.js';
const safeParse=(v,fallback)=>{try{return JSON.parse(v)||fallback}catch{return fallback}};
export const loadFavorites=()=>safeParse(localStorage.getItem(FAVORITES_KEY),[]);
export const saveFavorites=v=>localStorage.setItem(FAVORITES_KEY,JSON.stringify(v.slice(0,100)));
export const loadRecent=()=>safeParse(localStorage.getItem(RECENT_KEY),[]);
export const saveRecent=v=>localStorage.setItem(RECENT_KEY,JSON.stringify(v.slice(0,40)));
export const loadStationCache=()=>safeParse(localStorage.getItem(STATION_CACHE_KEY),[]);
export const saveStationCache=v=>{try{localStorage.setItem(STATION_CACHE_KEY,JSON.stringify(v))}catch{}};
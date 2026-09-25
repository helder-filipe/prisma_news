import html from '../public/index.html';
import css from '../public/style.css';
import app from '../dist/app.txt';
import {TOPICS,feedDefinitions} from './topics.js';
import {parseFeed,mergeArticles} from './feed.js';
const TTL=15*60*1000;
const memory=new Map();const pending=new Map();
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
async function getFeed(def,topic,mode,request,ctx){
 const cacheKey=new Request(new URL('/__rss_cache/v3/'+encodeURIComponent(def.url),request.url));
 const cache=globalThis.caches?.default;
 let stored=memory.get(def.url);
 if(!stored&&cache){try{const hit=await cache.match(cacheKey);if(hit)stored=await hit.json();}catch{}}
 const parse=record=>parseFeed(record.xml,def,topic,mode);
 if(stored&&Date.now()-stored.fetchedAt<TTL)return {articles:parse(stored),state:'ok',fetchedAt:stored.fetchedAt};
 try{
  let job=pending.get(def.url);
  if(!job){job=(async()=>{const response=await fetch(def.url,{headers:{'Accept':'application/rss+xml, application/xml, text/xml'},signal:AbortSignal.timeout(15000),redirect:'follow'});if(!response.ok)throw new Error('HTTP '+response.status);const xml=await response.text();const record={xml,fetchedAt:Date.now()};parse(record);memory.set(def.url,record);if(memory.size>64)memory.delete(memory.keys().next().value);if(cache)ctx.waitUntil(cache.put(cacheKey,new Response(JSON.stringify(record),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=86400'}})).catch(()=>{}));return record;})();pending.set(def.url,job);job.finally(()=>pending.delete(def.url)).catch(()=>{});}
  const current=await job;return {articles:parse(current),state:'ok',fetchedAt:current.fetchedAt};
 }catch{if(stored&&Date.now()-stored.fetchedAt<86400000)return {articles:parse(stored),state:'stale',fetchedAt:stored.fetchedAt};return {articles:[],state:'error',fetchedAt:null};}
}
const assetHeaders={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'};
export default {async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(!['GET','HEAD'].includes(request.method))return new Response('Método não permitido',{status:405});
 if(url.pathname==='/api/news'){
  const topic=TOPICS.find(t=>t.id===(url.searchParams.get('topic')||'tudo'));const mode=url.searchParams.get('mode')||'noticias';
  if(!topic||!['noticias','praticas'].includes(mode))return json({error:'Tema ou modo inválido.'},400);
  const defs=feedDefinitions(topic,mode);
  const outcomes=await Promise.all(defs.map(async def=>{try{return {...await getFeed(def,topic,mode,request,ctx),def};}catch{return {articles:[],state:'error',fetchedAt:null,def};}}));
  const sources=outcomes.map(o=>({name:o.def.name,url:o.def.url,state:o.state,fetchedAt:o.fetchedAt?new Date(o.fetchedAt).toISOString():null,count:o.articles.length}));
  const items=mergeArticles(outcomes.map(o=>o.articles)).slice(0,180);const available=outcomes.filter(o=>o.state!=='error');
  return json({topic:topic.id,mode,items,sources,checkedAt:new Date().toISOString(),partial:outcomes.some(o=>o.state!=='ok'),refreshMinutes:15},available.length?200:503);
 }
 const assets={'/':[html,'text/html; charset=utf-8'],'/index.html':[html,'text/html; charset=utf-8'],'/style.css':[css,'text/css; charset=utf-8'],'/app.js':[app,'application/javascript; charset=utf-8']};
 const asset=assets[url.pathname];if(!asset)return new Response('Página não encontrada',{status:404});
 return new Response(request.method==='HEAD'?null:asset[0],{headers:{...assetHeaders,'Content-Type':asset[1],'Cache-Control':'no-cache'}});
}};

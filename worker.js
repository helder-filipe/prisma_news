import html from '../public/index.html';
import css from '../public/style.css';
import app from '../dist/app.txt';
import {TOPICS,feedDefinitions} from './topics.js';
import {parseFeed,mergeArticles} from './feed.js';
const TTL=15*60*1000;
const memory=new Map();const pending=new Map();
const imageMemory=new Map();
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
function safePublicURL(value,base){
 try{
  const u=new URL(value,base);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return null;
  const h=u.hostname.toLowerCase();if(!h||h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||h==='::1'||h==='0.0.0.0')return null;
  const ip=h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if(ip){const [a,b]=ip.slice(1).map(Number);if([0,10,127].includes(a)||a>=224||a===169&&b===254||a===192&&b===168||a===172&&b>=16&&b<=31)return null;}
  if(h.startsWith('[fc')||h.startsWith('[fd')||h.startsWith('[fe80:'))return null;
  return u;
 }catch{return null;}
}
function imageFromHTML(html,pageURL){
 const decode=s=>String(s||'').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&#x2f;/gi,'/');
 for(const match of html.matchAll(/<meta\b[^>]*>/gi)){
  const attrs={};for(const a of match[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gi))attrs[a[1].toLowerCase()]=decode(a[3]);
  const key=(attrs.property||attrs.name||'').toLowerCase();if(!['og:image','og:image:url','twitter:image','twitter:image:src'].includes(key))continue;
  const u=safePublicURL(attrs.content,pageURL);if(u)return u.href;
 }
 return '';
}
async function readHTML(response,maxBytes=180_000){
 if(!response.body?.getReader)return (await response.text()).slice(0,maxBytes);
 const reader=response.body.getReader();const chunks=[];let total=0;
 try{while(total<maxBytes){const {done,value}=await reader.read();if(done)break;const chunk=value.subarray(0,maxBytes-total);chunks.push(chunk);total+=chunk.length;if(chunk.length<value.length)break;}}finally{try{await reader.cancel();}catch{}}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);
}
async function articleImage(articleURL){
 const now=Date.now(),cached=imageMemory.get(articleURL);if(cached&&now-cached.at<(cached.url?6:0.5)*60*60*1000)return cached.url||'';
 let current=safePublicURL(articleURL);if(!current)return '';
 try{
  for(let redirects=0;redirects<4;redirects++){
   const response=await fetch(current.href,{headers:{Accept:'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1','User-Agent':'Mozilla/5.0 (compatible; PrismaVerde/1.0)'},signal:AbortSignal.timeout(2500),redirect:'manual'});
   if(response.status>=300&&response.status<400){const next=safePublicURL(response.headers.get('location'),current.href);if(!next)break;current=next;continue;}
   if(!response.ok||!/(?:text\/html|application\/xhtml\+xml)/i.test(response.headers.get('content-type')||''))break;
   const image=imageFromHTML(await readHTML(response),current.href);if(image){imageMemory.set(articleURL,{url:image,at:now});if(imageMemory.size>500)imageMemory.delete(imageMemory.keys().next().value);return image;}
   break;
  }
 }catch{}
 imageMemory.set(articleURL,{url:'',at:now});if(imageMemory.size>500)imageMemory.delete(imageMemory.keys().next().value);return '';
}
async function hydrateImages(items){
 const candidates=items.filter(item=>!item.imageUrl).slice(0,16);
 for(let i=0;i<candidates.length;i+=8)await Promise.all(candidates.slice(i,i+8).map(async item=>{item.imageUrl=await articleImage(item.url);}));
}
async function getFeed(def,topic,request,ctx){
 const cacheKey=new Request(new URL('/__rss_cache/v4/'+encodeURIComponent(def.url),request.url));
 const cache=globalThis.caches?.default;
 let stored=memory.get(def.url);
 if(!stored&&cache){try{const hit=await cache.match(cacheKey);if(hit)stored=await hit.json();}catch{}}
 const parse=record=>parseFeed(record.xml,def,topic);
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
  const topic=TOPICS.find(t=>t.id===(url.searchParams.get('topic')||'tudo'));
  if(!topic)return json({error:'Tema inválido.'},400);
  const defs=feedDefinitions(topic);
  const outcomes=await Promise.all(defs.map(async def=>{try{return {...await getFeed(def,topic,request,ctx),def};}catch{return {articles:[],state:'error',fetchedAt:null,def};}}));
  const sources=outcomes.map(o=>({name:o.def.name,url:o.def.sourceURL||o.def.url,state:o.state,fetchedAt:o.fetchedAt?new Date(o.fetchedAt).toISOString():null,count:o.articles.length}));
  const items=mergeArticles(outcomes.map(o=>o.articles)).slice(0,180);await hydrateImages(items);const available=outcomes.filter(o=>o.state!=='error');
  return json({topic:topic.id,items,sources,checkedAt:new Date().toISOString(),partial:outcomes.some(o=>o.state!=='ok'),refreshMinutes:15},available.length?200:503);
 }
 const assets={'/':[html,'text/html; charset=utf-8'],'/index.html':[html,'text/html; charset=utf-8'],'/style.css':[css,'text/css; charset=utf-8'],'/app.js':[app,'application/javascript; charset=utf-8']};
 const asset=assets[url.pathname];if(!asset)return new Response('Página não encontrada',{status:404});
 return new Response(request.method==='HEAD'?null:asset[0],{headers:{...assetHeaders,'Content-Type':asset[1],'Cache-Control':'no-cache'}});
}};

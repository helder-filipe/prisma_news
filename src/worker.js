import prismaIcon from '../public/icons/prisma-verde.svg';
import favicon from '../public/icons/favicon-32.png';
import appleIcon from '../public/icons/apple-touch-icon.png';
import icon192 from '../public/icons/icon-192.png';
import icon512 from '../public/icons/icon-512.png';
import manifest from '../public/manifest.webmanifest';
import {pageImage,rssLinks,headlineLink} from './images.js';
import html from '../public/index.html';
import sources from '../public/sources.html';
import css from '../public/style.css';
import infraloboLogo from '../public/infralobo-logo.png';
import app from '../dist/app.txt';
import sourcesApp from '../dist/sources-app.txt';
import {TOPICS,feedDefinitions} from './topics.js';
import {parseFeed,mergeArticles,normalize} from './feed.js';
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
async function readHTML(response,maxBytes=500_000){
 if(!response.body?.getReader)return (await response.text()).slice(0,maxBytes);
 const reader=response.body.getReader();const chunks=[];let total=0;
 try{while(total<maxBytes){const {done,value}=await reader.read();if(done)break;const chunk=value.subarray(0,maxBytes-total);chunks.push(chunk);total+=chunk.length;if(chunk.length<value.length)break;}}finally{try{await reader.cancel();}catch{}}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);
}
async function articleImage(articleURL,budgetSignal,excluded=[]){
 const now=Date.now(),cached=imageMemory.get(articleURL);if(!excluded.length&&cached&&now-cached.at<(cached.url?6:0.5)*60*60*1000)return cached.url||'';
 let current=safePublicURL(articleURL);if(!current)return '';
 try{
  for(let redirects=0;redirects<4;redirects++){
   const response=await fetch(current.href,{headers:{Accept:'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1','User-Agent':'Mozilla/5.0 (compatible; PrismaVerde/1.0)'},signal:AbortSignal.any([AbortSignal.timeout(3000),budgetSignal]),redirect:'manual'});
   if(response.status>=300&&response.status<400){const next=safePublicURL(response.headers.get('location'),current.href);if(!next)break;current=next;continue;}
   if(!response.ok||!/(?:text\/html|application\/xhtml\+xml)/i.test(response.headers.get('content-type')||''))break;
   const image=pageImage(await readHTML(response),current.href,excluded);if(image&&safePublicURL(image)){imageMemory.set(articleURL,{url:image,at:now});if(imageMemory.size>500)imageMemory.delete(imageMemory.keys().next().value);return image;}
   break;
  }
 }catch{}
 if(budgetSignal.aborted||excluded.length)return '';
 imageMemory.set(articleURL,{url:'',at:now});if(imageMemory.size>500)imageMemory.delete(imageMemory.keys().next().value);return '';
}
async function hydrateImages(items){
 // Prefer publisher links: Google News intermediary pages often lack article images.
 const candidates=items.filter(item=>!item.imageUrl).sort((a,b)=>Number(a.url.includes('news.google.com/'))-Number(b.url.includes('news.google.com/')));
 const budgetSignal=AbortSignal.timeout(7500);let cursor=0;
 await Promise.all(Array.from({length:Math.min(12,candidates.length)},async()=>{
  while(cursor<candidates.length&&!budgetSignal.aborted){const item=candidates[cursor++];item.imageUrl=await articleImage(item.url,budgetSignal);}
 }));
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
  if(!job){job=(async()=>{const response=await fetch(def.url,{headers:{'Accept':'application/rss+xml, application/xml, text/xml'},signal:AbortSignal.timeout(15000),redirect:'follow'});if(!response.ok)throw new Error('HTTP '+response.status);const xml=await response.text();const record={xml,fetchedAt:Date.now()};parse(record);memory.set(def.url,record);if(memory.size>256)memory.delete(memory.keys().next().value);if(cache)ctx.waitUntil(cache.put(cacheKey,new Response(JSON.stringify(record),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=86400'}})).catch(()=>{}));return record;})();pending.set(def.url,job);job.finally(()=>pending.delete(def.url)).catch(()=>{});}
  const current=await job;return {articles:parse(current),state:'ok',fetchedAt:current.fetchedAt};
 }catch{if(stored&&Date.now()-stored.fetchedAt<86400000)return {articles:parse(stored),state:'stale',fetchedAt:stored.fetchedAt};return {articles:[],state:'error',fetchedAt:null};}
}
const publisherFeeds=new Map();
async function publisherImage(article,signal,excluded){
 const origin=safePublicURL(article.sourceURL);if(!origin||origin.hostname==='news.google.com')return '';
 const host=url=>new URL(url).hostname.replace(/^www\./,'');
 const known=feedDefinitions(TOPICS[0]).find(def=>def.kind==='direct'&&host(def.sourceURL||def.url)===host(origin.href));
 const feedURL=known?.url||new URL('/feed/',origin).href;
 let cached=publisherFeeds.get(feedURL);
 async function readPublic(url){
  let current=safePublicURL(url);if(!current)throw Error('Invalid URL');
  for(let i=0;i<3;i++){
   const response=await fetch(current.href,{headers:{Accept:'application/rss+xml, application/xml, text/html;q=0.5'},signal:AbortSignal.any([signal,AbortSignal.timeout(3500)]),redirect:'manual'});
   if(response.status>=300&&response.status<400){current=safePublicURL(response.headers.get('location'),current.href);if(!current)break;continue;}
   if(!response.ok)break;return {text:await readHTML(response,1_500_000),url:current.href};
  }
  throw Error('Publisher unavailable');
 }
 if(!cached||Date.now()-cached.at>TTL){
  const parse=xml=>parseFeed(xml,{name:article.source,kind:'direct',lang:article.lang},TOPICS[0]);
  try{cached={items:parse((await readPublic(feedURL)).text),at:Date.now()};}
  catch{
   try{
    const home=await readPublic(origin.href);const alternate=rssLinks(home.text,home.url).find(url=>url!==feedURL);
    if(alternate)cached={items:parse((await readPublic(alternate)).text),at:Date.now()};
   }catch{}
  }
  if(!cached&&!signal.aborted)cached={items:[],at:Date.now()};
  if(cached){publisherFeeds.set(feedURL,cached);if(publisherFeeds.size>80)publisherFeeds.delete(publisherFeeds.keys().next().value);}
 }
 const key=value=>normalize(value).replace(/[^a-z0-9]/g,'');
 let match=cached?.items.find(item=>key(item.title)===key(article.title));
 if(!match&&!signal.aborted){
  try{
   const home=await readPublic(origin.href);
   const link=headlineLink(home.text,home.url,article.title);
   if(link)match={url:link};
   // WordPress publishers expose older matching articles in their public search feed.
   if(!match&&/wp-content|wp-includes/i.test(home.text)){
    const search=new URL('/',origin);search.searchParams.set('s',article.title);search.searchParams.set('feed','rss2');
    const results=parseFeed((await readPublic(search.href)).text,{name:article.source,kind:'direct',lang:article.lang},TOPICS[0]);
    match=results.find(item=>key(item.title)===key(article.title));
   }
  }catch{}
 }
 if(!match)return '';
 if(match.imageUrl&&!excluded.includes(match.imageUrl))return match.imageUrl;
 return articleImage(match.url,signal,excluded);
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
  const sourcesOnly=url.searchParams.get('sources')==='1';const items=sourcesOnly?[]:mergeArticles(outcomes.map(o=>o.articles)).slice(0,180);
  const imageRequest=url.searchParams.get('image');
  if(imageRequest){
   // Resolve only an article actually returned by these feeds, never arbitrary user URLs.
   const article=items.find(item=>item.url===imageRequest);if(!article)return json({imageUrl:''},404);
   const excluded=url.searchParams.getAll('exclude').slice(0,4);const signal=AbortSignal.timeout(10000);
   let imageUrl=article.imageUrl&&!excluded.includes(article.imageUrl)?article.imageUrl:'';
   const google=new URL(article.url).hostname==='news.google.com';
   if(!imageUrl&&google)imageUrl=await publisherImage(article,signal,excluded);
   if(!imageUrl&&!signal.aborted)imageUrl=await articleImage(article.url,signal,excluded.length?excluded:['']);
   if(!imageUrl&&!google&&!signal.aborted)imageUrl=await publisherImage(article,signal,excluded);
   return json({imageUrl});
  }
  for(const item of items)item.imageTopic=topic.id;
  if(!sourcesOnly)await hydrateImages(items);const available=outcomes.filter(o=>o.state!=='error');
  return json({topic:topic.id,items,sources,checkedAt:new Date().toISOString(),partial:outcomes.some(o=>o.state!=='ok'),refreshMinutes:15},available.length?200:503);
 }
 const assets={'/icons/prisma-verde.svg':[prismaIcon,'image/svg+xml'],'/icons/favicon-32.png':[favicon,'image/png'],'/icons/apple-touch-icon.png':[appleIcon,'image/png'],'/icons/icon-192.png':[icon192,'image/png'],'/icons/icon-512.png':[icon512,'image/png'],'/manifest.webmanifest':[manifest,'application/manifest+json'],'/infralobo-logo.png':[infraloboLogo,'image/png'],'/':[html,'text/html; charset=utf-8'],'/index.html':[html,'text/html; charset=utf-8'],'/sources':[sources,'text/html; charset=utf-8'],'/sources.html':[sources,'text/html; charset=utf-8'],'/style.css':[css,'text/css; charset=utf-8'],'/app.js':[app,'application/javascript; charset=utf-8'],'/sources.js':[sourcesApp,'application/javascript; charset=utf-8']};
 const asset=assets[url.pathname];if(!asset)return new Response('Página não encontrada',{status:404});
 return new Response(request.method==='HEAD'?null:asset[0],{headers:{...assetHeaders,'Content-Type':asset[1],'Cache-Control':'no-cache'}});
}};

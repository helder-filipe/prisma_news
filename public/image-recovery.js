import {createThumbnailCache} from './thumbnail-cache.js';
// Resolve visible cards first, with bounded concurrency and one transient retry.
export function createImageRecovery(root,onRecovered){
 let storage;try{storage=globalThis.localStorage;}catch{}
 const saved=createThumbnailCache(storage);
 const records=new Map(),queue=[];let active=0;
 const record=url=>{if(!records.has(url)){const cached=saved.get(url);records.set(url,{tried:new Set(),attempts:0,result:cached?.imageUrl||'',retryAt:cached&&!cached.imageUrl?cached.expiresAt:0,pending:false});}return records.get(url);};
 function fallback(slot){slot.classList.remove('is-loading','has-image');slot.classList.add('is-fallback');slot.querySelector('.image-placeholder span').textContent=slot.dataset.fallback;}
 function loading(slot){slot.classList.remove('is-fallback');slot.classList.add('is-loading');slot.querySelector('.image-placeholder span').textContent=slot.dataset.loading||slot.dataset.fallback;}
 function apply(slot,url){if(!slot.isConnected)return;const img=new Image();img.alt='';img.decoding='async';img.referrerPolicy='no-referrer';slot.querySelector('img')?.remove();slot.classList.remove('is-fallback');slot.classList.add('is-loading');slot.append(img);img.src=url;}
 function finish(url,result){for(const slot of root.querySelectorAll('.story-image'))if(slot.dataset.articleUrl===url&&!slot.querySelector('img')){if(result)apply(slot,result);else fallback(slot);}}
 async function pump(){
  if(active>=4||!queue.length)return;
  const {url,topic}=queue.shift(),state=record(url);
  const visible=[...root.querySelectorAll('.story-image')].some(slot=>slot.dataset.articleUrl===url&&!slot.querySelector('img')&&slot.getBoundingClientRect().bottom>=-250&&slot.getBoundingClientRect().top<innerHeight+250);
  if(!visible){state.pending=false;for(const slot of root.querySelectorAll('.story-image'))if(slot.dataset.articleUrl===url&&!slot.querySelector('img'))observer?.observe(slot);pump();return;}
  state.attempts++;active++;let retry=false;
  try{
   const params=new URLSearchParams({topic,image:url,images:'visible'});for(const image of state.tried)params.append('exclude',image);
   const response=await fetch('/api/news?'+params,{signal:AbortSignal.timeout(28000),cache:'default'});
   if(!response.ok)throw Error('Image unavailable');const data=await response.json();
   if(data.imageUrl&&!state.tried.has(data.imageUrl)){state.result=data.imageUrl;onRecovered(url,data.imageUrl);}else if(!state.result){saved.set(url,'');state.retryAt=Date.now()+120000;}
  }catch{retry=state.attempts<2;state.retryAt=Date.now()+(retry?1500:120000);}
  finally{
   active--;state.pending=false;finish(url,state.result);pump();
   if(retry){const timer=setTimeout(()=>{for(const slot of root.querySelectorAll('.story-image'))if(slot.dataset.articleUrl===url)schedule(slot);},1550);timer.unref?.();}
  }
 }
 function schedule(slot){
  const url=slot.dataset.articleUrl,topic=slot.dataset.imageTopic;if(!url||!topic||slot.querySelector('img'))return;
  const state=record(url);if(state.result&&!state.tried.has(state.result)){apply(slot,state.result);return;}
  if(state.attempts>=2&&state.retryAt&&state.retryAt<=Date.now()){state.attempts=0;state.retryAt=0;}
  if(state.pending||state.attempts>=2||state.retryAt>Date.now())return;
  loading(slot);state.pending=true;queue.push({url,topic});pump();
 }
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);schedule(entry.target);}},{rootMargin:'250px'}):null;
 return {
  imageFor(article){const state=record(article.url);return state?.result||(!state?.tried.has(article.imageUrl)?article.imageUrl:'')||'';},
  lookingFor(article){const state=record(article.url);return state.pending||state.retryAt<=Date.now()&&(state.attempts<2||Boolean(state.retryAt));},
  observe(){observer?.disconnect();for(const slot of root.querySelectorAll('.story-image'))if(!slot.querySelector('img')){if(observer)observer.observe(slot);else if(slot.getBoundingClientRect().top<innerHeight+250)schedule(slot);}},
  loaded(img){const url=img.closest('.story-image')?.dataset.articleUrl;if(url){record(url).result=img.src;saved.set(url,img.src);}},
  failed(img,{retry=true}={}){const slot=img.closest('.story-image');if(!slot)return;const state=record(slot.dataset.articleUrl);state.tried.add(img.src);state.result='';state.retryAt=0;saved.delete(slot.dataset.articleUrl);img.remove();fallback(slot);if(!retry)return;if(observer)observer.observe(slot);else schedule(slot);}
 };
}

// Retry missing thumbnails as cards approach the viewport, two requests at a time.
export function createImageRecovery(root,onRecovered){
 const records=new Map(),queue=[];let active=0;
 const record=url=>{if(!records.has(url))records.set(url,{tried:new Set(),attempts:0,result:'',pending:false});return records.get(url);};
 function fallback(slot){slot.classList.remove('is-loading','has-image');slot.classList.add('is-fallback');slot.querySelector('.image-placeholder span').textContent=slot.dataset.fallback;}
 function apply(slot,url){if(!slot.isConnected)return;const img=new Image();img.alt='';img.decoding='async';img.referrerPolicy='no-referrer';slot.querySelector('img')?.remove();slot.classList.remove('is-fallback');slot.classList.add('is-loading');slot.append(img);img.src=url;}
 function finish(url,result){for(const slot of root.querySelectorAll('.story-image'))if(slot.dataset.articleUrl===url&&!slot.querySelector('img')){if(result)apply(slot,result);else fallback(slot);}}
 async function pump(){
  if(active>=2||!queue.length)return;
  const {url,topic}=queue.shift(),state=record(url);
  const visible=[...root.querySelectorAll('.story-image')].some(slot=>slot.dataset.articleUrl===url&&!slot.querySelector('img')&&slot.getBoundingClientRect().bottom>=-250&&slot.getBoundingClientRect().top<innerHeight+250);
  if(!visible){state.pending=false;pump();return;}
  state.attempts++;active++;
  try{
   const params=new URLSearchParams({topic,image:url});for(const image of state.tried)params.append('exclude',image);
   const response=await fetch('/api/news?'+params,{signal:AbortSignal.timeout(28000),cache:'no-store'});
   if(!response.ok)throw Error('Image unavailable');const data=await response.json();
   if(data.imageUrl&&!state.tried.has(data.imageUrl)){state.result=data.imageUrl;onRecovered(url,data.imageUrl);}
  }catch{}
  finally{active--;state.pending=false;finish(url,state.result);pump();}
 }
 function schedule(slot){
  const url=slot.dataset.articleUrl,topic=slot.dataset.imageTopic;if(!url||!topic||slot.querySelector('img'))return;
  const state=record(url);if(state.result&&!state.tried.has(state.result)){apply(slot,state.result);return;}
  if(state.pending||state.attempts>=2)return;
  state.pending=true;queue.push({url,topic});pump();
 }
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);schedule(entry.target);}},{rootMargin:'250px'}):null;
 return {
  imageFor(article){const state=records.get(article.url);return state?.result||(!state?.tried.has(article.imageUrl)?article.imageUrl:'')||'';},
  observe(){observer?.disconnect();for(const slot of root.querySelectorAll('.story-image'))if(!slot.querySelector('img')){if(observer)observer.observe(slot);else if(slot.getBoundingClientRect().top<innerHeight+250)schedule(slot);}},
  failed(img){const slot=img.closest('.story-image');if(!slot)return;const state=record(slot.dataset.articleUrl);state.tried.add(img.src);state.result='';img.remove();fallback(slot);if(observer)observer.observe(slot);else schedule(slot);}
 };
}

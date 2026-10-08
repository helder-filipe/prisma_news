const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
// All is the union of the same responses used by individual category views.
export function combineTopics(topicIds,memory){
 const articles=new Map(),sources=new Map();let checkedAt='',partial=false,loaded=0;
 for(const id of topicIds){
  const data=memory.get(id)?.data;if(!data){partial=true;continue;}loaded++;
  partial ||= Boolean(data.partial);
  if(data.checkedAt>checkedAt)checkedAt=data.checkedAt;
  for(const item of data.items||[]){
   // Keep language groups independent even for short or ambiguous headlines.
   const key=item.lang+':'+normalize(item.title);const previous=articles.get(key);
   if(!previous){articles.set(key,{...item,topics:[...new Set([...(item.topics||[]),id])]});continue;}
   const preferred=item.via==='RSS direto'?item:previous;
   articles.set(key,{...preferred,imageUrl:preferred.imageUrl||previous.imageUrl||item.imageUrl||'',topics:[...new Set([...previous.topics,...(item.topics||[]),id])]});
  }
  for(const source of data.sources||[]){const key=source.name;const previous=sources.get(key);sources.set(key,previous?{...source,count:previous.count+source.count,state:previous.state==='error'||source.state==='error'?'error':previous.state==='stale'||source.state==='stale'?'stale':'ok'}:source);}
 }
 return {topic:'tudo',items:[...articles.values()].sort((a,b)=>b.date.localeCompare(a.date)),sources:[...sources.values()],checkedAt:checkedAt||new Date().toISOString(),partial,refreshMinutes:15,loadedTopics:loaded,totalTopics:topicIds.length};
}
export function createNewsCollection(topicIds,{fetchNews,now=()=>Date.now(),ttl=15*60000,concurrency=4}={}){
 const memory=new Map(),pending=new Map(),listeners=new Set();let allPending=null;
 async function topic(id,force=false){
  if(pending.has(id))return pending.get(id);
  const cached=memory.get(id);if(!force&&cached&&now()-cached.loadedAt<ttl)return cached.data;
  const job=(async()=>{const data=await fetchNews(id);memory.set(id,{data,loadedAt:now()});return data;})();
  pending.set(id,job);
  try{return await job;}finally{pending.delete(id);}
 }
 async function all(force=false,onProgress=()=>{}){
  listeners.add(onProgress);
  if(!allPending)allPending=(async()=>{
   let cursor=0,completed=0;const errors=[];
   await Promise.all(Array.from({length:Math.min(concurrency,topicIds.length)},async()=>{
    while(cursor<topicIds.length){
     const id=topicIds[cursor++];try{await topic(id,force);}catch{errors.push(id);}completed++;
     const snapshot=combineTopics(topicIds,memory);snapshot.partial ||= errors.length>0;
     for(const listener of listeners)listener(snapshot,completed);
    }
   }));
   const data=combineTopics(topicIds,memory);data.partial ||= errors.length>0;return {data,errors};
  })().finally(()=>{allPending=null;});
  try{return await allPending;}finally{listeners.delete(onProgress);}
 }
 return {memory,topic,all,snapshot:()=>combineTopics(topicIds,memory)};
}

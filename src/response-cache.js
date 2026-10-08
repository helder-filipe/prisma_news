// Shared caches contain public feed data and image URLs, never image file copies.
export const IMAGE_TTL=7*86400, MISS_TTL=10*60, NEWS_TTL=15*60;
const imageKey=(url,excluded=[])=>'image:v1:'+JSON.stringify([url,[...new Set(excluded)].sort()]);
export function createResponseCache(storage){
 async function bounded(job){let timer;try{return await Promise.race([job,new Promise(resolve=>{timer=setTimeout(resolve,800);})]);}catch{return undefined;}finally{clearTimeout(timer);}}
 async function get(key){
  if(!storage)return undefined;
  const record=await bounded(Promise.resolve().then(()=>storage.get(key)));
  return record?.expiresAt>Date.now()?record.value:undefined;
 }
 async function set(key,value,ttl){
  if(!storage)return;
  await bounded(Promise.resolve().then(()=>storage.set(key,{value,expiresAt:Date.now()+ttl*1000},{ttl})));
 }
 const image={get:(url,excluded=[])=>get(imageKey(url,excluded)),set:(url,value,excluded=[])=>set(imageKey(url,excluded),value,value.imageUrl?IMAGE_TTL:MISS_TTL)};
 return {image,async respond(request,run,waitUntil){
  if(!['GET','HEAD'].includes(request.method))return run(image);
  const url=new URL(request.url),topic=url.searchParams.get('topic')||'tudo';
  const article=url.searchParams.get('image'),excluded=url.searchParams.getAll('exclude').slice(0,4);
  const mode=url.searchParams.get('images')==='visible'?'visible':'eager';
  const key='news:v2:'+JSON.stringify([topic,url.searchParams.get('sources')==='1',mode]);
  const cached=article?await image.get(article,excluded):await get(key);
  if(cached!==undefined)return response(cached,article,'HIT');
  const knownNews=article?await get('news:v2:'+JSON.stringify([topic,false,mode])):undefined;
  const result=await run(image,knownNews);
  if(!result.ok)return result; // Never cache request validation errors or unavailable feeds.
  const data=await result.clone().json();
  const write=async()=>{
   if(article){
    await image.set(article,data,excluded);
    if(data.imageUrl&&excluded.length)await image.set(article,data);
   }else{
    await set(key,data,data.partial?60:NEWS_TTL);
    // Sequential batches bound cache traffic for large categories.
    const found=(data.items||[]).filter(item=>item.imageUrl);
    for(let i=0;i<found.length;i+=12)await Promise.all(found.slice(i,i+12).map(item=>image.set(item.url,{imageUrl:item.imageUrl})));
   }
  };
  waitUntil(write().catch(()=>{}));
  return response(data,article,'MISS');
 }};
}
function response(data,article,state){
 return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','X-Prisma-Cache':state,'Cache-Control':article?`public, max-age=${data.imageUrl?3600:MISS_TTL}`:'no-store'}});
}

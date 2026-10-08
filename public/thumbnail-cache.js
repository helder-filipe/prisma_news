const KEY='prisma:thumbnails:v1',TTL=7*86400000,MISS=10*60000;
export function createThumbnailCache(storage,now=()=>Date.now()){
 let entries={};try{const parsed=JSON.parse(storage?.getItem(KEY)||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))entries=parsed;}catch{}
 const valid=entry=>entry&&Number.isFinite(entry.expiresAt)&&entry.expiresAt>now()&&typeof entry.imageUrl==='string'&&(!entry.imageUrl||/^https?:\/\//i.test(entry.imageUrl));
 function save(){entries=Object.fromEntries(Object.entries(entries).filter(([,entry])=>valid(entry)).sort((a,b)=>b[1].expiresAt-a[1].expiresAt).slice(0,400));try{storage?.setItem(KEY,JSON.stringify(entries));}catch{}}
 return {
  get(url){return valid(entries[url])?entries[url]:undefined;},
  set(url,imageUrl){entries[url]={imageUrl,expiresAt:now()+(imageUrl?TTL:MISS)};save();},
  delete(url){delete entries[url];save();}
 };
}

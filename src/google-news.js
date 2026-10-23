// Resolve the publisher URL before looking for a photograph. The RSS splash
// page is a redirect application; its own preview metadata is not the article.
export function googleArticleId(value){
 try{const u=new URL(value);return u.hostname==='news.google.com'?u.pathname.match(/^\/(?:rss\/)?(?:articles|read)\/([\w-]{12,1000})\/?$/)?.[1]||'':'';}catch{return '';}
}
function webURL(value){try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password&&u.hostname!=='news.google.com'?u.href:'';}catch{return '';}}
function legacyURL(id){
 try{
  const bytes=Uint8Array.from(atob(id.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  // Older RSS IDs store a length-delimited publisher URL in protobuf field 4.
  if(bytes[0]!==8||bytes[1]!==19||bytes[2]!==34)return '';
  let size=0,shift=0,index=3;
  for(;index<8;index++){const byte=bytes[index];size|=(byte&127)<<shift;shift+=7;if(!(byte&128)){index++;break;}}
  if(size<=0||index+size>bytes.length)return '';
  return webURL(new TextDecoder().decode(bytes.subarray(index,index+size)));
 }catch{return '';}
}
export function googleDecodeParams(html){
 const signature=html.match(/\bdata-n-a-sg=["']([^"']+)["']/)?.[1];
 const timestamp=Number(html.match(/\bdata-n-a-ts=["'](\d+)["']/)?.[1]);
 return signature&&Number.isSafeInteger(timestamp)&&timestamp>0?{signature,timestamp}:null;
}
export function googleDecodeBody(id,{signature,timestamp}){
 const context=[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0];
 const request=JSON.stringify(['garturlreq',context,id,timestamp,signature]);
 return new URLSearchParams({'f.req':JSON.stringify([[['Fbv4je',request,null,'generic']]])}).toString();
}
export function googleDecodedURL(text){
 // batchexecute may contain a byte-count line and housekeeping frames. Parse
 // JSON frames, not substrings of an escaped URL (which corrupts query strings).
 for(const line of text.split('\n')){
  if(!line.trim().startsWith('['))continue;
  try{const rows=JSON.parse(line);for(const row of rows){
   if(row?.[0]!=='wrb.fr'||row[1]!=='Fbv4je'||typeof row[2]!=='string')continue;
   const data=JSON.parse(row[2]);if(data[0]==='garturlres'){const url=webURL(data[1]);if(url)return url;}
  }}catch{}
 }
 return '';
}
export function createGoogleNewsResolver({fetcher=(...args)=>fetch(...args),readText=async response=>(await response.text()).slice(0,1_500_000)}={}){
 const memory=new Map(),pending=new Map();
 return async function resolve(value,signal){
  const id=googleArticleId(value);if(!id)return '';
  const old=legacyURL(id);if(old)return old;
  const hit=memory.get(id);if(hit&&Date.now()-hit.at<7*86400000)return hit.url;
  if(pending.has(id))return pending.get(id);
  const job=(async()=>{
   try{
    const budget=signal?AbortSignal.any([signal,AbortSignal.timeout(6500)]):AbortSignal.timeout(6500);
    let url=new URL('https://news.google.com/rss/articles/'+id+'?hl=en-US&gl=US&ceid=US:en'),html='';
    for(let i=0;i<3;i++){
     const response=await fetcher(url.href,{signal:budget,redirect:'manual',headers:{Accept:'text/html'}});
     if(response.status>=300&&response.status<400){
      const next=new URL(response.headers.get('location'),url);
      // Stop at consent/challenge pages; never follow them or an external hop.
      if(next.origin!==url.origin||!next.pathname.startsWith('/rss/articles/'))return '';
      url=next;continue;
     }
     if(!response.ok)return '';
     html=await readText(response);break;
    }
    const params=googleDecodeParams(html);if(!params)return '';
    const response=await fetcher('https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je',{
     method:'POST',redirect:'manual',signal:budget,
     headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:googleDecodeBody(id,params)
    });
    if(!response.ok)return '';
    const decoded=googleDecodedURL(await readText(response));
    if(decoded){memory.set(id,{url:decoded,at:Date.now()});if(memory.size>1000)memory.delete(memory.keys().next().value);}
    return decoded;
   }catch{return '';}
  })();
  pending.set(id,job);try{return await job;}finally{pending.delete(id);}
 };
}

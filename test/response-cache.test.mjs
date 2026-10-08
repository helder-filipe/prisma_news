import test from 'node:test';
import assert from 'node:assert/strict';
import {createResponseCache,IMAGE_TTL,MISS_TTL} from '../src/response-cache.js';
import {createThumbnailCache} from '../public/thumbnail-cache.js';
const request=(extra={})=>new Request('https://prisma.test/api/news?'+new URLSearchParams({topic:'agua',...extra}));
const response=data=>new Response(JSON.stringify(data));
function fixture(){const records=new Map(),jobs=[];return {records,jobs,storage:{get:async key=>records.get(key),set:async(key,value)=>records.set(key,value)},wait:p=>jobs.push(p),flush:async()=>{await Promise.all(jobs);jobs.length=0;}};}
test('Shared news and image results survive a new handler instance without repeating source queries',async()=>{
 const f=fixture();let calls=0;
 const data={topic:'agua',items:[{url:'https://source.test/article',imageUrl:'https://img.test/photo.jpg'}]};
 const run=async()=>{calls++;return response(data);};
 assert.equal((await createResponseCache(f.storage).respond(request(),run,f.wait)).headers.get('x-prisma-cache'),'MISS');await f.flush();
 assert.equal((await createResponseCache(f.storage).respond(request(),run,f.wait)).headers.get('x-prisma-cache'),'HIT');
 const hit=await createResponseCache(f.storage).respond(request({image:data.items[0].url}),run,f.wait);
 assert.equal((await hit.json()).imageUrl,data.items[0].imageUrl);assert.equal(calls,1);
});
test('Expired results refresh; image misses have a short TTL and failed URLs can be excluded',async()=>{
 const f=fixture(),cache=createResponseCache(f.storage);let calls=0;
 const run=async()=>{calls++;return response({imageUrl:''});};
 await cache.respond(request({image:'https://source.test/missing'}),run,f.wait);await f.flush();
 const entry=[...f.records.values()][0];assert(entry.expiresAt-Date.now()<=MISS_TTL*1000);
 await cache.respond(request({image:'https://source.test/missing'}),run,f.wait);assert.equal(calls,1);
 entry.expiresAt=Date.now()-1;
 await cache.respond(request({image:'https://source.test/missing'}),run,f.wait);await f.flush();assert.equal(calls,2);
 await cache.image.set('https://source.test/photo',{imageUrl:'https://img.test/old.jpg'});
 const replacement=await cache.respond(request({image:'https://source.test/photo',exclude:'https://img.test/old.jpg'}),async()=>response({imageUrl:'https://img.test/new.jpg'}),f.wait);await f.flush();
 assert.equal((await replacement.json()).imageUrl,'https://img.test/new.jpg');assert.equal((await cache.image.get('https://source.test/photo')).imageUrl,'https://img.test/new.jpg');
 assert([...f.records.values()].some(x=>x.expiresAt-Date.now()> (IMAGE_TTL-1)*1000));
});
test('Cached category data is provided for safe image resolution without re-fetching feeds',async()=>{
 const f=fixture(),cache=createResponseCache(f.storage),data={topic:'agua',items:[{url:'https://source.test/a',imageUrl:''}]};
 await cache.respond(request(),async()=>response(data),f.wait);await f.flush();
 await cache.respond(request({image:'https://source.test/a'}),async(image,known)=>{assert.deepEqual(known,data);return response({imageUrl:''});},f.wait);await f.flush();
});
test('Cache outages do not break responses; errors and non-GET requests are not cached',async()=>{
 const storage={get:async()=>{throw Error('offline');},set:async()=>{throw Error('offline');}},jobs=[];
 const cache=createResponseCache(storage);assert.equal((await cache.respond(request(),async()=>response({items:[]}),p=>jobs.push(p))).status,200);await Promise.all(jobs);
 const f=fixture(),other=createResponseCache(f.storage);
 await other.respond(request({image:'http://127.0.0.1/'}),async()=>new Response('',{status:404}),f.wait);await f.flush();assert.equal(f.records.size,0);
 await other.respond(new Request(request().url,{method:'POST'}),async()=>new Response('',{status:405}),f.wait);assert.equal(f.records.size,0);
});
test('Browser thumbnail cache survives reloads, expires misses and tolerates blocked storage',()=>{
 let content='',now=1000;const storage={getItem:()=>content,setItem:(k,v)=>{content=v;}};
 const first=createThumbnailCache(storage,()=>now);first.set('good','https://img.test/a.jpg');first.set('missing','');
 const next=createThumbnailCache(storage,()=>now);assert.equal(next.get('good').imageUrl,'https://img.test/a.jpg');assert.equal(next.get('missing').imageUrl,'');
 now+=600001;assert.equal(next.get('missing'),undefined);assert(next.get('good'));
 next.delete('good');assert.equal(createThumbnailCache(storage,()=>now).get('good'),undefined);
 const blocked=createThumbnailCache({getItem(){throw Error();},setItem(){throw Error();}});assert.doesNotThrow(()=>blocked.set('good','https://img.test/a.jpg'));
});

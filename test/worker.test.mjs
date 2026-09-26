import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
test('API: recolha, cache, fallback após falha e expiração sem notícias fictícias',async()=>{
 const originalFetch=globalThis.fetch,originalNow=Date.now;const start=originalNow();let now=start,calls=0,fail=false;
 Date.now=()=>now;
 globalThis.fetch=async()=>{calls++;if(fail)throw new Error('Feed indisponível');return new Response(`<rss version="2.0"><channel><title>Fonte</title><link>https://example.org</link><item><title>Município lança projeto de compostagem e recolha de resíduos</title><link>https://example.org/article</link><pubDate>${new Date(start).toUTCString()}</pubDate></item></channel></rss>`);};
 const ctx={waitUntil:p=>p.catch(()=>{})};const request=()=>new Request('https://prisma.test/api/news?topic=biorresiduos&mode=noticias');
 try{
  let r=await worker.fetch(request(),{},ctx);let d=await r.json();assert.equal(r.status,200);assert.equal(d.items.length,1);assert.equal(calls,8);assert(d.sources.every(s=>s.state==='ok'));
  await worker.fetch(request(),{},ctx);assert.equal(calls,8);
  now+=16*60000;fail=true;r=await worker.fetch(request(),{},ctx);d=await r.json();assert.equal(r.status,200);assert.equal(d.partial,true);assert.equal(d.items.length,1);assert(d.sources.every(s=>s.state==='stale'));
  now+=25*3600000;r=await worker.fetch(request(),{},ctx);d=await r.json();assert.equal(r.status,503);assert.equal(d.items.length,0);
  r=await worker.fetch(new Request('https://prisma.test/api/news?topic=unknown'),{},ctx);assert.equal(r.status,400);
 }finally{globalThis.fetch=originalFetch;Date.now=originalNow;}
});

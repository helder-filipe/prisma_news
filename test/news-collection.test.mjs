import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewsCollection} from '../public/news-collection.js';
const article=(title,lang='pt',extra={})=>({id:title,title,lang,date:'2026-10-08T10:00:00Z',url:'https://publisher.test/'+encodeURIComponent(title),topics:[],...extra});
const response=items=>({items,sources:[],partial:false,checkedAt:'2026-10-08T10:01:00Z'});
test('All is the bilingual union from the first visit, without a shared 180-item cap',async()=>{
 const fixtures={agua:response(Array.from({length:180},(_,i)=>article('Água '+i,i%2?'pt':'en'))),mobilidade:response(Array.from({length:180},(_,i)=>article('Transport '+i,i%2?'pt':'en')))};
 const requests=[];const collection=createNewsCollection(Object.keys(fixtures),{fetchNews:async id=>{requests.push(id);return fixtures[id];}});
 const {data}=await collection.all();assert.equal(data.items.length,360);assert.deepEqual(new Set(requests),new Set(['agua','mobilidade']));
 for(const lang of ['pt','en'])for(const id of Object.keys(fixtures)){
  const category=await collection.topic(id);const union=data.items.filter(n=>n.lang===lang);
  assert(union.length>=category.items.filter(n=>n.lang===lang).length);
  for(const n of category.items.filter(n=>n.lang===lang))assert(union.some(a=>a.title===n.title));
 }
 assert.equal(requests.length,2);
});
test('Duplicates retain a direct link, image and category membership without mixing languages',async()=>{
 const collection=createNewsCollection(['agua','ambiente'],{fetchNews:async id=>response(id==='agua'?[article('Water project','en',{via:'Pesquisa Google Notícias'})]:[article('Water project','en',{via:'RSS direto',imageUrl:'https://img.test/photo.jpg'}),article('Water project','pt')])});
 const {data}=await collection.all();assert.equal(data.items.length,2);const en=data.items.find(n=>n.lang==='en');assert.equal(en.via,'RSS direto');assert.equal(en.imageUrl,'https://img.test/photo.jpg');assert.deepEqual(new Set(en.topics),new Set(['agua','ambiente']));
});
test('Changing category mid-load shares requests and keeps all results in the union',async()=>{
 let release;let calls=0;const gate=new Promise(resolve=>release=resolve);
 const collection=createNewsCollection(['agua','ambiente'],{fetchNews:async id=>{calls++;if(id==='agua')await gate;return response([article(id)]);}});
 const loading=collection.all();const category=collection.topic('agua');release();await category;await loading;
 assert.equal(calls,2);assert.equal(collection.snapshot().items.length,2);
});
test('Refresh replaces successful category results and preserves cached news on failure',async()=>{
 let stage=0;const collection=createNewsCollection(['agua','ambiente'],{fetchNews:async id=>{if(stage&&id==='ambiente')throw Error('Unavailable');return response([article(id+stage)]);}});
 await collection.all();stage=1;const {data,errors}=await collection.all(true);assert.equal(data.partial,true);assert.deepEqual(errors,['ambiente']);assert(data.items.some(n=>n.title==='agua1'));assert(data.items.some(n=>n.title==='ambiente0'));assert(!data.items.some(n=>n.title==='agua0'));
});
test('All reports progressive completion and bounds concurrent category requests',async()=>{
 let active=0,peak=0;const progress=[];const ids=['a','b','c','d','e'];
 const collection=createNewsCollection(ids,{concurrency:2,fetchNews:async id=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,2));active--;return response([article(id)]);}});
 const {data}=await collection.all(false,(snapshot,completed)=>progress.push([snapshot.items.length,completed]));assert.equal(peak,2);assert.equal(data.items.length,5);assert.deepEqual(progress.map(p=>p[1]),[1,2,3,4,5]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {paginate,paginationHTML} from '../public/pagination.js';
import worker from '../dist/server/index.js';
test('902 articles produce 46 pages without gaps or duplicates, with only two on the last page',()=>{
 const items=Array.from({length:902},(_,id)=>({id})),collected=[];
 for(let page=1;page<=46;page++){const view=paginate(items,page);assert.equal(view.pages,46);assert(view.items.length<=20);collected.push(...view.items);}
 assert.deepEqual(collected,items);assert.equal(paginate(items,46).items.length,2);
 assert.equal(paginate(items,99).page,46);assert.equal(paginate([],99).page,1);
 assert.equal(paginate(items.filter(x=>x.id===901),46).page,1);
 const html=paginationHTML(paginate(items,46),true);assert.match(html,/901–902 of 902 articles/);assert.match(html,/aria-current="page"/);assert.match(html,/Next →/);
 assert.match(paginationHTML(paginate(items,1)),/Página 1 de 46/);
});
test('Visible-image mode returns news without crawling images for undisplayed articles',async()=>{
 const saved=globalThis.fetch,calls=[];
 globalThis.fetch=async url=>{calls.push(String(url));return new Response(`<rss><channel><link>https://page-test.test/</link><item><title>Water infrastructure for sustainable cities</title><link>https://page-test.test/article</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`);};
 try{
  const result=await worker.fetch(new Request('https://prisma.test/api/news?topic=agua&images=visible'),{imageCache:{get:async()=>({imageUrl:'https://images.test/cached.jpg'})}},{waitUntil:p=>p.catch(()=>{})});
  const data=await result.json();assert(data.items.length>0);assert.equal(data.items[0].imageUrl,'https://images.test/cached.jpg');assert(!calls.includes('https://page-test.test/article'));
 }finally{globalThis.fetch=saved;}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
test('An article missing from the latest RSS is recovered through an exact publisher search',async()=>{
 const saved=globalThis.fetch,visited=[];
 const google='https://news.google.com/rss/articles/older-water-story';
 const rss=(link,title='Water infrastructure investment',image='')=>`<rss><channel><link>https://publisher-search.test/</link><item><title>${title}</title><link>${link}</link><pubDate>${new Date().toUTCString()}</pubDate><source url="https://publisher-search.test/">Publisher</source>${image?`<featured_image>${image}</featured_image>`:''}</item></channel></rss>`;
 globalThis.fetch=async input=>{
  const url=new URL(String(input));visited.push(url.href);
  if(url.hostname!=='publisher-search.test')return new Response(rss(google));
  if(url.pathname==='/feed/')return new Response(rss('https://publisher-search.test/unrelated','Another water infrastructure article'));
  if(url.searchParams.get('feed')==='rss2')return new Response(rss('https://publisher-search.test/original',undefined,'https://images.test/exact.jpg'));
  return new Response('<html><script src="/wp-includes/script.js"></script></html>');
 };
 try{
  const response=await worker.fetch(new Request('https://prisma.test/api/news?'+new URLSearchParams({topic:'agua',image:google})),{},{waitUntil:p=>p.catch(()=>{})});
  assert.equal((await response.json()).imageUrl,'https://images.test/exact.jpg');
  assert(visited.some(url=>url.includes('feed=rss2')));
 }finally{globalThis.fetch=saved;}
});

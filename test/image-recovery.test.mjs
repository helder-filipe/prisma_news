import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {pageImage,rssLinks} from '../src/images.js';
test('Broken preview image is excluded in favour of another publisher candidate',()=>{
 const html='<meta property="og:image" content="https://img.test/broken.jpg"><meta name="twitter:image" content="https://img.test/good.jpg">';
 assert.equal(pageImage(html,'https://publisher.test',['https://img.test/broken.jpg']),'https://img.test/good.jpg');
 assert.deepEqual(rssLinks('<link rel="alternate" type="application/rss+xml" href="/rss.xml">','https://publisher.test'),['https://publisher.test/rss.xml']);
});
test('Google article recovers exact publisher RSS image; arbitrary URLs are never fetched',async()=>{
 const original=globalThis.fetch,visited=[];
 const article='https://news.google.com/rss/articles/test-recovery';
 const rss=(link,extra='')=>`<rss><channel><link>https://recovery-publisher.test</link><item><title>Water infrastructure recovery</title><link>${link}</link><pubDate>${new Date().toUTCString()}</pubDate><source url="https://recovery-publisher.test">Recovery</source>${extra}</item></channel></rss>`;
 globalThis.fetch=async url=>{visited.push(String(url));if(String(url)==='https://recovery-publisher.test/feed/')return new Response(rss('https://recovery-publisher.test/story','<featured_image>https://img.test/recovered.jpg</featured_image>'));return new Response(rss(article));};
 const request=image=>worker.fetch(new Request('https://prisma.test/api/news?'+new URLSearchParams({topic:'agua',image})),{},{waitUntil:p=>p.catch(()=>{})});
 try{
  const response=await request(article);assert.equal(response.status,200);assert.equal((await response.json()).imageUrl,'https://img.test/recovered.jpg');
  const invalid=await request('http://127.0.0.1/private');assert.equal(invalid.status,404);assert(!visited.some(url=>url.includes('127.0.0.1')));
 }finally{globalThis.fetch=original;}
});

test('Publisher headline lookup accepts the exact article only',async()=>{
 const {headlineLink}=await import('../src/images.js');
 const html='<a href="/wrong">Water infrastructure recovery elsewhere</a><a href="https://other.test/story">Water infrastructure recovery</a><a href="/right"><strong>Water infrastructure</strong> recovery</a>';
 assert.equal(headlineLink(html,'https://publisher.test','Water infrastructure recovery'),'https://publisher.test/right');
 assert.equal(headlineLink(html,'https://publisher.test','A different water infrastructure story'),'');
});

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

test('Google intermediary is decoded before the publisher photo is extracted',async()=>{
 const saved=globalThis.fetch,visited=[];
 const google='https://news.google.com/rss/articles/CBMidecodeWorkerStory123456';
 const original='https://decoded-publisher.test/story';
 const article={url:google,title:'Water infrastructure decoded',source:'Publisher',sourceURL:'https://decoded-publisher.test/',lang:'en',imageUrl:''};
 globalThis.fetch=async(input,options={})=>{
  const url=String(input);visited.push(url);
  if(url.includes('/batchexecute'))return new Response(")]}'\n\n"+JSON.stringify([['wrb.fr','Fbv4je',JSON.stringify(['garturlres',original])]]));
  if(url.startsWith('https://news.google.com/rss/articles/'))return new Response('x'.repeat(600000)+'<div data-n-a-ts="1792787510" data-n-a-sg="sig"></div>');
  if(url===original)return new Response('<meta property="og:image" content="/original-photo.jpg">',{headers:{'Content-Type':'text/html'}});
  throw Error('Unexpected network request: '+url);
 };
 try{
  const result=await worker.fetch(new Request('https://prisma.test/api/news?'+new URLSearchParams({topic:'agua',image:google})),{cachedNews:{topic:'agua',items:[article]}},{waitUntil:()=>{}});
  assert.equal((await result.json()).imageUrl,'https://decoded-publisher.test/original-photo.jpg');
  assert.equal(visited.length,3);assert(!visited.some(x=>x.includes('/feed/')));
 }finally{globalThis.fetch=saved;}
});

test('A decoded publisher URL cannot make the worker fetch loopback addresses',async()=>{
 const saved=globalThis.fetch,visited=[];
 const google='https://news.google.com/rss/articles/CBMidecodePrivateStory123456';
 const article={url:google,title:'Water infrastructure',source:'Publisher',sourceURL:'',lang:'en',imageUrl:''};
 globalThis.fetch=async input=>{
  const url=String(input);visited.push(url);
  if(url.includes('/batchexecute'))return new Response(JSON.stringify([['wrb.fr','Fbv4je',JSON.stringify(['garturlres','http://[::1]/private'])]]));
  return new Response('<div data-n-a-ts="1792787510" data-n-a-sg="sig"></div>');
 };
 try{
  const result=await worker.fetch(new Request('https://prisma.test/api/news?'+new URLSearchParams({topic:'agua',image:google})),{cachedNews:{topic:'agua',items:[article]}},{waitUntil:()=>{}});
  assert.equal((await result.json()).imageUrl,'');assert(!visited.some(x=>x.includes('[::1]')));
 }finally{globalThis.fetch=saved;}
});

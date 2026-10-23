import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleNewsResolver,googleArticleId,googleDecodedURL,googleDecodeBody} from '../src/google-news.js';
const id='CBMirealisticEncodedArticle1234567890';
const article='https://news.google.com/rss/articles/'+id+'?oc=5';
const publisher='https://publisher.test/story?a=1&b=2';
const rpc=url=>")]}'\n\n123\n"+JSON.stringify([['di',18],['wrb.fr','Other',null],['wrb.fr','Fbv4je',JSON.stringify(['garturlres',url,1]),null,null,null,'generic'],['af.httprm',17]]);
test('Google decoder parses RPC frames and escaped publisher URLs, not splash metadata',()=>{
 assert.equal(googleArticleId(article),id);
 assert.equal(googleArticleId('https://evil.test/rss/articles/'+id),'');
 assert.equal(googleDecodedURL(rpc(publisher)),publisher);
 assert.equal(googleDecodedURL(rpc('javascript:alert(1)')),'');
 assert.equal(googleDecodedURL(JSON.stringify([['wrb.fr','Fbv4je',null]])),'');
 const body=JSON.parse(new URLSearchParams(googleDecodeBody(id,{signature:'signature',timestamp:1792787510})).get('f.req'));
 assert.equal(body[0][0][0],'Fbv4je');assert.deepEqual(JSON.parse(body[0][0][1]).slice(2),[id,1792787510,'signature']);
});
test('Realistic RSS splash resolves the original article and shares concurrent requests',async()=>{
 const visited=[];
 const resolve=createGoogleNewsResolver({fetcher:async(url,options)=>{
  visited.push({url,options});
  if(options.method==='POST')return new Response(rpc(publisher));
  // Google's parameters occur after the old 500 KB page-read limit.
  return new Response('x'.repeat(600000)+'<div data-n-a-ts="1792787510" data-n-a-sg="signature"></div>');
 }});
 const values=await Promise.all([resolve(article),resolve(article)]);
 assert.deepEqual(values,[publisher,publisher]);assert.equal(visited.length,2);
 assert(visited[0].url.startsWith('https://news.google.com/rss/articles/'));
 assert.equal(visited[1].options.method,'POST');assert.equal(visited[1].options.redirect,'manual');
 assert.equal(await resolve(article),publisher);assert.equal(visited.length,2);
});
test('Consent/challenge redirects and unavailable parameters stop safely without persistent misses',async()=>{
 let calls=0,stage=0;
 const resolve=createGoogleNewsResolver({fetcher:async()=>{calls++;return stage++===0?new Response(null,{status:302,headers:{Location:'https://www.google.com/sorry/'}}):new Response('<html>No decoding parameters</html>');}});
 assert.equal(await resolve(article),'');assert.equal(calls,1);
 assert.equal(await resolve(article),'');assert.equal(calls,2);
});
test('Legacy IDs containing the original URL do not need network requests',async()=>{
 const url='https://publisher.test/'+'x'.repeat(140);
 const bytes=Buffer.from(url);const encoded=Buffer.concat([Buffer.from([8,19,34,bytes.length|128,bytes.length>>7]),bytes,Buffer.from([210,1,0])]).toString('base64url');
 const resolve=createGoogleNewsResolver({fetcher:async()=>{throw Error('Unexpected request');}});
 assert.equal(await resolve('https://news.google.com/rss/articles/'+encoded),url);
});

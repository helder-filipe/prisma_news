import test from 'node:test';
import assert from 'node:assert/strict';
import {feedImage,pageImage} from '../src/images.js';
const base='https://publisher.example/news/article';
test('Publisher featured images, lazy images and responsive images are preserved',()=>{
 assert.equal(feedImage({featured_image:'https://cdn.example/photo.jpg'},base),'https://cdn.example/photo.jpg');
 assert.equal(feedImage({description:'<img src="data:image/gif;base64,AA" data-src="/photo.jpg">'},base),'https://publisher.example/photo.jpg');
 assert.equal(feedImage({description:'<img src="/small.jpg" srcset="/small.jpg 160w, /medium.jpg 800w, /large.jpg 1600w">'},base),'https://publisher.example/medium.jpg');
 assert.equal(feedImage({description:'<picture><source data-lazy-srcset="/photo-small.jpg 320w, /photo-large.jpg 1200w"></picture>'},base),'https://publisher.example/photo-large.jpg');
 assert.equal(feedImage({'media:group':{'media:content':[{'@_url':'https://cdn.example/small.jpg','@_width':120},{'@_url':'https://cdn.example/large.jpg','@_width':1000}]}},base),'https://cdn.example/large.jpg');
});
test('Audio enclosures and tracking pixels are not article photographs',()=>{
 assert.equal(feedImage({enclosure:{'@_url':'https://cdn.example/audio.mp3','@_type':'audio/mpeg'}},base),'');
 assert.equal(feedImage({description:'<img width="1" height="1" src="/tracker.gif"><img src="/photo.jpg">'},base),'https://publisher.example/photo.jpg');
 assert.equal(feedImage({featured_image:'javascript:alert(1)'},base),'');
 assert.equal(feedImage({featured_image:'https://cdn.example/logo.png',description:'<img src="/story-photo.jpg">'},base),'https://publisher.example/story-photo.jpg');
});
test('Preview metadata supports relative URLs, unquoted attributes and numeric entities',()=>{
 assert.equal(pageImage('<meta content="/photo.jpg?a=1&#38;b=2" property=og:image>',base),'https://publisher.example/photo.jpg?a=1&b=2');
 assert.equal(pageImage('<meta name="twitter:image" content="//cdn.example/photo.jpg">',base),'https://cdn.example/photo.jpg');
});
test('Article structured data and lazy article images provide fallbacks without publisher logos',()=>{
 const data={'@graph':[{'@type':'Organization',logo:'https://cdn.example/logo.png'},{'@type':'NewsArticle',image:[{'@type':'ImageObject',contentUrl:'https://cdn.example/article.jpg'}]}]};
 assert.equal(pageImage(\`<script type="application/ld+json">\${JSON.stringify(data)}</script>\`,base),'https://cdn.example/article.jpg');
 assert.equal(pageImage('<header><img src="/logo.png"></header><article><img data-lazy-src="/story.jpg"></article>',base),'https://publisher.example/story.jpg');
 assert.equal(pageImage('<header><img src="/logo.png"></header>',base),'');
 assert.equal(pageImage('<meta property="og:image" content="javascript:alert(1)">',base),'');
});
test('A main lead image is found when the publisher does not use an article element',()=>{
 const html='<header><img src="/brand-logo.png"></header><main><div class="story"><picture><source data-srcset="/lead-small.jpg 320w, /lead-large.jpg 1200w"></picture></div></main>';
 assert.equal(pageImage(html,base),'https://publisher.example/lead-large.jpg');
});
test('Decorative metadata is skipped in favour of a real preview image',()=>{
 const html='<meta property="og:image" content="https://cdn.example/placeholder.jpg"><meta name="twitter:image" content="https://cdn.example/story-photo.jpg"><meta name="twitter:image:width" content="1200">';
 assert.equal(pageImage(html,base),'https://cdn.example/story-photo.jpg');
});
test('Image lookup covers more than the former 16-article limit',async()=>{
 const {default:worker}=await import('../dist/server/index.js');
 const originalFetch=globalThis.fetch;let lookups=0;
 globalThis.fetch=async(url,options={})=>{
  if(String(options.headers?.Accept||'').startsWith('text/html')){lookups++;return new Response('<meta property="og:image" content="https://cdn.example/article.jpg">',{headers:{'Content-Type':'text/html'}});}
  const items=Array.from({length:24},(_,i)=>\`<item><title>Water infrastructure project \${i}</title><link>https://publisher.example/news/\${i}</link><pubDate>\${new Date().toUTCString()}</pubDate></item>\`).join('');
  return new Response(\`<rss><channel><link>https://publisher.example</link>\${items}</channel></rss>\`);
 };
 try{
  const response=await worker.fetch(new Request('https://prisma.test/api/news?topic=tudo'),{},{waitUntil:p=>p.catch(()=>{})});
  const data=await response.json();assert.equal(data.items.length,24);assert.equal(lookups,24);assert(data.items.every(item=>item.imageUrl==='https://cdn.example/article.jpg'));
 }finally{globalThis.fetch=originalFetch;}
});

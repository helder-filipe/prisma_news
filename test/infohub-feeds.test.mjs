import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFeed} from '../src/feed.js';
import {feedImage} from '../src/images.js';
import {TOPICS} from '../src/topics.js';
const def={name:'Fonte',kind:'direct',lang:'pt'};
test('Large valid publisher RSS feeds retain topic articles and their photographs',()=>{
 const xml=`<rss><channel><link>https://publisher.test/</link><!--${'x'.repeat(2_100_000)}--><item><title>Município melhora gestão da água</title><link>https://publisher.test/story</link><pubDate>${new Date().toUTCString()}</pubDate><enclosure type="image/jpeg" url="https://images.test/dynamic?width=640&amp;quality=80" /></item></channel></rss>`;
 const items=parseFeed(xml,def,TOPICS[0]);assert.equal(items.length,1);assert.equal(items[0].imageUrl,'https://images.test/dynamic?width=640&quality=80');
});
test('Atom alternate article links and image enclosures are read with dates and filters intact',()=>{
 const xml=`<feed xmlns="http://www.w3.org/2005/Atom"><link href="https://publisher.test/"/><entry><title>Município melhora gestão da água</title><link rel="self" href="https://publisher.test/api/story"/><link rel="alternate" href="https://publisher.test/story"/><link rel="enclosure" type="image/jpeg" href="https://images.test/photo.jpg"/><updated>${new Date().toISOString()}</updated><summary>Projeto de abastecimento de água.</summary></entry></feed>`;
 const [item]=parseFeed(xml,def,TOPICS[0]);assert.equal(item.url,'https://publisher.test/story');assert.equal(item.imageUrl,'https://images.test/photo.jpg');assert.equal(item.sourceURL,'https://publisher.test/');
 assert.equal(parseFeed(xml,def,TOPICS.find(x=>x.id==='normas')).length,0);
});
test('Publisher image enclosures take precedence and photo links provide a final fallback',()=>{
 assert.equal(feedImage({description:'<img src="https://images.test/small.jpg">',enclosure:{'@_type':'image/jpeg','@_url':'https://images.test/main.jpg'}},'https://publisher.test'),'https://images.test/main.jpg');
 assert.equal(feedImage({description:'<a href="/photo.webp">Photo</a>'},'https://publisher.test/story'),'https://publisher.test/photo.webp');
 assert.equal(feedImage({description:'<a href="/audio.mp3">Audio</a>'},'https://publisher.test/story'),'');
});

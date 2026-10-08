import test from 'node:test';
import assert from 'node:assert/strict';
import {createImageRecovery} from '../public/image-recovery.js';

for(const recovered of ['', 'https://images.test/alternative.jpg'])test(`A late recovery result (${recovered?'alternative':'empty'}) preserves a newly loaded image`,async()=>{
 const saved={fetch:globalThis.fetch,IntersectionObserver:globalThis.IntersectionObserver,innerHeight:globalThis.innerHeight};
 let notify,resolve;const classes=new Set(['is-fallback']);
 const slot={dataset:{articleUrl:'https://publisher.test/article',imageTopic:'agua',fallback:'Sem imagem'},img:null,isConnected:true,
  classList:{remove(...xs){xs.forEach(x=>classes.delete(x));},add(...xs){xs.forEach(x=>classes.add(x));}},
  querySelector(selector){return selector==='img'?this.img:{textContent:''};},getBoundingClientRect(){return {top:0,bottom:100};}};
 globalThis.innerHeight=800;
 globalThis.IntersectionObserver=class{constructor(fn){notify=fn;}observe(){}unobserve(){}disconnect(){}};
 globalThis.fetch=()=>new Promise(r=>{resolve=r;});
 try{
  const recovery=createImageRecovery({querySelectorAll:()=>[slot]},()=>{});
  recovery.observe();notify([{isIntersecting:true,target:slot}]);
  // A progressive category update has now supplied and loaded a valid photo.
  const working={src:'https://images.test/working.jpg'};slot.img=working;classes.clear();classes.add('has-image');
  resolve(new Response(JSON.stringify({imageUrl:recovered})));
  await new Promise(r=>setTimeout(r,0));
  assert.equal(slot.img,working);assert(classes.has('has-image'));assert(!classes.has('is-fallback'));
 }finally{for(const [key,value] of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

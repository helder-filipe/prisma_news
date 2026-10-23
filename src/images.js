// Image candidates supplied by the publisher; never substitute unrelated photos.
const valueText=v=>typeof v==='string'?v:v&&typeof v==='object'?String(v['#text']||''):'';
function decode(value){return String(value||'').replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:x[0-9a-f]+|\d+);/gi,m=>{
 const named={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '};
 if(named[m.toLowerCase()])return named[m.toLowerCase()];
 const n=m[2].toLowerCase()==='x'?parseInt(m.slice(3,-1),16):parseInt(m.slice(2,-1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';
});}
function imageURL(value,base){try{const s=decode(valueText(value)).trim();if(!s||/^data:/i.test(s))return '';const u=new URL(s,base);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function attrs(tag){const result={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))result[m[1].toLowerCase()]=decode(m[2]??m[3]??m[4]);return result;}
function srcset(value,base){
 const candidates=String(value||'').split(',').map(entry=>{const [url,size]=entry.trim().split(/\s+/);return {url:imageURL(url,base),size:parseFloat(size)||1};}).filter(x=>x.url).sort((a,b)=>a.size-b.size);
 return (candidates.find(x=>x.size>=640)||candidates.at(-1))?.url||'';
}
const decorativeImage=/\b(?:logo|icon|avatar|tracking|pixel|placeholder|spacer|blank|no[-_ ]?image|default[-_ ]?image)\b/i;
function isDecorative(value){return decorativeImage.test(String(value||''));}
function htmlImage(html,base){
 for(const tag of html.match(/<(?:img|source)\b[^>]*>/gi)||[]){const a=attrs(tag),identity=[a.class,a.id,a.src,a['data-src'],a.alt,a.title].join(' ');
  if(isDecorative(identity))continue;
  if((a.width&&parseFloat(a.width)<40)||(a.height&&parseFloat(a.height)<40))continue;
  const candidate=srcset(a['data-lazy-srcset']||a['data-srcset']||a['data-original-srcset']||a.srcset,base)
   ||imageURL(a['data-src']||a['data-lazy-src']||a['data-original']||a['data-original-src']||a['data-url']||a.src,base);
  if(candidate&&!isDecorative(candidate))return candidate;
 }
 return '';
}
export function feedImage(row,base){
 const featured=imageURL(row.featured_image||row['featured-image']||row['post-thumbnail'],base);
 if(featured&&!isDecorative(featured))return featured;
 const html=[valueText(row['content:encoded']),valueText(row.description),valueText(row.summary),valueText(row.content)].join(' ');
 const candidates=[];
 function visit(value){
  if(Array.isArray(value)){value.forEach(visit);return;}
  if(typeof value==='string'){const url=imageURL(value,base);if(url&&!isDecorative(url))candidates.push({url,width:0});return;}
  if(!value||typeof value!=='object')return;
  const type=value['@_type']||'',medium=value['@_medium'];
  if(type&&!type.startsWith('image/')||medium&&medium!=='image')return;
  if(value['@_width']&&Number(value['@_width'])<40||value['@_height']&&Number(value['@_height'])<40)return;
  const url=imageURL(value['@_url']||value['@_href']||value.url||valueText(value),base);
  if(url&&!isDecorative(url)&&!/\.(mp3|mp4|pdf|m4a|webm)(?:[?#]|$)/i.test(url))candidates.push({url,width:Number(value['@_width'])||0});
  for(const [key,child] of Object.entries(value))if(/^(?:(?:media:)?(?:thumbnail|enclosure|image|content|group)|itunes:image)$/i.test(key)&&!key.startsWith('@_'))visit(child);
 }
 for(const key of ['media:group','media:content','enclosure'])visit(row[key]);
 const media=candidates.sort((a,b)=>b.width-a.width)[0]?.url;
 if(media)return media;
 const inline=htmlImage(html,base);if(inline)return inline;
 for(const key of ['media:thumbnail','itunes:image','image'])visit(row[key]);
 const thumbnail=candidates.sort((a,b)=>b.width-a.width)[0]?.url;if(thumbnail)return thumbnail;
 // Some feeds link to the original photograph instead of embedding an img tag.
 for(const tag of html.match(/<a\b[^>]*>/gi)||[]){const url=imageURL(attrs(tag).href,base);if(/\.(?:jpe?g|png|webp|gif)(?:[?#]|$)/i.test(url)&&!isDecorative(url))return url;}
 return '';
}
export function pageImage(html,base,excluded=[]){
 const candidate=value=>{const url=imageURL(value,base);return !url||excluded.includes(url)||isDecorative(url)?'':url;};
 const metas=(html.match(/<meta\b[^>]*>/gi)||[]).map(attrs);
 const dimensions=new Map();
 for(const a of metas){const key=(a.property||a.name||'').toLowerCase();if(key==='og:image:width'||key==='twitter:image:width')dimensions.set(key.split(':')[0],Number(a.content)||0);}
 const metaImages=[];
 const metaKeys={'og:image:secure_url':100,'og:image':95,'og:image:url':90,'twitter:image':85,'twitter:image:src':80};
 for(const a of metas){
  const key=(a.property||a.name||'').toLowerCase(),score=metaKeys[key];if(score===undefined)continue;
  const width=Number(a.width||dimensions.get(key.startsWith('og:')?'og':'twitter'))||0;
  const height=Number(a.height)||0;if(width&&width<120||height&&height<80)continue;
  const url=candidate(a.content);if(url)metaImages.push({url,score:score+Math.min(width,2400)/1000});
 }
 if(metaImages.length)return metaImages.sort((a,b)=>b.score-a.score)[0].url;
 function imageValue(value){
  if(Array.isArray(value)){for(const v of value){const found=imageValue(v);if(found)return found;}return '';}
  if(value&&typeof value==='object')return candidate(value.contentUrl||value.url||value['@id']);
  return candidate(value);
 }
 function articleImage(node){
  if(Array.isArray(node)){for(const n of node){const found=articleImage(n);if(found)return found;}return '';}
  if(!node||typeof node!=='object')return '';
  if(/Article|BlogPosting|Report/i.test([node['@type']].flat().join(' '))){const found=imageValue(node.image)||imageValue(node.thumbnailUrl);if(found)return found;}
  return articleImage(node['@graph'])||articleImage(node.mainEntity)||articleImage(node.mainEntityOfPage);
 }
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(attrs(match[1]).type?.toLowerCase()!=='application/ld+json')continue;
  try{const found=articleImage(JSON.parse(match[2]));if(found)return found;}catch{}
 }
 for(const tag of html.match(/<link\b[^>]*>/gi)||[]){const a=attrs(tag);if(a.rel?.toLowerCase().split(/\s+/).includes('image_src')){const url=candidate(a.href);if(url)return url;}}
 // Publishers often put the lead photo inside main or a post-body container instead of <article>.
 const article=html.match(/<article\b[^>]*>([\s\S]*?)(?:<\/article>|$)/i)?.[1]
  ||html.match(/<main\b[^>]*>([\s\S]*?)(?:<\/main>|$)/i)?.[1]
  ||html.match(/<(?:div|section)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:article-body|entry-content|post-content|story-body)[^"']*["'][^>]*>([\s\S]*?)(?:<\/(?:div|section)>|$)/i)?.[1];
 const found=article?htmlImage(article,base):'';return candidate(found);
}
export function rssLinks(html,base){
 return (html.match(/<link\b[^>]*>/gi)||[]).map(attrs).filter(a=>a.rel?.split(/\s+/).includes('alternate')&&/application\/(?:rss\+xml|xml)/i.test(a.type||'')).map(a=>imageURL(a.href,base)).filter(Boolean);
}
// Follow only links whose headline exactly identifies the requested article.
export function headlineLink(html,base,title){
 const key=value=>decode(value).replace(/<[^>]*>/g,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const expected=key(title);if(expected.length<15)return '';
 for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const a=attrs(m[1]);if(![m[2],a.title||'',a['aria-label']||''].some(value=>key(value)===expected))continue;
  const url=imageURL(a.href,base);if(url&&new URL(url).hostname===new URL(base).hostname)return url;
 }
 return '';
}

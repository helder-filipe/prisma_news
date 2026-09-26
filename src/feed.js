import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {francAll} from 'franc-min';
import {TOPICS,isCertifiedStandardsOnly} from './topics.js';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',parseTagValue:false,trimValues:true,processEntities:true});
export const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const text=x=>typeof x==='string'?x:x&&typeof x==='object'?String(x['#text']||''):'';
export function plain(value){return text(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,m=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}[m])).replace(/\s+/g,' ').trim();}
export function safeURL(value){try{const u=new URL(text(value));return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function imageFromRow(row){
 const html=[text(row['content:encoded']),text(row.description)].join(' ');
 const htmlImage=html.match(/<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2]?.replace(/&amp;/g,'&');
 const visit=value=>{
  if(Array.isArray(value)){for(const item of value){const found=visit(item);if(found)return found;}return '';}
  if(!value||typeof value!=='object')return '';
  for(const key of ['@_url','@_href','@_src','url','href','src']){const found=safeURL(value[key]);if(found)return found;}
  for(const [key,child] of Object.entries(value)){if(/media|thumbnail|enclosure|image|content/i.test(key)){const found=visit(child);if(found)return found;}}
  return '';
 };
 return safeURL(htmlImage)||visit(row['media:thumbnail'])||visit(row['media:content'])||visit(row.enclosure)||visit(row['itunes:image'])||visit(row.image);
}
export function languageOf(title,fallback){
 const normalized=normalize(title);
 const ptWords=normalized.match(/\b(recolha|compostagem|residuos|biorresiduos|gestao|municipio|portugues|portuguesa|projeto|sustentabilidade|abastecimento|autarquia|espacos|arborizacao|mobilidade|agua|aguas|lanca|para|dos|das|nao|uma)\b/g)||[];
 const enWords=normalized.match(/\b(the|and|with|for|from|will|new|waste|water|green|climate|city|cities|recycling)\b/g)||[];
 if(ptWords.length>=2&&ptWords.length>enWords.length)return {lang:'pt',languageMethod:'title'};
 const candidates=francAll(title,{minLength:30,only:['por','eng','spa','fra','deu','ita','nld']});
 const map={por:'pt',eng:'en',spa:'es',fra:'fr',deu:'de',ita:'it',nld:'nl'};
 const best=candidates[0], second=candidates[1];
 if(best&&map[best[0]]&&(!second||best[1]-second[1]>.04))return {lang:map[best[0]],languageMethod:'title'};
 return {lang:fallback,languageMethod:'feed'};
}
const practicePattern=/projeto|project|iniciativa|initiative|pilot|solucao|solution|case stud|boas praticas|best practice|inovacao|innovation|implement|lanc|launch|roll.out|transform|reutiliz|reuse|compost|recolha|collection/;
export function classify(title,description){const content=normalize(title+' '+description);return TOPICS.filter(t=>t.match&&new RegExp(t.match).test(content)&&(!t.sector||new RegExp(t.sector).test(content))&&(t.id!=='normas'||isCertifiedStandardsOnly(title+' '+description))).map(t=>t.id);}
const jobAdTitle=/\b(job|jobs|vacancy|vacancies|career|careers|hiring|recruitment|recruiting|employment opportunity|apply now|we are hiring|oferta de emprego|ofertas de emprego|anuncio de emprego|anúncio de emprego|recrutamento|recruta-se|estamos a contratar|vaga para|vagas para|candidate-se|candidaturas abertas)\b/i;
const jobAdCall=/\b(submeta|envie|enviar) (a sua )?candidatura\b|\bapply (now|today)\b|\bsend your (cv|resume)\b|\bsubmit your (application|cv)\b|\bjob description\b/i;
const jobBoardDomains=['net-empregos.com','expressoemprego.pt','empregosonline.pt','empregos.pt','careerjet.pt','indeed.com','indeed.pt','glassdoor.com','jooble.org','talent.com','monster.com','infojobs.net','jobrapido.com','jobsora.com'];
function isJobBoard(url,source=''){
 try{
  const parsed=new URL(url);const host=parsed.hostname.toLowerCase();
  if(jobBoardDomains.some(domain=>host===domain||host.endsWith('.'+domain)))return true;
  if((host==='sapo.pt'||host.endsWith('.sapo.pt'))&&(/^(?:emprego|empregos)\./i.test(host)||/(^|\/)(emprego|empregos|recrutamento|ofertas-de-emprego)(\/|$)/i.test(parsed.pathname)))return true;
  if(host==='linkedin.com'||host.endsWith('.linkedin.com'))return /\/jobs(?:\/|$)/i.test(parsed.pathname);
 }catch{}
 return /net[ -]?empregos|sapo[ -]?empregos|expresso[ -]?emprego|indeed|glassdoor|jooble|careerjet/i.test(source);
}
export function isJobAdvertisement(title,description='',url='',source='',sourceURL=''){return isJobBoard(url,source)||isJobBoard(sourceURL,source)||jobAdTitle.test(title)||jobAdCall.test(description)&&/\b(vaga|emprego|job|career|recruit|candidatur|application|cv|resume)\b/i.test(title+' '+description);}
export function parseFeed(xml,def,topic,mode,now=Date.now()){
 if(xml.length>2_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Formato RSS não permitido');
 if(XMLValidator.validate(xml)!==true)throw new Error('RSS inválido');
 const doc=parser.parse(xml);const channel=doc.rss?.channel;if(!channel)throw new Error('O endereço não devolveu um feed RSS');
 let rows=channel.item||[];if(!Array.isArray(rows))rows=[rows];
 const articles=[];const maxAge=(mode==='praticas'?365:30)*86400000;
 for(const row of rows.slice(0,100)){
  const source=plain(row.source)||def.name;let title=plain(row.title);
  if(title.endsWith(' - '+source))title=title.slice(0,-source.length-3);
  const url=safeURL(row.link);const ms=Date.parse(text(row.pubDate));
  const sourceURL=safeURL(row.source?.['@_url'])||safeURL(channel.link);
  if(!title||!url||!Number.isFinite(ms)||ms>now+3600000||now-ms>maxAge)continue;
  const rawDescription=plain(row.description);
  // Google descriptions repeat headlines and source links; they are not article summaries.
  const description=def.kind==='aggregator'?'':rawDescription.slice(0,270).replace(/\s+\S*$/,'')+(rawDescription.length>270?'…':'');
  const content=normalize(title+' '+description);
  if(isJobAdvertisement(title,rawDescription,url,source,sourceURL))continue;
  if(topic.id==='normas'&&!isCertifiedStandardsOnly(title+' '+rawDescription))continue;
  if(topic.id==='tudo'?!classify(title,description).length:topic.match&&!new RegExp(topic.match).test(content))continue;
  if(topic.sector&&!new RegExp(topic.sector).test(content))continue;
  if(mode==='praticas'&&!def.practice&&!practicePattern.test(content))continue;
  const language=languageOf(title,def.lang);
  const host=sourceURL?new URL(sourceURL).hostname:'';
  const imageUrl=imageFromRow(row);
  articles.push({id:url,title,description,url,source,sourceURL,date:new Date(ms).toISOString(),...language,imageUrl,country:host.endsWith('.pt')||def.id==='ambiente-magazine'?'PT':null,topics:classify(title,description),kind:mode==='praticas'?'praticas':'noticias',via:def.kind==='aggregator'?'Pesquisa Google Notícias':'RSS direto'});
 }
 return articles;
}
export function mergeArticles(groups){const byTitle=new Map();for(const article of groups.flat()){const key=normalize(article.title).replace(/[^a-z0-9]/g,'');const prev=byTitle.get(key);if(!prev){byTitle.set(key,article);continue;}const merged={...(article.via==='RSS direto'?article:prev),imageUrl:article.imageUrl||prev.imageUrl||'',topics:[...new Set([...prev.topics,...article.topics])]};byTitle.set(key,merged);}return [...byTitle.values()].sort((a,b)=>b.date.localeCompare(a.date));}

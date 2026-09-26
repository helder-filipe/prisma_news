import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFeed,mergeArticles,languageOf,safeURL} from '../src/feed.js';
import {TOPICS,feedDefinitions} from '../src/topics.js';
const topic=TOPICS.find(t=>t.id==='biorresiduos');
const def={name:'Fonte',kind:'aggregator',lang:'en',id:'test'};
const rss=(title,link='https://example.org/news',date=new Date().toUTCString(),extra='')=>`<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title><link>https://example.org</link><item><title>${title}</title><link>${link}</link><pubDate>${date}</pubDate><source url="https://example.org">Fonte</source>${extra}</item></channel></rss>`;
test('Deteta português e inglês pelo título e usa o idioma do feed quando é curto',()=>{assert.equal(languageOf('Município português lança projeto de recolha de resíduos alimentares para compostagem','en').lang,'pt');assert.equal(languageOf('New food waste collection programme will bring composting to thousands of households','pt').lang,'en');assert.equal(languageOf('Lisboa','pt').languageMethod,'feed');});
test('RSS trata CDATA, entidades e um único item; não usa descrição Google como resumo',()=>{const [n]=parseFeed(rss('<![CDATA[Recolha & compostagem - Fonte]]>','https://example.org/a?x=1&amp;y=2',new Date().toUTCString(),'<description>&lt;a href="x"&gt;Recolha&lt;/a&gt;</description>'),def,topic,'noticias');assert.equal(n.title,'Recolha & compostagem');assert.equal(n.description,'');assert.equal(n.url,'https://example.org/a?x=1&y=2');assert(n.topics.includes('biorresiduos'));});
test('Rejeita URLs executáveis, datas inválidas, antigas e futuras',()=>{assert.equal(safeURL('javascript:alert(1)'),'');assert.equal(safeURL('https://user:pass@example.org'),'');for(const [url,date] of [['javascript:alert(1)',new Date().toUTCString()],['https://example.org','invalid'],['https://example.org','Sat, 01 Jan 2000 00:00:00 GMT'],['https://example.org',new Date(Date.now()+86400000).toUTCString()]])assert.equal(parseFeed(rss('Teste',url,date),def,topic,'noticias').length,0);});
test('Janela anual de projetos não contamina a atualidade',()=>{const xml=rss('Projeto de compostagem','https://example.org',new Date(Date.now()-100*86400000).toUTCString());assert.equal(parseFeed(xml,def,topic,'noticias').length,0);assert.equal(parseFeed(xml,{...def,practice:true},topic,'praticas').length,1);});
test('RSS direto só entra no tema correspondente',()=>{assert.equal(parseFeed(rss('Ações do mercado tecnológico sobem'),{...def,kind:'direct'},topic,'noticias').length,0);});
test('Categorias filtram resultados genéricos e removem anúncios de emprego',()=>{
 const landscape=TOPICS.find(t=>t.id==='arquitetura-paisagistica');
 assert.equal(parseFeed(rss('Empresa procura arquiteto paisagista — candidate-se já'),def,landscape,'noticias').length,0);
 assert.equal(parseFeed(rss('A cidade apresenta um novo orçamento municipal'),def,TOPICS.find(t=>t.id==='urbanismo'),'noticias').length,0);
 assert.equal(parseFeed(rss('Projeto de desenho da paisagem restaura corredor ecológico'),def,landscape,'noticias').length,1);
});
test('Extrai miniaturas RSS e imagens do excerto, mantendo URLs seguras',()=>{
 const extra='<media:thumbnail url="https://images.example.org/thumb.jpg"/><description><![CDATA[<p>Detalhe <img src="https://images.example.org/article.jpg" /></p>]]></description>';
 const [a]=parseFeed(rss('Recolha de resíduos alimentares para compostagem','https://example.org/a',new Date().toUTCString(),extra),def,topic,'noticias');
 assert.equal(a.imageUrl,'https://images.example.org/article.jpg');
 const unsafe='<media:thumbnail url="javascript:alert(1)"/>';
 const [b]=parseFeed(rss('Recolha de resíduos alimentares para compostagem','https://example.org/b',new Date().toUTCString(),unsafe),def,topic,'noticias');
 assert.equal(b.imageUrl,'');
});
test('Duplicados conservam ligação direta e todos os temas',()=>{const a={title:'Compostagem: nova iniciativa',date:'2026-09-25',topics:['biorresiduos'],via:'Google Notícias',url:'https://news.google.com/a'};const b={...a,topics:['residuos'],via:'RSS direto',url:'https://example.org/a'};const list=mergeArticles([[a],[b]]);assert.equal(list.length,1);assert.equal(list[0].url,b.url);assert.equal(list[0].topics.length,2);});
test('Rejeita HTML e entidades XML declaradas',()=>{assert.throws(()=>parseFeed('<html>Erro</html>',def,topic,'noticias'));assert.throws(()=>parseFeed('<!DOCTYPE rss [<!ENTITY x "boom">]><rss/>',def,topic,'noticias'));});
test('Cada consulta inclui fontes portuguesas e uma pesquisa separada em inglês e nos sites institucionais',()=>{for(const id of ['agua','residuos','biorresiduos','infraestruturas','espacos-verdes','urbanismo','mobilidade','sustentabilidade']){const t=TOPICS.find(t=>t.id===id);assert(t);for(const mode of ['noticias','praticas']){const defs=feedDefinitions(t,mode);assert(defs.some(d=>d.lang==='pt'));assert(defs.some(d=>d.lang==='en'));assert(defs.every(d=>d.url.startsWith('https://')));for(const domain of ['ersar.pt','apambiente.pt','adp.pt','apda.pt'])assert(defs.some(d=>d.site===domain));assert(defs.some(d=>d.name==='Google News · English'));assert(!defs.some(d=>d.name.includes('Internacional')));}}});

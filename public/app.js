import {installArticleActions} from './article-actions.js';
import {TOPICS} from '../src/topics.js';
const $=s=>document.querySelector(s);
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const dateLabel=s=>new Intl.DateTimeFormat('pt-PT',{day:'numeric',month:'short',year:'numeric'}).format(new Date(s));
const timeLabel=s=>new Intl.DateTimeFormat('pt-PT',{hour:'2-digit',minute:'2-digit'}).format(new Date(s));
const memory=new Map();
let selected='tudo',mode='noticias',data=null,busy=false,failed=false,requestNumber=0,controller;
const labels=Object.fromEntries(TOPICS.map(t=>[t.id,t.label]));
function matches(items){const q=normalize($('#search').value.trim());const lang=$('#language').value;return items.filter(n=>(lang==='all'||(lang==='pt'?n.lang==='pt':n.lang!=='pt'&&n.lang!=='und'))&&normalize([n.title,n.description,n.source,...n.topics.map(t=>labels[t])].join(' ')).includes(q)).sort((a,b)=>$('#sort').value==='old'?a.date.localeCompare(b.date):b.date.localeCompare(a.date));}
function tag(n){const topic=selected==='tudo'?n.topics[0]:selected;return `<div class="tag">${escapeHTML(labels[topic]||'Ambiente')} <span class="language" title="Língua ${n.languageMethod==='title'?'identificada no título':'estimada a partir do feed'}">${escapeHTML(n.lang.toUpperCase())}${n.languageMethod==='feed'?'*':''}</span></div>`;}
function meta(n){return `<div class="meta"><span>${escapeHTML(n.source)}</span><span>·</span><time datetime="${n.date}">${dateLabel(n.date)}</time><a class="read" href="${escapeHTML(n.url)}" target="_blank" rel="noopener noreferrer" aria-label="Ler: ${escapeHTML(n.title)} (abre num novo separador)">↗</a></div>`;}
function story(n,kind){return `<article class="${kind}">${tag(n)}<h2 lang="${escapeHTML(n.lang)}"><a href="${escapeHTML(n.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(n.title)}</a></h2>${kind==='side-story'||!n.description?'':`<p lang="${escapeHTML(n.lang)}">${escapeHTML(n.description)}</p>`}${meta(n)}<div class="via">${escapeHTML(n.via)}</div><div class="article-actions"><button type="button" data-article-action="share" data-article-id="${escapeHTML(n.id)}" aria-label="Partilhar: ${escapeHTML(n.title)}">Partilhar ↗</button><button type="button" data-article-action="pdf" data-article-id="${escapeHTML(n.id)}" aria-label="Guardar ficha PDF: ${escapeHTML(n.title)}">Guardar PDF ↓</button></div></article>`;}
function render(){
 document.querySelectorAll('#topics button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.topic===selected)));
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
 $('#heading').innerHTML=escapeHTML(selected==='tudo'?'Em perspetiva':labels[selected])+'<span>.</span>';
 $('#mode-note').textContent=mode==='noticias'?'Artigos publicados nos últimos 30 dias, com os mais recentes primeiro.':'Projetos e iniciativas do último ano. Seleção automática por tema e fonte; os resultados não constituem uma avaliação de eficácia.';
 if(selected==='normas')$('#mode-note').textContent+=' Apenas NP 4552, ISO 14001, ISO 50001 e ISO 9001; excluem-se referências explícitas a outras normas nos títulos e excertos.';
 if(selected==='engenharia')$('#mode-note').textContent+=' Engenharia aplicada à água, saneamento e infraestruturas.';
 $('#refresh').disabled=busy;$('#refresh').textContent=busy?'A consultar…':'Atualizar ↻';$('#results').setAttribute('aria-busy',String(busy));
 const items=matches(data?.items||[]);$('#count').textContent=`${items.length} ${items.length===1?'artigo':'artigos'}${$('#language').value==='international'?' · Língua não portuguesa':''}`;
 $('#empty').hidden=busy||items.length>0;
 $('#empty-heading').textContent=failed?'Não foi possível consultar as fontes':'Outra perspetiva?';
 $('#empty-text').textContent=failed?'Tente atualizar novamente dentro de alguns instantes.':'Não encontrámos artigos com estes filtros. Experimente outro tema, língua ou pesquisa.';
 if(busy&&!data){$('#results').innerHTML='<div class="loading-panel"><span class="loading-mark" aria-hidden="true">◆</span><h2>A procurar novas perspetivas…</h2><p>Estamos a consultar fontes portuguesas e internacionais.</p></div>';}
 else if(items.length>=3&&!$('#search').value.trim()&&$('#sort').value==='recent'){
  $('#results').innerHTML=`<section class="lead-grid" aria-label="Artigos mais recentes">${story(items[0],'feature')}<div class="side-stack">${items.slice(1,3).map(n=>story(n,'side-story')).join('')}</div></section>${items.length>3?'<div class="section-title"><h2>Continue a explorar</h2><span>Publicações por ordem de data</span></div>':''}<section class="cards" aria-label="Mais artigos">${items.slice(3).map(n=>story(n,'card')).join('')}</section>`;
 }else{$('#results').innerHTML=`<section class="cards" aria-label="Artigos">${items.map(n=>story(n,'card')).join('')}</section>`;}
 let status=busy?'A consultar as fontes…':failed?(data?.items?.length?'Não foi possível atualizar. Mantemos a última consulta.':'As fontes estão temporariamente indisponíveis.'):data?`Consulta às ${timeLabel(data.checkedAt)} · Atualização automática a cada 15 min`:'';
 if(data?.partial&&!busy&&!failed)status+=' · Algumas fontes estão indisponíveis ou em memória';
 $('#live-status').textContent=status;
 $('#top-status').textContent=data?`Recolha automática · consulta às ${timeLabel(data.checkedAt)}`:'Recolha automática · a cada 15 min';
 $('#sources-status').innerHTML=data?data.sources.map(s=>`<div class="source-row"><a href="${escapeHTML(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(s.name)} ↗</a><span>${s.state==='error'?'Indisponível':s.state==='stale'?'Última versão disponível':`${s.count} artigos`}${s.fetchedAt?` · ${dateLabel(s.fetchedAt)}, ${timeLabel(s.fetchedAt)}`:''}</span></div>`).join(''):'<p>A aguardar a primeira consulta.</p>';
}
async function load(force=false){
 const key=selected+':'+mode;const cached=memory.get(key);
 if(!force&&cached&&Date.now()-cached.loadedAt<15*60000){controller?.abort();requestNumber++;data=cached.data;busy=false;failed=false;render();return;}
 controller?.abort();controller=new AbortController();const ownController=controller;const number=++requestNumber;
 data=cached?.data||null;busy=true;failed=false;render();
 const timer=setTimeout(()=>ownController.abort(),22000);
 try{const response=await fetch('/api/news?'+new URLSearchParams({topic:selected,mode}),{signal:ownController.signal,cache:'no-store'});const next=await response.json();if(number!==requestNumber)return;if(!response.ok){if(!data&&next.sources)data=next;throw new Error('Fontes indisponíveis');}data=next;memory.set(key,{data:next,loadedAt:Date.now()});}
 catch{if(number!==requestNumber)return;failed=true;}
 finally{clearTimeout(timer);if(number===requestNumber){busy=false;render();}}
}
$('#topics').innerHTML=TOPICS.map(t=>`<button type="button" data-topic="${t.id}" aria-pressed="${t.id==='tudo'}">${escapeHTML(t.label)}</button>`).join('');
$('#topics').addEventListener('click',e=>{const b=e.target.closest('button');if(b&&selected!==b.dataset.topic){selected=b.dataset.topic;load();}});
document.querySelector('.modes').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(b&&mode!==b.dataset.mode){mode=b.dataset.mode;load();}});
$('#search').addEventListener('input',render);$('#sort').addEventListener('change',render);$('#language').addEventListener('change',render);$('#refresh').addEventListener('click',()=>load(true));
$('#reset').addEventListener('click',()=>{$('#search').value='';$('#language').value='all';$('#sort').value='recent';if(selected!=='tudo'){selected='tudo';load();}else{render();if(failed)load(true);}$('#search').focus();});
setInterval(()=>{if(!document.hidden&&!busy)load();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!busy)load();});
load();

installArticleActions(id=>data?.items.find(n=>n.id===id));

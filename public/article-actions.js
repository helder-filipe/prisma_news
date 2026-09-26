export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function publicArticleURL(article){const u=new URL(article.url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error('Ligação de artigo inválida.');return u.href;}
export function shareLinks(article){const url=publicArticleURL(article);return [
 ['LinkedIn','https://www.linkedin.com/sharing/share-offsite/?'+new URLSearchParams({url})],
 ['Facebook','https://www.facebook.com/sharer/sharer.php?'+new URLSearchParams({u:url})],
 ['WhatsApp','https://api.whatsapp.com/send?'+new URLSearchParams({text:article.title+'\n'+url})],
 ['X','https://twitter.com/intent/tweet?'+new URLSearchParams({text:article.title,url})]
 ];}
export function printArticleHTML(article){const url=publicArticleURL(article);const date=new Intl.DateTimeFormat('pt-PT',{dateStyle:'long'}).format(new Date(article.date));return `<div class="print-brand">Prisma Verde <span>Ficha de notícia</span></div><h1 lang="${escapeHTML(article.lang)}">${escapeHTML(article.title)}</h1><p class="print-meta">${escapeHTML(article.source)} · ${escapeHTML(date)}</p>${article.description?`<p lang="${escapeHTML(article.lang)}" class="print-excerpt">${escapeHTML(article.description)}</p>`:'<p>O feed desta publicação não disponibiliza um excerto. O texto integral pode ser consultado na fonte.</p>'}<h2>Consultar o artigo original</h2><a class="print-url" href="${escapeHTML(url)}">${escapeHTML(url)}</a><p class="print-note">Esta ficha contém a informação disponibilizada no Prisma Verde, não uma reprodução integral do artigo. Conteúdo e autoria pertencem à publicação de origem.</p>`;}
export function installArticleActions(getArticle){
 const dialog=document.createElement('dialog');dialog.className='article-dialog';dialog.setAttribute('aria-labelledby','action-heading');document.body.append(dialog);
 const printRoot=document.createElement('section');printRoot.id='print-article';printRoot.setAttribute('aria-hidden','true');document.body.append(printRoot);
 let active=null,returnFocus=null,previousTitle='';
 function close(){dialog.close();returnFocus?.focus();}
 dialog.addEventListener('click',e=>{if(e.target.closest('[data-close]'))close();});
 function open(article,kind,trigger){active=article;returnFocus=trigger;const e=escapeHTML;
  dialog.innerHTML=`<div class="dialog-top"><h2 id="action-heading">${kind==='share'?'Partilhar notícia':'Guardar como PDF'}</h2><button type="button" data-close aria-label="Fechar">×</button></div><p class="action-title">${e(article.title)}</p>`+(kind==='share'?`<div class="social-links">${shareLinks(article).map(([name,url])=>`<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${name} ↗</a>`).join('')}</div><div class="share-options">${navigator.share?'<button type="button" data-native>Mais opções de partilha</button>':''}<button type="button" data-copy>Copiar ligação</button></div><label class="copy-link">Ligação do artigo<input readonly aria-label="Ligação do artigo" value="${e(publicArticleURL(article))}"></label><p class="action-status" role="status"></p>`:`<p>Será criada uma ficha com o título, o excerto disponível, a fonte, a data e a ligação original.</p><p>Na janela de impressão, escolha <strong>Guardar como PDF</strong> como destino. Para guardar o texto integral, <a href="${e(publicArticleURL(article))}" target="_blank" rel="noopener noreferrer">abra a publicação original</a> e utilize a impressão dessa página.</p><button type="button" class="primary-action" data-print>Continuar para guardar PDF</button>`);
  dialog.showModal();
 }
 document.querySelector('#results').addEventListener('click',e=>{const b=e.target.closest('[data-article-action]');if(!b)return;const article=getArticle(b.dataset.articleId);if(article)open(article,b.dataset.articleAction,b);});
 dialog.addEventListener('click',async e=>{
  if(!active)return;
  if(e.target.closest('[data-copy]')){try{await navigator.clipboard.writeText(publicArticleURL(active));dialog.querySelector('.action-status').textContent='Ligação copiada.';}catch{const field=dialog.querySelector('input');field.focus();field.select();dialog.querySelector('.action-status').textContent='Selecione e copie a ligação apresentada.';}}
  if(e.target.closest('[data-native]')){try{await navigator.share({title:active.title,url:publicArticleURL(active)});}catch(error){if(error.name!=='AbortError')dialog.querySelector('.action-status').textContent='Utilize uma das redes sociais ou copie a ligação.';}}
  if(e.target.closest('[data-print]')){printRoot.innerHTML=printArticleHTML(active);previousTitle=document.title;document.title='Prisma Verde — '+active.title;document.body.classList.add('printing-article');dialog.close();try{window.print();}catch{cleanup();}returnFocus?.focus();}
 });
 function cleanup(){document.body.classList.remove('printing-article');if(previousTitle){document.title=previousTitle;previousTitle='';}}
 window.addEventListener('afterprint',cleanup);
}

export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function publicArticleURL(article){const u=new URL(article.url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error('Ligação de artigo inválida.');return u.href;}
export function shareLinks(article){const url=publicArticleURL(article);return [
 ['LinkedIn','https://www.linkedin.com/sharing/share-offsite/?'+new URLSearchParams({url})],
 ['Facebook','https://www.facebook.com/sharer/sharer.php?'+new URLSearchParams({u:url})],
 ['WhatsApp','https://api.whatsapp.com/send?'+new URLSearchParams({text:article.title+'\n'+url})],
 ['X','https://twitter.com/intent/tweet?'+new URLSearchParams({text:article.title,url})]
 ];}
export function printArticleHTML(article,english=false){
 const url=publicArticleURL(article);const date=new Intl.DateTimeFormat(english?'en-GB':'pt-PT',{dateStyle:'long'}).format(new Date(article.date));
 const words=english?{sheet:'Article sheet',missing:'The feed does not provide an excerpt. Read the full article at the original source.',read:'Read the original article',note:'This sheet contains only the information supplied by Prisma Verde; it is not a full reproduction of the article. Content and authorship belong to the original publisher.'}:{sheet:'Ficha de notícia',missing:'O feed desta publicação não disponibiliza um excerto. O texto integral pode ser consultado na fonte.',read:'Consultar o artigo original',note:'Esta ficha contém a informação disponibilizada pelo Prisma Verde, não uma reprodução integral do artigo. Conteúdo e autoria pertencem à publicação de origem.'};
 return `<div class="print-brand">Prisma Verde <span>${words.sheet}</span></div><h1 lang="${escapeHTML(article.lang)}">${escapeHTML(article.title)}</h1><p class="print-meta">${escapeHTML(article.source)} · ${escapeHTML(date)}</p>${article.description?`<p lang="${escapeHTML(article.lang)}" class="print-excerpt">${escapeHTML(article.description)}</p>`:`<p>${words.missing}</p>`}<h2>${words.read}</h2><a class="print-url" href="${escapeHTML(url)}">${escapeHTML(url)}</a><p class="print-note">${words.note}</p>`;
}
export function installArticleActions(getArticle,getEnglish=()=>false){
 const dialog=document.createElement('dialog');dialog.className='article-dialog';dialog.setAttribute('aria-labelledby','action-heading');document.body.append(dialog);
 const printRoot=document.createElement('section');printRoot.id='print-article';printRoot.setAttribute('aria-hidden','true');document.body.append(printRoot);
 let active=null,returnFocus=null,previousTitle='';
 const words=()=>getEnglish()?{shareTitle:'Share article',pdfTitle:'Save as PDF',close:'Close',more:'More sharing options',copy:'Copy link',articleLink:'Article link',copyOK:'Link copied.',copyManual:'Select and copy the link above.',shareFail:'Choose a social network or copy the link.',pdfIntro:'A PDF sheet will include the headline, available excerpt, source, date and original link.',pdfSave:'In the print window, select “Save as PDF” as the destination. To save the full article, open the original publication and print that page.',openOriginal:'open the original publication',continue:'Continue to save PDF'}:{shareTitle:'Partilhar notícia',pdfTitle:'Guardar como PDF',close:'Fechar',more:'Mais opções de partilha',copy:'Copiar ligação',articleLink:'Ligação do artigo',copyOK:'Ligação copiada.',copyManual:'Selecione e copie a ligação apresentada.',shareFail:'Utilize uma das redes sociais ou copie a ligação.',pdfIntro:'Será criada uma ficha com o título, o excerto disponível, a fonte, a data e a ligação original.',pdfSave:'Na janela de impressão, escolha “Guardar como PDF” como destino. Para guardar o texto integral, abra a publicação original e utilize a impressão dessa página.',openOriginal:'abra a publicação original',continue:'Continuar para guardar PDF'};
 function close(){dialog.close();returnFocus?.focus();}
 dialog.addEventListener('click',e=>{if(e.target.closest('[data-close]'))close();});
 function open(article,kind,trigger){active=article;returnFocus=trigger;const e=escapeHTML,w=words(),en=getEnglish();
  dialog.innerHTML=`<div class="dialog-top"><h2 id="action-heading">${kind==='share'?w.shareTitle:w.pdfTitle}</h2><button type="button" data-close aria-label="${e(w.close)}">×</button></div><p class="action-title">${e(article.title)}</p>`+(kind==='share'?`<div class="social-links">${shareLinks(article).map(([name,url])=>`<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${name} ↗</a>`).join('')}</div><div class="share-options">${navigator.share?`<button type="button" data-native>${e(w.more)}</button>`:''}<button type="button" data-copy>${e(w.copy)}</button></div><label class="copy-link">${e(w.articleLink)}<input readonly aria-label="${e(w.articleLink)}" value="${e(publicArticleURL(article))}"></label><p class="action-status" role="status"></p>`:`<p>${e(w.pdfIntro)}</p><p>${e(w.pdfSave).replace(e(w.openOriginal),`<a href="${e(publicArticleURL(article))}" target="_blank" rel="noopener noreferrer">${e(w.openOriginal)}</a>`)}</p><button type="button" class="primary-action" data-print>${e(w.continue)}</button>`);
  dialog.showModal();
 }
 document.querySelector('#results').addEventListener('click',e=>{const b=e.target.closest('[data-article-action]');if(!b)return;const article=getArticle(b.dataset.articleId);if(article)open(article,b.dataset.articleAction,b);});
 dialog.addEventListener('click',async e=>{
  if(!active)return;const w=words();
  if(e.target.closest('[data-copy]')){try{await navigator.clipboard.writeText(publicArticleURL(active));dialog.querySelector('.action-status').textContent=w.copyOK;}catch{const field=dialog.querySelector('input');field.focus();field.select();dialog.querySelector('.action-status').textContent=w.copyManual;}}
  if(e.target.closest('[data-native]')){try{await navigator.share({title:active.title,url:publicArticleURL(active)});}catch(error){if(error.name!=='AbortError')dialog.querySelector('.action-status').textContent=w.shareFail;}}
  if(e.target.closest('[data-print]')){printRoot.innerHTML=printArticleHTML(active,getEnglish());previousTitle=document.title;document.title='Prisma Verde — '+active.title;document.body.classList.add('printing-article');dialog.close();try{window.print();}catch{cleanup();}returnFocus?.focus();}
 });
 function cleanup(){document.body.classList.remove('printing-article');if(previousTitle){document.title=previousTitle;previousTitle='';}}
 window.addEventListener('afterprint',cleanup);
}

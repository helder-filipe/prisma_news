export const PAGE_SIZE=20;
export function paginate(items,requested=1){
 const total=items.length,pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
 const page=Math.min(pages,Math.max(1,Math.floor(Number(requested)||1))),start=(page-1)*PAGE_SIZE;
 return {items:items.slice(start,start+PAGE_SIZE),page,pages,total,from:total?start+1:0,to:Math.min(start+PAGE_SIZE,total)};
}
export function paginationHTML(view,en=false){
 if(!view.total)return '';
 const summary=en?`${view.from}–${view.to} of ${view.total} articles · Page ${view.page} of ${view.pages}`:`${view.from}–${view.to} de ${view.total} artigos · Página ${view.page} de ${view.pages}`;
 if(view.pages===1)return `<div class="pagination-summary">${summary}</div>`;
 const button=(page,label,disabled=false,current=false)=>`<button type="button" data-page="${page}" ${disabled?'disabled':''} ${current?'aria-current="page"':''} aria-label="${en?'Page':'Página'} ${page}">${label}</button>`;
 const numbers=[...new Set([1,view.page-1,view.page,view.page+1,view.pages])].filter(n=>n>=1&&n<=view.pages).sort((a,b)=>a-b);
 let previous=0;const links=numbers.map(n=>{const gap=previous&&n-previous>1?'<span aria-hidden="true">…</span>':'';previous=n;return gap+button(n,n,false,n===view.page);}).join('');
 return `<nav class="pagination" aria-label="${en?'Article pages':'Páginas de notícias'}"><p>${summary}</p><div class="pagination-buttons">${button(Math.max(1,view.page-1),en?'← Previous':'← Anterior',view.page===1)}${links}${button(Math.min(view.pages,view.page+1),en?'Next →':'Seguinte →',view.page===view.pages)}</div></nav>`;
}

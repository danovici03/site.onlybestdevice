/**
 * Bookmarkletul care copiază sursa unei pagini de produs.
 *
 * De ce există: eMAG (și nu numai) răspunde 511 cererilor venite din datacenter
 * — testat pe serverul de producție, aceeași cerere care de pe un laptop
 * întoarce 200. Nu e ceva ce se rezolvă cu antete: blocajul e pe IP. Singurul
 * browser cu un IP acceptat e chiar al operatorului, deci de acolo luăm pagina.
 *
 * Alternativa era „Cmd+U, Cmd+A, Cmd+C, întoarce-te în Admin" de fiecare dată.
 * Bookmarkletul face aceiași pași cu un click, și în plus copiază DOM-ul viu,
 * nu sursa brută — adică inclusiv galeria montată de JavaScript, pe care
 * view-source n-o conține.
 *
 * ═══ Reguli de scris ═══
 *
 * Codul ajunge într-un `href="javascript:…"`, pe care browserul îl trece printr-o
 * decodare de URL. Deci NU are voie să conțină `%` (ar fi citit ca escape) și
 * nici `#` (ar tăia restul ca fragment) — de aceea culorile sunt scrise `rgb()`,
 * nu `#111`, iar toastul stă în colț, fără `translateX(-50%)`. E scris pe o
 * singură linie, fără comentarii, din același motiv.
 *
 * Ce se aruncă înainte de copiere: `<script>`-urile executabile, stilurile,
 * `<svg>`-urile, iframe-urile. Ce se PĂSTREAZĂ, și e crucial: `<script>`-urile
 * cu `type` de tip json sau template — acolo stau JSON-LD-ul și fișa duplicată,
 * din care citește `lib/product-import/sources/`.
 */

const SOURCE = `
var d=document,
  c=d.documentElement.cloneNode(true),
  drop=function(sel,keep){
    var n=c.querySelectorAll(sel),i;
    for(i=0;i<n.length;i++){ if(!keep||!keep(n[i])) n[i].parentNode.removeChild(n[i]); }
  };
drop('script',function(s){ return /json|template/i.test(s.getAttribute('type')||''); });
drop('style,link,svg,noscript,iframe');
var h='<!doctype html>'+c.outerHTML,
  say=function(ok){
    var b=d.createElement('div');
    b.textContent=ok
      ? 'Sursa paginii a fost copiata ('+Math.round(h.length/1024)+' KB). Lipeste-o in Admin.'
      : 'Copierea a esuat. Foloseste Cmd+U si copiaza manual.';
    b.setAttribute('style','position:fixed;z-index:2147483647;right:16px;top:16px;background:'+(ok?'rgb(17,17,17)':'rgb(170,17,17)')+';color:rgb(255,255,255);padding:10px 16px;border-radius:8px;font:14px system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.3)');
    d.body.appendChild(b);
    setTimeout(function(){ b.parentNode&&b.parentNode.removeChild(b); },2600);
  },
  fallback=function(){
    var t=d.createElement('textarea');
    t.value=h; t.setAttribute('style','position:fixed;top:0;left:0;opacity:0');
    d.body.appendChild(t); t.focus(); t.select();
    var ok=false; try{ ok=d.execCommand('copy'); }catch(e){}
    t.parentNode.removeChild(t); say(ok);
  };
if(navigator.clipboard&&navigator.clipboard.writeText){
  navigator.clipboard.writeText(h).then(function(){ say(true); },fallback);
}else{ fallback(); }
`

/** Sursa de mai sus, adusă la o singură linie. */
export const PAGE_SOURCE_BOOKMARKLET =
  "javascript:(function(){" + SOURCE.replace(/\s*\n\s*/g, "") + "})();"

/** Numele sub care apare în bara de favorite. */
export const PAGE_SOURCE_BOOKMARKLET_TITLE = "Copiază pagina → OBD"

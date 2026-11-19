/* Látogatásszámláló (GoatCounter: süti nélkül, nem kell hozzá hozzájárulási ablak).
   A kódot az index.html-ben a window.ICEBERG_GOATCOUNTER állítja be; üresen nem csinál semmit. */
(function(){
  var code=(window.ICEBERG_GOATCOUNTER||'').trim();if(!code)return;
  var base='https://'+code+'.goatcounter.com';
  window.goatcounter={no_onload:true};
  function path(){var h=(location.hash||'').replace(/^#/,'');return h&&h!=='/'?h:'/';}
  function send(){try{if(window.goatcounter&&window.goatcounter.count)window.goatcounter.count({path:path(),title:document.title});}catch(e){}}
  var s=document.createElement('script');s.async=true;s.src='https://gc.zgo.at/count.js';s.setAttribute('data-goatcounter',base+'/count');s.onload=send;document.head.appendChild(s);
  window.addEventListener('hashchange',send);
  fetch(base+'/counter/TOTAL.json').then(function(r){return r.ok?r.json():null;}).then(function(j){
    if(!j||!j.count)return;
    document.querySelectorAll('[data-visits]').forEach(function(el){el.querySelector('b').textContent=j.count;el.hidden=false;});
  }).catch(function(){});
})();

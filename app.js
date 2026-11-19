(function(){
'use strict';
var IMG={a3d:'assets/a3d.png',comfy:'assets/comfy.png',lens:'assets/lens.png',podium:'assets/podium.png'};
var UPDATED=window.ICEBERG_UPDATED||'';
var TODAY=new Date();
var PER=8; /* típusonként ennyi cikk van kint; a többi az archívumba süllyed */
var DATA=(window.ICEBERG_DATA||[]).slice();
DATA.forEach(function(a){a.url=a.url||(a.yt?'https://www.youtube.com/watch?v='+a.yt:(a.link||'#'));a.tags=a.tags||[];a.lead=a.lead||'';});
DATA.forEach(function(a){if(a.cat==='palyazat'&&a.tags.indexOf('pályázat')<0)a.tags.unshift('pályázat');});
DATA.sort(function(a,b){return a.date<b.date?1:-1;});
(function(){var n={};DATA.forEach(function(a){n[a.cat]=n[a.cat]||0;if(!expired(a)&&(a.cat==='palyazat'||n[a.cat]<PER)){a.cur=1;n[a.cat]++;}});})();
var ART={comfy:'comfy','3d':'a3d',claude:'lens',palyazat:'podium'};
var CATS=[['3d','3D · BLENDER · CINEMA 4D','−020 m','3D'],['claude','CLAUDE · SKILLEK · WORKFLOW','−040 m','CLAUDE'],['comfy','COMFYUI · WORKFLOW-K','−060 m','COMFYUI'],['palyazat','PÁLYÁZATOK · CSAK AKTÍV','−080 m','PÁLYÁZAT']];

function $(s){return document.querySelector(s);}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function daysLeft(d){return Math.ceil((new Date(d+'T23:59:59')-TODAY)/864e5);}
function expired(a){return a.deadline&&daysLeft(a.deadline)<0;}
function isOld(a){return !a.cur;}
function tagsTxt(a){return a.tags.map(function(t){return '#'+t;}).join(' ');}
function dot(d){return d.replace(/-/g,'.');}
function ext(a){return /^https?:/.test(a.url)?' target="_blank" rel="noopener"':'';}
function mini(seed){
  var C=44,R=26,WL=10,cx=22+(seed%5)-2,w1=6+seed%4,w2=13+seed%4,off=(seed%3)*3-3,out='',x,y,ch,n,d,h,b,u,f;
  for(y=0;y<R;y++){var row='';
    for(x=0;x<C;x++){ch=' ';n=hsh(x+seed,y);
      if(y===WL)ch=(Math.sin(x*.5+seed)>.1)?'~':'-';
      else if(y<WL){d=WL-y;h=Math.max(Math.max(0,1-Math.abs(x-cx-off)/w1)*(WL-1),Math.max(0,1-Math.abs(x-cx+5)/(w1-1))*(WL-1)*.55,Math.max(0,1-Math.abs(x-cx)/(w2-2))*2);if(h>.5&&d<=h+.4)ch=(h-d<1)?'+':((x-cx-off)<-d*.3?'#':(n>.4?'#':':'));else if(n>.985)ch='.';}
      else{u=(x-cx)/w2;d=y-WL;f=d/(R-WL);b=Math.abs(u)<1?Math.pow(1-u*u,.8)*(R-WL-3):0;if(d<=b)ch=n>.2+f*.75?'#':n>f*.5?':':'.';else if(n>.985)ch='o';}
      row+=ch;}
    out+='<text x="0" y="'+(y*10+9)+'" textLength="'+(C*6)+'" lengthAdjust="spacingAndGlyphs" xml:space="preserve">'+row+'</text>';}
  return '<svg viewBox="0 0 '+(C*6)+' '+(R*10)+'" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="font:10px JetBrains Mono,ui-monospace,Menlo,Consolas,monospace;fill:var(--ascii)">'+out+'</svg>';
}
window.icebergMini=mini;
function seedOf(a){var k=7,j;for(j=0;j<a.title.length;j++)k=(k*31+a.title.charCodeAt(j))%9973;return k;}
function img(a,st){st=st?' style="'+st+'"':'';var src=a.yt?'https://i.ytimg.com/vi/'+a.yt+'/mqdefault.jpg':(/^https:/.test(a.img||'')?a.img:'');return src?'<div class="img photo"'+st+'><img src="'+esc(src)+'" alt="" data-seed="'+seedOf(a)+'" referrerpolicy="no-referrer" loading="lazy"></div>':'<div class="img ph"'+st+'>'+mini(seedOf(a))+'</div>';}
function when(a){return a.deadline&&!expired(a)?'határidő: '+dot(a.deadline)+' · hátra '+daysLeft(a.deadline)+' nap':dot(a.date);}

/* ---------- színek ---------- */
function hsl(h,s,l){h=((h%360)+360)%360;s/=100;l/=100;var a=s*Math.min(l,1-l);function f(n){var k=(n+h/30)%12;return l-a*Math.max(-1,Math.min(k-3,Math.min(9-k,1)));}return [f(0),f(8),f(4)];}
function hex(c){return '#'+c.map(function(v){return ('0'+Math.round(Math.max(0,Math.min(1,v))*255).toString(16)).slice(-2);}).join('');}
function lum(c){var g=c.map(function(v){return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return .2126*g[0]+.7152*g[1]+.0722*g[2];}
function bright(h){var l=56,c;do{c=hsl(h,100,l);l+=4;}while(lum(c)<0.3&&l<92);return hex(c);}
var SVARS=['--bg','--panel','--text','--muted','--accent','--ascii','--link','--onaccent','--line','--hi','--onhi','--blend','--dot','--ld'];
var theme='dark';
var sseed=0;
function setTheme(th,reroll){
  theme=th;var R=document.documentElement;R.setAttribute('data-theme',th);
  SVARS.forEach(function(v){R.style.removeProperty(v);});
  var cards=document.querySelectorAll('.card');
  cards.forEach(function(c){c.style.removeProperty('--card');c.style.removeProperty('--imgbg');});
  if(th==='surprise'){
    if(reroll||!sseed)sseed=1+Math.floor(Math.random()*999983);var q=sseed,rnd=function(){q=(q*16807)%2147483647;return (q-1)/2147483646;};var h0=rnd()*360,ink='#0A0612';
    var V={'--bg':bright(h0),'--panel':bright(h0+35+rnd()*50),'--text':ink,'--muted':ink,'--accent':bright(h0+150+rnd()*60),'--ascii':hex(hsl(h0+180,100,28)),'--link':ink,'--onaccent':ink,'--line':ink,'--hi':bright(h0+270+rnd()*40),'--onhi':ink,'--blend':'multiply','--dot':'rgba(10,6,18,.28)','--ld':ink};
    Object.keys(V).forEach(function(k){R.style.setProperty(k,V[k]);});
    cards.forEach(function(c,i){c.style.setProperty('--card',bright(h0+60+i*83+rnd()*40));c.style.setProperty('--imgbg',bright(h0+200+i*67+rnd()*60));});
  }
  document.querySelectorAll('.themes button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.th===th);});
  try{localStorage.setItem('iceberg-theme',th);}catch(e){}
}

/* ---------- ASCII ---------- */
function hsh(a,b){var s=Math.sin(a*127.1+b*311.7)*43758.5453;return s-Math.floor(s);}
function berg(t,C,R,WL,cx){
  var out=[],x,y,row;
  function top(x){var u=x-cx,j=Math.sin(x*.9)*.5+Math.sin(x*.37+1)*.9;var p1=Math.max(0,1-Math.abs(u+9)/15)*(WL-2),p2=Math.max(0,1-Math.abs(u-12)/13)*(WL-2)*.55,p3=Math.max(0,1-Math.abs(u)/34)*4;var h=Math.max(p1,p2,p3);return h>.5?Math.max(1,h+j*Math.min(1,h/4)):0;}
  function bot(x){var u=(x-cx-2)/46;if(Math.abs(u)>1)return 0;var p=Math.pow(1-u*u,.8)*(1-.25*u);return Math.max(0,p*(R-WL-4)+Math.sin(x*.5)*1.3*p+Math.sin(x*.13+2)*2.2*p);}
  for(y=0;y<R;y++){row='';
    for(x=0;x<C;x++){var ch=' ',n=hsh(x,y);
      if(y===WL){var w=Math.sin(x*.28+t*.35)+Math.sin(x*.11-t*.2);ch=w>.9?'~':w>-.2?'-':(w>-1.1?'~':' ');}
      else if(y<WL){var h=top(x),d=WL-y;
        if(d<=h){var edge=h-d,lit=(x-cx)<-2-d*.35,sw=Math.sin(x*.12+y*.2-t*.18);ch=edge<1?'+':lit?(sw>.92?'+':'#'):(n>.45?'#':(n>.2?'+':':'));}
        else if(n>.992)ch=(Math.floor(t/6+x)%3===0)?'+':'.';}
      else{var b=bot(x),dd=y-WL,f=dd/(R-WL);
        if(dd<=b){var sh=n+Math.sin(x*.09+y*.3+t*.12)*.18;ch=sh>.25+f*.75?'#':sh>f*.55?':':sh>f*.3?'.':' ';}
        else{var by=(y+Math.floor(t*.5))%R;if(hsh(x,by)>.994)ch='o';else if(hsh(x*3,y)>.985&&f<.5)ch='.';}}
      row+=ch;}
    out.push(row);}
  return out.join('\n');
}
function deep(t,C,R){
  var out=[],x,y,row;
  for(y=0;y<R;y++){row='';
    for(x=0;x<C;x++){var ch=' ',fl=2.2+Math.sin(x*.07)*1.6+Math.sin(x*.31+2)*.8+Math.max(0,x-70)*.06,d=R-y;
      if(d<=fl)ch=(fl-d)<1?'+':(hsh(x,y)>.3?'#':':');
      else if(x>62){var by=(y+Math.floor(t*.5))%R;if(hsh(x,by+40)>.99)ch='o';else if(hsh(x*5,y)>.985)ch='.';}
      row+=ch;}
    out.push(row);}
  return out.join('\n');
}
var TICK='● ÉLŐ // utolsó frissítés: '+(UPDATED||'–')+' // frissítés naponta 6:00 és 18:00 // források: YouTube · blogok · webes keresés // ComfyUI · 3D · Claude · pályázatok // ';
var t=0,view='home';
function draw(){
  if(view==='home')$('#berg').textContent=berg(t,150,48,19,100);
  var dp=deep(t,150,16);document.querySelectorAll('main:not([hidden]) pre.deep').forEach(function(p){p.textContent=dp;});
  var off=t%TICK.length;$('#ticker').textContent=(TICK+TICK+TICK+TICK).substr(off,300);
}
var still=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!still)setInterval(function(){if(!document.hidden){t++;draw();}},120);

/* ---------- tartalom ---------- */
var cat='all',tag=null;
var COL={'3d':'#FF9A4D',blender:'#FF9A4D',cinema4d:'#7FB2FF',claude:'#F0A08A',comfyui:'#FFF04D',comfy:'#FFF04D',vfx:'#B79BFF','ai-film':'#FF6B5C',motion:'#5FE3D0',mcp:'#C9D4E8',h3:'#9AF0FF',video:'#A9E0FF',workflow:'#A9E0FF',skill:'#F4A6FF',challenge:'#FF3DCB','fesztivál':'#FF3DCB',gpu:'#76FF7A',hardver:'#B6F09C',kredit:'#9AF0FF','pénzdíj':'#FFD166','animáció':'#5FE3D0','kép':'#C9B6FF',magyar:'#FF8A8A','pályázat':'#FF3DCB',palyazat:'#FF3DCB',verseny:'#FF3DCB'};
var LAB={comfy:'COMFYUI','3d':'3D',claude:'CLAUDE',palyazat:'PÁLYÁZAT'};
function col(k){return COL[k]||'#C9D4E8';}
function fl(k,label){return '<span class="fl" style="--c:'+col(k)+'">'+esc(label)+'</span>';}
function tagFl(a){return a.tags.map(function(x){return fl(x,'#'+x);}).join('');}
function ld(a,n){return a.lead?'<p class="ld c'+n+'">'+esc(a.lead)+'</p>':'';}
function rowHtml(a,withCat){return '<a class="row" href="'+a.url+'"'+ext(a)+'>'+img(a)+'<div class="tx"><div class="t cl2">'+esc(a.title)+'</div>'+ld(a,2)+'<div class="meta">'+(withCat?fl(a.cat,LAB[a.cat]):'')+'<span>'+when(a)+'</span><span>'+esc(a.src)+'</span>'+tagFl(a)+'</div></div></a>';}
var CV={'3d':{hash:'#/3d',title:'3D',sub:'Blender · Cinema 4D',depth:'−020 m'},claude:{hash:'#/claude',title:'Claude',sub:'újdonságok · skillek · workflow-k',depth:'−040 m'},comfy:{hash:'#/comfyui',title:'ComfyUI',sub:'workflow-k · modellek · node-ok',depth:'−060 m'},palyazat:{hash:'#/palyazatok',title:'Pályázatok',sub:'csak ami még beadható',depth:'−080 m'}};
var HASH={home:'#/',archive:'#/archivum'};Object.keys(CV).forEach(function(k){HASH[k]=CV[k].hash;});
function renderTabs(){
  var items=[['home','/FŐOLDAL'],['3d','/3D',1],['claude','/CLAUDE',1],['comfy','/COMFYUI',1],['palyazat','/PÁLYÁZATOK',1],['archive','/ARCHÍVUM']];
  $('#tabs').innerHTML=items.map(function(p){return '<button class="tab'+(p[0]==='archive'?' deep':'')+'" data-tab="'+p[0]+'" aria-pressed="'+(view===p[0])+'">'+(p[2]?'<span class="sw" style="--c:'+col(p[0])+'"></span>':'')+p[1]+'</button>';}).join('');
}
function renderTags(){
  var cnt={},list=[];DATA.filter(isOld).forEach(function(a){a.tags.forEach(function(x){if(!cnt[x]){cnt[x]=0;list.push(x);}cnt[x]++;});});
  if(tag&&!cnt[tag])tag=null;
  $('#tagbar').innerHTML='<span class="lbl">TAGEK &gt;</span><button class="tag" style="--c:#EEF2FA" data-tag="" aria-pressed="'+(!tag)+'">ÖSSZES</button>'+list.map(function(x){return '<button class="tag" style="--c:'+col(x)+'" data-tag="'+esc(x)+'" aria-pressed="'+(tag===x)+'">#'+esc(x)+'<span class="n">'+cnt[x]+'</span></button>';}).join('');
}
function cur(c){return DATA.filter(function(a){return a.cur&&a.cat===c;});}
function renderHome(){
  var f=['3d','claude','comfy'].map(function(c){return cur(c)[0];}).filter(Boolean).sort(function(a,b){return a.date<b.date?1:-1;});
  var pz=cur('palyazat').sort(function(a,b){return a.deadline<b.deadline?-1:1;})[0];if(pz)f.push(pz);
  var L=f[0],html='';
  if(L)html+='<a class="card lead" href="'+L.url+'"'+ext(L)+'><div class="img"><img src="'+IMG[ART[L.cat]]+'" alt=""><span class="badge" style="background:'+col(L.cat)+';color:#0A0F00">'+LAB[L.cat]+' · ÚJ</span></div><div class="body"><h3>'+esc(L.title)+'</h3>'+ld(L,3)+'<div class="meta"><span>'+when(L)+'</span><span>forrás: '+esc(L.src)+'</span>'+tagFl(L)+'</div></div></a>';
  html+='<div class="side">'+f.slice(1).map(function(a){return '<a class="card" href="'+a.url+'"'+ext(a)+'>'+img(a)+'<div class="body"><div class="meta">'+fl(a.cat,LAB[a.cat])+'<span>'+(a.deadline?'hátra '+daysLeft(a.deadline)+' nap':dot(a.date))+' · '+esc(a.src)+'</span></div><h3 class="cl2">'+esc(a.title)+'</h3>'+ld(a,2)+'<div class="meta">'+tagFl(a)+'</div></div></a>';}).join('')+'</div>';
  $('#feat').innerHTML=html;
  var rule=new Array(40).join('- - + ');
  document.querySelectorAll('.sech .rule').forEach(function(r){r.textContent=rule;});
  $('#cats').innerHTML=Object.keys(CV).map(function(k){var v=CV[k];return '<a class="cat" href="'+v.hash+'">'+fl(k,v.title.toUpperCase())+'<span class="n">'+cur(k).length+'</span><span class="small">'+(k==='palyazat'?'aktív felhívás':'cikk a mai behúzásban')+' · '+v.depth+'</span><span class="go">megnyitom →</span></a>';}).join('');
}
function renderCat(){
  var v=CV[view],rows=cur(view);
  if(view==='palyazat')rows.sort(function(a,b){return a.deadline<b.deadline?-1:1;});
  $('#cdepth').textContent='[ '+v.depth+' · '+v.sub+' ]';
  $('#ctitle').textContent=v.title;
  $('#ctext').textContent=view==='palyazat'?rows.length+' aktív felhívás, határidő szerint. HU ✓: Magyarországról is nevezhető. HU ?: a szabályzat nem mondja ki, nevezés előtt nézd meg.':'A mai behúzás: '+rows.length+' cikk. Amit a holnapi futás kiszorít, az archívumba süllyed.';
  fillPins($('#cpins'),rows);
}
var RAT=['16/9','1/1','4/5','4/3','16/10','3/4'],lastN=0;
function pinHtml(a){var k=0,j;for(j=0;j<a.title.length;j++)k=(k*31+a.title.charCodeAt(j))%997;var w=expired(a)?'lejárt: '+dot(a.deadline):a.deadline?'határidő: '+dot(a.deadline):dot(a.date);return '<a class="pin" href="'+a.url+'"'+ext(a)+'>'+img(a,'aspect-ratio:'+RAT[k%RAT.length])+'<div class="body"><div class="meta">'+fl(a.cat,LAB[a.cat])+(a.deadline&&!expired(a)?'<span class="fl" style="--c:var(--hi)">HÁTRA '+daysLeft(a.deadline)+' NAP</span>':'')+(a.elig?(a.elig==='hu'?'<span class="fl" style="--c:#7CF29A">MAGYAR</span>':a.elig==='ok'?'<span class="fl" style="--c:#7CF29A">HU ✓</span>':'<span class="fl" style="--c:#C9D4E8">HU ? SZABÁLYZAT</span>'):'')+'<span>'+w+' · '+esc(a.src)+'</span></div><h3>'+esc(a.title)+'</h3>'+ld(a,a.deadline?6:4)+(a.fee?'<div class="small">nevezési díj: '+esc(a.fee)+'</div>':'')+'<div class="meta">'+tagFl(a)+'</div></div></a>';}
function ncols(el){var w=el.clientWidth||1200;return Math.max(1,Math.min(4,Math.floor((w+24)/284)));}
var pinEl=null,pinRows=[];
function fillPins(el,rows){
  pinEl=el;pinRows=rows;var n=ncols(el),cols=[],i;lastN=n;for(i=0;i<n;i++)cols.push('');
  rows.forEach(function(a,i){cols[i%n]+=pinHtml(a);});
  el.innerHTML=rows.length?cols.map(function(c){return '<div class="col">'+c+'</div>';}).join(''):'<p class="small" style="padding:32px 0">Nincs találat.</p>';
}
function renderArchive(){
  var rows=DATA.filter(isOld).filter(function(a){return !tag||a.tags.indexOf(tag)>=0;});
  $('#acount').textContent=rows.length;
  $('#anote').hidden=!(tag==='pályázat'||tag==='challenge'||tag==='verseny');
  fillPins($('#arows'),rows);
}
window.addEventListener('resize',function(){if(view!=='home'&&pinEl&&ncols(pinEl)!==lastN)fillPins(pinEl,pinRows);});
function render(){
  $('#home').hidden=view!=='home';$('#archive').hidden=view!=='archive';$('#catview').hidden=!CV[view];
  renderTabs();
  if(view==='home')renderHome();else if(view==='archive'){renderTags();renderArchive();}else renderCat();
  if(theme==='surprise')setTheme('surprise');
  draw();
}
function viewOf(h){var k;for(k in HASH)if(HASH[k]===h)return k;return (h===''||h==='#')?'home':null;}
function route(){var v=viewOf(location.hash);if(!v)return;view=v;render();window.scrollTo(0,0);}
document.addEventListener('click',function(e){
  var b=e.target.closest('button');if(!b)return;
  if(b.dataset.tab){if(location.hash===HASH[b.dataset.tab]||(b.dataset.tab==='home'&&location.hash==='')){view=b.dataset.tab;render();}else location.hash=HASH[b.dataset.tab];}
  else if(b.dataset.tag!==undefined){tag=(!b.dataset.tag||tag===b.dataset.tag)?null:b.dataset.tag;render();}
  else if(b.dataset.th){setTheme(b.dataset.th,true);}
});
window.addEventListener('hashchange',route);
$('#upd').textContent=UPDATED;
var saved='dark';try{saved=localStorage.getItem('iceberg-theme')||'dark';}catch(e){}
view=viewOf(location.hash)||'home';
render();setTheme(saved);
})();
document.addEventListener('error',function(e){var i=e.target;if(i.tagName==='IMG'&&i.parentNode.classList.contains('photo')){var q=i.parentNode;q.className='img ph';q.innerHTML=window.icebergMini(+i.dataset.seed||7);}},true);

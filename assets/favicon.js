/* IceBerg mozgó favicon: 32×32-es pixeles jéghegy, ringó vízvonallal és buborékokkal. */
(function(){
  var N=32,c=document.createElement('canvas');c.width=c.height=N;var g=c.getContext('2d');
  function css(v,d){var x=getComputedStyle(document.documentElement).getPropertyValue(v).trim();return x||d;}
  function px(x,y,w,h){g.fillRect(x,y,w||1,h||1);}
  var J=[0,1,0,-1,1,0,1,1,0,-1,0,1,0,0,-1,1,0,0,1,-1];
  function draw(t){
    var bg=css('--bg','#060A12'),ice=css('--ascii','#508DFF'),hi=css('--link','#7FAEFF');
    g.clearRect(0,0,N,N);g.fillStyle=bg;
    if(g.roundRect){g.beginPath();g.roundRect(0,0,N,N,7);g.fill();}else px(0,0,N,N);
    var bob=Math.round(Math.sin(t*0.35)),WL=12,y,x;
    // víz alatti tömb: szélesebb és mélyebb, szabálytalan, halványabb
    g.globalAlpha=0.55;g.fillStyle=ice;
    for(y=WL+1;y<N-1;y++){var f=(y-WL)/(N-WL-1);var hw=Math.round(13*Math.sin(Math.PI*Math.min(1,f*0.85+0.18))*(1-f*0.55))+J[y%J.length];
      var cx=15+Math.round(f*3);for(x=cx-hw;x<=cx+hw;x++){if(f<0.55||((x+y)&1)===0)px(x,y+bob);}}
    g.globalAlpha=1;
    // csúcs: két orom a víz felett
    g.fillStyle=ice;
    for(y=2;y<WL;y++){var a1=Math.max(0,Math.round((y-2)*0.7)),a2=Math.max(-1,Math.round((y-6)*0.8));
      var yy=y+bob;if(yy>=WL||yy<1)continue;px(12-a1,yy,2*a1+1);if(a2>=0)px(19-a2,yy,2*a2+1);}
    g.fillStyle=hi;for(y=3;y<WL;y+=2){var yb=y+bob;if(yb<WL&&yb>0)px(12-Math.round((y-2)*0.7),yb);}
    // vízvonal
    for(x=1;x<N-1;x++){var wv=Math.sin(x*0.75+t*0.9);g.fillStyle=wv>0.2?hi:ice;if(wv>-0.7)px(x,WL+(wv>0.8?-1:0));}
    // buborékok
    g.fillStyle=hi;for(var k=0;k<3;k++){var by=N-2-((t*0.6+k*5)%15);var bx=[3,28,25][k]+Math.round(Math.sin(t*0.5+k));if(by>WL+1)px(bx,Math.round(by));}
  }
  window.icebergFavFrame=function(t){draw(t);return c.toDataURL('image/png');};
  if(typeof document==='undefined'||window.ICEBERG_NO_FAV_LOOP)return;
  var link=document.querySelector('link[rel="icon"][data-anim]');
  if(!link){link=document.createElement('link');link.rel='icon';link.setAttribute('data-anim','');document.head.appendChild(link);}
  var still=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches,t=0;
  function tick(){draw(t);link.type='image/png';link.href=c.toDataURL('image/png');t++;}
  tick();if(!still)setInterval(tick,180);
})();

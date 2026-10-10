(function(global){
function createRenderer(data,images){
 const {frames,commonHeight,assets}=data;
 function sprite(ctx,key,x,y,w,h,alpha=1){const im=images[key],b=assets[key].bounds_alpha8;ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(im,b[0],b[1],b[2]-b[0],b[3]-b[1],x,y,w,h);ctx.restore();}
 function character(ctx,i,x,y,height,guides=false){const f=frames[i],s=height/commonHeight,b=f.source_rect,p=f.pivot_source;ctx.drawImage(images.character,b[0],b[1],b[2]-b[0],b[3]-b[1],x+(b[0]-p[0])*s,y+(b[1]-p[1])*s,(b[2]-b[0])*s,(b[3]-b[1])*s);const a=[x+(f.launch_anchor_source[0]-p[0])*s,y+(f.launch_anchor_source[1]-p[1])*s];if(guides){ctx.save();ctx.strokeStyle='#e17875';ctx.lineWidth=.5;for(const cx of frames[0].sole_centers){const fx=x+(cx-frames[0].pivot_source[0])*s;ctx.beginPath();ctx.moveTo(fx,y-3);ctx.lineTo(fx,y+3);ctx.stroke()}ctx.strokeStyle='#509b98';ctx.beginPath();ctx.moveTo(a[0]-1.5,a[1]);ctx.lineTo(a[0]+1.5,a[1]);ctx.moveTo(a[0],a[1]-1.5);ctx.lineTo(a[0],a[1]+1.5);ctx.stroke();ctx.restore()}return a;}
 function background(ctx,w,h,dark){ctx.fillStyle=dark?'#1b2d3b':'#f5f0e6';ctx.fillRect(0,0,w,h);}
 function scene(ctx,opts={}){const{height=36,index=2,dark=false,guides=false,target='far',lethal=false,width=240,heightPx=124}=opts;background(ctx,width,heightPx,dark);const ratio=height/36,[x,y]=data.fixture.character_ground,[tx,ty]=target==='near'?data.fixture.hit_position_near:data.fixture.hit_position_far;ctx.strokeStyle=dark?'#355064':'#e2ddce';ctx.lineWidth=.5;for(let yy=20;yy<heightPx;yy+=25){ctx.beginPath();ctx.moveTo(12,yy);ctx.lineTo(width-12,yy);ctx.stroke()}
 const active=index===2,after=index===3||index===4;const a=character(ctx,index,x,y,height,guides);
 if(active||after)sprite(ctx,'ripple',tx-12*ratio,ty+6,24*ratio,5*ratio,active?.55:index===3?.4:.18);
 // Explicit geometric art-only enemy stand-in, not production art or game state.
 const hit=active;ctx.fillStyle=hit?'#d89796':dark?'#b6bdc3':'#7b8790';if(!(lethal&&after)){ctx.beginPath();ctx.roundRect(tx-7,ty-8,14,16,5);ctx.fill();ctx.fillStyle=dark?'#263344':'#f6f1e6';ctx.fillRect(tx-3,ty-2,1.3,1.3);ctx.fillRect(tx+2,ty-2,1.3,1.3)}
 ctx.fillStyle=dark?'#526775':'#cdd1ca';ctx.fillRect(tx-10,ty-13,20,2);ctx.fillStyle='#6da98e';ctx.fillRect(tx-10,ty-13,(active||after)?(lethal?0:11):20,2);
 if(active){sprite(ctx,'bubble',a[0]+1,a[1],7*ratio,6.2*ratio,.8);for(const t of [.38,.64]){let px=a[0]+(tx-a[0])*t,py=a[1]+(ty-a[1])*t;sprite(ctx,'bubble',px-1,py-1,3.2*ratio,2.8*ratio,.5)}sprite(ctx,'impact',tx-10*ratio,ty-10*ratio,20*ratio,20*ratio,.8)}
 ctx.fillStyle=dark?'#b8cbd3':'#667577';ctx.font='9px sans-serif';ctx.fillText(height+'px · '+frames[index].name,12,15);ctx.fillText('art-only target / simulated HP',12,heightPx-8);return{launch:a,hit:[tx,ty]};
 }
 return{sprite,character,background,scene};
}
if(typeof module!=='undefined')module.exports={createRenderer};else global.NuriReview={createRenderer};
})(typeof window!=='undefined'?window:globalThis);

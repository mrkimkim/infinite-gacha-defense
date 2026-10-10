// Pure decision module: no core import, file I/O, state, seed or random access.
const cells=Array.from({length:16},(_,i)=>({kind:'board',col:i%4,row:Math.floor(i/4)}));
const def=(r,id)=>r.characters.find(c=>c.id===id);
const price=(r,id)=>r.rarities.find(x=>x.id===def(r,id).rarityId).recruitPrice;
const copies=(us,id,star)=>us.filter(u=>u.definitionId===id&&u.star===star).length;
function power(u,r){const d=def(r,u.definitionId);return d.damage*r.starDamagePercent[u.star-1]/100/d.cooldownTicks*(d.behavior==='multi'?1.7:d.behavior==='splash'?2.2:d.behavior==='slow'?1.6:d.behavior==='support'?1.5:d.behavior==='bossFirst'?1.35:1);}
function value(us,r){const powers=us.map(u=>power(u,r)).sort((a,b)=>b-a);const base=powers.slice(0,16).reduce((a,b)=>a+b,0)+powers.slice(16).reduce((a,b)=>a+b*.12,0);const diversity=['focus','cooperation'].reduce((n,tag)=>n+Math.min(3,new Set(us.filter(u=>def(r,u.definitionId).tag===tag).map(u=>u.definitionId)).size),0);return base+diversity*.12;}
// Material option value: partial triples have value, discounted by public draw odds/cost.
function pipeline(us,r){return r.characters.reduce((sum,d)=>{const rarity=r.rarities.find(x=>x.id===d.rarityId),pool=r.characters.filter(x=>x.rarityId===d.rarityId).length;const probability=rarity.offerWeight/r.shopSampling.weightTotal/pool;const a=copies(us,d.id,1),b=copies(us,d.id,2);const readiness=(a===2?.5:a===1?.10:0)+(b===2?.85:b===1?.20:0);return sum+readiness*power({definitionId:d.id,star:2},r)*Math.sqrt(probability*8);},0);}
// Hypothetical inventory only for visible second purchase; never authoritative state.
function hypothetical(us,id){let out=us.map(u=>({definitionId:u.definitionId,star:u.star}));out.push({definitionId:id,star:1});for(const star of [1,2])if(copies(out,id,star)>=3){let n=3;out=out.filter(u=>!(u.definitionId===id&&u.star===star&&n-->0));out.push({definitionId:id,star:star+1});}return out;}
function placement(unit,us,r){const d=def(r,unit.definitionId);const occupied=us.filter(u=>u.location.kind==='board');const score=p=>{let covered=0;const x=500+p.col*1000,y=500+p.row*1000;for(let k=0;k<80;k++){const edge=Math.floor(k/20),a=-500+(k%20)*250;const [px,py]=edge===0?[a,-500]:edge===1?[4500,a]:edge===2?[4000-(k%20)*250,4500]:[-500,4000-(k%20)*250];if((x-px)**2+(y-py)**2<=unit.range**2)covered++;}const adjacent=occupied.filter(u=>Math.abs(u.location.col-p.col)+Math.abs(u.location.row-p.row)===1);return covered+(d.behavior==='support'?adjacent.reduce((n,u)=>n+power(u,r)*5,0):adjacent.filter(u=>def(r,u.definitionId).behavior==='support').length*5);};return cells.filter(p=>!occupied.some(u=>u.location.col===p.col&&u.location.row===p.row)).sort((a,b)=>score(b)-score(a))[0];}
export function decide(o,r,skill){
 const board=o.units.filter(u=>u.location.kind==='board'),bench=o.units.filter(u=>u.location.kind==='bench');
 const ranked=bench.toSorted((a,b)=>power(b,r)-power(a,r)||a.id-b.id);
 if(ranked.length&&board.length<16)return{type:'move',unitId:ranked[0].id,to:placement(ranked[0],o.units,r)};
 if(ranked.length&&board.length===16){const weakest=board.toSorted((a,b)=>power(a,r)-power(b,r)||a.id-b.id)[0];if(power(ranked[0],r)>power(weakest,r)*1.15)return{type:'swap',aId:ranked[0].id,bId:weakest.id};}
 const offers=o.offers.filter(x=>x.recruitPreview.ok);
 const utility=us=>value(us,r)+(skill==='expert'?.65:.35)*pipeline(us,r);
 const current=utility(o.units);
 const scored=offers.map(x=>{const us=x.recruitPreview.finalUnits;const duplicate=copies(o.units,x.definitionId,1);const d=def(r,x.definitionId);const sameTag=new Set(o.units.filter(u=>def(r,u.definitionId).tag===d.tag).map(u=>u.definitionId));const diversity=!sameTag.has(d.id)&&sameTag.size<3?.35:0;
 let score;if(skill==='normal')score=power({definitionId:x.definitionId,star:1},r)/x.price+duplicate*.22+x.recruitPreview.upgrades.length*.35+diversity;
 else {score=(utility(us)-current+.25*power({definitionId:x.definitionId,star:1},r)+diversity)/x.price;for(const second of o.offers.filter(y=>y.slot!==x.slot&&y.definitionId&&y.price<=o.gold-x.price)){const next=hypothetical(us,second.definitionId);if(next.length<=24)score=Math.max(score,(utility(next)-current+.25*power({definitionId:second.definitionId,star:1},r))/(x.price+second.price));}}
 return{x,score};}).sort((a,b)=>b.score-a.score||a.x.slot-b.x.slot);
 if(scored.length&&(skill==='normal'||board.length<10||scored[0].score>.025))return{type:'recruit',offerSlot:scored[0].x.slot};
 // Sell only benched low-value non-pair material to resolve congestion or finance a visible pair completion.
 const sellable=bench.filter(u=>u.star===1&&copies(o.units,u.definitionId,1)<2).toSorted((a,b)=>power(a,r)-power(b,r)||a.id-b.id);
 const target=o.offers.find(x=>x.definitionId&&copies(o.units,x.definitionId,1)===2&&x.price>o.gold&&sellable.some(u=>o.gold+u.sellGold>=x.price));
 if(sellable.length&&(bench.length>=r.benchCapacity||(target&&o.gold+sellable[0].sellGold>=target.price)))return{type:'sell',unitId:sellable[0].id};
 // Expert reserves one cheapest recruit beyond refresh; normal refreshes with any recruit budget.
 const reserve=skill==='expert'&&board.length>=10?Math.min(...r.rarities.map(x=>x.recruitPrice)):0;
 if(o.gold>=r.rerollCost+Math.min(...r.rarities.map(x=>x.recruitPrice))+reserve&&bench.length<r.benchCapacity)return{type:'reroll'};
 return{type:'startWave'};
}

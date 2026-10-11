/** Exact PR45 ab00e389 v7-letter v6-baseline pixels; sizes mean alpha>127 bounds. */
export type EffectWidth=0|8|10|12; //0 preserves the earlier body-scaled renderer.
export const effects={
 8:{canvas:[14,14],strong:[3,5,11,9],alpha:[0,2,13,12],scale:0.007744433688286544},
 10:{canvas:[16,16],strong:[3,5,13,11],alpha:[0,3,16,14],scale:0.00968054211035818},
 12:{canvas:[19,19],strong:[3,6,15,13],alpha:[1,3,18,15],scale:0.011616650532429816},
} as const;
export function effectOrigin(p:{x:number;y:number},width:8|10|12){const b=effects[width].strong;return{x:Math.round(p.x-(b[0]+b[2])/2),y:Math.round(p.y-(b[1]+b[3])/2)};}
// Full alpha>0 corner radius about strong-bounds center. Rotation-invariant; no rotation is applied.
export const maximumEffectRadius=Math.max(...Object.values(effects).map(e=>{const [x0,y0,x1,y1]=e.alpha,cx=(e.strong[0]+e.strong[2])/2,cy=(e.strong[1]+e.strong[3])/2;return Math.hypot(Math.max(cx-x0,x1-cx),Math.max(cy-y0,y1-cy));}));
/** Validate decoded RGBA pixels, not CSS/canvas dimensions, before accepting assets. */
export function validateEffectImage(image:HTMLImageElement,width:8|10|12){
 const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;
 const bounds=(threshold:number)=>{let x0=c.width,y0=c.height,x1=0,y1=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>threshold){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}return[x0,y0,x1,y1];};
 const result={canvas:[c.width,c.height],strong:bounds(127),alpha:bounds(0)},expected=effects[width];
 for(const key of ['canvas','strong','alpha'] as const)if(JSON.stringify(result[key])!==JSON.stringify(expected[key]))throw Error('Effect pixel bounds mismatch '+width+' '+key);
 return result;
}

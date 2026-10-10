const {chromium}=require('playwright'),http=require('http'),fs=require('fs'),path=require('path');
const root=__dirname;
const server=http.createServer((req,res)=>{try{const n=path.basename(new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',n.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(path.join(root,n)));}catch(e){res.writeHead(404);res.end();}});
(async()=>{let browser;try{
await new Promise(r=>server.listen(0,'127.0.0.1',r));
browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:960,height:1600},deviceScaleFactor:1});
await page.goto('http://127.0.0.1:'+server.address().port+'/preview.html');await page.evaluate(()=>window.previewReady);
const report=await page.evaluate(()=>({decodes:window.decodeResults,boards:[...document.querySelectorAll('.board')].map(b=>({id:b.id,width:b.offsetWidth,height:b.offsetHeight,floors:b.querySelectorAll('.floor').length,units:b.querySelectorAll('.guardian').length}))}));
report.browser=await browser.version();report.viewport={width:960,height:1600,deviceScaleFactor:1};
async function capture(size,name){
 await page.evaluate(size=>{for(const b of document.querySelectorAll('.board'))b.style.visibility='hidden';const b=document.getElementById('board-'+size);Object.assign(b.style,{position:'fixed',left:'0px',top:'0px',margin:'0px',visibility:'visible',zIndex:'9999'});},size);
 await page.screenshot({path:path.join(root,name),clip:{x:0,y:0,width:size,height:size}});
}
for(const size of [864,360])await capture(size,'comparison-'+size+'.png');
// Reload restores normal layout before changing the comparison scale.
await page.reload();await page.evaluate(()=>window.previewReady);
await page.locator('#scale').click();await page.evaluate(()=>window.previewReady);
await capture(360,'comparison-360-silhouette80.png');
report.captureMethod='Board fixed at integer origin (0,0); page clip exact width/height at DPR1, not fractional element bounds';
report.screenshots=['comparison-864.png','comparison-360.png','comparison-360-silhouette80.png'];
fs.writeFileSync(path.join(root,'browser-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{if(browser)await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1});

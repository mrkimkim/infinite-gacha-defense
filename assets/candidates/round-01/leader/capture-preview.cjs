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
for(const size of [864,360])await page.locator('#board-'+size).screenshot({path:path.join(root,'comparison-'+size+'.png')});
await page.locator('#scale').click();await page.evaluate(()=>window.previewReady);
await page.locator('#board-360').screenshot({path:path.join(root,'comparison-360-silhouette80.png')});
report.screenshots=['comparison-864.png','comparison-360.png','comparison-360-silhouette80.png'];
fs.writeFileSync(path.join(root,'browser-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{if(browser)await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1});

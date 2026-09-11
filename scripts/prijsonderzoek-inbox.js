// Leest de Proton-inbox van de persona: lijst van afzender, onderwerp, tijd (alleen lezen)
const { chromium } = require('playwright');
const OUT='/Users/clawdboot/sonty/data/prijsonderzoek';
setTimeout(()=>{console.log('HARD TIMEOUT');process.exit(2)},150000);
(async()=>{
  const browser = await chromium.launch({headless:true});
  const ctx = await browser.newContext({viewport:{width:1280,height:2400},locale:'nl-NL',storageState:OUT+'/proton-state.json'});
  const page = await ctx.newPage();
  await page.goto('https://mail.proton.me/u/1/almost-all-mail',{waitUntil:'domcontentloaded',timeout:40000}).catch(()=>{});
  await page.waitForTimeout(10000); await page.keyboard.press('Escape');
  if(!/almost-all-mail|inbox/.test(page.url())) { await page.goto('https://mail.proton.me/u/1/inbox',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(8000); }
  const rows=await page.$$eval('[data-testid="message-column:item"], .item-container',els=>els.map(e=>({t:e.innerText.replace(/\s+/g,' ').slice(0,160),unread:e.className.includes('unread')})));
  console.log('URL',page.url(),'ITEMS',rows.length);
  rows.forEach(r=>console.log((r.unread?'* ':'  ')+r.t));
  await page.screenshot({path:OUT+'/proton-inbox-'+new Date().toISOString().slice(0,10)+'.png'});
  await ctx.storageState({path:OUT+'/proton-state.json'});
  await browser.close(); process.exit(0);
})().catch(e=>{console.log('ERR',e.message.slice(0,200));process.exit(1)});

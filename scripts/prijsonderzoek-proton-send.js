// Verstuurt een mail vanuit de persona-mailbox (Proton) via headless Playwright.
// Gebruik: NODE_PATH=~/sonty/node_modules node scripts/prijsonderzoek-proton-send.js <to> <subject> <bodyfile> [--dry]
const { chromium } = require('playwright');
const fs=require('fs');
const OUT='/Users/clawdboot/sonty/data/prijsonderzoek';
const [to,subject,bodyfile,flag]=process.argv.slice(2);
const dry=flag==='--dry';
const body=fs.readFileSync(bodyfile,'utf8').replace(/\r/g,'');
const log=(...a)=>console.log(new Date().toISOString().slice(11,19),...a);
setTimeout(()=>{log('HARD TIMEOUT');process.exit(2)},4*60*1000);
(async()=>{
  const browser = await chromium.launch({headless:true});
  const ctx = await browser.newContext({viewport:{width:1280,height:1000},locale:'nl-NL',storageState:OUT+'/proton-state.json'});
  const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  await page.goto('https://mail.proton.me/u/1/inbox',{waitUntil:'domcontentloaded',timeout:40000});
  await page.waitForTimeout(9000);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:/Nieuw bericht/i}).first().click(); await page.waitForTimeout(3000);
  await page.locator('[data-testid="composer:to"]').fill(to); await page.keyboard.press('Tab');
  await page.locator('[data-testid="composer:subject"]').fill(subject);
  const fr=page.frameLocator('[data-testid="rooster-iframe"]');
  // verwijder Proton-voettekst uit de body
  const removed=await fr.locator('body').evaluate(b=>{let n=0; for(const el of Array.from(b.querySelectorAll('div,p'))){ if(/Verzonden met .*Proton Mail|Sent with .*Proton Mail/i.test(el.textContent) && !el.querySelector('div,p')){ el.remove(); n++; } } return n;});
  log('voettekst verwijderd:',removed);
  // cursor bovenaan, tekst typen (signature blijft eronder)
  await fr.locator('body').click({position:{x:20,y:5}});
  await page.keyboard.press('Control+Home');
  const lines=body.split('\n');
  // Lijstregels ("1) ", "- "): de editor maakt zelf een lijst na de eerste regel, dus markering alleen op de eerste regel typen
  const isList=l=>/^(\d+[\)\.]|-)\s/.test(l.replace(/\u00a0/g,' '));
  for(let i=0;i<lines.length;i++){ if(!lines[i]) continue; let l=lines[i].replace(/\u00a0/g,' '); if(isList(l) && i>0 && isList(lines[i-1]||'')) l=l.replace(/^(\d+[\)\.]|-)\s/,''); await page.keyboard.type(l); await page.keyboard.press('Enter'); if(lines[i+1]==='') { await page.keyboard.press('Enter'); if(isList(l)) await page.keyboard.press('Enter'); } }
  await page.waitForTimeout(800);
  const txt=await fr.locator('body').innerText();
  const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  const safe=to.replace(/[^a-z0-9]/gi,'_');
  await page.screenshot({path:`${OUT}/verzonden/${stamp}-${safe}.png`,fullPage:false});
  fs.writeFileSync(`${OUT}/verzonden/${stamp}-${safe}.txt`,`TO: ${to}\nSUBJECT: ${subject}\n\n${txt}`);
  if(/Proton Mail/i.test(txt)){ log('FOUT: Proton-voettekst staat nog in de mail, NIET verzonden'); process.exit(3); }
  if(dry){ log('DRY RUN, niet verzonden. Body:\n'+txt); await browser.close(); process.exit(0); }
  await page.locator('[data-testid="composer:send-button"]').first().click();
  await page.waitForTimeout(7000);
  const ok=/Bericht verzonden|Message sent/i.test(await page.innerText('body'));
  log(ok?'VERZONDEN':'ONZEKER: geen "Bericht verzonden" gezien', to);
  await ctx.storageState({path:OUT+'/proton-state.json'});
  await browser.close(); process.exit(ok?0:4);
})().catch(e=>{log('ERR',e.message.slice(0,300));process.exit(1)});

// Leest gericht gesprekken uit de persona-mailbox waarvan de lijstregel een patroon bevat (argv[2] = regex), tekst + bijlagen
const { chromium } = require('playwright');
const fs=require('fs');
const OUT='/Users/clawdboot/sonty/data/prijsonderzoek'; const A=OUT+'/antwoorden';
const RX=new RegExp(process.argv[2]||'.','i'); const NOATT=process.argv[3]==='--geen-bijlagen';
setTimeout(()=>{console.log('HARD TIMEOUT');process.exit(2)},8*60*1000);
const clean=s=>s.replace(/[^a-z0-9]+/gi,'_').slice(0,50);
(async()=>{
  const browser = await chromium.launch({headless:true});
  const ctx = await browser.newContext({viewport:{width:1400,height:1800},locale:'nl-NL',storageState:OUT+'/proton-state.json',acceptDownloads:true});
  const page = await ctx.newPage(); page.setDefaultTimeout(12000);
  await page.goto('https://mail.proton.me/u/1/almost-all-mail',{waitUntil:'domcontentloaded',timeout:40000}); await page.waitForTimeout(9000); await page.keyboard.press('Escape');
  const rows=page.locator('.item-container'); const n=await rows.count();
  const targets=[]; for(let i=0;i<n;i++){ const t=(await rows.nth(i).innerText().catch(()=>'')).replace(/\s+/g,' '); if(RX.test(t) && !/^SV .*Verzonden Offerte/.test(t)) targets.push({i,t}); }
  console.log('doelen',targets.length);
  for(const {i,t} of targets){
    await page.locator('.item-container').nth(i).click(); await page.waitForTimeout(5000);
    for(let k=0;k<40;k++){ const col=page.locator('.message-container.is-collapsed, [data-testid="message-view:collapsed"]').first(); if(await col.isVisible({timeout:600}).catch(()=>false)){ await col.click().catch(()=>{}); await page.waitForTimeout(700);} else break; }
    await page.waitForTimeout(2000);
    let txt=''; for(const f of page.frames()){ if(f===page.mainFrame()) continue; const b=await f.innerText('body').catch(()=>''); if(b && b.trim() && !/Proton requires Javascript/.test(b)) txt+='\n----- bericht -----\n'+b.trim()+'\n'; }
    const head=(await page.locator('.message-container').allInnerTexts().catch(()=>[])).join('\n=====\n');
    const name='G'+String(i).padStart(2,'0')+'-'+clean(t.slice(0,60));
    fs.writeFileSync(`${A}/${name}.txt`,`LIJSTREGEL: ${t}\n\nKOPPEN:\n${head.slice(0,12000)}\n\nINHOUD:\n${txt.slice(0,60000)}`);
    let got=0,na=0;
    if(!NOATT){ const atts=page.locator('[data-testid^="attachment-item"] button, button[data-testid="attachment-item:download"]'); na=await atts.count(); for(let j=0;j<Math.min(na,4);j++){ try{ const [dl]=await Promise.all([page.waitForEvent('download',{timeout:12000}), atts.nth(j).click()]); await dl.saveAs(`${A}/${name}__${dl.suggestedFilename()}`); got++; }catch(e){} } }
    console.log(`[${i}] ${t.slice(0,80)} | tekst ${txt.length} | bijlagen ${got}/${na}`);
    await page.goto('https://mail.proton.me/u/1/almost-all-mail',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(4000); await page.keyboard.press('Escape');
  }
  await ctx.storageState({path:OUT+'/proton-state.json'}); await browser.close(); process.exit(0);
})().catch(e=>{console.log('ERR',e.message.slice(0,200));process.exit(1)});

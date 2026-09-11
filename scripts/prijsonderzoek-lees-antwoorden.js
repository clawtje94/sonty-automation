// Opent elk gesprek in de persona-mailbox (almost-all-mail), slaat tekst + bijlagen op in antwoorden/ (alleen lezen)
const { chromium } = require('playwright');
const fs=require('fs');
const OUT='/Users/clawdboot/sonty/data/prijsonderzoek';
const A=OUT+'/antwoorden';
setTimeout(()=>{console.log('HARD TIMEOUT');process.exit(2)},25*60*1000);
const clean=s=>s.replace(/[^a-z0-9]+/gi,'_').slice(0,50);
(async()=>{
  const browser = await chromium.launch({headless:true});
  const ctx = await browser.newContext({viewport:{width:1400,height:1800},locale:'nl-NL',storageState:OUT+'/proton-state.json',acceptDownloads:true});
  const page = await ctx.newPage(); page.setDefaultTimeout(15000);
  await page.goto('https://mail.proton.me/u/1/almost-all-mail',{waitUntil:'domcontentloaded',timeout:40000}); await page.waitForTimeout(9000); await page.keyboard.press('Escape');
  const n=await page.locator('.item-container').count(); console.log('gesprekken',n);
  const START=parseInt(process.argv[2]||"0",10); for(let i=START;i<n;i++){
    const rows=page.locator('.item-container'); const row=rows.nth(i);
    const t=(await row.innerText().catch(()=>'')).replace(/\s+/g,' ');
    if(/^SV .*Verzonden Offerte/.test(t) || /Concepten Offerte/.test(t) || /daimyboot|Proton Officieel/.test(t)) continue; // alleen eigen verzonden zonder antwoord overslaan
    await row.click(); await page.waitForTimeout(5000);
    // alle berichten uitklappen
    for(let k=0;k<6;k++){ const col=page.locator('[data-testid="message-view:collapsed"], .message-container.is-collapsed, .message-header-collapsed').first(); if(await col.isVisible({timeout:800}).catch(()=>false)){ await col.click().catch(()=>{}); await page.waitForTimeout(1500);} else break; }
    let txt='';
    for(const f of page.frames()){ if(f===page.mainFrame()) continue; const b=await f.innerText('body').catch(()=>''); if(b && b.trim()) txt+='\n----- bericht -----\n'+b.trim()+'\n'; }
    const head=(await page.locator('.message-container, [data-testid="message-container"]').allInnerTexts().catch(()=>[])).join('\n=====\n');
    const name=String(i).padStart(2,'0')+'-'+clean(t.slice(0,60));
    fs.writeFileSync(`${A}/${name}.txt`,`LIJSTREGEL: ${t}\n\nKOPPEN:\n${head.slice(0,4000)}\n\nINHOUD:\n${txt.slice(0,20000)}`);
    // bijlagen
    const atts=page.locator('[data-testid^="attachment-item"] button, .message-attachments button[title*="ownload" i], button[data-testid="attachment-item:download"]');
    const na=await atts.count(); let got=0;
    for(let j=0;j<na;j++){ try{ const [dl]=await Promise.all([page.waitForEvent('download',{timeout:15000}), atts.nth(j).click()]); const fn=dl.suggestedFilename(); await dl.saveAs(`${A}/${name}__${fn}`); got++; }catch(e){} }
    console.log(`[${i}] ${t.slice(0,90)} | tekst ${txt.length} | bijlagen ${got}/${na}`);
    await page.goto('https://mail.proton.me/u/1/almost-all-mail',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(4000); await page.keyboard.press('Escape');
  }
  await ctx.storageState({path:OUT+'/proton-state.json'});
  await browser.close(); process.exit(0);
})().catch(e=>{console.log('ERR',e.message.slice(0,200));process.exit(1)});

// Leest per trefwoord (afzender) het nieuwste gesprek uit de persona-mailbox: tekst + alle bijlagen als zip. Gebruik: node ... woord1 woord2 ...
const { chromium } = require('playwright');
const fs=require('fs');
const OUT='/Users/clawdboot/sonty/data/prijsonderzoek'; const A=OUT+'/antwoorden';
setTimeout(()=>{console.log('HARD TIMEOUT');process.exit(2)},12*60*1000);
(async()=>{
  const browser = await chromium.launch({headless:true});
  const ctx = await browser.newContext({viewport:{width:1400,height:1800},locale:'nl-NL',storageState:OUT+'/proton-state.json',acceptDownloads:true});
  const page = await ctx.newPage(); page.setDefaultTimeout(12000);
  for(const w of process.argv.slice(2)){
    await page.goto('https://mail.proton.me/u/1/almost-all-mail#keyword='+encodeURIComponent(w),{waitUntil:'domcontentloaded',timeout:40000}); await page.waitForTimeout(9000); await page.keyboard.press('Escape');
    const rows=page.locator('.item-container'); const n=await rows.count(); if(!n){console.log(w,'geen rijen');continue;}
    // kies de nieuwste rij die niet alleen 'Verzonden' is
    let idx=0; for(let i=0;i<n;i++){ const t=(await rows.nth(i).innerText()).replace(/\s+/g,' '); if(!/Verzonden Offerte 2 ritsscreens/.test(t)){idx=i;break;} }
    await rows.nth(idx).click(); await page.waitForTimeout(9000); console.log('  rij',idx,'van',n,'| url',page.url().includes('#')?'ok':'?','| frames',page.frames().length);
    for(let k=0;k<8;k++){ const col=page.locator('[data-testid^="message-header-collapsed"]').first(); if(await col.isVisible({timeout:800}).catch(()=>false)){ await col.click().catch(()=>{}); await page.waitForTimeout(2000);} else break; }
    let txt=''; for(const f of page.frames()){ if(f===page.mainFrame()) continue; const b=await f.innerText('body').catch(()=>''); if(b && b.trim().length>5 && !/Proton requires Javascript/.test(b)) txt+='\n----- bericht -----\n'+b.trim()+'\n'; }
    const name='Z-'+w.replace(/[^a-z0-9]+/gi,'_');
    fs.writeFileSync(`${A}/${name}.txt`,`TREFWOORD: ${w}\n\nINHOUD:\n${txt.slice(0,60000)}`);
    let got=0; const all=page.locator('[data-testid="attachment-list:download-all"]').first();
    if(await all.isVisible({timeout:1500}).catch(()=>false)){ try{ const [dl]=await Promise.all([page.waitForEvent('download',{timeout:90000}), all.click()]); const fn=`${A}/${name}__${dl.suggestedFilename()}`; await dl.saveAs(fn); got=1; console.log('  bijlage:',fn.split('/').pop()); }catch(e){ console.log('  download faalde',e.message.slice(0,60)); } }
    console.log(`[${w}] tekst ${txt.length} | bijlagen ${got}`);
  }
  await ctx.storageState({path:OUT+'/proton-state.json'}); await browser.close(); process.exit(0);
})().catch(e=>{console.log('ERR',e.message.slice(0,200));process.exit(1)});

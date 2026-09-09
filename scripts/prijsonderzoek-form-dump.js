// Dumpt formuliervelden (label, name, type, required) van een pagina — leest alleen, verstuurt niets
const { chromium } = require('playwright');
const urls = process.argv.slice(2);
(async()=>{
  const browser = await chromium.launch({headless:true});
  const ctx = await browser.newContext({viewport:{width:1280,height:1000},locale:'nl-NL',userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'});
  for (const url of urls) {
    const page = await ctx.newPage(); page.setDefaultTimeout(20000);
    try {
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:40000}); await page.waitForTimeout(5000);
      // cookie banners
      for (const t of [/accepteer|akkoord|accept|toestaan|alles accepteren|ok/i]) { const b=page.getByRole('button',{name:t}).first(); if(await b.isVisible({timeout:1500}).catch(()=>false)) { await b.click().catch(()=>{}); await page.waitForTimeout(1000);} }
      const fields = await page.evaluate(()=>{
        const out=[]; const els=document.querySelectorAll('form input, form select, form textarea');
        for(const e of els){ if(['hidden','submit','button'].includes(e.type)) continue; const r=e.getBoundingClientRect(); if(!r.width&&!r.height) continue;
          let label=''; if(e.id){const l=document.querySelector(`label[for="${CSS.escape(e.id)}"]`); if(l) label=l.innerText.trim();} if(!label){const l=e.closest('label'); if(l) label=l.innerText.trim();} if(!label){const p=e.closest('div,p,li'); if(p){const l=p.querySelector('label'); if(l) label=l.innerText.trim();}}
          const opts = e.tagName==='SELECT'? Array.from(e.options).map(o=>o.text.trim()).slice(0,12).join('/') : '';
          out.push(`${e.tagName.toLowerCase()}[${e.type||''}] name=${e.name||''} id=${e.id||''} req=${e.required||e.getAttribute('aria-required')==='true'?1:0} label="${label.slice(0,40)}" ph="${(e.placeholder||'').slice(0,30)}"${opts?' opts='+opts:''}`);
        } return out; });
      const forms = await page.$$eval('form',fs=>fs.map(f=>({action:f.action,id:f.id,cls:f.className.slice(0,40)})));
      const btns = await page.$$eval('form button, form input[type=submit]',bs=>bs.map(b=>(b.innerText||b.value||'').trim()).filter(Boolean));
      console.log('=====',url,'\nFORMS',JSON.stringify(forms).slice(0,300),'\nBUTTONS',JSON.stringify(btns)); fields.forEach(f=>console.log('  ',f));
      const cap = await page.content(); console.log('  CAPTCHA:', /recaptcha|hcaptcha|turnstile/i.test(cap)?'ja':'nee');
    } catch(e){ console.log('=====',url,'FOUT',e.message.slice(0,120)); }
    await page.close();
  }
  await browser.close();
})();

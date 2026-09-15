// Zoekt per bedrijf het Google-reviewaantal en de score via Google Maps (headless). Gebruik: node ... "Naam Plaats" ...
const { chromium } = require('playwright');
const OUT='/Users/clawdboot/sonty/data/prijsonderzoek/antwoorden';
setTimeout(()=>{console.log('HARD TIMEOUT');process.exit(2)},10*60*1000);
(async()=>{
  const browser = await chromium.launch({headless:true});
  const ctx = await browser.newContext({viewport:{width:1280,height:900},locale:'nl-NL',userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'});
  const page = await ctx.newPage(); page.setDefaultTimeout(12000);
  const out=[];
  for(const q of process.argv.slice(2)){
    try{
      await page.goto('https://www.google.com/maps/search/'+encodeURIComponent(q)+'?hl=nl',{waitUntil:'domcontentloaded',timeout:40000}); await page.waitForTimeout(4000);
      const consent=page.getByRole('button',{name:/Alles accepteren|Accept all|Alles weigeren|Reject all/i}).first(); if(await consent.isVisible({timeout:2000}).catch(()=>false)){ await consent.click(); await page.waitForTimeout(4000); }
      // resultaat: eerste kaart of direct de plaats
      let info=await page.evaluate(()=>{
        const t=document.body.innerText;
        // aria-labels met sterren en reviews
        const els=[...document.querySelectorAll('[aria-label]')].map(e=>e.getAttribute('aria-label')).filter(a=>/review|recens|sterren|stars/i.test(a));
        const h1=document.querySelector('h1')?.innerText||'';
        return {h1, labels: els.slice(0,6), snippet: t.slice(0,400)};
      });
      let m=null;
      for(const l of info.labels){ const mm=l.match(/([0-9][,.][0-9])\s*(?:sterren|stars)?.*?([0-9][0-9.]*)\s*(?:reviews|recensies|beoordelingen)/i) || l.match(/([0-9][0-9.]*)\s*(?:reviews|recensies|beoordelingen)/i); if(mm){ m=l; break; } }
      if(!m){ // probeer tekst
        const mm=info.snippet.match(/([0-9][,.][0-9])\s*\(?([0-9.]+)\)?/); if(mm) m=mm[0]; }
      out.push({q, h1: info.h1, gevonden: m, labels: info.labels.slice(0,3)});
      console.log(q,'|',info.h1.slice(0,40),'|',m||'?','|',JSON.stringify(info.labels.slice(0,2)).slice(0,160));
    }catch(e){ console.log(q,'| FOUT',e.message.slice(0,80)); out.push({q,fout:e.message.slice(0,80)}); }
  }
  require('fs').writeFileSync(OUT+'/google-reviews-ruw.json',JSON.stringify(out,null,1));
  await page.screenshot({path:OUT+'/google-reviews-laatste.png'});
  await browser.close(); process.exit(0);
})().catch(e=>{console.log('ERR',e.message.slice(0,200));process.exit(1)});

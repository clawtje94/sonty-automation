// Vult een offerte-/contactformulier in met de persona-gegevens en verstuurt het. Gebruik: node ... <code>
const { chromium } = require('playwright');
const fs=require('fs');
const OUT='/Users/clawdboot/sonty/data/prijsonderzoek';
const body=fs.readFileSync(OUT+'/aanvraag-body.txt','utf8');
const P={naam:'Sanne Vermeulen',email:'sanne.vermeulen84@proton.me',onderwerp:'Offerte 2 ritsscreens + 2 rolluiken (Wassenaar)'};
const SITES={
  C:{url:'https://www.solanowonen.nl/contact',fill:async(page)=>{ await page.fill('input[name=name]',P.naam); await page.selectOption('select[name=subject]',{label:'Advies'}); await page.fill('form[action*="contact/post"] input[name=email]',P.email); await page.fill('textarea[name=body]',body); }, submit:'form[action*="contact/post"] button, form[action*="contact/post"] [type=submit]'},
  G:{url:'https://www.zonwering-online.com/contact',fill:async(page)=>{ await page.fill('#input_1_1',P.naam); await page.fill('#input_1_3',P.email); await page.fill('#input_1_5',body); await page.check('#input_1_6_1'); }, submit:'#gform_1 [type=submit], #gform_1 button'},
  B:{url:'https://www.zonweringbestellen.nl/contact',fill:async(page)=>{ await page.selectOption('select[name="form-field-71"]',{label:'Vragen over een product'}); await page.fill('input[name="form-field-72"]',P.email); await page.fill('input[name="form-field-73"]',P.naam); await page.fill('textarea[name="form-field-75"]',body); }, submit:'form[action*="contact#form"] [type=submit], form[action*="contact#form"] button'},
  O:{url:'https://www.homedeal.nl/contact',fill:async(page)=>{ await page.fill('#contact_form_requesterName',P.naam); await page.fill('#contact_form_requesterEmail',P.email); await page.fill('#contact_form_subject',P.onderwerp); await page.fill('#contact_form_commentHtmlBody',body); }, submit:'form.form-horizontal [type=submit], form.form-horizontal button'},
};
const code=process.argv[2]; const S=SITES[code]; if(!S){console.log('onbekende code');process.exit(1);}
const log=(...a)=>console.log(new Date().toISOString().slice(11,19),code,...a);
setTimeout(()=>{log('HARD TIMEOUT');process.exit(2)},3*60*1000);
(async()=>{
  const browser = await chromium.launch({headless:true});
  const ctx = await browser.newContext({viewport:{width:1280,height:1100},locale:'nl-NL',userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'});
  const page = await ctx.newPage(); page.setDefaultTimeout(15000);
  await page.goto(S.url,{waitUntil:'domcontentloaded',timeout:40000}); await page.waitForTimeout(4000);
  const cb=page.getByRole('button',{name:/accepteer|akkoord|accept|toestaan/i}).first(); if(await cb.isVisible({timeout:1500}).catch(()=>false)){await cb.click().catch(()=>{}); await page.waitForTimeout(800);}
  await S.fill(page); log('ingevuld');
  await page.screenshot({path:`${OUT}/verzonden/form-${code}-ingevuld.png`,fullPage:true});
  if(process.argv[3]==='--dry'){ log('DRY, niet verstuurd'); await browser.close(); return; }
  const before=page.url();
  await page.locator(S.submit).first().click(); log('verstuurd-klik');
  await page.waitForTimeout(8000);
  await page.screenshot({path:`${OUT}/verzonden/form-${code}-bevestiging.png`,fullPage:true});
  const t=(await page.innerText('body')).replace(/\s+/g,' ');
  const ok=/bedankt|dank je|dank u|ontvangen|verzonden|succes|we nemen|zo snel mogelijk contact/i.test(t);
  const captcha=/captcha|robot/i.test(t) && !ok;
  const m=t.match(/.{0,80}(bedankt|ontvangen|verzonden|fout|error|captcha|verplicht|vereist).{0,100}/i);
  log('URL',page.url()==before?'(zelfde)':page.url()); log('RESULT',ok?'VERZONDEN':captcha?'CAPTCHA':'ONZEKER','|',m?m[0]:t.slice(0,160));
  await browser.close(); process.exit(ok?0:captcha?5:4);
})().catch(e=>{log('ERR',e.message.slice(0,200));process.exit(1)});

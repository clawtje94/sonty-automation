// Vult een offerte-/contactformulier in met de persona-gegevens en verstuurt het. Gebruik: node ... <code>
const { chromium } = require('playwright');
const fs=require('fs');
const OUT='/Users/clawdboot/sonty/data/prijsonderzoek';
const body=fs.readFileSync(OUT+'/aanvraag-body.txt','utf8');
const P={naam:'Sanne Vermeulen',email:'sanne.vermeulen84@proton.me',tel:'0612345678',onderwerp:'Offerte 2 ritsscreens + 2 rolluiken (Wassenaar)'};
const SITES={
  C:{url:'https://www.solanowonen.nl/contact',fill:async(page)=>{ const ok=page.getByRole('button',{name:/^Oké$/}).first(); if(await ok.isVisible({timeout:2000}).catch(()=>false)) await ok.click(); await page.fill('input[name=name]',P.naam); await page.selectOption('select[name=subject]',{label:'Advies'}); await page.waitForTimeout(1500); const chosen=await page.evaluate(()=>{const sels=Array.from(document.querySelectorAll('form[action*="contact/post"] select[name=topic]')).filter(e=>e.offsetWidth>0||e.offsetHeight>0); if(!sels.length) return 'geen zichtbare topic-select'; const sel=sels[0]; const opts=Array.from(sel.options).filter(o=>o.value); const pick=opts.find(o=>/advies|offerte|product/i.test(o.text))||opts.find(o=>/anders/i.test(o.text))||opts[0]; sel.value=pick.value; sel.dispatchEvent(new Event('change',{bubbles:true})); return sels.length+' zichtbaar; opties: '+opts.map(o=>o.text).join(' | ')+' => '+pick.text;}); log('topic =',chosen); await page.fill('form[action*="contact/post"] input[name=email]',P.email); await page.fill('textarea[name=body]',body); }, submit:'form[action*="contact/post"] button, form[action*="contact/post"] [type=submit]'},
  G:{url:'https://www.zonwering-online.com/contact',fill:async(page)=>{ await page.fill('#input_1_1',P.naam); log('naam'); await page.fill('#input_1_3',P.email); await page.fill('#input_1_5',body); log('bericht'); await page.evaluate(()=>{const e=document.querySelector('#input_1_6_1'); e.checked=true; e.dispatchEvent(new Event('change',{bubbles:true}));}); }, submit:'#gform_1 [type=submit], #gform_1 button'},
  B:{url:'https://www.zonweringbestellen.nl/contact',fill:async(page)=>{ await page.selectOption('select[name="form-field-71"]',{label:'Vragen over een product'}); await page.fill('input[name="form-field-72"]',P.email); await page.fill('input[name="form-field-73"]',P.naam); await page.fill('textarea[name="form-field-75"]',body); }, submit:'form[action*="contact#"] button, form[action*="contact#"] input[type=submit]'},
  O:{url:'https://www.homedeal.nl/contact',fill:async(page)=>{ await page.fill('#contact_form_requesterName',P.naam); await page.fill('#contact_form_requesterEmail',P.email); await page.fill('#contact_form_subject',P.onderwerp); await page.fill('#contact_form_commentHtmlBody',body); }, submit:'form.form-horizontal [type=submit], form.form-horizontal button'},
};
SITES.F={url:'https://zonenscherm.nl/offerte-aanvragen/',fill:async(page)=>{ const f='form[action*="offerte-aanvragen"]'; await page.evaluate(()=>{const r=document.querySelector('#form-field-field_93b6c32-1'); if(r){r.checked=true; r.dispatchEvent(new Event('change',{bubbles:true}));}}); await page.fill('#form-field-name',P.naam); await page.fill('#form-field-field_d722d82','Backershagenlaan 56'); await page.fill('#form-field-field_7cecb6a','2243 AE'); await page.fill('#form-field-field_89eb0bb','Wassenaar'); await page.locator('#form-field-email').first().fill(P.email); await page.fill('#form-field-telefoon',P.tel); await page.selectOption('#form-field-field_c7cc954',{label:'Screens'}); await page.fill('#form-field-field_d45e3cf','2 screens 237x228 en 176x214, 2 rolluiken 204x236 en 143x197'); await page.fill('#form-field-message',body); }, submit:'form:has(#form-field-name) button[type=submit], form:has(#form-field-name) .elementor-button'};
SITES.J={url:'https://www.creon-rolluiken.nl/contacts',fill:async(page)=>{ log('start J'); await page.fill('#firstname','Sanne'); log('voornaam'); await page.fill('#lastname','Vermeulen'); await page.fill('#email',P.email); await page.fill('#telephone',P.tel); await page.selectOption('select[name=subject_id]',{label:'Offerte aanvraag'}); await page.fill('#message',body); await page.evaluate(()=>{const e=document.querySelector('#agreement'); e.checked=true; e.dispatchEvent(new Event('change',{bubbles:true}));}); }, submit:'form.page__form [type=submit], form.page__form button'};
const code=process.argv[2]; const S=SITES[code]; if(!S){console.log('onbekende code');process.exit(1);}
const log=(...a)=>console.log(new Date().toISOString().slice(11,19),code,...a);
setTimeout(()=>{log('HARD TIMEOUT');process.exit(2)},2*60*1000);
(async()=>{
  const browser = await chromium.launch({headless:true});
  const ctx = await browser.newContext({viewport:{width:1280,height:1100},locale:'nl-NL',userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'});
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  await page.goto(S.url,{waitUntil:'domcontentloaded',timeout:40000}); await page.waitForTimeout(4000);
  const cb=page.getByRole('button',{name:/accepteer|akkoord|accept|toestaan/i}).first(); if(await cb.isVisible({timeout:1500}).catch(()=>false)){await cb.click().catch(()=>{}); await page.waitForTimeout(800);}
  log('pagina geladen'); await S.fill(page); log('ingevuld');
  await page.screenshot({path:`${OUT}/verzonden/form-${code}-ingevuld.png`,fullPage:true});
  if(process.argv[3]==='--dry'){ log('DRY, niet verstuurd'); await browser.close(); process.exit(0); }
  const before=page.url();
  try{ await page.locator(S.submit).first().click({timeout:8000}); log('verstuurd-klik'); }catch(e){ log('klik faalde, requestSubmit'); await page.evaluate(sel=>{const b=document.querySelector(sel); const f=b?b.closest('form'):null; if(f) f.requestSubmit(b&&b.type==='submit'?b:undefined); else throw new Error('geen form');}, S.submit.split(',')[0]); }
  await page.waitForTimeout(8000);
  await page.screenshot({path:`${OUT}/verzonden/form-${code}-bevestiging.png`,fullPage:true});
  const t=(await page.innerText('body')).replace(/\s+/g,' ');
  const ok=/bedankt|dank je|dank u|ontvangen|verzonden|succes|we nemen|zo snel mogelijk contact/i.test(t);
  const captcha=/captcha|robot/i.test(t) && !ok;
  const m=t.match(/.{0,80}(bedankt|ontvangen|verzonden|fout|error|captcha|verplicht|vereist).{0,100}/i);
  log('URL',page.url()==before?'(zelfde)':page.url()); log('RESULT',ok?'VERZONDEN':captcha?'CAPTCHA':'ONZEKER','|',m?m[0]:t.slice(0,160));
  await browser.close(); process.exit(ok?0:captcha?5:4);
})().catch(e=>{log('ERR',e.message.slice(0,200));process.exit(1)});

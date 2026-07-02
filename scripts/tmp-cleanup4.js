const { chromium } = require('playwright');
const TEST_PID = '23944e59-c24d-4032-a9fa-dbdb6f52bc94';
const BASE = 'https://backend.reuzenpanda.nl';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  await page.goto('https://hub.reuzenpanda.nl/login', { timeout: 60000 });
  await page.waitForTimeout(3000);
  const e = await page.$('input[placeholder*="mail"], input[type="email"]');
  if (e) { await e.fill('daimyboot@gmail.com'); let pw = await page.$('input[type="password"]'); if (!pw) { await page.keyboard.press('Enter'); await page.waitForTimeout(3000); pw = await page.$('input[type="password"]'); } if (pw) { await pw.fill('TQGb@eD%5nGRSN9@4Gss'); await page.keyboard.press('Enter'); } await page.waitForTimeout(6000); }
  const t = await page.$('text=Sonty test'); if (t) { await t.click(); await page.waitForTimeout(5000); }
  const call = (m, ep, body) => page.evaluate(async ({ m, url, body }) => { const r = await fetch(url, { method: m, credentials: 'include', headers: body ? {'Content-Type':'application/json'} : undefined, body: body ? JSON.stringify(body) : undefined }); let j=null; const txt=await r.text(); try{j=JSON.parse(txt);}catch{} return { s: r.status, j, t: txt.slice(0,120) }; }, { m, url: BASE + ep, body });
  const arts = (await call('GET', `/inventory-service/${TEST_PID}/articles`)).j.article || [];
  const orphans = arts.filter(a => (a.sku || '').startsWith('TP-HOR'));
  console.log('Toppoint-horren gevonden:', orphans.length);
  const d = await call('DELETE', `/inventory-service/${TEST_PID}/articles/${orphans[0].id}`);
  console.log('DELETE probe:', d.s, d.t);
  let done = (d.s === 200) ? 1 : 0;
  const rest = (d.s === 200) ? orphans.slice(1) : orphans;
  const useDelete = d.s === 200;
  for (const a of rest) {
    const r = useDelete
      ? await call('DELETE', `/inventory-service/${TEST_PID}/articles/${a.id}`)
      : await call('POST', `/inventory-service/${TEST_PID}/articles`, { article: { ...a, archived: true } });
    if (r.s === 200) done++; else if (done === 0) { console.log('faalt:', r.s, r.t); break; }
  }
  console.log('opgeruimd:', done);
  const na = (await call('GET', `/inventory-service/${TEST_PID}/articles`)).j.article || [];
  console.log('TP-HOR actief nu:', na.filter(a=>(a.sku||'').startsWith('TP-HOR') && !a.archived).length, '| totaal actief:', na.filter(a=>!a.archived).length);
  await browser.close();
})();

/**
 * Haal berichten uit de gedeelde mailbox werkbon@sonty.nl (alleen-lezen).
 * 1) Probeert de Outlook REST API met het onderschepte OWA-token.
 * 2) Valt terug op UI-iteratie: klikt berichten aan en leest het leesvenster.
 * Output: data/werkbon-messages.json
 */
const { chromium } = require('playwright');
const fs = require('fs');

const MAX = parseInt(process.argv[2] || '120', 10);
const OUT = __dirname + '/../data/werkbon-messages.json';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  let owaToken = null;
  page.on('request', (req) => {
    const auth = req.headers()['authorization'];
    if (auth && auth.startsWith('Bearer ') && req.url().includes('outlook.office.com')) {
      owaToken = auth.replace('Bearer ', '');
    }
  });

  // Inloggen als joey
  await page.goto('https://outlook.office.com/mail/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  const emailInput = await page.$('input[type="email"], input[name="loginfmt"]');
  if (emailInput) {
    await emailInput.fill('joey@sontymontage.nl');
    await page.locator('input[type="submit"]').click();
    await page.waitForTimeout(3000);
    const pwInput = await page.$('input[type="password"]');
    if (pwInput) {
      await pwInput.fill('Shja..59');
      await page.locator('input[type="submit"]').click();
      await page.waitForTimeout(3000);
    }
    try {
      const yesBtn = page.locator('input[value="Yes"], input[value="Ja"], #idSIButton9');
      if (await yesBtn.count()) { await yesBtn.first().click(); await page.waitForTimeout(3000); }
    } catch {}
  }

  await page.goto('https://outlook.office.com/mail/werkbon@sonty.nl/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(8000);

  // Poging 1: REST API met OWA-token
  if (owaToken) {
    try {
      const msgs = [];
      let skip = 0, ok = true;
      while (msgs.length < MAX) {
        const res = await page.request.get(
          'https://outlook.office.com/api/v2.0/users/werkbon@sonty.nl/messages?$top=100&$skip=' + skip +
          '&$select=Subject,From,ReceivedDateTime,Body&$orderby=ReceivedDateTime desc',
          { headers: { Authorization: 'Bearer ' + owaToken, Accept: 'application/json' } }
        );
        if (res.status() === 429) { console.log('429, 30s wachten...'); await page.waitForTimeout(30000); continue; }
        if (!res.ok()) { console.log('REST faalt:', res.status()); ok = msgs.length > 0; break; }
        const data = await res.json();
        const batch = (data.value || []).map((m) => ({
          subject: m.Subject,
          from: m.From?.EmailAddress?.Address,
          received: m.ReceivedDateTime,
          body: (m.Body?.Content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000),
        }));
        msgs.push(...batch);
        console.log('opgehaald:', msgs.length);
        if (batch.length < 100) break;
        skip += 100;
      }
      if (ok && msgs.length) {
        fs.writeFileSync(OUT, JSON.stringify({ via: 'rest', count: msgs.length, messages: msgs.slice(0, MAX) }, null, 2));
        console.log('REST OK:', msgs.length, 'berichten');
        await browser.close();
        return;
      }
    } catch (e) { console.log('REST error:', e.message); }
  }

  // Poging 2: UI-iteratie
  const seen = new Set();
  const messages = [];
  let stale = 0;

  const listSel = '[role="listbox"] [role="option"]';
  while (messages.length < MAX && stale < 3) {
    const rows = await page.$$(listSel);
    let progressed = false;
    for (let i = 0; i < rows.length && messages.length < MAX; i++) {
      const rowText = await rows[i].innerText().catch(() => null);
      if (!rowText) continue;
      const key = rowText.replace(/\s+/g, ' ').slice(0, 150);
      if (seen.has(key)) continue;
      seen.add(key);
      progressed = true;
      try {
        await rows[i].click();
        await page.waitForTimeout(1600);
        const body = await page.evaluate(() => {
          const main = document.querySelector('[role="main"]');
          return main ? main.innerText.replace(/\s+/g, ' ').trim().slice(0, 3000) : null;
        });
        messages.push({ row: key, body });
        if (messages.length % 10 === 0) console.log(messages.length + ' gelezen...');
      } catch (e) { /* volgende */ }
    }
    if (!progressed) stale++; else stale = 0;
    // verder scrollen in de lijst voor oudere berichten
    await page.evaluate(() => {
      const lb = document.querySelector('[role="listbox"]');
      if (lb) lb.scrollBy(0, 1200);
      const sc = document.querySelector('[data-animatable="true"]')?.parentElement;
      if (sc) sc.scrollBy(0, 1200);
    });
    await page.waitForTimeout(2000);
  }

  fs.writeFileSync(OUT, JSON.stringify({ via: 'ui', count: messages.length, messages }, null, 2));
  console.log('UI OK:', messages.length, 'berichten');
  await browser.close();
})();

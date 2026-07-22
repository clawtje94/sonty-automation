// Haalt ONGELEZEN berichten uit map "Trengo open" van orders@sonty.nl (alleen-lezen).
// Output: scratchpad/orders-inbox-mails.json (met Id voor later op-gelezen-zetten).
const { chromium } = require('/Users/clawdboot/sonty/node_modules/playwright');
const fs = require('fs');
const OUT = '/private/tmp/claude-501/-Users-clawdboot/039c49c4-953a-4631-af16-9c06ee73ba2c/scratchpad/orders-inbox-mails.json';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  let owaToken = null;
  page.on('request', (req) => {
    const auth = req.headers()['authorization'];
    if (auth && auth.startsWith('Bearer ') && req.url().includes('outlook.office.com')) owaToken = auth.replace('Bearer ', '');
  });
  await page.goto('https://outlook.office.com/mail/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  const emailInput = await page.$('input[type="email"], input[name="loginfmt"]');
  if (emailInput) {
    await emailInput.fill('joey@sontymontage.nl');
    await page.locator('input[type="submit"]').click();
    await page.waitForTimeout(3000);
    const pwInput = await page.$('input[type="password"]');
    if (pwInput) { await pwInput.fill('Shja..59'); await page.locator('input[type="submit"]').click(); await page.waitForTimeout(3000); }
    try {
      const yesBtn = page.locator('input[value="Yes"], input[value="Ja"], #idSIButton9');
      if (await yesBtn.count()) { await yesBtn.first().click(); await page.waitForTimeout(3000); }
    } catch {}
  }
  await page.waitForTimeout(8000);
  if (!owaToken) { console.log('GEEN TOKEN'); process.exit(1); }
  const H = { Authorization: 'Bearer ' + owaToken, Accept: 'application/json' };
  const base = 'https://outlook.office.com/api/v2.0/users/orders@sonty.nl';
  const fRes = await page.request.get(base + "/MailFolders?$top=250", { headers: H });
  const folders = (await fRes.json()).value || [];
    const mRes = await page.request.get(
    base + `/MailFolders/Inbox/messages?$filter=IsRead eq false&$top=50&$select=Subject,From,ReceivedDateTime,Body,IsRead&$orderby=ReceivedDateTime asc`,
    { headers: H }
  );
  if (!mRes.ok()) { console.log('MSG FOUT', mRes.status(), (await mRes.text()).slice(0, 300)); process.exit(1); }
  const msgs = ((await mRes.json()).value || []).map((m) => ({
    id: m.Id,
    subject: m.Subject,
    from: m.From?.EmailAddress?.Address,
    received: m.ReceivedDateTime,
    body: (m.Body?.Content || '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 4000),
  }));
  fs.writeFileSync(OUT, JSON.stringify(msgs, null, 2));
  console.log('opgehaald:', msgs.length, 'ongelezen');
  msgs.forEach((m, i) => console.log(i + 1, '|', m.received?.slice(0, 10), '|', m.from, '|', (m.subject || '').slice(0, 90)));
  await browser.close();
})();

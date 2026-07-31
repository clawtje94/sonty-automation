// Headless browsertest van de echte WebRTC-belflow (nepmicrofoon, geen venster).
// node webrtc-test.js
const { chromium } = require('/Users/clawdboot/sonty/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const ctx = await browser.newContext({ permissions: ['microphone'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[PAGE-ERROR]', e.message));
  await page.goto('http://localhost:3131');
  await page.click('#bel');
  await page.waitForFunction(
    () => /Verbonden|Mislukt/.test(document.getElementById('status').textContent),
    { timeout: 30000 }
  );
  // Testvraag via het datakanaal (nepmicrofoon praat niet zelf)
  await page.evaluate(() => {
    window._dc.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Hoi, wat kost een rolluik S42 van twee meter breed en twee meter hoog, met io bediening?' } ] } }));
    window._dc.send(JSON.stringify({ type: 'response.create' }));
  });
  await page.waitForFunction(
    () => document.getElementById('log').textContent.includes('prijs_berekenen'),
    { timeout: 60000 }
  ).catch(() => console.log('(geen toolcall binnen 60s)'));
  await page.waitForTimeout(20000);
  console.log('STATUS:', (await page.textContent('#status')).trim());
  console.log('LOG:\n' + (await page.textContent('#log')).trim());
  await page.screenshot({ path: process.env.SHOT || '/tmp/bas-webrtc-test.png' });
  await browser.close();
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });

#!/usr/bin/env node
// MONTAGE-RAPPORT (opdracht Daimy 30 juli 2026): hoeveel opdrachten monteren we per
// week en per maand — los van inmeten en service — voor de vraag hoeveel monteurs
// erbij moeten om de verkoopdruk aan te kunnen.
//
// Bron: Outlook-agenda "Sonty Montage" via OWA-token (zelfde route en classificatie-
// regels als agenda-full-sync-2026-07.js). Planado is (nog) vrijwel leeg — 20 test-
// jobs — dus de agenda is de waarheid. Headless (venster nooit op Daimys scherm).
// Gebruik: node scripts/montage-rapport.js [--stuur]
const { chromium } = require('playwright');
const fs = require('fs');

const BLOCKED = ['vakantie', 'vrij', 'niet inplannen', 'niet plannen', 'tandarts', 'dokter', 'ziek', 'verlof', 'afwezig', 'niet beschikbaar', 'feestdag'];
const soort = s => { const t = (s || '').toLowerCase();
  if (t.includes('inmeten') || t.includes('inmeet') || t.includes('opmeting')) return 'inmeten';
  if (t.includes('reparatie') || t.includes('service') || t.includes('onderhoud') || t.includes('garantie')) return 'service';
  if (t.includes('showroom') || t.includes('winkel') || t.includes('advies')) return 'overig';
  return 'montage'; };
const wk = d => { const t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const y = new Date(t.getFullYear(), 0, 4);
  return `${t.getFullYear()}-W${String(1 + Math.round(((t - y) / 864e5 - 3 + ((y.getDay() + 6) % 7)) / 7)).padStart(2, '0')}`; };

async function owaToken() {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  let token = null;
  page.on('request', req => { const a = req.headers()['authorization'];
    if (a?.startsWith('Bearer ') && req.url().includes('outlook.office.com')) {
      const t = a.replace('Bearer ', '');
      try { if (Buffer.from(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString().includes('Calendar')) token = t; } catch {}
    } });
  await page.goto('https://outlook.office.com/calendar');
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(2000);
  const em = await page.$('input[type="email"], input[name="loginfmt"]');
  if (em) {
    await em.fill('joey@sontymontage.nl');
    await page.locator('input[type="submit"]').click();
    await page.waitForLoadState('networkidle'); await page.waitForTimeout(3000);
    const pw = await page.$('input[type="password"]');
    if (pw) { await pw.fill('Shja..59'); await page.locator('input[type="submit"]').click();
      await page.waitForLoadState('networkidle'); await page.waitForTimeout(3000); }
    try { const ja = page.locator('input[value="Yes"], input[value="Ja"]');
      if (await ja.first().isVisible({ timeout: 5000 })) { await ja.first().click(); await page.waitForTimeout(5000); } } catch {}
  }
  await page.waitForTimeout(8000);
  await browser.close();
  return token;
}

(async () => {
  const token = await owaToken();
  if (!token) { console.error('geen Outlook-token'); process.exit(1); }
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const cals = (await (await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: H })).json()).value || [];
  const cal = cals.find(c => c.Name === 'Sonty Montage');
  if (!cal) { console.error('agenda "Sonty Montage" niet gevonden; wel: ' + cals.map(c => c.Name).join(', ')); process.exit(1); }

  const nu = new Date();
  const van = new Date(nu); van.setDate(van.getDate() - 70);
  const tot = new Date(nu); tot.setDate(tot.getDate() + 21);
  let evs = [], url = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView?$top=500&$select=Subject,Start,End,IsCancelled&startDateTime=${van.toISOString()}&endDateTime=${tot.toISOString()}`;
  while (url) { const j = await (await fetch(url, { headers: H })).json();
    evs.push(...(j.value || [])); url = j['@odata.nextLink'] || null; }

  const perWeek = {}, perMaand = {};
  let dezeWeekMontage = 0, dezeWeekUren = 0;
  const huidigeWeek = wk(nu);
  for (const e of evs) {
    if (e.IsCancelled) continue;
    const sub = e.Subject || '', sl = sub.toLowerCase();
    if (BLOCKED.some(k => sl.includes(k))) continue;
    if (!sub.includes(' - ') && soort(sub) === 'montage') continue;   // notitie/placeholder, geen klant
    const start = e.Start?.DateTime; if (!start) continue;
    const d = new Date(start);
    const g = soort(sub);
    const uren = e.End?.DateTime ? Math.min(12, Math.max(0, (new Date(e.End.DateTime) - d) / 36e5)) : 2;
    const kw = wk(d), km = start.slice(0, 7);
    (perWeek[kw] = perWeek[kw] || { montage: 0, mUren: 0, inmeten: 0, service: 0, overig: 0, klanten: new Set() });
    (perMaand[km] = perMaand[km] || { montage: 0, mUren: 0, inmeten: 0, service: 0, overig: 0, klanten: new Set() });
    perWeek[kw][g]++; perMaand[km][g]++;
    // Uniek op klantnaam BINNEN het venster: een pergola over 2 dagen = 2 afspraken
    // maar 1 opdracht (audit 30 juli: 15 van 289 juli-afspraken waren een 2e bezoek).
    if (g === 'montage') { const klant = sub.split(' - ').slice(1).join(' - ').trim().toLowerCase();
      perWeek[kw].klanten.add(klant); perMaand[km].klanten.add(klant); }
    if (g === 'montage') { perWeek[kw].mUren += uren; perMaand[km].mUren += uren;
      if (kw === huidigeWeek && d <= nu) { dezeWeekMontage++; dezeWeekUren += uren; } }
  }

  const L = [];
  L.push(`MONTAGES — agenda "Sonty Montage", stand ${nu.toISOString().slice(0, 10)}`);
  L.push('montage = klantafspraak zonder inmeet/service/reparatie/onderhoud in de titel');
  L.push('');
  L.push(`DEZE WEEK T/M NU: ${dezeWeekMontage} montages uitgevoerd (${Math.round(dezeWeekUren)} uur)`);
  L.push('');
  L.push('week      | montage (uren) | inmeten | service | overig');
  for (const w of Object.keys(perWeek).sort()) { const m = perWeek[w];
    const mark = w === huidigeWeek ? '*' : w > huidigeWeek ? '+' : ' ';
    L.push(`${w}${mark} | ${String(m.montage).padStart(7)} (${String(Math.round(m.mUren)).padStart(3)}) | ${String(m.inmeten).padStart(7)} | ${String(m.service).padStart(7)} | ${String(m.overig).padStart(6)}`); }
  L.push('* = lopende week, + = vooruit gepland');
  L.push('');
  L.push('maand   | afspraken | UNIEKE OPDRACHTEN | uren | inmeten | overig');
  for (const m of Object.keys(perMaand).sort()) { const x = perMaand[m];
    L.push(`${m} | ${String(x.montage).padStart(9)} | ${String(x.klanten.size).padStart(17)} | ${String(Math.round(x.mUren)).padStart(4)} | ${String(x.inmeten).padStart(7)} | ${String(x.overig).padStart(6)}`); }
  L.push('');
  L.push('afspraken = bezoeken; unieke opdrachten = ontdubbeld op klant (meerdaagse');
  L.push('klussen en terugkombezoeken tellen dan 1x). Service loopt buiten deze agenda.');
  L.push('"uitgevoerd" = stond gepland en is niet geannuleerd; no-shows ziet de agenda niet.');
  const tekst = L.join('\n');
  console.log(tekst);
  if (process.argv.includes('--stuur'))
    require('child_process').execFileSync('node', [__dirname + '/sonty-data-send.js', tekst, '--code'], { stdio: 'inherit' });
})();

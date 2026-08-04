#!/usr/bin/env node
// EXTRA-WERK-MAANDRAPPORT — telt 1x per maand hoeveel montage-afspraken met een
// "EXTRA WERK"-vermelding er in de VORIGE (net afgelopen) maand zijn gedaan, uit de
// Outlook-agenda "Sonty Montage", en stuurt dat naar Daimy via Telegram.
//
// Draait via launchd nl.sonty.extrawerk-maandrapport op de 1e van de maand 09:00
// (= binnen de eerste week). Rapporteert altijd de vorige maand.
//
// Detectie is exact zoals geverifieerd op 4-8-2026: subject/body bevat "extra werk" of
// "meerwerk". Bredere termen (tevens, toegevoegd, ...) gaven valse treffers en tellen NIET mee.
//
// Handmatig draaien:
//   node scripts/extra-werk-maandrapport.js                 -> vorige maand, stuurt Telegram
//   node scripts/extra-werk-maandrapport.js --maand 2026-07 -> die maand, stuurt Telegram
//   node scripts/extra-werk-maandrapport.js --maand 2026-07 --droog  -> alleen printen, niks sturen
const fs = require('fs');
const path = require('path');
const { chromium } = require('/Users/clawdboot/sonty/node_modules/playwright');
const SECRETS = require('/Users/clawdboot/sonty/scripts/secrets.js');

const TOKEN_FILE = path.join(__dirname, '.owa-token.txt');
const MAAND_NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
// Deelnemers die planner/kantoor zijn, geen uitvoerend monteur: uit de per-monteur-uitsplitsing houden.
const GEEN_MONTEUR = /joey engelen/i;
const EXTRA_RE = /extra werk|meerwerk/i;

const arg = (naam) => { const i = process.argv.indexOf(naam); return i > -1 ? process.argv[i + 1] : null; };
const bodyTekst = (e) => String(e.Body?.Content || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// Bepaal doelmaand: --maand YYYY-MM, anders de vorige maand t.o.v. nu.
function doelMaand() {
  const m = arg('--maand');
  if (m && /^\d{4}-\d{1,2}$/.test(m)) { const [y, mm] = m.split('-').map(Number); return { jaar: y, maand: mm }; }
  const now = new Date();
  let jaar = now.getFullYear(), maand = now.getMonth(); // getMonth() = huidige (0-index) = vorige maand als 1-index
  if (maand === 0) { maand = 12; jaar -= 1; }
  return { jaar, maand };
}

// OWA-token verversen via headless browser-login (zelfde flow als planning-mail-daemon).
async function verversToken() {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  let token = null;
  page.on('request', (req) => {
    const a = req.headers()['authorization'];
    if (a && a.startsWith('Bearer ') && req.url().includes('outlook.office.com')) token = a.replace('Bearer ', '');
  });
  await page.goto('https://outlook.office.com/mail/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  const emailInput = await page.$('input[type="email"], input[name="loginfmt"]');
  if (emailInput) {
    await emailInput.fill(SECRETS.OWA_LOGIN.email);
    await page.locator('input[type="submit"]').click();
    await page.waitForTimeout(3000);
    const pw = await page.$('input[type="password"]');
    if (pw) { await pw.fill(SECRETS.OWA_LOGIN.password); await page.locator('input[type="submit"]').click(); await page.waitForTimeout(3000); }
    try { const y = page.locator('input[value="Yes"], input[value="Ja"], #idSIButton9'); if (await y.count()) { await y.first().click(); await page.waitForTimeout(3000); } } catch {}
  }
  await page.waitForTimeout(8000);
  await browser.close();
  if (!token) throw new Error('geen OWA-token gekregen bij login');
  try { fs.writeFileSync(TOKEN_FILE, token); } catch {}
  return token;
}

// Test of de bestaande token nog werkt; zo niet, verversen.
async function geldigToken() {
  let token = null;
  try { token = fs.readFileSync(TOKEN_FILE, 'utf8').trim(); } catch {}
  if (token) {
    const r = await fetch('https://outlook.office.com/api/v2.0/me/calendars?$select=Name&$top=1', { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
    if (r.ok) return token;
  }
  return await verversToken();
}

async function haalMaandEvents(token, jaar, maand) {
  const H = { Authorization: 'Bearer ' + token, Accept: 'application/json' };
  const cals = ((await (await fetch('https://outlook.office.com/api/v2.0/me/calendars?$select=Name&$top=50', { headers: H })).json()).value) || [];
  const sm = cals.find((c) => c.Name === 'Sonty Montage');
  if (!sm) throw new Error('agenda "Sonty Montage" niet gevonden');
  const start = `${jaar}-${String(maand).padStart(2, '0')}-01T00:00:00Z`;
  const endJaar = maand === 12 ? jaar + 1 : jaar, endMaand = maand === 12 ? 1 : maand + 1;
  const eind = `${endJaar}-${String(endMaand).padStart(2, '0')}-01T00:00:00Z`;
  let evs = [], url = `https://outlook.office.com/api/v2.0/me/calendars/${sm.Id}/calendarview?startDateTime=${start}&endDateTime=${eind}&$select=Subject,Start,Attendees,Body&$top=200`;
  while (url) { const j = await (await fetch(url, { headers: H })).json(); evs = evs.concat(j.value || []); url = j['@odata.nextLink'] || null; }
  return evs;
}

function bouwRapport(evs, jaar, maand) {
  const montage = evs.filter((e) => /^montage sonty/i.test((e.Subject || '').trim()));
  const extra = montage.filter((e) => EXTRA_RE.test((e.Subject || '') + ' ' + bodyTekst(e)));
  const perMonteur = {};
  const regels = [];
  for (const e of extra) {
    const monteurs = (e.Attendees || []).map((a) => a.EmailAddress?.Name || '')
      .filter((n) => /\| sonty/i.test(n) && !GEEN_MONTEUR.test(n))
      .map((n) => n.replace(/\s*\|\s*sonty.*$/i, '').trim());
    for (const m of new Set(monteurs)) perMonteur[m] = (perMonteur[m] || 0) + 1;
    const dag = String(e.Start?.DateTime || '').slice(8, 10);
    const klant = (e.Subject || '').replace(/^montage sonty\s*-?\s*/i, '').trim() || '(geen naam)';
    regels.push(`- ${dag} ${MAAND_NL[maand - 1].slice(0, 3)}, ${klant.slice(0, 35)}${monteurs.length ? ' (' + [...new Set(monteurs)].join(', ') + ')' : ''}`);
  }
  const lines = [`📋 Extra werk - maandrapport ${MAAND_NL[maand - 1]} ${jaar}`, '',
    `Totaal: ${extra.length} montage-afspraken met een "EXTRA WERK"-vermelding.`];
  const mSort = Object.entries(perMonteur).sort((a, b) => b[1] - a[1]);
  if (mSort.length) { lines.push('', 'Per monteur:'); for (const [m, c] of mSort) lines.push(`- ${m}: ${c}`); }
  if (regels.length) { lines.push('', 'Afspraken:', ...regels); }
  if (!extra.length) lines.push('', 'Geen enkele montage-afspraak had deze maand een extra-werk-vermelding.');
  return lines.join('\n');
}

async function stuurTelegram(tekst) {
  const r = await fetch(`https://api.telegram.org/bot${SECRETS.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: SECRETS.TELEGRAM_CHAT_ID, text: tekst }),
  });
  if (!r.ok) throw new Error('Telegram fout ' + r.status());
}

(async () => {
  const { jaar, maand } = doelMaand();
  const token = await geldigToken();
  const evs = await haalMaandEvents(token, jaar, maand);
  const tekst = bouwRapport(evs, jaar, maand);
  console.log(tekst);
  if (!process.argv.includes('--droog')) { await stuurTelegram(tekst); console.log('\n[verzonden naar Telegram]'); }
})().catch(async (e) => {
  console.log('FOUT:', e.message.slice(0, 200));
  // Niet stil falen: meld het aan Daimy zodat een dood token / login-probleem opvalt.
  try { await stuurTelegram('⚠️ Extra-werk-maandrapport kon niet draaien: ' + e.message.slice(0, 150) + '\n(check Outlook-login/token)'); } catch {}
  process.exit(1);
});

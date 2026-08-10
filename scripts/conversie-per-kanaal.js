#!/usr/bin/env node
// CONVERSIE PER VERZENDKANAAL (mail vs WhatsApp) — opdracht Daimy 30 juli 2026.
//
// Definities (van Daimy):
//   conversie   = akkoorden / TOTAAL verstuurde offertes (elke sheet-rij = verstuurd)
//   akkoord     = inkoopkolom gevuld (ook €1) OF akkoord-blok (correctie 28 juli)
//   per kanaal  = offerte ook via WhatsApp gestuurd (staat in scripts/.wa-offerte-sent.json,
//                 bord-item-ids) of alleen per mail. WA-klanten krijgen de mail ÓÓK;
//                 "WA" betekent dus: mail + WhatsApp erbij.
// Koppeling WA→sheet: bord-item (telefoon) → sheet-rij (telefoon, laatste 9 cijfers),
// WA-moment binnen 14 dagen na offertedatum. NOOIT op naam (zie memory sheet-structuur).
// Venster: laatste 4 volle ISO-weken per week + vorige kalendermaand als totaal.
const fs = require('fs');
const KS = require('./ai-ks/config.js');
const RP = 'https://backend.reuzenpanda.nl', PID = KS.RP_PID, H = { Authorization: 'Bearer ' + KS.RP_API_KEY };

const isAkk = r => r.inkoop > 0 || r.akkoordBedrag > 0 || /^\d{3,6}$/.test(r.nummer || '') || !!r.akkoordDatum;
const pd = t => { const s = String(t || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); }
  return null; };
const wk = d => { const t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const y = new Date(t.getFullYear(), 0, 4);
  return `${t.getFullYear()}-W${String(1 + Math.round(((t - y) / 864e5 - 3 + ((y.getDay() + 6) % 7)) / 7)).padStart(2, '0')}`; };
const pct = (a, b) => b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : '—';

(async () => {
  // 1. WA-verzendingen: item-id -> tijdstip, plus telefoon uit het bord
  const waLog = JSON.parse(fs.readFileSync(__dirname + '/.wa-offerte-sent.json', 'utf8'));
  const r = await fetch(`${RP}/contact-service/${PID}/backlogs/${KS.RP_BACKLOG}/items`, { headers: H });
  const items = (await r.json()).items || [];
  const waPerTel = new Map(); // tel(9) -> [Date, ...]
  for (const it of items) {
    const t = waLog[it.id]; if (!t) continue;
    const tel = String(it.fields?.phone || '').replace(/\D/g, '').slice(-9);
    if (tel.length < 9) continue;
    if (!waPerTel.has(tel)) waPerTel.set(tel, []);
    waPerTel.get(tel).push(new Date(t));
  }
  console.log(`WA-verzendingen gekoppeld aan telefoon: ${waPerTel.size} klanten (log: ${Object.keys(waLog).length} items)`);

  // 2. Sheet-rijen met week + kanaal
  const rows = JSON.parse(fs.readFileSync(__dirname + '/../data/conversie-2026-raw.json', 'utf8')).rows;
  const nu = new Date();
  const huidigeWeek = wk(nu);
  const isWa = r => { const l = waPerTel.get(r.tel); if (!l) return false;
    const d = pd(r.celDatum); if (!d) return false;
    return l.some(w => (w - d) / 864e5 >= -2 && (w - d) / 864e5 <= 14); };

  // Zuivere vergelijking (les 30 juli): rijen ZONDER bruikbaar 06-nummer kunnen nooit
  // als WA gelabeld worden en converteren extreem hoog (akkoord-rijen, "zie gripp",
  // winkel) — die vervuilden "mail". Daarom: WA en mail alleen op online rijen met
  // geldig nummer; winkel + geen-nummer apart als "overig".
  const telOk = r => r.tel && r.tel.length >= 9;
  const winkel = r => String(r.kanaal || '').toLowerCase().startsWith('winkel');
  const cel = () => ({ tot: 0, akk: 0, waT: 0, waA: 0, mT: 0, mA: 0, oT: 0, oA: 0 });
  const tel = (m, r) => { m.tot++; const a = isAkk(r);
    if (a) m.akk++;
    if (!telOk(r) || winkel(r)) { m.oT++; if (a) m.oA++; }
    else if (isWa(r)) { m.waT++; if (a) m.waA++; }
    else { m.mT++; if (a) m.mA++; } };

  // laatste 4 VOLLE weken
  const weken = [];
  for (let i = 4; i >= 1; i--) { const d = new Date(nu); d.setDate(d.getDate() - 7 * i); weken.push(wk(d)); }
  const perWeek = Object.fromEntries(weken.map(w => [w, cel()]));
  // vorige kalendermaand
  const vorigeMaand = new Date(nu.getFullYear(), nu.getMonth() - 1, 1);
  const vmNum = vorigeMaand.getMonth() + 1, vmNaam = vorigeMaand.toLocaleString('nl-NL', { month: 'long' });
  const mnd = cel();

  for (const r of rows) {
    const d = pd(r.celDatum); if (!d) continue;
    const w = wk(d);
    if (perWeek[w]) tel(perWeek[w], r);
    if (d.getFullYear() === vorigeMaand.getFullYear() && d.getMonth() === vorigeMaand.getMonth()) tel(mnd, r);
  }

  const dagen = d => Math.round((nu - d) / 864e5);
  const L = [];
  L.push(`CONVERSIE PER VERZENDKANAAL — stand ${nu.toISOString().slice(0, 10)}`);
  L.push('conversie = akkoord (inkoop of akkoord-blok) / alle verstuurde offertes');
  L.push('');
  const rij = (label, m) =>
    `${label} | ${String(m.tot).padStart(4)} ${pct(m.akk, m.tot).padStart(6)} | ${String(m.waT).padStart(4)} ${pct(m.waA, m.waT).padStart(6)} | ${String(m.mT).padStart(4)} ${pct(m.mA, m.mT).padStart(6)} | ${String(m.oT).padStart(4)} ${pct(m.oA, m.oT).padStart(6)}`;
  L.push('WA en mail = online offertes met geldig 06. Overig = winkel + geen bruikbaar');
  L.push('nummer (daar zitten de akkoord-rijen in, vandaar het hoge percentage).');
  L.push('');
  L.push('         |    TOTAAL    |   WHATSAPP   |  ALLEEN MAIL |    OVERIG');
  L.push('week     |    n   conv  |    n   conv  |    n   conv  |    n   conv');
  for (const w of weken) L.push(rij(w, perWeek[w]));
  L.push('');
  L.push(`${vmNaam.toUpperCase()} (hele maand):`);
  L.push(rij(vmNaam.slice(0, 8).padEnd(8), mnd));
  L.push('');
  L.push('LET OP rijpheid: tussen offerte en akkoord zit mediaan ~24 dagen.');
  L.push('De jongste weken tellen dus ALTIJD te laag; vergelijk weken vooral met elkaar');
  L.push(`op hetzelfde moment, niet met ${vmNaam}. WhatsApp-offertes krijgen de mail ook;`);
  L.push('"alleen mail" is zonder app-bericht. WA-verzendlog bestaat sinds 29 juni.');
  const tekst = L.join('\n');
  console.log('\n' + tekst);
  if (process.argv.includes('--stuur')) {
    require('child_process').execFileSync(process.execPath, [__dirname + '/sonty-data-send.js', tekst, '--code'], { stdio: 'inherit' });
  }
})();

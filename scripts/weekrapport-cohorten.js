#!/usr/bin/env node
// IJKPUNTEN — momenten die de conversie kunnen verklaren. Worden onder elk rapport gezet
// zodat een knik in de cijfers meteen te duiden is (wens Daimy 2026-08-03).
const IJKPUNTEN = [
  { datum: '2026-07-16', wat: 'AI-bot live op actieve gesprekken' },
  { datum: '2026-07-27', wat: 'WhatsApp-templates met knoppen' },
  { datum: '2026-08-03', wat: 'PRIJSVERHOGING: Sunmaster 1,10 -> 1,20, Roma 1,15 -> 1,30, markiezen 1,21 -> 1,31' },
];
const ijkpuntenTekst = () => '\n\nIJKPUNTEN\n' + IJKPUNTEN.map(i => '  ' + i.datum + '  ' + i.wat).join('\n') +
  '\n\nMinimale conversie na de prijsverhoging: met 1.400 euro marge per order die naar circa\n' +
  '1.650 gaat, mag het aantal orders zakken tot 85% van voorheen bij gelijke totale marge.\n' +
  'Bij een conversie van 9,4% is de ondergrens dus ongeveer 8,0%.';

/**
 * Wekelijks cohortrapport conversie (opdracht Daimy 28 juli 2026).
 *
 * Per ISO-week: hoeveel offertes de deur uit gingen en welk deel daarvan inmiddels
 * akkoord is. Minimaal 4 weken terug, standaard 6, zodat je de uitrijping ziet.
 *
 * Waarom cohorten en niet "deze week"? Tussen offerte en akkoord zit mediaan ~24 dagen,
 * 90% valt binnen ~51 dagen (zie memory sonty-offerte-sheet-structuur). Een losse week
 * zegt dus niets; je moet dezelfde groep over de tijd volgen. Daarom onthoudt dit script
 * de vorige stand per week en toont het de verschuiving.
 *
 * Definities, gelijk aan weekrapport-conversie.js:
 *   offerte  = lead staat in een status waarin de offerte eruit is (zie OFFERTE_STATUS)
 *   akkoord  = Inmeten inplannen / grip invullen / Afgerond
 *   week     = ISO-week van timestamp_created van de lead
 *
 * LET OP: het akkoord-blok in de Google-offerte-sheet loopt weken achter (wordt pas bij
 * de Gripp-administratie gevuld). Dit rapport leest RP, dat schuift eerder door. De twee
 * cijfers horen dus niet gelijk te zijn.
 *
 * Gebruik:
 *   node scripts/weekrapport-cohorten.js              → tonen, niet versturen
 *   node scripts/weekrapport-cohorten.js --stuur      → ook naar Daimy's databot
 *   node scripts/weekrapport-cohorten.js --weken 8    → meer weken terug (min. 4)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const CFG = require('./ai-ks/config.js');

const STATE = path.join(__dirname, '..', 'data', 'weekrapport-cohorten-state.json');

// Statussen waarin de offerte aantoonbaar de deur uit is.
const OFFERTE_STATUS = new Set([
  'Offerte vestuurd', // typefout staat zo in RP
  'Ai offerte verstuurd',
  'Geen herinnering meer',
  'Inmeten inplannen',
  'Inmeten in de wacht',
  'Inmeet whatsapp',
  'grip invullen',
  'Afgerond',
]);
const AKKOORD_STATUS = new Set(['Inmeten inplannen', 'grip invullen', 'Afgerond']);

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const WEKEN = Math.max(4, parseInt(arg('--weken', '6'), 10) || 6);

/** ISO-weeknummer + het jaar waar die week bij hoort. */
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const jan1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { jaar: t.getUTCFullYear(), week: Math.ceil(((t - jan1) / 86400000 + 1) / 7) };
}
/** Maandag 00:00 UTC van de ISO-week waar deze datum in valt. */
function weekStart(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t;
}
const dm = (d) => `${d.getUTCDate()}-${d.getUTCMonth() + 1}`;
const pct = (a, b) => (b ? (a / b) * 100 : 0);

async function rpItems() {
  // RP uit (vlag data/.rp-uit) → bord uit het eigen CRM (scripts/lib/dossiers.js)
  { const D = require('./lib/dossiers.js'); if (D.rpUit()) return (await D.rpGetVervanger('/contact-service/x/backlogs/y/items')).items || []; }
  const url = `https://backend.reuzenpanda.nl/contact-service/${CFG.RP_PID}/backlogs/${CFG.RP_BACKLOG}/items`;
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY } });
  if (!r.ok) throw new Error(`RP gaf ${r.status}`);
  return (await r.json()).items || [];
}

async function main() {
  const items = await rpItems();

  // Vensters: de lopende week plus WEKEN-1 volledige weken ervoor.
  const nu = new Date();
  const huidigeStart = weekStart(nu);
  const vensters = [];
  for (let i = WEKEN - 1; i >= 0; i--) {
    const start = new Date(huidigeStart.getTime() - i * 7 * 86400000);
    const eind = new Date(start.getTime() + 7 * 86400000);
    const { week } = isoWeek(start);
    vensters.push({ week, start, eind, loopt: i === 0, leads: 0, offertes: 0, akkoord: 0 });
  }
  const eersteStart = vensters[0].start.getTime();

  for (const it of items) {
    const ts = it.timestamp_created;
    if (!ts || ts < eersteStart) continue;
    const v = vensters.find((x) => ts >= x.start.getTime() && ts < x.eind.getTime());
    if (!v) continue;
    v.leads++;
    if (OFFERTE_STATUS.has(it.status_label)) v.offertes++;
    if (AKKOORD_STATUS.has(it.status_label)) v.akkoord++;
  }

  // Vorige stand erbij, zodat de uitrijping zichtbaar wordt.
  // Vorige stand alleen gebruiken als die echt van een eerdere run is; anders krijg je op een
  // tweede run op dezelfde dag overal "+0.0" te zien, wat leest als stilstand.
  let vorigeRuw = {};
  try { vorigeRuw = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch {}
  const bruikbaar = vorigeRuw.peildatum && Date.now() - Date.parse(vorigeRuw.peildatum) > 2 * 86400000;
  const vorige = bruikbaar ? vorigeRuw : {};

  const regels = [];
  for (const v of vensters) {
    const p = pct(v.akkoord, v.offertes);
    const oud = (vorige.weken || {})['w' + v.week];
    const delta = oud && oud.offertes ? p - pct(oud.akkoord, oud.offertes) : null;
    const laatsteDag = new Date(Math.min(v.eind.getTime() - 86400000, Date.now()));
    const dagen = Math.round((Date.now() - laatsteDag.getTime()) / 86400000);
    regels.push(
      `wk ${String(v.week).padEnd(2)} ${(dm(v.start) + ' t/m ' + dm(new Date(v.eind - 86400000))).padEnd(14)}` +
      `${String(v.offertes).padStart(4)} offertes ${String(v.akkoord).padStart(3)} akkoord  ` +
      `${p.toFixed(1).padStart(5)}%` +
      (delta === null ? '' : `  (${delta >= 0 ? '+' : ''}${delta.toFixed(1)} sinds vorige week)`) +
      (v.loopt ? '  LOOPT NOG' : `  ${dagen} dgn oud`)
    );
  }

  const rijp = vensters.filter((v) => !v.loopt && v.offertes >= 50);
  const beste = rijp.slice().sort((a, b) => pct(b.akkoord, b.offertes) - pct(a.akkoord, a.offertes))[0];

  // Maanden erbij (Daimy 28 juli): de lopende maand naast de drie ervoor, zodat je ziet
  // hoeveel er bij een al afgesloten maand nog steeds bij komt. Uitrijping loopt tot ~51 dagen,
  // dus zelfs een maand die voorbij is telt weken later nog door.
  const MAANDNAAM = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  // Alleen de lopende maand en die ervoor: verder terug is RP onbruikbaar. Gecontroleerd
  // 28 juli: april staat op 10x Afgerond bij 1.539 leads (0,8%) tegen juni 101 en juli 120.
  // Oude akkoorden worden in RP opgeschoond of gearchiveerd (april: 229 gearchiveerd), dus
  // het bord is een momentopname van de pijplijn, geen historisch archief.
  const maanden = [];
  for (let i = 1; i >= 0; i--) {
    const d = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth() - i, 1));
    maanden.push({
      key: d.toISOString().slice(0, 7),
      naam: MAANDNAAM[d.getUTCMonth()] + ' ' + d.getUTCFullYear(),
      loopt: i === 0, offertes: 0, akkoord: 0,
    });
  }
  for (const it of items) {
    if (!it.timestamp_created) continue;
    const k = new Date(it.timestamp_created).toISOString().slice(0, 7);
    const m = maanden.find((x) => x.key === k);
    if (!m) continue;
    if (OFFERTE_STATUS.has(it.status_label)) m.offertes++;
    if (AKKOORD_STATUS.has(it.status_label)) m.akkoord++;
  }
  const vorigeM = vorige.maanden || {};
  const maandRegels = maanden.map((m) => {
    const p = pct(m.akkoord, m.offertes);
    const oud = vorigeM[m.key];
    const erbij = oud ? m.akkoord - oud.akkoord : null;
    const dp = oud && oud.offertes ? p - pct(oud.akkoord, oud.offertes) : null;
    return `${m.naam.padEnd(16)}${String(m.offertes).padStart(5)} offertes ${String(m.akkoord).padStart(4)} akkoord  ${p.toFixed(1).padStart(5)}%` +
      (erbij === null ? '' : `  (+${erbij} akkoord, ${dp >= 0 ? '+' : ''}${dp.toFixed(1)} sinds vorige week)`) +
      (m.loopt ? '  LOOPT NOG' : '');
  });

  const tekst = [
    'CONVERSIE PER WEEK (offerte eruit -> nu akkoord)',
    `Peildatum ${new Date().toISOString().slice(0, 10)}. Bron: RP-bord. Akkoord = Inmeten inplannen, grip invullen of Afgerond.`,
    '',
    ...regels,
    '',
    'PER MAAND (om te zien hoeveel er bij de vorige maand nog steeds bij komt)',
    ...maandRegels,
    'Verder dan een maand terug kan RP niet: oude akkoorden worden daar opgeschoond en gearchiveerd, waardoor april op 0,8 procent lijkt te staan. Voor echte historie is de offerte-sheet de bron.',
    '',
    beste ? `Beste afgeronde week: wk ${beste.week} op ${pct(beste.akkoord, beste.offertes).toFixed(1)} procent.` : '',
    'Let op: jonge weken staan altijd laag. Tussen offerte en akkoord zit mediaan 24 dagen, 90 procent binnen 51 dagen. Kijk dus vooral naar de verschuiving per week, niet naar de losse stand.',
    'En vergelijk dit niet met het akkoord-blok in de offerte-sheet: dat wordt pas bij de Gripp-administratie gevuld en loopt weken achter.',
  ].filter(Boolean).join('\n');

  console.log(tekst);

  // Stand wegschrijven voor de volgende run.
  const nieuw = { peildatum: new Date().toISOString(), weken: {}, maanden: {} };
  vensters.forEach((v) => { nieuw.weken['w' + v.week] = { offertes: v.offertes, akkoord: v.akkoord }; });
  maanden.forEach((m) => { nieuw.maanden[m.key] = { offertes: m.offertes, akkoord: m.akkoord }; });
  fs.writeFileSync(STATE, JSON.stringify(nieuw, null, 1));

  const tekstMetIjk = tekst + ijkpuntenTekst();
  console.log(ijkpuntenTekst());

  if (process.argv.includes('--stuur')) {
    const tmp = path.join(__dirname, '..', 'data', '.cohorten-rapport.txt');
    fs.writeFileSync(tmp, tekstMetIjk);
    // process.execPath i.p.v. 'node': launchd heeft geen PATH, waardoor het versturen
    // elke maandag faalde met ENOENT terwijl het rapport zelf gewoon klaar was.
    execFileSync(process.execPath, [path.join(__dirname, 'sonty-data-send.js'), '--file', tmp], { stdio: 'inherit' });
  }
}

main().catch((e) => { console.error('cohortrapport mislukt:', e.message); process.exit(1); });

#!/usr/bin/env node
// Conversie volgens Daimy's definitie (21 juli 2026): een lead telt als geconverteerd zodra
// zijn RP-bord-item op "Inmeten inplannen", "Gripp invullen" of "Afgerond" staat.
// Cohort-meting: leads gegroepeerd op aanmaakmaand/-periode; per cohort het % dat NU
// (peilmoment = runtijd) in een van die statussen staat. Jonge cohorten scoren daardoor
// vanzelf lager — die zijn nog onderweg.
// Gebruik: node scripts/bord-conversie.js
const KS = require('./ai-ks/config.js');

const GECONVERTEERD = new Set([
  '2e9819bd-26f0-4082-8f18-32bb48f87f54', // Inmeten inplannen
  'f895f76f-175e-4ea0-bb7c-6cc2f4e5d846', // Gripp invullen
  '2082ad8a-517c-4e24-8c0f-a5be69b1588a', // Afgerond
]);
const BOT_LIVE = '2026-07-16'; // WhatsApp-bot actief op alle gesprekken; mail volgde 19 juli

async function main() {
  const r = await fetch(`https://backend.reuzenpanda.nl/contact-service/${KS.RP_PID}/backlogs/${KS.RP_BACKLOG}/items`, {
    headers: { Authorization: 'Bearer ' + KS.RP_API_KEY },
  });
  const items = (await r.json()).items || [];

  const cohort = (naam, filter) => {
    const leden = items.filter(filter);
    const conv = leden.filter(i => GECONVERTEERD.has(i.status_id)).length;
    console.log(`${naam.padEnd(28)} | leads: ${String(leden.length).padStart(5)} | geconverteerd: ${String(conv).padStart(4)} | ${leden.length ? ((conv / leden.length) * 100).toFixed(1) : '0.0'}%`);
  };

  const maand = (i) => new Date((i.timestamp_created || 0) * (String(i.timestamp_created).length > 10 ? 1 : 1000)).toISOString().slice(0, 7);
  const dag = (i) => new Date((i.timestamp_created || 0) * (String(i.timestamp_created).length > 10 ? 1 : 1000)).toISOString().slice(0, 10);

  console.log(`Peilmoment: ${new Date().toISOString().slice(0, 16)} — conversie = status Inmeten inplannen / Gripp invullen / Afgerond\n`);
  for (const m of ['2026-04', '2026-05', '2026-06', '2026-07']) cohort(`cohort ${m}`, i => maand(i) === m);
  console.log('');
  cohort(`cohort ${BOT_LIVE} t/m nu (bot-era)`, i => dag(i) >= BOT_LIVE);
  cohort('cohort 2026-06-16 t/m 06-21', i => dag(i) >= '2026-06-16' && dag(i) <= '2026-06-21');
  console.log('\nNB: jonge cohorten zijn nog onderweg (inmeten/akkoord komt vaak pas na dagen/weken);');
  console.log('de juni-vergelijkingsweek had 5 weken de tijd, de bot-era pas dagen.');
}

main().catch(e => { console.error('FOUT:', e.message); process.exit(1); });

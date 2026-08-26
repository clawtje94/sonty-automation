#!/usr/bin/env node
/**
 * DE LIVE API MOET REKENEN WAT DE MOTOR IN DE CODE REKENT.
 *
 * Gevonden 2026-08-26: de prijsverhoging van 3 augustus (sunmasterMarkup 1,10 → 1,20,
 * romaOpslag 1,15 → 1,30) stond in data/prijsconfig.json en dus in v4, Sunny, de
 * productpagina's en beide motoren-in-code. Maar de live API-route laadde eerst de
 * KV-prijsconfig (crm:prijsconfig), die op productie LEEG was, en viel terug op
 * PRIJS_DEFAULTS in lib/offerte-tool/prijsconfig.ts waar nog 1,10 / 1,15 stond.
 * zetRekenConfig() overschreef daarmee de juiste waarden. Gevolg: de klantconfigurator
 * op sonty.nl en de winkel-offertetool rekenden 23 dagen lang met het oude prijspeil
 * (Zip Design 110 300×250: live €1.147, motor €1.252), terwijl alle lokale controles
 * groen bleven omdat geen enkele de productie-API aanriep.
 *
 * Deze test dicht dat gat: hij vraagt de productie-API om prijzen (action=prijs én
 * action=configurator-prijs) en vergelijkt die met de motor in de code op deze Mac.
 * Elk verschil > €1 is een fout. Alleen-lezen.
 */
const path = require('path');
const { execFileSync } = require('child_process');
const WEB = path.join(__dirname, '..', '..', '..', 'sonty-website');
const BASE = process.env.SONTY_LIVE_BASE || 'https://sonty-website.vercel.app';

// Eén geval per categorie + Roma; maten in mm zoals de API ze verwacht.
const PRIJS_CASES = [
  { product: 'zipDesign110', breedte: 3000, hoogte: 2500, bediening: 'io' },
  { product: 'screenSquare85100', breedte: 2500, hoogte: 2000, bediening: 'io' },
  { product: 'suneye', breedte: 5000, hoogte: 3000, bediening: 'io' },
  { product: 'romaZipscreen', breedte: 2000, hoogte: 2000, bediening: 'io' },
  { product: 'romaRolluik', breedte: 2000, hoogte: 2000, bediening: 'io' },
];
// Configurator-varianten (namen uit data/configurator-products-v2.json).
const CONF_CASES = [
  { variant: 'Rolluik S-37', bediening: 'Motor met afstandsbediening', breedte: 2000, hoogte: 2000 },
  { variant: 'Suneye dichte cassette', bediening: 'Motor met afstandsbediening', breedte: 5000, uitval: 3000 },
  { variant: 'ROMA zipSCREEN.2 (premium)', bediening: 'Motor met afstandsbediening', breedte: 2000, hoogte: 2000 },
];

function lokaal() {
  const code = `
    import { berekenPrijs } from "./lib/offerte-tool/pricing";
    import { berekenConfiguratorPrijs } from "./lib/offerte-tool/configurator-map";
    const P = ${JSON.stringify(PRIJS_CASES)}; const C = ${JSON.stringify(CONF_CASES)};
    const uit = { prijs: P.map(c => berekenPrijs(c.product, c.breedte, c.hoogte, c.bediening, "standaard")),
      conf: C.map(c => berekenConfiguratorPrijs({ variantName: c.variant, bediening: c.bediening, breedteMm: c.breedte, hoogteMm: c.hoogte, uitvalMm: c.uitval })) };
    console.log(JSON.stringify(uit));`;
  return JSON.parse(execFileSync('npx', ['tsx', '-e', code], { cwd: WEB, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n').pop());
}

async function live(params) {
  const u = new URL('/api/offerte-tool', BASE);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, String(v));
  const r = await fetch(u, { headers: { 'cache-control': 'no-cache' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} op ${u.search}`);
  return r.json();
}

(async () => {
  let fouten = 0;
  const meld = (m) => { fouten++; console.log('❌ ' + m); };
  const lok = lokaal();
  for (let i = 0; i < PRIJS_CASES.length; i++) {
    const c = PRIJS_CASES[i];
    const l = await live({ action: 'prijs', ...c });
    const e = lok.prijs[i];
    const naam = `${c.product} ${c.breedte / 10}×${c.hoogte / 10} ${c.bediening}`;
    if (e.error || l.error) {
      if ((e.error || '') !== (l.error || '')) meld(`${naam}: motor zegt "${e.error || 'ok'}", live zegt "${l.error || 'ok'}"`);
      else console.log(`  ·  ${naam}: beide "${e.error}"`);
      continue;
    }
    for (const veld of ['boekprijs', 'productPrijs', 'montagePrijs', 'totaal']) {
      if (Math.abs((l[veld] || 0) - (e[veld] || 0)) > 1) meld(`${naam} ${veld}: live €${l[veld]} maar de motor rekent €${e[veld]}`);
    }
    if (Math.abs(l.totaal - e.totaal) <= 1) console.log(`  ✓  ${naam}: €${l.totaal}`);
  }
  for (let i = 0; i < CONF_CASES.length; i++) {
    const c = CONF_CASES[i];
    const l = await live({ action: 'configurator-prijs', ...c });
    const e = lok.conf[i];
    const naam = `configurator ${c.variant} ${c.breedte / 10}×${(c.hoogte || c.uitval) / 10}`;
    if (!e.exact || !l.exact) {
      if (!!e.exact !== !!l.exact) meld(`${naam}: motor exact=${!!e.exact}, live exact=${!!l.exact} (${l.reden || e.reden || ''})`);
      else console.log(`  ·  ${naam}: geen exacte prijs (${e.reden || ''})`);
      continue;
    }
    for (const veld of ['productPrijs', 'montagePrijs', 'totaal']) {
      if (Math.abs((l[veld] || 0) - (e[veld] || 0)) > 1) meld(`${naam} ${veld}: live €${l[veld]} maar de motor rekent €${e[veld]}`);
    }
    if (Math.abs(l.totaal - e.totaal) <= 1) console.log(`  ✓  ${naam}: €${l.totaal}`);
  }
  console.log('─'.repeat(64));
  if (fouten) { console.log(`❌ ${fouten} verschil(len) tussen de live API en de motor. De site rekent NIET wat de code rekent.`); process.exit(1); }
  console.log('✅ De live API rekent dezelfde bedragen als de motor in de code.');
})().catch((e) => { console.log('❌ live-API-meetlat kon niet draaien: ' + e.message); process.exit(1); });

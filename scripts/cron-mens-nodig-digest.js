#!/usr/bin/env node
// MENS-NODIG-DAGDIGEST (Daimy 26-08: "fixen ja" op parkeren + dagdigest).
// De verzendpoort parkeert klanten ("max-voorstellen", stil-lijst, mens-actief) en
// meldt dat sindsdien maar één keer. Zodat geparkeerde klanten niet stil uit beeld
// raken, bundelt deze cron elke ochtend alle mens-nodig-gevallen van de afgelopen
// 7 dagen in één bericht op de planning-bot. Geen gevallen = geen bericht.
// Draait 1x per dag om 08:20 via launchd nl.sonty.mens-nodig-digest.
const fs = require('fs');
const path = require('path');
const { planningTelegram } = require('./lib/telegram-planning.js');

const LOG = path.join(__dirname, '..', 'data', 'mens-nodig-log.jsonl');

/** Dagelijkse samenvatting van de boeking-nacontrole (Daimy 26-08: "iedereen die
 *  wordt gepland moet worden nagelopen … en ik wil weten wat er misging en hoe
 *  het is opgelost"). Fouten zijn al direct gemeld; dit is het totaalbeeld. */
function nacontroleRegel() {
  try {
    const st = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'nacontrole-state.json'), 'utf8'));
    const recent = Object.values(st).filter((r) => Date.now() - Date.parse(r.op) < 24 * 3600000);
    if (!recent.length) return null;
    const per = { ok: 0, hersteld: 0, fout: 0 };
    recent.forEach((r) => { per[r.uitkomst] = (per[r.uitkomst] || 0) + 1; });
    const detail = recent.filter((r) => r.uitkomst !== 'ok')
      .map((r) => `  • ${r.naam}: ${(r.fouten || []).concat((r.herstel || []).map((h) => 'hersteld: ' + h)).join('; ')}`);
    return [`📋 Boeking-nacontrole (24u): ${recent.length} gecontroleerd — ${per.ok} in orde, ${per.hersteld} hersteld, ${per.fout} met open fouten.`]
      .concat(detail).join('\n');
  } catch { return null; }
}

(async () => {
  const nacontrole = nacontroleRegel();
  if (nacontrole) await planningTelegram(nacontrole);

  let regels = [];
  try { regels = fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map((r) => JSON.parse(r)); }
  catch { console.log('geen mens-nodig-log, niets te melden'); return; }

  const WEEK = 7 * 24 * 3600 * 1000;
  const recent = regels.filter((r) => Date.now() - Date.parse(r.op) < WEEK);
  // per klant de nieuwste melding, oudste bovenaan (die wacht het langst)
  const perKlant = new Map();
  for (const r of recent) {
    const bestaand = perKlant.get(r.naam);
    if (!bestaand || r.op > bestaand.op) perKlant.set(r.naam, r);
  }
  if (!perKlant.size) { console.log('geen mens-nodig-gevallen in de laatste 7 dagen'); return; }

  const lijst = [...perKlant.values()].sort((a, b) => a.op.localeCompare(b.op));
  const dagen = (r) => Math.max(0, Math.floor((Date.now() - Date.parse(r.op)) / 86400000));
  const kort = (s) => String(s || '').replace(/\s*\(\d+ al gestuurd[^)]*\)/, '').slice(0, 60);
  const bericht = [`✋ MENS NODIG — ${perKlant.size} klant(en) wachten op handmatige opvolging:`]
    .concat(lijst.map((r) => `• ${r.naam} — ${kort(r.reden)} (${dagen(r) === 0 ? 'vandaag' : dagen(r) + ' dag(en)'})`))
    .concat(['', 'Oppakken via het inmeet-dashboard of Trengo. Dit lijstje komt 1x per dag zolang er iemand op staat.'])
    .join('\n');
  await planningTelegram(bericht);
  console.log(new Date().toISOString(), 'mens-nodig-digest:', perKlant.size, 'klant(en) gemeld');

  // log opschonen tot 14 dagen zodat het bestand niet eindeloos groeit
  const houd = regels.filter((r) => Date.now() - Date.parse(r.op) < 2 * WEEK);
  if (houd.length < regels.length) fs.writeFileSync(LOG, houd.map((r) => JSON.stringify(r)).join('\n') + '\n');
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });

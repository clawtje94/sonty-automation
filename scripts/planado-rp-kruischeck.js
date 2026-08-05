#!/usr/bin/env node
// RP-kruischeck (Daimy 05-08, geval Wilco Vendrig): de Gripp-offerte kan een oudere
// versie zijn dan wat de klant in RP heeft geaccordeerd. Voor elke toekomstige
// inmeet-opdracht: RP-lead zoeken op naam, nieuwste RP-offertedocument lezen, en
// vergelijken met wat er nu in de opdracht staat. Bij afwijking (–-execute):
// "In te meten" = RP-versie + waarschuwing in de omschrijving.
// Standaard DRY-RUN met rapport.
const fs = require('fs');
const path = require('path');
const { leesOfferte, productRegel } = require('./inmeten-planner-lees.js');
const { kortVeld } = require('./planado-gripp-verrijken.js');

const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const SALES = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const PLANADO_KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const PH = { Authorization: 'Bearer ' + PLANADO_KEY, 'Content-Type': 'application/json', 'X-Planado-Notify-Assignees': 'false' };
const INMETERS = {
  '1f122cfa-17a2-6580-8257-7e80f004db9c': 'Joey',
  '1f122d19-e43e-6da0-8ffb-661a4ff9bb36': 'Sjoerd',
};
const EXECUTE = process.argv.includes('--execute');
const ALLEEN_DATUM = (process.argv.find((a) => a.startsWith('--datum=')) || '').split('=')[1] || null;
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

async function rp(ep) {
  const r = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: { Authorization: 'Bearer ' + RP_API_KEY } });
  if (!r.ok) throw new Error('RP ' + r.status);
  return r.json();
}

/** Alle Sales-items één keer scannen en indexeren op genormaliseerde naam. */
async function rpIndex() {
  const index = new Map();
  let offset = 0;
  while (true) {
    const j = await rp(`/contact-service/${PID}/backlogs/${SALES}/items?limit=1000&offset=${offset}`);
    for (const it of j.items || []) {
      const naam = norm(it.summary);
      if (!naam) continue;
      // nieuwste item per naam wint (timestamp ontbreekt op Sales; latere pagina's zijn ouder)
      if (!index.has(naam)) index.set(naam, it);
    }
    if (!j.has_more) break;
    offset += 1000;
  }
  return index;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-zà-ÿ ]/g, ' ').replace(/\s+/g, ' ').trim();

const rpRegels = (prods) => prods.map(productRegel);

/** Vergelijk op producttype+aantal (maten kunnen legitiem iets afwijken). */
function wijktAf(rpProds, veldTekst) {
  if (!rpProds.length) return false; // geen RP-data = niets te zeggen
  const veld = String(veldTekst || '').toLowerCase();
  for (const p of rpProds) {
    const kern = p.naam.toLowerCase().replace(/\(.*?\)/g, '').trim().split(' ').slice(0, 2).join(' ');
    if (!veld.includes(kern)) return true; // producttype ontbreekt in het veld
  }
  // aantallen: som RP vs aantal x-en in veld
  const somRp = rpProds.reduce((s, p) => s + p.aantal, 0);
  const somVeld = [...veld.matchAll(/(\d+)x /g)].reduce((s, m) => s + Number(m[1]), 0);
  return somVeld > 0 && somRp !== somVeld;
}

async function main() {
  console.log(EXECUTE ? '=== KRUISCHECK (schrijft bij afwijking) ===' : '=== DRY-RUN kruischeck ===');
  console.log('RP-index opbouwen (± 19 pagina\'s)…');
  const index = await rpIndex();
  console.log('RP-index: ' + index.size + ' unieke namen');

  const jobs = [];
  let after = null;
  for (let i = 0; i < 30; i++) {
    const d = await (await fetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: PH })).json();
    const l = d.jobs || [];
    if (!l.length) break;
    jobs.push(...l);
    after = l[l.length - 1].uuid;
    await wacht(2600);
  }
  const nu = Date.now();
  const doel = jobs.filter((j) => j.scheduled_at && Date.parse(j.scheduled_at) > nu && INMETERS[j.assignee?.worker_uuid]
    && (!ALLEEN_DATUM || j.scheduled_at.startsWith(ALLEEN_DATUM)));

  let ok = 0, afwijkend = 0, geenRp = 0, geenInmeet = 0;
  for (const j of doel) {
    const det = await (await fetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { headers: PH })).json();
    const job = det.job || det;
    await wacht(2600);
    if (!/inmeet|inmeten/i.test((job.description || '').split('\n')[0])) { geenInmeet++; continue; }
    const klantnaam = (job.description || '').split('\n')[0].replace(/^.*?(—|-)\s*/, '').replace(/\|.*$/, '').trim();
    const rpItem = index.get(norm(klantnaam));
    if (!rpItem) { geenRp++; continue; }
    const off = await leesOfferte(rpItem).catch(() => ({ producten: [], ambigu: false }));
    if (off.ambigu) {
      console.log(`  ? #${job.serial_no} ${klantnaam}: ${off.aantalDocs} offerteversies, GEEN getekend — klant moet tekenen`);
      continue;
    }
    const prods = off.producten;
    const veld = (job.custom_fields || []).find((f) => f.name === 'In te meten')?.value || '';
    if (!prods.length) { geenRp++; continue; }
    if (!wijktAf(prods, veld)) { ok++; continue; }

    afwijkend++;
    const regels = rpRegels(prods);
    console.log(`  ! #${job.serial_no} ${klantnaam} — RP wijkt af`);
    console.log(`      veld nu: ${veld.slice(0, 90) || '(leeg)'}`);
    console.log(`      RP zegt: ${regels.join(' · ').slice(0, 90)}`);
    if (EXECUTE) {
      const bestaand = (job.custom_fields || []).map((f) => ({ name: f.name, field_type: f.field_type, value: f.value }));
      const i = bestaand.findIndex((f) => f.name === 'In te meten');
      const waarde = kortVeld(regels.join(' · '));
      if (i >= 0) bestaand[i].value = waarde; else bestaand.push({ name: 'In te meten', field_type: 'input', value: waarde });
      const waarschuwing = `\n\nLET OP: Gripp-offerte wijkt af van wat de klant in RP accordeerde. RP-versie:\n${regels.map((r) => '- ' + r).join('\n')}\nKantoor: Gripp-offerte bijwerken.`;
      const patch = { version: job.version, custom_fields: bestaand };
      if (!/LET OP: Gripp-offerte wijkt af/.test(job.description || '')) patch.description = (job.description || '') + waarschuwing;
      const r = await fetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { method: 'PATCH', headers: PH, body: JSON.stringify(patch) });
      console.log(`      -> PATCH ${r.status}`);
      await wacht(2600);
    }
  }
  console.log(`\nklopt met RP: ${ok} | WIJKT AF: ${afwijkend} | geen RP-lead/offerte gevonden: ${geenRp} | geen inmeet: ${geenInmeet}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });

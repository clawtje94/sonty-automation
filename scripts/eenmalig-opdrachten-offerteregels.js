#!/usr/bin/env node
// EENMALIG (Daimy 18-08): bestaande inmeetopdrachten die de FORMULIERnaam in de
// omschrijving hebben ("1x Windvast") bijwerken naar de regels uit de getekende offerte.
// Vanaf nu doet de planner dit zelf; dit script haalt alleen de achterstand in.
//
// Harde grenzen, met opzet:
//  - alleen opdrachten met external_id rp-… en een inmeet-omschrijving,
//  - alleen in de TOEKOMST,
//  - er wordt ALLEEN de regel "N product(en): …" vervangen en het veld "In te meten"
//    gezet. Datum, tijd, toewijzing, status, adres, contacten: niets van dat alles.
//  - geen leesbare offerte of niets veranderd = overslaan,
//  - meldingen naar de inmeters staan UIT,
//  - vooraf gaat de complete oude staat naar data/backup-opdrachten-<datum>.json.
const fs = require('fs');
const path = require('path');
const EXECUTE = process.argv.includes('--execute');
const WORTEL = path.join(__dirname, '..');
const PH = { Authorization: 'Bearer ' + fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim() };
const PW = { ...PH, 'Content-Type': 'application/json', 'X-Planado-Notify-Assignees': 'false' };
const K = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const B = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const { leesOfferte, productRegel } = require('./inmeten-planner-lees.js');
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
const GEEN_PRODUCT = new RegExp(['inclusief montage', 'connectivity', 'app bediening', 'afstandsbediening', 'korting', 'vanaf \\d+ stuks', '^(breedte|hoogte|diepte|oppervlakte)\\b', '\\btussen\\s+\\d+\\s*mm', 'montage', 'transport', 'toeslag', 'garantie'].join('|'), 'i');
const { leadRestant } = require('./lib/lead-restant.js');
// Planado weigert een custom-field-waarde boven de 200 tekens (HTTP 422, gezien bij 14
// van de 47). Dezelfde nette afkapper gebruiken als de verrijker, die knipt op hele
// producten en zet er "+n meer (zie omschrijving)" achter.
const { kortVeld } = require('./planado-gripp-verrijken.js');
const kort = (s) => kortVeld(String(s || ''));
const BACKUP_PAD = path.join(WORTEL, 'data', `backup-opdrachten-${new Date().toISOString().slice(0, 10)}.json`);

(async () => {
  console.log(EXECUTE ? '=== BIJWERKEN (schrijft echt) ===' : '=== DRY-RUN (--execute om echt te schrijven) ===');
  let after = null, alles = [];
  for (let i = 0; i < 40; i++) {
    const d = await (await fetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: PH })).json();
    const l = d.jobs || []; if (!l.length) break;
    alles.push(...l); after = l[l.length - 1].uuid; await wacht(2600);
  }
  const komend = alles.filter((j) => j.scheduled_at && Date.parse(j.scheduled_at) >= Date.now() && (j.external_id || '').startsWith('rp-'));
  console.log(`${komend.length} toekomstige opdracht(en) met RP-koppeling`);

  const backup = [], gedaan = [], overgeslagen = [];
  for (const j of komend) {
    const det = (await (await fetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { headers: PH })).json()).job || {};
    await wacht(2600);
    const oms = det.description || '';
    if (!/inmeet|inmeten/i.test(oms.split('\n')[0])) { overgeslagen.push([det.serial_no, 'geen inmeetopdracht']); continue; }
    if (!/^\d+ product\(en\):/im.test(oms)) { overgeslagen.push([det.serial_no, 'geen productregel']); continue; }

    let item = null;
    try { item = (await (await fetch(`https://backend.reuzenpanda.nl/contact-service/${PID}/backlogs/${B}/items/${det.external_id.slice(3)}`, { headers: { Authorization: 'Bearer ' + K } })).json()).item; } catch { /* niets */ }
    if (!item) { overgeslagen.push([det.serial_no, 'lead niet op te halen']); continue; }
    const off = await leesOfferte(item).catch(() => ({ producten: [] }));
    if (!off.producten?.length) { overgeslagen.push([det.serial_no, 'geen offerteregels']); continue; }

    const regels = off.producten.map(productRegel);
    const aantal = off.producten.reduce((a, p) => a + p.aantal, 0);
    const nieuweRegel = `${aantal} product(en): ${regels.join(', ')}`;
    const leadNamen = [...(item.description || '').matchAll(/^(\d+)x\s+(.+?):?\s*$/gim)]
      .map((m) => ({ naam: m[2].trim() }))
      .filter((p) => !GEEN_PRODUCT.test(p.naam) && !/winkel offerte|offerte$/i.test(p.naam));
    const restant = leadRestant(leadNamen, off.producten);

    let nieuw = oms.replace(/^\d+ product\(en\):.*$/im, nieuweRegel);
    if (restant.length && !nieuw.includes('Klant vroeg in de aanvraag ook naar')) {
      nieuw = nieuw.replace(nieuweRegel, `${nieuweRegel}\n\nKlant vroeg in de aanvraag ook naar: ${restant.join(', ')} (staat NIET in de offerte)`);
    }
    // Alleen het veld 'In te meten' aanraken, de rest van de velden exact terugsturen.
    const velden = (det.custom_fields || []).map((f) => ({ name: f.name, field_type: f.field_type, value: f.value }));
    const i = velden.findIndex((f) => f.name === 'In te meten');
    const nieuwVeld = kort(regels.join(' · '));
    const veldNu = i >= 0 ? velden[i].value : null;
    if (i >= 0) velden[i] = { name: 'In te meten', field_type: 'input', value: nieuwVeld };

    if (nieuw === oms && veldNu === nieuwVeld) { overgeslagen.push([det.serial_no, 'al goed']); continue; }

    // Backup DIRECT wegschrijven, niet pas aan het eind: klapt de run er halverwege uit,
    // dan moet de oude staat van wat al aangeraakt is op schijf staan.
    backup.push({ uuid: j.uuid, serial_no: det.serial_no, description: oms, custom_fields: det.custom_fields, scheduled_at: det.scheduled_at, assignee: det.assignee, status: det.status });
    fs.writeFileSync(BACKUP_PAD, JSON.stringify(backup, null, 1));
    console.log(`\n#${det.serial_no} ${(det.contacts || [])[0]?.name || ''} (${new Date(det.scheduled_at).toLocaleDateString('nl-NL')})`);
    console.log('  oud : ' + (oms.match(/^\d+ product\(en\):.*$/im) || [''])[0].slice(0, 100));
    console.log('  nieuw: ' + nieuweRegel.slice(0, 100));
    if (restant.length) console.log('  + regel: klant vroeg ook naar ' + restant.join(', '));
    if (i >= 0 && veldNu !== nieuwVeld) console.log(`  In te meten: "${String(veldNu).slice(0, 40)}" -> "${nieuwVeld.slice(0, 60)}"`);

    if (!EXECUTE) { gedaan.push(det.serial_no); continue; }
    const body = { version: det.version, description: nieuw };
    if (i >= 0) body.custom_fields = velden;
    const r = await fetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { method: 'PATCH', headers: PW, body: JSON.stringify(body) });
    console.log('  PATCH ' + r.status + (r.ok ? '' : ' ' + (await r.text()).slice(0, 120)));
    if (r.ok) gedaan.push(det.serial_no);
    await wacht(2600);
  }

  if (backup.length) console.log(`\nbackup van de oude staat: ${BACKUP_PAD} (${backup.length} opdrachten)`);
  console.log(`\n${gedaan.length} opdracht(en) ${EXECUTE ? 'bijgewerkt' : 'zou ik bijwerken'} | ${overgeslagen.length} overgeslagen`);
  const redenen = {};
  for (const [, r] of overgeslagen) redenen[r] = (redenen[r] || 0) + 1;
  console.log('overgeslagen om:', JSON.stringify(redenen));
})();

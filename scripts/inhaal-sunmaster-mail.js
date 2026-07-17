#!/usr/bin/env node
// Inhaalslag (opdracht Daimy 2026-07-13): klanten waarvan alleen de Roma-duo
// op SENT staat en de Sunmaster-hoofdofferte nog op DRAFT, krijgen alsnog de
// duo-mail met BEIDE offertes naast elkaar (Trengo "Aanvragen").
// - Slaat klanten over die al akkoord zijn (duo of bron ACCEPTED/SIGNED) — expliciete opdracht.
// - Zet de Sunmaster-offerte na een geslaagde mail op SENT in RP.
// Gebruik: node scripts/inhaal-sunmaster-mail.js            → dry-run (toont wat er zou gebeuren)
//          node scripts/inhaal-sunmaster-mail.js --test     → 1 testmail naar daimy@sonty.nl
//          node scripts/inhaal-sunmaster-mail.js --live     → echte run, logt naar data/inhaal-sunmaster-log.json
const fs = require('fs');
const path = require('path');
const { stuurDuoMail } = require('./duo-mail.js');
const CFG = require('./ai-ks/config.js');

const RP = 'https://backend.reuzenpanda.nl';
const PID = CFG.RP_PID;
const H = { Authorization: 'Bearer ' + CFG.RP_API_KEY, 'Content-Type': 'application/json' };
const LIVE = process.argv.includes('--live');
const TEST = process.argv.includes('--test');
const LOG_FILE = path.join(__dirname, '..', 'data', 'inhaal-sunmaster-log.json');

const docLink = (documentId) => `https://document.reuzenpanda.nl/nl/${PID}/${documentId}/latest`;

function productUitDoc(doc) {
  const t = JSON.stringify([doc.renderRows, doc.segments, doc.title, doc.quotationTitle] || '').toLowerCase();
  if (/rolluik/.test(t)) return 'rolluiken';
  if (/zip|screen/.test(t)) return 'screens';
  if (/knikarm/.test(t)) return 'knikarmscherm';
  return 'zonwering';
}

async function haalDoc(documentId) {
  const j = await (await fetch(`${RP}/document-service/v1/${PID}/quotations/${documentId}`, { headers: H })).json();
  return j.quotationData;
}

async function haalContact(contactPersonId) {
  const j = await (await fetch(`${RP}/contact-service/${PID}/contact-persons/${contactPersonId}`, { headers: H })).json();
  const cp = j.contact_person || j.contactPerson || j;
  const veld = (label) => (cp.free_fields || []).find((f) => f.label === label)?.value || '';
  return { naam: cp.display_name || veld('name'), email: veld('email').trim().toLowerCase() };
}

async function zetOpSent(documentId) {
  // LET OP: quotationStatus alleen is niet genoeg — RP negeert de PUT stilletjes
  // tenzij ook documentStatus meegaat (ontdekt 2026-07-13, geverifieerd op testofferte).
  const doc = await haalDoc(documentId);
  doc.quotationStatus = 'SENT';
  doc.documentStatus = 'SENT';
  const r = await fetch(`${RP}/document-service/v1/${PID}/quotations/${documentId}`, {
    method: 'PUT', headers: H, body: JSON.stringify(doc),
  });
  if (!r.ok) throw new Error('status naar SENT mislukt: HTTP ' + r.status);
  const na = await haalDoc(documentId);
  if (na.quotationStatus !== 'SENT') throw new Error('status bleef ' + na.quotationStatus + ' na PUT');
}

(async () => {
  const status = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'duo-verzendstatus-2026-07-13.json')));
  const duos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'roma-duo-gemaakt.json')));
  const log = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE)) : { verstuurd: [], overgeslagen: [], fouten: [] };
  const alGehad = new Set(log.verstuurd.filter((r) => !r.test).map((r) => r.bron));

  let lijst = status.alleenRoma;
  if (TEST) lijst = lijst.slice(0, 1);

  let ok = 0, skip = 0, fout = 0;
  for (const r of lijst) {
    const entry = Object.entries(duos).find(([, v]) => v.romaNummer === r.duoNr);
    if (!entry) { log.fouten.push({ ...r, reden: 'geen duo-entry' }); fout++; continue; }
    const [, v] = entry;
    try {
      // Al akkoord? Overslaan (opdracht Daimy: niet mailen wie al akkoord is)
      if (/ACCEPT|SIGNED/i.test(r.duoS) || /ACCEPT|SIGNED/i.test(r.bronS)) {
        log.overgeslagen.push({ ...r, reden: 'al akkoord' }); skip++;
        console.log('OVERGESLAGEN (al akkoord):', r.klant);
        continue;
      }
      if (alGehad.has(r.bron)) { skip++; console.log('OVERGESLAGEN (al gemaild):', r.klant); continue; }

      const duoDoc = await haalDoc(v.romaDocumentId);
      // Verse statuscheck direct uit RP, niet alleen de snapshot
      if (/ACCEPT|SIGNED/i.test(duoDoc.quotationStatus || '')) {
        log.overgeslagen.push({ ...r, reden: 'al akkoord (live)' }); skip++;
        console.log('OVERGESLAGEN (al akkoord, live):', r.klant);
        continue;
      }
      const qs = (await (await fetch(`${RP}/document-service/v1/${PID}/quotations?lead_configuration_id=${duoDoc.subjects.leadConfiguration}`, { headers: H })).json()).quotationDatas || [];
      const bron = qs.find((q) => String(q.quotationNumber) === String(v.bron));
      if (!bron) { log.fouten.push({ ...r, reden: 'bron niet gevonden' }); fout++; continue; }
      if (/ACCEPT|SIGNED/i.test(bron.quotationStatus || '')) {
        log.overgeslagen.push({ ...r, reden: 'bron al akkoord (live)' }); skip++;
        continue;
      }

      const bronVol = await haalDoc(bron.documentId); // lijst-query is ondiep; renderRows zitten alleen in het volledige document
      const contact = await haalContact(duoDoc.subjects.contactPerson);
      if (!contact.email || !/@/.test(contact.email)) {
        log.fouten.push({ ...r, reden: 'geen e-mailadres' }); fout++;
        console.log('FOUT (geen e-mail):', r.klant);
        continue;
      }
      const voornaam = (contact.naam || r.klant || '').trim().split(/\s+/)[0];
      const product = productUitDoc(bronVol);
      const doel = TEST ? 'daimy@sonty.nl' : contact.email;

      if (!LIVE && !TEST) {
        console.log('DRY:', r.klant, '→', contact.email, '|', product, '| Sunmaster', r.bron, '| Roma', r.duoNr);
        ok++; continue;
      }

      // Trengo hanteert een rate limit; rustig aan en bij 429 wachten en opnieuw
      let res, poging = 0;
      for (;;) {
        try {
          res = await stuurDuoMail({
            email: doel, naam: contact.naam, voornaam, product,
            hoofdNummer: r.bron, hoofdLink: docLink(bron.documentId),
            romaNummer: r.duoNr, romaLink: docLink(v.romaDocumentId),
          });
          break;
        } catch (e) {
          if (/429|Too Many/i.test(String(e.message)) && ++poging <= 3) {
            console.log('  rate limit, 65s wachten (poging ' + poging + ') …');
            await new Promise((w) => setTimeout(w, 65000));
          } else throw e;
        }
      }
      await new Promise((w) => setTimeout(w, 2500));
      if (LIVE) await zetOpSent(bron.documentId);
      log.verstuurd.push({ klant: r.klant, email: doel, bron: r.bron, duo: r.duoNr, ticket: res.ticketId, tijd: new Date().toISOString(), test: TEST || undefined });
      ok++;
      console.log((TEST ? 'TESTMAIL' : 'VERSTUURD') + ':', r.klant, '→', doel, '| ticket', res.ticketId);
    } catch (e) {
      fout++;
      log.fouten.push({ ...r, reden: String(e.message || e).slice(0, 150) });
      console.log('FOUT:', r.klant, '|', String(e.message || e).slice(0, 100));
    }
  }
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 1));
  console.log(`\nKlaar (${TEST ? 'test' : LIVE ? 'LIVE' : 'dry-run'}): ${ok} gemaild/zou mailen, ${skip} overgeslagen, ${fout} fouten. Log: data/inhaal-sunmaster-log.json`);
})();

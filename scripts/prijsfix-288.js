#!/usr/bin/env node
/**
 * PRIJSFIX 288 (opdracht Daimy 30-07): zet in de nog-openstaande (SENT) offertes de
 * S-42-rolluikprijs recht die door de corrupte prijstabel te laag stond. NIETS anders:
 * geen teksten, geen korting, geen status, geen berichten. Getekende (ACCEPTED)
 * offertes blijven bewust ongemoeid.
 *
 * Methode: per S-42-regel het TABELVERSCHIL optellen (nieuwe boekcel - oude foute cel,
 * x1,10 markup). Zo blijven handmatige toeslagen (kleur, opties) intact.
 *
 * Gebruik:
 *   node scripts/prijsfix-288.js          → dry-run, laat zien wat er zou wijzigen
 *   node scripts/prijsfix-288.js --echt   → voert de wijzigingen door in RP
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const CFG = require('./ai-ks/config.js');

const ECHT = process.argv.includes('--echt');
const PID = CFG.RP_PID;
const KEY = CFG.RP_API_KEY;
const LOG = path.join(__dirname, '..', 'data', 'prijsfix-288-log.json');
const BACKUPDIR = path.join(__dirname, '..', 'data', 'prijsfix-288-backups');

// ALLEEN de offertes die daadwerkelijk met de corrupte tabel zijn gemaakt (v4-periode
// vanaf 29 juni, uit de offerte-backups). Oudere SENT-offertes (o.a. 2025) zijn met een
// ander prijsboek gemaakt; daar is een tabel-delta betekenisloos. Eerste dry-run zonder
// dit filter pakte 3.340 documenten — vandaar deze harde begrenzing.
const SCOPE = new Set(Object.keys(JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-clawdboot/05088cc5-0b16-4a82-8a8f-f244ef58700b/scratchpad/akkoord-fout.json', 'utf8'))));

const NIEUW = require('../data/sunmaster-prices-2026.json').rolluikS42.table;
// De oude (foute) tabel exact zoals hij was vóór de fix van vandaag.
const OUD = JSON.parse(execFileSync('git', ['show', '06c5d6b^:data/sunmaster-prices-2026.json'], { cwd: path.join(__dirname, '..'), encoding: 'utf8' })).rolluikS42.table;

const H = { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const get = async (ep) => { const r = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: H }); return r.ok ? r.json() : null; };
const put = async (ep, body) => { const r = await fetch('https://backend.reuzenpanda.nl' + ep, { method: 'PUT', headers: H, body: JSON.stringify(body) }); return r.ok; };

function staffel(keys, mm) {
  for (const k of Object.keys(keys).map(Number).sort((a, b) => a - b)) if (mm <= k * 10) return String(k);
  return null;
}
const r2 = (n) => Math.round(n * 100) / 100;

async function main() {
  fs.mkdirSync(BACKUPDIR, { recursive: true });
  const alle = (await get(`/document-service/v1/${PID}/quotations`))?.quotationDatas || [];
  if (!alle.length) throw new Error('RP-lijst leeg, gestopt');
  const sent = alle.filter((q) => q.documentStatus === 'SENT' && SCOPE.has(String(q.documentNumber)));
  console.log(`RP: ${alle.length} documenten, ${sent.length} op SENT. Modus: ${ECHT ? 'ECHT' : 'dry-run'}\n`);

  const log = { gestart: new Date().toISOString(), modus: ECHT ? 'echt' : 'dry-run', offertes: [] };
  let gefixt = 0, totaalDelta = 0, mislukt = 0;

  for (const doc of sent) {
    const full = await get(`/document-service/v1/${PID}/quotations/${doc.documentId}`);
    const qd = full?.quotationData;
    const lines = qd?.segments?.defaultTemplatePriceLineGroup?.data?.lines;
    if (!lines) continue;

    const wijzigingen = [];
    for (const l of lines) {
      const d = l.description || '';
      if (!/RollSUPER|S-42/i.test(d) || /roma/i.test(d)) continue;
      const b = d.match(/Breedte:\s*(\d{3,4})\s*mm/i)?.[1];
      const h = d.match(/Hoogte:\s*(\d{3,4})\s*mm/i)?.[1];
      if (!b || !h) continue;
      const sb = staffel(NIEUW, +b);
      if (!sb) continue;
      const sh = staffel(NIEUW[sb], +h);
      if (!sh) continue;
      const oudCel = (OUD[sb] || {})[sh];
      const nieuwCel = NIEUW[sb][sh];
      if (oudCel == null || nieuwCel == null) continue;
      const delta = r2((nieuwCel - oudCel) * 1.1);
      if (Math.abs(delta) < 1) continue;
      wijzigingen.push({ regel: d.split('\n')[0].replace(/\*/g, ''), maat: b + 'x' + h, oud: l.pricePerUnit, nieuw: r2(l.pricePerUnit + delta), delta, units: l.units || 1 });
      l.pricePerUnit = r2(l.pricePerUnit + delta);
    }
    if (!wijzigingen.length) continue;

    const som = r2(wijzigingen.reduce((s, w) => s + w.delta * w.units, 0));
    console.log(`#${doc.documentNumber}  ${wijzigingen.map((w) => `${w.maat}: ${w.oud} -> ${w.nieuw}`).join(' | ')}  (samen +${som})`);

    if (ECHT) {
      fs.writeFileSync(path.join(BACKUPDIR, doc.documentNumber + '.json'), JSON.stringify(full, null, 1));
      const ok = await put(`/document-service/v1/${PID}/quotations/${doc.documentId}`, qd);
      if (!ok) { mislukt++; console.log('   !! OPSLAAN MISLUKT'); log.offertes.push({ nummer: doc.documentNumber, fout: 'PUT mislukt', wijzigingen }); continue; }
      await new Promise((r) => setTimeout(r, 400)); // RP zuinig gebruiken
    }
    gefixt++; totaalDelta = r2(totaalDelta + som);
    log.offertes.push({ nummer: doc.documentNumber, docId: doc.documentId, wijzigingen, som });
  }

  log.klaar = new Date().toISOString();
  log.samenvatting = { gefixt, mislukt, totaalDelta };
  fs.writeFileSync(LOG, JSON.stringify(log, null, 1));
  console.log(`\n${ECHT ? 'DOORGEVOERD' : 'DRY-RUN'}: ${gefixt} offertes, samen +€${totaalDelta}${mislukt ? `, ${mislukt} MISLUKT` : ''}`);
  console.log('Log: data/prijsfix-288-log.json');
}

main().catch((e) => { console.error('prijsfix gestopt:', e.message); process.exit(1); });

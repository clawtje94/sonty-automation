#!/usr/bin/env node
/**
 * PRIJSFIX UITVALSCHERMEN (opdracht Daimy 2026-08-01): zet in de nog-openstaande (SENT)
 * offertes twee ontbrekende boekposten alsnog op de uitvalscherm-regels:
 *   1. BANEN CONFECTIE (boek p43/p44) — ontbrak in v4/offerte-tool/bot, zat wel in de configurator.
 *   2. KLEURMEERPRIJS Trend/RAL (boek p43/p44) — tabel ontbrak, afwijkende kleur werd 0 gerekend.
 * Ook SunElite-regels met een afwijkende kleur (boek p31) worden gecorrigeerd.
 *
 * NIETS anders: geen teksten, geen korting, geen status, geen berichten. Getekende (ACCEPTED)
 * offertes blijven bewust ongemoeid (Daimy: "de send offerte graag aanpassen, de rest zo laten").
 *
 * Scope: alleen offertenummers die in data/offerte-backups voorkomen (dus door v4 aangeraakt),
 * zodat oude offertes met een ander prijsboek niet worden meegetrokken.
 *
 * Gebruik:
 *   node scripts/prijsfix-uitvalscherm.js          → dry-run
 *   node scripts/prijsfix-uitvalscherm.js --echt   → doorvoeren in RP
 */
const fs = require('fs');
const path = require('path');
const glob = require('fs');
const CFG = require('./ai-ks/config.js');

const ECHT = process.argv.includes('--echt');
const PID = CFG.RP_PID, KEY = CFG.RP_API_KEY;
const PRICES = require('../data/sunmaster-prices-2026.json');
const LOG = path.join(__dirname, '..', 'data', 'prijsfix-uitvalscherm-log.json');
const BACKUPDIR = path.join(__dirname, '..', 'data', 'prijsfix-uitvalscherm-backups');
const MARKUP = 1.10;

const H = { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const get = async (ep) => { const r = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: H }); return r.ok ? r.json() : null; };
const put = async (ep, body) => { const r = await fetch('https://backend.reuzenpanda.nl' + ep, { method: 'PUT', headers: H, body: JSON.stringify(body) }); return r.ok; };
const r2 = (n) => Math.round(n * 100) / 100;

/** Eerstvolgende staffel >= maat (maat in cm). */
function staffel(tbl, cm) {
  for (const k of Object.keys(tbl).map(Number).sort((a, b) => a - b)) if (cm <= k) return String(k);
  return null;
}
const TREND = ['ral 7039', 'ral 9007', 'ral 9010 structuur', 'db 703', 'db703', 'ral 7021'];
/** Standaardkleuren per product uit de prijsdata; die kosten niets extra. */
function kleurSoort(productKey, kleur) {
  const k = String(kleur || '').toLowerCase().trim();
  // 'TNA'/'NTB'/'naar keuze' = nog te bepalen, geen kleurkeuze -> nooit een meerprijs.
  if (!k || /n\.?t\.?b|^tna$|naar keuze/.test(k)) return null;
  const std = (PRICES[productKey]?.standaardKleuren || []).map((x) => x.toLowerCase());
  if (std.some((s) => k.includes(s) || s.includes(k))) return null;
  return TREND.some((t) => k.includes(t)) ? 'trend' : 'ral';
}

/** Scope: offertenummers die v4 ooit heeft aangeraakt. */
function scopeUitBackups() {
  const dir = path.join(__dirname, '..', 'data', 'offerte-backups');
  const uit = new Set();
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(\d{8,9})/);
    // ALLEEN 2026-nummers: de backup-map bevat ook 2025-offertes, en die zijn met een ander
    // prijsboek gemaakt. Zonder dit filter kregen 5 offertes uit 2025 onterecht een 2026-
    // correctie (ontdekt en teruggedraaid op 2026-08-01).
    if (m && m[1].startsWith('2026')) uit.add(m[1]);
  }
  return uit;
}

async function main() {
  fs.mkdirSync(BACKUPDIR, { recursive: true });
  const SCOPE = scopeUitBackups();
  const alle = (await get(`/document-service/v1/${PID}/quotations`))?.quotationDatas || [];
  if (!alle.length) throw new Error('RP-lijst leeg, gestopt');
  const sent = alle.filter((q) => q.documentStatus === 'SENT' && SCOPE.has(String(q.documentNumber)));
  console.log(`RP: ${alle.length} documenten, ${sent.length} SENT binnen scope. Modus: ${ECHT ? 'ECHT' : 'dry-run'}\n`);

  const log = { gestart: new Date().toISOString(), modus: ECHT ? 'echt' : 'dry-run', offertes: [] };
  let gefixt = 0, totaal = 0, mislukt = 0, banenN = 0, kleurN = 0;

  for (const doc of sent) {
    const full = await get(`/document-service/v1/${PID}/quotations/${doc.documentId}`);
    const qd = full?.quotationData;
    const lines = qd?.segments?.defaultTemplatePriceLineGroup?.data?.lines;
    if (!lines) continue;

    const wijz = [];
    for (const l of lines) {
      const d = l.description || '';
      const kop = d.split('\n')[0].toLowerCase();
      let key = null;
      if (/suncube/.test(kop)) key = 'suncube150';
      else if (/sunproject/.test(kop)) key = 'sunproject100';
      else if (/sunelite/.test(kop)) key = 'sunelite';
      if (!key || /roma/.test(kop)) continue;

      const b = d.match(/Breedte:\s*(\d{3,4})\s*mm/i)?.[1];
      if (!b) continue;
      const breedteCm = Math.round(Number(b) / 10);
      const uitvalCm = Number(d.match(/Uitval:\s*(\d{3,4})\s*mm/i)?.[1] || 0) / 10;
      const kleur = d.match(/Frame ?[Kk]leur:\s*([^\n]+)/i)?.[1]?.trim();

      let delta = 0; const posten = [];
      // 1. Banen confectie (alleen SunCube/SunProject; doek volgt uitval, zelfde regel als v4)
      if (key !== 'sunelite') {
        const doek = (!uitvalCm || uitvalCm <= 0) ? '165' : uitvalCm <= 95 ? '165' : uitvalCm <= 115 ? '200' : '225';
        const bt = PRICES[key].banenConfectie?.[doek];
        const s = bt ? staffel(bt, breedteCm) : null;
        if (s) { const v = r2(bt[s] * MARKUP); delta += v; posten.push(`banen ${v}`); banenN++; }
      }
      // 2. Kleurmeerprijs Trend/RAL
      const soort = kleurSoort(key, kleur);
      if (soort) {
        const kt = soort === 'trend' ? PRICES[key].meerprijsTrend : PRICES[key].meerprijsRAL;
        const s = kt ? staffel(kt, breedteCm) : null;
        if (s) { const v = r2(kt[s] * MARKUP); delta += v; posten.push(`${soort} ${v}`); kleurN++; }
      }
      if (delta < 1) continue;
      wijz.push({ regel: d.split('\n')[0].replace(/\*/g, ''), breedte: b, oud: l.pricePerUnit, nieuw: r2(l.pricePerUnit + delta), posten, units: l.units || 1 });
      l.pricePerUnit = r2(l.pricePerUnit + delta);
    }
    if (!wijz.length) continue;

    const som = r2(wijz.reduce((s, w) => s + (w.nieuw - w.oud) * w.units, 0));
    console.log(`#${doc.documentNumber}  ${wijz.map((w) => `${w.regel.slice(0, 22)} ${w.oud}→${w.nieuw} [${w.posten.join(' + ')}]`).join(' | ')}  (+${som})`);

    if (ECHT) {
      fs.writeFileSync(path.join(BACKUPDIR, doc.documentNumber + '.json'), JSON.stringify(full, null, 1));
      const ok = await put(`/document-service/v1/${PID}/quotations/${doc.documentId}`, qd);
      if (!ok) { mislukt++; console.log('   !! OPSLAAN MISLUKT'); log.offertes.push({ nummer: doc.documentNumber, fout: 'PUT mislukt', wijz }); continue; }
      await new Promise((r) => setTimeout(r, 400));
    }
    gefixt++; totaal = r2(totaal + som);
    log.offertes.push({ nummer: doc.documentNumber, docId: doc.documentId, wijz, som });
  }

  log.klaar = new Date().toISOString();
  log.samenvatting = { gefixt, mislukt, totaal, banenRegels: banenN, kleurRegels: kleurN };
  fs.writeFileSync(LOG, JSON.stringify(log, null, 1));
  console.log(`\n${ECHT ? 'DOORGEVOERD' : 'DRY-RUN'}: ${gefixt} offertes, samen +€${totaal} (${banenN} banen-regels, ${kleurN} kleur-regels)${mislukt ? `, ${mislukt} MISLUKT` : ''}`);
  console.log('Log: data/prijsfix-uitvalscherm-log.json');
}

main().catch((e) => { console.error('prijsfix gestopt:', e.message); process.exit(1); });

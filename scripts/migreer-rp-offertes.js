#!/usr/bin/env node
// Migratie Reuzenpanda → eigen Sonty-systeem (overstap-fundament, 2026-07-16).
// 1) ARCHIEF: alle RP-offertes naar lokale JSONL-bestanden (data/rp-archief/) —
//    volledig naslagwerk, ook na opzeggen RP.
// 2) IMPORT: open offertes (DRAFT/SENT, recent) via de beveiligde bulk-API in de
//    eigen store zetten zodat het team ze in /admin/offertes en de tool ziet.
// Gebruik:
//   node scripts/migreer-rp-offertes.js --archief              → alleen archiveren
//   node scripts/migreer-rp-offertes.js --import --sinds=2026-05-01 --dry
//   node scripts/migreer-rp-offertes.js --import --sinds=2026-05-01 --live
const fs = require('fs');
const path = require('path');
const CFG = require('./ai-ks/config.js');

const RP = 'https://backend.reuzenpanda.nl';
const PID = CFG.RP_PID;
const H = { Authorization: 'Bearer ' + CFG.RP_API_KEY, 'Content-Type': 'application/json' };
const SITE = process.env.SONTY_SITE || 'https://sonty-website.vercel.app';
const ADMIN_PW = process.env.SONTY_ADMIN_PW || fs.readFileSync(path.join(__dirname, '.sonty-admin-pw.txt'), 'utf8').trim();
const ARCHIEF_DIR = path.join(__dirname, '..', 'data', 'rp-archief');

const ARCHIEF = process.argv.includes('--archief');
const IMPORT = process.argv.includes('--import');
const LIVE = process.argv.includes('--live');
const SINDS = (process.argv.find(a => a.startsWith('--sinds=')) || '--sinds=2026-05-01').split('=')[1];

async function alleQuotations() {
  // RP geeft de volledige lijst in één response (18k+ compacte records)
  const j = await (await fetch(`${RP}/document-service/v1/${PID}/quotations`, { headers: H })).json();
  return j.quotationDatas || [];
}

async function volledigDoc(documentId) {
  const j = await (await fetch(`${RP}/document-service/v1/${PID}/quotations/${documentId}`, { headers: H })).json();
  return j.quotationData;
}

async function contactVan(doc) {
  const cpId = doc.subjects?.contactPerson;
  if (!cpId) return {};
  try {
    const j = await (await fetch(`${RP}/contact-service/${PID}/contact-persons/${cpId}`, { headers: H })).json();
    const cp = j.contact_person || j;
    const veld = (l) => (cp.free_fields || []).find((f) => f.label === l)?.value || '';
    const naam = (cp.display_name || veld('name') || '').trim().split(/\s+/);
    const adres = veld('address'); // "Straat 12, 1234 AB Plaats, Nederland"
    const m = adres.match(/^(.+?)\s+(\d+\S*),\s*(\d{4}\s?[A-Za-z]{2})\s+(.+?)(,|$)/);
    return {
      voornaam: naam[0] || '-', achternaam: naam.slice(1).join(' ') || '-',
      email: veld('email').trim().toLowerCase(), telefoon: veld('phone'),
      straat: m ? m[1] : adres, huisnummer: m ? m[2] : '', postcode: m ? m[3] : '', plaats: m ? m[4] : '',
    };
  } catch { return {}; }
}

function regelsVan(doc) {
  const lines = doc.segments?.defaultTemplatePriceLineGroup?.data?.lines || [];
  return lines.map((l) => {
    const alle = (l.description || '').split('\n');
    return {
      omschrijving: ((l.units || 1) > 1 ? (l.units || 1) + '× ' : '') + (alle[0] || '').replace(/\*\*/g, '').trim(),
      details: alle.slice(1).map((s) => s.replace(/\*\*/g, '').trim()).filter(Boolean).slice(0, 14).join(' · '),
      aantal: l.units || 1,
      prijsPerStuk: Math.round((l.pricePerUnit || 0) * 100) / 100,
      subtotaal: Math.round((l.pricePerUnit || 0) * (l.units || 1) * 100) / 100,
    };
  });
}

function totaalVan(doc, regels) {
  if (doc.pricing?.total) return Math.round(doc.pricing.total * 100) / 100;
  const sub = regels.reduce((s, r) => s + r.subtotaal, 0);
  const gd = doc.segments?.defaultTemplatePriceLineGroup?.data?.groupDiscount;
  const factor = gd?.type === 'PERCENTAGE' ? 1 - (gd.amount || 0) / 100 : 1;
  return Math.round(sub * factor * 100) / 100;
}

(async () => {
  const lijst = await alleQuotations();
  console.log('RP-offertes totaal:', lijst.length);

  if (ARCHIEF) {
    fs.mkdirSync(ARCHIEF_DIR, { recursive: true });
    const perJaar = {};
    for (const q of lijst) {
      const jaar = new Date(q.quotationCreationTimestamp || 0).getFullYear() || 'onbekend';
      (perJaar[jaar] = perJaar[jaar] || []).push(q);
    }
    for (const [jaar, qs] of Object.entries(perJaar)) {
      const f = path.join(ARCHIEF_DIR, `quotations-${jaar}.jsonl`);
      fs.writeFileSync(f, qs.map((q) => JSON.stringify(q)).join('\n') + '\n');
      console.log('archief:', f, qs.length, 'offertes');
    }
    console.log('Archief klaar (compacte records; volledige documenten blijven via documentId opvraagbaar zolang RP loopt).');
  }

  if (IMPORT) {
    const open = lijst.filter((q) =>
      ['DRAFT', 'SENT'].includes(q.quotationStatus) &&
      new Date(q.quotationCreationTimestamp || 0).toISOString() >= SINDS &&
      q.quotationNumber);
    console.log(`Open offertes (DRAFT/SENT) sinds ${SINDS}:`, open.length, LIVE ? '(LIVE import)' : '(dry-run)');
    if (!LIVE) {
      open.slice(0, 15).forEach((q) => console.log('  zou importeren:', q.quotationNumber, q.quotationStatus, q.documentTitle || ''));
      if (open.length > 15) console.log('  ... en', open.length - 15, 'meer');
      return;
    }
    let batch = [], klaar = 0;
    const stuur = async () => {
      if (!batch.length) return;
      const r = await fetch(`${SITE}/api/admin/offertes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ADMIN_PW, Cookie: 'sonty-admin-token=' + ADMIN_PW },
        body: JSON.stringify({ action: 'import', offertes: batch }),
      });
      const j = await r.json();
      klaar += batch.length;
      console.log(`  batch → HTTP ${r.status}: +${j.aangemaakt || 0} nieuw, ${j.overgeslagen || 0} overgeslagen, fouten: ${(j.fouten || []).length} (${klaar}/${open.length})`);
      (j.fouten || []).forEach((f) => console.log('    FOUT', f));
      batch = [];
    };
    for (const q of open) {
      const doc = await volledigDoc(q.documentId);
      const regels = regelsVan(doc);
      if (!regels.length) continue;
      batch.push({
        rpNummer: String(q.quotationNumber),
        rpDocumentId: q.documentId,
        klant: await contactVan(doc),
        regels,
        totaalInclBTW: totaalVan(doc, regels),
        status: q.quotationStatus,
        aangemaakt: new Date(q.quotationCreationTimestamp || 0).toISOString(),
      });
      if (batch.length >= 25) await stuur();
    }
    await stuur();
    console.log('Import klaar.');
  }

  if (!ARCHIEF && !IMPORT) console.log('Gebruik --archief en/of --import (--dry/--live, --sinds=YYYY-MM-DD)');
})().catch((e) => { console.error('FOUT:', e.message || e); process.exit(1); });

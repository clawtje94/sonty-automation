#!/usr/bin/env node
// MIGRATIE REUZENPANDA → EIGEN CRM (blok 4 "Reuzenpanda uitzetten", 30-08-2026).
// Leest alle RP-backlog-items (19.7k, incl. gearchiveerd), haalt per item de offertelijst op (1 call), zet elk item om naar
// een lead (rpItemNaarLead, puur, lab: scenario-lab/onderdelen/migratie-rp.js) en post ze in batches naar
// /api/eigen-crm/import. Hervatbaar: data/migratie-rp.json onthoudt welke items al staan (id → tijd).
//   node scripts/migreer-rp-naar-eigen.js --dry-run [--max=20]   → toont voorbeelden, schrijft niets
//   node scripts/migreer-rp-naar-eigen.js [--max=N] [--alleen-actief] [--overschrijf]
// Zuinig op RP: 3 parallel, 80 ms pauze per bundel; bij 429/5xx even wachten en opnieuw.
const fs = require('fs');
const path = require('path');

const RP = 'https://backend.reuzenpanda.nl';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BACKLOG_ID = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const STAND = path.join(__dirname, '..', 'data', 'migratie-rp.json');
const LOG = path.join(__dirname, '..', 'data', 'migratie-rp.log');
const DRY = process.argv.includes('--dry-run');
const ALLEEN_ACTIEF = process.argv.includes('--alleen-actief');
const OVERSCHRIJF = process.argv.includes('--overschrijf');
const MAX = Number((process.argv.find((a) => a.startsWith('--max=')) || '').split('=')[1] || 0) || 0;
const PARALLEL = 3;

function rpKey() { try { return require('./ai-ks/config.js').RP_API_KEY; } catch { return process.env.RP_API_KEY; } }
function adminPw() { try { return require('./secrets.js').ADMIN_PASSWORD; } catch { return process.env.ADMIN_PASSWORD; } }
const log = (t) => { const r = `[${new Date().toISOString()}] ${t}`; console.log(r); try { fs.appendFileSync(LOG, r + '\n'); } catch { /* geen log */ } };
const slaap = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpGet(ep, poging = 0) {
  const r = await fetch(RP + ep, { headers: { Authorization: 'Bearer ' + rpKey() }, signal: AbortSignal.timeout(30000) });
  if ((r.status === 429 || r.status >= 500) && poging < 4) { await slaap(2000 * (poging + 1)); return rpGet(ep, poging + 1); }
  if (!r.ok) throw new Error(`RP ${r.status} op ${ep.slice(0, 80)}`);
  return r.json();
}

// ── zuivere omzetting (getest in het lab) ──
const veld = (blob, label) => { const m = String(blob || '').match(new RegExp('(?:^|\\n)' + label + '\\??:[ \\t]*([^\\n]*)', 'i')); return m ? m[1].trim() : ''; };
const iso = (ms) => { const n = Number(ms || 0); return n > 0 ? new Date(n).toISOString() : null; };

function splitsAdres(adres) {
  const t = String(adres || '').replace(/,?\s*Nederland$/i, '').trim();
  const m = t.match(/^(.*?)\s+(\d+[a-zA-Z0-9\-]*)\s*,\s*(\d{4}\s?[A-Za-z]{2})\s+(.+)$/);
  if (m) return { straat: m[1].trim(), huisnummer: m[2], postcode: m[3].replace(/\s/, '').toUpperCase(), plaats: m[4].trim() };
  return { straat: t, huisnummer: '', postcode: '', plaats: '' };
}

/** RP-item + offertelijst → lead voor het eigen CRM. Kiest ACCEPTED (nieuwste) > SENT (nieuwste) > rest (nieuwste). */
function rpItemNaarLead(item, quotations = []) {
  const blob = (item.summary || '') + '\n' + (item.description || '');
  const f = item.fields || {};
  const naamDelen = String(item.summary || '').trim().split(/\s+/);
  const voornaam = veld(blob, 'Voornaam') || naamDelen[0] || '';
  const achternaam = veld(blob, 'Achternaam') || naamDelen.slice(1).join(' ') || '-';
  const uitAdres = splitsAdres(f.address);
  const contact = {
    voornaam, achternaam,
    email: (veld(blob, 'E-?mailadres') || f.email || '').toLowerCase().trim(),
    telefoon: veld(blob, 'Telefoonnummer') || f.phone || '',
    straat: veld(blob, 'Straatnaam') || uitAdres.straat, huisnummer: veld(blob, 'Huisnummer') || uitAdres.huisnummer,
    postcode: (veld(blob, 'Postcode') || uitAdres.postcode).replace(/\s/, '').toUpperCase(), plaats: veld(blob, 'Plaats') || uitAdres.plaats,
  };
  const afkomst = veld(blob, 'Hoe komt u bij ons terecht') || veld(blob, 'Bron');
  const kanaal = /winkel/i.test(afkomst) || /winkel/i.test(item.status_label || '') ? 'winkel' : 'online';
  const producten = [];
  // alleen echte productregels; optieregels ("1x Breedte tussen …", "1x Inclusief") horen er niet bij
  for (const m of String(item.description || '').matchAll(/(?:^|\n)(\d+)x ([^\n:]+):?/g)) { const naam = m[2].trim(); if (/^(breedte|hoogte|uitval|inclusief|kleur|bediening|montage|doek|ral|zonder|met )/i.test(naam)) continue; producten.push({ product: naam, quantity: Number(m[1]) || 1 }); }
  const opmerking = (String(item.description || '').match(/Opmerking:\s*([\s\S]*?)(?=\n\d+x |\n*$)/i) || [])[1]?.trim() || '';
  const rank = { ACCEPTED: 0, SENT: 1 };
  const docs = [...quotations].filter((q) => q && q.documentId).sort((a, b) => {
    const ra = rank[String(a.quotationStatus || '').toUpperCase()] ?? 2, rb = rank[String(b.quotationStatus || '').toUpperCase()] ?? 2;
    if (ra !== rb) return ra - rb;
    return (b.quotationCreationTimestamp || 0) - (a.quotationCreationTimestamp || 0);
  });
  const beste = docs[0] || null;
  const gearchiveerd = (item.technical_labels || []).some((l) => l.type === 'ITEM_ARCHIVED');
  const lead = {
    id: 'LEAD-RP-' + item.id,
    type: kanaal === 'winkel' ? 'offerte' : 'configurator',
    rpKolom: item.status_id || undefined,
    timestamp: iso(item.timestamp_created) || new Date().toISOString(),
    updatedAt: iso(item.timestamp_updated) || iso(item.timestamp_created) || new Date().toISOString(),
    contact,
    source: { bron: 'reuzenpanda', rpItemId: item.id, rpLeadConfigId: item.item_subject?.id || null, afkomst: afkomst || null, kanaal, kolomLabel: item.status_label || null },
    products: producten,
    bericht: opmerking || undefined,
    gearchiveerd: gearchiveerd || undefined,
    migratie: { bron: 'rp-migratie-2026-08-30', rpItemId: item.id },
  };
  if (beste) {
    lead.offerte = {
      rpNummer: String(beste.quotationNumber || ''), rpDocumentId: beste.documentId,
      totaalInclBTW: (() => { const v = beste.pricing && beste.pricing.total != null ? Number(beste.pricing.total) : (f.cf_lead_value && f.cf_lead_value.amount ? Number(f.cf_lead_value.amount) : null); return v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100; })(),
      status: String(beste.quotationStatus || '').toUpperCase() || null,
      datum: iso(beste.quotationCreationTimestamp), verlooptOp: iso(beste.quotationExpirationTimestamp),
      link: `https://document.reuzenpanda.nl/nl/${PID}/${beste.documentId}/latest`,
      aantalDocs: docs.length, alleNummers: docs.map((d) => String(d.quotationNumber || '')).filter(Boolean),
      getekendOp: String(beste.quotationStatus || '').toUpperCase() === 'ACCEPTED' ? (iso(beste.quotationCreationTimestamp) || null) : null,
    };
  }
  return lead;
}

async function main() {
  let stand = { gedaan: {}, laatsteRun: null };
  try { stand = JSON.parse(fs.readFileSync(STAND, 'utf8')); } catch { /* eerste run */ }
  const gedaan = stand.gedaan || {};
  log(`start ${DRY ? '(dry-run) ' : ''}— al gedaan: ${Object.keys(gedaan).length}`);
  let gezien = 0, verwerkt = 0, overgeslagen = 0, fouten = 0, aangemaakt = 0, bijgewerkt = 0;
  const voorbeelden = [];
  let bundel = [];

  async function verstuur() {
    if (!bundel.length) return;
    const leads = bundel; bundel = [];
    if (DRY) { verwerkt += leads.length; return; }
    const r = await fetch('https://sonty-website.vercel.app/api/eigen-crm/import', {
      method: 'POST', headers: { Authorization: 'Bearer ' + adminPw(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads, overschrijf: OVERSCHRIJF }), signal: AbortSignal.timeout(60000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('import ' + r.status + ' ' + JSON.stringify(d).slice(0, 120));
    aangemaakt += d.aangemaakt || 0; bijgewerkt += d.bijgewerkt || 0; overgeslagen += d.overgeslagen || 0;
    for (const f of d.fouten || []) { fouten++; log('  FOUT ' + f); }
    const nu = new Date().toISOString();
    for (const l of leads) gedaan[l.id] = nu;
    verwerkt += leads.length;
    fs.writeFileSync(STAND, JSON.stringify({ gedaan, laatsteRun: nu }));
  }

  for (let offset = 0; offset < 60000; offset += 1000) {
    const d = await rpGet(`/contact-service/${PID}/backlogs/${BACKLOG_ID}/items?limit=1000&offset=${offset}`);
    const items = (d && d.items) || [];
    if (!items.length) break;
    const todo = items.filter((it) => {
      gezien++;
      if (!OVERSCHRIJF && gedaan['LEAD-RP-' + it.id]) return false;
      if (ALLEEN_ACTIEF && (it.technical_labels || []).some((l) => l.type === 'ITEM_ARCHIVED')) return false;
      return true;
    });
    for (let i = 0; i < todo.length; i += PARALLEL) {
      if (MAX && verwerkt + bundel.length >= MAX) break;
      const deel = todo.slice(i, i + PARALLEL);
      const leads = await Promise.all(deel.map(async (it) => {
        let qs = [];
        if (it.item_subject && it.item_subject.id) {
          try { const q = await rpGet(`/document-service/v1/${PID}/quotations?lead_configuration_id=${it.item_subject.id}`); qs = (q && q.quotationDatas) || []; }
          catch (e) { log(`  offertes ${it.id}: ${e.message}`); }
        }
        return rpItemNaarLead(it, qs);
      }));
      for (const l of leads) { bundel.push(l); if (voorbeelden.length < 3) voorbeelden.push(l); }
      if (bundel.length >= 100) await verstuur();
      await slaap(80);
    }
    if (MAX && verwerkt + bundel.length >= MAX) break;
    if (items.length < 1000) break;
  }
  await verstuur();
  if (DRY) for (const v of voorbeelden) { const c = v.contact, o = v.offerte || {}; console.log(`VOORBEELD ${v.id} | ${c.voornaam} ${c.achternaam} | ${c.email} | ${c.telefoon} | ${c.straat} ${c.huisnummer}, ${c.postcode} ${c.plaats} | kolom ${(v.rpKolom || '').slice(0, 8)} (${v.source.kolomLabel}) | ${v.type} | afkomst ${v.source.afkomst} | offerte ${o.rpNummer || '-'} ${o.status || ''} €${o.totaalInclBTW ?? '-'} (${o.aantalDocs || 0} docs) | producten ${(v.products || []).map((p) => p.quantity + 'x ' + p.product).join(', ')}${v.gearchiveerd ? ' | ARCHIEF' : ''}`); }
  const samenvatting = `klaar: ${gezien} items gezien, ${verwerkt} verwerkt, ${aangemaakt} aangemaakt, ${bijgewerkt} bijgewerkt, ${overgeslagen} overgeslagen, ${fouten} fouten`;
  log(samenvatting);
  if (!DRY) {
    try {
      const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
      const tok = (env.match(/TELEGRAM_BOT_TOKEN=["']?([^"'\n]+)/) || [])[1];
      if (tok) await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: 1700128390, text: 'Migratie RP → eigen CRM ' + samenvatting }) });
    } catch { /* melding is extra */ }
  }
}

module.exports = { rpItemNaarLead, splitsAdres, veld };
if (require.main === module) main().catch((e) => { log('FOUT ' + e.message); process.exit(1); });

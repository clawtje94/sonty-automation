// DOSSIERS UIT HET EIGEN CRM IN REUZENPANDA-VORM (blok 4 "Reuzenpanda uitzetten", 30-08-2026).
// Rapporten (weekrapport-conversie, weekrapport-cohorten, conversie-per-kanaal, cron-getekend-rapport) lezen het RP-bord en
// per dossier de offertelijst. Zodra RP uit staat (vlag data/.rp-uit) leveren deze functies dezelfde antwoorden uit het eigen CRM:
//   rpUit()                 → vlag data/.rp-uit bestaat
//   haalDossiers({vanafMs}) → alle leads (RP-itemvorm, met offerte) sinds vanafMs, uit /api/eigen-crm?export=1
//   rpGetVervanger(ep)      → beantwoordt de drie RP-endpoints die de rapporten gebruiken vanuit de eigen data:
//        /contact-service/<pid>/backlogs/<id>/items | /boards/<id>/items   → { items: [...] }
//        /document-service/v1/<pid>/quotations?lead_configuration_id=<lc>  → { quotationDatas: [...] }
//        /document-service/v1/<pid>/quotations/<docId>                     → { quotationData: {...segments met lines} }
// Gebruik in een rapport:  const rpGet = D.rpUit() ? D.rpGetVervanger : rpGetOrigineel;
const fs = require('fs');
const path = require('path');

const VLAG = path.join(__dirname, '..', '..', 'data', '.rp-uit');
const BASIS = process.env.EIGEN_CRM_BASIS || 'https://sonty-website.vercel.app/api/eigen-crm';
let TOKEN = null;
function token() { if (TOKEN) return TOKEN; try { TOKEN = require('../secrets.js').ADMIN_PASSWORD; } catch { TOKEN = process.env.ADMIN_PASSWORD || ''; } return TOKEN; }
function rpUit() { return fs.existsSync(VLAG); }

let CACHE = null; // { tijd, vanafMs, items }
/** Alleen voor het lab: vaste dossiers onder de vervanger schuiven (geen fetch). */
function _zetDossiers(items) { CACHE = { tijd: Date.now(), vanafMs: 0, items, vast: true }; }
async function haalDossiers({ vanafMs = 0 } = {}) {
  if (CACHE && (CACHE.vast || Date.now() - CACHE.tijd < 10 * 60000) && CACHE.vanafMs <= vanafMs) return CACHE.items.filter((i) => Number(i.timestamp_created || 0) >= vanafMs);
  const items = [];
  let cursor = 0;
  for (let ronde = 0; ronde < 200; ronde++) {
    const r = await fetch(`${BASIS}?export=1&vanaf=${vanafMs}&offset=${cursor}&limit=1000`, { headers: { Authorization: 'Bearer ' + token() }, signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(`eigen-crm export ${r.status}`);
    const d = await r.json();
    items.push(...(d.items || []));
    if (!d.volgende) break;
    cursor = d.volgende;
  }
  CACHE = { tijd: Date.now(), vanafMs, items };
  return items;
}

function quotationVan(item) {
  const o = item.offerte || {};
  if (!o.nummers || !o.nummers.length) return [];
  const ts = o.datums && o.datums[0] ? Date.parse(o.datums[0]) : Number(item.timestamp_created || 0);
  return [{
    documentId: o.documentId || item.id, quotationNumber: o.nummers[0], quotationStatus: o.status || 'DRAFT',
    quotationCreationTimestamp: ts, quotationExpirationTimestamp: null, pricing: { total: o.totaalInclBTW == null ? null : Number(o.totaalInclBTW) },
    documentTitle: o.nummers[0], documentType: 'QUOTATION',
  }];
}

function volledigDoc(item) {
  const o = item.offerte || {};
  const lines = Array.isArray(o.toolLines) && o.toolLines.length
    ? o.toolLines.map((l) => ({ description: String(l.description || ''), pricePerUnit: Number(l.pricePerUnit || 0), units: Number(l.units || 1) }))
    : (o.regels || []).filter((r) => r && Number(r.subtotaal || 0) >= 0).map((r) => ({ description: String(r.omschrijving || '') + (r.beschrijving || r.details ? '\n' + (r.beschrijving || r.details) : ''), pricePerUnit: Number(r.prijsPerStuk != null ? r.prijsPerStuk : (Number(r.subtotaal || 0) / Math.max(1, Number(r.aantal || 1)))), units: Number(r.aantal || 1) }));
  const q = quotationVan(item)[0] || {};
  return { quotationData: { ...q, quotationStatus: q.quotationStatus, segments: { defaultTemplatePriceLineGroup: { data: { lines, groupDiscount: o.korting && o.korting.pct ? { type: 'PERCENTAGE', amount: Number(o.korting.pct), name: o.korting.naam || '' } : null } }, defaultTemplateContactPart: { data: item.summary || '' } } } };
}

/** Zelfde vragen als aan RP, antwoorden uit het eigen CRM. Onbekend endpoint → lege structuur (zichtbaar in de log). */
async function rpGetVervanger(ep) {
  const e = String(ep || '');
  if (/\/(backlogs|boards)\/[^/]+\/items/.test(e)) {
    const items = await haalDossiers({ vanafMs: 0 });
    return { items: items.filter((i) => !i.gearchiveerd) };
  }
  let m = e.match(/\/quotations\?lead_configuration_id=([^&]+)/);
  if (m) {
    const items = await haalDossiers({ vanafMs: 0 });
    const it = items.find((i) => (i.item_subject && i.item_subject.id === m[1]) || i.id === m[1]);
    return { quotationDatas: it ? quotationVan(it) : [] };
  }
  m = e.match(/\/quotations\/([^/?]+)/);
  if (m) {
    const items = await haalDossiers({ vanafMs: 0 });
    const it = items.find((i) => (i.offerte && i.offerte.documentId === m[1]) || i.id === m[1]);
    return it ? volledigDoc(it) : null;
  }
  console.log('[dossiers] onbekend RP-endpoint zonder vervanger: ' + e.slice(0, 80));
  return null;
}

module.exports = { rpUit, haalDossiers, rpGetVervanger, quotationVan, volledigDoc, _zetDossiers, VLAG };

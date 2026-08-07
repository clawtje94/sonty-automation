// Producten van een RP-lead uitlezen. Apart bestand zodat planner, sandbox, kruischeck
// en gripp-invullen dezelfde logica gebruiken en er geen twee versies uit elkaar lopen.
//
// REGEL (Daimy 05-08, geval Wilco Vendrig): de klant kan meerdere offertedocumenten
// hebben. De GETEKENDE (ACCEPTED) telt. Meerdere documenten zonder één getekende =
// AMBIGU: dan mag niets automatisch doorlopen, de klant moet er echt zelf één tekenen.
// En per product ook bediening + kleur meenemen ("ik wil het product maar ook de
// bediening weten en de kleur").
const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';

const GEEN_PRODUCT_REGEL = /^inmeten \+ montage|^montage\b|^korting|^toeslag|^transport/i;

// OFFERTE-CACHE (Daimy 06-08: "ik krijg steeds api-gezeur met RP omdat we te veel
// gebruiken"): offertedocumenten wijzigen zelden, maar werden elke planner-ronde
// voor elke lead opnieuw opgehaald (±70 calls per ronde). Cache per lead, 6 uur.
const fs = require('fs');
const path = require('path');
// Pad injecteerbaar voor het scenario-lab: nepdata mag nooit in de echte cache
// terechtkomen (en andersom vervuilt de echte cache de scenario's).
const CACHE_PAD = process.env.RP_OFFERTE_CACHE_PAD || path.join(__dirname, '..', 'data', 'rp-offerte-cache.json');
const CACHE_TTL = 6 * 3600000;
function leesCache() { try { return JSON.parse(fs.readFileSync(CACHE_PAD, 'utf8')); } catch { return {}; } }
function schrijfCache(c) { try { fs.writeFileSync(CACHE_PAD, JSON.stringify(c)); } catch { /* cache is optioneel */ } }

async function rpGet(ep) {
  const r = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: { Authorization: 'Bearer ' + RP_API_KEY } });
  if (!r.ok) throw new Error(`RP ${r.status}`);
  return r.json();
}

/** Regels van één offertedocument naar producten met specs. */
function parseDocument(full) {
  const producten = [];
  for (const seg of Object.values(full?.quotationData?.segments || {})) {
    if (seg?.type !== 'priceLineGroup') continue;
    for (const regel of seg.data?.lines || []) {
      const tekst = String(regel.description || '');
      const naam = tekst.split('\n')[0].replace(/\*\*/g, '').trim();
      if (!naam || GEEN_PRODUCT_REGEL.test(naam)) continue;
      const veld = (label) => (tekst.match(new RegExp(label + ':\\s*([^\\n]+)', 'i')) || [])[1]?.trim() || null;
      const maat = (label) => {
        const m = tekst.match(new RegExp(label + ':\\s*(\\d+)', 'i'));
        return m ? Number(m[1]) : null;
      };
      // kleur: pak wat er is — Frame Kleur + Kleur Pantser (rolluiken), anders Doekkleur/Kleur
      const kleurdelen = [veld('Frame Kleur'), veld('Kleur Pantser') || veld('Doekkleur') || veld('Kleur doek') || veld('Kleur')]
        .filter(Boolean);
      producten.push({
        type: naam.toLowerCase(),
        naam,
        aantal: Math.max(1, Number(regel.units) || 1),
        breedte: maat('Breedte'),
        hoogte: maat('Hoogte') || maat('Uitval'),
        kleur: [...new Set(kleurdelen)].join(' / ') || null,
        bediening: veld('Bediening') || null,
      });
    }
  }
  return producten;
}

/**
 * Beste offertedocument van een lead + producten.
 * Geeft { producten, status, ambigu, aantalDocs }:
 * - ACCEPTED aanwezig → nieuwste ACCEPTED (ambigu=false)
 * - precies 1 document → dat document (ambigu=false)
 * - meerdere documenten, geen ACCEPTED → ambigu=true, producten=[]
 */
async function leesOfferte(item) {
  const leeg = { producten: [], status: null, ambigu: false, aantalDocs: 0, nummers: [], datums: [] };
  const lcId = item.item_subject?.id;
  if (!lcId) return leeg;
  const cache = leesCache();
  const hit = cache[lcId];
  if (hit && Date.now() - hit.op < CACHE_TTL) return hit.waarde;
  try {
    const docs = await rpGet(`/document-service/v1/${PID}/quotations?lead_configuration_id=${lcId}`);
    const lijst = docs?.quotationDatas || [];
    if (!lijst.length) return leeg;
    // alle RP-nummers van deze lead (quotationNumber én het nummer uit de titel) —
    // de offerte-sheet koppelt hierop, want Gripp bestaat pas ná "Gripp invullen"
    const nummers = [...new Set(lijst.flatMap((d) => [
      String(d.quotationNumber || '').replace(/\D/g, ''),
      String(d.documentTitle || d.title || '').replace(/\D/g, ''),
    ]).filter((n) => n.length >= 6))];
    // offertedatums: de sheet-rij staat in de maandtab van de OFFERTEDATUM (Daimy 06-08)
    const datums = lijst.map((d) => d.quotationCreationTimestamp).filter(Boolean);
    const geaccepteerd = lijst.filter((d) => (d.quotationStatus || d.documentStatus) === 'ACCEPTED')
      .sort((a, b) => (b.quotationCreationTimestamp || 0) - (a.quotationCreationTimestamp || 0));
    let keuze = null;
    if (geaccepteerd.length) keuze = geaccepteerd[0];
    else if (lijst.length === 1) keuze = lijst[0];
    else {
      const waarde = { producten: [], status: null, ambigu: true, aantalDocs: lijst.length, nummers, datums };
      cache[lcId] = { op: Date.now(), waarde };
      schrijfCache(cache);
      return waarde;
    }

    const full = await rpGet(`/document-service/v1/${PID}/quotations/${keuze.documentId}`);
    const waarde = {
      producten: parseDocument(full),
      status: keuze.quotationStatus || keuze.documentStatus || null,
      ambigu: false,
      aantalDocs: lijst.length,
      nummers,
      datums,
      documentId: keuze.documentId, // voor het adres-vangnet (offerte-PDF)
    };
    cache[lcId] = { op: Date.now(), waarde };
    schrijfCache(cache);
    return waarde;
  } catch {
    return leeg;
  }
}

/** Compacte weergaveregel: "3x Rolluik ROMA 1260×1350 — Antraciet / RAL 7016 — Somfy IO solar". */
function productRegel(p) {
  const maat = p.breedte ? ` ${p.breedte}×${p.hoogte || '?'}` : '';
  const extra = [p.kleur, p.bediening].filter(Boolean).join(' — ');
  return `${p.aantal}x ${p.naam}${maat}${extra ? ` — ${extra}` : ''}`;
}

/** Compat-wrapper: alleen de productenlijst (leeg bij ambigu — caller ziet dat via leesOfferte). */
async function leesProductenUitOfferte(item) {
  return (await leesOfferte(item)).producten;
}

module.exports = { leesOfferte, leesProductenUitOfferte, productRegel, GEEN_PRODUCT_REGEL };

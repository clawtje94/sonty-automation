/**
 * CORPUS — haalt uit de echte offerte-backups elke prijsvraag die ooit gesteld is.
 *
 * Dit bestand LEEST ALLEEN van schijf. Er zit geen enkele netwerkaanroep in en het
 * raakt Reuzenpanda niet aan. De backups in data/offerte-backups zijn kopieën die
 * v4 zelf heeft weggeschreven vóór hij een offerte aanpaste.
 *
 * Een "prijsvraag" is de set gegevens waar de prijs vanaf hangt:
 *   productKey, breedte, hoogte, uitval, bedieningstype
 * Meer heeft de prijsmotor niet nodig. Twee offerteregels met dezelfde vijf waarden
 * moeten per definitie dezelfde prijs geven, dus die tellen we één keer.
 */
const fs = require('fs');
const path = require('path');

const BACKUPDIR = path.join(__dirname, '..', '..', 'data', 'offerte-backups');

/** Zoekt de offerteregels op, ongeacht in welke vorm de backup is weggeschreven.
 *  In de map staan vier verschillende vormen door elkaar (losse {lines}, volledige
 *  quotation, en twee varianten met documentId eromheen), dus zoeken i.p.v. aannemen. */
function vindLines(node, diepte = 0) {
  if (!node || typeof node !== 'object' || diepte > 8) return null;
  if (Array.isArray(node)) {
    if (node.length && node.some((x) => x && typeof x === 'object' && typeof x.description === 'string')) return node;
    for (const el of node) { const r = vindLines(el, diepte + 1); if (r) return r; }
    return null;
  }
  if (Array.isArray(node.lines)) { const r = vindLines(node.lines, diepte + 1); if (r) return r; }
  for (const k of Object.keys(node)) {
    if (k === 'lines') continue;
    const r = vindLines(node[k], diepte + 1);
    if (r) return r;
  }
  return null;
}

/** Verzamelt de prijsvragen uit één backupbestand. Geeft ook terug wat er is
 *  overgeslagen en waarom — een meetlat die stilzwijgend dingen weglaat is geen bewijs. */
function vragenUitBestand(bestand, api) {
  const uit = { vragen: [], regels: 0, overgeslagen: [] };
  let data;
  try { data = JSON.parse(fs.readFileSync(bestand, 'utf8')); }
  catch (e) { uit.overgeslagen.push({ reden: 'onleesbaar json', detail: e.message }); return uit; }

  const lines = vindLines(data);
  if (!lines) { uit.overgeslagen.push({ reden: 'geen offerteregels in bestand' }); return uit; }

  for (const l of lines) {
    const desc = l.description || '';
    const kop = desc.split('\n')[0] || '';
    uit.regels++;

    if (!kop.trim()) { uit.overgeslagen.push({ reden: 'lege regel' }); continue; }

    const mm = (naam) => {
      const m = desc.match(new RegExp(naam + '[:\\s-]*(\\d+[\\.,]?\\d*)\\s*(mm|cm)?', 'i'));
      if (!m) return null;
      const n = parseFloat(m[1].replace(',', '.'));
      return (m[2] || 'mm').toLowerCase() === 'cm' ? n * 10 : n;
    };

    // ROMA: eigen prijsboek en eigen opslag (1,15). Hoort wél in de meetlat, want die
    // opslag is net zo goed onderdeel van "staat het op één plek".
    if (/roma/i.test(kop)) {
      const b = mm('Breedte'), h = mm('Hoogte');
      if (!b || !h) { uit.overgeslagen.push({ reden: 'roma-regel zonder maten', kop }); continue; }
      uit.vragen.push({
        soort: 'roma', product: kop.replace(/\*/g, '').trim(),
        breedteMM: b, hoogteMM: h,
        bediening: desc.match(/Bediening:\s*([^\n]+)/i)?.[1]?.trim() || '',
        _kop: kop.replace(/\*/g, '').slice(0, 60), _bestand: path.basename(bestand),
      });
      continue;
    }

    // MARKIEZEN: gaan niet door calculateCorrectPrice maar door mkTotaalExcl, met eigen
    // tabellen die excl BTW in v4 zelf staan. Zonder deze tak zou de meetlat ze stil overslaan.
    if (/^markies/i.test(kop.replace(/\*/g, '').trim())) {
      const b = mm('Breedte'), u = mm('Uitval');
      const mat = desc.match(/Materiaal:\s*([^\n]+)/i)?.[1]?.trim() || '';
      if (!b || !mat) { uit.overgeslagen.push({ reden: 'markies zonder maat of materiaal', kop }); continue; }
      uit.vragen.push({
        soort: 'markies', materiaal: mat, breedteMM: b, uitvalMM: u || 0,
        bediening: desc.match(/Type bediening:\s*([^\n]+)/i)?.[1]?.trim() || '',
        _kop: kop.replace(/\*/g, '').slice(0, 60), _bestand: path.basename(bestand),
      });
      continue;
    }

    const cat = api.getCategory(kop);
    const pKey = api.getProductKey(kop);
    if (!cat && !pKey) { uit.overgeslagen.push({ reden: 'geen product (montage/tekst/korting)', kop }); continue; }
    if (!pKey) { uit.overgeslagen.push({ reden: 'categorie herkend maar geen productKey', kop }); continue; }
    // Voorraadschermen hebben een vaste prijs buiten het boek om.
    if (/voorraad/i.test(kop) || desc.includes('Direct leverbaar uit voorraad')) {
      uit.overgeslagen.push({ reden: 'voorraadscherm (vaste prijs)', kop }); continue;
    }

    const maat = api.extractMaatFromDesc(desc);
    if (!maat.breedte && !maat.hoogte) { uit.overgeslagen.push({ reden: 'geen maten in regel', kop }); continue; }

    // Zelfde afleiding als correctProductPrice in v4 (regel 1334 e.v.) — bewust
    // gekopieerd i.p.v. hergebruikt, zodat de meetlat blijft werken als v4 verbouwd wordt.
    const bedStr = (desc.match(/Bediening:\s*([^\n]+)/i)?.[1] || '').toLowerCase();
    const motorStr = (desc.match(/Motor:\s*([^\n]+)/i)?.[1] || '').toLowerCase();
    let bedType = 'io';
    if (motorStr.includes('brel') || bedStr.includes('brel')) bedType = 'solarBrel';
    else if (motorStr.includes('solar') || bedStr.includes('solar')) bedType = 'solar';
    else if (bedStr.includes('afstandsbediening') || bedStr.includes('motor +')) bedType = 'afstandsbediening';
    else if (bedStr.includes('draaischakelaar') || motorStr.includes('somfy lt')) bedType = 'draaischakelaar';
    else if (bedStr.includes('handbediend') || bedStr.includes('slingerstang') || bedStr.includes('band')) bedType = 'handbediend';

    uit.vragen.push({
      soort: 'sunmaster',
      productKey: pKey,
      breedte: maat.breedte,
      hoogte: maat.hoogte,
      uitval: maat.uitval,
      bedType,
      // alleen ter herleiding, telt niet mee in de sleutel
      _kop: kop.replace(/\*/g, '').slice(0, 60),
      _bestand: path.basename(bestand),
    });
  }
  return uit;
}

const sleutel = (v) =>
  v.soort === 'roma' ? ['roma', v.product, v.breedteMM, v.hoogteMM, v.bediening].join('|')
  : v.soort === 'markies' ? ['markies', v.materiaal, v.breedteMM, v.uitvalMM, v.bediening].join('|')
  : ['sunmaster', v.productKey, v.breedte, v.hoogte, v.uitval, v.bedType].join('|');

/** Bouwt het volledige corpus. alleen2026: de backupmap bevat ook 2025-offertes die met
 *  een ander prijsboek zijn gemaakt; die horen niet in een meetlat voor het 2026-boek. */
function bouwCorpus(api, { alleen2026 = true } = {}) {
  const bestanden = fs.readdirSync(BACKUPDIR)
    .filter((f) => f.endsWith('.json'))
    .filter((f) => {
      const m = f.match(/^(\d{8,9})/);
      if (!m) return false;
      return alleen2026 ? m[1].startsWith('2026') : true;
    })
    .sort();

  const uniek = new Map();
  const redenen = {};
  let regels = 0, bestandenGelezen = 0, bestandenZonderRegels = 0;

  for (const f of bestanden) {
    const r = vragenUitBestand(path.join(BACKUPDIR, f), api);
    bestandenGelezen++;
    regels += r.regels;
    if (!r.regels) bestandenZonderRegels++;
    for (const o of r.overgeslagen) redenen[o.reden] = (redenen[o.reden] || 0) + 1;
    for (const v of r.vragen) if (!uniek.has(sleutel(v))) uniek.set(sleutel(v), v);
  }

  return {
    bestandenGevonden: bestanden.length,
    bestandenGelezen,
    bestandenZonderRegels,
    regelsBekeken: regels,
    unieke: [...uniek.values()].sort((a, b) => sleutel(a).localeCompare(sleutel(b))),
    overgeslagen: redenen,
  };
}

module.exports = { bouwCorpus, vragenUitBestand, vindLines, sleutel, BACKUPDIR };

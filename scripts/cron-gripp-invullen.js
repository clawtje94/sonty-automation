#!/usr/bin/env node
/**
 * Automatisch "Gripp invullen" verwerken
 *
 * Draait dagelijks om 18:30 via launchd
 *
 * Per deal in "Gripp invullen":
 * 1. Pak de offerte uit RP via lead_configuration_id
 * 2. Maak relatie (Particulier) aan in Gripp
 * 3. Maak offerte aan in Gripp met:
 *    - Juiste producten (mapping RP → Gripp)
 *    - Prijzen excl BTW (RP incl / 1.21)
 *    - Korting uit groupDiscount
 *    - Klant opmerking in beschrijving
 * 4. Zet RP status naar "Afgerond"
 *
 * v2: Geen Playwright meer — puur API calls
 */

const fs = require('fs');
const path = require('path');

const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const GRIPP_KEY = 'WZvM6r0bAGGONGRhrkWTxVrydXq9H2';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BACKLOG_ID = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const GRIP_INVULLEN_STATUS = 'f895f76f-175e-4ea0-bb7c-6cc2f4e5d846';
const AFGEROND_STATUS = '2082ad8a-517c-4e24-8c0f-a5be69b1588a'; // echte Afgerond status (913 items)
const { planningTelegram } = require('./lib/telegram-planning.js');
const SENT_LOG = path.join(__dirname, '.gripp-invullen-sent.json');

function getSentLog() { try { return JSON.parse(fs.readFileSync(SENT_LOG, 'utf8')); } catch { return {}; } }
function markSent(name, data) {
  const log = getSentLog();
  log[name] = { ...data, processedAt: new Date().toISOString() };
  fs.writeFileSync(SENT_LOG, JSON.stringify(log, null, 2));
}

// ============ API HELPERS ============

// Fetch met retry voor tijdelijke netwerkfouten (ECONNRESET etc.) — max 3 pogingen
async function fetchRetry(url, options, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      return await fetch(url, options);
    } catch (e) {
      if (i === tries) throw e;
      console.log('  (netwerkfout, poging ' + (i + 1) + '/' + tries + ' over ' + (i * 5) + 's: ' + (e.cause?.code || e.message) + ')');
      await new Promise(r => setTimeout(r, i * 5000));
    }
  }
}

async function rpGet(ep) {
  if (require('./lib/dossiers.js').rpUit()) return /\/items/.test(ep) ? { items: [] } : null; // RP uit: alleen eigen leads
  const res = await fetchRetry('https://backend.reuzenpanda.nl' + ep, { headers: { 'Authorization': 'Bearer ' + RP_API_KEY } });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

async function rpPatch(ep, body) {
  const res = await fetchRetry('https://backend.reuzenpanda.nl' + ep, {
    method: 'PATCH', headers: { 'Authorization': 'Bearer ' + RP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function setStatus(itemId, statusId) {
  // eigen CRM-lead (LEAD-…): kolom in het eigen CRM, niet in RP (blok 3 RP-uitzetten, 30-08)
  { const E = require('./lib/eigen-crm.js'); if (E.isEigen(itemId)) return E.zetKolom(itemId, statusId); }
  return rpPatch('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items/' + itemId, { item: { status_id: statusId } });
}


// Het up/downgrade-blok ("Liever een ander model of bediening?" met ander model,
// andere bediening, kleur, smart home) hoort bij de KLANT-offerte in RP, niet in
// Gripp: de inmeters lezen daar alleen de specs van wat er gekocht is (Daimy
// 2026-08-17, screenshot Raymond Cats: specs + waarom + garantie, verder niks).
// Alles vanaf die kopregel wordt dus weggeknipt bij het overzetten.
function zonderOptiesBlok(tekst) {
  return String(tekst || '').split(/\n?Liever een ander model of bediening\??/i)[0].trimEnd();
}

// Opmaak voor het Gripp-omschrijvingsveld (Daimy 2026-08-17, voorbeeld offerte 6494):
// het veld accepteert HTML. Specs als blok, witregel, "Waarom dit ..." dikgedrukt met
// streepjes-punten, witregel, "Garantie:" dikgedrukt met de termijnen als punten.
// Tekst zonder zo'n structuur wordt alleen netjes op regels gezet, nooit weggelaten.
function alsGrippHtml(tekst) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const regels = String(tekst || '').split('\n').map((r) => r.trim()).filter(Boolean);
  if (!regels.length) return '';
  const iWaarom = regels.findIndex((r) => /^Waarom dit /i.test(r));
  const iGarantie = regels.findIndex((r) => /^Garantie\b/i.test(r));
  if (iWaarom === -1 && iGarantie === -1) return '<p>' + regels.map(esc).join('<br>') + '</p>';

  const blokken = [];
  const specs = regels.slice(0, iWaarom !== -1 ? iWaarom : iGarantie);
  if (specs.length) blokken.push('<p>' + specs.map(esc).join('<br>') + '</p>');

  if (iWaarom !== -1) {
    const kop = regels[iWaarom].replace(/:?\s*$/, ':');
    const body = regels.slice(iWaarom + 1, iGarantie !== -1 ? iGarantie : undefined).join(' ');
    // v4 schrijft het waarom-blok als doorlopende zinnen; als punten oogt het als 6494
    const punten = body.split(/(?<=\.)\s+/).map((z) => z.trim()).filter(Boolean)
      .map((z) => (z.startsWith('-') ? z : '- ' + z));
    blokken.push('<p><b>' + esc(kop) + '</b><br>' + punten.map(esc).join('<br>') + '</p>');
  }
  if (iGarantie !== -1) {
    // "Garantie: 5 jaar op het product, 7 jaar op de motor." of "3 jaar montage | 5 jaar ..."
    const inhoud = regels.slice(iGarantie).join(' ').replace(/^Garantie:?\s*/i, '').replace(/\.\s*$/, '');
    const punten = inhoud.split(/\s*[|,]\s*/).map((z) => z.trim()).filter(Boolean).map((z) => '- ' + z);
    blokken.push('<p><b>Garantie:</b><br>' + punten.map(esc).join('<br>') + '</p>');
  }
  return blokken.join('<p><br></p>');
}

// Moment waarop de prijsverhoging live ging (3 aug 2026 ±16:19 NL, commit 396bdb1):
// RP-offertes die op of ná dit moment zijn AANGEMAAKT hebben de nieuwe prijzen en
// krijgen de markering "prijs actueel 2026" in Gripp; alles van daarvóór niet,
// óók als de klant pas later tekent (afspraak Daimy 2026-08-17).
const PRIJZEN_VERHOOGD_OP = Date.parse('2026-08-03T16:19:00+02:00');

async function gripp(calls) {
  const res = await fetchRetry('https://api.gripp.com/public/api3.php', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + GRIPP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(calls)
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return [{ error: text.substring(0, 300) }]; }
}

async function sendTelegram(text) {
  await planningTelegram(text.substring(0, 4000));
}

// ============ ADRES-KETEN (2026-09-02) ============
// Waarom: 45 relaties zijn maandenlang ZONDER adres aangemaakt omdat alleen de
// "Straatnaam:/Postcode:/Plaats:"-regels uit de leadtekst gelezen werden. Sommige
// leadformulieren hebben die regels niet. Keten: (1) losse velden, (2) vrij
// adresveld uit RP (fields.address), (3) BAG (PDOK) completeert/normaliseert.
// Blijft het adres incompleet, dan gaat de aanmaak WEL door (offerte mag nooit
// blokkeren) maar volgt een Telegram-alarm + registratie, en vangt de dagelijkse
// nacontrole (adresNacontrole) hem tot hij gevuld is. Zie docs/gripp-zonder-adres-2026-09-02.md.
const ADRES_ONTBREEKT_LOG = path.join(__dirname, '..', 'data', 'gripp-adres-ontbreekt.json');

function parseVrijAdres(f) { // "Griegplantsoen 45, 2992EH Barendrecht, Nederland" e.d.
  if (!f) return null;
  const s = String(f).replace(/,?\s*Nederland\.?\s*$/i, '').trim().replace(/\s+/g, ' ');
  const pcM = s.match(/\b(\d{4})\s?([A-Za-z]{2})\b/);
  const postcode = pcM ? (pcM[1] + pcM[2]).toUpperCase() : '';
  const strM = s.match(/^([^,\d]+?)\s+(\d+\s?[a-zA-Z]?(?:[-\/]\d+)?)\b/);
  const street = strM ? strM[1].trim() : '';
  const houseNr = strM ? strM[2].replace(/\s/g, '') : '';
  let city = '';
  const parts = s.split(',').map((x) => x.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i].replace(/\b\d{4}\s?[A-Za-z]{2}\b/, '').trim();
    if (p && !/\d/.test(p) && p.toLowerCase() !== street.toLowerCase()) { city = p; break; }
  }
  if (!street && !postcode) return null;
  return { street, houseNr, zipcode: postcode, city };
}

// BAG (PDOK, gratis/openbaar): completeert postcode/plaats en normaliseert de straat.
// Faalt de lookup of wijkt het huisnummer af → null (dan houden we de bronwaarden).
async function bagAdres(a) {
  try {
    const q = a.zipcode && a.houseNr ? a.zipcode + ' ' + a.houseNr
      : [a.street, a.houseNr, a.city].filter(Boolean).join(' ');
    if (!q.trim()) return null;
    const r = await fetchRetry('https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=' + encodeURIComponent(q) + '&fq=type:adres&rows=1', {});
    if (!r || !r.ok) return null;
    const d = (await r.json())?.response?.docs?.[0];
    if (!d || !d.postcode) return null;
    if (a.houseNr && parseInt(d.huisnummer) !== parseInt(a.houseNr)) return null;
    const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    // straat moet kloppen of een afkorting/variant zijn (zelfde staart >= 5 tekens)
    if (a.street) {
      const x = norm(a.street), y = norm(d.straatnaam);
      let ok = x === y || y.endsWith(x) || x.endsWith(y);
      for (let n = Math.min(x.length, y.length, 8); !ok && n >= 5; n--) ok = x.slice(-n) === y.slice(-n);
      if (!ok) return null;
    }
    return {
      street: d.straatnaam,
      houseNr: String(d.huisnummer) + (d.huisletter || '') + (d.huisnummertoevoeging ? '-' + d.huisnummertoevoeging : ''),
      zipcode: d.postcode,
      city: d.woonplaatsnaam,
    };
  } catch { return null; }
}

// De keten. Geeft altijd een object terug; .compleet zegt of alle 4 velden er zijn.
async function adresBepalen(desc, fields) {
  let a = {
    street: desc.match(/Straatnaam:\s*([^\n]+)/i)?.[1]?.trim() || '',
    houseNr: desc.match(/Huisnummer:\s*([^\n]+)/i)?.[1]?.trim() || '',
    zipcode: (desc.match(/Postcode:\s*([^\n]+)/i)?.[1]?.trim() || '').replace(/\s/g, ''),
    city: desc.match(/Plaats:\s*([^\n]+)/i)?.[1]?.trim() || '',
    bron: 'lead-velden',
  };
  const compleet = (x) => x.street && x.houseNr && x.zipcode && x.city;
  if (!compleet(a)) {
    const vrij = parseVrijAdres(fields?.address);
    if (vrij) a = { street: a.street || vrij.street, houseNr: a.houseNr || vrij.houseNr, zipcode: a.zipcode || vrij.zipcode, city: a.city || vrij.city, bron: 'rp-adresveld' };
  }
  if (a.street || a.zipcode) {
    const b = await bagAdres(a);
    if (b) a = { ...b, bron: a.bron + '+bag' };
  }
  a.compleet = !!compleet(a);
  return a;
}

// Registreer + alarmeer relaties die ondanks de keten zonder volledig adres zijn
// aangemaakt (max 1 alarm per relatie).
async function adresOntbreektMelden(companyId, naam, offerteNrs) {
  let log = {}; try { log = JSON.parse(fs.readFileSync(ADRES_ONTBREEKT_LOG, 'utf8')); } catch {}
  if (log[companyId]) return;
  log[companyId] = { naam, offerteNrs, sinds: new Date().toISOString() };
  fs.writeFileSync(ADRES_ONTBREEKT_LOG, JSON.stringify(log, null, 1));
  await sendTelegram('⚠️ Gripp-relatie aangemaakt ZONDER volledig adres: ' + naam + (offerteNrs && offerteNrs.length ? ' (offerte ' + offerteNrs.join(', ') + ')' : '') + '. Adres stond niet in de lead. Graag opzoeken en invullen in Gripp; de nacontrole blijft er dagelijks aan herinneren tot het gevuld is.');
}

// Dagelijkse nacontrole: bestaan er door ons aangemaakte relaties (id >= 99206)
// zonder straat? Dan alarm met namen. Gevulde relaties verdwijnen uit het log.
async function adresNacontrole() {
  try {
    let first = 0; const kaal = []; const gevuld = [];
    while (true) {
      const [r] = await gripp([{ method: 'company.get', params: [[{ field: 'company.id', operator: 'greaterequals', value: 99206 }], { paging: { firstresult: first, maxresults: 250 } }], id: 1 }]);
      const rows = r?.result?.rows || [];
      for (const c of rows) {
        if (!(c.visitingaddress_street || '').trim()) kaal.push(c); else gevuld.push(c.id);
      }
      if (!r?.result?.more_items_in_collection) break;
      first += 250;
    }
    let log = {}; try { log = JSON.parse(fs.readFileSync(ADRES_ONTBREEKT_LOG, 'utf8')); } catch {}
    let changed = false;
    for (const id of gevuld) if (log[id]) { delete log[id]; changed = true; }
    const nieuw = kaal.filter((c) => !log[c.id]);
    for (const c of nieuw) { log[c.id] = { naam: (c.companyname || '').trim(), sinds: new Date().toISOString() }; changed = true; }
    if (changed) fs.writeFileSync(ADRES_ONTBREEKT_LOG, JSON.stringify(log, null, 1));
    if (kaal.length) {
      await sendTelegram('⚠️ Nacontrole: ' + kaal.length + ' Gripp-relatie(s) zonder adres: ' + kaal.map((c) => (c.companyname || '?').trim() + ' (' + c.id + ')').slice(0, 10).join(', ') + (kaal.length > 10 ? ' …' : '') + '. Graag aanvullen.');
    } else {
      console.log('Nacontrole adressen: alles gevuld.');
    }
  } catch (e) { console.log('Nacontrole adressen FOUT:', e.message?.substring(0, 80)); }
}

// ============ PRODUCT MAPPING ============

const PRODUCT_MAP = {
  'rolluik (rollsuper)': 76,
  'rolluik': 76,
  'rolluik roma': 319,
  'roma rolluik': 319,
  'zip design 110': 105,
  'zip design': 105,
  'suncontrol 165 zip': 291,
  'suncontrol 150': 290,
  'sunelite': 311,
  'sunproject 100': 211,
  'suncube xl': 164,
  'suncube 150': 164,
  'square 85/100': 185,
  'zipscreen roma': 322,
  'roma zipscreen': 322,
  'suneye voorraad scherm': 347,
  'suneye voorraadscherm': 347,
  'suneye': 145,
  'suneye xl': 150,
  'sunbasic cassette': 128,
  'sunbasic casette': 128,
  'sunbasic open cassette': 191,
  'sunbasic open casette': 191,
  'sunbasic': 191,
  'pergola 165 zip': 305,
  'pergola': 305,
  'markies': 161,
  'markies herbekleden': 131,
  'tahoma switch': 155,
  'tahoma': 155,
  'eolis 3d windsensor io': 62,
  'koker': 112,
  'kokers': 112,
  'sunteis': 336,
  'sunteis lux': 336,
  'sunteis lux meter': 336,
  'soliris io': 224,
  'somfy connectivity': 225,
  'noodstroomvoorziening': 130,
  'runner': 146,
  'volant': 234,
  'steiger': 160,
  'brede muursteunen': 75,
  'plafond steunen': 227,
  'speciale platen': 109,
  'uitvulprofielen': 177,
  'opbouwschakelaar': 100,
  'duo plisse': 197,
  'duoplisse': 197,
  'rolgordijn': 190,
  'houten jaloezie': 82,
  'aluminium jaloezie': 104,
  'plisse': 166,
  'plissé': 166,
  'vouwgordijn': 214,
  'gordijn': 212,
  'rainbow knikarmscherm': 315,
  'suncar cassette': 167,
};

function getMontageProductId(montageLine, bedieningType, units) {
  const ml = montageLine.toLowerCase();
  const bd = (bedieningType || '').toLowerCase();
  const isSolar = bd.includes('solar') || bd.includes('brel') || bd.includes('afstandsbediening');
  const isBedraad = bd.includes('draaischakelaar') || bd.includes('bedraad') || bd.includes('opbouwschakelaar');
  const isGekoppeld = ml.includes('gekoppeld');
  const veel = units >= 3;

  if (ml.includes('rolluik')) {
    if (isGekoppeld) return isSolar ? 258 : 257;
    if (isBedraad) return veel ? 254 : 77;
    return veel ? 256 : 255;
  }
  if (ml.includes('screen')) {
    if (isGekoppeld) return isSolar ? 270 : 269;
    if (isBedraad) return veel ? 266 : 265;
    return veel ? 268 : 267;
  }
  if (ml.includes('knikarm') && ml.includes('uitgebreid')) return 251;
  if (ml.includes('knikarm')) return 281;
  if (ml.includes('uitvalscherm')) return 264;
  if (ml.includes('pergola')) return 306;
  if (ml.includes('markies')) return 273;
  if (ml.includes('pliss')) return 282;
  if (ml.includes('jaloezie')) return 283;
  if (ml.includes('rolgordijn')) return 317;
  return 289;
}

function findGrippProductId(description) {
  const desc = description.toLowerCase().trim();
  for (const [key, id] of Object.entries(PRODUCT_MAP)) {
    if (desc.startsWith(key)) return id;
  }
  for (const [key, id] of Object.entries(PRODUCT_MAP)) {
    if (desc.includes(key)) return id;
  }
  return null;
}

// ============ MAIN ============

/**
 * Eigen offerte (uit /api/eigen-crm, RP-itemvorm) → dezelfde documentvorm als een RP-quotation, zodat de
 * bestaande Gripp-lus (regels, korting, hoofdproduct, montage) ongewijzigd draait. Puur; getest in scenario-lab/onderdelen/gripp-eigen.js.
 *  - offerte-tool: toolLines (description/pricePerUnit/units) zijn de bron
 *  - configurator: regels (omschrijving + beschrijving/details, subtotaal, aantal); negatieve kortingregels eruit, korting apart
 */
function eigenDocs(item) {
  const o = item.offerte || {};
  let lines = [];
  if (Array.isArray(o.toolLines) && o.toolLines.length) {
    lines = o.toolLines.filter((l) => l && l.description).map((l) => ({ description: String(l.description), pricePerUnit: Number(l.pricePerUnit || 0), units: Number(l.units || 1) }));
  } else if (Array.isArray(o.regels)) {
    lines = o.regels.filter((r) => r && r.omschrijving && Number(r.subtotaal || 0) >= 0).map((r) => {
      const aantal = Math.max(1, Number(r.aantal || 1));
      const perStuk = r.prijsPerStuk != null ? Number(r.prijsPerStuk) : Math.round((Number(r.subtotaal || 0) / aantal) * 100) / 100;
      // alleen de specificaties: het 'Waarom'-/garantieblok van de klantofferte hoort niet in Gripp
      const spec = String(r.beschrijving || r.details || '').split(/\n\s*\*{0,2}(?:waarom|garantie)/i)[0].replace(/ \| /g, '\n').replace(/ · /g, '\n').trim();
      return { description: String(r.omschrijving).replace(/^\d+× /, '') + (spec ? '\n' + spec : ''), pricePerUnit: perStuk, units: aantal };
    });
  }
  const k = o.korting && Number(o.korting.pct) > 0 ? { type: 'PERCENTAGE', amount: Number(o.korting.pct), name: o.korting.naam || (o.korting.pct + '% korting') } : null;
  const nummer = (o.nummers || [])[0] || item.id;
  const ts = o.datums && o.datums[0] ? Date.parse(o.datums[0]) : Date.now();
  return [{
    info: { quotationNumber: nummer, quotationCreationTimestamp: ts, documentId: item.id },
    full: { quotationData: { quotationStatus: o.status || 'SENT', segments: { defaultTemplatePriceLineGroup: { data: { lines, groupDiscount: k } } } } },
    status: o.status || 'SENT', eigen: true,
  }];
}

async function main() {
  console.log('[' + new Date().toISOString().substring(11, 19) + '] Gripp invullen v2 start');

  // limit=200: zonder limiet geeft RP een standaardpagina en vallen verse items er soms
  // buiten (testlead 2026-08-05 werd zo overgeslagen: 'items: 2, nieuw: 0').
  // API-ZUINIG ÉN COMPLEET (09-08). Het probleem was ?limit=200: dat dekt maar een
  // paar dagen van een backlog met 18.752 items, waardoor Q Tacken (25-07) en Wilte
  // Zijlstra (16-07) met een GETEKENDE offerte weken bleven liggen. De hele database
  // ophalen is geen optie (19 calls per ronde = RP-gezeur, Daimy 09-08). Daarom:
  //  1. één pagina van 1000 (nieuwste eerst = ruwweg de laatste twee weken);
  //  2. blijvers die daarbuiten vallen volgen we gericht op id (1 call per stuk),
  //     bijgehouden in data/gripp-invullen-volglijst.json.
  // Kosten in de praktijk: 1 tot 3 calls per ronde.
  const VOLGLIJST = path.join(__dirname, '..', 'data', 'gripp-invullen-volglijst.json');
  const laadVolglijst = () => { try { return JSON.parse(fs.readFileSync(VOLGLIJST, 'utf8')); } catch { return []; } };
  const eersteBlad = await rpGet('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items?limit=1000');
  const gezien = eersteBlad?.items || [];
  const gezienIds = new Set(gezien.map((i) => i.id));
  const extra = [];
  for (const id of laadVolglijst()) {
    if (gezienIds.has(id)) continue;
    try {
      const los = await rpGet('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items/' + id);
      const item = los?.item || los;
      if (item?.id) extra.push(item);
    } catch { /* verwijderd item: valt vanzelf van de volglijst */ }
  }
  // Eigen CRM-leads op "Gripp invullen" (blok 3 RP-uitzetten): zelfde itemvorm, offerte zit al in het item
  const eigenItems = [];
  try {
    const E = require('./lib/eigen-crm.js');
    if (E.bronAan()) { const d = await E.haalKolom(GRIP_INVULLEN_STATUS); for (const it of d) if (!gezien.some((x) => x.id === it.id)) eigenItems.push(it); }
    if (eigenItems.length) console.log('Eigen CRM-leads op Gripp invullen:', eigenItems.length);
  } catch (e) { console.log('eigen CRM niet bereikbaar: ' + e.message); }
  const itemsData = { items: [...gezien, ...extra, ...eigenItems] };
  // --item=<rp-id>: verwerk gericht één item, ook als het in RP gearchiveerd is
  // (testlead 2026-08-05 stond gearchiveerd en werd daardoor stil overgeslagen).
  const ITEM_FILTER = (process.argv.find(a => a.startsWith('--item=')) || '').split('=')[1] || null;
  const items = (itemsData?.items || []).filter(i =>
    i.status_id === GRIP_INVULLEN_STATUS &&
    (ITEM_FILTER ? i.id === ITEM_FILTER : !i.technical_labels?.some(l => l.type === 'ITEM_ARCHIVED'))
  );

  // volglijst bijwerken: wie nu op deze status staat blijven we volgen, ook als hij
  // straks uit het venster van 1000 zakt
  try { fs.writeFileSync(VOLGLIJST, JSON.stringify(items.map((i) => i.id))); } catch { /* volglijst is een hulpmiddel */ }

  const sentLog = getSentLog();
  // Dedup op uniek RP backlog-item-id ('item:<id>'), niet op klantnaam: een tweede
  // order van dezelfde klant (nieuw item, zelfde naam) werd vroeger stil overgeslagen.
  // Migratie: oude markers zijn op naam gekeyd — die blijven geldig (naam-key OF id-key
  // = al gedaan), zodat historische items niet opnieuw verwerkt worden.
  const toProcess = items.filter(i => !sentLog[i.summary] && !sentLog['item:' + i.id]);

  // ZELFHERSTEL (09-08): een item dat hier staat maar al een Gripp-offerte heeft, wordt
  // door de dedup overgeslagen en blijft dus eeuwig op "grip invullen" hangen. Dat
  // gebeurde bij Rene Blauw (opnieuw geboekt ná zijn Gripp-run, waardoor de status
  // terugkwam), Q Tacken (25-07) en Wilte Zijlstra (21-07). De offerte bestaat al,
  // dus alleen de status moet nog door — dat doen we hier alsnog.
  for (const i of items) {
    const marker = sentLog['item:' + i.id] || sentLog[i.summary];
    if (!marker?.grippOfferId) continue;
    const ok = await setStatus(i.id, AFGEROND_STATUS);
    console.log(`  ZELFHERSTEL ${i.summary}: Gripp ${marker.grippOfferId} bestond al → status Afgerond: ${ok ? 'OK' : 'FAIL'}`);
  }

  console.log('Gripp invullen items:', items.length, '| Nieuw:', toProcess.length);
  // BLIJVERS MELDEN (09-08): items die hier al weken staan komen nergens terug —
  // meestal wacht de klant op iets (offerte tekenen). Stilte is hier het gevaar.
  const blijvers = items.filter((i) => Date.now() - Number(i.timestamp_created || Date.now()) > 7 * 86400000);
  if (blijvers.length) {
    const regels = blijvers.map((i) => `- ${i.summary} (sinds ${new Date(Number(i.timestamp_created)).toLocaleDateString('nl-NL')})`).join('\n');
    console.log('LET OP, staan hier al >7 dagen:\n' + regels);
    try {
      await require('./lib/telegram-planning.js').planningTelegram(
        `${blijvers.length} klant(en) staan al langer dan een week op "Gripp invullen" en komen niet verder:\n${regels}\n\nMeestal wacht dit op een getekende offerte. Even nabellen of doorzetten?`
      );
    } catch { /* melding is extra */ }
  }
  if (toProcess.length === 0) { console.log('Niets te doen'); return; }

  let processed = 0, failed = 0;

  for (const item of toProcess) {
    try {
      console.log('\n--- ' + item.summary + ' ---');
      const desc = item.description || '';
      const opmerking = desc.match(/Opmerking:\s*([\s\S]*?)(?=\n\d+x |\n*$)/i)?.[1]?.trim() || '';

      let firstName = desc.match(/Voornaam:\s*([^\n]+)/i)?.[1]?.trim() || item.summary.split(' ')[0];
      let lastName = desc.match(/Achternaam:\s*([^\n]+)/i)?.[1]?.trim() || item.summary.split(' ').slice(1).join(' ');
      // Eén-woord-namen ("Droog", "Caron"): Gripp EIST lastname — gebruik dan de hele naam
      // als achternaam en laat de voornaam leeg (4x mislukt op 21 juli).
      if (!lastName) { lastName = firstName; firstName = ''; }
      const email = item.fields?.email || desc.match(/E-mailadres:\s*([^\n]+)/i)?.[1]?.trim() || '';
      const phone = item.fields?.phone || desc.match(/Telefoonnummer:\s*([^\n]+)/i)?.[1]?.trim() || '';
      // Adres via de keten (lead-velden → RP-adresveld → BAG); zie ADRES-KETEN hierboven.
      const adres = await adresBepalen(desc, item.fields);
      const street = adres.street, houseNr = adres.houseNr, zipcode = adres.zipcode, city = adres.city;
      if (!adres.compleet) console.log('  LET OP: adres incompleet na keten (bron ' + adres.bron + '):', JSON.stringify(adres));

      // Haal offerte op via lead_configuration_id
      const lcId = item.item_subject?.id;
      if (!lcId) { console.log('  SKIP: Geen lead_configuration_id'); failed++; continue; }

      // BELANGRIJK: kies de offerte die de klant heeft GEACCEPTEERD.
      // Status zit in de volledige quotation data, dus per doc ophalen.
      // Prioriteit: ACCEPTED (nieuwste) > SENT (nieuwste) > rest (nieuwste)
      const fullDocs = [];
      if (item.eigen) {
        // eigen CRM-lead: offerte zit in het item (blok 3 RP-uitzetten)
        fullDocs.push(...eigenDocs(item));
      } else {
        const docData = await rpGet('/document-service/v1/' + PID + '/quotations?lead_configuration_id=' + lcId);
        const docs = (docData?.quotationDatas || []);
        if (docs.length === 0) { console.log('  SKIP: Geen offerte gevonden'); failed++; continue; }
        for (const d of docs) {
          const fd = await rpGet('/document-service/v1/' + PID + '/quotations/' + d.documentId);
          if (fd?.quotationData) fullDocs.push({ info: d, full: fd, status: fd.quotationData.quotationStatus || '' });
        }
      }
      if (fullDocs.length === 0) { console.log('  SKIP: Geen quotation data'); failed++; continue; }
      const statusRank = { 'ACCEPTED': 0, 'SENT': 1 };
      fullDocs.sort((a, b) => {
        const ra = statusRank[a.status] ?? 2, rb = statusRank[b.status] ?? 2;
        if (ra !== rb) return ra - rb;
        return (b.info.quotationCreationTimestamp || 0) - (a.info.quotationCreationTimestamp || 0);
      });
      // ALLE ondertekende (ACCEPTED) offertes verwerken — klant kan er meerdere hebben
      // Geen ACCEPTED? Dan alleen de beste (nieuwste SENT of nieuwste andere)
      const acceptedDocs = fullDocs.filter(d => d.status === 'ACCEPTED');
      // KANTOOR-KEUZE (09-08): staat er in data/offerte-keuze-override.json een
      // offertenummer voor deze klant, dan geldt die versie. Het kantoor wéét soms
      // welke offerte de klant heeft goedgekeurd (Daimy over Vas Verhage: "zet
      // 202610307 erin"), en dan hoeft niemand op een handtekening te wachten.
      let override = null;
      try {
        const o = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'offerte-keuze-override.json'), 'utf8'));
        override = o[item.id] || o[item.item_subject?.id] || null;
      } catch { /* geen overrides ingesteld */ }
      // De keuze mag één nummer zijn of een LIJST: een klant kan twee offertes willen
      // (Daimy 09-08 over B Damsteeg: "daar moeten beide offertes in Gripp"). Dan
      // maken we ze allebei aan, net als bij meerdere ondertekende offertes.
      const gewenst = Array.isArray(override) ? override : (override ? [override] : []);
      const gekozenDocs = gewenst
        .map((nr) => fullDocs.find(d => String(d.info?.quotationNumber) === String(nr) || d.documentId === nr || String(d.rpDocNumber) === String(nr)))
        .filter(Boolean);
      const nietGevonden = gewenst.filter((nr) => !fullDocs.some(d => String(d.info?.quotationNumber) === String(nr) || d.documentId === nr || String(d.rpDocNumber) === String(nr)));
      if (nietGevonden.length) console.log(`  LET OP: ${nietGevonden.join(', ')} hoort niet bij deze klant — genegeerd`);
      const gekozenDoc = gekozenDocs[0] || null;
      if (gekozenDocs.length) {
        console.log(`  Offerteversie(s) door kantoor gekozen: ${gekozenDocs.map(d => d.info?.quotationNumber || d.rpDocNumber).join(' + ')}`);
        fullDocs.length = 0;
        fullDocs.push(...gekozenDocs);
      }
      // Meerdere versies zonder één getekende: NIET gokken welke geldt — de klant
      // moet er zelf één tekenen (Daimy 05-08, geval Wilco Vendrig: SENT 11k naast
      // ACCEPTED 27,5k met dezelfde timestamp).
      if (!gekozenDoc && acceptedDocs.length === 0 && fullDocs.length > 1) {
        console.log('  SKIP: ' + fullDocs.length + ' offerteversies, geen enkele getekend — klant moet eerst tekenen');
        // 1x melden per item, niet bij elke run opnieuw (7 runs/dag = 7 dezelfde
        // meldingen; onderdeel van de meldingen-regen 06-08).
        const SKIP_GEMELD = path.join(__dirname, '..', 'data', 'gripp-skip-gemeld.json');
        let skips = {};
        try { skips = JSON.parse(fs.readFileSync(SKIP_GEMELD, 'utf8')); } catch {}
        if (!skips['item:' + item.id]) {
          skips['item:' + item.id] = new Date().toISOString();
          fs.writeFileSync(SKIP_GEMELD, JSON.stringify(skips, null, 1));
          await sendTelegram('⚠️ Gripp-invullen overgeslagen: "' + (item.summary || '?') + '" heeft ' + fullDocs.length + ' offerteversies in RP en geen enkele is getekend. Klant moet er één tekenen (of kantoor kiest). Dit meld ik één keer; hij wordt vanzelf verwerkt zodra er een versie getekend is.');
        }
        failed++;
        continue;
      }
      // Kiest het kantoor expliciet één of meer versies, dan gaan die ALLEMAAL door
      // (Damsteeg 09-08 wil beide offertes). Anders: alle getekende, of anders de beste.
      const docsToProcess = gekozenDocs.length ? gekozenDocs
        : (acceptedDocs.length > 0 ? acceptedDocs : [fullDocs[0]]);
      console.log('  Te verwerken: ' + docsToProcess.map(d => '#' + d.info.quotationNumber + ' [' + d.status + ']').join(', ') + ' (van ' + fullDocs.length + ' versies)');

      // Bediening type uit lead description
      const bedieningMatch = desc.match(/welk_type_bediening_wil_je\?:\s*([^\n]+)/i);
      const bedieningType = bedieningMatch?.[1]?.trim() || '';

      // Maak Gripp relatie 1x aan
      const bedrijfsVelden = {
            companyname: item.summary,
            firstname: firstName,
            lastname: lastName,
            email: email,
            phone: phone,
            mobile: phone,
            visitingaddress_street: street,
            visitingaddress_streetnumber: houseNr,
            visitingaddress_zipcode: zipcode,
            visitingaddress_city: city,
            visitingaddress_country: 'Nederland',
            relationtype: { id: 2 },
            // Nieuwe relaties expliciet op actief zetten (Daimy 2026-08-03). Gripp-veld
            // geverifieerd op een bestaande relatie: 'active' is een boolean.
            active: true,
      };
      const [createComp] = await gripp([{ method: 'company.create', params: { fields: bedrijfsVelden }, id: 1 }]);
      let companyId = createComp?.result?.recordid;
      if (!companyId) {
        // Vangnet: mocht Gripp het veld 'active' bij company.create niet accepteren, dan mag
        // dat nooit de hele relatie-aanmaak blokkeren. Eén keer opnieuw zonder dat veld.
        const zonderActive = { ...bedrijfsVelden };
        delete zonderActive.active;
        const [retry] = await gripp([{ method: 'company.create', params: { fields: zonderActive }, id: 1 }]);
        companyId = retry?.result?.recordid;
        if (companyId) console.log('  LET OP: relatie aangemaakt ZONDER active-vlag; Gripp weigerde dat veld');
      }
      if (!companyId) {
        console.log('  ERROR: Company aanmaken mislukt:', JSON.stringify(createComp?.error)?.substring(0, 80));
        failed++;
        continue;
      }

      // Per ondertekende offerte een Gripp offerte aanmaken
      const createdOffers = [];
      let anyFailed = false;
      for (const docEntry of docsToProcess) {
        const docInfo = docEntry.info;
        const plg = docEntry.full.quotationData.segments?.defaultTemplatePriceLineGroup;
        if (!plg?.data?.lines?.length) { console.log('  SKIP #' + docInfo.quotationNumber + ': geen productregels'); continue; }

        const lines = plg.data.lines;
        const groupDiscount = plg.data.groupDiscount;
        const discountPct = groupDiscount?.type === 'PERCENTAGE' ? (groupDiscount.amount || 0) : 0;
        // ABSOLUTE korting (vast bedrag incl. btw) bestaat ook — zonder deze regel viel
        // die stilletjes weg en stond de Gripp-offerte te hoog (Wilco: 33.666 i.p.v. 27.500).
        const discountAbs = groupDiscount?.type === 'ABSOLUTE' ? (groupDiscount.amount || 0) : 0;
        const discountName = groupDiscount?.name || '';

        // Bouw Gripp offerteregels (volle prijs, korting apart zichtbaar)
        const offerlines = [];
        let ordering = 1;
        for (const line of lines) {
          const lineDesc = line.description?.split('\n')[0]?.replace(/^\*\*|\*\*$/g, '') || '';
          const fullDesc = zonderOptiesBlok(line.description);
          const priceExcl = line.pricePerUnit / 1.21;

          if ((line.pricePerUnit === 0 || line.units === 0) && lineDesc.length > 3) {
            offerlines.push({
              _ordering: ordering++, product: 345, amount: 1, sellingprice: 0, discount: 0, buyingprice: 0,
              invoicebasis: 1, vat: 27, unit: 3, convertto: 1, rowtype: 1,
              description: alsGrippHtml(fullDesc.replace(/^\*\*|\*\*$/gm, '').trim()),
            });
            continue;
          }

          const isMontage = lineDesc.toLowerCase().includes('montage') || lineDesc.toLowerCase().includes('inmeten');
          let productId = isMontage ? getMontageProductId(lineDesc, bedieningType, line.units) : findGrippProductId(lineDesc);
          if (!productId) { console.log('  WARN: Product niet gevonden: ' + lineDesc); productId = 345; }

          const specLines = fullDesc.split('\n').slice(1).filter(l => l.trim()).map(l => l.trim().replace(/^\*\*|\*\*$/g, '')).join('\n');
          offerlines.push({
            _ordering: ordering++, product: productId, amount: line.units,
            sellingprice: parseFloat(priceExcl.toFixed(2)), discount: 0, buyingprice: 0,
            invoicebasis: 1, vat: 27, unit: 3, convertto: 1, rowtype: 1,
            description: alsGrippHtml(specLines || lineDesc),
          });
        }
        if (offerlines.length === 0) { console.log('  SKIP #' + docInfo.quotationNumber + ': geen regels'); continue; }

        // Korting als aparte zichtbare regel onderaan (product 103 "Korting")
        if (discountAbs > 0) {
          offerlines.push({
            _ordering: ordering++, product: 103, amount: 1,
            sellingprice: parseFloat((-(discountAbs / 1.21)).toFixed(2)), discount: 0, buyingprice: 0,
            invoicebasis: 1, vat: 27, unit: 3, convertto: 1, rowtype: 1,
            description: discountName || ('Korting €' + discountAbs.toFixed(2)),
          });
        }
        if (discountPct > 0) {
          const totalExcl = lines.reduce((s, l) => s + l.units * l.pricePerUnit, 0) / 1.21;
          offerlines.push({
            _ordering: ordering++, product: 103, amount: 1,
            sellingprice: parseFloat((-(totalExcl * discountPct / 100)).toFixed(2)), discount: 0, buyingprice: 0,
            invoicebasis: 1, vat: 27, unit: 3, convertto: 1, rowtype: 1,
            description: discountName || (discountPct + '% korting'),
          });
        }

        const beschrijving = [(docEntry.eigen ? 'Eigen offerte ' : 'Overgenomen uit Reuzenpanda #') + docInfo.quotationNumber];
        // Markering in het opmerkingenveld van de Gripp-offerte (Daimy 2026-08-17): puur
        // op RP-aanmaakdatum. Bij aanmaak liggen de prijzen vast, dus aangemaakt ná het
        // verhogingsmoment = nieuwe prijzen, ervoor = oude (ook als de klant later tekent).
        // De eerdere narekening tegen de prijsmotor kende toeslagen (RAL-kleur), voorraad
        // en Roma niet en hield daardoor bij 13 nieuwe-prijs-offertes de markering ten
        // onrechte in (gemeten 2026-08-17 over alle Gripp-offertes sinds 3 aug).
        if ((docInfo.quotationCreationTimestamp || 0) >= PRIJZEN_VERHOOGD_OP) beschrijving.push('prijs actueel 2026');
        if (opmerking) beschrijving.push('\n--- Opmerking klant ---\n' + opmerking);

        const mainProduct = [...lines]
          .filter(l => l.pricePerUnit > 0 && l.units > 0 && !l.description?.toLowerCase().includes('montage') && !l.description?.toLowerCase().includes('inmeten') && !l.description?.toLowerCase().includes('tahoma'))
          .sort((a, b) => (b.units * b.pricePerUnit) - (a.units * a.pricePerUnit))[0]
          ?.description?.split('\n')[0]?.replace(/^\*\*|\*\*$/g, '') || 'Offerte';

        const [createOffer] = await gripp([{
          method: 'offer.create',
          params: {
            fields: {
              name: 'Offerte ' + mainProduct + ' - ' + item.summary,
              company: companyId,
              description: beschrijving.join('\n'),
              offerlines: offerlines,
              filesavailableforclient: true,
              signingenabled: true,
            }
          },
          id: 2,
        }]);
        const offerId = createOffer?.result?.recordid;
        if (!offerId) {
          console.log('  ERROR: Offerte #' + docInfo.quotationNumber + ' aanmaken mislukt:', JSON.stringify(createOffer?.error)?.substring(0, 80));
          anyFailed = true;
          continue;
        }
        console.log('  Gripp offerte ' + offerId + ' ← RP #' + docInfo.quotationNumber);
        createdOffers.push({ grippOfferId: offerId, rpDocNumber: docInfo.quotationNumber });

        // Rate limit voorkomen bij meerdere offertes
        await new Promise(r => setTimeout(r, 3000));
      }

      if (createdOffers.length === 0) {
        console.log('  ERROR: geen enkele offerte aangemaakt');
        failed++;
        continue;
      }
      if (anyFailed) {
        // Deels gelukt: NIET markeren als klaar, zodat de mislukte bij volgende run alsnog kan
        console.log('  WAARSCHUWING: deels mislukt — item blijft staan voor volgende run');
        failed++;
        continue;
      }

      console.log('  Gripp: Company ' + companyId + ' + ' + createdOffers.length + ' offerte(s)');

      if (!adres.compleet) {
        await adresOntbreektMelden(companyId, item.summary, createdOffers.map((o) => o.grippOfferId));
      }

      // Status naar Afgerond via API
      const statusOk = await setStatus(item.id, AFGEROND_STATUS);
      console.log('  RP status → Afgerond:', statusOk ? 'OK' : 'FAIL');

      // Nieuwe key: uniek item-id (naam als info in de data, niet meer als key)
      markSent('item:' + item.id, {
        summary: item.summary,
        grippCompanyId: companyId,
        grippOfferId: createdOffers[0].grippOfferId,
        rpDocNumber: createdOffers[0].rpDocNumber,
        allOffers: createdOffers,
      });

      processed++;
      console.log('  DONE');

    } catch (e) {
      console.log('  ERROR:', e.message?.substring(0, 120));
      failed++;
    }
  }

  await adresNacontrole();

  console.log('\n=== SAMENVATTING ===');
  console.log('Verwerkt:', processed, '| Mislukt:', failed);

  if (processed > 0 || failed > 0) {
    await sendTelegram('Gripp invullen: ' + processed + ' offerte(s) verwerkt' + (failed > 0 ? ', ' + failed + ' mislukt' : ''));
  }
}

module.exports = { eigenDocs, parseVrijAdres, bagAdres, adresBepalen, adresNacontrole };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });

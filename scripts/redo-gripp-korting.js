#!/usr/bin/env node
// Eenmalig: alle Gripp offertes van vandaag opnieuw met ZICHTBARE kortingsregel
// - Regels op volle prijs (geen per-regel korting)
// - Korting als aparte regel onderaan (product 103, zoals personeel doet)
// - Alleen ACCEPTED (ondertekende) RP offerte gebruiken

const fs = require('fs');
const path = require('path');

const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const GRIPP_KEY = 'WZvM6r0bAGGONGRhrkWTxVrydXq9H2';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BACKLOG_ID = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const SENT_LOG = path.join(__dirname, '.gripp-invullen-sent.json');

const PRODUCT_MAP = {
  'rolluik (rollsuper)': 76, 'rolluik': 76, 'rolluik roma': 319, 'roma rolluik': 319,
  'zip design 110': 105, 'zip design': 105, 'suncontrol 165 zip': 291, 'suncontrol 150': 290,
  'sunelite': 311, 'sunproject 100': 211, 'suncube xl': 164, 'suncube 150': 164,
  'square 85/100': 185, 'zipscreen roma': 322, 'roma zipscreen': 322,
  'suneye voorraad scherm': 347, 'suneye voorraadscherm': 347, 'suneye': 145, 'suneye xl': 150,
  'sunbasic cassette': 128, 'sunbasic casette': 128, 'sunbasic open cassette': 191,
  'sunbasic open casette': 191, 'sunbasic': 191, 'pergola 165 zip': 305, 'pergola': 305,
  'markies': 161, 'markies herbekleden': 131, 'tahoma switch': 155, 'tahoma': 155,
  'eolis 3d windsensor io': 62, 'koker': 112, 'kokers': 112, 'sunteis': 336,
  'soliris io': 224, 'somfy connectivity': 225, 'noodstroomvoorziening': 130,
  'runner': 146, 'volant': 234, 'steiger': 160, 'brede muursteunen': 75,
  'plafond steunen': 227, 'speciale platen': 109, 'uitvulprofielen': 177,
  'opbouwschakelaar': 100, 'duo plisse': 197, 'duoplisse': 197, 'rolgordijn': 190,
  'houten jaloezie': 82, 'aluminium jaloezie': 104, 'plisse': 166, 'plissé': 166,
  'vouwgordijn': 214, 'gordijn': 212, 'rainbow knikarmscherm': 315, 'suncar cassette': 167,
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
  for (const [key, id] of Object.entries(PRODUCT_MAP)) { if (desc.startsWith(key)) return id; }
  for (const [key, id] of Object.entries(PRODUCT_MAP)) { if (desc.includes(key)) return id; }
  return null;
}

async function rpGet(ep) {
  const res = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: { 'Authorization': 'Bearer ' + RP_API_KEY } });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

async function gripp(calls) {
  const res = await fetch('https://api.gripp.com/public/api3.php', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + GRIPP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(calls)
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return [{ error: text.substring(0, 300) }]; }
}

async function main() {
  const sentLog = JSON.parse(fs.readFileSync(SENT_LOG, 'utf8'));
  const today = Object.entries(sentLog).filter(([k, v]) => v.processedAt?.startsWith('2026-06-10') || v.redoneAt?.startsWith('2026-06-10'));
  console.log('Opnieuw met kortingsregel: ' + today.length + ' offertes\n');

  const itemsData = await rpGet('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items');

  for (const [name, old] of today) {
    console.log('--- ' + name + ' (Gripp offerte ' + old.grippOfferId + ') ---');
    const item = (itemsData?.items || []).find(i => i.summary === name);
    if (!item) { console.log('  SKIP: item niet gevonden'); continue; }
    const lcId = item.item_subject?.id;
    const desc = item.description || '';
    const opmerking = desc.match(/Opmerking:\s*([\s\S]*?)(?=\n\d+x |\n*$)/i)?.[1]?.trim() || '';
    const bedieningType = desc.match(/welk_type_bediening_wil_je\?:\s*([^\n]+)/i)?.[1]?.trim() || '';

    // ACCEPTED (nieuwste) > SENT > rest
    const docData = await rpGet('/document-service/v1/' + PID + '/quotations?lead_configuration_id=' + lcId);
    const docs = docData?.quotationDatas || [];
    const fullDocs = [];
    for (const d of docs) {
      const fd = await rpGet('/document-service/v1/' + PID + '/quotations/' + d.documentId);
      if (fd?.quotationData) fullDocs.push({ info: d, full: fd, status: fd.quotationData.quotationStatus || '' });
    }
    const statusRank = { 'ACCEPTED': 0, 'SENT': 1 };
    fullDocs.sort((a, b) => {
      const ra = statusRank[a.status] ?? 2, rb = statusRank[b.status] ?? 2;
      if (ra !== rb) return ra - rb;
      return (b.info.quotationCreationTimestamp || 0) - (a.info.quotationCreationTimestamp || 0);
    });
    if (fullDocs.length === 0) { console.log('  SKIP: geen docs'); continue; }
    const chosen = fullDocs[0];

    const plg = chosen.full.quotationData.segments?.defaultTemplatePriceLineGroup;
    const lines = plg?.data?.lines || [];
    const discountPct = plg?.data?.groupDiscount?.type === 'PERCENTAGE' ? (plg.data.groupDiscount.amount || 0) : 0;
    const discountName = plg?.data?.groupDiscount?.name || '';

    if (discountPct === 0) { console.log('  SKIP: geen groepskorting (al goed)'); continue; }

    console.log('  Doc: #' + chosen.info.quotationNumber + ' [' + chosen.status + '] korting: ' + discountPct + '% (' + discountName + ')');

    // Bouw regels op VOLLE prijs + kortingsregel onderaan
    const offerlines = [];
    let ordering = 1;
    for (const line of lines) {
      const lineDesc = line.description?.split('\n')[0]?.replace(/^\*\*|\*\*$/g, '') || '';
      const fullDesc = line.description || '';
      const priceExcl = line.pricePerUnit / 1.21;
      if ((line.pricePerUnit === 0 || line.units === 0) && lineDesc.length > 3) {
        offerlines.push({ _ordering: ordering++, product: 345, amount: 1, sellingprice: 0, discount: 0, buyingprice: 0, invoicebasis: 1, vat: 27, unit: 3, convertto: 1, rowtype: 1, description: fullDesc.replace(/^\*\*|\*\*$/gm, '').trim() });
        continue;
      }
      const isMontage = lineDesc.toLowerCase().includes('montage') || lineDesc.toLowerCase().includes('inmeten');
      let productId = isMontage ? getMontageProductId(lineDesc, bedieningType, line.units) : findGrippProductId(lineDesc);
      if (!productId) { console.log('  WARN: ' + lineDesc); productId = 345; }
      const specLines = fullDesc.split('\n').slice(1).filter(l => l.trim()).map(l => l.trim().replace(/^\*\*|\*\*$/g, '')).join('\n');
      offerlines.push({ _ordering: ordering++, product: productId, amount: line.units, sellingprice: parseFloat(priceExcl.toFixed(2)), discount: 0, buyingprice: 0, invoicebasis: 1, vat: 27, unit: 3, convertto: 1, rowtype: 1, description: specLines || lineDesc });
    }

    // Kortingsregel
    const totalExcl = lines.reduce((s, l) => s + l.units * l.pricePerUnit, 0) / 1.21;
    const kortingBedrag = -(totalExcl * discountPct / 100);
    offerlines.push({ _ordering: ordering++, product: 103, amount: 1, sellingprice: parseFloat(kortingBedrag.toFixed(2)), discount: 0, buyingprice: 0, invoicebasis: 1, vat: 27, unit: 3, convertto: 1, rowtype: 1, description: discountName || (discountPct + '% korting') });

    // Verwijder oude offerte
    const [del] = await gripp([{ method: 'offer.delete', params: { id: old.grippOfferId }, id: 1 }]);
    console.log('  Oude offerte verwijderd');

    // Nieuwe offerte op bestaande relatie
    const mainProduct = [...lines]
      .filter(l => l.pricePerUnit > 0 && l.units > 0 && !l.description?.toLowerCase().includes('montage') && !l.description?.toLowerCase().includes('inmeten') && !l.description?.toLowerCase().includes('tahoma'))
      .sort((a, b) => (b.units * b.pricePerUnit) - (a.units * a.pricePerUnit))[0]
      ?.description?.split('\n')[0]?.replace(/^\*\*|\*\*$/g, '') || 'Offerte';
    const beschrijving = ['Overgenomen uit Reuzenpanda #' + chosen.info.quotationNumber];
    if (opmerking) beschrijving.push('\n--- Opmerking klant ---\n' + opmerking);

    const [createOffer] = await gripp([{
      method: 'offer.create',
      params: { fields: { name: 'Offerte ' + mainProduct + ' - ' + name, company: old.grippCompanyId, description: beschrijving.join('\n'), offerlines } },
      id: 2,
    }]);
    const offerId = createOffer?.result?.recordid;
    if (!offerId) { console.log('  ERROR: ' + JSON.stringify(createOffer?.error)?.substring(0, 100)); continue; }
    const totalNa = (lines.reduce((s, l) => s + l.units * l.pricePerUnit, 0)) * (1 - discountPct / 100);
    console.log('  Nieuwe offerte ' + offerId + ' — totaal €' + totalNa.toFixed(2) + ' incl (korting -€' + Math.abs(kortingBedrag * 1.21).toFixed(2) + ' incl zichtbaar)');

    sentLog[name] = { ...old, grippOfferId: offerId, rpDocNumber: chosen.info.quotationNumber, kortingRegelAt: new Date().toISOString() };
    fs.writeFileSync(SENT_LOG, JSON.stringify(sentLog, null, 2));
  }

  console.log('\nKlaar');
}

main().catch(console.error);

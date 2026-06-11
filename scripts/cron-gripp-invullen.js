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
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const SENT_LOG = path.join(__dirname, '.gripp-invullen-sent.json');

function getSentLog() { try { return JSON.parse(fs.readFileSync(SENT_LOG, 'utf8')); } catch { return {}; } }
function markSent(name, data) {
  const log = getSentLog();
  log[name] = { ...data, processedAt: new Date().toISOString() };
  fs.writeFileSync(SENT_LOG, JSON.stringify(log, null, 2));
}

// ============ API HELPERS ============

async function rpGet(ep) {
  const res = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: { 'Authorization': 'Bearer ' + RP_API_KEY } });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

async function rpPatch(ep, body) {
  const res = await fetch('https://backend.reuzenpanda.nl' + ep, {
    method: 'PATCH', headers: { 'Authorization': 'Bearer ' + RP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function setStatus(itemId, statusId) {
  return rpPatch('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items/' + itemId, { item: { status_id: statusId } });
}

async function gripp(calls) {
  const res = await fetch('https://api.gripp.com/public/api3.php', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + GRIPP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(calls)
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return [{ error: text.substring(0, 300) }]; }
}

async function sendTelegram(text) {
  await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: 1700128390, text: text.substring(0, 4000) }),
  }).catch(() => {});
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

async function main() {
  console.log('[' + new Date().toISOString().substring(11, 19) + '] Gripp invullen v2 start');

  const ninetyDaysAgo = Date.now() - 90 * 86400000;
  const itemsData = await rpGet('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items');
  const items = (itemsData?.items || []).filter(i =>
    i.status_id === GRIP_INVULLEN_STATUS &&
    !i.technical_labels?.some(l => l.type === 'ITEM_ARCHIVED') &&
    i.timestamp_created > ninetyDaysAgo
  );

  const sentLog = getSentLog();
  const toProcess = items.filter(i => !sentLog[i.summary]);

  console.log('Gripp invullen items:', items.length, '| Nieuw:', toProcess.length);
  if (toProcess.length === 0) { console.log('Niets te doen'); return; }

  let processed = 0, failed = 0;

  for (const item of toProcess) {
    try {
      console.log('\n--- ' + item.summary + ' ---');
      const desc = item.description || '';
      const opmerking = desc.match(/Opmerking:\s*([\s\S]*?)(?=\n\d+x |\n*$)/i)?.[1]?.trim() || '';

      const firstName = desc.match(/Voornaam:\s*([^\n]+)/i)?.[1]?.trim() || item.summary.split(' ')[0];
      const lastName = desc.match(/Achternaam:\s*([^\n]+)/i)?.[1]?.trim() || item.summary.split(' ').slice(1).join(' ');
      const email = item.fields?.email || desc.match(/E-mailadres:\s*([^\n]+)/i)?.[1]?.trim() || '';
      const phone = item.fields?.phone || desc.match(/Telefoonnummer:\s*([^\n]+)/i)?.[1]?.trim() || '';
      const street = desc.match(/Straatnaam:\s*([^\n]+)/i)?.[1]?.trim() || '';
      const houseNr = desc.match(/Huisnummer:\s*([^\n]+)/i)?.[1]?.trim() || '';
      const zipcode = desc.match(/Postcode:\s*([^\n]+)/i)?.[1]?.trim() || '';
      const city = desc.match(/Plaats:\s*([^\n]+)/i)?.[1]?.trim() || '';

      // Haal offerte op via lead_configuration_id
      const lcId = item.item_subject?.id;
      if (!lcId) { console.log('  SKIP: Geen lead_configuration_id'); failed++; continue; }

      const docData = await rpGet('/document-service/v1/' + PID + '/quotations?lead_configuration_id=' + lcId);
      const docs = (docData?.quotationDatas || []);
      if (docs.length === 0) { console.log('  SKIP: Geen offerte gevonden'); failed++; continue; }

      // BELANGRIJK: kies de offerte die de klant heeft GEACCEPTEERD.
      // Status zit in de volledige quotation data, dus per doc ophalen.
      // Prioriteit: ACCEPTED (nieuwste) > SENT (nieuwste) > rest (nieuwste)
      const fullDocs = [];
      for (const d of docs) {
        const fd = await rpGet('/document-service/v1/' + PID + '/quotations/' + d.documentId);
        if (fd?.quotationData) fullDocs.push({ info: d, full: fd, status: fd.quotationData.quotationStatus || '' });
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
      const docsToProcess = acceptedDocs.length > 0 ? acceptedDocs : [fullDocs[0]];
      console.log('  Te verwerken: ' + docsToProcess.map(d => '#' + d.info.quotationNumber + ' [' + d.status + ']').join(', ') + ' (van ' + fullDocs.length + ' versies)');

      // Bediening type uit lead description
      const bedieningMatch = desc.match(/welk_type_bediening_wil_je\?:\s*([^\n]+)/i);
      const bedieningType = bedieningMatch?.[1]?.trim() || '';

      // Maak Gripp relatie 1x aan
      const [createComp] = await gripp([{
        method: 'company.create',
        params: {
          fields: {
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
          }
        },
        id: 1,
      }]);
      const companyId = createComp?.result?.recordid;
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
        const discountName = groupDiscount?.name || '';

        // Bouw Gripp offerteregels (volle prijs, korting apart zichtbaar)
        const offerlines = [];
        let ordering = 1;
        for (const line of lines) {
          const lineDesc = line.description?.split('\n')[0]?.replace(/^\*\*|\*\*$/g, '') || '';
          const fullDesc = line.description || '';
          const priceExcl = line.pricePerUnit / 1.21;

          if ((line.pricePerUnit === 0 || line.units === 0) && lineDesc.length > 3) {
            offerlines.push({
              _ordering: ordering++, product: 345, amount: 1, sellingprice: 0, discount: 0, buyingprice: 0,
              invoicebasis: 1, vat: 27, unit: 3, convertto: 1, rowtype: 1,
              description: fullDesc.replace(/^\*\*|\*\*$/gm, '').trim(),
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
            description: specLines || lineDesc,
          });
        }
        if (offerlines.length === 0) { console.log('  SKIP #' + docInfo.quotationNumber + ': geen regels'); continue; }

        // Korting als aparte zichtbare regel onderaan (product 103 "Korting")
        if (discountPct > 0) {
          const totalExcl = lines.reduce((s, l) => s + l.units * l.pricePerUnit, 0) / 1.21;
          offerlines.push({
            _ordering: ordering++, product: 103, amount: 1,
            sellingprice: parseFloat((-(totalExcl * discountPct / 100)).toFixed(2)), discount: 0, buyingprice: 0,
            invoicebasis: 1, vat: 27, unit: 3, convertto: 1, rowtype: 1,
            description: discountName || (discountPct + '% korting'),
          });
        }

        const beschrijving = ['Overgenomen uit Reuzenpanda #' + docInfo.quotationNumber];
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

      // Status naar Afgerond via API
      const statusOk = await setStatus(item.id, AFGEROND_STATUS);
      console.log('  RP status → Afgerond:', statusOk ? 'OK' : 'FAIL');

      markSent(item.summary, {
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

  console.log('\n=== SAMENVATTING ===');
  console.log('Verwerkt:', processed, '| Mislukt:', failed);

  if (processed > 0 || failed > 0) {
    await sendTelegram('Gripp invullen: ' + processed + ' offerte(s) verwerkt' + (failed > 0 ? ', ' + failed + ' mislukt' : ''));
  }
}

main().catch(e => { console.error(e); process.exit(1); });

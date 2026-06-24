#!/usr/bin/env node
// Verrijkt HubSpot-deals met Reuzenpanda-data via de RP API (geen browser).
// Per lead: product + plaats + bron + prijsindicatie + offerte-link + deal-waarde.
// Match: RP item (telefoon/email) -> HubSpot deal (gekoppeld contact).
// Gebruik: node scripts/hubspot-enrich-rp-api.js [all|N]   (default 5)
const TOKEN = require('./secrets').HUBSPOT_TOKEN;
const { normPhone } = require('./te-ver-phones');
const RP = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const RP_BASE = 'https://backend.reuzenpanda.nl';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BID = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const STAGE_NIEUWE_LEAD = '4998659267';
const HS = 'https://api.hubapi.com';
const HH = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const RH = { Authorization: `Bearer ${RP}` };

const arg = process.argv[2] || '5';
const ALL = arg === 'all';
const DRY = process.argv.includes('--dry');

const hget = async u => (await fetch(u, { headers: HH })).json();
const hpost = async (u, b) => (await fetch(u, { method: 'POST', headers: HH, body: JSON.stringify(b) })).json();

// product-categorie afleiden uit de productomschrijving
const CATS = [
  [/pergola/i, 'pergola'], [/knikarm/i, 'knikarmscherm'], [/uitval/i, 'uitvalscherm'],
  [/voorraad/i, 'voorraadscherm'], [/rolluik/i, 'rolluiken'], [/screen/i, 'screens'],
  [/markies/i, 'markiezen'], [/behang/i, 'behang'], [/reparatie/i, 'reparatie'],
  [/raamdeco|plisse|duette|jaloezie|rolgordijn|gordijn/i, 'raamdeco_binnen'], [/zonwering/i, 'zonwering_buiten'],
];
function productCat(desc) { for (const [re, v] of CATS) if (re.test(desc)) return v; return null; }

// parse de RP lead-description: product-blok + plaats + bron
function parseDescription(desc) {
  const lines = (desc || '').split('\n');
  const get = (label) => { const l = lines.find(x => x.toLowerCase().startsWith(label.toLowerCase())); return l ? l.split(':').slice(1).join(':').trim() : ''; };
  const plaats = get('Plaats');
  const bron = get('Hoe komt u bij ons terecht?');
  const opmerking = get('Opmerking');
  // product-blok = vanaf de eerste regel die op "<n>x " begint
  const idx = lines.findIndex(l => /^\s*\d+x\s/i.test(l));
  const product = idx >= 0 ? lines.slice(idx).join('\n').trim() : '';
  return { plaats, bron, opmerking, product };
}

async function buildRpIndex() {
  const r = await fetch(`${RP_BASE}/contact-service/${PID}/backlogs/${BID}/items`, { headers: RH });
  const data = await r.json();
  const items = data.items || [];
  const byPhone = new Map(), byEmail = new Map();
  for (const it of items) {
    const f = it.fields || {};
    const email = (f.email || '').toLowerCase().trim();
    const ph = normPhone(f.phone || '');
    if (email && !byEmail.has(email)) byEmail.set(email, it);
    if (ph && !byPhone.has(ph)) byPhone.set(ph, it);
  }
  return { items, byPhone, byEmail, count: items.length };
}

// offerte (link + totaal) voor een lead_configuration_id
async function getQuote(lcId) {
  try {
    const r = await fetch(`${RP_BASE}/document-service/v1/${PID}/quotations?lead_configuration_id=${lcId}`, { headers: RH });
    const d = await r.json();
    const arr = d.quotationDatas || d.quotations || [];
    if (!arr.length) return null;
    arr.sort((a, b) => (b.quotationCreationTimestamp || 0) - (a.quotationCreationTimestamp || 0));
    const q = arr[0];
    return { documentId: q.documentId, total: q.pricing && q.pricing.total, status: q.quotationStatus,
      link: `https://document.reuzenpanda.nl/nl/${PID}/${q.documentId}/latest?pdfAction=DOCSIGN` };
  } catch (e) { return null; }
}

(async () => {
  console.log('RP-items laden...');
  const rp = await buildRpIndex();
  console.log(`RP items: ${rp.count} (telefoon-index ${rp.byPhone.size}, email-index ${rp.byEmail.size})\n`);

  // HubSpot verse leads
  const since = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
  const body = { filterGroups: [{ filters: [
      { propertyName: 'dealstage', operator: 'EQ', value: STAGE_NIEUWE_LEAD },
      { propertyName: 'createdate', operator: 'GTE', value: since }] }],
    sorts: [{ propertyName: 'createdate', direction: 'ASCENDING' }],
    properties: ['dealname', 'amount', 'sonty_reuzenpanda_id'], limit: 200 };
  let deals = [], after, total = 0;
  do { const p = await hpost(`${HS}/crm/v3/objects/deals/search`, after ? { ...body, after } : body);
    total = p.total; deals.push(...(p.results || [])); after = p.paging?.next?.after;
  } while (ALL && after && deals.length < total);
  if (!ALL) deals = deals.slice(0, parseInt(arg, 10) || 5);
  console.log(`Verse leads: ${total}. Verwerk: ${deals.length}${DRY ? ' (DRY)' : ''}\n`);

  let matched = 0, enriched = 0, noMatch = 0;
  for (const d of deals) {
    await new Promise(r => setTimeout(r, 60));
    const ac = await hget(`${HS}/crm/v4/objects/deals/${d.id}/associations/contacts`);
    const cid = ac.results?.[0]?.toObjectId; if (!cid) { noMatch++; continue; }
    const c = await hget(`${HS}/crm/v3/objects/contacts/${cid}?properties=email,phone,mobilephone`);
    const email = (c.properties.email || '').toLowerCase().trim();
    const ph = normPhone(c.properties.phone || c.properties.mobilephone || '');
    const item = (ph && rp.byPhone.get(ph)) || (email && rp.byEmail.get(email));
    if (!item) { noMatch++; continue; }
    matched++;
    const { plaats, bron, opmerking, product } = parseDescription(item.description);
    const lcId = item.item_subject?.id;
    const leadValue = parseFloat(item.fields?.cf_lead_value?.amount || item.lead_value || '0') || 0;
    const quote = lcId ? await getQuote(lcId) : null;
    const dealValue = (quote && quote.total) ? quote.total : leadValue;
    const props = {};
    if (lcId) {
      props.sonty_reuzenpanda_id = lcId;
      // bewerk-link: open de offerte in Reuzenpanda om aan te passen
      props.sonty_reuzenpanda_link = `https://hub.reuzenpanda.nl/app/deals/pipeline?item=${lcId}`;
    }
    if (product) props.sonty_reuzenpanda_description = [product, plaats ? `\nPlaats: ${plaats}` : '', bron ? `\nBron: ${bron}` : '', opmerking ? `\nOpmerking: ${opmerking}` : ''].join('');
    if (leadValue > 0) props.sonty_first_quote_amount = String(Math.round(leadValue));
    if (dealValue > 0 && !d.properties.amount) props.amount = String(Math.round(dealValue));
    if (quote && quote.link) props.sonty_offerte_link = quote.link; // klant-offertelink (bekijken/sturen)
    const cat = productCat(product); if (cat) props.product_categorie = cat;
    const naam = d.properties.dealname;
    if (DRY) { console.log(`DRY ${naam} | ${plaats} | ${(product.split('\n')[0]||'').trim()} | €${dealValue} | offerte:${quote?'ja':'nee'}`); continue; }
    if (Object.keys(props).length) {
      await fetch(`${HS}/crm/v3/objects/deals/${d.id}`, { method: 'PATCH', headers: HH, body: JSON.stringify({ properties: props }) });
      enriched++;
      console.log(`OK  ${naam} | ${plaats} | ${(product.split('\n')[0]||'').replace(/:$/,'').trim()} | €${dealValue}${quote ? ' | offerte' : ''}`);
    }
  }
  console.log(`\nKlaar. Gematcht: ${matched}, verrijkt: ${enriched}, geen RP-match: ${noMatch}`);
})();

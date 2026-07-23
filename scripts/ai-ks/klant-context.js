// Zoekt klantcontext bij een inkomend bericht: RP-offertes + HubSpot contact/deal.
const path = require('path');
const CFG = require('./config.js');
const HUBSPOT_TOKEN = require(path.join(__dirname, '..', 'secrets.js')).HUBSPOT_TOKEN;

const norm = s => (s || '').toLowerCase().trim();
function normPhone(p) {
  let d = (p || '').replace(/\D/g, '');
  if (d.startsWith('0031')) d = '31' + d.slice(4);
  if (d.startsWith('06') && d.length === 10) d = '31' + d.slice(1);
  if (d.startsWith('6') && d.length === 9) d = '31' + d;
  return d;
}

async function rpGet(ep) {
  try {
    const res = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY } });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// RP: zoek pipeline-items + offertes op e-mail of telefoon (via het snelle board-endpoint)
async function findRpOffertes({ email, phone, naam, adres }) {
  const data = await rpGet(`/contact-service/${CFG.RP_PID}/boards/${CFG.RP_BOARD}/items`);
  if (!data?.items) return { fout: 'Reuzenpanda was even niet bereikbaar — probeer het zo nog een keer voordat je concludeert dat er geen offerte is.' };
  const items = data.items;
  const e = norm(email), p = normPhone(phone);
  const n = norm(naam), a = norm(adres);
  // RP zet contactgegevens als platte tekst in summary/description — daar matchen we op.
  // Gericht zoeken (instructie Daimy): telefoon/e-mail eerst; naam/adres als extra invalshoek.
  const matches = items.filter(it => {
    const blob = ((it.summary || '') + '\n' + (it.description || '')).toLowerCase();
    const digits = blob.replace(/[^0-9]/g, '');
    if ((e && blob.includes(e)) || (p && p.length >= 10 && digits.includes(p))) return true;
    if (n && n.length > 5 && blob.includes(n)) return true;
    if (a && a.length > 5 && blob.includes(a)) return true;
    return false;
  }).slice(0, 5);

  // V4-CHECK (Daimy 23-07, casus Mehul 20268955): een offerte die nog niet door de
  // offertecontrole is gegaan (herkenbaar aan niet-dikgedrukte productregels) mag NIET
  // als link gedeeld worden — de klant zou ongecontroleerde prijzen/opmaak zien.
  async function isV4Verwerkt(documentId) {
    try {
      const d = await rpGet(`/document-service/v1/${CFG.RP_PID}/quotations/${documentId}`);
      const lines = d?.quotationData?.segments?.defaultTemplatePriceLineGroup?.data?.lines || [];
      const prijsRegels = lines.filter((l) => (l.pricePerUnit || 0) > 0);
      if (!prijsRegels.length) return false;
      return prijsRegels.every((l) => String(l.description || '').startsWith('**'));
    } catch { return false; }
  }
  const results = [];
  for (const it of matches) {
    const lcId = it.item_subject?.id;
    let offertes = [];
    if (lcId) {
      const docs = await rpGet(`/document-service/v1/${CFG.RP_PID}/quotations?lead_configuration_id=${lcId}`);
      const gesorteerd = (docs?.quotationDatas || [])
        .sort((a, b) => String(b.quotationCreationTimestamp || '').localeCompare(String(a.quotationCreationTimestamp || '')));
      offertes = [];
      for (let idx = 0; idx < gesorteerd.length; idx++) {
        const d = gesorteerd[idx];
        // Alleen de 2 nieuwste checken (die deelt de bot); scheelt API-calls op oude dossiers
        const verwerkt = idx < 2 ? await isV4Verwerkt(d.documentId) : true;
        offertes.push({
          nummer: d.quotationNumber, status: d.quotationStatus,
          aangemaakt: d.quotationCreationTimestamp || null,
          nieuwste: idx === 0, // gesorteerd nieuw → oud
          documentId: d.documentId,
          ...(verwerkt
            ? { link: `https://document.reuzenpanda.nl/nl/${CFG.RP_PID}/${d.documentId}/latest?pdfAction=DOCSIGN` }
            : { link: null, LET_OP: 'Deze offerte is NOG NIET door de offertecontrole. Deel GEEN link en noem GEEN bedragen eruit — zeg dat de offerte vandaag nog wordt bijgewerkt en automatisch wordt toegestuurd. Bij haast: escaleren_naar_mens.' }),
        });
      }
    }
    results.push({
      itemId: it.id,
      itemNaam: it.summary || it.title || it.name || null,
      statusId: it.status_id || it.status?.id || null,
      aanvraag: (it.description || '').substring(0, 600) || null, // originele configurator-aanvraag van de klant
      lcId, offertes,
    });
  }
  return results;
}

async function hsSearch(objectType, filters, properties) {
  try {
    const res = await fetch(`https://api.hubapi.com/crm/v3/objects/${objectType}/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ filterGroups: filters, properties, limit: 3 }),
    });
    if (!res.ok) return [];
    return (await res.json()).results || [];
  } catch { return []; }
}

async function findHubspot({ email, phone }) {
  const groups = [];
  if (email) groups.push({ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] });
  if (phone) {
    const p = normPhone(phone);
    groups.push({ filters: [{ propertyName: 'phone', operator: 'CONTAINS_TOKEN', value: '*' + p.slice(-9) }] });
  }
  if (!groups.length) return null;
  const contacts = await hsSearch('contacts', groups, ['firstname', 'lastname', 'email', 'phone', 'city']);
  if (!contacts.length) return null;
  const c = contacts[0];
  // Bijbehorende deals
  let deals = [];
  try {
    const res = await fetch(`https://api.hubapi.com/crm/v4/objects/contacts/${c.id}/associations/deals`, {
      headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
    });
    if (res.ok) {
      const ids = ((await res.json()).results || []).slice(0, 3).map(r => r.toObjectId);
      for (const id of ids) {
        const d = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${id}?properties=dealname,dealstage,amount,product_categorie`, {
          headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
        });
        if (d.ok) { const j = await d.json(); deals.push({ id, ...j.properties }); }
      }
    }
  } catch {}
  return {
    contactId: c.id,
    naam: [c.properties.firstname, c.properties.lastname].filter(Boolean).join(' '),
    email: c.properties.email, phone: c.properties.phone, plaats: c.properties.city,
    deals,
  };
}

// Volledige inhoud (prijsregels) van een offerte — zodat de AI weet wat er al in zit
async function getOfferteInhoud(documentId) {
  const doc = await rpGet(`/document-service/v1/${CFG.RP_PID}/quotations/${documentId}`);
  const qd = doc?.quotationData;
  if (!qd) return { error: 'Offerte niet gevonden' };
  const lines = (qd.segments?.defaultTemplatePriceLineGroup?.data?.lines || []).map(l => ({
    aantal: l.units,
    prijsPerStuk: l.pricePerUnit,
    product: (l.description || '').split('\n')[0].replace(/\*\*/g, '').trim(),
    details: (l.description || '').split('\n').slice(1, 8).map(s => s.replace(/\*\*/g, '').trim()).filter(Boolean).join(' | ').substring(0, 300),
  }));
  return {
    nummer: qd.quotationNumber, status: qd.quotationStatus,
    totaalIncl: qd.totalPriceInclVat ?? qd.totalIncl ?? null,
    regels: lines,
  };
}

async function buildKlantContext({ email, phone, naam, adres }) {
  const [rp, hs] = await Promise.all([findRpOffertes({ email, phone, naam, adres }), findHubspot({ email, phone })]);
  return { naam: naam || hs?.naam || null, rp, hubspot: hs };
}

module.exports = { buildKlantContext, findRpOffertes, findHubspot, normPhone, getOfferteInhoud };

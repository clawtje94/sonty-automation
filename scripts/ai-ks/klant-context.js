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
async function findRpOffertes({ email, phone, naam, adres, offertenummer }) {
  // EIGEN CRM eerst (blok 1 RP-uitzetten): eigen leads op telefoon/e-mail, in RP-itemvorm met id LEAD-…
  let eigenItems = [];
  try { eigenItems = await require('../lib/eigen-crm.js').zoek({ telefoon: phone, email, nummer: offertenummer }); } catch { eigenItems = []; }
  const data = await rpGet(`/contact-service/${CFG.RP_PID}/boards/${CFG.RP_BOARD}/items`);
  if (eigenItems.length) { data.items = [...eigenItems, ...(data?.items || [])]; }
  if (!data?.items) return { fout: 'Reuzenpanda was even niet bereikbaar — probeer het zo nog een keer voordat je concludeert dat er geen offerte is.' };
  const items = data.items;
  const e = norm(email), p = normPhone(phone);
  const n = norm(naam), a = norm(adres);
  // RP zet contactgegevens als platte tekst in summary/description — daar matchen we op.
  // Gericht zoeken (instructie Daimy): telefoon/e-mail eerst; naam/adres als extra invalshoek.
  // TELEFOONMATCH OP DE LAATSTE 9 CIJFERS (Daimy 2026-07-27, Markus Naumer / ticket 968814545).
  // De oude versie plakte alle cijfers van het dossier aan elkaar en zocht daar "31622223964" in.
  // RP slaat het nummer bij winkel-/showroomdossiers alleen in nationale notatie op ("0622223964"),
  // en daar zit "31622223964" niet in. Gevolg: het tweede dossier van dezelfde klant werd niet
  // gevonden, de bot zag maar één offerte en stuurde die — terwijl de klant om een offerte uit het
  // andere dossier vroeg. Daarom vergelijken we nu het abonnee-deel (laatste 9 cijfers), net zoals
  // findHubspot dat al deed. Per cijferreeks vergelijken in plaats van in één cijferbrij, anders
  // ontstaan toevalstreffers over veldgrenzen heen (maten en postcodes staan in dezelfde tekst).
  const pKort = p.length >= 9 ? p.slice(-9) : '';
  const matchtTelefoon = (blob) => {
    if (!pKort) return false;
    for (const reeks of blob.match(/\d{9,15}/g) || []) if (reeks.slice(-9) === pKort) return true;
    return false;
  };
  // Casus John van Krimpen (28/29-08-2026, 2 dagen stilte): e-mail matchte wél, maar "adres: Rotterdam"
  // matchte honderden items en de lijst werd na 5 afgekapt, zodat zijn dossier eraf viel. Bovendien had
  // zijn WhatsApp-nummer één cijfer anders dan het nummer in RP en stond zijn naam in RP met een dubbele
  // spatie. Daarom nu: scoren op sterkte (e-mail > telefoon > naam > adres), tolerantie voor één
  // verkeerd cijfer als de naam ook past, spaties samengevoegd, en een kaal plaatsnaam-adres telt niet.
  const nWoorden = n.split(/\s+/).filter(w => w.length > 2);
  const matchtTelefoonBijna = (digits) => {
    if (!pKort) return false;
    for (const reeks of digits.match(/\d{9,15}/g) || []) {
      const k = reeks.slice(-9); if (k.length !== 9) continue;
      let verschil = 0; for (let i = 0; i < 9; i++) if (k[i] !== pKort[i]) verschil++;
      if (verschil === 1) return true;
    }
    return false;
  };
  const adresBruikbaar = a && a.length > 5 && (/\d/.test(a) || a.split(/\s+/).length >= 2);
  const gescoord = items.map(it => {
    // Regeleinden BEWAREN voor de cijferreeksen (anders plakken postcode/huisnummer/telefoon aan
    // elkaar en matcht geen enkel nummer meer, regressie 30-08: 11 van 12 klanten kwijt).
    const raw = ((it.summary || '') + '\n' + (it.description || '')).toLowerCase();
    const blob = raw.replace(/[ \t]+/g, ' ');
    const digits = raw.replace(/[^0-9\n]/g, '');
    let score = 0;
    if (e && blob.includes(e)) score += 8;
    if (matchtTelefoon(digits)) score += 6;
    const naamPast = n && n.length > 5 && blob.includes(n);
    const achternaamPast = nWoorden.length >= 2 && blob.includes(nWoorden[nWoorden.length - 1]);
    if (naamPast) score += 4;
    if (!matchtTelefoon(digits) && (naamPast || achternaamPast) && matchtTelefoonBijna(digits)) score += 3;
    if (adresBruikbaar && blob.includes(a)) score += 2;
    return { it, score };
  }).filter(x => x.score > 0).sort((x, y) => y.score - x.score);
  const matches = gescoord.slice(0, 5).map(x => x.it);

  // V4-CHECK (Daimy 23-07, casus Mehul 20268955): een offerte die nog niet door de
  // offertecontrole is gegaan (herkenbaar aan niet-dikgedrukte productregels) mag NIET
  // als link gedeeld worden — de klant zou ongecontroleerde prijzen/opmaak zien.
  //
  // VERFIJND 2026-07-27 (Naumer, offerte 202610354). "Álle regels vet" bleek te streng: op die
  // offerte waren de vier productregels netjes vet, maar in de winkel was daarna met de hand een
  // Situo 5 handzender (€115) bijgezet. Die ene niet-vette regel blokkeerde de hele offerte,
  // terwijl de klant hem vrijdag in de showroom al op papier had. Een offerte die V4 nooit heeft
  // gezien heeft NUL vette regels (bevestigd op 52 oude dossiers in de steekproef van 27 juli);
  // een handmatige toevoeging achteraf laat de productregels vet. Daarom kijken we nu of de
  // dúúrste regel vet is en of de meerderheid vet is: dat onderscheidt "nooit gecontroleerd" van
  // "gecontroleerd, daarna een accessoire bijgezet" zonder de Mehul-casus terug te breken.
  async function isV4Verwerkt(documentId) {
    try {
      const d = await rpGet(`/document-service/v1/${CFG.RP_PID}/quotations/${documentId}`);
      const lines = d?.quotationData?.segments?.defaultTemplatePriceLineGroup?.data?.lines || [];
      const prijsRegels = lines.filter((l) => (l.pricePerUnit || 0) > 0);
      if (!prijsRegels.length) return false;
      const isVet = (l) => String(l.description || '').startsWith('**');
      const duurste = prijsRegels.reduce((a, b) => ((b.pricePerUnit || 0) > (a.pricePerUnit || 0) ? b : a));
      const aantalVet = prijsRegels.filter(isVet).length;
      return isVet(duurste) && aantalVet * 2 > prijsRegels.length;
    } catch { return false; }
  }
  const results = [];
  // Noemt de klant zelf een offertenummer, dan is dat de sterkste sleutel: documentId uit de lokale
  // offertecache/backups, zodat de bot nooit meer "ik vind niets" zegt bij een bestaand nummer.
  const nr = String(offertenummer || '').replace(/\D/g, '');
  if (nr.length >= 8) {
    let documentId = null;
    try {
      const fs = require('fs');
      const bk = path.join(__dirname, '..', '..', 'data', 'offerte-backups', nr + '.json');
      if (fs.existsSync(bk)) { const j = JSON.parse(fs.readFileSync(bk, 'utf8')); documentId = (Array.isArray(j) ? j[0] : j)?.documentId || null; }
      if (!documentId) {
        const cache = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'rp-offerte-cache.json'), 'utf8'));
        const arr = Array.isArray(cache) ? cache : Object.values(cache);
        const hit = arr.find(x => (x?.waarde?.nummers || []).includes(nr));
        documentId = hit?.waarde?.documentId || null;
      }
    } catch { /* lokale bronnen ontbreken: dan alleen bord-zoeken */ }
    if (documentId) {
      const verwerkt = await isV4Verwerkt(documentId);
      let status = null;
      try { const d = await rpGet(`/document-service/v1/${CFG.RP_PID}/quotations/${documentId}`); status = d?.quotationStatus || d?.quotationData?.quotationStatus || null; } catch { /* status optioneel */ }
      results.push({
        itemId: null, itemNaam: `(gevonden op offertenummer ${nr})`, statusId: null, aanvraag: null, lcId: null,
        offertes: [{ nummer: nr, status, aangemaakt: null, nieuwste: true, documentId,
          ...(verwerkt
            ? { link: `https://document.reuzenpanda.nl/nl/${CFG.RP_PID}/${documentId}/latest?pdfAction=DOCSIGN` }
            : { link: null, LET_OP: 'Deze offerte is NOG NIET door de offertecontrole. Deel GEEN link en noem GEEN bedragen eruit.' }) }],
      });
    }
  }
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

async function buildKlantContext({ email, phone, naam, adres, offertenummer }) {
  const [rp, hs] = await Promise.all([findRpOffertes({ email, phone, naam, adres, offertenummer }), findHubspot({ email, phone })]);
  return { naam: naam || hs?.naam || null, rp, hubspot: hs };
}

module.exports = { buildKlantContext, findRpOffertes, findHubspot, normPhone, getOfferteInhoud };

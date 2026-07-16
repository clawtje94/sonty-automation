// Nieuwe offerte aanmaken in Reuzenpanda via de widget-API (zelfde bewezen flow als de
// winkel-offerte-tool, zie memory/project_offerte_tool_winkel): RP maakt zelf lead + contact +
// offerte + pipeline-item aan. Verwerking is asynchroon (±5-7 min) — de daemon vult daarna de
// offerte met de echte producten en appt de link automatisch na (pending-offertes flow).
const fs = require('fs');
const path = require('path');
const CFG = require('./config.js');

const WIDGET_ID = '4909baad-1717-4bfa-a93a-ba9355f7a9e3'; // live widget sonty.nl/offerte-aanvragen
const PLACEHOLDER_TEMPLATE = 'fbdf3ec4-5377-4688-8dab-59ffe90bea5e'; // Shutters placeholder (geen v4-routing)
const HERKOMST_FIELD = '52d50710-0615-4d43-ab5f-03adf5d70c6d';
const PENDING_FILE = path.join(__dirname, '..', '..', 'data', 'ai-ks', 'pending-offertes.json');

function loadPending() {
  try { return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8')); } catch { return []; }
}
function savePending(p) {
  fs.mkdirSync(path.dirname(PENDING_FILE), { recursive: true });
  fs.writeFileSync(PENDING_FILE, JSON.stringify(p, null, 1));
}

async function maakLead({ naam, email, telefoon, plaats, postcode, straat }) {
  const nameParts = String(naam).trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '-';

  let straatNaam = (straat || '').trim(), huisnummer = '';
  const m = straatNaam.match(/^(.*?)\s+(\d\S*)$/);
  if (m) { straatNaam = m[1]; huisnummer = m[2]; }

  const cf = (id, label, value, identifier = false) =>
    ({ field_identifier: id, field_label: label, value, type: 'string', contact_item: true, identifier_item: identifier });

  const inputFields = [
    cf('country', 'Land', 'Nederland'),
    cf('first_name', 'Voornaam', firstName),
    cf('last_name', 'Achternaam', lastName),
    ...(email ? [cf('email', 'E-mailadres', email, true)] : []),
    ...(telefoon ? [cf('phone', 'Telefoonnummer', telefoon)] : []),
    ...(postcode ? [cf('postal_code', 'Postcode', postcode)] : []),
    ...(huisnummer ? [cf('address_number', 'Huisnummer', huisnummer)] : []),
    ...(plaats ? [cf('city', 'Plaats', plaats)] : []),
    ...(straatNaam ? [cf('address_street', 'Straatnaam', straatNaam)] : []),
    { field_identifier: HERKOMST_FIELD, field_label: 'Hoe komt u bij ons terecht?', value: 'Winkel', type: 'string', contact_item: false, identifier_item: false },
  ];

  const res = await fetch('https://backend.reuzenpanda.nl/widget-service/api/v1/lead-configuration/public', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Origin: 'https://offerte.directsamenstellen.nl', Referer: 'https://offerte.directsamenstellen.nl/' },
    body: JSON.stringify({
      configuration: {
        input_fields: inputFields,
        products: [{
          product_id: crypto.randomUUID(),
          template_id: PLACEHOLDER_TEMPLATE,
          template_name: 'Offerte op maat',
          options: [], amount: 1, position: 0,
          parent_product_id: '', parent_category_id: null, parent_category_name: null,
        }],
        meta_data: { theme: 'sonty', locale: 'nl', app: 'quotomator' },
      },
      widget_id: WIDGET_ID,
      finalise: true,
      automation: true,
    }),
  });
  if (!res.ok) return { error: 'Lead aanmaken mislukt (RP widget-service ' + res.status + ')' };
  const data = await res.json().catch(() => null);
  if (!data?.id) return { error: 'Lead aanmaken mislukt: geen id terug van RP' };
  return { lcId: data.id };
}

// Registreer een aangemaakte lead; de daemon vult de offerte en appt de link zodra RP klaar is
function registreerPending({ lcId, ticketId, klantNaam, producten, sonny }) {
  const pending = loadPending();
  pending.push({ lcId, ticketId, klantNaam, producten, sonny: !!sonny, status: 'wachten', aangemaakt: Date.now() });
  savePending(pending);
}

module.exports = { maakLead, registreerPending, loadPending, savePending };

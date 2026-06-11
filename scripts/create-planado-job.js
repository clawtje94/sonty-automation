#!/usr/bin/env node
/**
 * Maak een Planado job aan vanuit een HubSpot deal
 * Gebruik: node scripts/create-planado-job.js <dealId> <type>
 * Types: inmeet, montage, service, reparatie, onderhoud
 */

const HS_TOKEN = require('./secrets').HUBSPOT_TOKEN;
const PL_TOKEN = 'b9877b84119475b39953cb5dd0c409a7704ef669fe569bc1745c99275cef';

const TEMPLATES = {
  inmeet: '1f11c802-65cd-6aa0-9d06-7e73cee772e4',
  montage: '1f11c802-6613-6d00-9d06-7e73cee772e4',
  'montage-zakelijk': '1f11c802-6675-6110-9d06-7e73cee772e4',
  service: '1f11c802-6452-6f20-9d06-7e73cee772e4',
  reparatie: '1f11c802-66cd-6430-9d06-7e73cee772e4',
  onderhoud: '1f11c802-63cb-6a80-9d06-7e73cee772e4',
  advies: '1f11c802-652e-69e0-9d06-7e73cee772e4',
  winkel: '1f11c802-658a-62d0-9d06-7e73cee772e4',
};

async function getHubSpotDealWithContact(dealId) {
  // Get deal
  const deal = await (await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}?properties=dealname,sonty_reuzenpanda_description,sonty_reuzenpanda_id,amount`, {
    headers: { 'Authorization': 'Bearer ' + HS_TOKEN }
  })).json();

  // Get associated contact
  const assoc = await (await fetch(`https://api.hubapi.com/crm/v4/objects/deals/${dealId}/associations/contacts`, {
    headers: { 'Authorization': 'Bearer ' + HS_TOKEN }
  })).json();

  const contactId = assoc.results?.[0]?.toObjectId;
  let contact = {};
  if (contactId) {
    const cRes = await (await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,phone,address,city,zip,mobilephone`, {
      headers: { 'Authorization': 'Bearer ' + HS_TOKEN }
    })).json();
    contact = cRes.properties || {};
  }

  return { deal: deal.properties, contact };
}

async function createPlanadoJob({ deal, contact, type, scheduledAt, workerEmail }) {
  const templateUuid = TEMPLATES[type];
  if (!templateUuid) throw new Error('Onbekend type: ' + type + '. Opties: ' + Object.keys(TEMPLATES).join(', '));

  const name = ((contact.firstname || '') + ' ' + (contact.lastname || '')).trim() || deal.dealname;
  const phone = contact.phone || contact.mobilephone || '';
  const email = contact.email || '';
  const address = contact.address ? `${contact.address}, ${contact.city || ''} ${contact.zip || ''}`.trim() : '';

  // Build description from RP offerte data
  let description = '';
  if (deal.sonty_reuzenpanda_description) {
    description = deal.sonty_reuzenpanda_description;
  }

  const contacts = [];
  if (phone) contacts.push({ type: 'phone', name: name, value: phone });
  else contacts.push({ type: 'phone', name: name, value: '-' });
  if (email) contacts.push({ type: 'email', name: name, value: email });

  const jobBody = {
    template_uuid: templateUuid,
    description: description,
    contacts: contacts,
  };

  if (address) {
    jobBody.address = { formatted: address };
  }

  if (scheduledAt) {
    jobBody.scheduled_at = scheduledAt;
    jobBody.scheduled_duration = { minutes: type === 'inmeet' ? 120 : type.includes('montage') ? 180 : 90 };
  }

  // Link to HubSpot deal
  jobBody.external_id = 'hubspot-deal-' + deal.hs_object_id;

  console.log('Creating Planado job:');
  console.log('  Type:', type);
  console.log('  Klant:', name);
  console.log('  Telefoon:', phone);
  console.log('  Email:', email);
  console.log('  Adres:', address);
  console.log('  Beschrijving:', (description || '-').substring(0, 80) + '...');

  const res = await fetch('https://api.planadoapp.com/v2/jobs', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + PL_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(jobBody),
  });

  if (res.status === 201 || res.status === 200) {
    const data = await res.json();
    console.log('✅ Job aangemaakt! #' + (data.job?.serial_no || '?'));
    return data.job;
  } else {
    const err = await res.text();
    console.error('❌ Fout:', res.status, err.substring(0, 300));
    return null;
  }
}

async function main() {
  const dealId = process.argv[2];
  const type = process.argv[3] || 'inmeet';

  if (!dealId) {
    console.log('Gebruik: node scripts/create-planado-job.js <dealId> <type>');
    console.log('Types:', Object.keys(TEMPLATES).join(', '));
    console.log('\nVoorbeeld: node scripts/create-planado-job.js 498741416160 inmeet');
    process.exit(1);
  }

  const { deal, contact } = await getHubSpotDealWithContact(dealId);
  console.log('HubSpot deal:', deal.dealname);

  await createPlanadoJob({ deal, contact, type });
}

main().catch(e => { console.error(e); process.exit(1); });

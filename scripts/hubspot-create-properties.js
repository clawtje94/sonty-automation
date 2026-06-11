#!/usr/bin/env node
// Creates custom deal properties in HubSpot via API

const TOKEN = require('./secrets').HUBSPOT_TOKEN;
const BASE_URL = 'https://api.hubapi.com';

const properties = [
  {
    name: 'inkoopbedrag',
    label: 'Inkoopbedrag',
    type: 'number',
    fieldType: 'number',
    groupName: 'dealinformation',
  },
  {
    name: 'product_categorie',
    label: 'Product categorie',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'dealinformation',
    options: [
      { label: 'Zonnepanelen', value: 'zonnepanelen', displayOrder: 0 },
      { label: 'Batterij', value: 'batterij', displayOrder: 1 },
      { label: 'Airco', value: 'airco', displayOrder: 2 },
      { label: 'Warmtepomp', value: 'warmtepomp', displayOrder: 3 },
      { label: 'Combi', value: 'combi', displayOrder: 4 },
      { label: 'Overig', value: 'overig', displayOrder: 5 },
    ],
  },
  {
    name: 'verkoop_excl_btw',
    label: 'Verkoop excl BTW',
    type: 'number',
    fieldType: 'number',
    groupName: 'dealinformation',
  },
  {
    name: 'inkoop_excl_btw',
    label: 'Inkoop excl BTW',
    type: 'number',
    fieldType: 'number',
    groupName: 'dealinformation',
  },
];

async function createProperty(prop) {
  const url = `${BASE_URL}/crm/v3/properties/deals`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(prop),
  });
  const data = await res.json();
  if (res.ok) {
    console.log(`OK  ${prop.name} — created (${prop.type})`);
  } else if (res.status === 409 || (data.message && data.message.includes('already exists'))) {
    console.log(`SKIP ${prop.name} — already exists`);
  } else {
    console.log(`FAIL ${prop.name} — ${res.status} ${data.message || JSON.stringify(data)}`);
  }
  return { name: prop.name, status: res.status, data };
}

(async () => {
  console.log('Creating 4 custom deal properties in HubSpot...\n');
  for (const prop of properties) {
    await createProperty(prop);
  }
  console.log('\nDone.');
})();

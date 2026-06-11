#!/usr/bin/env node
// Updates the product_categorie property with the correct options

const TOKEN = require('./secrets').HUBSPOT_TOKEN;
const BASE_URL = 'https://api.hubapi.com';

const correctOptions = [
  { label: 'Voorraadscherm', value: 'voorraadscherm', displayOrder: 0 },
  { label: 'Knikarmscherm', value: 'knikarmscherm', displayOrder: 1 },
  { label: 'Uitvalscherm', value: 'uitvalscherm', displayOrder: 2 },
  { label: 'Raamdeco binnen', value: 'raamdeco_binnen', displayOrder: 3 },
  { label: 'Behang', value: 'behang', displayOrder: 4 },
  { label: 'Rolluiken', value: 'rolluiken', displayOrder: 5 },
  { label: 'Screens', value: 'screens', displayOrder: 6 },
  { label: 'Pergola', value: 'pergola', displayOrder: 7 },
  { label: 'Markiezen', value: 'markiezen', displayOrder: 8 },
  { label: 'Zonwering buiten', value: 'zonwering_buiten', displayOrder: 9 },
  { label: 'Reparatie', value: 'reparatie', displayOrder: 10 },
];

(async () => {
  console.log('Updating product_categorie with correct options...\n');

  const url = `${BASE_URL}/crm/v3/properties/deals/product_categorie`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      options: correctOptions,
    }),
  });

  const data = await res.json();
  if (res.ok) {
    console.log('✅ product_categorie updated!');
    console.log('Options:', data.options?.map(o => o.label).join(', '));
  } else {
    console.log(`❌ ${res.status}:`, data.message || JSON.stringify(data));
  }
})();

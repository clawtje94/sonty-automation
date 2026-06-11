// Create missing HubSpot contact properties for Planado integration
const TOKEN = require('./secrets').HUBSPOT_TOKEN;
const BASE = 'https://api.hubapi.com';

async function createProperty(objectType, prop) {
  const res = await fetch(`${BASE}/crm/v3/properties/${objectType}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(prop)
  });
  const data = await res.json();
  if (res.ok) {
    console.log(`  + ${prop.name}: aangemaakt`);
  } else if (data.message?.includes('already exists')) {
    console.log(`  = ${prop.name}: bestaat al`);
  } else {
    console.log(`  ! ${prop.name}: ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

async function checkExistingProperties(objectType) {
  const res = await fetch(`${BASE}/crm/v3/properties/${objectType}`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  const data = await res.json();
  return data.results || [];
}

(async () => {
  console.log('=== HubSpot Contact Properties Controleren ===\n');

  // Check which contact properties already exist
  const existing = await checkExistingProperties('contacts');
  const existingNames = existing.map(p => p.name);

  // Check standard address fields
  const addressFields = ['address', 'city', 'zip', 'state', 'country', 'phone', 'email', 'mobilephone'];
  console.log('Standaard adresvelden:');
  addressFields.forEach(f => {
    const exists = existingNames.includes(f);
    console.log(`  ${exists ? '✓' : '✗'} ${f}`);
  });

  console.log('\n=== Ontbrekende Contact Properties Aanmaken ===\n');

  // Create street address if not exists
  if (!existingNames.includes('address')) {
    await createProperty('contacts', {
      name: 'address',
      label: 'Straat en huisnummer',
      type: 'string',
      fieldType: 'text',
      groupName: 'contactinformation',
      description: 'Straatnaam en huisnummer van het contact'
    });
  } else {
    console.log('  = address: bestaat al');
  }

  console.log('\n=== HubSpot Deal Properties Controleren ===\n');

  const dealProps = await checkExistingProperties('deals');
  const dealPropNames = dealProps.map(p => p.name);

  // Properties we need for tracking
  const neededDealProps = [
    { name: 'afspraak_type', label: 'Afspraak Type', type: 'enumeration', fieldType: 'select', groupName: 'dealinformation',
      description: 'Type afspraak (inmeten, montage, etc.)',
      options: [
        { label: 'Inmeet afspraak', value: 'inmeet_afspraak', displayOrder: 0 },
        { label: 'Montage afspraak', value: 'montage_afspraak', displayOrder: 1 },
        { label: 'Winkel afspraak', value: 'winkel_afspraak', displayOrder: 2 },
        { label: 'Service afspraak', value: 'service_afspraak', displayOrder: 3 },
        { label: 'Reparatie afspraak', value: 'reparatie_afspraak', displayOrder: 4 },
        { label: 'Onderhouds afspraak', value: 'onderhouds_afspraak', displayOrder: 5 },
        { label: 'Advies afspraak', value: 'advies_afspraak', displayOrder: 6 }
      ]
    },
    { name: 'eerste_offertebedrag', label: 'Eerste Offertebedrag', type: 'number', fieldType: 'number', groupName: 'dealinformation',
      description: 'Bedrag van de eerste (Reuzenpanda) offerte' },
    { name: 'definitief_offertebedrag', label: 'Definitief Offertebedrag', type: 'number', fieldType: 'number', groupName: 'dealinformation',
      description: 'Bedrag van de definitieve offerte' },
    { name: 'planado_job_id', label: 'Planado Job ID', type: 'string', fieldType: 'text', groupName: 'dealinformation',
      description: 'ID van de gekoppelde Planado opdracht' },
    { name: 'opmeting_datum', label: 'Opmeting Datum', type: 'date', fieldType: 'date', groupName: 'dealinformation',
      description: 'Datum van de inmeetafspraak' },
    { name: 'montage_datum', label: 'Montage Datum', type: 'date', fieldType: 'date', groupName: 'dealinformation',
      description: 'Datum van de montageafspraak' },
    { name: 'aanbetaling_bedrag', label: 'Aanbetaling Bedrag', type: 'number', fieldType: 'number', groupName: 'dealinformation',
      description: 'Bedrag van de aanbetaling (50%)' },
    { name: 'eindfactuur_bedrag', label: 'Eindfactuur Bedrag', type: 'number', fieldType: 'number', groupName: 'dealinformation',
      description: 'Bedrag van de eindfactuur (50%)' },
    { name: 'closed_lost_reason', label: 'Reden Verloren', type: 'enumeration', fieldType: 'select', groupName: 'dealinformation',
      description: 'Waarom de deal verloren is',
      options: [
        { label: 'Te duur', value: 'te_duur', displayOrder: 0 },
        { label: 'Concurrent gekozen', value: 'concurrent', displayOrder: 1 },
        { label: 'Geen reactie', value: 'geen_reactie', displayOrder: 2 },
        { label: 'Project uitgesteld', value: 'uitgesteld', displayOrder: 3 },
        { label: 'Niet meer nodig', value: 'niet_nodig', displayOrder: 4 },
        { label: 'Overig', value: 'overig', displayOrder: 5 }
      ]
    }
  ];

  for (const prop of neededDealProps) {
    if (dealPropNames.includes(prop.name)) {
      console.log(`  = ${prop.name}: bestaat al`);
    } else {
      await createProperty('deals', prop);
    }
  }

  console.log('\n=== Pipeline Stages Controleren ===\n');

  const pipelineRes = await fetch(`${BASE}/crm/v3/pipelines/deals/3623322812`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  const pipeline = await pipelineRes.json();

  if (pipeline.stages) {
    const stages = pipeline.stages.sort((a, b) => a.displayOrder - b.displayOrder);
    console.log(`Pipeline: ${pipeline.label} (${stages.length} stages)`);
    stages.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.label} (${s.id}) - ${s.metadata?.probability || '?'}%`);
    });
  } else {
    console.log('Pipeline niet gevonden:', JSON.stringify(pipeline));
  }

  console.log('\n=== Klaar ===');
})();

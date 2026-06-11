const express = require('express');
const path = require('path');
const app = express();
const PORT = 3457;

const HUBSPOT_TOKEN = require('../scripts/secrets').HUBSPOT_TOKEN;
const HUBSPOT_BASE = 'https://api.hubapi.com';
const PIPELINE_ID = '3623322812';

const DEAL_PROPERTIES = [
  'dealname', 'amount', 'product_categorie', 'dealstage', 'pipeline',
  'createdate', 'closedate', 'hs_is_closed_won', 'hs_is_closed_lost',
  'aantal_belpogingen', 'laatste_belpoging', 'nurture_fase', 'afspraak_type'
];

// Simple role-based access
const ROLES = {
  sales: { label: 'Sales', color: '#FF6B00' },
  planning: { label: 'Planning', color: '#3498db' },
  monteurs: { label: 'Monteurs & Inmeters', color: '#2ecc71' },
  klantenservice: { label: 'Klantenservice', color: '#9b59b6' }
};

// Cache
let cache = { deals: null, pipeline: null, timestamp: 0 };
const CACHE_TTL = 2 * 60 * 1000;

async function hubspotFetch(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function fetchAllDeals() {
  const allDeals = [];
  let after = undefined;
  const props = DEAL_PROPERTIES.join(',');
  while (true) {
    let url = `${HUBSPOT_BASE}/crm/v3/objects/deals?limit=100&properties=${props}`;
    if (after) url += `&after=${after}`;
    const data = await hubspotFetch(url);
    const pipelineDeals = data.results.filter(d => d.properties.pipeline === PIPELINE_ID);
    allDeals.push(...pipelineDeals);
    if (data.paging && data.paging.next && data.paging.next.after) {
      after = data.paging.next.after;
    } else {
      break;
    }
  }
  return allDeals;
}

async function fetchPipeline() {
  return hubspotFetch(`${HUBSPOT_BASE}/crm/v3/pipelines/deals/${PIPELINE_ID}`);
}

async function getData() {
  const now = Date.now();
  if (cache.deals && cache.pipeline && (now - cache.timestamp) < CACHE_TTL) {
    return { deals: cache.deals, pipeline: cache.pipeline };
  }
  const [deals, pipeline] = await Promise.all([fetchAllDeals(), fetchPipeline()]);
  cache = { deals, pipeline, timestamp: now };
  return { deals, pipeline };
}

// Ideas storage — shared with owner dashboard
const IDEAS_FILE = path.join(__dirname, '..', 'dashboard', 'ideas.json');

function loadIdeas() {
  try {
    return JSON.parse(require('fs').readFileSync(IDEAS_FILE, 'utf8'));
  } catch { return []; }
}

function saveIdeas(data) {
  require('fs').writeFileSync(IDEAS_FILE, JSON.stringify(data, null, 2));
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// API: deals (read-only, no financial data)
app.get('/api/deals', async (req, res) => {
  try {
    const { deals } = await getData();
    // Strip financial data for employees
    const safe = deals.map(d => ({
      id: d.id,
      properties: {
        dealname: d.properties.dealname,
        product_categorie: d.properties.product_categorie,
        dealstage: d.properties.dealstage,
        createdate: d.properties.createdate,
        closedate: d.properties.closedate,
        hs_is_closed_won: d.properties.hs_is_closed_won,
        hs_is_closed_lost: d.properties.hs_is_closed_lost,
        aantal_belpogingen: d.properties.aantal_belpogingen,
        laatste_belpoging: d.properties.laatste_belpoging,
        nurture_fase: d.properties.nurture_fase,
        afspraak_type: d.properties.afspraak_type
      }
    }));
    res.json({ deals: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pipeline', async (req, res) => {
  try {
    const { pipeline } = await getData();
    res.json(pipeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: submit idea (goes to owner dashboard)
app.post('/api/ideas', (req, res) => {
  const { title, description, author, role } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const data = loadIdeas();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  data.push({
    id,
    title,
    description: description || '',
    author: author || 'Medewerker',
    priority: 'normaal',
    status: 'idee',
    source: role || 'portal',
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  });
  saveIdeas(data);
  res.json({ ok: true });
});

app.get('/api/roles', (req, res) => {
  res.json(ROLES);
});

// Editable guides storage
const GUIDES_FILE = path.join(__dirname, 'guides.json');

function loadGuides() {
  try {
    return JSON.parse(require('fs').readFileSync(GUIDES_FILE, 'utf8'));
  } catch { return getDefaultGuides(); }
}

function saveGuides(data) {
  require('fs').writeFileSync(GUIDES_FILE, JSON.stringify(data, null, 2));
}

function getDefaultGuides() {
  return {
    sales: {
      title: 'Sales Handleiding',
      intro: 'Jouw taak: van Nieuwe Lead tot Offerte Akkoord. Zodra de klant akkoord is, ben jij klaar — de rest neemt het over.',
      sections: [
        {
          title: 'Nieuwe lead oppakken',
          steps: [
            { action: 'Open HubSpot', detail: 'Ga naar app.hubspot.com en log in met je Sonty account.', link: 'https://app.hubspot.com', linkLabel: 'Open HubSpot' },
            { action: 'Ga naar Deals', detail: 'Klik links in het menu op "Sales" > "Deals". Je ziet nu de Sonty pipeline.' },
            { action: 'Zoek nieuwe leads', detail: 'Filter op de kolom "Nieuwe Lead". Dit zijn leads die nog niet gebeld zijn. Pak de oudste eerst op.' },
            { action: 'Open de deal', detail: 'Klik op de naam van de deal. Je ziet nu alle gegevens: naam, telefoon, email, product, en prijsindicatie.' },
            { action: 'Bel de klant', detail: 'Bel het telefoonnummer. Stel jezelf voor: "Goedemorgen, u spreekt met [naam] van Sonty. U heeft een aanvraag gedaan voor [product]."' },
            { action: 'Klant bereikt? Verplaats de deal', detail: 'Sleep de deal naar "In Contact". Noteer wat je hebt besproken als notitie bij de deal.' },
            { action: 'Geen gehoor?', detail: 'Het systeem houdt belpogingen bij. Je hoeft max. 6 keer te bellen. Na 6x zonder contact gaat de lead automatisch naar nurture.' }
          ]
        },
        {
          title: 'Opvolging en deal doorschuiven',
          steps: [
            { action: 'Klant wil een opmeting', detail: 'Verplaats de deal naar "Inmeetafspraak Inplannen" in HubSpot. De planning-afdeling pakt het vanaf hier op — jij hoeft niks in Planado te doen.' },
            { action: 'Offerte bespreken', detail: 'Na de inmeting krijgt de klant een definitieve offerte. Bel de klant 1-2 dagen later om de offerte te bespreken en vragen te beantwoorden.' },
            { action: 'Deal sluiten', detail: 'Klant akkoord? Verplaats de deal naar "Akkoord". Klant twijfelt? Gebruik de showroom-uitnodiging (zie hieronder).' },
            { action: '✅ Jij bent klaar!', detail: 'Zodra de deal op "Akkoord" staat, neemt de rest het over (bestelling, planning, installatie). Jij hoeft niks meer te doen voor deze klant.' },
            { action: 'Klant verloren?', detail: 'Vraag altijd waarom. Noteer de reden bij de deal. Verplaats naar "Verloren" met een duidelijke notitie. Dit helpt ons verbeteren.' }
          ]
        },
        {
          title: 'Showroom uitnodigen (10x hogere conversie!)',
          steps: [
            { action: 'Nodig twijfelaars uit', detail: 'Klanten die de showroom bezoeken converteren bijna 10x vaker. Dit is je sterkste wapen bij twijfel.' },
            { action: 'Wat zeg je?', detail: '"Weet je wat, kom gerust een keer langs in onze showroom in Rijswijk. Dan kun je de materialen zien en voelen. Helemaal vrijblijvend."' },
            { action: 'Adres', detail: 'Frijdastraat 8F, 2288 EX Rijswijk. Openingstijden: ma-vr 09:00-17:00.' }
          ]
        },
        {
          title: 'Prijsbezwaar afhandelen',
          steps: [
            { action: 'Luister eerst', detail: 'Laat de klant uitpraten. Vraag: "Wat heeft u van andere partijen gehoord?" Zo weet je waarmee je concurreert.' },
            { action: 'Leg de kwaliteit uit', detail: 'Wij gebruiken A-merk producten (Sunmaster). Eigen gecertificeerde monteurs. Garantie op product EN installatie. 4.9/5.0 op Google met 500+ reviews.' },
            { action: 'Nooit zelf korting geven', detail: 'Overleg ALTIJD eerst met de eigenaar voordat je iets over korting zegt. Zeg: "Ik ga kijken wat ik voor u kan doen en bel u terug."' },
            { action: 'Showroom als troef', detail: 'Bij prijstwijfel: nodig uit voor de showroom. "Kom kijken, voel het verschil. Dan begrijpt u waarom onze klanten voor ons kiezen."' }
          ]
        }
      ]
    },
    planning: {
      title: 'Planning Handleiding',
      intro: 'Jouw taak: afspraken inplannen in Planado. Zodra de inmeting of installatie gepland staat, ben jij klaar.',
      sections: [
        {
          title: 'Planado openen en navigeren',
          steps: [
            { action: 'Open Planado', detail: 'Ga naar sonty.planadoapp.com en log in.', link: 'https://sonty.planadoapp.com', linkLabel: 'Open Planado' },
            { action: 'Overzicht bekijken', detail: 'Je ziet het weekoverzicht met alle geplande afspraken. Gebruik de kalender links om van week te wisselen.' },
            { action: 'Typen opdrachten', detail: 'Er zijn 2 typen: Inmeting (30-45 min) en Installatie (2-8 uur afhankelijk van product). Let op het verschil bij het inplannen.' }
          ]
        },
        {
          title: 'Inmeting inplannen',
          steps: [
            { action: 'Check HubSpot', detail: 'Kijk in HubSpot welke deals op "Inmeetafspraak Inplannen" staan. Dit zijn de klanten die een opmeting nodig hebben.', link: 'https://app.hubspot.com', linkLabel: 'Open HubSpot' },
            { action: 'Maak nieuwe opdracht in Planado', detail: 'Klik op "+ Nieuwe opdracht". Selecteer type "Inmeting". Vul klantgegevens in (naam, adres, telefoon).' },
            { action: 'Kies de juiste inmeter', detail: 'Wijs de opdracht toe aan een beschikbare inmeter. Check de agenda: geen 2 inmetingen direct na elkaar plannen (reistijd!).' },
            { action: 'Plan het tijdslot', detail: 'Kies datum en tijd. Ochtend (09:00-12:00) of middag (13:00-17:00). Houd 1 uur per inmeting aan inclusief reistijd.' },
            { action: 'Update HubSpot', detail: 'Verplaats de deal in HubSpot naar "Inmeetafspraak Gepland". De klant krijgt automatisch een bevestiging.' }
          ]
        },
        {
          title: 'Installatie inplannen',
          steps: [
            { action: 'Wacht op bevestiging', detail: 'Installaties worden pas gepland NA bestelling en levering van materialen. Check of de deal op "Installatie Inplannen" staat.' },
            { action: 'Kies de juiste monteur(s)', detail: 'Niet elke monteur kan elk product. Check specialisaties. Grote installaties (pergola, meerdere screens) vereisen 2 monteurs.' },
            { action: 'Tijdsinschatting per product', detail: 'Screens: 2-4 uur. Knikarmscherm: 3-5 uur. Uitvalscherm: 2-3 uur. Rolluiken: 3-6 uur/raam. Pergola: hele dag. Raamdeco: 1-2 uur.' },
            { action: 'Plan de installatie', detail: 'Maak de opdracht in Planado met type "Installatie". Vul alle details in: product, aantal, bijzonderheden.' },
            { action: 'Update HubSpot', detail: 'Verplaats de deal naar "Installatie Gepland". Klant krijgt automatisch een bevestiging met datum.' }
          ]
        },
        {
          title: 'Herplannen',
          steps: [
            { action: 'Klant wil verplaatsen', detail: 'Pas de afspraak aan in Planado. Kies een nieuw tijdslot.' },
            { action: 'Informeer de klant', detail: 'Bel de klant om het nieuwe tijdstip te bevestigen. Stuur ook een WhatsApp via Trengo als bevestiging.' },
            { action: 'Informeer de monteur/inmeter', detail: 'Check of de monteur/inmeter de update ziet in de Planado app. Eventueel even bellen of appen.' }
          ]
        }
      ]
    },
    monteurs: {
      title: 'Monteurs & Inmeters Handleiding',
      intro: 'Jouw taak: opdracht uitvoeren bij de klant. Zodra de inmeting of installatie is afgerond in Planado, ben jij klaar.',
      sections: [
        {
          title: 'Voorbereiding (voor vertrek)',
          steps: [
            { action: 'Check je opdrachten', detail: 'Open de Planado app op je telefoon. Je ziet je opdrachten voor vandaag met alle details: adres, klantnaam, product, bijzonderheden.' },
            { action: 'Controleer materiaal (inmeting)', detail: 'Neem mee: meetlint, laser afstandsmeter, notitieboek of tablet, telefoon voor foto\'s.' },
            { action: 'Controleer materiaal (installatie)', detail: 'Check of alle bestelde materialen compleet en onbeschadigd zijn VOORDAT je vertrekt. Mis je iets? Meld het direct bij planning.' },
            { action: 'Route plannen', detail: 'Check het adres in Planado. Plan je route zodat je op tijd bent. Liever 5 minuten te vroeg dan te laat.' }
          ]
        },
        {
          title: 'Bij de klant (inmeting)',
          steps: [
            { action: 'Aankomst', detail: 'Bel aan, stel je voor: "Goedemorgen, ik ben [naam] van Sonty. Ik kom voor de opmeting van uw [product]."' },
            { action: 'Situatie bekijken', detail: 'Bekijk de plek waar het product moet komen. Let op: ondergrond, bevestigingsmogelijkheden, kabels/leidingen, bereikbaarheid.' },
            { action: 'Meten', detail: 'Meet nauwkeurig op. Controleer elke meting twee keer. Noteer alles direct in je notitieboek of tablet.' },
            { action: 'Foto\'s maken', detail: 'Maak foto\'s van: de situatie (breed), de bevestigingsplek (detail), eventuele obstakels. Minimaal 3 foto\'s per locatie.' },
            { action: 'Afronden', detail: 'Leg aan de klant uit wat de volgende stap is: "U ontvangt een definitieve offerte op basis van deze meting."' },
            { action: 'Opdracht afronden in Planado', detail: 'Markeer de opdracht als afgerond in de Planado app. Upload je foto\'s en metingen.' }
          ]
        },
        {
          title: 'Bij de klant (installatie)',
          steps: [
            { action: 'Aankomst', detail: 'Stel je voor en leg uit wat je gaat doen en hoe lang het ongeveer duurt. Vraag waar je gereedschap neer kunt zetten.' },
            { action: 'Werkplek voorbereiden', detail: 'Leg een beschermdoek neer als je binnen werkt. Bescherm meubels en vloeren. Dit is het visitekaartje van Sonty!' },
            { action: 'Installeren', detail: 'Volg de installatiehandleiding van het product. Bij twijfel: bel het kantoor (085 006 9681). Nooit gokken.' },
            { action: 'Kwaliteitscheck', detail: 'Test de werking van het product. Controleer: soepel open/dicht, recht gemonteerd, geen beschadigingen, alles netjes afgewerkt.' },
            { action: 'Uitleg aan klant', detail: 'Loop het product door met de klant. Laat zien hoe het werkt. Geef tips voor onderhoud. Overhandig eventuele handleidingen.' },
            { action: 'Opruimen', detail: 'Ruim al je materiaal op. Laat de werkplek schoner achter dan je hem aantrof. Neem al het afval mee.' },
            { action: 'Foto eindresultaat', detail: 'Maak een foto van het eindresultaat. Dit gebruiken we voor onze portfolio en social media (met toestemming klant).' },
            { action: 'Afronden in Planado', detail: 'Markeer de installatie als afgerond in de Planado app. Upload de foto van het eindresultaat.' }
          ]
        },
        {
          title: 'Problemen of onverwachte situaties',
          steps: [
            { action: 'Klant niet thuis', detail: 'Bel de klant. Wacht max. 15 minuten. Bel daarna het kantoor (085 006 9681). Zij regelen een nieuwe afspraak.' },
            { action: 'Materiaal niet correct', detail: 'STOP de installatie. Bel het kantoor direct. Maak foto\'s van het probleem. Doe GEEN beloftes aan de klant over vergoeding of oplossing.' },
            { action: 'Schade veroorzaakt', detail: 'Wees eerlijk tegen de klant. Bel direct het kantoor. Maak foto\'s. Het kantoor regelt de afhandeling. Nooit zelf geld of korting aanbieden.' },
            { action: 'Klant vraagt om extra werk', detail: 'Zeg: "Dat kan ik helaas niet ter plekke beslissen. Ik laat het kantoor contact met u opnemen voor een offerte." Noteer het verzoek.' }
          ]
        }
      ]
    },
    klantenservice: {
      title: 'Klantenservice Handleiding',
      intro: 'Jouw taak: klanten helpen via telefoon, email en WhatsApp. Jij beantwoordt vragen, handelt klachten af en maakt reparatie-deals aan.',
      sections: [
        {
          title: 'Klant opzoeken',
          steps: [
            { action: 'Open HubSpot', detail: 'Ga naar app.hubspot.com > Contacten. Zoek op naam, email of telefoonnummer.', link: 'https://app.hubspot.com', linkLabel: 'Open HubSpot' },
            { action: 'Deal bekijken', detail: 'Klik door naar de bijbehorende deal. Hier zie je: product, fase, notities van collega\'s, en de hele geschiedenis.' },
            { action: 'Status uitleggen', detail: 'Kijk in welke fase de deal staat. Leg aan de klant uit wat de volgende stap is en wanneer ze iets kunnen verwachten.' }
          ]
        },
        {
          title: 'WhatsApp beantwoorden (Trengo)',
          steps: [
            { action: 'Open Trengo', detail: 'Ga naar Trengo. Hier komen alle WhatsApp berichten binnen. Beantwoord berichten binnen 1 uur tijdens kantooruren.' },
            { action: 'Toon en stijl', detail: 'Begin altijd met de naam van de klant. Wees vriendelijk en persoonlijk. Gebruik "je/jij", niet "u". Voorbeeld: "Hoi Jan, bedankt voor je bericht!"' },
            { action: 'Veelvoorkomende vragen', detail: 'Status bestelling: check HubSpot. Wijziging afspraak: verwijs door naar planning. Klacht: noteer en informeer eigenaar.' },
            { action: 'Noteer in HubSpot', detail: 'Na elk klantcontact: maak een notitie bij de deal in HubSpot. Zo weten collega\'s wat er besproken is.' }
          ]
        },
        {
          title: 'Klacht afhandelen',
          steps: [
            { action: 'Luister en noteer', detail: 'Laat de klant uitpraten. Schrijf de klacht op. Zeg: "Ik begrijp dat dit vervelend is. Ik ga dit direct voor u uitzoeken."' },
            { action: 'Noteer in HubSpot', detail: 'Maak een notitie bij de deal met de klacht en wat de klant verwacht als oplossing.' },
            { action: 'Informeer de eigenaar', detail: 'Bij urgente klachten: stuur direct een idee/melding in via dit portaal. Bij minder urgente klachten: vermeld het in je dagelijkse terugkoppeling.' },
            { action: 'Doe GEEN toezeggingen', detail: 'Zeg nooit: "U krijgt korting" of "Wij vergoeden dat". Zeg: "Ik bespreek dit intern en we nemen zo snel mogelijk contact met u op."' }
          ]
        },
        {
          title: 'Service of reparatie aanvraag',
          steps: [
            { action: 'Nieuwe deal aanmaken', detail: 'Maak in HubSpot een nieuwe deal aan. Kies product_categorie = "Reparatie". Vul de klantgegevens in.' },
            { action: 'Probleem beschrijven', detail: 'Noteer precies wat het probleem is: welk product, wanneer geinstalleerd, wat werkt niet, zijn er foto\'s?' },
            { action: 'Planning informeren', detail: 'Zodra de deal is aangemaakt met "Reparatie", ziet planning dit en plant een service-afspraak in.' }
          ]
        }
      ]
    }
  };
}

app.get('/api/guides', (req, res) => {
  res.json(loadGuides());
});

app.get('/api/guides/:role', (req, res) => {
  const guides = loadGuides();
  const role = req.params.role;
  if (!guides[role]) return res.status(404).json({ error: 'Rol niet gevonden' });
  res.json(guides[role]);
});

// Owner can update guides
app.put('/api/guides/:role', (req, res) => {
  const guides = loadGuides();
  const role = req.params.role;
  if (!ROLES[role]) return res.status(400).json({ error: 'Ongeldige rol' });
  guides[role] = req.body;
  saveGuides(guides);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Sonty Medewerker Portaal draait op http://localhost:${PORT}`);
});

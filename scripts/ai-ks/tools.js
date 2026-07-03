// Tools voor de AI-klantenservice agent.
// In shadow-modus voeren actie-tools NIETS uit — ze geven terug wat ze ZOUDEN doen,
// zodat het voorstel in de interne notitie belandt en beoordeeld kan worden.
const CFG = require('./config.js');
const { prijsIndicatie } = require('./v4-pricing.js');
const { buildKlantContext } = require('./klant-context.js');

const TOOL_DEFS = [
  {
    name: 'prijs_berekenen',
    description: 'Bereken de actuele Sonty verkoopprijs (incl. BTW en montage) voor een zonwering-product. Gebruik dit ALTIJD voordat je een prijs noemt — nooit prijzen uit je hoofd. Werkt voor: knikarmschermen (SunEye/SunEye XL/SunBasic/SunElite), screens (Zip Design 110/Zip Square), rolluiken (S-37/S-42), uitvalschermen (SunCube/SunProject), serre zonwering (SunControl), pergola.',
    input_schema: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Productnaam, bv "zip design 110", "suneye knikarmscherm", "rolluik s-42"' },
        breedteMM: { type: 'integer', description: 'Breedte in millimeters' },
        hoogteMM: { type: 'integer', description: 'Hoogte in mm (screens/rolluiken)' },
        uitvalMM: { type: 'integer', description: 'Uitval in mm (knikarm/uitvalscherm/serre/pergola)' },
        bediening: { type: 'string', enum: ['io', 'solar', 'solarBrel', 'draaischakelaar', 'handbediend'], description: 'io = Somfy motor + afstandsbediening (standaard)' },
      },
      required: ['product', 'breedteMM'],
    },
  },
  {
    name: 'klant_opzoeken',
    description: 'Zoek de klant op in Reuzenpanda (offertes + pipeline-status) en HubSpot (contact + deals) op basis van e-mail of telefoonnummer. Doe dit aan het begin van elk gesprek zodat je weet wie je spreekt en welke offertes er lopen.',
    input_schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        phone: { type: 'string' },
      },
    },
  },
  {
    name: 'offerte_aanpassen',
    description: 'Pas een bestaande offerte aan of maak een nieuwe offerte-variant (bv. andere maat, andere bediening, product erbij/eraf, ander model). Beschrijf de gewenste wijziging exact. De wijziging wordt doorgevoerd in Reuzenpanda en de klant krijgt een nieuwe offerte-link.',
    input_schema: {
      type: 'object',
      properties: {
        offerteNummer: { type: 'string', description: 'Bestaand offertenummer (bv. 20266838)' },
        documentId: { type: 'string', description: 'RP documentId (UUID) als bekend uit klant_opzoeken' },
        wijziging: { type: 'string', description: 'Exacte beschrijving van de gewenste aanpassing, incl. nieuwe maten/bediening/kleur en de nieuwe prijs per regel (eerst prijs_berekenen gebruiken!)' },
      },
      required: ['wijziging'],
    },
  },
  {
    name: 'inmeet_afspraak_voorstellen',
    description: 'Zet een inmeetafspraak in gang voor deze klant. Gebruik dit zodra de klant interesse toont — dit is het HOOFDDOEL van elk gesprek. De planning neemt daarna contact op om een datum te prikken (of stuur de boekingslink mee).',
    input_schema: {
      type: 'object',
      properties: {
        klantNaam: { type: 'string' },
        adres: { type: 'string', description: 'Adres of woonplaats indien bekend' },
        product: { type: 'string', description: 'Waar gaat het om' },
        notitie: { type: 'string', description: 'Context voor de planner (voorkeursdagen, bijzonderheden)' },
      },
      required: ['klantNaam', 'product'],
    },
  },
  {
    name: 'escaleren_naar_mens',
    description: 'Draag het gesprek over aan een medewerker. Gebruik dit bij: boze/ontevreden klanten, klachten over uitgevoerd werk, complexe technische situaties die je niet zeker weet, kortingsonderhandeling boven je mandaat, juridische dreigingen, of als de klant expliciet om een mens vraagt.',
    input_schema: {
      type: 'object',
      properties: {
        reden: { type: 'string' },
        urgentie: { type: 'string', enum: ['laag', 'normaal', 'hoog'] },
      },
      required: ['reden'],
    },
  },
];

// ── Uitvoering ──
async function runTool(name, input, ctx) {
  if (name === 'prijs_berekenen') {
    return JSON.stringify(prijsIndicatie(input));
  }
  if (name === 'klant_opzoeken') {
    const res = await buildKlantContext(input);
    return JSON.stringify(res).substring(0, 6000);
  }
  if (name === 'offerte_aanpassen') {
    if (CFG.MODE !== 'live') {
      ctx.acties.push({ type: 'offerte_aanpassen', ...input });
      return JSON.stringify({ status: 'VOORGESTELD (schaduwmodus — niet uitgevoerd)', beschrijving: input.wijziging, opmerking: 'In live-modus wordt dit in Reuzenpanda doorgevoerd. Vertel de klant dat de aangepaste offerte er zo snel mogelijk aankomt.' });
    }
    // LIVE: nog niet geïmplementeerd — bewust. Wordt gebouwd + getest vóór activatie.
    ctx.acties.push({ type: 'offerte_aanpassen', ...input, LIVE_NIET_GEIMPLEMENTEERD: true });
    return JSON.stringify({ status: 'FOUT', opmerking: 'Live offerte-aanpassing is nog niet vrijgegeven. Escaleer naar een medewerker.' });
  }
  if (name === 'inmeet_afspraak_voorstellen') {
    ctx.acties.push({ type: 'inmeet_afspraak', ...input });
    if (CFG.MODE !== 'live') {
      return JSON.stringify({ status: 'VOORGESTELD (schaduwmodus — niet uitgevoerd)', opmerking: 'In live-modus wordt een taak voor de planning aangemaakt. Deel eventueel de boekingslink met de klant: ' + CFG.BOOKINGS_URL });
    }
    return JSON.stringify({ status: 'FOUT', opmerking: 'Live inplannen is nog niet vrijgegeven. Deel de boekingslink: ' + CFG.BOOKINGS_URL });
  }
  if (name === 'escaleren_naar_mens') {
    ctx.acties.push({ type: 'escalatie', ...input });
    return JSON.stringify({ status: 'GENOTEERD', opmerking: 'Medewerker wordt geïnformeerd. Vertel de klant dat een collega er persoonlijk op terugkomt.' });
  }
  return JSON.stringify({ error: 'Onbekende tool' });
}

module.exports = { TOOL_DEFS, runTool };

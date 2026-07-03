// Tools voor de AI-klantenservice agent.
// In shadow-modus voeren actie-tools NIETS uit — ze geven terug wat ze ZOUDEN doen,
// zodat het voorstel in de interne notitie belandt en beoordeeld kan worden.
const CFG = require('./config.js');
const { prijsIndicatie } = require('./v4-pricing.js');
const { buildKlantContext, getOfferteInhoud } = require('./klant-context.js');

const TOOL_DEFS = [
  {
    name: 'prijs_berekenen',
    description: 'Bereken de actuele Sonty verkoopprijs (incl. BTW en montage) voor een zonwering-product. Gebruik dit ALTIJD voordat je een prijs noemt — nooit prijzen uit je hoofd. Werkt voor: knikarmschermen (SunEye/SunEye XL/SunElite/SunBasic open cassette/SunBasic dichte cassette — let op: "SunBasic open" is de goedkopere open-arm variant, "SunBasic dichte cassette" de gesloten), screens (Zip Design 110/Zip Square), rolluiken (S-37/S-42), uitvalschermen (SunCube/SunProject), serre zonwering (SunControl), pergola.',
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
    name: 'offerte_bekijken',
    description: 'Haal de volledige inhoud (alle prijsregels: producten, opties, accessoires, montage) van een bestaande offerte op. Gebruik dit ALTIJD voordat je een lopende offerte bespreekt, iets adviseert of een aanpassing voorstelt — zodat je weet wat er al in zit (bv. of er al een windsensor of Tahoma in staat) en niets dubbel aanbiedt. Het documentId vind je via klant_opzoeken.',
    input_schema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'RP documentId (UUID) uit klant_opzoeken' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'offerte_aanpassen',
    description: 'Pas een bestaande offerte ECHT aan in Reuzenpanda: regels verwijderen, producten toevoegen (met automatische montageregel) of aantallen wijzigen. Gebruik EERST offerte_bekijken zodat je de exacte regeltitels kent. Wil je een product vervangen (ander model/maat/bediening): verwijder de oude regel(s) én de bijbehorende montageregel, en voeg het nieuwe product toe. Prijzen worden automatisch correct berekend. Na afloop krijg je de nieuwe regels + link terug; noem die link aan de klant.',
    input_schema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'RP documentId (UUID) uit klant_opzoeken' },
        verwijderen: { type: 'array', items: { type: 'string' }, description: 'Regeltitels (of uniek deel ervan) die verwijderd moeten worden, bv ["Suneye", "Inmeten + montage Knikarmscherm"]. Vergeet de montageregel van een verwijderd product niet!' },
        toevoegen: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              product: { type: 'string', description: 'bv "sunbasic open cassette", "zip design 110", "rolluik s-42"' },
              breedteMM: { type: 'integer' },
              hoogteMM: { type: 'integer' },
              uitvalMM: { type: 'integer' },
              bediening: { type: 'string', enum: ['io', 'solar', 'solarBrel', 'draaischakelaar', 'handbediend'] },
              aantal: { type: 'integer' },
            },
            required: ['product', 'breedteMM'],
          },
          description: 'Nieuwe productregels; montageregel wordt automatisch toegevoegd',
        },
        aantalWijzigen: { type: 'array', items: { type: 'object', properties: { product: { type: 'string' }, aantal: { type: 'integer' } }, required: ['product', 'aantal'] } },
        samenvatting: { type: 'string', description: 'Korte omschrijving van de wijziging voor het logboek' },
      },
      required: ['documentId', 'samenvatting'],
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
    description: 'Draag het gesprek over aan een medewerker. Gebruik dit bij: boze/ontevreden klanten, klachten over uitgevoerd werk, complexe technische situaties die je niet zeker weet, kortingsonderhandeling boven je mandaat, juridische dreigingen, of als de klant expliciet om een mens vraagt. Zet stil=true als je het antwoord simpelweg niet weet: dan stuur je de klant NIETS en blijft het gesprek open staan voor een collega (schrijf dan ook geen antwoordtekst meer).',
    input_schema: {
      type: 'object',
      properties: {
        reden: { type: 'string' },
        urgentie: { type: 'string', enum: ['laag', 'normaal', 'hoog'] },
        stil: { type: 'boolean', description: 'true = klant krijgt géén bericht; gesprek blijft open voor een collega' },
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
  if (name === 'offerte_bekijken') {
    const res = await getOfferteInhoud(input.documentId);
    return JSON.stringify(res).substring(0, 6000);
  }
  if (name === 'offerte_aanpassen') {
    ctx.acties.push({ type: 'offerte_aanpassen', ...input });
    if (CFG.MODE === 'live' || ctx.liveTest) {
      // ECHT doorvoeren (live-modus, of live-test op whitelist-nummer)
      const { pasOfferteAan } = require('./rp-offerte-edit.js');
      const res = await pasOfferteAan(input);
      if (res.error) return JSON.stringify({ status: 'MISLUKT', fout: res.error, opmerking: 'Zeg tegen de klant dat een collega de aanpassing zo snel mogelijk verwerkt. Roep ook escaleren_naar_mens aan.' });
      return JSON.stringify({ status: 'DOORGEVOERD', ...res, opmerking: 'De offerte is nu echt aangepast. Deel de link met de klant en noem het nieuwe totaal.' });
    }
    // Schaduwmodus: alleen voorstel. BELANGRIJK: beloof de klant NIET dat er al iets is aangepast of verstuurd.
    return JSON.stringify({ status: 'VOORGESTELD (schaduwmodus — NIET uitgevoerd)', opmerking: 'Er is nog NIETS aangepast. Zeg tegen de klant dat je de aanpassing hebt klaargezet en dat de nieuwe offerte zo snel mogelijk volgt via een collega. Beloof geen directe link.' });
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
    if (input.stil) {
      ctx.stil = true;
      return JSON.stringify({ status: 'GENOTEERD (stil)', opmerking: 'Het gesprek blijft open staan; een collega antwoordt. Stuur de klant NIETS: geef als eindantwoord uitsluitend de tekst [STIL].' });
    }
    return JSON.stringify({ status: 'GENOTEERD', opmerking: 'Medewerker wordt geïnformeerd. Vertel de klant dat een collega er persoonlijk op terugkomt.' });
  }
  return JSON.stringify({ error: 'Onbekende tool' });
}

module.exports = { TOOL_DEFS, runTool };

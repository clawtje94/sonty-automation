// Tools voor de AI-klantenservice agent.
// In shadow-modus voeren actie-tools NIETS uit — ze geven terug wat ze ZOUDEN doen,
// zodat het voorstel in de interne notitie belandt en beoordeeld kan worden.
const CFG = require('./config.js');
const { prijsIndicatie } = require('./v4-pricing.js');
const { buildKlantContext, getOfferteInhoud } = require('./klant-context.js');

const TOOL_DEFS = [
  {
    name: 'prijs_berekenen',
    description: 'Bereken de actuele Sonty verkoopprijs (incl. BTW en montage) voor een product. Gebruik dit ALTIJD voordat je een prijs noemt — nooit prijzen uit je hoofd. Werkt voor: knikarmschermen (SunEye/SunEye XL/SunElite/SunBasic open cassette/SunBasic dichte cassette — "SunBasic open" is de goedkopere open-arm variant), screens (Zip Design 110/Zip Square), rolluiken (S-37/S-42), uitvalschermen (SunCube/SunProject), serre zonwering (SunControl), pergola, MARKIEZEN (geef materiaal mee: grenen/hardhout/aluminium) en HORREN van Unilux (geef het type in product: raamrolhor comfort/super+, voorzethor/inklemhor/veerstifthor, raamplissé voorzet/inklem/dubbel, plisséfit hordeur (enkel, voor openslaande deuren) of plisséfit dubbel (dubbele deuren/schuifpui), vaste of schuifhordeur luxe).',
    input_schema: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Productnaam, bv "zip design 110", "suneye knikarmscherm", "markies aluminium", "plissefit dubbel hordeur"' },
        breedteMM: { type: 'integer', description: 'Breedte in millimeters' },
        hoogteMM: { type: 'integer', description: 'Hoogte in mm (screens/rolluiken/horren)' },
        uitvalMM: { type: 'integer', description: 'Uitval in mm (knikarm/uitvalscherm/serre/pergola/markies)' },
        bediening: { type: 'string', enum: ['io', 'solar', 'solarBrel', 'draaischakelaar', 'handbediend'], description: 'io = Somfy motor + afstandsbediening (standaard); markies standaard = handbediend (koord)' },
        materiaal: { type: 'string', description: 'Alleen voor markiezen: grenen, hardhout of aluminium' },
        framekleur: { type: 'string', description: 'VERPLICHT uit te vragen bij zonwering (beïnvloedt de prijs): standaardkleuren gratis, andere RAL heeft meerprijs. Zonder deze parameter krijg je de gratis standaardkleuren terug om aan de klant voor te leggen.' },
      },
      required: ['product', 'breedteMM'],
    },
  },
  {
    name: 'klant_opzoeken',
    description: 'Zoek de klant op in Reuzenpanda (offertes + pipeline-status + itemId) en HubSpot (contact + deals). Doe dit aan het begin van elk gesprek. Zoek GERICHT met alles wat je weet: telefoonnummer en e-mail uit het gesprek, plus naam en adres als de klant die noemt — nooit lukraak (instructie Daimy).',
    input_schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        phone: { type: 'string' },
        naam: { type: 'string', description: 'Volledige naam als bekend' },
        adres: { type: 'string', description: 'Straat/postcode/plaats als bekend' },
      },
    },
  },
  {
    name: 'offerte_aanmaken',
    description: 'Maak een NIEUWE offerte aan in Reuzenpanda (nieuwe lead + contact + offerte + pipeline-item). Gebruik dit als de klant om een nieuwe offerte vraagt of nog geen offerte heeft — NIET een bestaande offerte volproppen. Reuzenpanda verwerkt dit in ±5 minuten; daarna wordt de offerte automatisch gevuld met de opgegeven producten en krijgt de klant de link vanzelf geappt. Zeg dus: "ik maak hem nu voor je in orde, je ontvangt de offerte-link over een paar minuten hier op WhatsApp". Zorg dat producten COMPLEET zijn (maten, bediening, framekleur, materiaal bij markiezen) vóór je dit aanroept.',
    input_schema: {
      type: 'object',
      properties: {
        naam: { type: 'string' },
        telefoon: { type: 'string' },
        email: { type: 'string' },
        plaats: { type: 'string' },
        postcode: { type: 'string' },
        straat: { type: 'string', description: 'Straat + huisnummer' },
        producten: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              product: { type: 'string' },
              breedteMM: { type: 'integer' },
              hoogteMM: { type: 'integer' },
              uitvalMM: { type: 'integer' },
              bediening: { type: 'string', enum: ['io', 'solar', 'solarBrel', 'draaischakelaar', 'handbediend'] },
              framekleur: { type: 'string' },
              materiaal: { type: 'string' },
              aantal: { type: 'integer' },
            },
            required: ['product', 'breedteMM'],
          },
        },
      },
      required: ['naam', 'telefoon', 'email', 'straat', 'postcode', 'plaats', 'producten'],
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
        itemId: { type: 'string', description: 'RP item-id uit klant_opzoeken — nodig om de status na versturen op "Ai offerte verstuurd" te zetten' },
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
              framekleur: { type: 'string', description: 'Verplicht uitgevraagd bij de klant (beïnvloedt de prijs)' },
              materiaal: { type: 'string', description: 'Alleen markiezen: grenen/hardhout/aluminium' },
              aantal: { type: 'integer' },
            },
            required: ['product', 'breedteMM'],
          },
          description: 'Nieuwe productregels; montageregel wordt automatisch toegevoegd',
        },
        aantalWijzigen: { type: 'array', items: { type: 'object', properties: { product: { type: 'string' }, aantal: { type: 'integer' } }, required: ['product', 'aantal'] } },
        sonnyKorting: { type: 'object', properties: { percentage: { type: 'number', description: 'Nieuw TOTAALPERCENTAGE van de kortingsregel, maximaal 17.5 (= standaard 15 + jouw mandaat van max 2,5). De kortingsregel op de offerte wordt dan bv. "17,5% kortingsaanbod Sonny".' }, gratis: { type: 'string', enum: ['tahoma', 'montage'], description: 'ALLEEN bij grote orders (±5-10 producten) en in PLAATS van de percentage-verhoging: gratis Tahoma of 1x montage gratis. Komt als €0-regel op de offerte, en de 15%-kortingsregel vermeldt het cadeau met "Sonny" erbij.' } }, description: 'Jouw onderhandelmandaat, altijd zichtbaar op de offerte zelf. Kies percentage ÓF gratis, nooit beide, nooit stapelen. Doel is altijd ZO MIN MOGELIJK korting geven: probeer eerst zonder, en geef nooit meer dan nodig om de deal te sluiten.' },
        vastePosten: { type: 'array', items: { type: 'object', properties: { soort: { type: 'string', enum: ['hoogwerker', 'demontage_oud_product', 'verlengde_muursteunen', 'led_verlichting_sunelite'] }, aantal: { type: 'integer' } }, required: ['soort'] }, description: 'Vaste posten toevoegen: hoogwerker €650/dag (boven 2e verdieping), demontage+afvoer oud product €75/stuk, verlengde muursteunen €150, LED-verlichting SunElite €823,90 (kleur en wit, 2 kanalen — alleen bij SunElite)' },
        samenvatting: { type: 'string', description: 'Korte omschrijving van de wijziging voor het logboek' },
      },
      required: ['documentId', 'samenvatting'],
    },
  },
  {
    name: 'inmeet_afspraak_voorstellen',
    description: 'Zet het inmeet-traject in gang zodra de klant akkoord geeft: het Reuzenpanda-item wordt verplaatst naar de kolom "Inmeten inplannen", waarna de planning binnen 3 werkdagen contact opneemt om de afspraak te maken. Dit is de closing van elk gesprek. LET OP: klanten kunnen NOOIT zelf een inmeetafspraak plannen, stuur dus nooit een boekingslink voor inmeten. Het itemId haal je uit klant_opzoeken.',
    input_schema: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'Reuzenpanda item-id uit klant_opzoeken' },
        klantNaam: { type: 'string' },
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
        reden: { type: 'string', description: 'De volledige overdracht voor de collega — dit is LETTERLIJK de notitie die Jorren/Tanya lezen, dus schrijf hem af. Zet elk onderdeel op een EIGEN REGEL (echte enters), zodat het in één oogopslag te scannen is. Vaste opbouw:\nRegel 1: soort + klantnaam (bv. "Klacht bij klant Lotte" of "Vraag over levertijd — klant Jan de Vries")\nRegel 2: adres (als bekend)\nRegel 3: telefoonnummer (als bekend)\n(lege regel)\nWat er precies aan de hand is, in gewone zinnen.\n(lege regel)\nWelke actie nodig is (bv. "Graag service/montage contact opnemen voor herstel.")\n(lege regel)\nRelevante context uit het gesprek (bv. "Eerder gesprek ging over een knikarmscherm dat wij daar hebben opgehangen.")\nGeen kopjes als "Waarom ik dit niet kan" en niets over de AI zelf — schrijf het zoals een collega het aan een collega doorgeeft.' },
        urgentie: { type: 'string', enum: ['laag', 'normaal', 'hoog'] },
        stil: { type: 'boolean', description: 'true = klant krijgt géén bericht; gesprek blijft open voor een collega' },
        leervraag: { type: 'boolean', description: 'true = je weet het antwoord niet of twijfelt; de vraag gaat naar Daimy op Telegram zodat het antwoord aangeleerd kan worden. Zet de letterlijke klantvraag in reden.' },
      },
      required: ['reden'],
    },
  },
  {
    name: 'geen_herinneringen_meer',
    description: 'Roep dit aan als de klant duidelijk aangeeft GEEN mails/herinneringen/offerte-opvolging meer te willen ontvangen (uitschrijven, "stop met mailen", "geen herinneringen meer", "haal me uit het systeem"). Het Reuzenpanda-dossier van de klant gaat dan naar de status "geen herinnering meer", zodat de automatische herinneringsmails stoppen. Het itemId haal je uit klant_opzoeken. Bevestig de klant daarna kort en met excuus dat de uitschrijving is verwerkt.',
    input_schema: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'Reuzenpanda item-id uit klant_opzoeken' },
        klantNaam: { type: 'string' },
      },
      required: ['itemId'],
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
      const { pasOfferteAan, zetStatus } = require('./rp-offerte-edit.js');
      const res = await pasOfferteAan(input);
      if (res.error) return JSON.stringify({ status: 'MISLUKT', fout: res.error, opmerking: 'Zeg tegen de klant dat een collega de aanpassing zo snel mogelijk verwerkt. Roep ook escaleren_naar_mens aan.' });
      if (input.itemId) await zetStatus(input.itemId, CFG.RP_STATUS_AI_OFFERTE_VERSTUURD).catch(() => {});
      return JSON.stringify({ status: 'DOORGEVOERD', ...res, opmerking: 'De offerte is nu echt aangepast. Deel de link met de klant, noem het nieuwe totaal en dat de offerte 7 dagen geldig is.' });
    }
    // Schaduwmodus: alleen voorstel. BELANGRIJK: beloof de klant NIET dat er al iets is aangepast of verstuurd.
    return JSON.stringify({ status: 'VOORGESTELD (schaduwmodus — NIET uitgevoerd)', opmerking: 'Er is nog NIETS aangepast. Zeg tegen de klant dat je de aanpassing hebt klaargezet en dat de nieuwe offerte zo snel mogelijk volgt via een collega. Beloof geen directe link.' });
  }
  if (name === 'inmeet_afspraak_voorstellen') {
    ctx.acties.push({ type: 'inmeet_afspraak', ...input });
    if ((CFG.MODE === 'live' || ctx.liveTest) && !ctx.offerteLinkGedeeld) {
      return JSON.stringify({ status: 'GEBLOKKEERD', opmerking: `De klant heeft de offerte-link nog NIET via ${ctx.kanaal === 'EMAIL' ? 'de mail' : 'WhatsApp'} ontvangen in dit gesprek (harde eis). Volgorde: eerst de offerte(-aanpassing) regelen, de link hier delen, akkoord vragen op die offerte, en dan de keuzevraag (zelf tekenen of ik zet door). Pas daarna kun je doorzetten. Beloof nu nog geen inmeetafspraak.` });
    }
    if ((CFG.MODE === 'live' || ctx.liveTest) && !input.itemId) {
      return JSON.stringify({ status: 'GEBLOKKEERD', opmerking: 'Geen dossier (itemId) bekend voor deze klant — je kunt niets doorzetten naar de planning. Zoek eerst het dossier via klant_opzoeken (vraag zo nodig het e-mailadres of offertenummer), of maak eerst een offerte aan met VOLLEDIGE contactgegevens (naam, e-mail, adres). Beloof de klant nog GEEN inmeetafspraak.' });
    }
    if ((CFG.MODE === 'live' || ctx.liveTest) && input.itemId) {
      const itemUrl = `https://backend.reuzenpanda.nl/contact-service/${CFG.RP_PID}/backlogs/${CFG.RP_BACKLOG}/items/${input.itemId}`;
      // De planner-notitie (bv. "pas na 28 juli bereikbaar") MOET in RP staan, want daar werkt
      // de planner — niet alleen in de Trengo-comment (Daimy 17 juli: "ik zie dat nergens staan").
      // We voegen de notitie TOE aan de item-description (nooit herbouwen — RP-regel).
      if (input.notitie) {
        try {
          const g = await fetch(itemUrl, { headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY } });
          const d = await g.json(); const item = d.item || d;
          const marker = '**Opmerking planning (AI-klantenservice';
          if (!(item.description || '').includes(input.notitie.slice(0, 40))) {
            const nieuw = (item.description || '') + `\n\n${marker}, ${CFG.amsterdamNu().datum}):**\n${input.notitie}`;
            await fetch(itemUrl, { method: 'PATCH', headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ item: { description: nieuw } }) });
          }
        } catch { /* notitie-append faalt mag de statuswissel niet blokkeren */ }
      }
      // Item naar RP-kolom "Inmeten inplannen" (zelfde PATCH als v4's setStatus)
      const res = await fetch(itemUrl, {
        method: 'PATCH', headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: { status_id: CFG.RP_STATUS_INMETEN_INPLANNEN } }),
      });
      if (!res.ok) return JSON.stringify({ status: 'MISLUKT', opmerking: 'Status verplaatsen lukte niet. Zeg dat een collega het oppakt en roep escaleren_naar_mens aan.' });
      return JSON.stringify({ status: 'DOORGEVOERD', opmerking: `Item staat nu op "Inmeten inplannen"${input.notitie ? ' en je notitie voor de planner is in Reuzenpanda bij het dossier gezet' : ''}. Vertel de klant: de planning neemt binnen 3 werkdagen contact op om de inmeetafspraak te maken. GEEN boekingslink sturen.` });
    }
    return JSON.stringify({ status: 'VOORGESTELD (schaduwmodus — niet uitgevoerd)', opmerking: 'Er is nog niets verplaatst. Vertel de klant dat de planning binnen 3 werkdagen contact opneemt om de afspraak te maken. GEEN boekingslink sturen (die is alleen voor showroombezoek).' });
  }
  if (name === 'offerte_aanmaken') {
    ctx.acties.push({ type: 'offerte_aanmaken', klant: input.naam, producten: (input.producten || []).length });
    // Producten valideren: prijzen moeten te berekenen zijn vóór we de lead aanmaken
    for (const p of input.producten || []) {
      const check = prijsIndicatie(p);
      if (check.error) return JSON.stringify({ status: 'ONVOLLEDIG', fout: `Product "${p.product}": ${check.error}`, opmerking: 'Vraag de ontbrekende informatie aan de klant en probeer opnieuw.' });
    }
    if (CFG.MODE === 'live' || ctx.liveTest) {
      const { maakLead, registreerPending } = require('./rp-offerte-create.js');
      const res = await maakLead(input);
      if (res.error) return JSON.stringify({ status: 'MISLUKT', fout: res.error, opmerking: 'Zeg dat een collega de offerte zo snel mogelijk maakt en roep escaleren_naar_mens aan.' });
      registreerPending({ lcId: res.lcId, ticketId: ctx.ticketId, klantNaam: input.naam, producten: input.producten, sonny: !!ctx.sonny, kanaal: ctx.kanaal });
      return JSON.stringify({ status: 'IN_BEHANDELING', opmerking: `De offerte wordt aangemaakt (±5 minuten). De klant krijgt de link daarna AUTOMATISCH ${ctx.kanaal === 'EMAIL' ? 'per mail' : 'hier op WhatsApp'} — zeg dat erbij en beloof geen exacte tijd korter dan dat.` });
    }
    return JSON.stringify({ status: 'VOORGESTELD (schaduwmodus — niet uitgevoerd)', opmerking: 'Er is nog niets aangemaakt. Zeg dat de offerte zo snel mogelijk volgt via een collega.' });
  }
  if (name === 'escaleren_naar_mens') {
    ctx.acties.push({ type: 'escalatie', ...input });
    if (input.stil) {
      ctx.stil = true;
      return JSON.stringify({ status: 'GENOTEERD (stil)', opmerking: 'Het gesprek blijft open staan; een collega antwoordt. Stuur de klant NIETS: geef als eindantwoord uitsluitend de tekst [STIL].' });
    }
    return JSON.stringify({ status: 'GENOTEERD', opmerking: 'Medewerker wordt geïnformeerd. Vertel de klant dat een collega er persoonlijk op terugkomt.' });
  }
  if (name === 'geen_herinneringen_meer') {
    ctx.acties.push({ type: 'geen_herinneringen_meer', ...input });
    if (CFG.MODE === 'live' || ctx.liveTest) {
      if (!input.itemId) return JSON.stringify({ status: 'GEBLOKKEERD', opmerking: 'Geen dossier (itemId) bekend — zoek de klant eerst via klant_opzoeken (op e-mail/telefoon/offertenummer). Zonder dossier kan de uitschrijving niet verwerkt worden; vraag zo nodig het e-mailadres of offertenummer.' });
      const { zetStatus } = require('./rp-offerte-edit.js');
      const ok = await zetStatus(input.itemId, CFG.RP_STATUS_GEEN_HERINNERING).catch(() => false);
      if (!ok) return JSON.stringify({ status: 'MISLUKT', opmerking: 'Status zetten mislukte; roep escaleren_naar_mens aan zodat een collega de uitschrijving handmatig verwerkt.' });
      return JSON.stringify({ status: 'VERWERKT', opmerking: 'De klant staat nu op "geen herinnering meer" — er worden geen herinneringsmails meer gestuurd. Bevestig de klant kort en vriendelijk MET excuus dat de uitschrijving is verwerkt en dat hij geen herinneringen meer ontvangt.' });
    }
    return JSON.stringify({ status: 'VOORGESTELD (schaduwmodus — niet uitgevoerd)', opmerking: 'Er is nog niets gewijzigd. Zeg dat een collega de uitschrijving verwerkt.' });
  }
  return JSON.stringify({ error: 'Onbekende tool' });
}

module.exports = { TOOL_DEFS, runTool };

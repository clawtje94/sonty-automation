// Tools voor de AI-klantenservice agent.
// In shadow-modus voeren actie-tools NIETS uit — ze geven terug wat ze ZOUDEN doen,
// zodat het voorstel in de interne notitie belandt en beoordeeld kan worden.
const CFG = require('./config.js');

// Bedragen die uit het Sunmaster-boek komen moeten meebewegen met de opslag, ook in de
// tekst die de bot leest. Stonden hier hardcoded op de oude opslag.
const _PC = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'data', 'prijsconfig.json'), 'utf8'));
const _vp = (excl) => String(Math.round(excl * _PC.sunmasterMarkup * 100) / 100).replace('.', ',');
const { prijsIndicatie } = require('./v4-pricing.js');
const { herkenRoma, romaPrijs } = require('./roma-pricing.js');
const { buildKlantContext, getOfferteInhoud } = require('./klant-context.js');

const TOOL_DEFS = [
  {
    name: 'prijs_berekenen',
    description: 'Bereken de actuele Sonty verkoopprijs (incl. BTW en montage) voor een product. Gebruik dit ALTIJD voordat je een prijs noemt — nooit prijzen uit je hoofd. Werkt voor: knikarmschermen (SunEye/SunEye XL/SunElite/SunBasic open cassette/SunBasic dichte cassette — "SunBasic open" is de goedkopere open-arm variant), screens (Zip Design 110/Zip Square), rolluiken (S-37/S-42), uitvalschermen (SunCube/SunProject), serre zonwering (SunControl), pergola, MARKIEZEN (geef materiaal mee: grenen/hardhout/aluminium), HORREN van Unilux (geef het type in product: raamrolhor comfort/super+, voorzethor/inklemhor/veerstifthor, raamplissé voorzet/inklem/dubbel, plisséfit hordeur (enkel, voor openslaande deuren) of plisséfit dubbel (dubbele deuren/schuifpui), vaste of schuifhordeur luxe) en ROMA premium-producten: product "roma rolluik" of "roma zipscreen" met breedteMM+hoogteMM en bediening io (bekabeld) of solar. Bij Roma zijn alle 209 RAL-kleuren gratis (geen framekleur-meerprijs).',
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
        sonnyKorting: { type: 'object', properties: { percentage: { type: 'number', description: 'Nieuw TOTAALPERCENTAGE van de kortingsregel, maximaal 17.5 (= standaard 15 + jouw mandaat van max 2,5). De kortingsregel op de offerte wordt dan bv. "17,5% kortingsaanbod Sunny".' }, gratis: { type: 'string', enum: ['tahoma', 'montage'], description: 'ALLEEN bij grote orders (±5-10 producten) en in PLAATS van de percentage-verhoging: gratis Tahoma of 1x montage gratis. Komt als €0-regel op de offerte, en de 15%-kortingsregel vermeldt het cadeau met "Sunny" erbij.' } }, description: 'Jouw onderhandelmandaat, altijd zichtbaar op de offerte zelf. Kies percentage ÓF gratis, nooit beide, nooit stapelen. Doel is altijd ZO MIN MOGELIJK korting geven: probeer eerst zonder, en geef nooit meer dan nodig om de deal te sluiten.' },
        vastePosten: { type: 'array', items: { type: 'object', properties: { soort: { type: 'string', enum: ['hoogwerker', 'demontage_oud_product', 'verlengde_muursteunen', 'led_verlichting_sunelite', 'tahoma_switch'] }, aantal: { type: 'integer' } }, required: ['soort'] }, description: `Vaste posten toevoegen: hoogwerker €650/dag (boven 2e verdieping), demontage+afvoer oud product €75/stuk, verlengde muursteunen €${_vp(75 * 2)}, LED-verlichting SunElite €${_vp(749)} (kleur en wit, 2 kanalen — alleen bij SunElite), Tahoma Switch €195 (smart home hub, 1 per woning, alleen bij Somfy io motoren)` },
        samenvatting: { type: 'string', description: 'Korte omschrijving van de wijziging voor het logboek' },
      },
      required: ['documentId', 'samenvatting'],
    },
  },
  {
    name: 'inmeet_afspraak_voorstellen',
    description: 'Zet het inmeet-traject in gang zodra de klant akkoord geeft: het Reuzenpanda-item wordt verplaatst naar de kolom "Inmeten inplannen", waarna de planning binnen 5 werkdagen contact opneemt om de afspraak te maken. Dit is de closing van elk gesprek. LET OP: klanten kunnen NOOIT zelf een inmeetafspraak plannen, stuur dus nooit een boekingslink voor inmeten. Het itemId haal je uit klant_opzoeken.',
    input_schema: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'Reuzenpanda item-id uit klant_opzoeken' },
        klantNaam: { type: 'string' },
        product: { type: 'string', description: 'Waar gaat het om' },
        notitie: { type: 'string', description: 'Context voor de planner (voorkeursdagen, bijzonderheden)' },
        akkoordCitaat: { type: 'string', description: 'LETTERLIJK citaat uit het laatste bericht waarin DE KLANT akkoord geeft, kopieer het exact over ("maak maar in orde", "ik heb ondertekend", "zet maar in gang", "we willen graag dat jullie komen inmeten"). Kun je niets citeren omdat de klant nog geen ja heeft gezegd, roep deze tool dan NIET aan: vraag eerst om akkoord. Een vraag van de klant is geen akkoord.' },
      },
      required: ['klantNaam', 'product', 'akkoordCitaat'],
    },
  },
  {
    name: 'inmeet_tijden',
    description: 'Zoekt ECHTE beschikbare inmeet-tijden voor deze klant (zelfde motor als de planning: agenda\'s, rijtijden, roosters, vakanties). Gebruik dit zodra een klant met een getekende offerte over de inmeetafspraak wil overleggen: een datum wil, een voorgestelde tijd niet kan, of vraagt wat er mogelijk is. Geef de voorkeur van de klant mee (dagen/dagdeel/vanaf). Noem NOOIT tijden die niet uit deze tool komen. Het itemId haal je uit klant_opzoeken.',
    input_schema: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'Reuzenpanda item-id uit klant_opzoeken' },
        dagen: { type: 'array', items: { type: 'integer' }, description: 'Weekdagen die de klant noemt: zondag=0, maandag=1, dinsdag=2, woensdag=3, donderdag=4, vrijdag=5, zaterdag=6. Leeg = geen voorkeur.' },
        dagdeel: { type: 'string', enum: ['ochtend', 'middag'], description: 'Alleen als de klant dit noemt' },
        vanaf: { type: 'string', description: 'YYYY-MM-DD: eerste dag waarop de klant WEL kan (bv. na vakantie). Alleen als de klant een periode uitsluit.' },
      },
      required: ['itemId'],
    },
  },
  {
    name: 'inmeet_boeken',
    description: 'Boekt een inmeetafspraak DEFINITIEF op een tijd die uit inmeet_tijden kwam en waar de klant in dit gesprek expliciet mee instemde. De boeking loopt via de volledige keten (dubbelboek-controle, agenda, Planado, bevestiging) en kan daar alsnog geweigerd worden. BELANGRIJK: zeg na deze tool tegen de klant dat je de afspraak NU vastzet en dat hij zo de definitieve bevestiging krijgt — beloof nooit dat hij al definitief staat, de bevestiging komt automatisch uit de keten (regel: pas bevestigen als de boeking aantoonbaar rond is).',
    input_schema: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'Reuzenpanda item-id uit klant_opzoeken' },
        klantNaam: { type: 'string' },
        aankomst: { type: 'string', description: 'De aankomst-ISO-tijd EXACT zoals inmeet_tijden hem teruggaf' },
        inmeter: { type: 'string', description: 'De inmeter EXACT zoals inmeet_tijden hem teruggaf' },
        akkoordCitaat: { type: 'string', description: 'LETTERLIJK citaat uit het laatste klantbericht waarin de klant DIT concrete moment kiest ("donderdag 9:30 is prima", "doe de eerste maar"). Geen citaat = niet boeken: vraag eerst welke tijd hij wil.' },
      },
      required: ['itemId', 'klantNaam', 'aankomst', 'inmeter', 'akkoordCitaat'],
    },
  },
  {
    name: 'inmeet_annuleren',
    description: 'Annuleert de GEBOEKTE inmeetafspraak van deze klant definitief, over alle systemen (agenda, Planado, administratie). Alleen gebruiken als de klant in dit gesprek EXPLICIET zegt dat hij de afspraak wil annuleren (niet verzetten — wil hij een ander moment, gebruik dan inmeet_tijden). De klant krijgt automatisch een nette annuleringsbevestiging uit de keten; zeg zelf alleen dat je het nu regelt.',
    input_schema: {
      type: 'object',
      properties: {
        klantNaam: { type: 'string' },
        telefoon: { type: 'string', description: 'Telefoonnummer van de klant (uit het gesprek/klant_opzoeken)' },
        annuleerCitaat: { type: 'string', description: 'LETTERLIJK citaat uit het laatste klantbericht waarin hij annuleert ("annuleer mijn afspraak maar", "ik zie er vanaf"). Geen citaat = niet annuleren: vraag eerst of hij echt wil annuleren of liever een ander moment wil.' },
        reden: { type: 'string', description: 'Waarom de klant annuleert, in de woorden van de klant (vraag dit eerst als hij het nog niet zei). Weigert hij een reden te geven, vul dan "geen reden gegeven" in.' },
      },
      required: ['klantNaam', 'telefoon', 'annuleerCitaat', 'reden'],
    },
  },
  {
    name: 'showroom_beschikbaarheid',
    description: 'Haal de vrije tijden op voor een showroomafspraak (Frijdastraat 8F, 2288 EX Rijswijk — 45 minuten, dinsdag t/m zaterdag). Gebruik dit zodra een klant naar de showroom/winkel wil komen: vraag eerst naar welke dag de voorkeur uitgaat, en stel daarna 2-3 concrete tijden uit deze lijst voor. Noem NOOIT tijden uit je hoofd.',
    input_schema: {
      type: 'object',
      properties: {
        dagenVooruit: { type: 'integer', description: 'Hoeveel dagen vooruit kijken (standaard 14, max 60)' },
        binnendecoratie: { type: 'boolean', description: 'true als het bezoek om BINNENRAAMDECORATIE gaat (gordijnen, vitrage, jaloezieen, plisse, shutters, rolgordijnen binnen) - dan wordt de binnenhuisspecialist ingepland. false/weglaten bij zonwering, rolluiken, horren enz. Geef dit veld ALTIJD ook mee aan showroom_beschikbaarheid, zodat de juiste specialist vrij is op de voorgestelde tijden.' },
      },
    },
  },
  {
    name: 'showroom_afspraak_boeken',
    description: 'Boek de showroomafspraak ECHT in de agenda. Alleen aanroepen nadat de klant een concreet tijdstip uit showroom_beschikbaarheid heeft gekozen én je naam en e-mailadres hebt (e-mail is verplicht: daar komt de bevestiging binnen). Na het boeken: bevestig dag + tijd + adres (Frijdastraat 8F, 2288 EX Rijswijk) en zeg dat de bevestiging per mail komt. Wil de klant liever zelf een moment kiezen, dan mag je ook de boekingslink sturen.',
    input_schema: {
      type: 'object',
      properties: {
        start: { type: 'string', description: 'Het ISO-starttijdstip (veld "start") van het gekozen slot uit showroom_beschikbaarheid — nooit zelf construeren' },
        klantNaam: { type: 'string' },
        klantMail: { type: 'string', description: 'E-mailadres van de klant (verplicht, voor de bevestigingsmail)' },
        klantTel: { type: 'string' },
        notitie: { type: 'string', description: 'Waar komt de klant voor (producten, situatie) — dit ziet het showroomteam vooraf' },
        binnendecoratie: { type: 'boolean', description: 'true als het bezoek om BINNENRAAMDECORATIE gaat (gordijnen, vitrage, jaloezieen, plisse, shutters, rolgordijnen binnen) - dan wordt de binnenhuisspecialist ingepland. false/weglaten bij zonwering, rolluiken, horren enz. Geef dit veld ALTIJD ook mee aan showroom_beschikbaarheid, zodat de juiste specialist vrij is op de voorgestelde tijden.' },
      },
      required: ['start', 'klantNaam', 'klantMail'],
    },
  },
  {
    name: 'showroom_afspraak_wijzigen',
    description: 'Verzet of annuleer een bestaande showroomafspraak van de klant (gezocht op e-mailadres). VERZETTEN: kies eerst samen met de klant een nieuw vrij slot uit showroom_beschikbaarheid en geef dat mee als nieuweStart — de nieuwe wordt geboekt en de oude automatisch geannuleerd (klant krijgt vanzelf een annulerings- én nieuwe bevestigingsmail). ANNULEREN: laat nieuweStart weg, dan wordt de afspraak alleen geannuleerd. Bevestig daarna dag + tijd + adres + routetip zoals bij een nieuwe boeking.',
    input_schema: {
      type: 'object',
      properties: {
        klantMail: { type: 'string', description: 'E-mailadres waarmee de afspraak geboekt is' },
        nieuweStart: { type: 'string', description: 'ISO-starttijd (veld "start") van het nieuwe slot uit showroom_beschikbaarheid; weglaten = alleen annuleren' },
        klantNaam: { type: 'string' },
        klantTel: { type: 'string' },
        notitie: { type: 'string', description: 'Waar de klant voor komt (voor het showroomteam)' },
        binnendecoratie: { type: 'boolean', description: 'true als het bezoek om BINNENRAAMDECORATIE gaat (gordijnen, vitrage, jaloezieen, plisse, shutters, rolgordijnen binnen) - dan wordt de binnenhuisspecialist ingepland. false/weglaten bij zonwering, rolluiken, horren enz. Geef dit veld ALTIJD ook mee aan showroom_beschikbaarheid, zodat de juiste specialist vrij is op de voorgestelde tijden.' },
      },
      required: ['klantMail'],
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
    // ROMA (premium): eigen prijstabellen, netto boekprijs × 1,15 (Daimy 20 juli).
    if (herkenRoma(input.product)) {
      const r = romaPrijs(input);
      if (r.error) return JSON.stringify(r);
      const totaal = r.prijsIncl + r.montagePrijs;
      return JSON.stringify({
        product: r.naam,
        productPrijsIncl: r.prijsIncl,
        montageIncl: r.montagePrijs,
        totaalInclBtwEnMontage: totaal,
        metActiekorting15pct: Math.round(totaal * 0.85 * 100) / 100,
        motor: r.motor,
        kleuren: 'Alle 209 RAL-kleuren (mat en structuur) ZONDER meerprijs — kast, geleiders én onderlijst. Geen framekleur-meerprijs zoals bij Sunmaster.',
        staffelmaat: `${r.staffel.breedteMM}×${r.staffel.hoogteMM}mm`,
        opmerking: 'De 15% actiekorting komt als kortingsregel op de offerte (nooit zelf van de productprijs aftrekken).',
      });
    }
    return JSON.stringify(prijsIndicatie(input));
  }
  if (name === 'klant_opzoeken') {
    const res = await buildKlantContext(input);
    // Komende showroomafspraak meegeven (casus Eveline 31-07: klant stond bij het pand met
    // een afspraak die de bot niet kon zien). Mag klant_opzoeken nooit laten falen.
    try {
      const mail = res?.klant?.email || res?.email || (JSON.stringify(res).match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i) || [])[0];
      if (mail) {
        const { komendeAfspraak } = require('./showroom-booking.js');
        const afspraak = await komendeAfspraak(mail);
        if (afspraak) {
          // Vooraan zetten: het resultaat wordt op 6000 tekens afgekapt en dit veld mag nooit wegvallen.
          const metAfspraak = { showroomAfspraak: { ...afspraak, opmerking: 'De klant heeft deze showroomafspraak al staan. Verwijst de klant hiernaar (of staat hij voor de deur), geef dan DIRECT het adres en de routetip: "Navigatie? Stel in op Frijdastraat 6E, rij het hofje in, eerste rechts, wij zitten op de hoek."' }, ...res };
          return JSON.stringify(metAfspraak).substring(0, 6000);
        }
      }
    } catch { /* afspraak-lookup mag klant_opzoeken nooit breken */ }
    return JSON.stringify(res).substring(0, 6000);
  }
  if (name === 'offerte_bekijken') {
    const res = await getOfferteInhoud(input.documentId);
    return JSON.stringify(res).substring(0, 6000);
  }
/**
 * ANDER PRIJSBOEK: LICHTSTRAAT, ZADELDAK, SERRE EN VERANDA (Daimy 2026-08-05).
 *
 * Aanleiding: Silvia (+31621557981) kreeg serre zonwering geoffreerd voor haar lichtstraat, en
 * die bleek langer te worden dan de uitbouw zelf. Dat soort werk loopt via een ander prijsboek
 * dan het gewone assortiment, dus de prijzen die de bot kent kloppen daar niet.
 *
 * Dit is een harde blokkade en niet alleen een regel in de prompt: een instructie kan een model
 * naast zich neerleggen, een geweigerde tool niet.
 */
const ANDER_PRIJSBOEK = /lichtstraat|licht ?straten|zadeldak|zadel ?dak|serre|veranda|glazen ?dak|dakraam|lessenaarsdak/i;

function raaktAnderPrijsboek(ctx, input) {
  const uitInput = JSON.stringify(input || {});
  const uitGesprek = (ctx?.klantTeksten || []).join(' ');
  return ANDER_PRIJSBOEK.test(uitInput) || ANDER_PRIJSBOEK.test(uitGesprek);
}

  if (name === 'offerte_aanpassen') {
    if (raaktAnderPrijsboek(ctx, input)) {
      return JSON.stringify({
        status: 'GEBLOKKEERD',
        opmerking: 'Dit gaat over een lichtstraat, zadeldak, serre of veranda. Dat loopt via een ander prijsboek, dus jouw prijzen kloppen hier niet en je mag de offerte niet aanpassen. Zeg tegen de klant dat een collega er met de juiste maatvoering naar kijkt, noem GEEN prijs en doe GEEN toezegging over wat past, en roep escaleren_naar_mens aan.',
      });
    }
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
    // AKKOORD-GUARD (Daimy 2026-07-26, ticket 963479853). Het opgegeven citaat moet echt in een
    // klantbericht van dit gesprek staan. Zo kan de bot geen akkoord meer verzinnen: verzint hij
    // een citaat, dan matcht het niet en wordt de doorzetting geweigerd. Vergelijking op
    // genormaliseerde tekst (kleine letters, leestekens eruit) zodat kleine kopieerverschillen
    // geen valse blokkade geven, en op een fragment van 15 tekens zodat een lang citaat dat de
    // bot netjes inkort ook nog matcht.
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const citaat = norm(input.akkoordCitaat);
    const klantTekst = (ctx.klantTeksten || []).map(norm).join(' | ');
    const kort = citaat.length < 12;
    const matcht = citaat && (klantTekst.includes(citaat) || klantTekst.includes(citaat.slice(0, 15)));
    if ((CFG.MODE === 'live' || ctx.liveTest) && (!citaat || (!matcht && !kort))) {
      return JSON.stringify({
        status: 'GEBLOKKEERD',
        opmerking: 'Het opgegeven akkoordCitaat staat niet in een bericht van de klant in dit gesprek. Er is dus geen akkoord om op door te zetten. Beloof GEEN inmeetafspraak. Beantwoord eerst de vraag van de klant en vraag daarna in één duidelijke zin om akkoord (bijvoorbeeld: wil je dat ik hem in orde maak, of teken je zelf online?).',
      });
    }
    // Tweede laag: het citaat moet ook echt akkoord-taal zijn. Zonder deze check zou een
    // gecíteerde VRAAG van de klant ("Welke kleuren doek zijn er") de eerste check gewoon
    // passeren, want die staat immers letterlijk in het gesprek. Patronen komen uit de 33 echte
    // akkoorden van 3 t/m 26 juli.
    // Tweede laag: het citaat moet ook echt instemming uitdrukken. Zonder deze check zou een
    // gecíteerde VRAAG de eerste laag gewoon passeren, want die staat immers letterlijk in het
    // gesprek — precies de bug van ticket 963479853 ("Welke kleuren doek zijn er").
    //
    // De patronen zijn gekalibreerd op álle 26 echte akkoord-citaten van 3 t/m 26 juli en getest
    // tegen 10 berichten die géén akkoord waren (vragen, maten, een telefoonnummer, het verzonnen
    // "bedankt voor het vertrouwen"). Score 36/36. Let op bij uitbreiden: een te enge lijst
    // blokkeert echte deals, dus test een wijziging altijd opnieuw tegen beide sets.
    // Ook Engelse instemming en het vragen om een afspraak/datum: bij de retro-test bleken twee
    // echte akkoorden anders onterecht geblokkeerd te worden. Ticket 966407154 schreef "So can we
    // schedule a measurement appointment for July 28-31?" en ticket 967572821 "Mis kunnen jullie
    // 24 juli". Wie vraagt of we op een datum kunnen komen inmeten, is akkoord.
    // Let op bij "graag": dat woord alleen is GEEN akkoord. "Oké dan wil ik graag zonwering" is
    // interesse in een product; pas "graag een afspraak/inmeten/verder" is instemming. Daarom
    // staat graag hier alleen in combinatie. Getest tegen alle 33 complete Trengo-gesprekken van
    // klanten die zijn doorgezet (341 klantberichten): alle 33 houden een akkoord over.
    // UITGEBREID 2026-08-04 na Marjolein (+31657977507) en Biki (+31642904128). Beiden gingen
    // duidelijk akkoord, maar de guard blokkeerde ze en hun inmeetverzoek verdween:
    //   "Inmeten kan klaargezet worden"        geen enkel patroon matchte
    //   "ben akkord met prijsindicatie"        typo, er stond alleen akkoord met dubbele o
    //   "Ik teken later vandaag jullie offerte" alleen onderteken en getekend stonden erin
    // Vandaar akko?ord voor de typo, een los teken-werkwoord, en de klaarzet-formuleringen.
    const AKKOORD_TAAL = /(akko?ord|in orde|in gang|onderteken|getekend|\bteken\b|tekenen is gelukt|geaccepteerd|ga (ik|we) (mee|voor)|doe (ik|we) het|mag (het|je|hij)|graag (een |het )?(afspraak|inmeet|meting|langskomen|komen|verder)|willen (we|wij) (graag )?(dat|een|verder)|(we|wij) willen graag|kunnen jullie|langs ?komen|laten inmeten|inmeet ?afspraak|inmeten kan|klaar ?ge?zet|klaarzetten|zet (maar|het) door|is goed|is prima|prima|deal|dit is hem|bevestiging|toppers|dank dat het|schedule|appointment|proceed|go ahead|sounds good|please do|let'?s do)/i;
    const citaatRuw = String(input.akkoordCitaat || '');

    // EEN ONDERTEKENDE OFFERTE IS OOK AKKOORD (Daimy 2026-07-27, ging fout bij Tim Remmel).
    // Tekent een klant online in het document, dan staat er nooit een akkoord-zin in de chat.
    // De guard hierboven blokkeerde daardoor een klant die alles al had getekend: de bot moest
    // escaleren en zei tegen hem "zodra jij akkoord geeft op de offerte", waarop Tim terecht
    // antwoordde "ik heb al getekend". Een offerte met status ACCEPTED is beter bewijs dan een
    // zin in een chat, dus die telt hier gewoon als akkoord.
    let getekendeOfferte = null;
    if ((CFG.MODE === 'live' || ctx.liveTest) && input.itemId) {
      try {
        const it = await (await fetch(`https://backend.reuzenpanda.nl/contact-service/${CFG.RP_PID}/backlogs/${CFG.RP_BACKLOG}/items/${input.itemId}`,
          { headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY } })).json();
        const lcId = (it.item || it)?.item_subject?.id;
        if (lcId) {
          const q = await (await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${CFG.RP_PID}/quotations?lead_configuration_id=${lcId}`,
            { headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY } })).json();
          const getekend = (q?.quotationDatas || []).find(d => /ACCEPTED|SIGNED/i.test(String(d.quotationStatus || '')));
          if (getekend) getekendeOfferte = getekend.quotationNumber || 'ja';
        }
      } catch { /* lukt de controle niet, dan valt hij terug op de citaat-eis hieronder */ }
    }
    // BUGFIX 2026-08-16 (casus Edwin Kanters, ticket 974295216): dit pad returnde vroeger
    // direct "DOORGEZET" zónder de RP-verplaatsing en de plannernotitie hieronder uit te
    // voeren — klant en bot kregen "geregeld" te horen terwijl er in RP niets gebeurde.
    // Een ondertekende offerte slaat daarom alleen de akkoord-guards over; de echte
    // uitvoering (notitie + status naar Inmeten inplannen) loopt gewoon door.
    if (getekendeOfferte) {
      ctx.acties.push({ type: 'inmeet_afspraak', ...input, akkoordBron: `offerte ${getekendeOfferte} is ondertekend` });
    } else {
      if ((CFG.MODE === 'live' || ctx.liveTest) && !AKKOORD_TAAL.test(citaatRuw)) {
        return JSON.stringify({
          status: 'GEBLOKKEERD',
          opmerking: `Het citaat "${citaatRuw.slice(0, 80)}" drukt geen akkoord uit. Een klant die iets vraagt, maten doorgeeft of informatie stuurt, heeft nog geen ja gezegd. Beantwoord eerst wat hij vraagt en sluit af met één concrete keuzevraag: wil je dat ik hem in orde maak, of teken je zelf online via de link? Pas als hij daarop ja zegt, zet je door.`,
        });
      }
      ctx.acties.push({ type: 'inmeet_afspraak', ...input });
      if ((CFG.MODE === 'live' || ctx.liveTest) && !ctx.offerteLinkGedeeld) {
        return JSON.stringify({ status: 'GEBLOKKEERD', opmerking: `De klant heeft de offerte-link nog NIET via ${ctx.kanaal === 'EMAIL' ? 'de mail' : 'WhatsApp'} ontvangen in dit gesprek (harde eis). Volgorde: eerst de offerte(-aanpassing) regelen, de link hier delen, akkoord vragen op die offerte, en dan de keuzevraag (zelf tekenen of ik zet door). Pas daarna kun je doorzetten. Beloof nu nog geen inmeetafspraak.` });
      }
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
      return JSON.stringify({ status: 'DOORGEVOERD', opmerking: `${getekendeOfferte ? `De klant heeft offerte ${getekendeOfferte} al online ondertekend, dus het akkoord staat vast — zeg NIET meer "zodra je akkoord geeft". ` : ''}Item staat nu op "Inmeten inplannen"${input.notitie ? ' en je notitie voor de planner is in Reuzenpanda bij het dossier gezet' : ''}. Vertel de klant: de planning neemt binnen 5 werkdagen contact op om de inmeetafspraak te maken. GEEN boekingslink sturen.` });
    }
    return JSON.stringify({ status: 'VOORGESTELD (schaduwmodus — niet uitgevoerd)', opmerking: 'Er is nog niets verplaatst. Vertel de klant dat de planning binnen 5 werkdagen contact opneemt om de afspraak te maken. GEEN boekingslink sturen (die is alleen voor showroombezoek).' });
  }
  if (name === 'offerte_aanmaken') {
    if (raaktAnderPrijsboek(ctx, input)) {
      return JSON.stringify({
        status: 'GEBLOKKEERD',
        opmerking: 'Dit gaat over een lichtstraat, zadeldak, serre of veranda. Dat loopt via een ander prijsboek, dus je kunt hier geen offerte voor maken. Zeg tegen de klant dat een collega het oppakt en roep escaleren_naar_mens aan.',
      });
    }
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
  // Showroom-boeken staat in testfase (Daimy 21 juli): alleen whitelist-testnummers,
  // DIRECT INMEET-PLANNEN (Daimy 26-08: Sunny moet in het gesprek kunnen overleggen en
  // boeken). Aan-knop: bestand .inmeet-plannen-live naast dit script — zelfde patroon
  // als de showroom-uitrol, zodat we per fase live kunnen.
  const inmeetPlannenAan = () => ctx.liveTest || require('fs').existsSync(require('path').join(__dirname, '.inmeet-plannen-live'));
  if (name === 'inmeet_tijden') {
    if (!inmeetPlannenAan()) return JSON.stringify({ status: 'NOG NIET BESCHIKBAAR', opmerking: 'Direct plannen staat nog uit. Gebruik inmeet_afspraak_voorstellen zodra de klant akkoord is; de planning stuurt dan een voorstel.' });
    try {
      const { zoekInmeetTijden } = require('../lib/inmeet-tijden.js');
      const r = await zoekInmeetTijden({ itemId: input.itemId, dagen: input.dagen || [], dagdeel: input.dagdeel || null, vanaf: input.vanaf || null, max: 5 });
      if (!r.slots.length) {
        return JSON.stringify({ status: 'GEEN TIJDEN', opmerking: 'Geen beschikbare tijden gevonden' + (input.vanaf ? ' vanaf ' + input.vanaf : '') + ' binnen de planhorizon. Beloof GEEN tijd, zeg dat je het laat uitzoeken, en roep escaleren_naar_mens aan.' });
      }
      // Sunny noemt zo zelf tijden: gesprek claimen zodat de planningsketen (planner-ronde,
      // dashboard-klik, reply-route) hier geen tweede voorstel overheen stuurt (28-08).
      try { if (ctx.ticketId) require('../lib/gesprek-claims.js').claim(ctx.ticketId, 'sunny-tijden'); } catch { /* vangnet */ }
      return JSON.stringify({
        status: 'OK', duurMin: r.duurMin, tijden: r.slots,
        opmerking: 'Dit zijn ECHTE vrije tijden (momentopname, nog niet gereserveerd). Noem er 2-3 in gewone taal, sluit aan op wat de klant vroeg. Kiest de klant expliciet één moment, boek dan met inmeet_boeken. Noem nooit tijden buiten deze lijst.',
      });
    } catch (e) {
      return JSON.stringify({ status: 'FOUT', opmerking: 'Tijden zoeken lukte niet (' + String(e.message).slice(0, 100) + '). Beloof geen tijden; zeg dat je het uitzoekt en roep escaleren_naar_mens aan.' });
    }
  }
  if (name === 'inmeet_annuleren') {
    if (!inmeetPlannenAan()) return JSON.stringify({ status: 'NOG NIET BESCHIKBAAR', opmerking: 'Zeg dat een collega de annulering oppakt en roep escaleren_naar_mens aan.' });
    const normA = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const citA = normA(input.annuleerCitaat);
    const klantTekstA = (ctx.klantTeksten || []).map(normA).join(' | ');
    const matchtA = citA && (klantTekstA.includes(citA) || klantTekstA.includes(citA.slice(0, 15)));
    if ((CFG.MODE === 'live' || ctx.liveTest) && (!citA || (!matchtA && citA.length >= 12))) {
      return JSON.stringify({ status: 'GEBLOKKEERD', opmerking: 'Het annuleerCitaat staat niet in een klantbericht van dit gesprek. Annuleer NIETS; vraag eerst duidelijk of hij echt wil annuleren.' });
    }
    if (CFG.MODE !== 'live' && !ctx.liveTest) {
      return JSON.stringify({ status: 'VOORGESTELD (schaduwmodus — NIET geannuleerd)', opmerking: 'Er is niets geannuleerd. Zeg dat een collega het oppakt.' });
    }
    try {
      const rA2 = await fetch('https://sonty-website.vercel.app/api/inmeet-mutatie', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-meet-code': process.env.MEETBON_CODE || '2288' },
        body: JSON.stringify({ type: 'annuleer', naam: input.klantNaam, telefoon: input.telefoon, bron: 'sunny', reden: 'klant annuleerde in het gesprek. Reden: ' + String(input.reden || 'geen reden gegeven').slice(0, 150) + ' — citaat: ' + String(input.annuleerCitaat).slice(0, 100) }),
      });
      if (!rA2.ok) throw new Error('wachtrij HTTP ' + rA2.status);
      return JSON.stringify({ status: 'IN UITVOERING', opmerking: 'De annulering loopt nu over alle systemen; de klant krijgt automatisch de annuleringsbevestiging. Zeg: "geen probleem, ik annuleer hem nu voor je — je krijgt zo de bevestiging". Beloof verder niets.' });
    } catch (e) {
      return JSON.stringify({ status: 'FOUT', opmerking: 'Annuleren in de wachtrij zetten lukte niet (' + String(e.message).slice(0, 80) + '). Zeg dat een collega het direct oppakt en roep escaleren_naar_mens aan.' });
    }
  }
  if (name === 'inmeet_boeken') {
    if (!inmeetPlannenAan()) return JSON.stringify({ status: 'NOG NIET BESCHIKBAAR', opmerking: 'Direct boeken staat nog uit. Er is niets geboekt. Zeg dat de planning het moment vastlegt en zet het traject in gang via inmeet_afspraak_voorstellen.' });
    // Zelfde akkoord-guard als inmeet_afspraak_voorstellen: het citaat moet echt in dit
    // gesprek staan, anders kan de bot een keuze verzinnen.
    const normB = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const citaatB = normB(input.akkoordCitaat);
    const klantTekstB = (ctx.klantTeksten || []).map(normB).join(' | ');
    const matchtB = citaatB && (klantTekstB.includes(citaatB) || klantTekstB.includes(citaatB.slice(0, 15)));
    if ((CFG.MODE === 'live' || ctx.liveTest) && (!citaatB || (!matchtB && citaatB.length >= 12))) {
      return JSON.stringify({ status: 'GEBLOKKEERD', opmerking: 'Het akkoordCitaat staat niet in een klantbericht van dit gesprek — er is geen keuze om te boeken. Vraag de klant eerst duidelijk welk moment hij wil.' });
    }
    if (CFG.MODE !== 'live' && !ctx.liveTest) {
      return JSON.stringify({ status: 'VOORGESTELD (schaduwmodus — NIET geboekt)', opmerking: 'Er is niets geboekt. Zeg dat je de afspraak klaarzet en dat de bevestiging volgt.' });
    }
    try {
      const rB = await fetch('https://sonty-website.vercel.app/api/inmeet-mutatie', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-meet-code': process.env.MEETBON_CODE || '2288' },
        body: JSON.stringify({
          type: 'boek', rpItemId: input.itemId, naam: input.klantNaam, bron: 'sunny',
          slot: { aankomst: input.aankomst, inmeter: input.inmeter },
        }),
      });
      if (!rB.ok) throw new Error('wachtrij HTTP ' + rB.status);
      return JSON.stringify({
        status: 'IN UITVOERING',
        opmerking: 'De boeking loopt nu via de volledige keten (dubbelboek-controle, agenda, Planado). Zeg tegen de klant: "ik zet hem nu voor je vast, je krijgt zo vanzelf de definitieve bevestiging". Zeg NIET dat hij al definitief staat. Blijkt de tijd net vergeven, dan krijgt de klant automatisch bericht met nieuwe opties.',
      });
    } catch (e) {
      return JSON.stringify({ status: 'FOUT', opmerking: 'Boeken in de wachtrij zetten lukte niet (' + String(e.message).slice(0, 80) + '). Zeg dat een collega het moment vastlegt en roep escaleren_naar_mens aan.' });
    }
  }
  // voor alle andere klanten pas na de aan-knop (bestand .showroom-live naast dit script).
  const showroomAan = () => ctx.liveTest || require('fs').existsSync(require('path').join(__dirname, '.showroom-live'));
  if (name === 'showroom_beschikbaarheid') {
    if (!showroomAan()) return JSON.stringify({ status: 'NOG NIET BESCHIKBAAR', opmerking: 'Zelf boeken staat nog uit (testfase). Stuur de klant de boekingslink zoals gebruikelijk, zodat hij zelf een moment kiest.' });
    const { vrijeSlots } = require('./showroom-booking.js');
    const dagen = Math.min(Math.max(input.dagenVooruit || 14, 1), 60);
    const slots = await vrijeSlots({ dagenVooruit: dagen, binnendecoratie: !!input.binnendecoratie });
    // Per dag gegroepeerd en COMPLEET (een afgekapte top-30 liet de bot eerder denken dat
    // verderop gelegen dagen vol waren — test Daimy 21 juli, "de 30e is vol" terwijl leeg).
    const perDag = {};
    for (const s of slots) { // omschrijving: "donderdag 2026-07-30 om 14:30"
      const [dag, tijd] = s.omschrijving.split(' om ');
      (perDag[dag] = perDag[dag] || []).push(tijd);
    }
    // VANDAAG valt vrijwel altijd weg door de minimale aanlooptijd van 8 uur — dat is een
    // boekingsregel, GEEN volle agenda. De bot zei daardoor "vanmiddag zit vol" tegen een
    // klant die gewoon had kunnen binnenlopen (Gary, ticket 970191250, 30 juli). Zeg het er
    // dus expliciet bij, inclusief de inloop-optie op di/do (afspraak alleen verplicht wo/vr/za).
    const nuNL = CFG.amsterdamNu();
    let vandaagNote = '';
    if ([2, 3, 4, 5, 6].includes(nuNL.dag)) {
      const sluit = nuNL.dag === 6 ? '16:00' : '17:00';
      const inloop = [2, 4].includes(nuNL.dag); // di en do: geen afspraak verplicht
      const dagnaam = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'][nuNL.dag];
      vandaagNote = ` LET OP VANDAAG: tijden voor vandaag ontbreken meestal door de minimale aanlooptijd van 8 uur voor afspraken. Dat betekent NIET dat vandaag vol is; zeg dus nooit "vandaag zit vol".` +
        (inloop && nuNL.hhmm < sluit
          ? ` Vandaag (${dagnaam}) is een afspraak niet verplicht: de klant mag tot ${sluit} gewoon binnenlopen in de showroom. Bied dat actief aan als iemand vandaag nog wil komen.`
          : ` Wil de klant per se vandaag nog komen, laat het dan een collega oppakken via escaleren_naar_mens.`);
    }
    return JSON.stringify({
      dagen: Object.entries(perDag).map(([dag, tijden]) => `${dag}: ${tijden.join(', ')}`),
      opmerking: `Dit zijn ALLE vrije tijden voor de komende ${dagen} dagen (di t/m za); een dag die ontbreekt (behalve vandaag) is echt vol of gesloten. Stel 2-3 tijden voor die bij de voorkeur van de klant passen; boek pas na expliciete keuze. Geef bij het boeken start door als "JJJJ-MM-DD UU:MM" (NL-tijd) uit deze lijst.${vandaagNote}`,
    });
  }
  if (name === 'showroom_afspraak_boeken') {
    ctx.acties.push({ type: 'showroom_afspraak', ...input });
    if (!showroomAan()) return JSON.stringify({ status: 'NOG NIET BESCHIKBAAR', opmerking: 'Zelf boeken staat nog uit (testfase). Er is niets geboekt: stuur de klant de boekingslink zodat hij zelf een moment kiest.' });
    if (CFG.MODE === 'live' || ctx.liveTest) {
      const { boekShowroom } = require('./showroom-booking.js');
      const res = await boekShowroom(input).catch(e => ({ error: e.message }));
      if (res.error) return JSON.stringify({ status: 'MISLUKT', fout: res.error, opmerking: 'Niet geboekt. Is het slot net bezet geraakt: bied andere tijden aan uit showroom_beschikbaarheid. Blijft het misgaan: zeg dat een collega de afspraak inplant en roep escaleren_naar_mens aan.' });
      return JSON.stringify({ status: 'GEBOEKT', ...res, opmerking: `De afspraak staat echt in de agenda (${res.geboekt}). Bevestig de klant dag + tijd + adres en dat de bevestiging per mail komt.` });
    }
    return JSON.stringify({ status: 'VOORGESTELD (schaduwmodus — niet uitgevoerd)', opmerking: 'Er is nog niets geboekt. Zeg dat een collega de afspraak bevestigt, of stuur de boekingslink zodat de klant zelf kan boeken.' });
  }
  if (name === 'showroom_afspraak_wijzigen') {
    ctx.acties.push({ type: 'showroom_wijzigen', ...input });
    if (!showroomAan()) return JSON.stringify({ status: 'NOG NIET BESCHIKBAAR', opmerking: 'Zelf wijzigen staat nog uit (testfase). Zeg dat een collega de wijziging oppakt en roep escaleren_naar_mens aan.' });
    if (CFG.MODE === 'live' || ctx.liveTest) {
      const { wijzigShowroom } = require('./showroom-booking.js');
      const res = await wijzigShowroom(input).catch(e => ({ error: e.message }));
      if (res.error) return JSON.stringify({ status: 'MISLUKT', fout: res.error, opmerking: 'Niets gewijzigd. Bied andere tijden aan of laat een collega het oppakken (escaleren_naar_mens).' });
      if (res.geannuleerd) return JSON.stringify({ status: 'GEANNULEERD', ...res, opmerking: 'De afspraak is geannuleerd; de klant krijgt daarvan automatisch een mail. Bevestig het kort en vriendelijk.' });
      return JSON.stringify({ status: 'VERZET', ...res, opmerking: `De afspraak is verzet van ${res.oudeTijd} naar ${res.geboekt}. Bevestig dag + tijd + adres + routetip en dat de nieuwe bevestiging per mail komt.` });
    }
    return JSON.stringify({ status: 'VOORGESTELD (schaduwmodus — niet uitgevoerd)', opmerking: 'Er is nog niets gewijzigd. Zeg dat een collega de wijziging bevestigt.' });
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

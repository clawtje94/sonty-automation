// OFFERTE-POORT (Daimy 2026-09-05): "Sunny mag niet meer alleen een prijs geven in de
// mail, er moet gewoon een offerte worden gemaakt en die sturen. Je kan in de mail wel
// onderbouwen wat erin staat, maar niet meer alleen tekst sturen." Aanleiding: een klant
// stond in de winkel met een prijs uit een Sunny-mail, en er bestond nog helemaal geen
// offerte voor.
//
// Regel (puur, geen IO, testbaar in het scenario-lab):
//   Een e-mail met een PRODUCTBEDRAG mag alleen de deur uit als er een offerte bij hoort:
//     a) in DEZE beurt is een offerte ECHT aangemaakt of aangepast (offerteGemaakt), of
//     b) de klant heeft al een offerte (offerteBekend) én de mail benoemt die offerte
//        (het woord "offerte" staat erin: toelichting op wat erin staat is precies wat mag).
//   Anders: blokkeren, met een reden die de agent als herkansing krijgt.
//
// Vaste beleidsbedragen tellen niet als prijs: €75 (inmeetregel / demontage), €25 (Máxima-
// donatie). Bedragen onder de €100 tellen ook niet (losse optie-uitleg, portokosten e.d.).
// Kanaal: alleen EMAIL (WhatsApp is een lopend gesprek; V1 aan Daimy of dat ook moet).

const VASTE_BEDRAGEN = new Set([75, 25]);
const MIN_PRIJS = 100;

// "€2.403", "€ 2403,50", "2.043 euro", "1414,80 EUR", "EUR 1.200"
// duizendtal: punt, komma of spatie gevolgd door precies 3 cijfers; decimalen: komma of punt + 1-2 cijfers
const GETAL = '(\\d{1,3}(?:[.,\\s]\\d{3})+|\\d+)(?:[,.]\\d{1,2}(?!\\d))?';
const BEDRAG_RE = new RegExp('(?:€|\\beur(?:o)?\\b)\\s?' + GETAL + '|' + GETAL + '\\s?(?:€|\\beuro\\b|\\beur\\b)', 'gi');

function parseBedrag(heel) {
  return Number(String(heel).replace(/[.,\s]/g, ''));
}

/** Alle productbedragen (≥ €100, geen vaste beleidsbedragen) in een tekst. */
function productBedragen(tekst) {
  const uit = [];
  const t = String(tekst || '');
  let m;
  BEDRAG_RE.lastIndex = 0;
  while ((m = BEDRAG_RE.exec(t)) !== null) {
    const heel = m[1] ?? m[2];
    if (heel == null) continue;
    const n = parseBedrag(heel);
    if (!Number.isFinite(n)) continue;
    if (VASTE_BEDRAGEN.has(n) || n < MIN_PRIJS) continue;
    uit.push(n);
  }
  return uit;
}

/**
 * Beoordeel een concept-antwoord.
 * @param {{tekst:string, kanaal?:string, offerteGemaakt?:boolean, offerteBekend?:boolean}} p
 * @returns {{blok:boolean, reden:string, bedragen:number[]}}
 */
function beoordeel({ tekst, kanaal = 'EMAIL', offerteGemaakt = false, offerteBekend = false }) {
  const bedragen = productBedragen(tekst);
  if (String(kanaal).toUpperCase() !== 'EMAIL') return { blok: false, reden: 'geen e-mail', bedragen };
  if (!bedragen.length) return { blok: false, reden: 'geen productbedrag', bedragen };
  if (offerteGemaakt) return { blok: false, reden: 'offerte in deze beurt aangemaakt/aangepast', bedragen };
  if (offerteBekend && /\boffertes?\b/i.test(String(tekst || ''))) return { blok: false, reden: 'bestaande offerte toegelicht', bedragen };
  return {
    blok: true,
    bedragen,
    reden: offerteBekend
      ? 'de mail noemt een prijs (€' + bedragen[0] + ') zonder de bestaande offerte te benoemen of aan te passen'
      : 'de mail noemt een prijs (€' + bedragen[0] + ') maar er bestaat nog geen offerte voor deze klant',
  };
}

/** Herkansingsinstructie voor de agent (zelfde stijl als de QA-afkeuring). */
function herkansingsTekst(oordeel) {
  return 'INTERNE OFFERTE-POORT wees je concept af: ' + oordeel.reden + '. Regel (Daimy): per e-mail NOOIT alleen een prijs als tekst; er moet een echte offerte bij. '
    + 'Heb je alle gegevens (naam, telefoon, e-mail, straat + huisnummer, postcode, plaats) en complete producten: maak de offerte NU aan met offerte_aanmaken (of pas de bestaande aan met offerte_aanpassen) en licht in de mail toe wat erin staat. '
    + 'Ontbreken er gegevens: noem dan GEEN bedrag, vraag de ontbrekende gegevens en zeg dat je daarna meteen de offerte maakt en per mail stuurt. Schrijf alleen de tekst die naar de klant gaat.';
}

module.exports = { beoordeel, productBedragen, herkansingsTekst, MIN_PRIJS, VASTE_BEDRAGEN };

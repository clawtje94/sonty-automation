// WAT DE KLANT VROEG MAAR NIET IN DE OFFERTE STAAT (Daimy 18-08).
//
// De offerte is leidend voor wat we gaan inmeten, maar soms noemt de aanvraag iets dat
// er helemaal niet in staat: Helene Beek vroeg raamdecoratie, haar offerte is een
// rolluik. Dat mag niet verdwijnen, dus het komt als aparte regel in de opdracht.
//
// Vergelijken op "zit de ene naam in de andere" was te streng: "Sunbasic dichte
// cassette" uit het formulier en "SunBasic Cassette" uit de offerte zijn hetzelfde
// product, maar geen van beide is een deelstring van de ander. Daarom vergelijken we op
// betekenisvolle woorden, met de generieke woorden eruit.
const ALGEMEEN = new Set([
  'dichte', 'open', 'cassette', 'scherm', 'schermen', 'zonwering', 'zonwerende',
  'met', 'zonder', 'voor', 'een', 'het', 'de', 'en', 'van', 'op', 'naar', 'keuze',
  'maat', 'maatwerk', 'standaard', 'luxe', 'super', 'plus', 'type', 'systeem',
]);
// Formulierruis: dat zijn geen losse producten maar keuzevelden of toebehoren.
const RUIS = /^(niet )?windvast$|windsensor|^offerte op maat$|^winkel offerte$|^somfy|^tahoma|^situo|^eolis/i;

// Vergelijken op de eerste vijf letters, want het formulier en de offerte schrijven
// hetzelfde product anders: "Markiezen" tegenover "Markies aluminium kap", "Shutters"
// tegenover "Shutter". Vijf letters houdt Suneye en SunBasic uit elkaar (suney/sunba)
// en Raamdecoratie van Rolluik.
const stam = (w) => w.slice(0, 5);
const woorden = (naam) => String(naam || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .split(/[^a-z0-9]+/)
  .filter((w) => w.length >= 4 && !ALGEMEEN.has(w) && !/^\d+$/.test(w))
  .map(stam);

/**
 * @param {Array<{naam:string}>} leadProducten producten uit de leadtekst (al gefilterd)
 * @param {Array<{naam:string}>} offerteProducten producten uit de offerte
 * @returns {string[]} namen die de klant noemde en die nergens in de offerte terugkomen
 */
function leadRestant(leadProducten = [], offerteProducten = []) {
  const offerteWoorden = new Set(offerteProducten.flatMap((p) => woorden(p.naam)));
  return [...new Set(leadProducten
    .map((p) => (typeof p === 'string' ? p : p.naam))
    .filter((n) => n && !RUIS.test(n))
    .filter((n) => {
      const w = woorden(n);
      // Geen betekenisvol woord over? Dan kunnen we er niets zinnigs over zeggen.
      if (!w.length) return false;
      return !w.some((x) => offerteWoorden.has(x));
    }))];
}

module.exports = { leadRestant, RUIS };

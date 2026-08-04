/**
 * WANNEER ZEI DE KLANT DAT HIJ TERUGKOMT? (Daimy 2026-08-04, Ebru +31616463983)
 *
 * De opvolging stuurde altijd na ongeveer 22 uur een reminder, ongeacht wat de klant had gezegd.
 * Ebru schreef twee keer "ik laat het weten voor donderdag 6 augustus" en kreeg dinsdagochtend
 * al een herinnering. Dat is niet alleen te vroeg, het is ook precies het tegenovergestelde van
 * wat ze vroeg.
 *
 * Deze module haalt uit het bericht van de klant het moment waarop hij zelf zei terug te komen.
 * Vindt hij niets concreets, dan valt het terug op de oude 22 uur, want dan is er ook geen
 * afspraak om je aan te houden.
 *
 * Bewust conservatief: bij twijfel liever later dan te vroeg. Een klant die zelf een dag noemt en
 * dan eerder een duwtje krijgt, voelt zich opgejaagd.
 */

const DAG = 86400000;

const WEEKDAGEN = {
  maandag: 1, dinsdag: 2, woensdag: 3, donderdag: 4, vrijdag: 5, zaterdag: 6, zondag: 0,
};
const MAANDEN = {
  januari: 0, februari: 1, maart: 2, april: 3, mei: 4, juni: 5,
  juli: 6, augustus: 7, september: 8, oktober: 9, november: 10, december: 11,
};

/** Zet het moment op 9 uur 's ochtends: een reminder hoort in de ochtend, niet om 6 uur. */
function ochtendVan(d) {
  const x = new Date(d);
  x.setHours(9, 0, 0, 0);
  return x.getTime();
}

/**
 * Bepaalt wanneer we mogen opvolgen.
 * @param tekst   het bericht van de klant
 * @param vanaf   tijdstip van dat bericht (ms)
 * @returns {{tijd: number, reden: string}}
 */
function terugkomMoment(tekst, vanaf = Date.now()) {
  const t = String(tekst || '').toLowerCase();
  const basis = new Date(vanaf);

  // 1. Een concrete datum: "6 augustus", "donderdag 6 augustus"
  const datum = t.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)/);
  if (datum) {
    const d = new Date(basis);
    d.setMonth(MAANDEN[datum[2]], Number(datum[1]));
    if (d.getTime() < vanaf) d.setFullYear(d.getFullYear() + 1);   // datum al voorbij = volgend jaar
    return { tijd: ochtendVan(d), reden: `klant noemde ${datum[1]} ${datum[2]}` };
  }

  // 2. Een weekdag: "voor donderdag", "donderdag laat ik het weten"
  const dagNaam = Object.keys(WEEKDAGEN).find((d) => t.includes(d));
  if (dagNaam) {
    const doel = WEEKDAGEN[dagNaam];
    const d = new Date(basis);
    let stappen = (doel - d.getDay() + 7) % 7;
    if (stappen === 0) stappen = 7;            // "donderdag" op donderdag gezegd = volgende week
    d.setDate(d.getDate() + stappen);
    return { tijd: ochtendVan(d), reden: `klant noemde ${dagNaam}` };
  }

  // 3. Losse tijdsaanduidingen
  if (/overmorgen/.test(t)) return { tijd: ochtendVan(new Date(vanaf + 2 * DAG)), reden: 'klant zei overmorgen' };
  if (/morgen/.test(t)) return { tijd: ochtendVan(new Date(vanaf + DAG)), reden: 'klant zei morgen' };
  // "vanavond" betekent in de praktijk: morgenochtend hoor je het. Een reminder om drie uur
  // 's nachts klaarzetten heeft geen zin, dus altijd de ochtend erna.
  if (/vanavond|vanmiddag|later vandaag|straks|aan het eind van de dag/.test(t)) {
    return { tijd: ochtendVan(new Date(vanaf + DAG)), reden: 'klant zei later vandaag' };
  }
  if (/dit weekend|het weekend/.test(t)) {
    const d = new Date(basis);
    d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7 || 7));   // eerstvolgende maandag
    return { tijd: ochtendVan(d), reden: 'klant zei dit weekend' };
  }
  if (/volgende week/.test(t)) {
    // De eerstvolgende maandag. Niet nog een week erbovenop: wie op zondag "volgende week" zegt
    // bedoelt de week die morgen begint, en dan is twee weken wachten veel te laat.
    const d = new Date(basis);
    d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7 || 7));
    return { tijd: ochtendVan(d), reden: 'klant zei volgende week' };
  }
  if (/paar dagen|enkele dagen/.test(t)) return { tijd: ochtendVan(new Date(vanaf + 3 * DAG)), reden: 'klant zei een paar dagen' };
  if (/volgende maand/.test(t)) return { tijd: ochtendVan(new Date(vanaf + 30 * DAG)), reden: 'klant zei volgende maand' };

  // 4. Niets concreets gezegd: de oude regel van ongeveer 22 uur, nog binnen het WhatsApp-venster.
  return { tijd: vanaf + 22 * 3600000, reden: 'geen moment genoemd, standaard 22 uur' };
}

/**
 * Naam voor de aanhef. Contacten in Trengo hebben soms een emoji als naam (Ebru stond er als
 * "🤷🏻‍♀️"), en dan stuurde de bot letterlijk "Hoi 🤷🏻‍♀️,". Liever helemaal geen naam dan dat.
 */
function bruikbareVoornaam(naam) {
  const eerste = String(naam || '').trim().split(/\s+/)[0] || '';
  if (!/^[a-zà-ÿ][a-zà-ÿ'\-.]{1,19}$/i.test(eerste)) return null;
  return eerste.charAt(0).toUpperCase() + eerste.slice(1);
}

module.exports = { terugkomMoment, bruikbareVoornaam };

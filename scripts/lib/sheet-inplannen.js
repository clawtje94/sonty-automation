// Inplanning vastleggen in de offerte-sheet (Daimy 06-08): "zodra je iemand ingepland
// hebt moet je in de sheet bij inkoop een 1tje zetten, in het vak erachter de
// inmeetdatum en in het vak daarachter wie er gaat inmeten."
//
// Sheet-regels (reference_sonty_offerte_sheet_structuur):
//  - koppelen (Daimy 06-08): eerst RP-OFFERTENUMMER (kolom "RP offerte" — Gripp bestaat
//    op dit moment in de keten meestal nog niet!), dan telefoon (laatste 9), dan
//    Gripp-nummer als hij er al is. NOOIT op naam.
//  - kolomindexen verschillen per tab → altijd de headerrij (rij 3) lezen
//  - klant niet gevonden → nieuwe rij onderaan de huidige maandtab + melding
const path = require('path');
const SHEET_ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';

const MAANDEN = ['jan', 'feb', 'maa', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const laatste9 = (t) => String(t || '').replace(/\D/g, '').slice(-9);

/** Pure functie (scenario-lab-baar): vind rij + kolommen in tab-data. */
function vindRijEnKolommen(tabs, { rpNummers = [], grippNr, telefoon }) {
  const rpSet = new Set(rpNummers.map((n) => String(n).replace(/\D/g, '')).filter(Boolean));
  for (const tab of tabs) {
    const kop = (tab.rijen[2] || []).map((h) => String(h || '').toLowerCase());
    const kop2 = (tab.rijen[1] || []).map((h) => String(h || '').toLowerCase().trim());
    const kol = {
      inkoop: kop.findIndex((h) => /inko+p.*incl/.test(h)),
      rp: kop.findIndex((h) => /rp.*offerte|offerte.*nummer/.test(h)),
      nummer: kop.findIndex((h) => /^nummer/.test(h)),
      telefoon: kop.findIndex((h) => /telefoon/.test(h)),
      // "Akkoord → Datum" (kolom T in de 2026-tabs): rij 3 = "Akkoord" met rij 2 = "Datum" erboven (Daimy 29-08)
      akkoordDatum: kop.findIndex((h, i) => h.trim() === 'akkoord' && kop2[i] === 'datum'),
    };
    if (kol.inkoop < 0) continue; // tab zonder inkoopkolom is geen offertetab
    for (let r = 3; r < tab.rijen.length; r++) {
      const rij = tab.rijen[r] || [];
      if (rpSet.size && kol.rp >= 0) {
        const rpCel = String(rij[kol.rp] || '').replace(/\D/g, '');
        if (rpCel.length >= 6 && rpSet.has(rpCel)) return { tab: tab.titel, rijIndex: r, kol };
      }
      if (telefoon && kol.telefoon >= 0) {
        const telCel = laatste9(rij[kol.telefoon]);
        if (telCel.length === 9 && telCel === laatste9(telefoon)) return { tab: tab.titel, rijIndex: r, kol };
      }
      const nrCel = kol.nummer >= 0 ? String(rij[kol.nummer] || '').replace(/\D/g, '') : '';
      if (grippNr && nrCel && nrCel === String(grippNr)) return { tab: tab.titel, rijIndex: r, kol };
    }
  }
  return null;
}

function kolomLetter(i) {
  let s = '';
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
}

async function sheetsClient() {
  const { google } = require('googleapis');
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '..', '..', 'data', 'google-service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

/**
 * Maandtabs in zoek-volgorde: eerst de maanden van de OFFERTEDATUMS (daar staat de
 * rij — les Marjolein Nunnink: offerte 30 jan, rij in "Jan 2026"), dan de recente
 * 3 maanden, dan ALLE overige maandtabs als vangnet. Dubbelen eruit, volgorde blijft.
 */
async function tabsInZoekvolgorde(sheets, docDatums = []) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: 'sheets.properties.title' });
  const titels = meta.data.sheets.map((s) => s.properties.title);
  const isMaandtab = (t) => MAANDEN.some((m) => t.toLowerCase().trim().startsWith(m)) && /20\d\d/.test(t)
    && !/alles bij elkaar/i.test(t);
  const vindTab = (d) => titels.find((t) => t.toLowerCase().trim().startsWith(MAANDEN[d.getMonth()]) && t.includes(String(d.getFullYear())));
  const volgorde = [];
  for (const ts of docDatums) {
    const t = vindTab(new Date(ts));
    if (t) volgorde.push(t);
  }
  const nu = new Date();
  for (let terug = 0; terug < 3; terug++) {
    const t = vindTab(new Date(nu.getFullYear(), nu.getMonth() - terug, 1));
    if (t) volgorde.push(t);
  }
  for (const t of titels) if (isMaandtab(t)) volgorde.push(t);
  return [...new Set(volgorde)];
}

/**
 * Schrijf de inplanning. Geeft { gevonden: bool, tab, rij } terug.
 * datum als 'dd-mm-jjjj', inmeter als voornaam.
 */
async function schrijfInplanning({ rpNummers = [], grippNr, naam, telefoon, inmeetDatum, inmeter, docDatums = [], alleenAlsLeeg = false, geenNieuweRij = false }) {
  const sheets = await sheetsClient();
  const titels = await tabsInZoekvolgorde(sheets, docDatums);
  // tabs lui laden: zodra de rij gevonden is stoppen we met lezen
  const tabs = [];
  let plek = null;
  for (const titel of titels) {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${titel}'!A1:AH6000` });
    const tab = { titel, rijen: res.data.values || [] };
    tabs.push(tab);
    plek = vindRijEnKolommen([tab], { rpNummers, grippNr, telefoon });
    if (plek) break;
  }

  if (plek) {
    // alleenAlsLeeg (Outlook-sync, Daimy 16-08): een handmatig geplande afspraak mag
    // nooit een al ingevulde inkoop (echt bedrag) overschrijven — alleen een lege cel
    // of de bestaande €1-markering opnieuw zetten is veilig.
    if (alleenAlsLeeg) {
      const huidig = String(((tabs[tabs.length - 1].rijen[plek.rijIndex] || [])[plek.kol.inkoop]) ?? '').trim();
      if (huidig && !/^(€\s*)?1([,.]00?)?$/.test(huidig)) {
        return { gevonden: true, overgeslagen: 'inkoop al gevuld: ' + huidig, tab: plek.tab, rij: plek.rijIndex + 1, kolomInkoop: plek.kol.inkoop };
      }
    }
    const rijNr = plek.rijIndex + 1; // sheet is 1-based
    const van = kolomLetter(plek.kol.inkoop);
    const tot = kolomLetter(plek.kol.inkoop + 2);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${plek.tab}'!${van}${rijNr}:${tot}${rijNr}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[1, inmeetDatum, inmeter]] },
    });
    return { gevonden: true, tab: plek.tab, rij: rijNr, kolomInkoop: plek.kol.inkoop };
  }

  // geenNieuweRij (Outlook-sync): geen losse akkoordrij aanmaken — de aanroeper zet de
  // schrijfactie in de wachtrij en het sheet-vangnet maakt de offerte-rij; daarna slaagt
  // een volgende poging alsnog.
  if (geenNieuweRij) return { gevonden: false, geenRij: true };

  // niet gevonden: nieuwe rij onderaan de huidige maandtab (losse akkoordrij, bestaand patroon)
  const tab = tabs[0];
  const kop = (tab.rijen[2] || []).map((h) => String(h || '').toLowerCase());
  const kol = {
    naam: kop.findIndex((h) => /naam/.test(h)),
    nummer: kop.findIndex((h) => /^nummer/.test(h)),
    telefoon: kop.findIndex((h) => /telefoon/.test(h)),
    inkoop: kop.findIndex((h) => /inko+p.*incl/.test(h)),
  };
  const rij = [];
  if (kol.naam >= 0) rij[kol.naam] = naam;
  if (kol.telefoon >= 0) rij[kol.telefoon] = telefoon || 'zie gripp';
  if (kol.nummer >= 0) rij[kol.nummer] = grippNr;
  rij[kol.inkoop] = 1;
  rij[kol.inkoop + 1] = inmeetDatum;
  rij[kol.inkoop + 2] = inmeter;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `'${tab.titel}'!A:A`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rij.map((c) => c ?? '')] },
  });
  return { gevonden: false, tab: tab.titel, rij: 'nieuw', kolomInkoop: kol.inkoop };
}

/** Rollback (Daimy V3): de drie cellen inkoop/inmeetdatum/inmeter weer leegmaken. */
/** AKKOORDDATUM IN DE SHEET (Daimy 29-08: "vanaf nu ook de datum van akkoord in kolom T, zodat we
 *  weten hoelang het duurde en of winkelmensen uiteindelijk toch nog akkoord gingen").
 *  Vult de "Akkoord → Datum"-kolom van de bestaande offerterij (gevonden op RP-nummer / telefoon /
 *  Gripp-nummer), alleen als die cel leeg is; maakt nooit een nieuwe rij. Datum als d-m-jj (sheet-stijl). */
async function schrijfAkkoordDatum({ rpNummers = [], grippNr, telefoon, datum = new Date(), docDatums = [] }) {
  const sheets = await sheetsClient();
  const titels = await tabsInZoekvolgorde(sheets, docDatums);
  let plek = null, tabData = null;
  for (const titel of titels) {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${titel}'!A1:AH6000` });
    const tab = { titel, rijen: res.data.values || [] };
    plek = vindRijEnKolommen([tab], { rpNummers, grippNr, telefoon });
    if (plek) { tabData = tab; break; }
  }
  if (!plek) return { gevonden: false };
  if (plek.kol.akkoordDatum < 0) return { gevonden: true, overgeslagen: 'tab heeft geen Akkoord/Datum-kolom', tab: plek.tab, rij: plek.rijIndex + 1 };
  const huidig = String(((tabData.rijen[plek.rijIndex] || [])[plek.kol.akkoordDatum]) ?? '').trim();
  if (huidig) return { gevonden: true, overgeslagen: 'akkoorddatum al gevuld: ' + huidig, tab: plek.tab, rij: plek.rijIndex + 1 };
  const d = new Date(datum);
  const tekst = `${d.getDate()}-${d.getMonth() + 1}-${String(d.getFullYear()).slice(-2)}`;
  const cel = `'${plek.tab}'!${kolomLetter(plek.kol.akkoordDatum)}${plek.rijIndex + 1}`;
  await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: cel, valueInputOption: 'USER_ENTERED', requestBody: { values: [[tekst]] } });
  return { gevonden: true, geschreven: tekst, tab: plek.tab, rij: plek.rijIndex + 1, cel };
}

async function maakCellenLeeg({ tab, rij, kolomInkoop }) {
  if (!tab || !Number.isInteger(rij) || !(kolomInkoop >= 0)) throw new Error('sheet-locatie onvolledig');
  const sheets = await sheetsClient();
  const van = kolomLetter(kolomInkoop);
  const tot = kolomLetter(kolomInkoop + 2);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${tab}'!${van}${rij}:${tot}${rij}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['', '', '']] },
  });
}

module.exports = { schrijfInplanning, schrijfAkkoordDatum, vindRijEnKolommen, tabsInZoekvolgorde, maakCellenLeeg };

// OFFERTE-RIJ IN HET OFFERTE-REGISTER VOOR EIGEN OFFERTES (blok 1/4 "Reuzenpanda uitzetten", 30-08-2026).
// De Zapier-zap "RP Offerte → Sheets" zet voor elke Reuzenpanda-offerte een rij in de maandtab van het register
// (Sheet 1NesKe…). Eigen offertes (S26-…) komen daar niet vanzelf in, terwijl conversie, inplannen (sheet-inplannen.js)
// en akkoord-datum (schrijfAkkoordDatum) op die rij leunen. Dit schrijft precies zo'n rij, in dezelfde kolommen als de zap:
//   A datum (d-m-jj) · B voornaam · C achternaam · D woonplaats · E telefoon · F bedrag incl btw · G "RP offerte" = offertenummer
//   H (optie, leeg) · I Online/Winkel · J afkomst · K Prive/Zakelijk · L productcategorie · M akkoord FALSE · P whatsapp FALSE
// Regels (orakel, ook in scenario-lab/onderdelen/sheet-eigen-offerte.js):
//   R1 nooit een tweede rij voor hetzelfde offertenummer (kolom G) — bestaat hij al: overslaan, melden waar hij staat
//   R2 testkaarten (naam met 'test') nooit in het register
//   R3 de rij komt in de maandtab van de VERZENDdatum; bestaat die tab niet: niet schrijven, zichtbaar melden (fout-zichtbaar)
//   R4 kolommen altijd via de kopregel (rij 3) bepalen, nooit vaste indexen (kolomindexen verschillen per tab)
//   R5 nooit een bestaande rij overschrijven: alleen de eerste volledig lege rij ná de laatste gevulde rij
const path = require('path');

const SHEET_ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';
const MAANDEN = ['jan', 'feb', 'maart', 'april', 'mei', 'juni', 'juli', 'aug', 'sep', 'okt', 'nov', 'dec'];
const TESTKAART = /\btest\b|reuzenpanda|^[\s/|-]+$/i;

async function echteClient() {
  const { google } = require('googleapis');
  const auth = new google.auth.GoogleAuth({ keyFile: path.join(__dirname, '..', '..', 'data', 'google-service-account.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  return {
    async tabs() { const m = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: 'sheets.properties.title' }); return m.data.sheets.map((s) => s.properties.title); },
    async lees(tab, bereik) { const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${tab}'!${bereik}` }); return r.data.values || []; },
    async schrijf(tab, bereik, waarden) { await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `'${tab}'!${bereik}`, valueInputOption: 'USER_ENTERED', requestBody: { values: [waarden] } }); },
  };
}

const kolomLetter = (i) => { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const laatste9 = (t) => String(t || '').replace(/\D/g, '').slice(-9);
const datumKort = (d) => `${d.getDate()}-${d.getMonth() + 1}-${String(d.getFullYear()).slice(2)}`;

function vindTab(titels, d) {
  return titels.find((t) => t.toLowerCase().trim().startsWith(MAANDEN[d.getMonth()]) && t.includes(String(d.getFullYear())) && !/alles bij elkaar/i.test(t)) || null;
}

function kolommen(kop3) {
  const kop = (kop3 || []).map((h) => String(h || '').toLowerCase().trim());
  const zoek = (re) => kop.findIndex((h) => re.test(h));
  return {
    datum: zoek(/^datum/), voornaam: zoek(/^voornaam/), achternaam: zoek(/^achternaam/), plaats: zoek(/woonplaats/), telefoon: zoek(/telefoon/),
    bedrag: zoek(/incl btw/), nummer: zoek(/rp.*offerte|offerte.*nummer/), kanaal: zoek(/^online/), afkomst: zoek(/afkomst/), klant: zoek(/wat voor klant/),
    product: zoek(/product cat/), akkoord: zoek(/^akkoord$/), whatsapp: zoek(/^whatsapp/),
  };
}

/**
 * Schrijft één offerte-rij. rij = { nummer, datum(ISO), voornaam, achternaam, plaats, telefoon, bedrag, kanaal, afkomst, klant, product }.
 * Geeft { status: 'geschreven'|'bestaat'|'testkaart'|'geen-tab'|'geen-kolommen', tab, rij } terug. dryRun schrijft niets.
 */
async function schrijfOfferteRij(rij, { dryRun = false, client = null } = {}) {
  const naam = `${rij.voornaam || ''} ${rij.achternaam || ''}`.trim();
  if (TESTKAART.test(naam) || TESTKAART.test(String(rij.nummer || ''))) return { status: 'testkaart', naam };
  if (!rij.nummer) return { status: 'geen-nummer', naam };
  const c = client || await echteClient();
  const d = new Date(rij.datum || Date.now());
  const tab = vindTab(await c.tabs(), d);
  if (!tab) return { status: 'geen-tab', naam, maand: `${MAANDEN[d.getMonth()]} ${d.getFullYear()}`, melding: true };
  const rijen = await c.lees(tab, 'A1:AB3000');
  const kol = kolommen(rijen[2]);
  if (kol.nummer < 0 || kol.datum < 0 || kol.voornaam < 0) return { status: 'geen-kolommen', naam, tab, melding: true };
  const nummerCijfers = String(rij.nummer).replace(/\D/g, '');
  let laatsteGevuld = 2;
  for (let r = 3; r < rijen.length; r++) {
    const x = rijen[r] || [];
    if (x.slice(0, 12).some((v) => String(v || '').trim())) laatsteGevuld = r;
    const cel = String(x[kol.nummer] || '').trim();
    if (cel && (cel === String(rij.nummer) || (nummerCijfers.length >= 6 && cel.replace(/\D/g, '') === nummerCijfers))) return { status: 'bestaat', naam, tab, rij: r + 1 };
  }
  const doel = laatsteGevuld + 1; // eerste lege rij na de laatste gevulde (0-based index) → Sheet-rij doel+1
  const breedte = Math.max(kol.whatsapp, kol.akkoord, kol.product, kol.nummer) + 1;
  const waarden = new Array(breedte).fill('');
  const zet = (i, v) => { if (i >= 0) waarden[i] = v; };
  zet(kol.datum, datumKort(d)); zet(kol.voornaam, rij.voornaam || ''); zet(kol.achternaam, rij.achternaam || ''); zet(kol.plaats, rij.plaats || '');
  zet(kol.telefoon, rij.telefoon || ''); zet(kol.bedrag, rij.bedrag == null ? '' : Number(rij.bedrag)); zet(kol.nummer, String(rij.nummer));
  zet(kol.kanaal, rij.kanaal || 'Online'); zet(kol.afkomst, rij.afkomst || 'Website'); zet(kol.klant, rij.klant || 'Prive'); zet(kol.product, rij.product || '');
  zet(kol.akkoord, false); zet(kol.whatsapp, false);
  const bereik = `A${doel + 1}:${kolomLetter(breedte - 1)}${doel + 1}`;
  if (!dryRun) await c.schrijf(tab, bereik, waarden);
  return { status: dryRun ? 'zou-schrijven' : 'geschreven', naam, tab, rij: doel + 1, bereik, waarden };
}

module.exports = { schrijfOfferteRij, vindTab, kolommen, SHEET_ID, TESTKAART };

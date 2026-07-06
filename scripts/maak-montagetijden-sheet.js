#!/usr/bin/env node
// Eenmalig: maakt de Google Sheet "Montagetijden Sonty" met twee tabbladen
// (producten + variabelen) en deelt hem met Daimy. Productbron:
// docs/montagetijden-per-product.md / offerte-tool pricing.ts (2026-07-06).
const path = require('path');
const { google } = require('googleapis');

const PRODUCTEN = [
  ['Screens', 'Zip Design 110'],
  ['Screens', 'Zip Square 85/100'],
  ['Screens', 'Screen Square 85/100'],
  ['Screens', 'Roma zipSCREEN.2 (windvast ritsscreen)'],
  ['Knikarmschermen', 'SunEye'],
  ['Knikarmschermen', 'SunEye XL'],
  ['Knikarmschermen', 'SunElite'],
  ['Knikarmschermen', 'SunBasic'],
  ['Knikarmschermen', 'SunBasic Cassette'],
  ['Knikarmschermen', 'SunEye Voorraadscherm (5000×3000, actie)'],
  ['Rolluiken', 'Rolluik S-42 (RollSUPER)'],
  ['Rolluiken', 'Rolluik S-37'],
  ['Rolluiken', 'Roma rolluik .XP geëxtrudeerd (premium)'],
  ['Rolluiken', 'Roma rolluik .P geëxtrudeerd (standaard)'],
  ['Rolluiken', 'Roma rolluik .P gerolvormd (instap)'],
  ['Uitvalschermen', 'SunCube 150 (Suncube XL)'],
  ['Uitvalschermen', 'SunProject 100'],
  ['Serre/pergola', 'SunControl 150'],
  ['Serre/pergola', 'SunControl 165 ZIP'],
  ['Serre/pergola', 'SunControl Pergola'],
  ['Markiezen', 'Markies grenenhouten kap'],
  ['Markiezen', 'Markies hardhouten kap (meranti)'],
  ['Markiezen', 'Markies aluminium kap'],
  ['Horren', 'Raamrolhor Comfort'],
  ['Horren', 'Raamrolhor Super+'],
  ['Horren', 'Raamhor vast Voorzethor'],
  ['Horren', 'Raamhor vast Inklemhor'],
  ['Horren', 'Raamhor vast Veerstifthor / Softfit'],
  ['Horren', 'Raamplissé Voorzet Unit'],
  ['Horren', 'Raamplissé Inklem Unit'],
  ['Horren', 'Raamplissé Dubbel Systeem'],
  ['Horren', 'Hordeur Plisséfit (enkel)'],
  ['Horren', 'Hordeur Dubbele Plisséfit'],
  ['Horren', 'Vaste hordeur Luxe'],
  ['Horren', 'Schuifhordeur Luxe'],
  ['Binnenzonwering/overig', 'Gordijnen (ophangen, per raam)'],
  ['Binnenzonwering/overig', 'Plissé / duette (per raam)'],
  ['Binnenzonwering/overig', 'Behang (Arte, per wand)'],
  ['Binnenzonwering/overig', 'Buitenjaloezieën Roma (uitvoering volgt)'],
];

const VARIABELEN = [
  ['Bediening', 'Bedraad (io/draaischakelaar): elektra trekken en aansluiten', 'screens, rolluiken, knikarm, uitval, serre/pergola'],
  ['Bediening', 'Solar: geen bekabeling', 'screens, rolluiken, markiezen'],
  ['Bediening', 'Bandbediening: bandgeleider door kozijn', 'rolluiken'],
  ['Bediening', 'Smart home instellen (Tahoma Switch)', 'alles met io'],
  ['Locatie', 'Verdieping 1e/2e met ladder', 'alles'],
  ['Locatie', 'Boven 2e verdieping: hoogwerker nodig', 'alles'],
  ['Locatie', 'Slechte bereikbaarheid (geen achterom, alles door de woning)', 'alles'],
  ['Locatie', 'Montage op uitbouw/serre', 'knikarmschermen'],
  ['Ondergrond', 'Isolatiegevel/spouw (speciale bevestiging)', 'gevelmontage'],
  ['Ondergrond', 'Hout of kunststof i.p.v. steen', 'gevelmontage'],
  ['Ondergrond', 'In-de-dag montage (in de nis) i.p.v. op de gevel', 'screens, rolluiken, horren'],
  ['Maat', 'Extra breed element (bijv. > 450 cm): 2e monteur nodig', 'knikarm, serre/pergola, screens'],
  ['Maat', 'Koppeling van 2 elementen (aandrijfcombi/kastkoppeling)', 'rolluiken, screens'],
  ['Oud product', 'Demontage + afvoer oud product (per element)', 'alles'],
  ['Overig', 'Verlengde muursteunen', 'knikarmschermen'],
  ['Overig', 'Inmeetafspraak (losse afspraak, geen montage)', 'n.v.t.'],
];

// De service account mag geen nieuwe bestanden aanmaken (Drive API uit), dus de
// tijden komen als twee nieuwe tabs in het bestaande offerte-register waar het
// team toch al in werkt. Bestaande tabs en de Zapier-zap blijven onaangeraakt.
const REGISTER_ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';

(async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '..', 'data', 'google-service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: REGISTER_ID });
  const bestaand = meta.data.sheets.map(s => s.properties.title);
  const toeTeVoegen = ['Montagetijden', 'Montage-variabelen'].filter(t => !bestaand.includes(t));
  if (toeTeVoegen.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: REGISTER_ID,
      requestBody: { requests: toeTeVoegen.map(title => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } })) },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: REGISTER_ID, range: 'Montagetijden!A1', valueInputOption: 'RAW',
    requestBody: { values: [
      ['Categorie', 'Product', 'Basistijd 1e element (min)', 'Per extra element (min)', 'Aantal monteurs', 'Opmerkingen'],
      ...PRODUCTEN.map(([c, p]) => [c, p, '', '', '', '']),
    ] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: REGISTER_ID, range: "'Montage-variabelen'!A1", valueInputOption: 'RAW',
    requestBody: { values: [
      ['Groep', 'Variabele', 'Geldt voor', 'Extra minuten (+/-)', 'Opmerkingen'],
      ...VARIABELEN.map(([g, v, w]) => [g, v, w, '', '']),
    ] },
  });

  // Opmaak: vetgedrukte kopregel + bredere kolommen
  const meta2 = await sheets.spreadsheets.get({ spreadsheetId: REGISTER_ID });
  const ids = meta2.data.sheets.filter(s => ['Montagetijden', 'Montage-variabelen'].includes(s.properties.title)).map(s => s.properties.sheetId);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: REGISTER_ID,
    requestBody: { requests: ids.flatMap(sid => [
      { repeatCell: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } },
      { updateDimensionProperties: { range: { sheetId: sid, dimension: 'COLUMNS', startIndex: 1, endIndex: 3 }, properties: { pixelSize: 320 }, fields: 'pixelSize' } },
    ]) },
  });

  console.log('Tabs klaar in het offerte-register: https://docs.google.com/spreadsheets/d/' + REGISTER_ID + ' (tabs "Montagetijden" en "Montage-variabelen")');
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });

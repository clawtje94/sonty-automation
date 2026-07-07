#!/usr/bin/env node
// Vult in de tab "Vertraging. " van het offerte-register per klantregel het
// e-mailadres (kolom F) en telefoonnummer (kolom G) in, opgezocht in Gripp.
// Match: 4-cijferig Gripp-offertenummer in de naam (of ordernummer-kolom),
// anders op naam (alleen bij ondubbelzinnige match; anders een notitie).
// Gripp is ALLEEN-LEZEN en zuinig: alles gebatcht in ~5 HTTP-calls.
// Gebruik: node scripts/vertraging-contactgegevens.js [--dry]

const { google } = require('googleapis');
const path = require('path');

const GRIPP_KEY = 'WZvM6r0bAGGONGRhrkWTxVrydXq9H2';
const SHEET_ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';
const TAB = 'Vertraging. ';
const DRY = process.argv.includes('--dry');

const INTERN = /^(levering\b|somfy\b|voorraad\b|vriend joey|show jo\b|sjoerd prive|daimi$|marvin zzp|leco van zadelhoff)/i;

async function gripp(batch) {
  const r = await fetch('https://api.gripp.com/public/api3.php', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + GRIPP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(batch),
  });
  if (!r.ok) throw new Error('Gripp HTTP ' + r.status);
  return r.json();
}

(async () => {
  const auth = new google.auth.GoogleAuth({ keyFile: path.join(__dirname, '..', 'data', 'google-service-account.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${TAB}'!A1:G200` });
  const rows = res.data.values || [];

  // 1. Regels classificeren
  const klanten = []; // {rij(1-based), naam, plaats, nummer|null}
  rows.forEach((row, i) => {
    const rij = i + 1;
    if (rij === 1) return; // header
    const naam = (row[0] || '').trim();
    if (!naam || INTERN.test(naam)) return;
    if ((row[5] || '').trim() || (row[6] || '').trim()) return; // al ingevuld
    let nummer = naam.match(/\b(\d{4})\b/)?.[1] || null;
    if (!nummer) {
      const orderCol = (row[3] || '').trim();
      if (/^\d{4}$/.test(orderCol)) nummer = orderCol; // bv Henk Otto: 1610 in kolom D
    }
    klanten.push({ rij, naam, plaats: (row[1] || '').trim(), nummer: nummer ? Number(nummer) : null });
  });
  console.log('Klantregels te vullen:', klanten.length, '| met Gripp-nummer:', klanten.filter(k => k.nummer).length, '| alleen naam:', klanten.filter(k => !k.nummer).length);

  // 2. Alle genummerde offertes in ÉÉN call
  const nummers = [...new Set(klanten.filter(k => k.nummer).map(k => k.nummer))];
  const offerRes = await gripp([{ method: 'offer.get', params: [[{ field: 'offer.number', operator: 'in', value: nummers }], { paging: { firstresult: 0, maxresults: 250 } }], id: 1 }]);
  const offers = offerRes[0].result?.rows || [];
  const companyIdByNummer = {};
  for (const o of offers) if (o.company?.id) companyIdByNummer[o.number] = o.company.id;
  console.log('Offertes gevonden in Gripp:', offers.length, 'van', nummers.length);

  // 3. Alle companies in ÉÉN call
  const ids = [...new Set(Object.values(companyIdByNummer))];
  await new Promise(r => setTimeout(r, 1500));
  const compRes = await gripp([{ method: 'company.get', params: [[{ field: 'company.id', operator: 'in', value: ids }], { paging: { firstresult: 0, maxresults: 250 } }], id: 1 }]);
  const companies = compRes[0].result?.rows || [];
  const compById = {};
  for (const c of companies) compById[c.id] = c;
  console.log('Companies opgehaald:', companies.length);

  // 4. Naam-zoekopdrachten voor regels zonder nummer, gebatcht (8 per call)
  const zonderNummer = klanten.filter(k => !k.nummer);
  const zoekterm = (naam) => naam
    .replace(/\b(nabestelling|\(nabestelling\)|MST|\(zelfmontage\)|\?|,.*$)/gi, '')
    .replace(/\s+/g, ' ').trim();
  // Plaatsen fuzzy vergelijken: Gripp schrijft bv. "Hendrik Ido-Ambacht" en
  // "Krimpen aan den IJssel" nét anders dan de sheet.
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '');
  const stadVan = (h) => norm(h.visitingaddress_city || h.postaddress_city);
  const filterOpPlaats = (hits, plaats) => {
    if (!plaats || plaats === 'Afhalen') return hits;
    const op = hits.filter(h => stadVan(h) === norm(plaats));
    return op.length ? op : hits;
  };

  const matchByRij = {};
  const zoekRonde = async (items, termFn, eisPlaats) => {
    for (let i = 0; i < items.length; i += 8) {
      const chunk = items.slice(i, i + 8);
      const batch = chunk.map((k, idx) => ({
        method: 'company.get',
        params: [[{ field: 'company.searchname', operator: 'like', value: '%' + termFn(k) + '%' }], { paging: { firstresult: 0, maxresults: 8 } }],
        id: idx + 1,
      }));
      await new Promise(r => setTimeout(r, 1500));
      const out = await gripp(batch);
      out.forEach((resp, idx) => {
        const k = chunk[idx];
        if (resp.error) { console.log('  (zoekfout ' + k.naam + ': ' + JSON.stringify(resp.error).slice(0, 80) + ')'); return; }
        let hits = filterOpPlaats(resp.result?.rows || [], k.plaats);
        // Korte term of achternaam-fallback: alleen vertrouwen mét plaatsbevestiging
        const kort = termFn(k).length < 4;
        if (hits.length === 1 && (kort || eisPlaats)) {
          if (!k.plaats || k.plaats === 'Afhalen' || stadVan(hits[0]) !== norm(k.plaats)) hits = [];
        }
        if (hits.length) matchByRij[k.rij] = hits;
      });
    }
  };

  await zoekRonde(zonderNummer, (k) => zoekterm(k.naam), false);
  // Fallback: niet gevonden → zoek op laatste naamdeel, maar eis dat de plaats klopt
  const rest = zonderNummer.filter(k => !(matchByRij[k.rij]?.length));
  const laatsteWoord = (k) => { const w = zoekterm(k.naam).split(' '); return w[w.length - 1]; };
  await zoekRonde(rest.filter(k => laatsteWoord(k).length >= 4 && zoekterm(k.naam).includes(' ')), laatsteWoord, true);

  // 4b. Handmatig geverifieerde matches (kandidaten bekeken 2026-07-07):
  // naam-fragment → Gripp company id. Alleen waar naam+plaats eenduidig klopten.
  const OVERRIDES = [
    { test: /^Nelemans/i, id: 98245 },            // Corne Nelemans, "Sleewijk" (typefout in Gripp) = Sleeuwijk
    { test: /^Ortho 's Gravenzande/i, id: 98432 }, // Orthodontiepraktijk 's gravenzande
    { test: /^Verburg/i, id: 99208 },              // Chris Verburg, Waarder
    { test: /^Ron de Bruijn/i, id: 96259 },        // Ron de Bruin (spelvariant), Zoetermeer
  ];
  const HINTS = [
    { test: /^Robben/i, hint: 'waarschijnlijk Lorenzo Robben #95908 (Roelofarendsveen, fam.robben2021@gmail.com) — plaats wijkt af, check' },
    { test: /^Bergsma MST/i, hint: 'mogelijk Eric Bergsma #98462 (Krimpen a/d Lek, info@bergsmabeheer.nl) — plaats wijkt af, check' },
    { test: /van Dijk, broer Koen/i, hint: 'niet in Gripp onder Martijn van Dijk — staat mogelijk op naam van broer Koen' },
  ];
  const overrideIds = OVERRIDES.map(o => o.id);
  await new Promise(r => setTimeout(r, 1500));
  const ovRes = await gripp([{ method: 'company.get', params: [[{ field: 'company.id', operator: 'in', value: overrideIds }], { paging: { firstresult: 0, maxresults: 10 } }], id: 1 }]);
  for (const c of (ovRes[0].result?.rows || [])) compById[c.id] = c;

  // 5. Resultaat opbouwen + wegschrijven (kolommen F en G per regel)
  const updates = [];
  const rapport = { ok: 0, meerdere: 0, nietGevonden: 0 };
  for (const k of klanten) {
    let c = null, notitie = '';
    const override = OVERRIDES.find(o => o.test.test(k.naam));
    if (override) c = compById[override.id];
    else if (k.nummer) {
      c = compById[companyIdByNummer[k.nummer]];
      if (!c) notitie = 'offerte ' + k.nummer + ' niet in Gripp';
    } else {
      const hits = matchByRij[k.rij] || [];
      if (hits.length === 1) c = hits[0];
      else {
        const hint = HINTS.find(h => h.test.test(k.naam));
        if (hint) notitie = hint.hint;
        else if (hits.length > 1) notitie = hits.length + ' matches in Gripp — handmatig kiezen';
        else notitie = 'niet gevonden in Gripp';
      }
    }
    let email = '', tel = '';
    if (c) {
      email = c.email || c.invoiceemail || '';
      tel = c.mobile || c.phone || '';
      if (!email && !tel) notitie = 'in Gripp maar geen contactgegevens';
    }
    if (c && (email || tel)) rapport.ok++;
    else if (/matches/.test(notitie)) rapport.meerdere++;
    else rapport.nietGevonden++;
    const fWaarde = email || (notitie ? '⚠️ ' + notitie : '');
    updates.push({ range: `'${TAB}'!F${k.rij}:G${k.rij}`, values: [[fWaarde, tel]] });
    console.log((c && (email || tel) ? 'OK  ' : 'LET ') + k.naam.padEnd(38) + ' | ' + (email || '-').padEnd(35) + ' | ' + (tel || '-') + (notitie ? '  [' + notitie + ']' : ''));
  }

  if (!DRY && updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: 'RAW', data: updates },
    });
    console.log('\nWeggeschreven naar de sheet:', updates.length, 'regels.');
  } else if (DRY) console.log('\nDRY-RUN: niets weggeschreven.');
  console.log('Rapport: gevuld=' + rapport.ok + ' | meerdere matches=' + rapport.meerdere + ' | niet gevonden=' + rapport.nietGevonden);
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });

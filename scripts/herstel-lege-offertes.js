#!/usr/bin/env node
/**
 * HERSTEL: klanten die een leeg ticket kregen omdat template 242731 werd geweigerd.
 *
 * Op 27 juli bleek offerte_ab1_inmeten (242731) door Trengo geweigerd te worden met "De template
 * bestaat niet in de opgegeven taal of de template is niet goedgekeurd", terwijl hij in de API
 * identiek is aan de drie varianten die wél werken. Bij 16 van de 18 pogingen kwam het bericht
 * niet aan en bleef er een leeg ticket achter. Die klanten hebben hun offerte dus nooit gezien,
 * terwijl v4 ze wel als verstuurd had afgevinkt.
 *
 * Dit script stuurt ze alsnog, via een template die wél werkt, met exact dezelfde bedragen.
 *
 * Gebruik:
 *   node scripts/herstel-lege-offertes.js         → laat zien wie er aan de beurt is
 *   node scripts/herstel-lege-offertes.js --echt  → daadwerkelijk versturen
 */
const fs = require('fs');
const path = require('path');
const { getToken } = require('./trengo-api.js');
const CFG = require('./ai-ks/config.js');
const { bouwParams } = require('./offerte-template-vars.js');

const ECHT = process.argv.includes('--echt');
// Verdelen over de drie werkende varianten in plaats van allemaal dezelfde (Daimy 27 juli),
// zodat de A/B-test zuiver blijft. De registratie wordt daarna bijgewerkt naar de variant die
// de klant écht heeft gekregen, anders meet het rapport straks de verkeerde tekst.
const WERKEND = [
  { id: 242737, naam: 'garantie' },
  { id: 242738, naam: 'check' },
  { id: 242739, naam: 'kortweg' },
];
const STATE = path.join(__dirname, '..', 'data', 'ab-test-state.json');

const rpGet = async (ep) => {
  const r = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY } });
  return r.ok ? r.json() : null;
};

(async () => {
  const jwt = await getToken();
  const H = { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json', Accept: 'application/json' };
  const ab = JSON.parse(fs.readFileSync(STATE, 'utf8')).toewijzingen || {};
  // Alleen wie de kapotte variant kreeg.
  const kandidaten = Object.entries(ab).filter(([, v]) => v.naam === 'inmeten');
  console.log(`${kandidaten.length} klanten kregen de variant die niet aankwam\n`);

  const board = await rpGet(`/contact-service/${CFG.RP_PID}/boards/${CFG.RP_BOARD}/items`);
  let hersteld = 0, overgeslagen = 0;

  for (const [tel, toew] of kandidaten) {
    // Heeft deze klant inmiddels tóch een bericht? Dan niets doen.
    const zoek = await (await fetch(`https://app.trengo.com/api/v2/tickets?term=${tel}`, { headers: H })).json();
    let heeftBericht = false;
    for (const t of (zoek.data || [])) {
      const m = await (await fetch(`https://app.trengo.com/api/v2/tickets/${t.id}/messages`, { headers: H })).json();
      if ((m.data || []).length) { heeftBericht = true; break; }
    }
    if (heeftBericht) { overgeslagen++; console.log(`  ${tel}: heeft al een bericht, overgeslagen`); continue; }

    const item = (board?.items || []).find((i) => JSON.stringify(i.free_fields || []).replace(/[^0-9,"]/g, '').includes(tel.slice(-9)));
    if (!item) { console.log(`  ${tel}: geen RP-dossier gevonden, handmatig nakijken`); continue; }
    const voornaam = (String(item.description || '').match(/Voornaam:\s*([^\n]+)/i) || [])[1]?.trim()
      || String(item.summary || '').split(' ')[0];

    const lijst = await rpGet(`/document-service/v1/${CFG.RP_PID}/quotations?lead_configuration_id=${item.item_subject.id}`);
    const doc = (lijst?.quotationDatas || [])[0];
    if (!doc) { console.log(`  ${tel} (${voornaam}): geen offerte, overgeslagen`); continue; }
    const link = `https://document.reuzenpanda.nl/nl/${CFG.RP_PID}/${doc.documentId}/latest`;
    const detail = await rpGet(`/document-service/v1/${CFG.RP_PID}/quotations/${doc.documentId}`);
    const g = bouwParams({ voornaam, quotationLijstItem: doc, quotationDetail: detail?.quotationData || detail, offerteLink: link });
    if (!g.ok) { console.log(`  ${tel} (${voornaam}): ${g.reden}, overgeslagen`); continue; }

    const variant = WERKEND[hersteld % WERKEND.length];
    if (!ECHT) { console.log(`  ${tel} (${voornaam}): zou offerte ${doc.quotationNumber} sturen via ${variant.naam}, ${g.params[2].value}`); hersteld++; continue; }

    const r = await fetch('https://app.trengo.com/api/v2/wa_sessions', {
      method: 'POST', headers: H,
      body: JSON.stringify({ recipient_phone_number: tel.startsWith('+') ? tel : '+' + tel, hsm_id: variant.id, channel_id: 1359857, params: g.params }),
    });
    if (r.ok) {
      hersteld++;
      console.log(`  ${tel} (${voornaam}): VERSTUURD via ${variant.naam}, offerte ${doc.quotationNumber}`);
      // Registratie bijwerken naar wat de klant echt kreeg.
      try {
        const st = JSON.parse(fs.readFileSync(STATE, 'utf8'));
        if (st.toewijzingen[tel]) {
          st.toewijzingen[tel].naam = variant.naam;
          st.toewijzingen[tel].templateId = variant.id;
          st.toewijzingen[tel].tijd = new Date().toISOString();
          st.toewijzingen[tel].herstel = 'oorspronkelijk inmeten, niet aangekomen';
          fs.writeFileSync(STATE, JSON.stringify(st, null, 1));
        }
      } catch (e) { console.log('     (registratie bijwerken mislukt: ' + e.message + ')'); }
    }
    else console.log(`  ${tel} (${voornaam}): FOUT ${r.status} ${(await r.text()).slice(0, 120)}`);
    await new Promise((x) => setTimeout(x, 1500));
  }
  console.log(`\n${ECHT ? 'hersteld: ' + hersteld : 'dry-run'}, overgeslagen (had al bericht): ${overgeslagen}`);
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });

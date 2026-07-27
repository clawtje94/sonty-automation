#!/usr/bin/env node
/**
 * WACHTER voor de nieuwe AB1-template (Daimy 2026-07-27).
 *
 * De eerste AB1 (242731, offerte_ab1_inmeten) stond in Trengo op ACCEPTED, maar Meta weigerde hem
 * alsnog bij het versturen: 16 van de 18 berichten kwamen niet aan en lieten een leeg ticket bij de
 * klant achter. Daarom is de status in Trengo hier NIET genoeg om hem live te zetten. Deze wachter
 * doet daarom twee dingen achter elkaar:
 *
 *   1. status van 242818 (offerte_ab1_inmetenv2) opvragen; PENDING = niets doen, later opnieuw;
 *   2. bij ACCEPTED eerst een ECHTE testverzending naar Daimy's testnummer. Pas als die slaagt
 *      wordt de variant aan de A/B-rotatie toegevoegd.
 *
 * Zo kan een template die Meta stilzwijgend weigert nooit meer een hele verzendronde verpesten.
 * Draait via launchd (nl.sonty.ab1-wachter), elk half uur, en stopt zichzelf zodra hij klaar is.
 *
 * Handmatig: node scripts/ab1-activeren.js
 */
const fs = require('fs');
const path = require('path');
const CFG = require('./ai-ks/config.js');
const { getToken } = require('./trengo-api.js');
const { bouwParams } = require('./offerte-template-vars.js');

const TEMPLATE_ID = 242818;
const TEMPLATE_NAAM = 'offerte_ab1_inmetenv2';
const VARIANT_NAAM = 'inmeten';
const TESTNUMMER = '+31643473757';        // testnummer van Daimy, expliciet door hem aangewezen
const KANAAL = 1359857;
const VERDELER = path.join(__dirname, 'ab-template-verdeler.js');
const KLAAR = path.join(__dirname, '..', 'data', '.ab1-geactiveerd');

const RP = { PID: CFG.RP_PID, BOARD: CFG.RP_BOARD, KEY: CFG.RP_API_KEY };

async function telegram(tekst) {
  await fetch(`https://api.telegram.org/bot${CFG.TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CFG.TG_CHAT, text: tekst }),
  }).catch(() => {});
}

/** Pakt een echte, recente offerte zodat de testverzending dezelfde vorm heeft als een live bericht. */
async function testParams() {
  const H = { Authorization: 'Bearer ' + RP.KEY };
  const board = await (await fetch(`https://backend.reuzenpanda.nl/contact-service/${RP.PID}/boards/${RP.BOARD}/items`, { headers: H })).json();
  for (const it of (board.items || []).slice(-250).reverse()) {
    if (!it.item_subject?.id) continue;
    let q;
    try { q = await (await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${RP.PID}/quotations?lead_configuration_id=${it.item_subject.id}`, { headers: H })).json(); } catch { continue; }
    const lijst = (q.quotationDatas || [])[0];
    if (!lijst) continue;
    let detail;
    try { detail = (await (await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${RP.PID}/quotations/${lijst.documentId}`, { headers: H })).json()).quotationData; } catch { continue; }
    const g = bouwParams({
      voornaam: 'Daimy', quotationLijstItem: lijst, quotationDetail: detail,
      offerteLink: `https://document.reuzenpanda.nl/nl/${RP.PID}/${lijst.documentId}/latest?pdfAction=DOCSIGN`,
    });
    if (g.ok) return g.params;
  }
  return null;
}

/** Zet de variant in de rotatie door de uitgecommentarieerde regel te activeren. */
function activeerInVerdeler() {
  const src = fs.readFileSync(VERDELER, 'utf8');
  if (new RegExp(`^\\s*\\{ id: ${TEMPLATE_ID},`, 'm').test(src)) return 'stond er al in';
  const regel = `  { id: ${TEMPLATE_ID}, naam: '${VARIANT_NAAM}', aantalVars: 5 },  // ${TEMPLATE_NAAM}\n`;
  const anker = "  { id: 242737, naam: 'garantie', aantalVars: 5 },";
  if (!src.includes(anker)) throw new Error('anker niet gevonden in ab-template-verdeler.js');
  fs.writeFileSync(VERDELER, src.replace(anker, regel + anker));
  return 'toegevoegd';
}

(async () => {
  if (fs.existsSync(KLAAR)) { console.log('AB1 is al geactiveerd, niets te doen.'); return; }

  const jwt = await getToken();
  const H = { Authorization: 'Bearer ' + jwt };
  let template = null;
  for (let p = 1; p <= 6 && !template; p++) {
    const j = await (await fetch(`https://app.trengo.com/api/v2/wa_templates?page=${p}`, { headers: H })).json();
    template = (j.data || []).find((t) => Number(t.id) === TEMPLATE_ID);
    if (!j.links?.next) break;
  }
  if (!template) { console.log(`Template ${TEMPLATE_ID} niet gevonden in Trengo.`); return; }

  const status = String(template.status || template.state || '').toUpperCase();
  console.log(`${TEMPLATE_NAAM} (${TEMPLATE_ID}): status ${status}`);
  if (status !== 'ACCEPTED') { console.log('Nog niet goedgekeurd, volgende ronde opnieuw.'); return; }

  // Goedgekeurd. Nu de echte proef: komt hij ook daadwerkelijk aan?
  const params = await testParams();
  if (!params) {
    await telegram(`⚠️ AB1 (${TEMPLATE_NAAM}) is goedgekeurd, maar ik kon geen geschikte offerte vinden om de testverzending mee te doen. Hij staat NIET in de A/B-test; even handmatig checken.`);
    return;
  }

  const res = await fetch('https://app.trengo.com/api/v2/wa_sessions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient_phone_number: TESTNUMMER, hsm_id: TEMPLATE_ID, channel_id: KANAAL, params }),
  });
  const body = await res.text();

  if (!res.ok) {
    console.log(`Testverzending MISLUKT (${res.status}): ${body.slice(0, 200)}`);
    await telegram(`⚠️ AB1 (${TEMPLATE_NAAM}, ${TEMPLATE_ID}) staat in Trengo op ACCEPTED, maar de testverzending naar ${TESTNUMMER} werd geweigerd:\n\n${body.slice(0, 250)}\n\nPrecies wat er met de vorige AB1 gebeurde. Hij gaat NIET in de A/B-test tot dit klopt; ik blijf het elk half uur proberen.`);
    return;
  }

  const wat = activeerInVerdeler();
  fs.writeFileSync(KLAAR, new Date().toISOString());
  console.log(`Testverzending geslaagd, variant ${wat}.`);
  await telegram(`✅ AB1 doet het weer.\n\n${TEMPLATE_NAAM} (${TEMPLATE_ID}) is goedgekeurd EN de testverzending naar ${TESTNUMMER} is echt aangekomen. Hij staat nu in de A/B-rotatie, dus vanaf de eerstvolgende ronde (09:00 of 17:00) draaien er weer 4 varianten in plaats van 3.\n\nCheck even of het testbericht er goed uitziet op je toestel.`);
})().catch(async (e) => {
  console.error(e);
  await telegram(`⚠️ AB1-wachter crashte: ${(e.message || e).toString().slice(0, 200)}`);
  process.exit(1);
});

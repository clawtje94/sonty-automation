#!/usr/bin/env node
// GETEKENDE AI-OFFERTES DOORZETTEN (Daimy 20 juli: offerte 202610010 was online ondertekend
// maar bleef in "Ai offerte verstuurd" hangen). Oorzaak: Sunny zet een dossier alleen door
// naar "Inmeten inplannen" bij akkoord ín het gesprek (inmeet_afspraak_voorstellen); tekent
// de klant zelf online via de link, dan bewoog er niets. Deze cron dicht dat gat:
// elke 30 min → alle items in status "Ai offerte verstuurd" → offerte ACCEPTED?
// → status naar "Inmeten inplannen" + Telegram-melding. Geen state nodig: na de
// verplaatsing valt het item vanzelf buiten het filter.
const fs = require('fs');
const path = require('path');

const KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BOARD = 'edb9b0b7-b70e-4064-95b5-ec0d03357c0a';
const BACKLOG = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const AI_STATUS = 'dc0efe4f-2cd6-45d8-aeff-7f1c817a0fb2'; // Ai offerte verstuurd
const INMETEN_STATUS = '2e9819bd-26f0-4082-8f18-32bb48f87f54'; // Inmeten inplannen
const B = 'https://backend.reuzenpanda.nl';
const H = { Authorization: 'Bearer ' + KEY };
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const TG_CHAT = 1700128390;

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function rpGet(ep) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(B + ep, { headers: H });
      if (r.ok) return await r.json();
    } catch {}
    await sleep(1500 + i * 1500);
  }
  return null;
}
async function telegram(text) {
  await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text: text.substring(0, 4000) }),
  }).catch(() => {});
}

(async () => {
  const data = await rpGet(`/contact-service/${PID}/boards/${BOARD}/items`);
  const items = data?.items || [];
  // status kan als status_id of als status.id terugkomen, afhankelijk van de endpoint-versie
  const ai = items.filter(i => (i.status?.id || i.status_id) === AI_STATUS && i.item_subject?.id);
  console.log(`[${new Date().toISOString()}] items in "Ai offerte verstuurd": ${ai.length}`);
  let doorgezet = 0;
  for (const it of ai) {
    const docs = (await rpGet(`/document-service/v1/${PID}/quotations?lead_configuration_id=${it.item_subject.id}`))?.quotationDatas || [];
    const acc = docs.filter(d => d.quotationStatus === 'ACCEPTED');
    if (acc.length) {
      const r = await fetch(`${B}/contact-service/${PID}/backlogs/${BACKLOG}/items/${it.id}`, {
        method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: { status_id: INMETEN_STATUS } }),
      });
      const nrs = acc.map(d => d.quotationNumber).join(', ');
      if (r.ok) {
        doorgezet++;
        console.log(`  ✍️ ${it.summary} (offerte ${nrs}) → Inmeten inplannen`);
        await telegram(`✍️ ${it.summary} heeft offerte ${nrs} online ondertekend! Het dossier is automatisch doorgezet naar "Inmeten inplannen" — de planning kan bellen voor de inmeetafspraak.`);
      } else {
        console.log(`  FOUT: status verplaatsen mislukt voor ${it.summary} (${r.status})`);
        await telegram(`⚠️ ${it.summary} heeft offerte ${nrs} ondertekend, maar het dossier automatisch doorzetten naar "Inmeten inplannen" MISLUKTE (RP ${r.status}). Zet hem even handmatig door.`);
      }
    }
    await sleep(250);
  }
  console.log(`Klaar: ${doorgezet} doorgezet.`);
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });

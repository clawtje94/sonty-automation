#!/usr/bin/env node
// EENMALIG HERSTEL (Daimy 05-09-2026): de foto-uploadlijst (KV sonty:media-uploads) was afgekapt op 500, waardoor 350+
// geüploade foto's (o.a. pergola) uit de kiezer vielen. De foto's zelf staan nog in de Klaviyo-mediabibliotheek. Dit script
// zet elke Klaviyo-foto die NIET meer in de lijst staat terug als status 'nieuw', zodat de AI-triage ze opnieuw categoriseert
// en ze weer in de kiezer komen na akkoord. Bestaande entries (met hun categorie/status) blijven ongemoeid. --dry = tellen.
const { KLAVIYO_API_KEY } = require('../secrets.js');
const KH = { Authorization: 'Klaviyo-API-Key ' + KLAVIYO_API_KEY, accept: 'application/json', revision: '2024-10-15' };
const DRY = process.argv.includes('--dry');

async function klaviyoImages() {
  let url = 'https://a.klaviyo.com/api/images/?page[size]=100'; const uit = [];
  while (url) { const r = await fetch(url, { headers: KH }); if (!r.ok) throw new Error('klaviyo ' + r.status + ' ' + (await r.text()).slice(0, 120)); const j = await r.json();
    for (const im of (j.data || [])) { const u = im.attributes?.image_url; if (u && /\.(jpe?g|png|webp|gif)$/i.test(u)) uit.push({ url: u, naam: im.attributes?.name || u.split('/').pop() }); }
    url = j.links?.next; }
  return uit;
}
(async () => {
  const kvMod = require('@vercel/kv'); const kv = kvMod.kv;
  const KEY = 'sonty:media-uploads';
  const lijst = (await kv.get(KEY)) || [];
  const bestaand = new Set(lijst.map((x) => String(x.url)));
  const imgs = await klaviyoImages();
  const vandaag = new Date().toISOString().slice(0, 10);
  const nieuw = imgs.filter((im) => !bestaand.has(im.url)).map((im) => ({ url: im.url, naam: im.naam, type: 'foto', cat: '', datum: vandaag, status: 'nieuw', hersteld: true }));
  console.log(`Klaviyo: ${imgs.length} foto's | lijst nu: ${lijst.length} | terug te zetten (nog niet in lijst): ${nieuw.length}`);
  if (DRY) { console.log('DRY — voorbeelden:', nieuw.slice(0, 5).map((x) => x.url.slice(-45)).join(' | ')); return; }
  const totaal = [...lijst, ...nieuw];
  await kv.set(KEY, totaal);
  console.log(`Geschreven: lijst is nu ${totaal.length}. De AI-triage categoriseert de ${nieuw.length} nieuwe; daarna verschijnen ze in de Uploaden-tab ter goedkeuring.`);
})().catch((e) => { console.error('FOUT', e.message); process.exit(1); });

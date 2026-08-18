#!/usr/bin/env node
/**
 * C-REEKS BACKFILL (Daimy 18-08: "kunnen we deze flows gaan backfillen? rekening houdend
 * met geen herinneringen meer, mensen die al akkoord zijn, juiste timeframes, echt alles").
 *
 * Doelgroep: unieke personen van wie de LAATSTE offerte 31-365 dagen oud is. Eruit:
 *  - akkoord (heeftAkkoord; de nachtsync zet die ook op fase klant)
 *  - iedereen die niet gemaild mag worden (opt-out, stil-lijst, herinneringen-stop)
 *  - wie al C1 heeft gehad (gecheckt in de ECHTE verzend-events van de flow, niet lokaal)
 *  - ouder dan 365 dagen (zeer koud) en zonder offerte-link
 *
 * Mechanisme (bewezen 18-08 met de 9 nagekomen mensen): sonty_offerte_dagen op 30 zetten,
 * dan stroomt iemand het instap-segment in en stuurt de live flow C1; C2/C3 volgen op de
 * normale afstanden met de uitstap-conditie (akkoord/opt-out) voor elke mail opnieuw.
 * De nachtsync zet de dagteller daarna vanzelf weer op echt, dat is prima: de flow is
 * dan al getriggerd en het segment loopt leeg.
 *
 * Tempo: nieuwste eerst (warmste leads), standaard 200 per run, 1 run per werkdag om
 * 10:00 (launchd nl.sonty.c-backfill). Overzicht in data/email/c-backfill-verwerkt.json;
 * na elke run een Telegram-melding met aantallen. Klaar = melding en verder niks.
 *
 * Gebruik: node scripts/email/c-backfill.js            (1 blok, respecteert werkdag)
 *          node scripts/email/c-backfill.js --aantal 50 --ook-weekend
 */
const fs = require('fs');
const path = require('path');
const { KLAVIYO_API_KEY } = require('../secrets.js');

const H = { Authorization: 'Klaviyo-API-Key ' + KLAVIYO_API_KEY, revision: '2026-07-15', accept: 'application/json', 'content-type': 'application/json' };
const STAAT = path.join(__dirname, '..', '..', 'data', 'email', 'c-backfill-verwerkt.json');
const FLOW_ID = 'RPYzWM';
const METRIC_RECEIVED = 'THjEYn';
const DAG = 86400000;
const AANTAL = Number((process.argv[process.argv.indexOf('--aantal') + 1]) || 0) || 200;

async function telegram(t) {
  try {
    await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendMessage', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: 1700128390, text: t }),
    });
  } catch { /* best-effort */ }
}

async function kreegAlC1() {
  const kreeg = new Set();
  let url = 'https://a.klaviyo.com/api/events/?filter=' + encodeURIComponent(`equals(metric_id,"${METRIC_RECEIVED}"),greater-than(datetime,2026-08-17T00:00:00Z)`) + '&page%5Bsize%5D=100&include=profile';
  while (url) {
    const r = await fetch(url, { headers: H });
    if (r.status === 429) { await new Promise((x) => setTimeout(x, 15000)); continue; }
    const d = await r.json();
    for (const e of d.data || []) {
      if ((e.attributes.event_properties || {}).$flow !== FLOW_ID) continue;
      const pid = e.relationships?.profile?.data?.id;
      const prof = (d.included || []).find((i) => i.id === pid);
      if (prof?.attributes?.email) kreeg.add(prof.attributes.email.toLowerCase());
    }
    url = d.links?.next || null;
  }
  return kreeg;
}

(async () => {
  const dag = new Date().getDay();
  if (!process.argv.includes('--ook-weekend') && (dag === 0 || dag === 6)) { console.log('weekend, geen blok'); return; }

  const rijen = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'email', 'rp-export.json'), 'utf8'));
  const lijst = Array.isArray(rijen) ? rijen : (rijen.rijen || rijen.data || []);
  const perMail = new Map();
  for (const r of lijst) {
    if (!r.email || !r.offerteDatum) continue;
    const b = perMail.get(r.email);
    if (!b || r.offerteDatum > b.offerteDatum) perMail.set(r.email, r);
  }
  const verwerkt = fs.existsSync(STAAT) ? JSON.parse(fs.readFileSync(STAAT, 'utf8')) : {};
  const alC1 = await kreegAlC1();
  const kandidaten = [];
  for (const r of perMail.values()) {
    const dagen = Math.floor((Date.now() - r.offerteDatum) / DAG);
    if (dagen < 31 || dagen > 365) continue;
    if (r.heeftAkkoord) continue;
    if (r.magMail === false || r.magMail === 'nee') continue;
    if (!r.offerteLink) continue;
    const em = r.email.toLowerCase();
    if (verwerkt[em] || alC1.has(em)) continue;
    kandidaten.push({ email: r.email, dagen });
  }
  kandidaten.sort((a, b) => a.dagen - b.dagen); // nieuwste eerst
  const blok = kandidaten.slice(0, AANTAL);
  console.log(`kandidaten over: ${kandidaten.length}, dit blok: ${blok.length}`);
  if (!blok.length) {
    await telegram('📧 C-backfill is KLAAR: iedereen uit de 31-365-dagen-groep is behandeld (of uitgesloten door akkoord/opt-out).');
    return;
  }

  let gelukt = 0, nietGevonden = 0, fouten = 0;
  for (const k of blok) {
    try {
      const zoek = await (await fetch('https://a.klaviyo.com/api/profiles/?filter=' + encodeURIComponent(`equals(email,"${k.email}")`), { headers: H })).json();
      const id = zoek.data?.[0]?.id;
      if (!id) { nietGevonden += 1; verwerkt[k.email.toLowerCase()] = 'geen-profiel'; continue; }
      const props = zoek.data[0].attributes.properties || {};
      if (props.sonty_fase === 'klant' || props.sonty_mag_mail !== 'ja') { verwerkt[k.email.toLowerCase()] = 'alsnog-uitgesloten'; continue; }
      const r = await fetch(`https://a.klaviyo.com/api/profiles/${id}/`, { method: 'PATCH', headers: H, body: JSON.stringify({ data: { type: 'profile', id, attributes: { properties: { sonty_offerte_dagen: 30 } } } }) });
      if (!r.ok) throw new Error('patch ' + r.status);
      verwerkt[k.email.toLowerCase()] = new Date().toISOString().slice(0, 10);
      gelukt += 1;
    } catch (e) { fouten += 1; console.error(`fout ${k.email}: ${String(e.message).slice(0, 60)}`); }
    fs.writeFileSync(STAAT, JSON.stringify(verwerkt, null, 0));
    await new Promise((x) => setTimeout(x, 600));
  }
  fs.writeFileSync(STAAT, JSON.stringify(verwerkt, null, 0));
  console.log(`blok klaar: ${gelukt} de flow in, ${nietGevonden} geen profiel, ${fouten} fouten, ${kandidaten.length - blok.length} nog te gaan`);
  await telegram(`📧 C-backfill blok verwerkt: ${gelukt} mensen de reactivering-flow in gezet (C1 volgt binnen minuten, C2/C3 op de normale afstanden, akkoord of afmelding stopt de reeks vanzelf). ${nietGevonden ? nietGevonden + ' zonder Klaviyo-profiel overgeslagen. ' : ''}${fouten ? fouten + ' fouten. ' : ''}Nog ${kandidaten.length - blok.length} te gaan van de totale groep.`);
})().catch(async (e) => { console.error('FOUT:', e.message); await telegram('⚠️ C-backfill-run mislukt: ' + String(e.message).slice(0, 120)); process.exit(1); });

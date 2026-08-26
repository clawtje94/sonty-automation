#!/usr/bin/env node
// BOEKING-NACONTROLE (Daimy 26-08: "iedereen die wordt gepland door jou moet worden
// nagelopen of het goed gaat, en als er wat verkeerd gaat wil ik dat weten en hoe
// het is opgelost"). Elke 30 min via launchd nl.sonty.boeking-nacontrole.
//
// Per nieuwe boeking (laatste 48 uur, minimaal 10 min oud zodat de keten klaar is):
//   1. Planado-opdracht bestaat en staat op de geboekte tijd
//   2. Outlook-agenda-afspraak bestaat (regel: geen boekingspad zonder Outlook-event)
//   3. De klant heeft aantoonbaar een bevestiging gekregen (WhatsApp-gesprek)
// Herstel wat veilig zelf kan (bevestiging alsnog sturen), meld de rest met 🚨 —
// altijd mét wat er mis was en wat eraan gedaan is. Uitkomsten gaan naar
// data/nacontrole-state.json; de ochtend-digest vat de laatste 24 uur samen.
const fs = require('fs');
const path = require('path');
const { planadoFetch } = require('./lib/planado-fetch.js');
const { planningTelegram } = require('./lib/telegram-planning.js');

const BOEKINGEN = path.join(__dirname, '..', 'data', 'inmeet-boekingen.json');
const STATE = path.join(__dirname, '..', 'data', 'nacontrole-state.json');
const PH = { Authorization: 'Bearer ' + fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim() };
// Exact de zinnen uit bevestigingTekst (NL/EN) + de variant van de planning-mail
const BEVESTIGING_PATROON = /hij staat!|bij je langs om in te meten|komt onze inmeter|it's booked!|come by to measure/i;

const leesJson = (p, terugval) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return terugval; } };

async function checkPlanado(b) {
  if (!b.planadoJobUuid) return { ok: false, wat: 'geen Planado-opdracht geregistreerd' };
  const r = await planadoFetch('https://api.planadoapp.com/v2/jobs/' + b.planadoJobUuid, { headers: PH });
  if (!r.ok) return { ok: false, wat: 'Planado-opdracht onvindbaar (HTTP ' + r.status + ')' };
  const job = (await r.json()).job || {};
  const gepland = Date.parse(job.scheduled_at || 0);
  const geboekt = Date.parse(b.aankomst || 0);
  if (geboekt && Math.abs(gepland - geboekt) > 60 * 60000) {
    return { ok: false, wat: `Planado-tijd (${job.scheduled_at}) wijkt af van de geboekte tijd (${b.aankomst})` };
  }
  return { ok: true };
}

async function checkOutlook(b) {
  // Niet op event-ID zoeken: boekingen via MS Bookings slaan een Bookings-ID op, geen
  // Outlook-ID (vals-alarm-les 26-08: 9 gezonde boekingen als kapot gemeld). De echte
  // bedrijfsregel is "Outlook is kantoorvenster": staat er rond de geboekte tijd een
  // afspraak mét de klantnaam in de agenda Sonty Montage? Dat controleren we dus.
  const OH = { Authorization: 'Bearer ' + fs.readFileSync(path.join(__dirname, '.owa-token.txt'), 'utf8').trim() };
  const cals = (await (await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: OH })).json()).value || [];
  const cal = cals.find((c) => c.Name === 'Sonty Montage');
  if (!cal) return { ok: null, wat: 'kalender Sonty Montage niet te vinden — Outlook niet te controleren' };
  const van = new Date(Date.parse(b.aankomst) - 5 * 60000).toISOString();
  const tot = new Date(Date.parse(b.aankomst) + ((b.duurMin || 30) + 5) * 60000).toISOString();
  const r = await fetch(`https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarview?startDateTime=${van}&endDateTime=${tot}&$top=50`, { headers: OH });
  if (!r.ok) return { ok: null, wat: 'Outlook niet te controleren (HTTP ' + r.status + ')' };
  const events = (await r.json()).value || [];
  const naamDelen = String(b.naam || '').toLowerCase().split(/\s+/).filter((x) => x.length > 2);
  const raak = events.some((e) => {
    const s = String(e.Subject || '').toLowerCase();
    return naamDelen.some((d) => s.includes(d)) && !s.startsWith('optie bot');
  });
  if (!raak) return { ok: false, wat: 'geen agenda-afspraak met de klantnaam rond de geboekte tijd in Sonty Montage' };
  return { ok: true };
}

async function checkBevestiging(b) {
  if (!b.telefoon) return { ok: null, wat: 'geen telefoonnummer — bevestiging niet te controleren (mail-only)' };
  const { zoekWaTicket } = require('./lib/aanbod-versturen');
  const ticket = await zoekWaTicket(b.telefoon).catch(() => null);
  if (!ticket) return { ok: null, wat: 'geen WhatsApp-gesprek gevonden — bevestiging niet te controleren' };
  const TT = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
  const r = await fetch(`https://app.trengo.com/api/v2/tickets/${ticket.id}/messages?per_page=30`, { headers: { Authorization: 'Bearer ' + TT } });
  if (!r.ok) return { ok: null, wat: 'Trengo niet te bereiken voor bevestigings-controle' };
  const berichten = (await r.json())?.data || [];
  const na = berichten.filter((m) => {
    const t = Date.parse(String(m.created_at || '').replace(' ', 'T'));
    return String(m.type || m.message_type).toUpperCase() === 'OUTBOUND' && t >= Date.parse(b.geboektOp) - 5 * 60000;
  });
  if (na.some((m) => BEVESTIGING_PATROON.test(m.message || m.body || ''))) return { ok: true };
  return { ok: false, wat: 'geen bevestiging in het WhatsApp-gesprek gevonden', ticketId: ticket.id };
}

async function herstelBevestiging(b) {
  const { verstuurBevestiging } = require('./lib/aanbod-versturen');
  const aanbod = { lead: { naam: b.naam, telefoon: b.telefoon, email: b.email }, duurMin: b.duurMin || 30 };
  const r = await verstuurBevestiging(aanbod, { aankomst: b.aankomst, inmeter: b.inmeter });
  return r?.ergensGelukt !== false;
}

(async () => {
  const boekingen = leesJson(BOEKINGEN, {});
  const state = leesJson(STATE, {});
  const nu = Date.now();
  const teDoen = Object.entries(boekingen).filter(([sleutel, b]) => {
    if (b.status !== 'geboekt' || !b.geboektOp) return false;
    const leeftijd = nu - Date.parse(b.geboektOp);
    return leeftijd > 10 * 60000 && leeftijd < 48 * 3600000 && !state[sleutel];
  });
  console.log(`[${new Date().toISOString()}] nacontrole: ${teDoen.length} boeking(en) te controleren`);

  for (const [sleutel, b] of teDoen) {
    const fouten = [], herstel = [], nietTeChecken = [];
    try {
      const [pl, ol, bev] = [await checkPlanado(b), await checkOutlook(b), await checkBevestiging(b)];
      if (pl.ok === false) fouten.push(pl.wat);
      if (ol.ok === false) fouten.push(ol.wat);
      if (ol.ok === null) nietTeChecken.push(ol.wat);
      if (bev.ok === null) nietTeChecken.push(bev.wat);
      if (bev.ok === false) {
        // Bevestiging ontbreekt: dat is het ene dat we altijd zelf mogen herstellen
        // (regel bevestiging-na-boeking: stilte na een boeking is de foute uitkomst).
        const gelukt = await herstelBevestiging(b).catch(() => false);
        if (gelukt) herstel.push('bevestiging alsnog verstuurd');
        else fouten.push(bev.wat + ' en alsnog sturen MISLUKTE');
      }
      const uitkomst = fouten.length ? 'fout' : herstel.length ? 'hersteld' : 'ok';
      state[sleutel] = { op: new Date().toISOString(), uitkomst, fouten, herstel, naam: b.naam, aankomst: b.aankomst, bron: b.bron || 'keten' };
      fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
      if (fouten.length) {
        await planningTelegram(`🚨 NACONTROLE: boeking van ${b.naam} (${new Date(b.aankomst).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}, ${b.inmeter}) is NIET in orde:\n` +
          fouten.map((f) => '• ' + f).join('\n') +
          (herstel.length ? '\nZelf hersteld: ' + herstel.join(', ') : '') +
          '\n→ actie nodig: controleer deze boeking handmatig.');
      } else if (herstel.length) {
        await planningTelegram(`🔧 NACONTROLE: boeking van ${b.naam} was niet compleet — ${herstel.join(', ')}. Verder is alles in orde (Planado + Outlook kloppen).`);
      }
      console.log(`  ${b.naam}: ${uitkomst}${fouten.length ? ' — ' + fouten.join('; ') : ''}${nietTeChecken.length ? ' (niet te checken: ' + nietTeChecken.join('; ') + ')' : ''}`);
    } catch (e) {
      console.log(`  ${b.naam}: controle-fout ${e.message.slice(0, 80)} — volgende run opnieuw`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });

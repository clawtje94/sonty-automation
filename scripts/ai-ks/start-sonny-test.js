#!/usr/bin/env node
// Start een Sonny-testgesprek: stuurt het Sonny-openingsbericht naar opgegeven
// whitelist-nummers via het laatste WhatsApp-ticket van dat contact in Trengo.
// Gebruik: node start-sonny-test.js 31683500506 31628209480
// Let op: WhatsApp staat vrije berichten alleen toe binnen 24u na het laatste
// inkomende bericht van de klant. Lukt het niet, dan melden we dat.
const fs = require('fs');
const path = require('path');
const CFG = require('./config.js');

const TT = fs.readFileSync(path.join(__dirname, '..', '.trengo-api-token.txt'), 'utf8').trim();
const TH = { Authorization: 'Bearer ' + TT, 'Content-Type': 'application/json' };

async function tGet(ep) {
  const res = await fetch('https://app.trengo.com/api/v2' + ep, { headers: TH });
  if (!res.ok) return null;
  return res.json();
}
async function tPost(ep, body) {
  const res = await fetch('https://app.trengo.com/api/v2' + ep, { method: 'POST', headers: TH, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, body: await res.text().catch(() => '') };
}
function normPhone(p) {
  let d = (p || '').replace(/\D/g, '');
  if (d.startsWith('0031')) d = '31' + d.slice(4);
  if (d.startsWith('06') && d.length === 10) d = '31' + d.slice(1);
  if (d.startsWith('6') && d.length === 9) d = '31' + d;
  return d;
}
function loadSonnyState() {
  try { return JSON.parse(fs.readFileSync(CFG.SONNY.STATE_FILE, 'utf8')); } catch { return { introTickets: {}, dagTeller: {}, lastRapport: null }; }
}
function saveSonnyState(s) {
  fs.mkdirSync(path.dirname(CFG.SONNY.STATE_FILE), { recursive: true });
  fs.writeFileSync(CFG.SONNY.STATE_FILE, JSON.stringify(s));
}

const BERICHT = CFG.SONNY.INTRO + '\n\nDit is een testgesprek: stel me gerust een vraag over zonwering, rolluiken of je offerte, dan help ik je direct.';

(async () => {
  const doelen = process.argv.slice(2).map(normPhone).filter(Boolean);
  if (!doelen.length) { console.log('Gebruik: node start-sonny-test.js <nummer> [nummer...]'); process.exit(1); }

  for (const nummer of doelen) {
    if (!CFG.TEST_LIVE_PHONES.includes(nummer)) {
      console.log(`${nummer}: NIET op de whitelist — overgeslagen (testberichten alleen naar whitelist)`);
      continue;
    }
    // Zoek het contact en zijn laatste WhatsApp-ticket
    const zoek = await tGet(`/contacts?term=${nummer}&page=1`);
    const contact = (zoek?.data || []).find(c => normPhone(c.phone) === nummer) || (zoek?.data || [])[0];
    if (!contact) { console.log(`${nummer}: geen Trengo-contact gevonden — laat diegene eerst zelf even appen`); continue; }

    let ticket = null;
    for (let page = 1; page <= 3 && !ticket; page++) {
      const data = await tGet(`/tickets?contact_id=${contact.id}&page=${page}`);
      ticket = (data?.data || []).find(t =>
        (t.channel?.id === CFG.WA_CHANNEL_ID || t.channel?.type === 'WA_BUSINESS'));
      if (!data?.links?.next) break;
    }
    if (!ticket) { console.log(`${nummer}: geen WhatsApp-ticket gevonden — laat diegene eerst zelf even appen`); continue; }

    const res = await tPost(`/tickets/${ticket.id}/messages`, { message: BERICHT, type: 'OUTBOUND' });
    if (res.ok) {
      const state = loadSonnyState();
      state.introTickets[ticket.id] = new Date().toISOString(); // intro is nu al gestuurd
      saveSonnyState(state);
      console.log(`${nummer}: Sonny-testbericht verstuurd (ticket ${ticket.id})`);
    } else {
      console.log(`${nummer}: versturen MISLUKT (${res.status}) ${res.body.substring(0, 200)}`);
      console.log('  → waarschijnlijk buiten het 24-uurs WhatsApp-venster; laat diegene eerst zelf "hoi" appen naar de zaak-WhatsApp.');
    }
  }
})();

#!/usr/bin/env node
// KLANT-WERKBON VERZENDER (Daimy 03-09-2026: "die mail moet uit de werkbonnen-mail, niet uit aanvragen@"). De website kan
// via zijn Trengo-API-gebruiker niet mailen vanuit het kanaal "Werkbon" (werkbon@sonty.nl): Trengo weigert met
// "geen toegang tot dit privécontact". Daarom zet de website die mails in een wachtrij en verstuurt dit script ze met de
// kantoor-login (scripts/trengo-api.js getToken) via kanaal 1363388: contact → ticket → mail → ticket sluiten → wachtrij af.
// Elke minuut via launchd nl.sonty.werkbon-klantmail (+ interval-runner). --dry = niets versturen.
const SECRETS = require('./secrets.js');
const { getToken } = require('./trengo-api.js');
const API = 'https://sonty-website.vercel.app/api/werkbon/wachtrij';
const KANAAL = 1363388;
const DRY = process.argv.includes('--dry');
const AH = { Authorization: 'Bearer ' + SECRETS.ADMIN_PASSWORD, 'Content-Type': 'application/json' };
async function verstuur(item, H) {
  const c = await (await fetch(`https://app.trengo.com/api/v2/channels/${KANAAL}/contacts`, { method: 'POST', headers: H, body: JSON.stringify({ identifier: item.naar, name: item.naam || item.naar }) })).json();
  if (!c.id) throw new Error('contact: ' + JSON.stringify(c).slice(0, 100));
  const t = await fetch('https://app.trengo.com/api/v2/tickets', { method: 'POST', headers: H, body: JSON.stringify({ contact_id: c.id, channel_id: KANAAL, subject: item.onderwerp }) });
  if (!t.ok) throw new Error('ticket: HTTP ' + t.status + ' ' + (await t.text()).slice(0, 100));
  const ticketId = (await t.json()).id;
  const m = await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/messages`, { method: 'POST', headers: H, body: JSON.stringify({ email: { subject: item.onderwerp }, message: item.html }) });
  if (!m.ok) throw new Error('mail: HTTP ' + m.status + ' ' + (await m.text()).slice(0, 100));
  await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/close`, { method: 'POST', headers: H }).catch(() => {});
  return ticketId;
}
(async () => {
  const r = await fetch(API, { headers: AH });
  if (!r.ok) throw new Error('wachtrij ophalen HTTP ' + r.status);
  const items = (await r.json()).items || [];
  if (!items.length) { console.log(`${new Date().toISOString()} werkbon-klantmail: wachtrij leeg`); return; }
  const token = await getToken(); const H = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  let ok = 0, fout = 0;
  for (const item of items) {
    if (DRY) { console.log('  [dry]', item.id, item.naar, item.onderwerp); continue; }
    try {
      const ticket = await verstuur(item, H);
      await fetch(API, { method: 'POST', headers: AH, body: JSON.stringify({ id: item.id, ticket }) });
      ok++; console.log(`  ✓ ${item.naar} "${item.onderwerp.slice(0, 50)}" ticket ${ticket}${item.proef ? ' (proef)' : ''}`);
    } catch (e) {
      fout++; console.log(`  ✗ ${item.naar}: ${e.message.slice(0, 140)}`);
      const oud = Date.now() - Date.parse(item.op) > 2 * 3600e3;
      if (oud) { await fetch(API, { method: 'POST', headers: AH, body: JSON.stringify({ id: item.id, fout: e.message.slice(0, 120) }) }); try { await require('./lib/telegram-planning.js').planningTelegram(`🚨 Klant-werkbon voor ${item.naar} kon 2 uur lang niet verstuurd worden (${e.message.slice(0, 80)}) — even handmatig vanuit werkbon@ sturen.`, { alarm: true }); } catch { /* melding is vangnet */ } }
    }
  }
  console.log(`${new Date().toISOString()} werkbon-klantmail: ${ok} verstuurd, ${fout} mislukt, ${items.length} in wachtrij`);
})().catch((e) => { console.error(new Date().toISOString(), 'werkbon-klantmail FOUT:', e.message); process.exit(1); });

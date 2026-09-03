// KANTOOR-AFSPRAKEN (Daimy 03-09-2026, Lotte Vos +31651680187: "waarom is deze afspraak niet gewoon door jou
// geannuleerd? nu heb ik de inmeter daar op locatie staan"). Lotte zegde 01-09 per WhatsApp af, maar haar afspraak was
// door kantoor via Outlook/Bookings gemaakt (Planado external_id ol-…) en stond dus NIET in data/inmeet-boekingen.json.
// De annuleer-route (Sunny-tool → wachtrij → vindBoeking) vond "geen actieve boeking" en de bot zag het bericht als
// "vervolg op overdracht" → notitie aan een collega op vakantie, niemand annuleerde, inmeter reed voor niets.
// Hier: een afspraak die alleen in Planado/Outlook bestaat vinden op telefoonnummer (bewezen via de Planado-contacten,
// nooit alleen op naam) en annuleren: Outlook-event(s) van die klant rond dat tijdstip + precies die Planado-opdracht.
// Bron: data/planado-agenda-snapshot.json (planner-ronde) + data/meetbon-planado-gripp-cache.json (telefoons uit de
// meetbon-sync) + één Planado-detail-call ter bevestiging. Pure delen getest in tests/kantoor-afspraak-regressie.js.
const fs = require('fs');
const path = require('path');
const { planadoFetch } = require('./planado-fetch.js');
const D = path.join(__dirname, '..', '..', 'data');
const SNAPSHOT = path.join(D, 'planado-agenda-snapshot.json');
const KOPPEL_CACHE = path.join(D, 'meetbon-planado-gripp-cache.json');
const VENSTER_TERUG_MS = 2 * 3600e3; // een afspraak van net (inmeter onderweg) telt nog mee

function laatste9(t) { return String(t || '').replace(/\D/g, '').slice(-9); }
function lees(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } }
function achternaamVan(naam) {
  const delen = String(naam || '').trim().split(/\s+/).map((d) => d.replace(/[^\p{L}\-']/gu, '')).filter((d) => d.length >= 3);
  return delen.length ? delen[delen.length - 1] : '';
}
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
/** Pure: snapshot-items die op naam bij deze klant kunnen horen (inmeten, niet ouder dan 2 u). Nog NIET bewezen. */
function matchKantoorAfspraken({ items, naam, nu = Date.now() }) {
  const an = achternaamVan(naam);
  if (!an) return [];
  const re = new RegExp('(^|[^\\p{L}])' + esc(an) + '([^\\p{L}]|$)', 'iu');
  return (items || []).filter((it) => it && it.uuid && it.start && Date.parse(it.start) > nu - VENSTER_TERUG_MS && /inmeten/i.test(it.klant || '') && re.test(it.klant || ''))
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));
}
/** Pure: welke Outlook-events horen bij DEZE annulering: zelfde klant (achternaam in onderwerp) én binnen 90 min van de
 * afspraak. Nooit op tijd alleen (dan gaat de afspraak van een ander om 13:00 mee) en nooit een OPTIE-blokje. */
function kiesOutlookEvents({ events, naam, aankomst }) {
  const an = achternaamVan(naam); if (!an) return [];
  const re = new RegExp('(^|[^\\p{L}])' + esc(an) + '([^\\p{L}]|$)', 'iu');
  const t0 = Date.parse(aankomst); if (!t0) return [];
  return (events || []).filter((e) => {
    if (!e || !e.Id || !e.Start?.DateTime) return false;
    if (/^OPTIE bot/i.test(e.Subject || '')) return false;
    if (!re.test(e.Subject || '')) return false;
    const t = Date.parse(String(e.Start.DateTime).replace(/Z?$/, 'Z'));
    return Math.abs(t - t0) <= 90 * 60e3;
  });
}
async function planadoDetail(uuid) {
  const key = fs.readFileSync(path.join(__dirname, '..', 'planado-api-key.txt'), 'utf8').trim();
  const r = await planadoFetch('https://api.planadoapp.com/v2/jobs/' + uuid, { headers: { Authorization: 'Bearer ' + key } });
  if (!r.ok) return null;
  const j = await r.json(); return j.job || j;
}
/** Vind de kantoor-afspraak van deze klant: telefoon is de sleutel (Planado-contacten), naam alleen om kandidaten te kiezen. */
async function vindKantoorAfspraak({ telefoon, naam, nu = Date.now() }) {
  const tel9 = laatste9(telefoon);
  if (tel9.length !== 9) return null;
  const snap = lees(SNAPSHOT, { items: [] });
  const items = (snap.items || []).filter((it) => it && it.start && Date.parse(it.start) > nu - VENSTER_TERUG_MS && /inmeten/i.test(it.klant || ''));
  const kandidaten = new Map();
  for (const it of matchKantoorAfspraken({ items, naam, nu })) kandidaten.set(it.uuid, it);
  // zonder (bruikbare) naam: telefoons uit de meetbon-sync-cache
  const cache = lees(KOPPEL_CACHE, {});
  for (const it of items) if (Array.isArray(cache[it.uuid]?.tel) && cache[it.uuid].tel.includes(tel9)) kandidaten.set(it.uuid, it);
  for (const it of [...kandidaten.values()].slice(0, 4)) {
    const h = await planadoDetail(it.uuid).catch(() => null);
    if (!h) continue;
    const tels = (h.contacts || []).map((c) => laatste9(c.value)).filter((x) => x.length === 9);
    if (tels.includes(tel9)) return { uuid: it.uuid, start: h.scheduled_at || it.start, inmeter: it.inmeter, klant: (h.contacts || []).find((c) => c.name)?.name || it.klant.replace(/^Inmeten( Sonty)?\s*[-—]\s*/i, ''), externalId: h.external_id || it.externalId || null, jobStatus: h.status || null };
  }
  return null;
}
async function outlookAgenda() {
  const token = fs.readFileSync(path.join(__dirname, '..', '.owa-token.txt'), 'utf8').trim();
  const OH = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const cals = (await (await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: OH })).json()).value || [];
  const cal = cals.find((c) => c.Name === 'Sonty Montage');
  if (!cal) throw new Error('kalender Sonty Montage niet gevonden');
  return { id: cal.Id, OH };
}
/** Annuleer een kantoor-afspraak volledig: Outlook eerst (anders zet de sync hem terug), dan de Planado-opdracht, dan de
 * planning-groep. Geeft { gevonden, gelukt, stappen, afspraak }. Deels mislukt = zichtbaar, nooit stil. */
async function annuleerKantoorAfspraak({ telefoon, naam, reden = '', bron = 'onbekend' }) {
  const a = await vindKantoorAfspraak({ telefoon, naam });
  if (!a) return { gevonden: false, gelukt: false, stappen: [{ stap: 'vinden', ok: false, detail: 'geen kantoor-afspraak op dit nummer' }], afspraak: null };
  const stappen = []; const stap = (s, ok, detail) => stappen.push({ stap: s, ok, detail });
  try {
    const { id, OH } = await outlookAgenda();
    const dag = new Date(a.start).toISOString().slice(0, 10);
    const j = await (await fetch(`https://outlook.office.com/api/v2.0/me/calendars/${id}/calendarView?$top=100&$select=Subject,Start&startDateTime=${dag}T00:00:00Z&endDateTime=${dag}T23:59:59Z`, { headers: OH })).json();
    const evs = kiesOutlookEvents({ events: j.value || [], naam: a.klant || naam, aankomst: a.start });
    let n = 0;
    for (const e of evs) { const del = await fetch(`https://outlook.office.com/api/v2.0/me/events/${e.Id}`, { method: 'DELETE', headers: OH }); if (del.ok || del.status === 204) n++; else stap('outlook', false, `"${e.Subject}" HTTP ${del.status}`); }
    stap('outlook', true, `${n} van ${evs.length} event(s) verwijderd`);
  } catch (e) { stap('outlook', false, e.message.slice(0, 80)); }
  try {
    const key = fs.readFileSync(path.join(__dirname, '..', 'planado-api-key.txt'), 'utf8').trim();
    const r = await planadoFetch('https://api.planadoapp.com/v2/jobs/' + a.uuid, { method: 'DELETE', headers: { Authorization: 'Bearer ' + key } });
    stap('planado', r.ok || r.status === 404, 'HTTP ' + r.status);
  } catch (e) { stap('planado', false, e.message.slice(0, 80)); }
  const alles = stappen.every((s) => s.ok);
  try {
    const { planningTelegram } = require('./telegram-planning.js');
    const datum = new Date(a.start).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
    await planningTelegram(`🛑 Inmeetafspraak geannuleerd (kantoor-afspraak uit Outlook/Planado): ${a.klant || naam}, was ${datum} bij ${a.inmeter}.${reden ? ` Reden: ${reden}.` : ''} Via: ${bron}.${alles ? '' : ' ⚠️ niet alles lukte, kantoor kijkt na.'}`, { boeking: true });
  } catch { /* melding mag de annulering nooit blokkeren */ }
  return { gevonden: true, gelukt: alles, stappen, afspraak: a };
}
/** Kantoor-afspraak op Planado-id (zoeklijst /admin/inmeet-mutatie, 03-09): geeft { uuid, start, inmeter, klant, telefoon, adres, jobStatus } of null. */
async function kantoorAfspraakOpUuid(uuid) {
  const h = await planadoDetail(uuid).catch(() => null);
  if (!h) return null;
  const snap = lees(SNAPSHOT, { items: [] });
  const it = (snap.items || []).find((x) => x && x.uuid === uuid) || {};
  const tel = (h.contacts || []).map((c) => c.value).find((v) => laatste9(v).length === 9) || null;
  const klant = (h.contacts || []).find((c) => c.name)?.name || String(it.klant || h.description || '').split('\n')[0].replace(/^Inmeten( Sonty)?\s*[-—–:]\s*/i, '').trim();
  return { uuid, start: h.scheduled_at || it.start || null, inmeter: it.inmeter || null, klant, telefoon: tel, adres: h.address?.formatted || null, jobStatus: h.status || null, externalId: h.external_id || it.externalId || null, duurMin: h.scheduled_duration?.minutes || null };
}
/** Annuleer een kantoor-afspraak waarvan de Planado-id al bekend is (klant gekozen uit de zoeklijst). Zelfde stappen als
 * annuleerKantoorAfspraak: Outlook eerst, dan Planado, dan de planning-groep. */
async function annuleerKantoorAfspraakOpUuid(uuid, { reden = '', bron = 'onbekend' } = {}) {
  const a = await kantoorAfspraakOpUuid(uuid);
  if (!a || !a.start) return { gevonden: false, gelukt: false, stappen: [{ stap: 'vinden', ok: false, detail: 'Planado-opdracht niet gevonden' }], afspraak: null };
  const stappen = []; const stap = (s, ok, detail) => stappen.push({ stap: s, ok, detail });
  try {
    const { id, OH } = await outlookAgenda();
    const dag = new Date(a.start).toISOString().slice(0, 10);
    const j = await (await fetch(`https://outlook.office.com/api/v2.0/me/calendars/${id}/calendarView?$top=100&$select=Subject,Start&startDateTime=${dag}T00:00:00Z&endDateTime=${dag}T23:59:59Z`, { headers: OH })).json();
    const evs = kiesOutlookEvents({ events: j.value || [], naam: a.klant, aankomst: a.start });
    let n = 0;
    for (const e of evs) { const del = await fetch(`https://outlook.office.com/api/v2.0/me/events/${e.Id}`, { method: 'DELETE', headers: OH }); if (del.ok || del.status === 204) n++; else stap('outlook', false, `"${e.Subject}" HTTP ${del.status}`); }
    stap('outlook', true, `${n} van ${evs.length} event(s) verwijderd`);
  } catch (e) { stap('outlook', false, e.message.slice(0, 80)); }
  try {
    const key = fs.readFileSync(path.join(__dirname, '..', 'planado-api-key.txt'), 'utf8').trim();
    const r = await planadoFetch('https://api.planadoapp.com/v2/jobs/' + a.uuid, { method: 'DELETE', headers: { Authorization: 'Bearer ' + key } });
    stap('planado', r.ok || r.status === 404, 'HTTP ' + r.status);
  } catch (e) { stap('planado', false, e.message.slice(0, 80)); }
  const alles = stappen.every((s) => s.ok);
  try {
    const { planningTelegram } = require('./telegram-planning.js');
    const datum = new Date(a.start).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
    await planningTelegram(`🛑 Inmeetafspraak geannuleerd (kantoor-afspraak uit Outlook/Planado): ${a.klant}, was ${datum} bij ${a.inmeter || '?'}.${reden ? ` Reden: ${reden}.` : ''} Via: ${bron}.${alles ? '' : ' ⚠️ niet alles lukte, kantoor kijkt na.'}`, { boeking: true });
  } catch { /* melding mag de annulering nooit blokkeren */ }
  return { gevonden: true, gelukt: alles, stappen, afspraak: a };
}
module.exports = { matchKantoorAfspraken, kiesOutlookEvents, vindKantoorAfspraak, annuleerKantoorAfspraak, kantoorAfspraakOpUuid, annuleerKantoorAfspraakOpUuid, achternaamVan, laatste9 };

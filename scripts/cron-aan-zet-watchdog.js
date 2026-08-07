#!/usr/bin/env node
// "WIE IS AAN ZET"-watchdog (audit 07-08, kernadvies): één simpele waarheid —
// is het laatste ECHTE bericht (geen interne notitie) van de klant en is het
// >4 uur stil, dan zijn WIJ aan zet. Ongeacht team, assignee, notes of
// bot-beloftes. Dit dicht het zwarte gat "overdracht aan een mens = einde
// bewaking" (Henk van Weers 8 wkn, Manon/Christian-akkoorden, Floris, Rene).
//
// Gedrag: elk uur draaien; melden via de planning-bot als de lijst verandert,
// en sowieso de volledige lijst om 9:00 en 16:00. Akkoord-/klacht-taal bovenaan.
// Interne notities tellen NIET als antwoord (dat was de bug in de oude wachtlijst).
const fs = require('fs');
const path = require('path');
const TT = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const H = { Authorization: 'Bearer ' + TT };
const { planningTelegram } = require('./lib/telegram-planning.js');
const STATE_PAD = path.join(__dirname, '..', 'data', 'aan-zet-state.json');
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

const SYSTEEM = /sontymontage|@sonty\.nl$|no-?reply|webflow|postmaster|mailer-daemon/i;
const STIL_NA_UREN = 4;
const AKKOORD = /akkoord|offerte.{0,30}(goed|prima|doen)|gaan (ermee|ervoor)|bestelling.{0,20}plaats/i;
const KLACHT = /klacht|kapot|defect|stuk\b|werkt niet|reageert niet|boos|teleurgesteld|on hold|annuleer/i;

async function tGet(ep) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch('https://app.trengo.com/api/v2' + ep, { headers: H });
    if (r.status === 429) { await wacht(3000 + i * 3000); continue; }
    if (!r.ok) return null;
    return r.json();
  }
  return null;
}

async function actieveTickets() {
  const alles = [];
  for (const status of ['OPEN', 'ASSIGNED']) {
    for (let page = 1; page <= 20; page++) {
      const d = await tGet(`/tickets?status=${status}&page=${page}`);
      const lijst = d?.data || [];
      if (!lijst.length) break;
      alles.push(...lijst);
      if (!d.links?.next && !d.next_page_url) break;
      await wacht(900);
    }
  }
  return alles;
}

(async () => {
  const tickets = await actieveTickets();
  let state = {};
  try { state = JSON.parse(fs.readFileSync(STATE_PAD, 'utf8')); } catch { /* eerste run */ }
  state.laatsteBericht = state.laatsteBericht || {}; // ticketId -> {op, richting} cache

  const aanZet = [];
  for (const t of tickets) {
    const c = t.contact || {};
    const contactTekst = `${c.email || ''} ${c.phone || c.identifier || ''}`;
    if (SYSTEEM.test(contactTekst)) continue;

    // alleen messages ophalen als het ticket is bijgewerkt sinds de vorige run
    const cache = state.laatsteBericht[t.id];
    let laatste = null;
    if (cache && cache.updatedAt === t.updated_at) {
      laatste = cache;
    } else {
      const d = await tGet(`/tickets/${t.id}/messages`);
      await wacht(700);
      const echt = (d?.data || []).filter((m) => (m.message_type || m.type) !== 'NOTE');
      if (!echt.length) continue; // leeg/outbound-only ticket: geen klant die wacht
      echt.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      const m = echt[echt.length - 1];
      laatste = {
        op: m.created_at,
        richting: (m.message_type || m.type) === 'INBOUND' ? 'klant' : 'ons',
        tekst: String(m.message || m.body || '').replace(/<[^>]+>/g, '').slice(0, 120),
        updatedAt: t.updated_at,
      };
      state.laatsteBericht[t.id] = laatste;
    }

    if (laatste.richting !== 'klant') continue;
    const stilUren = (Date.now() - Date.parse(String(laatste.op).replace(' ', 'T'))) / 3600000;
    if (stilUren < STIL_NA_UREN) continue;

    const naam = c.full_name || c.name || c.email || '?';
    const soort = AKKOORD.test(laatste.tekst) ? 'AKKOORD' : KLACHT.test(laatste.tekst) ? 'KLACHT' : 'vraag';
    aanZet.push({ id: t.id, naam, soort, stilUren: Math.round(stilUren), tekst: laatste.tekst.slice(0, 60) });
  }

  // opruimen: cache-entries van tickets die niet meer actief zijn
  const actieveIds = new Set(tickets.map((t) => String(t.id)));
  for (const id of Object.keys(state.laatsteBericht)) if (!actieveIds.has(id)) delete state.laatsteBericht[id];

  const volgorde = { AKKOORD: 0, KLACHT: 1, vraag: 2 };
  aanZet.sort((a, b) => volgorde[a.soort] - volgorde[b.soort] || b.stilUren - a.stilUren);

  const hash = JSON.stringify(aanZet.map((x) => x.id + x.soort));
  const uur = new Date().getHours();
  const vasteRonde = uur === 9 || uur === 16;
  const veranderd = hash !== state.laatsteHash;
  console.log(`${tickets.length} actieve tickets, ${aanZet.length} wachten op ONS${veranderd ? ' (lijst veranderd)' : ''}`);
  for (const x of aanZet) console.log(`  [${x.soort}] #${x.id} ${x.naam} — ${x.stilUren}u stil — ${x.tekst}`);

  if (aanZet.length && (veranderd || vasteRonde)) {
    const regels = aanZet.slice(0, 15).map((x) => `${x.soort === 'vraag' ? '' : '❗'}${x.naam} (${x.stilUren}u stil, ${x.soort}): ${x.tekst}`);
    await planningTelegram(`Wie is aan zet: ${aanZet.length} klant(en) wachten op ONS antwoord.\n` + regels.join('\n') + (aanZet.length > 15 ? `\n… en ${aanZet.length - 15} meer` : ''));
  }
  state.laatsteHash = hash;
  fs.writeFileSync(STATE_PAD, JSON.stringify(state));
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });

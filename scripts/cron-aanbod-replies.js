#!/usr/bin/env node
// Reply-monitor voor keuzelink-berichten (Daimy 06-08: "lees jij dan 100% uit wat ze
// antwoorden en rapporteer je dat naar mij?"). Elke 10 minuten: voor elk verstuurd
// aanbod de bijbehorende Trengo-gesprekken nalopen (WhatsApp-ticket, mail-ticket, en
// als vangnet het WhatsApp-gesprek op telefoonnummer). Elk NIEUW klantbericht na het
// versturen gaat letterlijk naar Daimy op Telegram, mét de aanbod-status erbij.
// Geen AI-interpretatie: 100% doorgeven, dedup per bericht-id.
const fs = require('fs');
const path = require('path');

const STATE_PLANNER = path.join(__dirname, '..', 'data', 'inmeten-planner-state.json');
const GEMELD = path.join(__dirname, '..', 'data', 'aanbod-replies-gemeld.json');
const TT = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const TH = { Authorization: 'Bearer ' + TT, Accept: 'application/json' };
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const MEET_CODE = process.env.MEETBON_CODE || '2288';

async function telegram(tekst) {
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: 1700128390, text: tekst.slice(0, 3900) }),
  }).catch(() => {});
}

async function ticketBerichten(ticketId) {
  const r = await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/messages?per_page=15`, { headers: TH });
  if (!r.ok) return [];
  return ((await r.json())?.data || []);
}

async function zoekWaTicketOpNummer(telefoon) {
  const kaal = String(telefoon || '').replace(/\D/g, '').slice(-9);
  if (kaal.length !== 9) return null;
  const r = await fetch(`https://app.trengo.com/api/v2/tickets?term=${kaal}`, { headers: TH });
  if (!r.ok) return null;
  const hit = ((await r.json())?.data || []).find((t) => t.channel?.type === 'WA_BUSINESS');
  return hit?.id || null;
}

async function main() {
  const state = (() => { try { return JSON.parse(fs.readFileSync(STATE_PLANNER, 'utf8')); } catch { return {}; } })();
  const gemeld = (() => { try { return JSON.parse(fs.readFileSync(GEMELD, 'utf8')); } catch { return {}; } })();
  const tickets = state.aanbodTickets || {};
  const tokens = Object.keys(tickets);
  if (!tokens.length) { console.log('geen verstuurde aanbiedingen om te volgen'); return; }

  // aanbod-status erbij (open/gekozen/verwerkt/verlopen) voor context in de melding
  const statusPer = {};
  for (const status of ['open', 'gekozen', 'verwerkt', 'verlopen']) {
    try {
      const r = await fetch(`https://sonty-website.vercel.app/api/inmeet-aanbod?status=${status}`, { headers: { 'x-meet-code': MEET_CODE } });
      for (const a of (await r.json())?.aanbiedingen || []) statusPer[a.token] = status;
    } catch { /* status is context, geen blokkade */ }
  }

  let meldingen = 0;
  for (const token of tokens) {
    const info = tickets[token];
    // ouder dan 14 dagen: niet meer volgen (en opruimen)
    if (Date.now() - Date.parse(info.verstuurdOp) > 14 * 86400000) { delete tickets[token]; continue; }
    const teVolgen = new Set([info.waTicket, info.mailTicket].filter(Boolean));
    if (info.telefoon) {
      const extra = await zoekWaTicketOpNummer(info.telefoon).catch(() => null);
      if (extra) teVolgen.add(extra);
    }
    for (const ticketId of teVolgen) {
      const rows = await ticketBerichten(ticketId);
      for (const m of rows) {
        const inbound = String(m.type || '').toUpperCase() === 'INBOUND' || m.direction === 'incoming';
        if (!inbound) continue;
        const wanneer = Date.parse(String(m.created_at || '').replace(' ', 'T'));
        if (!(wanneer > Date.parse(info.verstuurdOp))) continue;
        const sleutel = ticketId + ':' + m.id;
        if (gemeld[sleutel]) continue;
        gemeld[sleutel] = new Date().toISOString();
        meldingen++;
        const tekst = String(m.body_plain || m.message || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
        await telegram(`💬 REACTIE op keuzelink van ${info.naam} (aanbod: ${statusPer[token] || 'onbekend'}, ticket ${ticketId}):\n\n"${tekst || '(leeg/bijlage)'}"`);
      }
    }
  }
  // opgeschoonde tokens + dedup bewaren
  const vers = (() => { try { return JSON.parse(fs.readFileSync(STATE_PLANNER, 'utf8')); } catch { return {}; } })();
  vers.aanbodTickets = tickets;
  fs.writeFileSync(STATE_PLANNER, JSON.stringify(vers, null, 2));
  for (const [k, v] of Object.entries(gemeld)) if (Date.now() - Date.parse(v) > 30 * 86400000) delete gemeld[k];
  fs.writeFileSync(GEMELD, JSON.stringify(gemeld, null, 1));
  console.log(`${tokens.length} aanbod(en) gevolgd, ${meldingen} nieuwe reactie(s) gemeld`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });

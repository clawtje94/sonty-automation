#!/usr/bin/env node
// Trengo-bundelaar (Daimy 07-08 akkoord: "zelfde contact moet gewoon onder 1 ticket").
// Voegt ACTIEVE tickets (OPEN/ASSIGNED) van hetzelfde contact op hetzelfde kanaaltype
// samen in één ticket via de officiële merge-API. Gesloten tickets blijven staan —
// de pijn is twee LOPENDE gesprekken met dezelfde klant, niet oude historie.
//
// Regels:
//  - alleen zelfde kanaaltype (mail bij mail, WhatsApp bij WhatsApp)
//  - doelticket: eerst een ticket dat de inmeet-keten volgt (state.aanbodTickets —
//    daar kijkt de reply-monitor naar), anders het oudste actieve
//  - systeemmailboxen (sontymontage/no-reply/webflow/@sonty.nl) NOOIT aanraken
//  - `--droog` = alleen laten zien wat er zou gebeuren (default bij handmatig testen)
//  - merge is onomkeerbaar → elke samenvoeging wordt gelogd én op Telegram gemeld
const fs = require('fs');
const path = require('path');
const TT = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const H = { Authorization: 'Bearer ' + TT, 'Content-Type': 'application/json' };
const DROOG = process.argv.includes('--droog');
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
const LOG_PAD = path.join(__dirname, '..', 'data', 'trengo-merge-log.jsonl');
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const TG_CHAT = 1700128390;

const SYSTEEM = /sontymontage|@sonty\.nl$|no-?reply|webflow|postmaster|mailer-daemon/i;
const telSleutel = (t) => {
  const c = String(t || '').replace(/\D/g, '');
  return c.length >= 9 ? c.slice(-9) : null;
};

async function telegram(tekst) {
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text: tekst }),
  }).catch(() => {});
}

async function actieveTickets() {
  const alles = [];
  for (const status of ['OPEN', 'ASSIGNED']) {
    for (let page = 1; page <= 20; page++) {
      const r = await fetch(`https://app.trengo.com/api/v2/tickets?status=${status}&page=${page}`, { headers: H });
      if (r.status === 429) { await wacht(15000); page--; continue; }
      if (!r.ok) throw new Error(`Trengo ${r.status} bij ${status} p${page}`);
      const d = await r.json();
      const lijst = d.data || [];
      if (!lijst.length) break;
      alles.push(...lijst);
      if (!d.links?.next && !d.next_page_url) break;
      await wacht(1000);
    }
  }
  return alles;
}

function ketenTickets() {
  // tickets die de inmeet-keten volgt: die moeten het DOEL zijn, nooit weggemerged
  try {
    const st = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'inmeten-planner-state.json'), 'utf8'));
    const ids = new Set();
    for (const t of Object.values(st.aanbodTickets || {})) {
      if (t?.waTicket) ids.add(Number(t.waTicket));
      if (t?.mailTicket) ids.add(Number(t.mailTicket));
    }
    return ids;
  } catch { return new Set(); }
}

(async () => {
  const tickets = await actieveTickets();
  const keten = ketenTickets();
  console.log(`Actieve tickets: ${tickets.length} | keten-tickets bekend: ${keten.size} | ${DROOG ? 'DROOGLOOP' : 'ECHT'}`);

  // groeperen op contact (mail of telefoon) + kanaaltype
  const groepen = new Map();
  for (const t of tickets) {
    const c = t.contact || {};
    const mail = String(c.email || '').toLowerCase().trim();
    const tel = telSleutel(c.phone || c.identifier);
    const contactSleutel = mail || (tel ? 'tel:' + tel : null);
    if (!contactSleutel || SYSTEEM.test(contactSleutel)) continue;
    const kanaal = String(t.channel?.type || t.channel?.name || '?').toLowerCase();
    const sleutel = `${contactSleutel}|${kanaal}`;
    if (!groepen.has(sleutel)) groepen.set(sleutel, []);
    groepen.get(sleutel).push(t);
  }

  let samengevoegd = 0;
  const meldingen = [];
  for (const [sleutel, leden] of groepen) {
    if (leden.length < 2) continue;
    leden.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    // doel: keten-ticket als dat er is, anders het oudste
    const doel = leden.find((t) => keten.has(Number(t.id))) || leden[0];
    const bronnen = leden.filter((t) => t.id !== doel.id);
    const naam = doel.contact?.full_name || sleutel;
    console.log(`\n${naam} (${sleutel}): ${leden.length} actieve tickets → doel #${doel.id}${keten.has(Number(doel.id)) ? ' (keten)' : ' (oudste)'}`);
    for (const bron of bronnen) {
      console.log(`  ${DROOG ? 'ZOU mergen' : 'merge'}: #${bron.id} (${String(bron.subject || '').slice(0, 40)}) → #${doel.id}`);
      if (DROOG) continue;
      const r = await fetch(`https://app.trengo.com/api/v2/tickets/${doel.id}/merge`, {
        method: 'POST', headers: H, body: JSON.stringify({ source_ticket_id: bron.id }),
      });
      const regel = { op: new Date().toISOString(), doel: doel.id, bron: bron.id, naam, ok: r.ok, status: r.status };
      fs.appendFileSync(LOG_PAD, JSON.stringify(regel) + '\n');
      if (r.ok) { samengevoegd++; meldingen.push(`${naam}: #${bron.id} → #${doel.id}`); }
      else console.log(`  FOUT: Trengo ${r.status}`);
      await wacht(1500);
    }
  }

  console.log(`\n${DROOG ? 'Droogloop klaar — er is niets samengevoegd.' : `Klaar: ${samengevoegd} tickets samengevoegd.`}`);
  if (!DROOG && samengevoegd) {
    await telegram(`Trengo-bundelaar: ${samengevoegd} dubbele tickets samengevoegd.\n${meldingen.join('\n')}`);
  }
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });

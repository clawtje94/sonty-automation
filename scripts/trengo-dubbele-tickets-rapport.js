#!/usr/bin/env node
// DROOGLOOP dubbele Trengo-tickets (Daimy 07-08: "zelfde contact, zelfde mail of
// telefoon, moet gewoon onder 1 ticket"). Dit script voegt NIETS samen — het laat
// alleen zien welke open tickets van hetzelfde contact zijn en wat een samenvoeging
// zou doen. Samenvoegen is onomkeerbaar (POST /tickets/{id}/merge), dus eerst dit
// rapport, dan Daimy's akkoord, dan pas een echte samenvoeg-stap.
const fs = require('fs');
const path = require('path');
const TT = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const H = { Authorization: 'Bearer ' + TT, 'Content-Type': 'application/json' };
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

// Telefoon normaliseren: +31612345678 en 0612345678 zijn hetzelfde nummer.
const telSleutel = (t) => {
  const cijfers = String(t || '').replace(/\D/g, '');
  return cijfers.length >= 9 ? cijfers.slice(-9) : null;
};

async function alleOpenTickets() {
  const alles = [];
  for (let page = 1; page <= 40; page++) {
    const r = await fetch(`https://app.trengo.com/api/v2/tickets?status=OPEN&page=${page}`, { headers: H });
    if (r.status === 429) { await wacht(15000); page--; continue; }
    if (!r.ok) throw new Error('Trengo ' + r.status);
    const d = await r.json();
    const lijst = d.data || [];
    if (!lijst.length) break;
    alles.push(...lijst);
    if (!d.links?.next && !d.next_page_url) break;
    await wacht(1200);
  }
  return alles;
}

(async () => {
  const tickets = await alleOpenTickets();
  console.log(`Open tickets: ${tickets.length}\n`);

  // groeperen op contact: eerst contact-id, daarna e-mail en telefoon als vangnet
  // (zelfde mens kan als meerdere Trengo-contacten bestaan: mail-contact + WA-contact)
  const groepen = new Map();
  const sleutelVan = (t) => {
    const c = t.contact || {};
    const mail = String(c.email || '').toLowerCase().trim();
    const tel = telSleutel(c.phone || c.identifier);
    // e-mail wint als sleutel (stabielst), dan telefoon, dan contact-id
    return mail || (tel ? 'tel:' + tel : null) || (c.id ? 'contact:' + c.id : null);
  };
  for (const t of tickets) {
    const sleutel = sleutelVan(t);
    if (!sleutel) continue;
    if (!groepen.has(sleutel)) groepen.set(sleutel, []);
    groepen.get(sleutel).push(t);
  }
  // tweede pas: mail-groep en tel-groep van hetzelfde mens samenvoegen kan pas als
  // een contact beide heeft — die koppeling nemen we mee via contact.email+phone
  const telNaarSleutel = new Map();
  for (const [sleutel, leden] of groepen) {
    for (const t of leden) {
      const tel = telSleutel(t.contact?.phone || t.contact?.identifier);
      if (tel && !sleutel.startsWith('tel:')) telNaarSleutel.set(tel, sleutel);
    }
  }
  for (const [sleutel, leden] of [...groepen]) {
    if (!sleutel.startsWith('tel:')) continue;
    const doel = telNaarSleutel.get(sleutel.slice(4));
    if (doel && doel !== sleutel) {
      groepen.get(doel).push(...leden);
      groepen.delete(sleutel);
    }
  }

  const dubbel = [...groepen.entries()].filter(([, leden]) => leden.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`Contacten met meerdere open tickets: ${dubbel.length}\n`);
  const rapport = [];
  for (const [sleutel, leden] of dubbel) {
    const naam = leden[0].contact?.full_name || leden[0].contact?.name || sleutel;
    const regels = leden
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .map((t) => `  #${t.id} · ${t.channel?.name || t.channel?.type || '?'} · aangemaakt ${String(t.created_at).slice(0, 16)} · ${String(t.subject || '(geen onderwerp)').slice(0, 50)}`);
    console.log(`${naam} (${sleutel}) — ${leden.length} open tickets:`);
    console.log(regels.join('\n'));
    const oudste = leden[0];
    console.log(`  → voorstel: alles samenvoegen in #${oudste.id} (oudste)\n`);
    rapport.push({ sleutel, naam, tickets: leden.map((t) => ({ id: t.id, kanaal: t.channel?.name || t.channel?.type, aangemaakt: t.created_at, onderwerp: t.subject })), doelTicket: oudste.id });
  }
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'trengo-dubbel-rapport.json'), JSON.stringify({ op: new Date().toISOString(), openTickets: tickets.length, groepen: rapport }, null, 1));
  console.log(`Rapport: data/trengo-dubbel-rapport.json (${rapport.length} groepen) — er is NIETS samengevoegd.`);
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });

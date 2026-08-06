#!/usr/bin/env node
// Template-goedkeuringswachter (Daimy 06-08: "laat even weten als ze zijn goedgekeurd").
// Elke 30 min: zoek de twee knop-templates (key "1" = normaal, "ver" = ver-weg) in
// Trengo, zet de ID's in data/wa-templates.json, en meld op Telegram zodra ze door
// Meta zijn goedgekeurd. Daarna doet deze wachter niets meer (state-vlag).
const fs = require('fs');
const path = require('path');

const TT = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const IDS_PAD = path.join(__dirname, '..', 'data', 'wa-templates.json');
const TG = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

async function telegram(t) {
  await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: 1700128390, text: t }),
  }).catch(() => {});
}

async function main() {
  const ids = (() => { try { return JSON.parse(fs.readFileSync(IDS_PAD, 'utf8')); } catch { return {}; } })();
  if (ids.gemeld) { console.log('al goedgekeurd en gemeld — niets te doen'); return; }

  let templates = [];
  for (let p = 1; p <= 4; p++) {
    const r = await fetch(`https://app.trengo.com/api/v2/wa_templates?page=${p}`, {
      headers: { Authorization: 'Bearer ' + TT, Accept: 'application/json' },
    });
    if (r.status === 429) { await wacht(30000); p--; continue; }
    if (!r.ok) break;
    const data = (await r.json())?.data || [];
    templates.push(...data);
    if (data.length < 15) break;
  }
  const naam = (t) => String(t.key ?? t.title ?? t.name ?? '').trim().toLowerCase();
  const normaal = templates.find((t) => naam(t) === '1');
  const ver = templates.find((t) => naam(t) === 'ver');
  console.log('gevonden:', normaal ? `1=#${normaal.id} (${normaal.status})` : '1 niet gevonden',
    '|', ver ? `ver=#${ver.id} (${ver.status})` : 'ver niet gevonden');

  const nieuw = {
    normaal: normaal?.status === 'ACCEPTED' ? normaal.id : null,
    ver: ver?.status === 'ACCEPTED' ? ver.id : null,
    gemeld: false,
  };
  if (nieuw.normaal && nieuw.ver) {
    nieuw.gemeld = true;
    fs.writeFileSync(IDS_PAD, JSON.stringify(nieuw, null, 1));
    await telegram(`✅ Beide WhatsApp-templates zijn door Meta GOEDGEKEURD (normaal #${nieuw.normaal}, ver-weg #${nieuw.ver}) en staan aangesloten. Je kan nu vanuit het inmeet-dashboard versturen: WhatsApp met knoppen + mail met keuzelink tegelijk. Knopdruk of mailkeuze = automatisch boeken + bevestiging.`);
  } else if (nieuw.normaal || nieuw.ver) {
    fs.writeFileSync(IDS_PAD, JSON.stringify(nieuw, null, 1));
    console.log('één van de twee goedgekeurd — wachten op de ander');
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });

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
  // Fase 2 (07-08): de 1-moment-templates van Daimy (244121 inmeetmoment1optie,
  // 244125 momentver). Zodra beide ACCEPTED: keys moment/momentVer registreren,
  // instelling aantalTijden op 1 zetten (Daimy's keuze van vanochtend) en melden.
  // Fase 3 (11-08): de marge-versies (244680/244681) met de zin "kan door de route een
  // uur eerder of later worden" (Daimy: monteurs stonden te vaak te wachten). Zodra
  // beide ACCEPTED vervangen ze de oude moment-templates; verder verandert er niets.
  if (!ids.margeGemeld) {
    const mt = [];
    for (let p = 1; p <= 4; p++) {
      const r = await fetch(`https://app.trengo.com/api/v2/wa_templates?page=${p}`, { headers: { Authorization: 'Bearer ' + TT, Accept: 'application/json' } });
      if (r.status === 429) { await wacht(30000); p--; continue; }
      if (!r.ok) break;
      const data = (await r.json())?.data || [];
      mt.push(...data);
      if (data.length < 15) break;
    }
    const marge = mt.find((t) => t.id === 244680);
    const margeVer = mt.find((t) => t.id === 244682); // v1 (244681) werd direct geweigerd, v2 heringediend 11-08
    console.log('marge-templates:', marge?.status || 'niet gevonden', '|', margeVer?.status || 'niet gevonden');
    if (marge?.status === 'ACCEPTED' && margeVer?.status === 'ACCEPTED') {
      ids.moment = marge.id;
      ids.momentVer = margeVer.id;
      ids.margeGemeld = true;
      fs.writeFileSync(IDS_PAD, JSON.stringify(ids, null, 1));
      await telegram(`✅ De WhatsApp-templates MET aankomstmarge zijn door Meta goedgekeurd (#${marge.id} en #${margeVer.id}) en aangesloten. Elke klant leest de marge nu al bij het eerste tijdvoorstel, en daarna nogmaals in de bevestiging en de herinnering.`);
    } else if (marge?.status === 'REJECTED' || margeVer?.status === 'REJECTED') {
      ids.margeGemeld = true;
      fs.writeFileSync(IDS_PAD, JSON.stringify(ids, null, 1));
      await telegram(`⚠️ Meta heeft een marge-template AFGEKEURD (#244680: ${marge?.status || '?'} | #244682: ${margeVer?.status || '?'}) — actie nodig: tekst aanpassen en opnieuw indienen. De oude templates blijven gewoon werken.`);
    }
  }
  if (ids.momentGemeld) { console.log('moment-templates al goedgekeurd en gemeld — niets te doen'); return; }

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
  const moment = templates.find((t) => t.id === 244121);
  const momentVer = templates.find((t) => t.id === 244125);
  console.log('gevonden:', moment ? `moment=#${moment.id} (${moment.status})` : 'moment niet gevonden',
    '|', momentVer ? `momentVer=#${momentVer.id} (${momentVer.status})` : 'momentver niet gevonden');

  if (moment?.status === 'ACCEPTED' && momentVer?.status === 'ACCEPTED') {
    ids.moment = moment.id;
    ids.momentVer = momentVer.id;
    ids.momentGemeld = true;
    fs.writeFileSync(IDS_PAD, JSON.stringify(ids, null, 1));
    // instelling omzetten naar 1 voorstel (terugzetten kan altijd in /admin/inmeet-instellingen)
    let omgezet = false;
    try {
      const h = { 'Content-Type': 'application/json', 'x-meet-code': '2288' };
      const huidige = await (await fetch('https://sonty-website.vercel.app/api/inmeet-instellingen', { headers: h })).json();
      const rr = await fetch('https://sonty-website.vercel.app/api/inmeet-instellingen', {
        method: 'POST', headers: h, body: JSON.stringify({ ...huidige, aantalTijden: 1 }),
      });
      omgezet = rr.ok;
    } catch { /* melding zegt het dan */ }
    await telegram(`✅ De 1-moment-templates zijn door Meta GOEDGEKEURD (#${moment.id} en #${momentVer.id}) en aangesloten. ${omgezet ? 'De instelling staat nu op 1 concreet voorstel: nieuwe keuzelinks sturen één moment met knoppen Dat past / Ander moment.' : 'LET OP: de instelling kon niet automatisch om — zet "Aantal aangeboden tijden" op 1 in de planning-instellingen.'} Terugzetten naar 3 kan altijd in de instellingen.`);
  } else if (moment?.status === 'REJECTED' || momentVer?.status === 'REJECTED') {
    if (!ids.momentAfgekeurdGemeld) {
      ids.momentAfgekeurdGemeld = true;
      fs.writeFileSync(IDS_PAD, JSON.stringify(ids, null, 1));
      await telegram(`⚠️ Meta heeft een 1-moment-template AFGEKEURD (moment: ${moment?.status}, momentver: ${momentVer?.status}). De keten blijft gewoon op 3 tijden draaien; check de reden in Trengo bij Instellingen → WhatsApp → Templates.`);
    }
  } else {
    console.log('nog in behandeling bij Meta — wachten');
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });

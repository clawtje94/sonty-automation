#!/usr/bin/env node
/**
 * RAPPORT A/B-TEST offerte-templates (Daimy 2026-07-26).
 *
 * Meet per variant hoeveel offertes eruit gingen, hoeveel klanten reageerden en op welke knop.
 * De koppeling klant-naar-variant komt uit data/ab-test-state.json, dat de verdeler vult bij
 * het versturen. Zonder die registratie is achteraf niet te zeggen welke tekst werkte.
 *
 * Gebruik:
 *   node scripts/ab-test-rapport.js            → afgelopen 24 uur, ook naar Telegram
 *   node scripts/ab-test-rapport.js --uren 168 → afgelopen 7 dagen
 *   node scripts/ab-test-rapport.js --dry      → alleen op het scherm
 */
const fs = require('fs');
const path = require('path');
const { getToken } = require('./trengo-api.js');
const CFG = require('./ai-ks/config.js');
const { toewijzingenSinds, TEMPLATES } = require('./ab-template-verdeler.js');

const DRY = process.argv.includes('--dry');
const UREN = process.argv.includes('--uren') ? Number(process.argv[process.argv.indexOf('--uren') + 1]) : 24;

// De knopteksten per variant; een inkomend bericht dat hier exact op lijkt is een knop-tik.
const KNOPPEN = {
  inmeten: ['Dit is akkoord', 'Ik twijfel nog', 'Ik heb een vraag'],
  garantie: ['Dit is akkoord', 'Ik twijfel nog', 'Ik heb een vraag'],
  check: ['Alles klopt', 'Er moet iets anders', 'Ik heb een vraag'],
  kortweg: ['Inmeten inplannen', 'Eerst showroom', 'Ik heb een vraag'],
};
const ALLE_KNOPPEN = [...new Set(Object.values(KNOPPEN).flat())];

async function telegram(tekst) {
  if (DRY) return;
  await fetch(`https://api.telegram.org/bot${CFG.TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CFG.TG_CHAT, text: tekst }),
  }).catch((e) => console.error('telegram:', e.message));
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

(async () => {
  const sinds = Date.now() - UREN * 3600000;
  const toew = toewijzingenSinds(sinds);
  if (!toew.length) {
    const t = `A/B-rapport: in de afgelopen ${UREN} uur zijn er nog geen offertes met de nieuwe templates verstuurd.`;
    console.log(t); await telegram(t); return;
  }

  const jwt = await getToken();
  const H = { Authorization: 'Bearer ' + jwt };
  const per = {};
  for (const t of TEMPLATES) per[t.naam] = { verstuurd: 0, gereageerd: 0, knoppen: {}, vrijeTekst: 0 };

  for (const t of toew) {
    const vak = per[t.naam];
    if (!vak) continue;
    vak.verstuurd++;
    // Gesprek van dit nummer zoeken en kijken of er ná het versturen iets binnenkwam.
    let msgs = [];
    try {
      const zoek = await (await fetch(`https://app.trengo.com/api/v2/tickets?term=${t.telefoon}`, { headers: H })).json();
      const ticket = (zoek.data || [])[0];
      if (!ticket) continue;
      for (let p = 1; p <= 2; p++) {
        const r = await fetch(`https://app.trengo.com/api/v2/tickets/${ticket.id}/messages?page=${p}`, { headers: H });
        if (!r.ok) break;
        const j = await r.json();
        msgs.push(...(j.data || []));
        if (!j.links?.next) break;
      }
    } catch { continue; }

    const verstuurdOp = new Date(t.tijd).getTime();
    const reacties = msgs.filter((m) => m.type === 'INBOUND' && !m.internal_note
      && new Date(String(m.created_at).replace(' ', 'T') + 'Z').getTime() > verstuurdOp);
    if (!reacties.length) continue;
    vak.gereageerd++;
    for (const r of reacties) {
      const tekst = String(r.body_plain || r.message || '').trim();
      const knop = ALLE_KNOPPEN.find((k) => norm(k) === norm(tekst));
      if (knop) vak.knoppen[knop] = (vak.knoppen[knop] || 0) + 1;
      else vak.vrijeTekst++;
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  const totaalV = Object.values(per).reduce((a, v) => a + v.verstuurd, 0);
  const totaalR = Object.values(per).reduce((a, v) => a + v.gereageerd, 0);
  let uit = `A/B-RAPPORT offerte-templates, afgelopen ${UREN} uur\n\n`;
  uit += `Verstuurd: ${totaalV}. Gereageerd: ${totaalR} (${totaalV ? Math.round(totaalR / totaalV * 100) : 0}%).\n`;
  uit += `Ter vergelijking: met de oude template reageerde 15%.\n\n`;

  const gesorteerd = Object.entries(per).sort((a, b) => {
    const ra = a[1].verstuurd ? a[1].gereageerd / a[1].verstuurd : 0;
    const rb = b[1].verstuurd ? b[1].gereageerd / b[1].verstuurd : 0;
    return rb - ra;
  });
  for (const [naam, v] of gesorteerd) {
    const pct = v.verstuurd ? Math.round(v.gereageerd / v.verstuurd * 100) : 0;
    uit += `${naam}: ${v.verstuurd} verstuurd, ${v.gereageerd} reacties (${pct}%)\n`;
    const kn = Object.entries(v.knoppen).sort((a, b) => b[1] - a[1]);
    if (kn.length) uit += `  knoppen: ${kn.map(([k, n]) => `${k} ${n}x`).join(', ')}\n`;
    if (v.vrijeTekst) uit += `  losse berichten (geen knop): ${v.vrijeTekst}\n`;
  }

  // Eerlijk over de zeggingskracht: met kleine groepen is een verschil vaak toeval.
  const kleinste = Math.min(...Object.values(per).map((v) => v.verstuurd));
  uit += `\n`;
  if (kleinste < 110) {
    uit += `LET OP: de kleinste groep heeft ${kleinste} offertes. Met deze aantallen is alleen een\n`;
    uit += `groot verschil betrouwbaar (grofweg een verdubbeling van de reply rate). Zit het dichter\n`;
    uit += `bij elkaar, dan is dat nog geen winnaar maar toeval. Laat het dan langer lopen.\n`;
  } else {
    uit += `De groepen zijn groot genoeg om een verschil van ongeveer 15 procentpunt te zien.\n`;
  }

  console.log(uit);
  await telegram(uit);
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'ai-ks', 'ab-rapport-laatste.txt'), uit);
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });

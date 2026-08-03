#!/usr/bin/env node
// Eenmalige reparatie-correctiemail vanuit aanvragen@sonty.nl (Trengo-kanaal 1363384).
// Daimy 2026-08-03: de 13 (11 uniek) die we op reparatie afwezen krijgen alsnog de Service Nodi-
// doorverwijzing. NOOIT vanuit joey@ (harde regel). Dubbel-check via state, 429-retry, pauzes.
// Gebruik: node scripts/reparatie-correctie-mail.js --test   (alleen naar Daimy)
//          node scripts/reparatie-correctie-mail.js --live   (naar de 11 klanten)
const fs = require('path') && require('fs');
const path = require('path');
const TOK = fs.readFileSync(path.join(__dirname, 'ai-ks', '.trengo-sonny-token.txt'), 'utf8').trim();
const H = { Authorization: 'Bearer ' + TOK, 'Content-Type': 'application/json' };
const AANVRAGEN = 1363384;
const STATE = path.join(__dirname, '..', 'data', 'reparatie-correctie-verzonden.json');
const wait = ms => new Promise(r => setTimeout(r, ms));

const ONTVANGERS = [
  { voornaam: 'Koos', email: 'koos@bink.nl' },
  { voornaam: 'Trienke', email: 'trienkeakkerman@xs4all.nl' },
  { voornaam: '', email: 'danielecuti76@gmail.com' },
  { voornaam: 'Walter', email: 'walterdevalk@gmail.com' },
  { voornaam: 'Romano', email: 'romansio25@hotmail.com' },
  { voornaam: 'Marcel', email: 'velzer64@gmail.com' },
  { voornaam: 'Shanu', email: 'shanujagernath@hotmail.com' },
  { voornaam: '', email: 'j.kooij@quicknet.nl' },
  { voornaam: 'Cor', email: 'corschellevis@ziggo.nl' },
  { voornaam: 'Marja', email: 'marjaherruer59@gmail.com' },
  { voornaam: 'Jaap', email: 'jaapbakker1@kpnmail.nl' },
];

function mailHtml(voornaam) {
  const aanhef = voornaam ? `Hoi ${voornaam},` : 'Hoi,';
  return `<p>${aanhef}</p>` +
    `<p>Je had ons een tijdje terug benaderd voor een reparatie, en je kreeg toen te horen dat we je er niet mee konden helpen. Dat was niet juist, excuses daarvoor. Een nieuwe collega wist niet dat we voor reparaties al langer samenwerken met onze vaste partner Service Nodi. Yudi helpt je daar graag verder.</p>` +
    `<p>Je kunt hem bereiken op 06 19 25 85 66 of via info@service-nodi.nl. Handig als je er in je bericht meteen deze dingen bij zet, plus een paar foto&rsquo;s van het product en het defect. Hoe completer de aanvraag, hoe sneller de service:</p>` +
    `<ul><li>Wat voor product het is</li><li>Wat er precies kapot is</li><li>Op welke plek de reparatie moet gebeuren</li><li>Of er een hoogwerker nodig is</li><li>Hoe oud het product ongeveer is</li><li>Foto&rsquo;s van het product en wat er kapot is</li></ul>` +
    `<p>Geef gerust even aan dat je via Sonty komt, dan weet Yudi meteen genoeg. Fijn dat we je alsnog op weg kunnen helpen.</p><p>Hartelijke groet,<br>Sunny</p>`;
}

async function trengo(method, url, body, pogingen = 6) {
  for (let i = 1; i <= pogingen; i++) {
    const r = await fetch('https://app.trengo.com/api/v2' + url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    if (r.ok) return { ok: true, data: await r.json().catch(() => ({})) };
    if (r.status === 429) { await wait(i * 20000); continue; }
    return { ok: false, status: r.status, tekst: (await r.text()).slice(0, 150) };
  }
  return { ok: false, status: 429 };
}

async function stuur(voornaam, email) {
  const t = await trengo('POST', '/tickets', { contact_identifier: email, channel_id: AANVRAGEN, subject: 'Toch goed nieuws over je reparatie' });
  if (!t.ok) return { ok: false, stap: 'ticket', ...t };
  const id = t.data.id;
  await wait(4000);
  const m = await trengo('POST', `/tickets/${id}/messages`, { body_type: 'html', message: mailHtml(voornaam) });
  if (!m.ok) return { ok: false, stap: 'message', ticket: id, ...m };
  await wait(3000);
  await trengo('POST', `/tickets/${id}/close`).catch(() => {});
  return { ok: true, ticket: id };
}

(async () => {
  const test = process.argv.includes('--test');
  const live = process.argv.includes('--live');
  if (!test && !live) { console.log('gebruik: --test of --live'); return; }
  const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
  const lijst = test ? [{ voornaam: 'Daimy', email: 'daimyboot@gmail.com' }] : ONTVANGERS;
  for (const o of lijst) {
    if (live && state[o.email]) { console.log('SKIP (al verstuurd):', o.email); continue; }
    const r = await stuur(o.voornaam, o.email);
    if (r.ok) { console.log('✓', o.email, '(ticket', r.ticket + ')'); if (live) { state[o.email] = new Date().toISOString(); fs.writeFileSync(STATE, JSON.stringify(state, null, 1)); } }
    else console.log('✗ MISLUKT', o.email, '| stap', r.stap, '| status', r.status, r.tekst || '');
    await wait(8000);
  }
  console.log('klaar');
})().catch(e => console.log('FOUT:', e.message.slice(0, 150)));

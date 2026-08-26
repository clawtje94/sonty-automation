#!/usr/bin/env node
// PLANNING-DAGOVERZICHT (Daimy 26-08: "laat me in Telegram weten hoe of wat als je
// iemand planning aanbiedt, of alles goed verloopt, ook als iemand een andere keuze
// maakt, en of niemand zonder inplanning blijft staan").
//
// Eén gebundeld bericht per dag om 17:30 (regel telegram-kort: bundelen, geen melding
// per gebeurtenis — echte fouten komen sowieso al direct binnen):
//   1. verstuurde aanbiedingen vandaag
//   2. boekingen vandaag (met bron: keuzelink / Sunny / winkel / herstel)
//   3. klanten die anders kozen (herplanningen)
//   4. WACHTLIJST: iedereen zonder afspraak, hoe lang al, en wat er loopt —
//      niemand mag stil blijven staan (regel stilte-nooit-meer)
// Draait 1x per dag via launchd nl.sonty.planning-overzicht.
const fs = require('fs');
const path = require('path');
const { planningTelegram } = require('./lib/telegram-planning.js');

const DATA = path.join(__dirname, '..', 'data');
const leesJson = (p, terugval) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return terugval; } };
const vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
const isVandaag = (iso) => iso && new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }) === vandaag;
const tijdNL = (iso) => new Date(iso).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });

(async () => {
  const state = leesJson(path.join(DATA, 'inmeten-planner-state.json'), {});
  const boekingen = leesJson(path.join(DATA, 'inmeet-boekingen.json'), {});

  // 1. aanbiedingen verstuurd vandaag (ontdubbeld per klant, nieuwste telt)
  const verstuurd = new Map();
  for (const a of Object.values(state.aanbodTickets || {})) {
    if (isVandaag(a.verstuurdOp)) verstuurd.set(a.naam, a.verstuurdOp);
  }

  // 2. boekingen vandaag
  const geboekt = Object.values(boekingen).filter((b) => b.status === 'geboekt' && isVandaag(b.geboektOp));

  // 3. herplanningen vandaag (klant koos/wilde anders en kreeg automatisch nieuw aanbod)
  const namen = new Map((state.inmeetLeads || []).map((l) => [l.id, l.summary]));
  const herplend = Object.entries(state.herplanTeller || {})
    .filter(([, t]) => t.datum === vandaag)
    .map(([rpId, t]) => `${namen.get(rpId) || rpId.slice(0, 8)} (${t.n}x)`);

  // 4. wachtlijst: iedereen op het dashboard zonder boeking
  let wachtend = [];
  try {
    const r = await fetch('https://sonty-website.vercel.app/api/inmeet-dashboard', { headers: { 'x-meet-code': process.env.MEETBON_CODE || '2288' } });
    const dash = r.ok ? await r.json() : { leads: [] };
    const geboektIds = new Set(Object.values(boekingen).filter((b) => b.status === 'geboekt').map((b) => b.rpItemId));
    wachtend = (dash.leads || []).filter((l) => !geboektIds.has(l.rpItemId)).map((l) => {
      const status = { 'aanbod-loopt': 'aanbod loopt, wacht op de klant', 'aanbod-verstuurd': 'aanbod loopt, wacht op de klant', 'aanbod-mogelijk': 'tijden klaar, nog geen aanbod verstuurd', wachtend: 'lastig in te plannen, mens kijken' }[l.status] || l.status;
      return { naam: l.naam, dagen: l.wachtDagen ?? '?', status, zorg: (l.wachtDagen || 0) >= 3 && !String(l.status).includes('loopt') };
    });
  } catch { /* dashboard onbereikbaar: melden in het bericht */ wachtend = null; }

  const regels = [`📊 Planning vandaag (${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })})`];
  regels.push(`Aanbiedingen verstuurd: ${verstuurd.size}` + (verstuurd.size ? ' — ' + [...verstuurd.keys()].join(', ') : ''));
  regels.push(`Geboekt: ${geboekt.length}` + (geboekt.length ? ' — ' + geboekt.map((b) => `${b.naam} (${tijdNL(b.aankomst)}, ${b.inmeter})`).join('; ') : ''));
  if (herplend.length) regels.push(`Anders gekozen, automatisch nieuw voorstel: ${herplend.join(', ')}`);
  if (wachtend === null) {
    regels.push('⚠️ Wachtlijst niet op te halen (dashboard onbereikbaar) — morgen opnieuw.');
  } else if (!wachtend.length) {
    regels.push('Wachtlijst: leeg — niemand staat zonder afspraak of lopend aanbod. ✅');
  } else {
    regels.push(`Wachtlijst (${wachtend.length}):`);
    for (const w of wachtend.slice(0, 8)) {
      regels.push(`${w.zorg ? '❗' : '•'} ${w.naam} — ${w.dagen} dg, ${w.status}`);
    }
    if (wachtend.length > 8) regels.push(`… en nog ${wachtend.length - 8} (zie het inmeet-dashboard)`);
  }
  const zorgen = (wachtend || []).filter((w) => w.zorg);
  if (zorgen.length) regels.push(`❗ = staat 3+ dagen zonder lopend aanbod — actie nodig.`);

  await planningTelegram(regels.join('\n'));
  console.log(new Date().toISOString(), 'planning-overzicht verstuurd:', verstuurd.size, 'aanbiedingen,', geboekt.length, 'boekingen,', (wachtend || []).length, 'wachtend');
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });

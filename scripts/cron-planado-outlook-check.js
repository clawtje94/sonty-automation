#!/usr/bin/env node
// PLANADO ↔ OUTLOOK-BEWAKING (Daimy 11-08: "kijk of alles wat in Planado is gezet ook in
// Outlook is geplaatst, want ik mis daar veel dingen — het moet echt allemaal goed gaan").
//
// Elke ochtend: elke toekomstige Planado-opdracht moet op hetzelfde tijdstip een
// Outlook-afspraak hebben in de agenda "Sonty Montage". Klopt alles, dan blijft het
// stil; ontbreekt er iets, dan één melding met precies wat en wie.
//
// De eerste volledige meting (11-08) vond 3 afwijkingen op 198 opdrachten, alle drie
// restjes (2x een uit Outlook verwijderde showroomafspraak waarvan de Planado-kopie
// bleef staan, 1x een testboeking). Echte klantafspraken stonden allemaal goed.
const fs = require('fs');
const path = require('path');

const KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log(`[${new Date().toISOString()}] planado-outlook-check start`);
  let after = null; const jobs = [];
  for (let i = 0; i < 40; i++) {
    const d = await (await fetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: { Authorization: 'Bearer ' + KEY } })).json();
    const l = d.jobs || d.data || [];
    if (!l.length) break;
    jobs.push(...l); after = l[l.length - 1].uuid; await wacht(2600);
  }
  const toekomst = jobs.filter((j) => j.scheduled_at && new Date(j.scheduled_at) > new Date());

  const OWA = fs.readFileSync(path.join(__dirname, '.owa-token.txt'), 'utf8').trim();
  const OH = { Authorization: 'Bearer ' + OWA };
  const cals = (await (await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: OH })).json()).value || [];
  const cal = cals.find((c) => c.Name === 'Sonty Montage');
  if (!cal) throw new Error('agenda "Sonty Montage" niet gevonden');
  const tot = new Date(); tot.setDate(tot.getDate() + 120);
  let url = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView?$top=200&$select=Subject,Start&startDateTime=${new Date().toISOString()}&endDateTime=${tot.toISOString()}`;
  const evs = [];
  while (url) { const j = await (await fetch(url, { headers: OH })).json(); evs.push(...(j.value || [])); url = j['@odata.nextLink'] || null; }

  const rond = (a, b) => Math.abs(new Date(a) - new Date(b)) < 60000;
  const mist = toekomst.filter((j) => !evs.some((e) => rond(e.Start.DateTime + 'Z', j.scheduled_at)))
    .map((j) => ({
      wanneer: new Date(j.scheduled_at).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }),
      wat: String(j.description || '(geen omschrijving)').split('\n')[0].slice(0, 70),
      ext: j.external_id || '',
    }))
    .sort((a, b) => a.wanneer.localeCompare(b.wanneer));

  // DUBBELBOEKINGEN BIJ DE INMETERS (Daimy 11-08, Ed Pannebakker: twee inmetingen op
  // hetzelfde moment bij Joey en niemand zag het). Elke overlap tussen twee klussen
  // van dezelfde inmeter wordt gemeld, elk paar één keer. Montage (Yudi) valt buiten
  // dit rapport: die draait met meerdere teams en is niet mijn planning.
  const INM = ['Joey', 'Sjoerd'];
  const wieVan = (e) => {
    const att = (e.Attendees || []).map((a) => a.EmailAddress?.Name || '').filter((n) => n && !/^sonty$/i.test(n));
    return att.map((n) => n.split(' ')[0]).find((v) => INM.includes(v)) || null;
  };
  let urlA = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView?$top=200&$select=Subject,Start,End,Attendees,IsCancelled&startDateTime=${new Date().toISOString()}&endDateTime=${tot.toISOString()}`;
  const evsA = [];
  while (urlA) { const j = await (await fetch(urlA, { headers: OH })).json(); evsA.push(...(j.value || [])); urlA = j['@odata.nextLink'] || null; }
  const perInm = {};
  for (const e of evsA) {
    if (e.IsCancelled || /geannuleerd|cancell?ed|^OPTIE bot|vakantie|verlof|\bvrij\b|ziek/i.test(e.Subject || '')) continue;
    const n = wieVan(e);
    if (!n) continue;
    (perInm[n] = perInm[n] || []).push({ van: Date.parse(e.Start.DateTime + 'Z'), tot: Date.parse(e.End.DateTime + 'Z'), s: e.Subject || '' });
  }
  const DEDUP_PAD = path.join(__dirname, '..', 'data', 'dubbelboeking-gemeld.json');
  let gemeld = {};
  try { gemeld = JSON.parse(fs.readFileSync(DEDUP_PAD, 'utf8')); } catch { /* eerste run */ }
  const dubbels = [];
  const FN = (ms) => new Date(ms).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  for (const [n, lijst] of Object.entries(perInm)) {
    lijst.sort((a, b) => a.van - b.van);
    for (let i = 0; i < lijst.length; i++) for (let k = i + 1; k < lijst.length; k++) {
      const a = lijst[i], b = lijst[k];
      if (b.van >= a.tot) break;
      const sleutel = `${n}|${a.van}|${a.s.slice(0, 20)}|${b.s.slice(0, 20)}`;
      if (gemeld[sleutel]) continue;
      gemeld[sleutel] = new Date().toISOString();
      dubbels.push(`• ${n} ${FN(a.van)}: "${a.s.slice(0, 40)}" overlapt met "${b.s.slice(0, 40)}" (${FN(b.van).slice(-5)})`);
    }
  }
  for (const [k, v] of Object.entries(gemeld)) if (Date.now() - Date.parse(v) > 120 * 86400000) delete gemeld[k];
  fs.writeFileSync(DEDUP_PAD, JSON.stringify(gemeld, null, 1));
  if (dubbels.length) {
    const { planningTelegram } = require('./lib/telegram-planning.js');
    await planningTelegram(`⚠️ DUBBELBOEKING bij de inmeters — actie nodig (verzetten of bewust laten staan):\n\n${dubbels.slice(0, 20).join('\n')}${dubbels.length > 20 ? `\n… en ${dubbels.length - 20} meer` : ''}`);
  }
  console.log(`${dubbels.length} nieuwe dubbelboeking(en) gemeld`);

  // WEES-OPTIES VEGEN (Daimy 11-08: "ik heb ook nog veel optie-boekingen in Outlook").
  // De planner ruimt zijn OPTIE-blokjes op bij boeken of verlopen, maar een 429 of
  // een verloren state-verwijzing laat er soms een staan — er stonden er 17 van
  // klanten die allang geboekt of verlopen waren. Hier de bezem: elk OPTIE-blok
  // waarvan de vervaltijd in de titel voorbij is, gaat weg. Conservatief: blokken
  // met een toekomstige vervaltijd blijven staan, die horen bij een lopend aanbod.
  try {
    const MNDN = { jan: 0, feb: 1, mrt: 2, apr: 3, mei: 4, jun: 5, jul: 6, aug: 7, sep: 8, okt: 9, nov: 10, dec: 11 };
    let geveegd = 0;
    for (const e of (await (async () => {
      let u = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView?$top=200&$select=Subject&startDateTime=${new Date().toISOString()}&endDateTime=${tot.toISOString()}`;
      const alles = [];
      while (u) { const j = await (await fetch(u, { headers: OH })).json(); alles.push(...(j.value || [])); u = j['@odata.nextLink'] || null; }
      return alles;
    })())) {
      if (!/^OPTIE bot/i.test(e.Subject || '')) continue;
      const m = (e.Subject || '').match(/vervalt (\d{1,2}) (\w{3}),? (\d{1,2}):(\d{2})/);
      if (!m) continue;
      const jaar = new Date().getFullYear();
      const verval = new Date(jaar, MNDN[m[2]] ?? 0, +m[1], +m[3], +m[4]);
      if (verval > new Date()) continue;
      const del = await fetch(`https://outlook.office.com/api/v2.0/me/events/${e.Id}`, { method: 'DELETE', headers: OH });
      if (del.ok || del.status === 204) geveegd++;
      await new Promise((r) => setTimeout(r, 700));
    }
    if (geveegd) console.log(`${geveegd} verlopen OPTIE-blok(ken) geveegd`);
  } catch (e) { console.log('optie-veger overgeslagen: ' + e.message.slice(0, 60)); }

  console.log(`${toekomst.length} toekomstige opdrachten, ${mist.length} zonder Outlook-afspraak`);
  if (mist.length) {
    const { planningTelegram } = require('./lib/telegram-planning.js');
    await planningTelegram(`⚠️ Planado-Outlook-controle: ${mist.length} opdracht(en) staan in Planado maar NIET in Outlook — actie nodig (afspraak toevoegen of opdracht opruimen):\n\n`
      + mist.map((m) => `• ${m.wanneer} — ${m.wat}${m.ext ? ' [' + m.ext + ']' : ''}`).join('\n')
      + `\n\n(${toekomst.length - mist.length} van de ${toekomst.length} staan goed)`);
  }
})().catch(async (e) => {
  console.error('FOUT:', e.message);
  const { planningTelegram } = require('./lib/telegram-planning.js');
  await planningTelegram('⚠️ Planado-Outlook-controle GESTOPT: ' + e.message.slice(0, 150)).catch(() => {});
  process.exit(1);
});

// ECHTE INMEET-TIJDEN VOOR EEN KLANT — de leesmotor achter Sunny's inmeet_tijden-tool
// (Daimy 26-08: "Sunny moet tijdens het gesprek gelijk kunnen inplannen en overleggen
// zonder templates"). Sunny praat, deze motor rekent: dezelfde slotzoeker, dezelfde
// roosters, rijtijden en bezette aanbiedingen als de planner — Sunny kan dus nooit
// een tijd noemen die niet echt bestaat.
const fs = require('fs');
const path = require('path');

const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const SALES = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';

async function haalRpItem(itemId) {
  const r = await fetch(`https://backend.reuzenpanda.nl/contact-service/${PID}/backlogs/${SALES}/items/${itemId}`, {
    headers: { Authorization: 'Bearer ' + RP_API_KEY },
  });
  if (!r.ok) throw new Error('RP-item niet op te halen: HTTP ' + r.status);
  const d = await r.json();
  return d.item || d;
}

/**
 * @param {{itemId: string, dagen?: number[], dagdeel?: 'ochtend'|'middag'|null, vanaf?: string|null, max?: number}} p
 * @returns {Promise<{slots: Array<{tekst:string, aankomst:string, inmeter:string}>, duurMin: number, naam: string}>}
 */
async function zoekInmeetTijden({ itemId, dagen = [], dagdeel = null, vanaf = null, max = 5 }) {
  const planner = require('../cron-inmeten-planner.js');
  const { zoekSlots, kiesWinkelOpties, venster } = require('./slotzoeker.js');
  const { schatDuur } = require('./inmeetduur.js');
  const { pasBijVoorkeur } = require('./planning-antwoord.js');

  const item = await haalRpItem(itemId);
  const lead = await planner.leesLeadCompleet(item);
  if (lead.ambigu) throw new Error('meerdere offerteversies zonder getekende — klant moet eerst tekenen');
  const duur = schatDuur(lead.producten);
  const agenda = await planner.haalAgenda();
  await planner.laadVakanties();
  // open aanbiedingen bij andere klanten zijn bezet (samenloop-fix 07-08)
  try { await planner.voegAanbiedingenToe(agenda); } catch { /* register onbereikbaar: indicatief */ }

  // Engelstalig meet alleen Sjoerd (Daimy 13-08)
  const inmeters = Object.keys(planner.ROOSTER)
    .filter((n) => planner.ROOSTER[n].uuidPlanado)
    .filter((n) => !lead.engels || n === 'Sjoerd');

  let beste = [];
  for (const horizonDagen of [undefined, 30]) {
    for (const naam of inmeters) {
      const sl = await zoekSlots({
        agenda: agenda[naam] || [], adres: lead.volledigAdres, duurMin: duur,
        werkdagen: planner.werkdagenVoor(naam, horizonDagen),
        startAdres: planner.ROOSTER[naam]?.startAdres || undefined,
        eindAdres: planner.ROOSTER[naam]?.eindAdres || undefined,
      }).catch(() => []);
      beste.push(...sl.map((x) => ({ ...x, inmeter: naam })));
    }
    if (kiesWinkelOpties(beste, max).length >= max) break; // genoeg opties, niet verder kijken
  }
  // ontdubbelen (zelfde inmeter + tijd uit de twee horizon-rondes)
  const gezien = new Set();
  beste = beste.filter((x) => {
    const k = `${x.inmeter}|${+x.aankomst}`;
    if (gezien.has(k)) return false;
    gezien.add(k);
    return true;
  });
  // voorkeur van de klant: "vanaf" is hard, dagen/dagdeel zacht (zelfde regels als de planner)
  const passend = pasBijVoorkeur(beste, { dagen, dagdeel, vanaf });
  if (vanaf && !passend.length) return { slots: [], duurMin: duur, naam: lead.naam };
  beste = passend.length ? passend : beste;
  beste.sort((a, b) => a.extraRijtijdMin - b.extraRijtijdMin || a.aankomst - b.aankomst);

  const keuze = kiesWinkelOpties(beste, max);
  const fmt = (s) => new Date(s.aankomst).toLocaleString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam',
  });
  return {
    naam: lead.naam, duurMin: duur,
    slots: keuze.map((s) => ({
      tekst: `${fmt(s)} (inmeter ${s.inmeter}, thuisblijfvenster ${venster(s)})`,
      aankomst: (s.aankomst instanceof Date ? s.aankomst : new Date(s.aankomst)).toISOString(),
      inmeter: s.inmeter,
    })),
  };
}

module.exports = { zoekInmeetTijden, haalRpItem };

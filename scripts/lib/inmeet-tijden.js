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
  // eigen CRM-lead (LEAD-…): uit het eigen CRM, niet uit RP (blok 1 RP-uitzetten)
  { const E = require('./eigen-crm.js'); if (E.isEigen(itemId)) return E.haalItem(itemId); }
  if (require('./dossiers.js').rpUit()) throw new Error('Reuzenpanda staat uit; dit is geen eigen lead (' + String(itemId).slice(0, 12) + ')');
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
/** Harde variant van pasBijVoorkeur: alleen slots die ÉCHT aan dag/dagdeel/vanaf voldoen (geen terugval). */
function striktBijVoorkeur(slots, { dagen = [], dagdeel = null, vanaf = null } = {}) {
  return slots
    .filter((s) => !vanaf || new Date(s.aankomst) >= new Date(vanaf + 'T00:00:00+02:00'))
    .filter((s) => !dagen.length || dagen.includes(new Date(s.aankomst).getDay()))
    .filter((s) => !dagdeel || (new Date(s.aankomst).getHours() < 12 ? 'ochtend' : 'middag') === dagdeel);
}

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
  // HORIZON UITBREIDEN ZOLANG DE VOORKEUR NIET GEHAALD IS (Daimy 29-08, Christian Keus: "kan het op een
  // maandag?" → genoeg di/do-opties in de eerste horizon, dus er werd nooit verder gekeken en Sunny zei
  // "geen enkele maandag vrij" terwijl die er verderop wél waren). Met een dag/dagdeel/vanaf-voorkeur telt
  // alleen het PASSENDE aantal; en dan kijken we tot ~3 maanden vooruit.
  const heeftVoorkeur = !!((dagen && dagen.length) || dagdeel || vanaf);
  for (const horizonDagen of (heeftVoorkeur ? [undefined, 30, 60] : [undefined, 30])) {
    for (const naam of inmeters) {
      const sl = await zoekSlots({
        agenda: agenda[naam] || [], adres: lead.volledigAdres, duurMin: duur,
        werkdagen: planner.werkdagenVoor(naam, horizonDagen),
        startAdres: planner.ROOSTER[naam]?.startAdres || undefined,
        eindAdres: planner.ROOSTER[naam]?.eindAdres || undefined,
      }).catch(() => []);
      beste.push(...sl.map((x) => ({ ...x, inmeter: naam })));
    }
    // STRIKT tellen (pasBijVoorkeur valt zacht terug op alle dagen en zou hier altijd "genoeg" zeggen)
    const genoeg = heeftVoorkeur
      ? kiesWinkelOpties(striktBijVoorkeur(beste, { dagen, dagdeel, vanaf }), max).length >= Math.min(max, 3)
      : kiesWinkelOpties(beste, max).length >= max;
    if (genoeg) break; // genoeg (passende) opties, niet verder kijken
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
  const strikt = striktBijVoorkeur(beste, { dagen, dagdeel, vanaf });
  const passend = pasBijVoorkeur(beste, { dagen, dagdeel, vanaf });
  if (vanaf && !passend.length) return { slots: [], duurMin: duur, naam: lead.naam, voorkeurGehonoreerd: false };
  const voorkeurGehonoreerd = !heeftVoorkeur || strikt.length > 0;
  beste = strikt.length ? strikt : (passend.length ? passend : beste);
  beste.sort((a, b) => a.extraRijtijdMin - b.extraRijtijdMin || a.aankomst - b.aankomst);

  const keuze = kiesWinkelOpties(beste, max);
  const fmt = (s) => new Date(s.aankomst).toLocaleString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam',
  });
  return {
    naam: lead.naam, duurMin: duur, voorkeurGehonoreerd,
    opmerkingVoorkeur: voorkeurGehonoreerd ? null : 'Geen enkele plek gevonden die aan de voorkeur van de klant voldoet (tot ~3 maanden vooruit gekeken); onderstaande tijden zijn de dichtstbijzijnde alternatieven. Zeg dat eerlijk.',
    slots: keuze.map((s) => ({
      tekst: `${fmt(s)} (inmeter ${s.inmeter}, thuisblijfvenster ${venster(s)})`,
      aankomst: (s.aankomst instanceof Date ? s.aankomst : new Date(s.aankomst)).toISOString(),
      inmeter: s.inmeter,
    })),
  };
}

module.exports = { zoekInmeetTijden, haalRpItem };

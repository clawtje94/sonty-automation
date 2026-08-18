// DE VERZENDPOORT (Daimy 2026-08-18: "mensen moeten GOED geholpen worden…
// die planningsbot is KUT" — na Hans de Lamboij: 4 voorstellen in 13 uur, waarvan
// één 2 minuten nadat kantoor handmatig in het gesprek zat).
//
// Elk automatisch klantbericht van de PLANNINGSKETEN (aanbod, bevestiging,
// herinnering, ontvangstbevestiging) hoort hier eerst langs. Sonny heeft zijn
// eigen gespreksbegrip en valt hier buiten.
//
// Drie remmen, in volgorde:
//   1. stil-lijst (klant-stil.js): mens voert het gesprek → bot zwijgt, altijd.
//   2. mens-actief: zat er in de afgelopen 24 uur een HANDMATIG bericht van ons
//      in het gesprek (outbound zonder bot-handtekening), dan is een mens bezig
//      → automatiek zwijgt. Dit had het 10:02-voorstel over kantoor heen gestopt.
//   3. max 2 voorstellen: derde automatische voorstel binnen 7 dagen gaat er
//      niet meer uit → één "mens nodig"-melding naar kantoor.
//
// Storing (Trengo blijft 429/fout): voorstellen FAIL-CLOSED (liever geen bericht
// dan spam), bevestigingen na een boeking FAIL-OPEN (stilte na een boeking is de
// enige echt foute uitkomst — regel bevestiging-na-boeking).
const fs = require('fs');
const path = require('path');
const { klantStil } = require('./klant-stil.js');

const TT = fs.readFileSync(path.join(__dirname, '..', '.trengo-api-token.txt'), 'utf8').trim();
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

// Herkenbare handtekeningen van onze eigen automatiek. Outbound ZONDER een van
// deze patronen = een mens die typt (kantoor, Daimy, winkel).
const BOT_PATRONEN = [
  /Groetjes,\s*Nanny van Sonty/i,
  /Groetjes,\s*Jaimy/i,
  /Ons voorstel:/i,
  /Tik op een knop/i,
  /goed nieuws: we kunnen bij je langskomen/i,
  /Tot morgen! Onze inmeter/i,
  /Herinnering:.*inmeter/i,
  /🤖 Door de AI gedaan/,
];
const VOORSTEL_PATROON = /Ons voorstel:|Tik op een knop en we zetten hem vast/i;

function isBotBericht(tekst) {
  return BOT_PATRONEN.some((p) => p.test(tekst || ''));
}

/**
 * Pure beoordelingskern — geen IO, dus testbaar op echte gesprekshistorie.
 * @param {Array<{message:string, contact_id:any, created_at:string}>} berichten
 * @param {{soort:string, nu?:number}} opties  soort: 'voorstel'|'bevestiging'|'herinnering'|'ontvangst'
 */
function beoordeel(berichten, { soort, nu = Date.now() }) {
  const DAG = 24 * 3600 * 1000, WEEK = 7 * DAG;
  const uit = (berichten || []).filter((m) => !m.contact_id);

  const mensActief = uit.some((m) => {
    const t = m.created_at ? nu - new Date(m.created_at).getTime() : Infinity;
    return t >= 0 && t < DAG && !isBotBericht(m.message);
  });
  // Een mens in het gesprek blokkeert alles behalve de boekingsbevestiging:
  // die hoort bij een zojuist gemaakte afspraak en mag nooit stil wegvallen.
  if (mensActief && soort !== 'bevestiging') {
    return { ok: false, reden: 'mens-actief', mensNodig: false };
  }

  if (soort === 'voorstel') {
    const voorstellen = uit.filter((m) => {
      const t = m.created_at ? nu - new Date(m.created_at).getTime() : Infinity;
      return t >= 0 && t < WEEK && VOORSTEL_PATROON.test(m.message || '');
    }).length;
    if (voorstellen >= 2) return { ok: false, reden: 'max-voorstellen (' + voorstellen + ' al gestuurd)', mensNodig: true };
  }
  return { ok: true, reden: 'ok' };
}

async function haalBerichten(ticketId) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/messages?per_page=30`, {
      headers: { Authorization: 'Bearer ' + TT },
    });
    if (r.status === 429) { await wacht(15000 * (i + 1)); continue; }
    if (!r.ok) return null;
    return (await r.json())?.data || [];
  }
  return null;
}

/**
 * DE poort. Aanroepen vóór elk automatisch klantbericht uit de planningsketen.
 * @returns {Promise<{ok:boolean, reden:string, mensNodig?:boolean}>}
 */
async function magSturen({ telefoon, ticketId, soort }) {
  if (klantStil(telefoon)) return { ok: false, reden: 'stil-lijst' };
  if (!ticketId) return { ok: true, reden: 'geen ticket bekend — alleen stil-lijst getoetst' };
  const berichten = await haalBerichten(ticketId);
  if (berichten === null) {
    // Trengo onbereikbaar: voorstellen dicht, bevestigingen open (zie kop).
    return soort === 'bevestiging'
      ? { ok: true, reden: 'trengo-storing — bevestiging mag door (fail-open)' }
      : { ok: false, reden: 'trengo-storing — ' + soort + ' tegengehouden (fail-closed)' };
  }
  return beoordeel(berichten, { soort });
}

/** Eén nette kantoor-melding als de poort "mens nodig" zegt. */
async function meldMensNodig(naam, reden) {
  try {
    const { planningTelegram } = require('./telegram-planning.js');
    await planningTelegram(`✋ ${naam}: automatiek gestopt (${reden}). Mens nodig — pak het gesprek handmatig op via het inmeet-dashboard of Trengo.`);
  } catch { /* melding is extra */ }
}

module.exports = { magSturen, beoordeel, isBotBericht, meldMensNodig };

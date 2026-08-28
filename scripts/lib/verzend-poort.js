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
  /Groetjes,\s*Sunny/i,
  /Kind regards,\s*Sunny/i,
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

// Trengo-gebruikers die ONZE AUTOMATIEK zijn (Sunny/Nanny/Jaimy-bot posten allemaal
// via het API-account "Sunny Sonty", id 747786). Een OUTBOUND van een ander user-id
// is een echt mens (Daimy, Jorren, Joey, Jaimy, Sjoerd, Tanya, Nanny van Vliet).
const BOT_USER_IDS = new Set([747786]);

/** Is dit bericht van ONS naar de klant? De Trengo messages-API geeft GEEN contact_id
 *  terug (wel `type` INBOUND/OUTBOUND/NOTE en `contact`). De oude toets `!m.contact_id`
 *  was daardoor voor ÉLK bericht waar — ook voor dat van de klant zelf — zodat elke
 *  klantreactie 24 uur "mens-actief" gaf en de hele keten zweeg (Fatih, Marius,
 *  Mirjam 19/20-08: vragen en "ander moment" kregen niets terug). */
function isOutbound(m) {
  const type = String(m?.type || m?.message_type || '').toUpperCase();
  if (type) return type === 'OUTBOUND';
  if (m?.direction) return m.direction === 'outgoing';
  return !m?.contact_id && !m?.contact; // oude/onbekende vorm: terugvallen op contact-velden
}

/** Een mens aan onze kant typte dit: outbound, niet van het bot-account, en zonder
 *  bot-handtekening in de tekst (vangnet voor berichten die via een ander token gaan). */
function isMensBericht(m) {
  if (!isOutbound(m)) return false;
  if (m?.user_id != null && BOT_USER_IDS.has(Number(m.user_id))) return false;
  return !isBotBericht(m?.message || m?.body || '');
}

/**
 * Pure beoordelingskern — geen IO, dus testbaar op echte gesprekshistorie.
 * @param {Array<{message:string, type?:string, user_id?:number, contact_id?:any, created_at:string}>} berichten
 * @param {{soort:string, nu?:number}} opties  soort: 'voorstel'|'bevestiging'|'herinnering'|'ontvangst'
 */
function beoordeel(berichten, { soort, nu = Date.now(), opVerzoek = false, luistert = false }) {
  const DAG = 24 * 3600 * 1000, WEEK = 7 * DAG;
  const uit = (berichten || []).filter(isOutbound);

  // Wanneer schreef er voor het laatst een MENS van ons in dit gesprek?
  const sindsMens = uit.reduce((kortst, m) => {
    if (!isMensBericht(m)) return kortst;
    const t = m.created_at ? nu - new Date(String(m.created_at).replace(' ', 'T')).getTime() : Infinity;
    return t >= 0 && t < kortst ? t : kortst;
  }, Infinity);
  // Een mens in het gesprek blokkeert alles behalve de boekingsbevestiging.
  // VOORSTELLEN mogen sinds 26-08 (Daimy, geval Sem) al na 1,5 uur: het gesprek met
  // de collega ging meestal juist over het akkoord, en dan is het inmeetvoorstel het
  // logische vervolg — 24 uur wachten is dan onnodig traag. De rest blijft 24 uur
  // dicht (Hans de Lamboij-les: nooit een bot over een lopend mensgesprek heen).
  const mensVenster = soort === 'voorstel' ? 1.5 * 3600000 : DAG;
  if (sindsMens < mensVenster && soort !== 'bevestiging') {
    return { ok: false, reden: 'mens-actief', mensNodig: false };
  }

  if (soort === 'voorstel' && !luistert) {
    const voorstellen = uit.filter((m) => {
      const t = m.created_at ? nu - new Date(String(m.created_at).replace(' ', 'T')).getTime() : Infinity;
      return t >= 0 && t < WEEK && VOORSTEL_PATROON.test(m.message || '');
    }).length;
    // Vraagt de klant er zelf om (herplan na "ander moment"), dan is een extra
    // voorstel geen spam: budget 4 per week in plaats van 2 (Daimy 26-08). De
    // pingpong-rem (max 2 automatische herplanningen per dag) blijft ernaast staan.
    const maxV = opVerzoek ? 4 : 2;
    if (voorstellen >= maxV) return { ok: false, reden: 'max-voorstellen (' + voorstellen + ' al gestuurd)', mensNodig: true };
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
async function magSturen({ telefoon, email, ticketId, soort, opVerzoek = false, luistert = false, herhaling = false }) {
  // WAAR DE LIMIET VOOR IS (Daimy 26-08): "dat limiet is als er domme voorstellen
  // worden gedaan en niet naar de klant wordt geluisterd. Als dat wel wordt gedaan
  // hoeft dat limiet niet." Een voorstel dat aantoonbaar op de wens van de klant is
  // gebouwd (zijn uitgesloten dagen, zijn voorkeur, zijn vanaf-datum, en geen tijd die
  // hij al afwees) telt dus niet mee. De stil-lijst en mens-actief blijven wél gelden:
  // die gaan niet over kwaliteit maar over wie er aan zet is.
  // Handmatige override (alleen voor een bewuste, eenmalige run op verzoek van
  // Daimy, bv. POORT_OVERRIDE=1 node cron-inmeten-planner.js --live --alleen=...).
  // De daemons zetten deze variabele nooit. De stil-lijst blijft ALTIJD gelden.
  if (process.env.POORT_OVERRIDE === '1' && !klantStil(telefoon)) {
    console.log('  verzendpoort: OVERRIDE actief (handmatige run) — poort doorgelaten');
    return { ok: true, reden: 'handmatige override' };
  }
  if (klantStil(telefoon)) return { ok: false, reden: 'stil-lijst' };
  // MAX-2 GELDT OOK ZONDER WHATSAPP (19-08, Melchior Blok: mail-only klant met een
  // onbruikbaar telefoonnummer kreeg 3 aanbod-mails op één ochtend omdat de telling
  // alleen naar het WhatsApp-gesprek keek). Eigen verzendadministratie telt mee.
  if (soort === 'voorstel' && !luistert) {
    try {
      const st = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'inmeten-planner-state.json'), 'utf8'));
      const t9 = String(telefoon || '').replace(/\D/g, '').slice(-9);
      const mail = String(email || '').trim().toLowerCase();
      const WEEK = 7 * 24 * 3600 * 1000;
      const eerder = Object.values(st.aanbodTickets || {}).filter((a) => {
        const zelfde = (t9 && String(a.telefoon || '').replace(/\D/g, '').slice(-9) === t9)
          || (mail && String(a.email || '').trim().toLowerCase() === mail);
        return zelfde && a.verstuurdOp && (Date.now() - Date.parse(a.verstuurdOp)) < WEEK;
      }).length;
      const maxA = opVerzoek ? 4 : 2;
      if (eerder >= maxA) return { ok: false, reden: 'max-voorstellen (' + eerder + ' al gestuurd deze week, administratie)', mensNodig: true };
    } catch { /* administratie onleesbaar: dan telt alleen het gesprek */ }
  }
  // O1 (Daimy 28-08, Sunny plant zelf): nooit een TWEEDE voorstel binnen 24 uur aan
  // dezelfde klant, uit welke route dan ook (planner, dashboard-klik, Sunny) — tenzij de
  // klant er zelf om vroeg (opVerzoek/luistert) of het een herinnering aan hetzelfde
  // voorstel is. Bron: de eigen verzendadministratie (aanbodTickets).
  if (soort === 'voorstel' && !opVerzoek && !luistert && !herhaling) {
    try {
      const st = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'inmeten-planner-state.json'), 'utf8'));
      const laatste = require('./sunny-start.js').laatsteVoorstelOp(st, { telefoon, email });
      if (laatste && Date.now() - laatste < 24 * 3600000) {
        const wanneer = new Date(laatste).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', hour: '2-digit', minute: '2-digit' });
        return { ok: false, reden: 'al een voorstel <24u geleden (' + wanneer + ') — geen tweede', mensNodig: false };
      }
    } catch { /* administratie onleesbaar: dan telt alleen het gesprek */ }
  }
  // SUNNY IS AL IN GESPREK (28-08): heeft Sunny dit ticket geclaimd (hij noemde zelf net
  // tijden of handelt een ander-moment af), dan stuurt de planningsketen géén voorstel
  // overheen — twee stemmen in één gesprek is precies wat Daimy niet wil.
  if (soort === 'voorstel' && ticketId && !opVerzoek && !luistert) {
    try {
      if (require('./gesprek-claims.js').geclaimd(ticketId, 120)) return { ok: false, reden: 'sunny-in-gesprek (ticket geclaimd door Sunny)', mensNodig: false };
    } catch { /* geen claims-administratie: gewoon door */ }
  }
  if (!ticketId) return { ok: true, reden: 'geen ticket bekend — stil-lijst en verzendadministratie getoetst' };
  const berichten = await haalBerichten(ticketId);
  if (berichten === null) {
    // Trengo onbereikbaar: voorstellen dicht, bevestigingen open (zie kop).
    return soort === 'bevestiging'
      ? { ok: true, reden: 'trengo-storing — bevestiging mag door (fail-open)' }
      : { ok: false, reden: 'trengo-storing — ' + soort + ' tegengehouden (fail-closed)' };
  }
  return beoordeel(berichten, { soort, opVerzoek, luistert });
}

/** Eén nette kantoor-melding als de poort "mens nodig" zegt. */
async function meldMensNodig(naam, reden) {
  // Vastleggen voor de dagelijkse mens-nodig-digest (26-08): geparkeerde klanten
  // mogen niet uit beeld raken nu de wachtrij ze niet meer eindeloos herhaalt.
  try {
    fs.appendFileSync(path.join(__dirname, '..', '..', 'data', 'mens-nodig-log.jsonl'),
      JSON.stringify({ op: new Date().toISOString(), naam, reden }) + '\n');
  } catch { /* log is extra */ }
  try {
    const { planningTelegram } = require('./telegram-planning.js');
    await planningTelegram(`✋ ${naam}: automatiek gestopt (${reden}). Mens nodig — pak het gesprek handmatig op via het inmeet-dashboard of Trengo.`);
  } catch { /* melding is extra */ }
}

module.exports = { magSturen, beoordeel, isBotBericht, isOutbound, isMensBericht, meldMensNodig, BOT_USER_IDS };

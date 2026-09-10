// INMEET-BEVESTIG-POORT (Daimy 10-09, casus Saskia Badloe ticket 979446080).
//
// Sunny zei twee keer "maandag 21 september om 13:40 staat voor je genoteerd" zonder
// inmeet_boeken aan te roepen. Er stond dus niets in Outlook/Planado, de 24-uurs
// herinnering en ronde 2 gingen gewoon door en de klant kreeg drie voorstellen voor
// één afspraak ("dit doet erge afbreuk aan het vertrouwen").
//
// Regel: een antwoord dat een INMEETMOMENT als vaststaand bevestigt mag alleen de deur
// uit als (a) in deze beurt echt geboekt is (inmeet_boeken → wachtrij), of (b) er al
// een geboekte afspraak staat voor deze klant op dat moment (administratie of de
// Sonty Montage-agenda, want kantoor boekt ook zelf). Anders: blokkeren, één herkansing
// (boek het, of zeg eerlijk dat het nog niet vaststaat), daarna een eerlijk wachtbericht
// + overdracht. Nooit stilte, nooit een valse bevestiging.
//
// beoordeel() is puur (scenario-lab/onderdelen/inmeet-bevestig-poort.js); vindBoekingVan()
// kijkt in de administratie én de agenda (tests/inmeet-bevestig-regressie.js op echte historie).
const fs = require('fs');
const path = require('path');

const MAANDEN = {
  januari: 1, jan: 1, january: 1, februari: 2, feb: 2, february: 2, maart: 3, mrt: 3, march: 3,
  april: 4, apr: 4, mei: 5, may: 5, juni: 6, jun: 6, june: 6, juli: 7, jul: 7, july: 7,
  augustus: 8, aug: 8, august: 8, september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, october: 10,
  november: 11, nov: 11, december: 12, dec: 12,
};
const DAGEN = {
  zondag: 0, sunday: 0, maandag: 1, monday: 1, dinsdag: 2, tuesday: 2, woensdag: 3, wednesday: 3,
  donderdag: 4, thursday: 4, vrijdag: 5, friday: 5, zaterdag: 6, saturday: 6,
};
const MAAND_RE = Object.keys(MAANDEN).sort((a, b) => b.length - a.length).join('|');
const DAG_RE = Object.keys(DAGEN).join('|');

/** Bevestigende formuleringen: "het staat vast". */
const CLAIM = new RegExp(
  '(' +
  'genoteerd|vastgezet|vastgelegd|staat vast|staan vast|' +
  'staat (nu |dus |gewoon |dan |definitief |goed )?(voor (je|jullie|u) )?(genoteerd|ingepland|vast|geboekt|in (de|onze|je|jullie) agenda|in het systeem)|' +
  'zet ik (hem|het|de afspraak|\'m|die)? ?(nu |zo |meteen |dan )?(voor (je|jullie|u) )?vast|' +
  '(is|staat) (definitief |nu |dus |goed )?(geboekt|ingepland|gepland|bevestigd)|' +
  'ingepland|' +
  'booked|confirmed|noted for|scheduled for|locked in' +
  ')', 'i');
/** Toekomst/ontkenning: "wordt ingepland", "zodra het vastgezet is", "nog niet geboekt" = geen bevestiging. */
const GEEN_CLAIM = /((wordt|worden|word|zodra|kan|kunnen|moet|moeten|gaat|gaan|zal|zullen|nog niet|niet|voordat|will be|can be|to be|not)\s+([^\s.,!?;:]+\s+){0,3}(ingepland|gepland|vastgezet|geboekt|vastgelegd|genoteerd|bevestigd|booked|confirmed|scheduled))|((nog )?(niet|nooit|geen)\s+(\S+\s+){0,2}(vast|genoteerd|ingepland|geboekt))/gi;
/** "genoteerd" als notitie, niet als afspraakbevestiging: die stukken tellen niet mee. */
const NOTITIE = /((telefoon)?nummer|voorkeur|wens|opmerking|adres|mailadres|e-?mail|kleur|maten|maat|notitie|wijziging|aanpassing|gegevens|bijzonderheden|dat je|dat u|voor de plann(ing|er))[^.!?\n]{0,40}genoteerd|genoteerd (dat|voor de plann(ing|er)|als)/gi;

/** Het gaat over inmeten: in de tekst zelf of in het gesprek eromheen. */
const INMEET = /inmeet|inmeten|ingemeten|opmeten|op te meten|meet .{0,30}(op|in)|adviseur|komt .{0,40}(langs|bij (je|u|jullie))|bij (je|u|jullie) thuis|onderweg|route|sms|volglink|(measure|measuring|survey)/i;
const INMEET_HARD = /inmeet|inmeten|ingemeten|opmeten|op te meten|(measure|measuring|survey)/i;
const SHOWROOM = /showroom|winkel|frijdastraat/i;

function momentUitTekst(tekst) {
  const t = String(tekst || '').toLowerCase();
  const m = t.match(new RegExp('(\\d{1,2})\\s*(' + MAAND_RE + ')\\b'));
  const d = t.match(new RegExp('\\b(' + DAG_RE + ')\\b'));
  const u = t.match(/\b(\d{1,2})[:.](\d{2})\b/);
  return {
    dag: m ? Number(m[1]) : null, maand: m ? MAANDEN[m[2]] : null,
    weekdag: d ? DAGEN[d[1]] : null,
    uur: u ? Number(u[1]) : null, minuut: u ? Number(u[2]) : null,
    heeftMoment: !!(m || d || u),
  };
}

/** Genoemd moment → eerstvolgende datum (voor een smal agenda-venster). null als er geen dag/datum in staat. */
function momentDatum(tekst, nu = new Date()) {
  const m = momentUitTekst(tekst);
  const basis = new Date(new Date(nu).toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  basis.setHours(12, 0, 0, 0);
  if (m.dag != null) {
    let d = new Date(basis.getFullYear(), m.maand - 1, m.dag, 12);
    if (d < new Date(+basis - 45 * 864e5)) d = new Date(basis.getFullYear() + 1, m.maand - 1, m.dag, 12);
    return d;
  }
  if (m.weekdag != null) {
    const d = new Date(basis);
    d.setDate(d.getDate() + ((m.weekdag - d.getDay() + 7) % 7));
    return d;
  }
  return null;
}

function boekingDelen(aankomst) {
  const dt = new Date(aankomst);
  if (isNaN(+dt)) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(dt).map((x) => [x.type, x.value]));
  return { dag: Number(p.day), maand: Number(p.month), weekdag: new Date(dt.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })).getDay(), uur: Number(p.hour) % 24, minuut: Number(p.minute) };
}

/** Komt het moment in de tekst overeen met de geboekte afspraak? Onbekend deel = geen tegenspraak.
 *  Tijd: binnen een uur van de geboekte aankomst telt (kantoor noemt vaak een venster "tussen 10:05 en 10:35"). */
function momentPast(moment, boeking) {
  const b = boekingDelen(boeking?.aankomst);
  if (!b) return false;
  if (moment.dag != null && (moment.dag !== b.dag || moment.maand !== b.maand)) return false;
  if (moment.dag == null && moment.weekdag != null && moment.weekdag !== b.weekdag) return false;
  if (moment.uur != null && Math.abs((moment.uur * 60 + moment.minuut) - (b.uur * 60 + b.minuut)) > 60) return false;
  return true;
}

/** Voorwaardelijk/vragend ("laat maar weten welke dag, dan zet ik hem vast") is een aanbod, geen bevestiging. */
const VOORWAARDE = /laat (maar |het )?(even )?weten|welke (dag|tijd|moment)|als (je|u|jullie)|zodra|wil (je|u)|zou (je|u)|kun (je|u)|kies|keuze|\?/i;
/** Zinnen met een bevestiging (elk met de zin erna, want "staat genoteerd. De adviseur komt maandag..." hoort bij elkaar). */
function claimZinnen(schoon) {
  const zinnen = String(schoon).split(/(?<=[.!?\n])\s+/);
  const uit = [];
  zinnen.forEach((z, i) => { if (CLAIM.test(z) && !VOORWAARDE.test(z)) uit.push(z + ' ' + (zinnen[i + 1] || '')); });
  return uit;
}

/**
 * @param {object} p
 * @param {string} p.tekst concept-antwoord aan de klant
 * @param {string} [p.context] rest van het gesprek (klant + eerdere antwoorden), voor de inmeetcontext
 * @param {boolean} [p.inmeetGeboektDezeBeurt] inmeet_boeken heeft in deze beurt de boeking in de wachtrij gezet
 * @param {{aankomst:string,status?:string}|null} [p.bestaandeBoeking] geboekte inmeetafspraak van deze klant
 * @returns {{blok:boolean, reden:string, claim:boolean}}
 */
function beoordeel({ tekst, context = '', inmeetGeboektDezeBeurt = false, bestaandeBoeking = null }) {
  const ruw = String(tekst || '');
  const schoon = ruw.replace(NOTITIE, ' ').replace(GEEN_CLAIM, ' ');
  const zinnen = claimZinnen(schoon);
  if (!zinnen.length) return { blok: false, reden: 'geen bevestigende formulering', claim: false };
  if (!INMEET.test(ruw) && !INMEET_HARD.test(String(context || ''))) return { blok: false, reden: 'geen inmeetcontext', claim: false };
  if (SHOWROOM.test(ruw) && zinnen.every((z) => SHOWROOM.test(z) && !INMEET_HARD.test(z))) return { blok: false, reden: 'showroomafspraak, valt buiten deze poort', claim: false };
  const moment = momentUitTekst(zinnen.join(' '));
  if (!moment.heeftMoment) return { blok: false, reden: 'geen concreet moment genoemd', claim: false };
  if (inmeetGeboektDezeBeurt) return { blok: false, reden: 'in deze beurt geboekt (inmeet_boeken)', claim: true };
  const geboekt = bestaandeBoeking && (bestaandeBoeking.status || 'geboekt') === 'geboekt';
  if (geboekt && momentPast(moment, bestaandeBoeking)) return { blok: false, reden: 'bestaande boeking op dit moment (' + (bestaandeBoeking.bron || 'administratie') + ')', claim: true };
  if (geboekt) return { blok: true, reden: 'bevestigt een ander moment dan de geboekte afspraak (' + String(bestaandeBoeking.aankomst).slice(0, 16) + ')', claim: true };
  return { blok: true, reden: 'bevestigt een inmeetmoment als vaststaand terwijl er niets geboekt is', claim: true };
}

/** Administratie: geboekte inmeetafspraak van deze klant (zelfde sleutel als de dubbelboeking-poort). */
function vindBoekingInAdministratie({ naam, telefoon, email }) {
  try {
    const bo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'inmeet-boekingen.json'), 'utf8'));
    const t9 = String(telefoon || '').replace(/\D/g, '').slice(-9);
    const ln = String(naam || '').trim().toLowerCase();
    const em = String(email || '').trim().toLowerCase();
    const hit = Object.values(bo).filter((b) => b.status === 'geboekt' && (
      (t9.length === 9 && String(b.telefoon || '').replace(/\D/g, '').slice(-9) === t9) ||
      (em && String(b.email || '').toLowerCase() === em) ||
      (ln.length >= 5 && String(b.naam || '').trim().toLowerCase() === ln)
    )).sort((a, b) => Date.parse(b.geboektOp || 0) - Date.parse(a.geboektOp || 0))[0];
    return hit ? { aankomst: hit.aankomst, status: 'geboekt', inmeter: hit.inmeter, bron: 'administratie' } : null;
  } catch { return null; }
}

/** Sonty Montage-agenda: kantoor boekt ook zelf ("Inmeten — naam" / "Inmeten Sonty - naam", klant als genodigde). */
async function zoekInmeetInAgenda({ naam, email, telefoon, rond = null, van = new Date(), tot = new Date(Date.now() + 150 * 864e5) }) {
  if (rond) { van = new Date(+new Date(rond) - 3 * 864e5); tot = new Date(+new Date(rond) + 3 * 864e5); } // smal venster rond het genoemde moment
  const ln = String(naam || '').trim().toLowerCase();
  const em = String(email || '').trim().toLowerCase();
  const t9 = String(telefoon || '').replace(/\D/g, '').slice(-9);
  const naamDelen = ln.split(/\s+/).filter((p) => p.length >= 4);
  if (ln.length < 5 && !em && t9.length !== 9 && !naamDelen.length) return null;
  const token = fs.readFileSync(path.join(__dirname, '..', '.owa-token.txt'), 'utf8').trim();
  const OH = { Authorization: 'Bearer ' + token };
  const cals = (await (await fetch('https://outlook.office.com/api/v2.0/me/calendars?$top=50', { headers: OH })).json()).value || [];
  const cal = cals.find((c) => c.Name === 'Sonty Montage');
  if (!cal) throw new Error('kalender Sonty Montage niet gevonden');
  const url = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView?$top=500&$select=Subject,Start,End,IsCancelled,Attendees,Body&startDateTime=${new Date(van).toISOString()}&endDateTime=${new Date(tot).toISOString()}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const alle = [];
    let volgende = url;
    for (let p = 0; p < 6 && volgende; p++) { // Sonty Montage is druk: altijd doorbladeren, nooit stil afkappen op 500
      const j = await (await fetch(volgende, { headers: OH, signal: ctl.signal })).json();
      if (j.error) throw new Error(j.error.message || 'agenda-fout');
      alle.push(...(j.value || []));
      volgende = j['@odata.nextLink'] || null;
    }
    const hits = alle.filter((e) => !e.IsCancelled && /inmeten|inmeet/i.test(e.Subject || '') && (
      (ln.length >= 5 && String(e.Subject || '').toLowerCase().includes(ln)) ||
      (!!rond && naamDelen.some((p) => String(e.Subject || '').toLowerCase().includes(p))) || // smal venster: voornaam/achternaam volstaat
      (em && (e.Attendees || []).some((a) => String(a.EmailAddress?.Address || '').toLowerCase() === em)) ||
      (t9.length === 9 && String(e.Body?.Content || '').replace(/\D/g, '').includes(t9))
    )).sort((a, b) => String(a.Start?.DateTime).localeCompare(String(b.Start?.DateTime)));
    const e = hits[0];
    if (!e?.Start?.DateTime) return null;
    return { aankomst: new Date(e.Start.DateTime.replace(/Z?$/, 'Z')).toISOString(), status: 'geboekt', bron: 'agenda', onderwerp: e.Subject };
  } finally { clearTimeout(timer); }
}

/** Beide bronnen; agenda-fout = onbekend (null), nooit een crash in het antwoordpad. */
async function vindBoekingVan({ naam, telefoon, email, rond, van, tot }) {
  const a = vindBoekingInAdministratie({ naam, telefoon, email });
  if (a) return a;
  try { return await zoekInmeetInAgenda({ naam, email, telefoon, rond, van, tot }); } catch (e) { console.log('  inmeet-bevestig-poort: agenda niet leesbaar (' + String(e.message).slice(0, 60) + ')'); return null; }
}

function herkansingsTekst(oordeel) {
  return `INTERNE POORT wees je concept af: ${oordeel.reden}. Je mag een inmeetmoment ALLEEN als vaststaand bevestigen als je het in deze beurt echt hebt geboekt met inmeet_boeken (akkoordCitaat = de letterlijke woorden van de klant, tijd uit inmeet_tijden). Doe dat nu als de klant duidelijk één moment koos. Kan dat niet (geen keuze, tool niet beschikbaar), schrijf dan eerlijk dat je het moment doorgeeft aan de planning en dat de definitieve bevestiging vanzelf volgt. Schrijf NOOIT "staat genoteerd", "staat vast" of "ingepland" zonder boeking. Antwoord alleen met de tekst voor de klant.`;
}

/** Eerlijk vangnet na twee afkeuringen: geen valse bevestiging, geen stilte. */
function vangnetTekst(taal = 'nl') {
  return taal === 'en'
    ? 'Thanks! I\'m passing your choice on to our planning team right now. You\'ll receive the definitive confirmation as soon as the appointment is locked in.'
    : 'Dank je! Ik geef je keuze nu meteen door aan onze planning. Zodra de afspraak echt vaststaat krijg je vanzelf de definitieve bevestiging.';
}

module.exports = { beoordeel, herkansingsTekst, vangnetTekst, vindBoekingVan, vindBoekingInAdministratie, zoekInmeetInAgenda, momentUitTekst, momentDatum, momentPast, CLAIM, INMEET };

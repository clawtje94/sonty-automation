// Onderdeel: SUNNY-START — Sunny stuurt zelf het eerste inmeetvoorstel zodra een klant
// op "Inmeten inplannen" komt (Daimy 28-08: "op een menselijke manier de beste tijd
// aanbieden en inboeken, geen dubbele mails en berichten").
//
// Drie lagen, allemaal de ECHTE code uit scripts/lib/sunny-start.js:
//   A. magStarten  — mag er NU een eerste voorstel uit? (vlag, contact, bestaand, venster, 24u-regel)
//   B. voorstelTekst / voorstelMailHtml — is Sunny's bericht goed (taal, tijd, marge, vraag, handtekening)?
//   C. eigenaarVanReactie — precies één eigenaar per klantreactie (Sunny of reply-route), nooit twee, nooit nul
//
// Orakel: zie docs/sunny-inmeet-plannen-ontwerp.md (O1, O2, O5–O10, O14, O16).
const { combinaties } = require('../matrix.js');
const S = require('../../scripts/lib/sunny-start.js');

// vaste "nu"-momenten in NL-tijd (CEST = UTC+2 eind augustus/september)
const T = (dagStr, uur, min) => Date.parse(`${dagStr}T${String(uur).padStart(2, '0')}:${String(min).padStart(2, '0')}:00+02:00`);
const DI = '2026-09-01', ZA = '2026-09-05', ZO = '2026-09-06';
const uur = (h) => h * 3600000;

// ── A. magStarten ─────────────────────────────────────────────────────────────
const dimA = [
  { naam: 'vlag', waarden: [{ label: 'aan', aan: true }, { label: 'uit', aan: false }] },
  { naam: 'contact', waarden: [
    { label: 'wa+mail', telefoon: '+31612345678', email: 'k@lab.test' },
    { label: 'alleen-wa', telefoon: '+31612345678', email: '' },
    { label: 'alleen-mail', telefoon: '', email: 'k@lab.test' },
    { label: 'geen', telefoon: '', email: '' },
  ] },
  { naam: 'bestaand', waarden: [
    { label: 'niets' },
    { label: 'lopend-keuzelink', lopend: true },
    { label: 'geboekt', geboekt: true },
    { label: 'voorstel-2u-geleden', vorigeUur: 2 },
    { label: 'voorstel-30u-geleden', vorigeUur: 30 },
    { label: 'voorstel-2u-op-telefoon', vorigeUur: 2, opTelefoon: true },
    { label: 'twee-eerdere-voorstellen-30u', vorigeUur: 30, eerder: 2 },
    { label: 'drie-eerdere-voorstellen-30u', vorigeUur: 30, eerder: 3 },
  ] },
  { naam: 'tijd', waarden: [
    { label: 'di-07:00', nu: T(DI, 7, 0), open: false },
    { label: 'di-08:30', nu: T(DI, 8, 30), open: true },
    { label: 'di-13:00', nu: T(DI, 13, 0), open: true },
    { label: 'di-19:59', nu: T(DI, 19, 59), open: true },
    { label: 'di-20:01', nu: T(DI, 20, 1), open: false },
    { label: 'za-10:00', nu: T(ZA, 10, 0), open: true },
    { label: 'zo-12:00', nu: T(ZO, 12, 0), open: false },
  ] },
  { naam: 'slots', waarden: [{ label: '1', n: 1 }, { label: '0', n: 0 }] },
  { naam: 'opVerzoek', waarden: [{ label: 'nee', v: false }, { label: 'ja', v: true }] },
];

function orakelA(s) {
  const c = s.contact, b = s.bestaand;
  const contactOk = !!(c.telefoon || c.email);
  // een oud administratie-record zonder rpItemId is alleen te koppelen via een contactgegeven dat de lead óók heeft
  const koppelbaar = !b.opTelefoon || !!c.telefoon;
  const vorigeBlokkeert = b.vorigeUur !== undefined && b.vorigeUur < 24 && !s.opVerzoek.v && koppelbaar;
  // O1-bis: 2+ eerdere voorstellen zonder boeking → geen bot meer, mens nodig (tenzij op verzoek)
  const teVaak = (b.eerder || 0) >= 2 && !s.opVerzoek.v;
  const mag = s.vlag.aan && contactOk && !b.lopend && !b.geboekt && !vorigeBlokkeert && !teVaak && s.slots.n > 0 && s.tijd.open;
  return { wil: mag ? 'sturen' : 'blokkeer', mensNodig: s.vlag.aan && !b.geboekt && !b.lopend && (!contactOk || (teVaak && s.slots.n > 0)) };
}
function voerUitA(s) {
  const c = s.contact, b = s.bestaand;
  const lead = { rpItemId: 'rp-lab-1', naam: 'Lab Klant', telefoon: c.telefoon, email: c.email };
  const state = { aanbodTickets: {} };
  for (let i = 1; i < (b.eerder || 0); i++) {
    state.aanbodTickets['tokE' + i] = { rpItemId: 'rp-lab-1', naam: 'Lab Klant', telefoon: c.telefoon || null, email: c.email || null, verstuurdOp: new Date(s.tijd.nu - uur(30 + i * 30)).toISOString() };
  }
  if (b.vorigeUur !== undefined) {
    // oude entries hebben geen rpItemId → match op telefoon/e-mail; nieuwe wel
    state.aanbodTickets.tok1 = b.opTelefoon
      ? { naam: 'Lab Klant', telefoon: c.telefoon || '+31612345678', email: null, verstuurdOp: new Date(s.tijd.nu - uur(b.vorigeUur)).toISOString() }
      : { rpItemId: 'rp-lab-1', naam: 'Lab Klant', telefoon: c.telefoon || null, email: c.email || null, verstuurdOp: new Date(s.tijd.nu - uur(b.vorigeUur)).toISOString() };
  }
  const slots = s.slots.n ? [{ aankomst: new Date(s.tijd.nu + 5 * 86400000).toISOString(), inmeter: 'Joey' }] : [];
  const r = S.magStarten({ nu: s.tijd.nu, lead, slots, lopend: !!b.lopend, geboekt: !!b.geboekt, state, vlagAan: s.vlag.aan, opVerzoek: s.opVerzoek.v });
  // reden is altijd zichtbaar op de kaart (O16), behalve als er gestuurd wordt (dan is het bericht zelf zichtbaar)
  return { uitkomst: r.ok ? 'sturen' : 'blokkeer', reden: r.reden, mensNodig: !!r.mensNodig, melding: true };
}
function vergelijkA(w, e, s) {
  if (w.wil !== e.uitkomst) return false;
  if (w.wil === 'blokkeer') {
    // de reden moet kloppen met de oorzaak (geen "computer says no")
    const b = s.bestaand;
    if (!s.vlag.aan) return /uit/.test(e.reden);
    if (b.geboekt) return /geboekt/.test(e.reden);
    if (b.lopend) return /lopend/.test(e.reden);
    if (!s.contact.telefoon && !s.contact.email) return /mens nodig/.test(e.reden) && e.mensNodig;
    if (s.slots.n === 0) return /geen tijd/.test(e.reden);
    if ((b.eerder || 0) >= 2 && !s.opVerzoek.v) return /mens nodig/.test(e.reden) && e.mensNodig;
    if (b.vorigeUur !== undefined && b.vorigeUur < 24 && !s.opVerzoek.v && (!b.opTelefoon || !!s.contact.telefoon)) return /<24u/.test(e.reden);
    if (!s.tijd.open) return /verzendvenster/.test(e.reden);
  }
  return true;
}

// ── B. tekst ──────────────────────────────────────────────────────────────────
const dimB = [
  { naam: 'taal', waarden: [{ label: 'nl' }, { label: 'en' }] },
  { naam: 'aantal', waarden: [{ label: '1', n: 1 }, { label: '2', n: 2 }] },
  { naam: 'weken', waarden: [{ label: '1', w: 1 }, { label: '4', w: 4 }] },
  { naam: 'ver', waarden: [{ label: 'nee', v: false }, { label: 'ja', v: true }] },
  { naam: 'vorm', waarden: [{ label: 'wa' }, { label: 'mail' }] },
];
const NU_B = T(DI, 10, 0);
function orakelB(s) {
  return { wil: 'tekst', taalOk: true, handtekening: 'Sunny', tijdGenoemd: true, marge: true, vraag: true, geenGoedNieuwsBijDrukte: s.weken.w >= 3, verWegUitleg: s.ver.v, jaAntwoord: s.aantal.n === 1, knop: s.vorm.label === 'mail' };
}
function voerUitB(s) {
  const slots = Array.from({ length: s.aantal.n }, (_, i) => ({ aankomst: new Date(NU_B + s.weken.w * 7 * 86400000 + i * 86400000 + 2 * 3600000).toISOString(), inmeter: 'Joey' }));
  const basis = { voornaam: 'Kim', slots, duurMin: 30, ver: s.ver.v, taal: s.taal.label, nu: NU_B };
  const txt = s.vorm.label === 'mail' ? S.voorstelMailHtml({ ...basis, url: 'https://sonty-website.vercel.app/inmeten/tok', geldigUren: 24 }) : S.voorstelTekst(basis);
  const en = s.taal.label === 'en';
  const plat = txt.replace(/<[^>]+>/g, ' ');
  return {
    uitkomst: 'tekst',
    taalOk: en ? !/\b(Hoi|Groetjes|inmeten)\b/.test(plat) && /Hi Kim/.test(plat) : !/\b(Hi Kim|Kind regards|measure)\b/.test(plat) && /Hoi Kim/.test(plat),
    handtekening: /Sunny/.test(plat) && !/Nanny|Jaimy/.test(plat) ? 'Sunny' : 'ANDERS',
    tijdGenoemd: en ? /around \d\d:\d\d/.test(plat) : /rond \d\d:\d\d/.test(plat),
    marge: en ? /hour earlier or later/.test(plat) : /uurtje eerder of later/.test(plat),
    vraag: /\?/.test(plat),
    geenGoedNieuwsBijDrukte: !/goed nieuws|good news/i.test(plat),
    verWegUitleg: en ? /combine jobs/.test(plat) : /combineren klussen/.test(plat),
    jaAntwoord: en ? /reply "yes"/.test(plat) : /gewoon "ja"/.test(plat),
    knop: /<a href=/.test(txt),
    melding: true,
  };
}
function vergelijkB(w, e) {
  return Object.keys(w).filter((k) => k !== 'wil').every((k) => w[k] === e[k]);
}

// ── C. eigenaar van een klantreactie ─────────────────────────────────────────
const dimC = [
  { naam: 'bron', waarden: [{ label: 'sunny' }, { label: 'nanny' }, { label: 'onbekend', leeg: true }] },
  { naam: 'claim', waarden: [{ label: 'actief', g: true }, { label: 'geen', g: false }] },
  { naam: 'sunnyLeeft', waarden: [{ label: 'ja', l: true }, { label: 'nee', l: false }] },
  { naam: 'plannenAan', waarden: [{ label: 'ja', p: true }, { label: 'nee', p: false }] },
  { naam: 'ouderdom', waarden: [{ label: '5min', m: 5 }, { label: '40min', m: 40 }] },
  { naam: 'bericht', waarden: [{ label: 'kale-keuze', k: true }, { label: 'vraag-of-ander-moment', k: false }] },
];
function orakelC(s) {
  // O2: precies één eigenaar. Kale keuze zonder claim → boekroute (direct, bewezen).
  // Anders: Sunny als hij het gesprek vasthoudt, of als het zíjn voorstel is, hij leeft
  // én het bericht vers is (<20 min); daarna valt het terug op de reply-route.
  const sunny = s.claim.g || (!s.bericht.k && s.plannenAan.p && s.bron.label === 'sunny' && s.sunnyLeeft.l && s.ouderdom.m < 20);
  return { wil: 'eigenaar', eigenaar: sunny ? 'sunny' : 'reply-route' };
}
function voerUitC(s) {
  const e = S.eigenaarVanReactie({ bron: s.bron.leeg ? undefined : s.bron.label, geclaimd: s.claim.g, leeft: s.sunnyLeeft.l, plannenAan: s.plannenAan.p, ouderdomMin: s.ouderdom.m, kaleKeuze: s.bericht.k });
  return { uitkomst: 'eigenaar', eigenaar: e, precies1: ['sunny', 'reply-route'].includes(e), melding: false };
}
function vergelijkC(w, e) { return e.precies1 && w.eigenaar === e.eigenaar; }


// ── D. verzendpoort (echte magSturen): 24u-regel, Sunny-claim, herhaling/opVerzoek-uitzondering ──
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const dimD = [
  { naam: 'soort', waarden: [{ label: 'voorstel' }, { label: 'bevestiging' }] },
  { naam: 'claim', waarden: [{ label: 'sunny-5min', min: 5 }, { label: 'sunny-200min', min: 200 }, { label: 'geen', min: null }] },
  { naam: 'vorige', waarden: [{ label: 'geen', uur: null }, { label: '2u', uur: 2 }, { label: '30u', uur: 30 }] },
  { naam: 'herhaling', waarden: [{ label: 'nee', v: false }, { label: 'ja', v: true }] },
  { naam: 'opVerzoek', waarden: [{ label: 'nee', v: false }, { label: 'ja', v: true }] },
];
function orakelD(s) {
  const voorstel = s.soort.label === 'voorstel';
  const claimBlok = voorstel && s.claim.min !== null && s.claim.min < 120;
  const dagBlok = voorstel && s.vorige.uur !== null && s.vorige.uur < 24 && !s.herhaling.v && !s.opVerzoek.v;
  const blok = claimBlok || dagBlok;
  return { wil: blok ? 'blokkeer' : 'sturen', reden: claimBlok ? 'sunny-in-gesprek' : (dagBlok ? '24u' : 'ok') };
}
async function voerUitD(s) {
  const NU = Date.now();
  const TEL = '+31687654321', TICKET = 777;
  const state = { aanbodTickets: s.vorige.uur === null ? {} : { tokD: { rpItemId: 'rp-d', naam: 'D Klant', telefoon: TEL, email: null, verstuurdOp: new Date(NU - s.vorige.uur * 3600000).toISOString() } } };
  const claims = s.claim.min === null ? {} : { [TICKET]: { wie: 'sunny', op: new Date(NU - s.claim.min * 60000).toISOString() } };
  const origRead = fs.readFileSync, origFetch = global.fetch;
  fs.readFileSync = function (p, ...rest) {
    const sp = String(p);
    if (sp.endsWith('inmeten-planner-state.json')) return JSON.stringify(state);
    if (sp.endsWith('gesprek-claims.json')) return JSON.stringify(claims);
    if (sp.endsWith('monitor-stil.json') || sp.endsWith('klant-stil.json')) return '{}';
    return origRead.call(fs, p, ...rest);
  };
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: [] }), text: async () => '{"data":[]}' });
  try {
    const { magSturen } = require('../../scripts/lib/verzend-poort.js');
    const r = await magSturen({ telefoon: TEL, email: null, ticketId: TICKET, soort: s.soort.label, opVerzoek: s.opVerzoek.v, herhaling: s.herhaling.v });
    return { uitkomst: r.ok ? 'sturen' : 'blokkeer', reden: r.reden, melding: true };
  } finally { fs.readFileSync = origRead; global.fetch = origFetch; }
}
function vergelijkD(w, e) {
  if (w.wil !== e.uitkomst) return false;
  // beide remmen kunnen tegelijk gelden; welke de poort noemt maakt niet uit, als het er maar één van is
  if (w.wil === 'blokkeer') return /sunny-in-gesprek|<24u/.test(e.reden);
  return true;
}

// ── samengesteld onderdeel ───────────────────────────────────────────────────
function scenarios() {
  return [
    ...combinaties(dimA).map((s) => ({ ...s, _laag: 'A', _label: 'A ' + s._label })),
    ...combinaties(dimB).map((s) => ({ ...s, _laag: 'B', _label: 'B ' + s._label })),
    ...combinaties(dimC).map((s) => ({ ...s, _laag: 'C', _label: 'C ' + s._label })),
    ...combinaties(dimD).map((s) => ({ ...s, _laag: 'D', _label: 'D ' + s._label })),
  ].map((s, i) => ({ ...s, _nr: i + 1 }));
}
function orakel(s) { return s._laag === 'A' ? orakelA(s) : s._laag === 'B' ? orakelB(s) : s._laag === 'C' ? orakelC(s) : orakelD(s); }
async function voerUit(s) { return s._laag === 'A' ? voerUitA(s) : s._laag === 'B' ? voerUitB(s) : s._laag === 'C' ? voerUitC(s) : voerUitD(s); }
function vergelijk(w, e, s) { return s._laag === 'A' ? vergelijkA(w, e, s) : s._laag === 'B' ? vergelijkB(w, e) : s._laag === 'C' ? vergelijkC(w, e) : vergelijkD(w, e); }

module.exports = { naam: 'sunny-start (eerste voorstel door Sunny: poort, tekst, eigenaar, verzendpoort)', scenarios, orakel, voerUit, vergelijk };

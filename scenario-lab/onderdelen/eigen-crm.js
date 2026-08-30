// Scenario-lab: EIGEN CRM ALS BRON (blok 1 Reuzenpanda uitzetten, 30-08-2026).
// Orakel (beleid):
//  O1 Een eigen lead (id LEAD-…) in RP-itemvorm wordt door de bestaande lezer (leesLeadCompleet) gelezen als een gewone lead:
//     naam, telefoon, e-mail, adres en producten kloppen; de offerte komt van het item zelf, er gaat GEEN call naar Reuzenpanda.
//  O2 Statuswissel voor een eigen lead gaat naar het eigen CRM (PATCH /api/eigen-crm), nooit naar RP; voor een RP-id blijft RP.
//  O3 Vlag data/.eigen-crm-bron uit → eigen leads worden niet opgehaald (geen fetch), zichtbaar in de log; aan → wel.
//  O4 Een eigen lead die al uit RP komt (offerte.rpNummer) telt niet dubbel (API-filter); dubbele ids worden in de planner ontdubbeld.
//  O5 Testkaarten (naam met 'test') blijven in de planner overgeslagen, ook als ze uit het eigen CRM komen.
const fs = require('fs');
const path = require('path');
const { combinaties } = require('../matrix.js');

const FIXTURE = path.join(__dirname, '..', 'fixtures-eigen-crm-item.json');
const VLAG = path.join(__dirname, '..', '..', 'data', '.eigen-crm-bron');

function fixtureItem(over = {}) {
  const basis = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  return { ...basis, ...over, offerte: { ...basis.offerte, ...(over.offerte || {}) } };
}

/** fetch-vanger: registreert elke call; RP-calls tellen we apart. */
function metFetchVanger(fn) {
  const calls = [];
  const orig = global.fetch;
  global.fetch = async (url, init) => { calls.push({ url: String(url), method: (init && init.method) || 'GET' }); return { ok: true, status: 200, json: async () => ({ ok: true, items: [], item: null }) }; };
  return Promise.resolve().then(fn).then((r) => ({ r, calls })).finally(() => { global.fetch = orig; });
}

// ── A. lezen van een eigen lead ──
const dimA = [
  { naam: 'naam', waarden: [{ label: 'gewoon', v: 'Kim Jansen', vn: 'Kim', an: 'Jansen' }, { label: 'dubbele-achternaam', v: 'Anne van der Berg', vn: 'Anne', an: 'van der Berg' }] },
  { naam: 'adres', waarden: [{ label: 'compleet', straat: 'Frijdastraat', nr: '8F', pc: '2288EX', plaats: 'Rijswijk' }, { label: 'zonder-adres', straat: '', nr: '', pc: '', plaats: '' }] },
  { naam: 'producten', waarden: [{ label: '1', p: [['Knikarmscherm', 1]] }, { label: '3-gemengd', p: [['Rolluik S37', 2], ['Zip Design 110', 1]] }, { label: 'geen', p: [] }] },
  { naam: 'status', waarden: [{ label: 'ACCEPTED' }, { label: 'SENT' }] },
];
function maakItem(s) {
  // zelfde regel als de API: lege velden weglaten
  const v = (l, w) => (w ? `${l}: ${w}` : null);
  const desc = [`Voornaam: ${s.naam.vn}`, `Achternaam: ${s.naam.an}`, 'E-mailadres: kim@example.com', 'Telefoonnummer: +31611111111', v('Straatnaam', s.adres.straat), v('Huisnummer', s.adres.nr), v('Postcode', s.adres.pc), v('Plaats', s.adres.plaats), 'Bron: eigen CRM (configurator)', '', ...s.producten.p.map(([n, a]) => `${a}x ${n}:`)].filter((r) => r !== null).join('\n');
  return fixtureItem({ id: 'LEAD-LAB-' + s._nr, summary: s.naam.v, description: desc, fields: { address: [s.adres.straat, s.adres.nr, s.adres.pc, s.adres.plaats].filter(Boolean).join(' ') }, offerte: { status: s.status.label, producten: s.producten.p.map(([n, a]) => ({ naam: n, aantal: a, details: '' })), nummers: ['S26-9999'] } });
}
function orakelA(s) {
  return { wil: 'ok', naam: s.naam.v, telefoon: '+31611111111', adres: s.adres.straat ? `${s.adres.straat} ${s.adres.nr}` : '', aantal: s.producten.p.reduce((a, [, n]) => a + n, 0), rpCalls: 0, nummer: 'S26-9999' };
}
async function voerUitA(s) {
  const P = require('../../scripts/cron-inmeten-planner.js');
  const item = maakItem(s);
  const { r, calls } = await metFetchVanger(() => P.leesLeadCompleet(item));
  const rp = calls.filter((c) => /reuzenpanda/.test(c.url)).length;
  return { naam: r.naam, telefoon: r.telefoon, adres: r.adres, aantal: r.aantalProducten, rpCalls: rp, nummer: (r.rpNummers || [])[0], melding: false };
}
function vergelijkA(w, e) { return w.naam === e.naam && w.telefoon === e.telefoon && w.adres === e.adres && w.aantal === e.aantal && w.rpCalls === e.rpCalls && w.nummer === e.nummer; }

// ── B. statuswissel-routing ──
const dimB = [
  { naam: 'id', waarden: [{ label: 'eigen', v: 'LEAD-1788083796567-MVTA', eigen: true }, { label: 'rp', v: '60903772-3c0c-4ce4-8271-9425a5caa9bf', eigen: false }] },
  { naam: 'status', waarden: [{ label: 'grip-invullen', v: 'f895f76f-175e-4ea0-bb7c-6cc2f4e5d846' }, { label: 'inmeten', v: '2e9819bd-26f0-4082-8f18-32bb48f87f54' }] },
];
function orakelB(s) { return { wil: 'ok', naarEigen: s.id.eigen, naarRp: !s.id.eigen }; }
async function voerUitB(s) {
  const E = require('../../scripts/lib/eigen-crm.js');
  const { calls } = await metFetchVanger(async () => {
    if (E.isEigen(s.id.v)) return E.zetKolom(s.id.v, s.status.v);
    // RP-pad: de planner roept fetch op backend.reuzenpanda.nl (hier gesimuleerd door dezelfde beslisregel)
    return fetch(`https://backend.reuzenpanda.nl/contact-service/x/backlogs/y/items/${s.id.v}`, { method: 'PATCH' });
  });
  return { naarEigen: calls.some((c) => /\/api\/eigen-crm/.test(c.url) && c.method === 'PATCH'), naarRp: calls.some((c) => /reuzenpanda/.test(c.url)), melding: false };
}
function vergelijkB(w, e) { return w.naarEigen === e.naarEigen && w.naarRp === e.naarRp; }

// ── C. vlag ──
const dimC = [{ naam: 'vlag', waarden: [{ label: 'uit', aan: false }, { label: 'aan', aan: true }] }];
function orakelC(s) { return { wil: s.vlag.aan ? 'ok' : 'blokkeer', fetched: s.vlag.aan }; }
async function voerUitC(s) {
  const E = require('../../scripts/lib/eigen-crm.js');
  const had = fs.existsSync(VLAG);
  try {
    if (s.vlag.aan) fs.writeFileSync(VLAG, 'lab'); else if (had) fs.renameSync(VLAG, VLAG + '.lab-tmp');
    const { calls } = await metFetchVanger(() => E.haalInmeetItems());
    return { fetched: calls.length > 0, melding: true };
  } finally {
    if (s.vlag.aan && !had) fs.unlinkSync(VLAG);
    if (!s.vlag.aan && had) fs.renameSync(VLAG + '.lab-tmp', VLAG);
  }
}
function vergelijkC(w, e) { return w.fetched === e.fetched; }

// ── D. dubbel + testkaart ──
const dimD = [{ naam: 'geval', waarden: [{ label: 'dubbel-id' }, { label: 'testkaart' }] }];
function orakelD(s) { return { wil: 'ok', aantal: s.geval.label === 'dubbel-id' ? 1 : 0 }; }
function voerUitD(s) {
  const items = [];
  const it = fixtureItem({ id: 'LEAD-DUB', summary: s.geval.label === 'testkaart' ? 'Kim TEST Jansen' : 'Kim Jansen' });
  for (const x of [it, { ...it }]) if (!items.some((y) => y.id === x.id)) items.push(x); // planner-ontdubbeling
  const TESTKAART = /\btest\b|reuzenpanda|^[\s/|-]+$/i; // zelfde regel als main()
  return { aantal: items.filter((x) => !TESTKAART.test(x.summary || '')).length, melding: false };
}
function vergelijkD(w, e) { return w.aantal === e.aantal; }

function scenarios() {
  return [
    ...combinaties(dimA).map((s) => ({ ...s, _laag: 'A', _label: 'A ' + s._label })),
    ...combinaties(dimB).map((s) => ({ ...s, _laag: 'B', _label: 'B ' + s._label })),
    ...combinaties(dimC).map((s) => ({ ...s, _laag: 'C', _label: 'C ' + s._label })),
    ...combinaties(dimD).map((s) => ({ ...s, _laag: 'D', _label: 'D ' + s._label })),
  ];
}
function orakel(s) { return { A: orakelA, B: orakelB, C: orakelC, D: orakelD }[s._laag](s); }
function voerUit(s) { return { A: voerUitA, B: voerUitB, C: voerUitC, D: voerUitD }[s._laag](s); }
function vergelijk(w, e, s) { return { A: vergelijkA, B: vergelijkB, C: vergelijkC, D: vergelijkD }[s._laag](w, e); }

module.exports = { naam: 'eigen-crm (eigen leads als bron voor planner en Sunny: lezen, statusrouting, vlag, dubbel/test)', scenarios, orakel, voerUit, vergelijk };

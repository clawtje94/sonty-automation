// Onderdeel: tekenbonus-machine (guard, staffel, deadline, offerte-prep/opruimen).
// Orakel (beleid, 17-08):
//  - Eén stop-signaal ergens bij de klant (stop-status, getekend, boeking, opt-out,
//    eerdere bonus) → NIET mailen, ongeacht de rest.
//  - Elk kapot of onbereikbaar systeem → NIET mailen (fail-closed). Ook: klant die
//    niet in de mail-export staat = opt-out onbekend = niet mailen.
//  - Een tweede dossier dat op GEEN enkele sleutel (mail/tel/adres) te herkennen is,
//    kan geen enkel systeem zien: mailen mag dan (bekende, geaccepteerde grens).
//  - Staffel: onder 750 (of kapot bedrag) géén bonus-mail; <2500 → 100;
//    2500 t/m 7500 → 250; daarboven → 500.
//  - Deadline valt nooit op zaterdag of zondag.
//  - Offerte-prep: nooit stapelen op een bestaande bonus; elke opslag geverifieerd
//    tegen het door RP berekende totaal, bij afwijking automatisch terugdraaien.
//  - Opruimen: een getekende offerte blijft onaangeraakt; anders bonus eruit en de
//    originele groepskorting exact terug.
const fs = require('fs');
const { combinaties, sample } = require('../matrix.js');
const { magBenaderd } = require('../../scripts/tekenbonus/mag-benaderd.js');
const { staffel, magBonus, deadline } = require('../../scripts/tekenbonus/offerte-prep.js');

const EMAIL = 'labklant@test.nl', TEL = '+31699000001';

// ── guard-matrix ────────────────────────────────────────────────────────────
const guardDims = [
  { naam: 'identiteit', waarden: [
    { label: 'beide' }, { label: 'alleen-email' }, { label: 'alleen-tel' }, { label: 'geen' },
  ] },
  { naam: 'dossier2', waarden: [
    { label: 'geen' }, { label: 'schoon' },
    { label: 'stop-inmeten', status: '2e9819bd-26f0-4082-8f18-32bb48f87f54' },
    { label: 'stop-gripp', status: 'f895f76f-175e-4ea0-bb7c-6cc2f4e5d846' },
    { label: 'stop-afgerond', status: '2082ad8a-517c-4e24-8c0f-a5be69b1588a' },
    { label: 'onherkenbaar-stop', status: '2082ad8a-517c-4e24-8c0f-a5be69b1588a' },
  ] },
  { naam: 'getekend', waarden: [
    { label: 'nee' }, { label: 'eigen-accepted' }, { label: 'tweede-signed' }, { label: 'api-stuk' },
  ] },
  { naam: 'boeking', waarden: [{ label: 'geen' }, { label: 'aanwezig' }, { label: 'geannuleerd' }] },
  { naam: 'optout', waarden: [
    { label: 'magmail-true' }, { label: 'magmail-false' }, { label: 'niet-in-export' }, { label: 'export-stuk' },
  ] },
  { naam: 'log', waarden: [{ label: 'leeg' }, { label: 'andere-klant' }, { label: 'zelfde-klant' }, { label: 'log-stuk' }] },
];
const guardScens = sample(combinaties(guardDims), 500).map((s) => ({ ...s, blok: 'guard' }));

// ── staffel + ondergrens ────────────────────────────────────────────────────
const staffelScens = [
  { bedrag: -100, wil: 'blokkeer' }, { bedrag: 0, wil: 'blokkeer' }, { bedrag: NaN, wil: 'blokkeer' },
  { bedrag: 749.99, wil: 'blokkeer' }, { bedrag: 750, bonus: 100 }, { bedrag: 2499.99, bonus: 100 },
  { bedrag: 2500, bonus: 250 }, { bedrag: 7500, bonus: 250 }, { bedrag: 7500.01, bonus: 500 },
  { bedrag: 99999, bonus: 500 },
].map((s, i) => ({ ...s, blok: 'staffel', _nr: 'S' + (i + 1), _label: `staffel bedrag=${s.bedrag}` }));

// ── deadline-weekregel ──────────────────────────────────────────────────────
const deadlineScens = [];
for (let d = 17; d <= 23; d++) for (const dagen of [2, 4]) {
  deadlineScens.push({ blok: 'deadline', start: new Date(2026, 7, d, 10, 0), dagen, _nr: `D${d}-${dagen}`, _label: `deadline start=${d}-8 dagen=${dagen}` });
}

// ── prep/opruimen ───────────────────────────────────────────────────────────
const prepDims = [
  { naam: 'gd', waarden: [{ label: 'met-groepskorting' }, { label: 'zonder' }] },
  { naam: 'alBonus', waarden: [{ label: 'nee' }, { label: 'ja' }] },
  { naam: 'put', waarden: [{ label: 'ok' }, { label: 'faalt' }] },
  { naam: 'verificatie', waarden: [{ label: 'klopt' }, { label: 'wijkt-af' }] },
];
const prepScens = combinaties(prepDims).map((s) => ({ ...s, blok: 'prep' }));
const ruimScens = combinaties([
  { naam: 'getekend', waarden: [{ label: 'ja' }, { label: 'nee' }] },
  { naam: 'gd', waarden: [{ label: 'terugzetten' }, { label: 'geen' }] },
]).map((s) => ({ ...s, blok: 'ruim' }));

// ── stubs ───────────────────────────────────────────────────────────────────
const echteFetch = global.fetch;
const echteRead = fs.readFileSync;
function metStubs(s, fetchStub, doe) {
  global.fetch = fetchStub;
  fs.readFileSync = function (p, ...rest) {
    const naam = String(p);
    if (naam.endsWith('inmeet-boekingen.json')) {
      if (s.boeking?.label === 'geen') return '{}';
      return JSON.stringify({ lab: { telefoon: TEL, email: EMAIL, status: s.boeking?.label === 'geannuleerd' ? 'geannuleerd' : 'geboekt' } });
    }
    if (naam.endsWith('rp-export.json')) {
      if (s.optout?.label === 'export-stuk') throw new Error('export kapot');
      if (s.optout?.label === 'niet-in-export') return '[]';
      return JSON.stringify([{ email: EMAIL, telefoon: TEL, magMail: s.optout?.label !== 'magmail-false' }]);
    }
    if (naam.endsWith('tekenbonus-log.json')) {
      if (s.log?.label === 'log-stuk') throw new Error('log kapot');
      if (s.log?.label === 'zelfde-klant') return JSON.stringify({ a: { email: EMAIL, telefoon: TEL } });
      if (s.log?.label === 'andere-klant') return JSON.stringify({ a: { email: 'ander@x.nl', telefoon: '+31600000099' } });
      return '{}';
    }
    return echteRead.call(fs, p, ...rest);
  };
  return doe().finally(() => { global.fetch = echteFetch; fs.readFileSync = echteRead; });
}

function guardItems(s) {
  const idw = s.identiteit.label;
  const desc = (idw === 'beide' || idw === 'alleen-email' ? `E-mailadres: ${EMAIL}\n` : '') +
    (idw === 'beide' || idw === 'alleen-tel' ? `Telefoonnummer: ${TEL}\n` : '');
  const kandidaat = { id: 'lab-kand', summary: 'Lab Klant', status_id: '15c4f0be-c6bf-447d-bf5f-a233c482eb53', description: desc, free_fields: [], item_subject: { id: 'lc-eigen' } };
  const items = [kandidaat];
  if (s.dossier2.label !== 'geen') {
    const onherkenbaar = s.dossier2.label === 'onherkenbaar-stop';
    items.push({
      id: 'lab-d2', summary: onherkenbaar ? 'Iemand Anders' : 'Lab Klant',
      status_id: s.dossier2.status || '15c4f0be-c6bf-447d-bf5f-a233c482eb53',
      description: onherkenbaar ? 'E-mailadres: totaalanders@x.nl\nTelefoonnummer: +31688888888\n' : desc,
      free_fields: [], item_subject: { id: 'lc-2' },
    });
  }
  return { kandidaat, items };
}

function guardFetch(s) {
  return async (url) => {
    const u = String(url);
    if (u.includes('lead_configuration_id=')) {
      if (s.getekend.label === 'api-stuk') throw new Error('rp docs kapot');
      const lc = u.split('lead_configuration_id=')[1];
      const docs = [];
      if (s.getekend.label === 'eigen-accepted' && lc === 'lc-eigen') docs.push({ quotationNumber: '1', quotationStatus: 'ACCEPTED' });
      if (s.getekend.label === 'tweede-signed') {
        const doel = s.dossier2.label === 'geen' ? 'lc-eigen' : 'lc-2';
        if (lc === doel) docs.push({ quotationNumber: '2', quotationStatus: 'SIGNED' });
      }
      return { ok: true, json: async () => ({ quotationDatas: docs }) };
    }
    return { ok: true, json: async () => ({}) };
  };
}

function guardOrakel(s) {
  if (s.identiteit.label === 'geen') return { wil: 'blokkeer' };
  const stopHerkenbaar = ['stop-inmeten', 'stop-gripp', 'stop-afgerond'].includes(s.dossier2.label);
  const getekendZichtbaar = s.getekend.label === 'eigen-accepted' || s.getekend.label === 'api-stuk' ||
    (s.getekend.label === 'tweede-signed' && s.dossier2.label !== 'onherkenbaar-stop');
  const blok = stopHerkenbaar || getekendZichtbaar || s.boeking.label !== 'geen' ||
    ['magmail-false', 'niet-in-export', 'export-stuk'].includes(s.optout.label) ||
    ['zelfde-klant', 'log-stuk'].includes(s.log.label);
  return { wil: blok ? 'blokkeer' : 'mail' };
}

// prep-stub: in-memory RP-document dat totalen rekent zoals RP zelf
function prepOmgeving(s) {
  const lines = [
    { units: 1, pricePerUnit: 3000, description: '**Product A**\nregel' },
    { units: 1, pricePerUnit: 275, description: '**Montage**\nregel' },
  ];
  if (s.alBonus?.label === 'ja') lines.push({ units: 1, pricePerUnit: -100, description: '**Eenmalige tekenbonus: 100 euro eraf**\noud' });
  const doc = { quotationData: {
    quotationNumber: 'LAB1', quotationStatus: s.getekend?.label === 'ja' ? 'ACCEPTED' : 'SENT',
    quotationExpirationTimestamp: Date.now(),
    pricing: { total: 0 },
    segments: { defaultTemplatePriceLineGroup: { data: {
      lines, groupDiscount: (s.gd?.label === 'met-groepskorting' || s.gd?.label === 'terugzetten') ? null : null,
    } } },
  } };
  if (s.gd?.label === 'met-groepskorting') doc.quotationData.segments.defaultTemplatePriceLineGroup.data.groupDiscount = { name: '15% tijdelijke actie', amount: 15, type: 'PERCENTAGE', vatPercentage: 21 };
  if (s.blok === 'ruim') {
    // opruim-scenario: doc zoals ná een prep (bonus + euroregel)
    lines.push({ units: 1, pricePerUnit: -491.25, description: '**15% tijdelijke actie**\nDe actiekorting over je offerte, hier al voor je verrekend.' });
    lines.push({ units: 1, pricePerUnit: -250, description: '**Eenmalige tekenbonus: 250 euro eraf**\nGeldig...' });
  }
  const bereken = () => {
    const d = doc.quotationData.segments.defaultTemplatePriceLineGroup.data;
    let t = d.lines.reduce((a, l) => a + (l.units || 1) * (l.pricePerUnit || 0), 0);
    if (d.groupDiscount?.amount) t *= 1 - d.groupDiscount.amount / 100;
    return Math.round(t * 100) / 100;
  };
  const putLog = [];
  const fetchStub = async (url, opties = {}) => {
    if (opties.method === 'PUT') {
      putLog.push(JSON.parse(opties.body));
      if (s.put?.label === 'faalt' && putLog.length === 1) return { ok: false, status: 500 };
      doc.quotationData = JSON.parse(opties.body);
      return { ok: true, status: 200 };
    }
    doc.quotationData.pricing = { total: bereken() + (s.verificatie?.label === 'wijkt-af' && putLog.length === 1 ? 7 : 0) };
    return { ok: true, json: async () => JSON.parse(JSON.stringify(doc)) };
  };
  return { doc, putLog, fetchStub, bereken };
}

module.exports = {
  naam: 'tekenbonus',
  scenarios: () => [...guardScens, ...staffelScens, ...deadlineScens, ...prepScens, ...ruimScens],
  orakel(s) {
    if (s.blok === 'guard') return guardOrakel(s);
    if (s.blok === 'staffel') return s.wil === 'blokkeer' ? { wil: 'blokkeer' } : { wil: 'mail', bonus: s.bonus };
    if (s.blok === 'deadline') return { wil: 'mail', geenWeekend: true };
    if (s.blok === 'prep') {
      if (s.alBonus.label === 'ja' || s.put.label === 'faalt' || s.verificatie.label === 'wijkt-af') return { wil: 'blokkeer' };
      return { wil: 'mail' };
    }
    if (s.blok === 'ruim') return { wil: 'mail', getekendBlijft: s.getekend.label === 'ja' };
    throw new Error('onbekend blok');
  },
  async voerUit(s) {
    if (s.blok === 'guard') {
      const { kandidaat, items } = guardItems(s);
      const r = await metStubs(s, guardFetch(s), () => magBenaderd(kandidaat, items, { zonderTrengo: true }));
      return { uitkomst: r.mag ? 'mail' : 'blokkeer', melding: true, reden: r.reden };
    }
    if (s.blok === 'staffel') {
      if (!magBonus(s.bedrag)) return { uitkomst: 'blokkeer', melding: true };
      return { uitkomst: 'mail', bonus: staffel(s.bedrag), melding: true };
    }
    if (s.blok === 'deadline') {
      const d = deadline(s.dagen, s.start);
      const okDag = d.getDay() !== 0 && d.getDay() !== 6;
      const okAfstand = d.getTime() >= s.start.getTime() + s.dagen * 86400000 - 1;
      return { uitkomst: okDag && okAfstand ? 'mail' : 'weekend-fout', melding: false, dag: d.getDay() };
    }
    if (s.blok === 'prep') {
      const { bereidVoor } = require('../../scripts/tekenbonus/offerte-prep.js');
      const omg = prepOmgeving(s);
      const r = await metStubs(s, omg.fetchStub, () => bereidVoor('lab-doc', { deadlineDatum: new Date(2026, 7, 20) }));
      if (r.fout) {
        // bij afwijkende verificatie MOET er teruggedraaid zijn (2 PUTs)
        const rollbackOk = s.verificatie.label !== 'wijkt-af' || s.put.label === 'faalt' || s.alBonus.label === 'ja' || omg.putLog.length === 2;
        return { uitkomst: rollbackOk ? 'blokkeer' : 'blokkeer-zonder-rollback', melding: true, fout: r.fout };
      }
      const eind = omg.doc.quotationData.segments.defaultTemplatePriceLineGroup.data;
      const heeftBonus = eind.lines.some((l) => /tekenbonus/i.test(l.description || ''));
      const geenGd = !eind.groupDiscount;
      return { uitkomst: heeftBonus && geenGd ? 'mail' : 'prep-onvolledig', melding: false };
    }
    if (s.blok === 'ruim') {
      const { ruimOp } = require('../../scripts/tekenbonus/offerte-prep.js');
      const omg = prepOmgeving(s);
      const gd = s.gd.label === 'terugzetten' ? { name: '15% tijdelijke actie', amount: 15, type: 'PERCENTAGE', vatPercentage: 21 } : null;
      const r = await metStubs(s, omg.fetchStub, () => ruimOp('lab-doc', gd));
      const eind = omg.doc.quotationData.segments.defaultTemplatePriceLineGroup.data;
      if (s.getekend.label === 'ja') {
        const onaangeraakt = r.getekend === true && omg.putLog.length === 0;
        return { uitkomst: 'mail', getekendBlijft: onaangeraakt, melding: true };
      }
      const bonusWeg = !eind.lines.some((l) => /tekenbonus/i.test(l.description || ''));
      const gdTerug = !gd || (eind.groupDiscount && eind.groupDiscount.amount === 15 && !eind.lines.some((l) => (l.description || '').includes('hier al voor je verrekend')));
      return { uitkomst: 'mail', getekendBlijft: bonusWeg && gdTerug ? false : 'opruimen-onvolledig', melding: false };
    }
    throw new Error('onbekend blok');
  },
  vergelijk(verwacht, echt, s) {
    if (s.blok === 'staffel') return verwacht.wil === echt.uitkomst && (verwacht.wil === 'blokkeer' || verwacht.bonus === echt.bonus);
    if (s.blok === 'deadline') return echt.uitkomst === 'mail';
    if (s.blok === 'ruim') return echt.uitkomst === 'mail' && echt.getekendBlijft === verwacht.getekendBlijft;
    return verwacht.wil === echt.uitkomst;
  },
};

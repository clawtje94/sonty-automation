// Bereidt één offerte voor op de tekenbonus, en ruimt hem na de deadline weer op.
// Les 16-08 (testoplevering Daimy): een minregel onder een groepskorting-percentage
// toont een raar brutobedrag (588 i.p.v. 500). Daarom schrijven we de groepskorting
// eerst om naar een zichtbare euroregel; de originele groupDiscount bewaren we in de
// log zodat opruimen de offerte exact herstelt.
const fs = require('fs');
const path = require('path');
const CFG = require('../ai-ks/config.js');

const H = { Authorization: 'Bearer ' + CFG.RP_API_KEY, 'Content-Type': 'application/json' };
const BACKUP_DIR = path.join(__dirname, '..', '..', 'data', 'offerte-backups');
const EP = (docId) => `https://backend.reuzenpanda.nl/document-service/v1/${CFG.RP_PID}/quotations/${docId}`;
const ACTIE_MARKER = 'hier al voor je verrekend';

const rond = (n) => Math.round(n * 100) / 100;

function staffel(totaalIncl) {
  if (totaalIncl < 2500) return 100;
  if (totaalIncl <= 7500) return 250;
  return 500;
}

/** Deadline: verzenddag + dagen; valt hij in het weekend, dan maandag. */
function deadline(dagen, vanaf = new Date()) {
  const d = new Date(vanaf.getTime() + dagen * 86400000);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}
const datumLang = (d) => d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' });
const datumKort = (d) => d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' });

async function bereidVoor(documentId, { deadlineDatum }) {
  const full = await (await fetch(EP(documentId), { headers: H })).json();
  const qd = full?.quotationData;
  const data = qd?.segments?.defaultTemplatePriceLineGroup?.data;
  if (!data?.lines) return { fout: 'geen prijsregels' };
  if (data.lines.some((l) => /tekenbonus/i.test((l.description || '').split('\n')[0]))) return { fout: 'heeft al een tekenbonus-regel' };

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.writeFileSync(path.join(BACKUP_DIR, `${qd.quotationNumber}-tekenbonus-${Date.now()}.json`), JSON.stringify(qd, null, 1));

  const som = data.lines.reduce((s, l) => s + (l.units || 1) * (l.pricePerUnit || 0), 0);
  const origineleGroupDiscount = data.groupDiscount && data.groupDiscount.amount ? { ...data.groupDiscount } : null;
  let totaalVoor = som;
  const base = { units: 1, vatPercentage: 21, discount: null, imageUri: null, lockTotalPrice: false };
  if (origineleGroupDiscount) {
    const bedrag = rond(som * origineleGroupDiscount.amount / 100);
    totaalVoor = rond(som - bedrag);
    data.groupDiscount = null;
    data.lines.push({ ...base, pricePerUnit: -bedrag, description: `**${origineleGroupDiscount.name || 'Actiekorting'}**\nDe actiekorting over je offerte, ${ACTIE_MARKER}.` });
  }
  const bonus = staffel(totaalVoor);
  const dag = datumLang(deadlineDatum);
  data.lines.push({ ...base, pricePerUnit: -bonus, description: `**Eenmalige tekenbonus: ${bonus} euro eraf**\nGeldig zolang je uiterlijk ${dag} online tekent. Teken je later, dan vervalt deze bonus.` });
  qd.quotationExpirationTimestamp = deadlineDatum.getTime() + 2 * 86400000;

  const put = await fetch(EP(documentId), { method: 'PUT', headers: H, body: JSON.stringify(qd) });
  if (!put.ok) return { fout: 'opslaan mislukte (' + put.status + ')' };

  // harde verificatie: RP moet exact ons totaal rekenen, anders direct terugdraaien
  const check = await (await fetch(EP(documentId), { headers: H })).json();
  const totaalNa = rond(totaalVoor - bonus);
  const echt = rond(check?.quotationData?.pricing?.total ?? NaN);
  if (Math.abs(echt - totaalNa) > 0.02) {
    await fetch(EP(documentId), { method: 'PUT', headers: H, body: JSON.stringify(full.quotationData) });
    return { fout: `totaal klopte niet (RP ${echt} vs verwacht ${totaalNa}) — teruggedraaid` };
  }
  return { nummer: qd.quotationNumber, bonus, totaalVoor, totaalNa, origineleGroupDiscount, deadlineDag: dag, deadlineKort: datumKort(deadlineDatum) };
}

/** Na de deadline zonder handtekening: bonus eruit, actie terug naar groupDiscount. */
async function ruimOp(documentId, origineleGroupDiscount) {
  const full = await (await fetch(EP(documentId), { headers: H })).json();
  const qd = full?.quotationData;
  const data = qd?.segments?.defaultTemplatePriceLineGroup?.data;
  if (!data?.lines) return { fout: 'geen prijsregels' };
  if (/ACCEPTED|SIGNED/i.test(String(qd.quotationStatus || ''))) return { getekend: true };
  data.lines = data.lines.filter((l) => !/tekenbonus/i.test((l.description || '').split('\n')[0]));
  if (origineleGroupDiscount) {
    data.lines = data.lines.filter((l) => !(l.description || '').includes(ACTIE_MARKER));
    data.groupDiscount = origineleGroupDiscount;
  }
  const put = await fetch(EP(documentId), { method: 'PUT', headers: H, body: JSON.stringify(qd) });
  return put.ok ? { opgeruimd: true } : { fout: 'opslaan mislukte (' + put.status + ')' };
}

module.exports = { bereidVoor, ruimOp, staffel, deadline, datumLang, datumKort };

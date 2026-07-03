// Echte offerte-aanpassing in Reuzenpanda voor de AI-klantenservice.
// Volgt de v4-regels uit memory/project_offerte_controle_v3:
//   1. ALTIJD backup vóór wijziging (data/offerte-backups/)
//   2. Bestaande velden nooit herbouwen, alleen regels filteren/toevoegen
//   3. NA de wijziging het resultaat opnieuw ophalen en controleren
const fs = require('fs');
const path = require('path');
const CFG = require('./config.js');
const { prijsIndicatie, v4 } = require('./v4-pricing.js');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'data', 'offerte-backups');

async function rpGet(ep) {
  const res = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY } });
  if (!res.ok) return null;
  return res.json();
}
async function rpPut(ep, body) {
  const res = await fetch('https://backend.reuzenpanda.nl' + ep, {
    method: 'PUT', headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

const PRODUCT_LABELS = {
  sunbasic: 'SunBasic knikarmscherm (open cassette)', sunbasicCassette: 'SunBasic knikarmscherm (dichte cassette)',
  suneye: 'Suneye knikarmscherm', suneyeXL: 'Suneye XL knikarmscherm', sunelite: 'SunElite knikarmscherm',
  zipDesign110: 'Zip Design 110', zipSquare85100: 'Zip Square 85/100', screenSquare85100: 'Screen Square 85/100',
  rolluikS42: 'Rolluik (RollSUPER)', rolluikS37: 'Rolluik S-37',
  suncube150: 'SunCube 150 uitvalscherm', sunproject100: 'SunProject 100 uitvalscherm',
  suncontrol150: 'SunControl 150 serre zonwering', suncontrol165ZIP: 'SunControl 165 ZIP serre zonwering',
  suncontrolPergola: 'SunControl Pergola',
};
const BED_LABELS = {
  io: 'Elektrisch met afstandsbediening (Somfy io motor)',
  solar: 'Solar (Somfy RS100 io solar, draadloos)',
  solarBrel: 'Solar (Brel motor, incl. handzender)',
  draaischakelaar: 'Draaischakelaar (Somfy LT motor)',
  handbediend: 'Handbediend (slingerstang)',
};
const MONTAGE_CAT = {
  sunbasic: 'Knikarmscherm', sunbasicCassette: 'Knikarmscherm', suneye: 'Knikarmscherm', suneyeXL: 'Knikarmscherm', sunelite: 'Knikarmscherm',
  zipDesign110: 'screen', zipSquare85100: 'screen', screenSquare85100: 'screen',
  rolluikS42: 'rolluik', rolluikS37: 'rolluik', suncube150: 'uitvalscherm', sunproject100: 'uitvalscherm',
  suncontrol150: 'serre zonwering', suncontrol165ZIP: 'serre zonwering', suncontrolPergola: 'pergola',
};

/**
 * Voert een offerte-aanpassing ECHT door in Reuzenpanda.
 * @param {object} p
 *   documentId       — RP quotation UUID (verplicht)
 *   verwijderen      — [string] producttermen; elke regel waarvan de titel deze term bevat wordt verwijderd
 *   toevoegen        — [{product, breedteMM, hoogteMM?, uitvalMM?, bediening?, aantal?}] nieuwe productregels (incl. automatische montageregel)
 *   aantalWijzigen   — [{product, aantal}] aantal van een bestaande regel wijzigen
 */
async function pasOfferteAan({ documentId, verwijderen = [], toevoegen = [], aantalWijzigen = [] }) {
  const doc = await rpGet(`/document-service/v1/${CFG.RP_PID}/quotations/${documentId}`);
  const qd = doc?.quotationData;
  const plg = qd?.segments?.defaultTemplatePriceLineGroup;
  if (!plg?.data?.lines) return { error: 'Offerte of prijsregels niet gevonden' };

  // 1. Backup (verplicht)
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backupPath = path.join(BACKUP_DIR, `${qd.quotationNumber}-aiks-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(qd, null, 2));

  const titel = l => ((l.description || '').split('\n')[0] || '').replace(/\*\*/g, '').toLowerCase();
  let lines = plg.data.lines;
  const voor = lines.length;

  // 2a. Verwijderen (regel-titel bevat term; verwijdert ook bijbehorende montageregel als die de term bevat)
  for (const term of verwijderen) {
    const t = String(term).toLowerCase().replace(/\*\*/g, '');
    lines = lines.filter(l => !titel(l).includes(t));
  }

  // 2b. Aantal wijzigen
  for (const w of aantalWijzigen) {
    const t = String(w.product).toLowerCase();
    for (const l of lines) if (titel(l).includes(t)) l.units = w.aantal;
  }

  // 2c. Toevoegen (productregel + montageregel), prijzen ALTIJD via de v4-engine
  const base = plg.data.lines[0];
  for (const item of toevoegen) {
    const p = prijsIndicatie(item);
    if (p.error) return { error: `Prijs niet gevonden voor "${item.product}": ${p.error}` };
    const naam = PRODUCT_LABELS[p.productKey] || item.product;
    const bed = BED_LABELS[item.bediening || 'io'];
    const dims = [`Breedte: ${item.breedteMM} mm`];
    if (item.uitvalMM) dims.push(`Uitval: ${item.uitvalMM} mm`);
    if (item.hoogteMM) dims.push(`Hoogte: ${item.hoogteMM} mm`);
    const desc = `**${naam}**\n${dims.join('\n')}\nBediening: ${bed}\nFrame Kleur: n.t.b. (kiezen bij inmeten)\nGarantie: 3 jaar montage | 5 jaar product | 7 jaar motor`;
    lines.push({ ...base, description: desc, units: item.aantal || 1, pricePerUnit: p.productPrijsIncl, position: 0 });
    lines.push({
      ...base,
      description: `**Inmeten + montage ${MONTAGE_CAT[p.productKey] || ''}**\n- Inmeetafspraak bij je thuis\n- Professionele montage door ons eigen montageteam\n- Klein materiaal en bevestiging\n- Verwerken verpakkingsmateriaal`,
      units: item.aantal || 1, pricePerUnit: p.montageIncl, position: 0,
    });
  }

  // Volgorde exact volgens v4-logica: producten → montage → tahoma → opmerkingen
  // (v4's reorderAndMerge, 1-op-1 hergebruikt) + accessoires ná de hoofdproducten
  // (windsensor bovenaan zag er raar uit — instructie Daimy 2026-07-03).
  const ACCESSOIRE = /windsensor|zonsensor|handzender|verlengkabel|smart hub|afstandsbediening|eolis|sunteis|situo/i;
  const reordered = v4.reorderAndMerge(lines).newLines;
  const hoofd = reordered.filter(l => {
    const d = ((l.description || '').split('\n')[0]).toLowerCase();
    return !ACCESSOIRE.test(d) || d.includes('montage') || d.includes('inmeten');
  });
  const accessoires = reordered.filter(l => !hoofd.includes(l));
  // Accessoires direct ná de laatste productregel (vóór montage), zoals in RP-offertes gebruikelijk
  const eersteMontage = hoofd.findIndex(l => {
    const d = ((l.description || '').split('\n')[0]).toLowerCase();
    return d.includes('montage') || d.includes('inmeten');
  });
  const invoeg = eersteMontage === -1 ? hoofd.length : eersteMontage;
  lines = [...hoofd.slice(0, invoeg), ...accessoires, ...hoofd.slice(invoeg)];

  // Posities opnieuw nummeren
  lines.forEach((l, i) => { l.position = i; });
  plg.data.lines = lines;

  // 3. Opslaan
  const ok = await rpPut(`/document-service/v1/${CFG.RP_PID}/quotations/${documentId}`, qd);
  if (!ok) return { error: 'Opslaan in Reuzenpanda mislukt (backup staat klaar: ' + backupPath + ')' };

  // 4. Controle: opnieuw ophalen en tellen
  const check = await rpGet(`/document-service/v1/${CFG.RP_PID}/quotations/${documentId}`);
  const nieuweLijnen = check?.quotationData?.segments?.defaultTemplatePriceLineGroup?.data?.lines || [];
  const totaal = nieuweLijnen.reduce((s, l) => s + (l.units || 1) * (l.pricePerUnit || 0), 0);

  return {
    ok: true,
    regelsVoor: voor,
    regelsNa: nieuweLijnen.length,
    nieuweRegels: nieuweLijnen.map(l => ({ aantal: l.units, prijs: l.pricePerUnit, product: (l.description || '').split('\n')[0].replace(/\*\*/g, '') })),
    totaalIndicatie: Math.round(totaal * 100) / 100,
    link: `https://document.reuzenpanda.nl/nl/${CFG.RP_PID}/${documentId}/latest?pdfAction=DOCSIGN`,
    backup: backupPath,
  };
}

module.exports = { pasOfferteAan };

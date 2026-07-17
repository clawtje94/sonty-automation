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

const HOR_LABELS = {
  'hor:comfort': 'Raamrolhor Comfort (Unilux)', 'hor:super_plus': 'Raamrolhor Super+ (Unilux)',
  'hor:voorzethor': 'Vaste raamhor Voorzet (Unilux)', 'hor:inklemhor': 'Vaste raamhor Inklem (Unilux)', 'hor:veerstifthor': 'Vaste raamhor Veerstift (Unilux)',
  'hor:voorzet_unit': 'Raamplissé Voorzet (Unilux)', 'hor:inklem_unit': 'Raamplissé Inklem (Unilux)', 'hor:unit_dubbel': 'Raamplissé Dubbel (Unilux)',
  'hor:plissefit': 'Plisséfit hordeur (Unilux)', 'hor:plissefit_dubbel': 'Dubbele plisséfit hordeur (Unilux)',
  'hor:vaste_hordeur_luxe': 'Vaste hordeur Luxe (Unilux)', 'hor:schuifhordeur_luxe': 'Schuifhordeur Luxe (Unilux)',
};

// Titel van de montageregel: altijd benoemen om welk product het gaat (instructie Daimy),
// zeker bij horren: "Inmeten + montage plisséfit hordeur" i.p.v. generiek "montage".
function montageTitel(productKey, itemProduct) {
  if (productKey.startsWith('hor:')) return HOR_LABELS[productKey] || itemProduct || 'hor';
  if (productKey.startsWith('markies')) return 'markies';
  return MONTAGE_CAT[productKey] || itemProduct || '';
}

// Vaste posten die aan een offerte toegevoegd kunnen worden (prijzen uit teamgesprekken/beleid)
const VASTE_POSTEN = {
  hoogwerker: { naam: 'Hoogwerker (montage boven de 2e verdieping)', prijs: 650, uitleg: 'Per dag. Nodig als montage niet met ladders kan.' },
  demontage_oud_product: { naam: 'Demonteren en afvoeren oud scherm/rolluik', prijs: 75, uitleg: 'Per product, waarvan €25 gedoneerd aan het Prinses Máxima Kinderziekenhuis.' },
  verlengde_muursteunen: { naam: 'Verlengde muursteunen', prijs: 150, uitleg: 'Indien nodig, beoordeling bij het inmeten.' },
  led_verlichting_sunelite: { naam: 'LED-verlichting SunElite', prijs: 823.90, uitleg: 'Somfy io, 2 kanalen: kleur en wit licht apart bedienbaar. Ingebouwd in de cassette. Alleen mogelijk op de SunElite.' },
};

/**
 * Voert een offerte-aanpassing ECHT door in Reuzenpanda.
 * @param {object} p
 *   documentId       — RP quotation UUID (verplicht)
 *   verwijderen      — [string] producttermen; elke regel waarvan de titel deze term bevat wordt verwijderd
 *   toevoegen        — [{product, breedteMM, hoogteMM?, uitvalMM?, bediening?, aantal?}] nieuwe productregels (incl. automatische montageregel)
 *   aantalWijzigen   — [{product, aantal}] aantal van een bestaande regel wijzigen
 *   kortingRegel     — {omschrijving, bedrag} zichtbare kortingsregel (negatief bedrag op de offerte)
 */
async function pasOfferteAan({ documentId, verwijderen = [], toevoegen = [], aantalWijzigen = [], kortingRegel = null, vastePosten = [] }) {
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
    const naam = PRODUCT_LABELS[p.productKey] || HOR_LABELS[p.productKey] || item.product;
    const dims = [`Breedte: ${item.breedteMM} mm`];
    if (item.uitvalMM) dims.push(`Uitval: ${item.uitvalMM} mm`);
    if (item.hoogteMM) dims.push(`Hoogte: ${item.hoogteMM} mm`);
    // Bediening + Motor exact volgens v4's PRODUCT_MAP (aparte regels, zoals alle v4-offertes)
    const catVoorMap = p.productKey.startsWith('rolluik') ? 'rolluik' : p.productKey.startsWith('zip') || p.productKey.startsWith('screen') ? 'screen'
      : ['suncube150', 'sunproject100'].includes(p.productKey) ? 'uitvalscherm' : p.productKey === 'suncontrolPergola' ? 'pergola'
      : p.productKey.startsWith('suncontrol') ? 'serre' : p.productKey.startsWith('markies') || p.productKey.startsWith('hor:') ? null : 'knikarmscherm';
    const bedKey = item.bediening === 'solar' || item.bediening === 'solarBrel' ? 'solar' : item.bediening === 'draaischakelaar' ? 'draaischakelaar' : item.bediening === 'handbediend' ? 'handbediend' : 'bedraad';
    const map = catVoorMap ? (v4.PRODUCT_MAP[`${catVoorMap}|${bedKey}`] || v4.PRODUCT_MAP[`${catVoorMap}|bedraad`]) : null;
    const bedRegels = map
      ? [`Bediening: ${map.bediening}`, ...(map.motor ? [`Motor: ${map.motor}`] : [])]
      : [`Bediening: ${BED_LABELS[item.bediening || 'io'] || item.bediening}`];
    // Doekproducten: doekkleur-regel (kiezen bij inmeten, alle stalen mee — beleid Daimy)
    const heeftDoek = ['knikarmscherm', 'screen', 'uitvalscherm', 'serre', 'pergola'].includes(catVoorMap) || p.productKey.startsWith('markies');
    const doekRegel = heeftDoek ? ['Kleur doek: n.t.b. (alle doekstalen bekijk je bij het inmeten)'] : [];
    const kleurLabel = p.productKey.startsWith('rolluik') ? 'Frame Kleur: ' + (item.framekleur || 'n.t.b.') + '\nKleur pantser: ' + (item.framekleur || 'n.t.b.') : 'Frame Kleur: ' + (item.framekleur || 'n.t.b.');
    let desc = `**${naam}**\n${dims.join('\n')}\n${bedRegels.join('\n')}\n${doekRegel.join('\n')}${doekRegel.length ? '\n' : ''}${kleurLabel}\nGarantie: 3 jaar montage | 5 jaar product | 7 jaar motor`;
    // Markies: v4's eigen opties-blok (materiaal-alternatieven + bediening + extra's)
    if (p.productKey.startsWith('markies')) {
      const mat = p.productKey.replace('markies', '');
      const mkBed = { handbediend: 'Handbediend', draaischakelaar: 'Draaischakelaar', io: 'Motor + afstandsbediening', solarBrel: 'Brel Solar motor', solar: 'Somfy IO motor Solar' }[item.bediening || 'handbediend'];
      try { desc += v4.mkBuildOptiesBlok(mkBed, mat, item.breedteMM, item.uitvalMM || 1000); } catch {}
    }
    lines.push({ ...base, description: desc, units: item.aantal || 1, pricePerUnit: p.productPrijsIncl, position: 0 });
    lines.push({
      ...base,
      description: `**Inmeten + montage ${montageTitel(p.productKey, item.product)}**\n- Inmeetafspraak bij je thuis\n- Professionele montage door ons eigen montageteam\n- Klein materiaal en bevestiging\n- Verwerken verpakkingsmateriaal`,
      units: item.aantal || 1, pricePerUnit: p.montageIncl, position: 0,
    });
  }

  // Vaste posten (hoogwerker, demontage oud product, verlengde muursteunen)
  for (const vp of vastePosten) {
    const post = VASTE_POSTEN[vp.soort];
    if (!post) return { error: `Onbekende vaste post "${vp.soort}". Mogelijk: ${Object.keys(VASTE_POSTEN).join(', ')}` };
    lines.push({ ...base, description: `**${post.naam}**\n${post.uitleg}`, units: vp.aantal || 1, pricePerUnit: post.prijs, position: 0 });
  }

  // Zichtbare kortingsregel (regel uit memory: korting ALTIJD als aparte regel, nooit verstopt)
  if (kortingRegel && kortingRegel.bedrag > 0) {
    // Eventuele eerdere AI-kortingsregel vervangen (nooit stapelen)
    lines = lines.filter(l => !titel(l).includes('extra korting'));
    lines.push({ ...base, description: `**Extra korting**\n${kortingRegel.omschrijving || 'Eenmalige extra korting'}`, units: 1, pricePerUnit: -Math.abs(kortingRegel.bedrag), position: 0 });
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

  // v4-VERRIJKING (instructie Daimy): dezelfde uitleg als de offertecontrole — kleur-annotatie,
  // product-info, upgrade/downgrade-opties per productregel + het "Waarom Sonty"-blok.
  const heeftTahoma = lines.some(l => titel(l).includes('tahoma'));
  for (const l of lines) {
    const first = ((l.description || '').split('\n')[0] || '').replace(/\*\*/g, '');
    try { l.description = v4.addV4Enhancements(l.description, first, heeftTahoma, l.pricePerUnit); } catch {}
  }
  try { v4.addWaaromSontyBlock(qd); } catch {}

  // Geldigheid: AI-aangepaste offertes zijn 7 dagen geldig vanaf NU (klant krijgt zojuist de nieuwe versie)
  qd.quotationExpirationTimestamp = Date.now() + 7 * 86400000;

  // 15% actiekorting geldt op ALLES (Daimy 2026-07-03) — zetten als er nog geen korting op staat.
  // NOOIT overschrijven (voorraad heeft bv. 20%) en nooit stapelen.
  if (!plg.data.groupDiscount?.amount) {
    plg.data.groupDiscount = { type: 'PERCENTAGE', amount: 15, name: '15% tijdelijke actie', vatPercentage: 21 };
  }

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
    offertenummer: qd.quotationNumber,
    regelsVoor: voor,
    regelsNa: nieuweLijnen.length,
    nieuweRegels: nieuweLijnen.map(l => ({ aantal: l.units, prijs: l.pricePerUnit, product: (l.description || '').split('\n')[0].replace(/\*\*/g, '') })),
    totaalIndicatie: Math.round(totaal * 100) / 100,
    link: `https://document.reuzenpanda.nl/nl/${CFG.RP_PID}/${documentId}/latest?pdfAction=DOCSIGN`,
    backup: backupPath,
  };
}

// Status van een pipeline-item zetten (zelfde PATCH als v4's setStatus)
async function zetStatus(itemId, statusId) {
  const res = await fetch(`https://backend.reuzenpanda.nl/contact-service/${CFG.RP_PID}/backlogs/${CFG.RP_BACKLOG}/items/${itemId}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: { status_id: statusId } }),
  });
  return res.ok;
}

module.exports = { pasOfferteAan, zetStatus };

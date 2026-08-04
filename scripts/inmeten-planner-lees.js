// Producten van een RP-lead uitlezen. Apart bestand zodat zowel de planner als de
// sandbox dezelfde logica gebruiken en er geen twee versies uit elkaar kunnen lopen.
const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';

const GEEN_PRODUCT_REGEL = /^inmeten \+ montage|^montage\b|^korting|^toeslag|^transport/i;

async function rpGet(ep) {
  const r = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: { Authorization: 'Bearer ' + RP_API_KEY } });
  if (!r.ok) throw new Error(`RP ${r.status}`);
  return r.json();
}

/** Winkelleads hebben geen producten in de leadtekst; die staan in het offertedocument. */
async function leesProductenUitOfferte(item) {
  const lcId = item.item_subject?.id;
  if (!lcId) return [];
  try {
    const docs = await rpGet(`/document-service/v1/${PID}/quotations?lead_configuration_id=${lcId}`);
    const lijst = docs?.quotationDatas || [];
    if (!lijst.length) return [];
    const nieuwste = [...lijst].sort((a, b) => (b.quotationCreationTimestamp || 0) - (a.quotationCreationTimestamp || 0))[0];
    const full = await rpGet(`/document-service/v1/${PID}/quotations/${nieuwste.documentId}`);
    const segmenten = full?.quotationData?.segments || {};
    const producten = [];
    for (const seg of Object.values(segmenten)) {
      if (seg?.type !== 'priceLineGroup') continue;
      for (const regel of seg.data?.lines || []) {
        const tekst = String(regel.description || '');
        const naam = tekst.split('\n')[0].replace(/\*\*/g, '').trim();
        if (!naam || GEEN_PRODUCT_REGEL.test(naam)) continue;
        const maat = (label) => {
          const m = tekst.match(new RegExp(label + ':\\s*(\\d+)', 'i'));
          return m ? Number(m[1]) : null;
        };
        producten.push({
          type: naam.toLowerCase(), naam,
          aantal: Math.max(1, Number(regel.units) || 1),
          breedte: maat('Breedte'),
          hoogte: maat('Hoogte') || maat('Uitval'),
        });
      }
    }
    return producten;
  } catch {
    return [];
  }
}

module.exports = { leesProductenUitOfferte, GEEN_PRODUCT_REGEL };

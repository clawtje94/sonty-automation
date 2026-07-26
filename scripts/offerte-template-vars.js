#!/usr/bin/env node
/**
 * Variabelen voor de offerte-WhatsApptemplates (Daimy 2026-07-26).
 *
 * De nieuwe templates gebruiken vijf variabelen in plaats van drie:
 *   {{1}} voornaam
 *   {{2}} waarde vóór korting   (bijv. "7.966 euro")
 *   {{3}} wat de klant betaalt  (bijv. "6.771 euro")
 *   {{4}} geldig tot            (bijv. "maandag 3 augustus")
 *   {{5}} offertelink + offertenummer
 *
 * Waarom {{2}} berekend moet worden: de quotations-LIJST die v4 al ophaalt geeft alleen
 * pricing.total, dus het bedrag ná korting. Het bedrag vóór korting staat in de losse
 * offerteregels, die alleen in de DETAIL-aanroep zitten. Dat kost dus één extra call per
 * offerte. Geverifieerd op 12 offertes: bruto min de groepskorting komt bij alle 12 tot op de
 * cent uit op pricing.total, en alle 12 hadden de 15%-actie.
 *
 * Bewust GEEN "zonwering", "motor" of "montage" in de teksten (Daimy 26 juli): over 2166
 * aanvragen van de laatste 30 dagen is 4% geen zonwering (raamdecoratie binnen, behang),
 * heeft 19% geen motor en 7% geen montage. Alleen btw klopt altijd.
 */

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli',
  'augustus', 'september', 'oktober', 'november', 'december'];

// "6771.1" -> "6.771 euro". Hele euro's: centen in een verkoopbericht lezen rommelig.
function euro(bedrag) {
  return Math.round(Number(bedrag) || 0).toLocaleString('nl-NL') + ' euro';
}

// 1785668415693 -> "zondag 2 augustus". Bewust zonder jaartal: het is altijd binnen een week.
function datumNL(ms) {
  const d = new Date(Number(ms));
  if (!isFinite(d.getTime())) return null;
  return `${DAGEN[d.getDay()]} ${d.getDate()} ${MAANDEN[d.getMonth()]}`;
}

/**
 * Rekent de waarde vóór korting uit de offerteregels.
 * Geeft null terug als de regels ontbreken of als de som niet klopt met het eindbedrag —
 * dan is er iets anders aan de hand (andere kortingsvorm, gratis item) en sturen we liever
 * geen bedrag dan een verkeerd bedrag.
 */
function waardeVoorKorting(quotationDetail) {
  const groep = quotationDetail?.segments?.defaultTemplatePriceLineGroup?.data;
  const netto = quotationDetail?.pricing?.total;
  if (!groep || !Array.isArray(groep.lines) || !isFinite(netto)) return null;

  const bruto = groep.lines.reduce((som, r) => som + (r.units || 1) * (r.pricePerUnit || 0), 0);
  if (!bruto) return null;

  const korting = groep.groupDiscount;
  const verwacht = korting && korting.type === 'PERCENTAGE'
    ? bruto * (1 - (korting.amount || 0) / 100)
    : bruto;

  // Controle: klopt onze reconstructie met wat Reuzenpanda zelf als totaal noemt?
  if (Math.abs(verwacht - netto) > 1) return null;
  // Zonder korting is "de waarde is X maar je betaalt Y" onzin.
  if (Math.abs(bruto - netto) < 1) return null;
  return bruto;
}

/**
 * Bouwt de vijf template-parameters.
 * Geeft { ok:false, reden } als iets niet betrouwbaar te bepalen is, zodat de aanroeper
 * kan terugvallen op de oude template in plaats van een half bericht te sturen.
 */
function bouwParams({ voornaam, quotationLijstItem, quotationDetail, offerteLink }) {
  const netto = quotationDetail?.pricing?.total ?? quotationLijstItem?.pricing?.total;
  if (!isFinite(netto) || netto <= 0) return { ok: false, reden: 'geen totaalbedrag' };

  const bruto = waardeVoorKorting(quotationDetail);
  if (bruto === null) return { ok: false, reden: 'waarde voor korting niet betrouwbaar te bepalen' };

  const verloopt = datumNL(quotationLijstItem?.quotationExpirationTimestamp
    ?? quotationDetail?.quotationExpirationTimestamp);
  if (!verloopt) return { ok: false, reden: 'geen geldigheidsdatum' };

  const nummer = quotationLijstItem?.quotationNumber ?? quotationDetail?.quotationNumber ?? '';
  // Spatie-suffix in plaats van een regelovergang: WhatsApp staat geen newline in een
  // variabele toe (bestaande regel uit de v4-code, hier bewust overgenomen).
  const link = offerteLink + (nummer ? ` — offertenummer: ${nummer}` : '');

  return {
    ok: true,
    params: [
      { type: 'body', key: '{{1}}', value: (voornaam || 'daar').trim() },
      { type: 'body', key: '{{2}}', value: euro(bruto) },
      { type: 'body', key: '{{3}}', value: euro(netto) },
      { type: 'body', key: '{{4}}', value: verloopt },
      { type: 'body', key: '{{5}}', value: link },
    ],
  };
}

module.exports = { bouwParams, waardeVoorKorting, euro, datumNL };

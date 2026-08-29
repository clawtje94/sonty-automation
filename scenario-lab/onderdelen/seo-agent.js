// Onderdeel: SEO-AGENT beslislogica (Daimy 29-08: agent voor linkbuilding en SEO zodra de site live is).
// Orakel: R1 nooit versturen zonder goedkeuring + proefgeval + schakelaar; R2 alleen toegestane bronnen zonder kosten;
// R4 alleen nieuwe problemen melden; R5 vóór livegang niets naar buiten; goedkeuring alleen op "ja/ok L<nr>".
const { combinaties } = require('../matrix.js');
const L = require('../../scripts/lib/seo-agent-logica.js');

const dimensies = [
  { naam: 'site', waarden: [
    { label: 'nieuw-live', html: '<html><script src="/_next/static/chunks/a.js"></script></html>', live: true },
    { label: 'oud-webflow', html: '<html data-wf-page="x"><script>webflow</script></html>', live: false },
    { label: 'leeg', html: '', live: false },
  ] },
  { naam: 'bron', waarden: [
    { label: 'gemeentegids', bron: { url: 'https://gids.example', soort: 'gemeentegids', naam: 'Gids' }, mag: true },
    { label: 'dealerpagina', bron: { url: 'https://dealer.example', soort: 'dealerpagina', naam: 'Dealerlijst' }, mag: true },
    { label: 'betaald', bron: { url: 'https://x.example', soort: 'betaald', naam: 'X' }, mag: false },
    { label: 'linkruil', bron: { url: 'https://x.example', soort: 'linkruil', naam: 'X' }, mag: false },
    { label: 'gids-met-kosten', bron: { url: 'https://x.example', soort: 'branchegids', naam: 'X', kosten: 49 }, mag: false },
    { label: 'onbekend-soort', bron: { url: 'https://x.example', soort: 'raket', naam: 'X' }, mag: false },
    { label: 'zonder-url', bron: { soort: 'gemeentegids', naam: 'X' }, mag: false },
  ] },
  { naam: 'bereik', waarden: [
    { label: 'http-200', status: 200, ok: true }, { label: 'http-404', status: 404, ok: false }, { label: 'http-0', status: 0, ok: false },
  ] },
  { naam: 'vermelding', waarden: [
    { label: 'al-vermeld', html: '<li><a href="https://sonty.nl">Sonty B.V.</a></li>', vermeld: true },
    { label: 'niet-vermeld', html: '<li>Ander bedrijf</li>', vermeld: false },
  ] },
  { naam: 'eerder', waarden: [
    { label: 'nooit', op: null, recent: false },
    { label: '10-dagen', op: new Date(Date.now() - 10 * 86400000).toISOString(), recent: true },
    { label: '90-dagen', op: new Date(Date.now() - 90 * 86400000).toISOString(), recent: false },
  ] },
  { naam: 'goedkeuring', waarden: [
    { label: 'ja L3', regel: 'ja L3', id: 'L3', akkoord: true },
    { label: 'OK l7', regel: 'OK l7', id: 'L7', akkoord: true },
    { label: 'nee L3', regel: 'nee L3', id: 'L3', akkoord: false },
    { label: 'los-ja', regel: 'ja', id: null, akkoord: null },
    { label: 'ruis', regel: 'Reageer met de terminal', id: null, akkoord: null },
  ] },
  { naam: 'verzenden', waarden: [
    { label: 'aan+proef', aan: true, proef: true }, { label: 'aan-geen-proef', aan: true, proef: false }, { label: 'uit', aan: false, proef: true },
  ] },
  { naam: 'audit', waarden: [
    { label: 'zelfde', vorige: [{ pad: '/a', probleem: 'geen meta' }], huidige: [{ pad: '/a', probleem: 'geen meta' }], nieuw: 0, opgelost: 0 },
    { label: 'nieuw', vorige: [], huidige: [{ pad: '/a', probleem: 'geen meta' }], nieuw: 1, opgelost: 0 },
    { label: 'opgelost', vorige: [{ pad: '/a', probleem: 'geen meta' }], huidige: [], nieuw: 0, opgelost: 1 },
  ] },
];

function orakel(s) {
  const bronMag = s.bron.mag;
  let prospect;
  if (!bronMag) prospect = 'overslaan';
  else if (!s.bereik.ok) prospect = 'onbereikbaar';
  else if (s.vermelding.vermeld) prospect = 'al-vermeld';
  else if (!s.site.live) prospect = 'wachten-op-livegang';
  else if (s.eerder.recent) prospect = 'wachten';
  else prospect = 'voorstel-opstellen';
  const goedkeuring = s.goedkeuring.id ? { id: s.goedkeuring.id, akkoord: s.goedkeuring.akkoord } : null;
  const versturen = !!(goedkeuring && goedkeuring.akkoord && s.verzenden.aan && s.verzenden.proef);
  return { wil: prospect === 'voorstel-opstellen' && versturen ? 'versturen' : 'blokkeer', live: s.site.live, prospect, goedkeuring, versturen, nieuw: s.audit.nieuw, opgelost: s.audit.opgelost };
}

async function voerUit(s) {
  const live = L.isNieuweSiteLive(s.site.html);
  const p = L.beslisProspect({ bron: s.bron.bron, html: s.vermelding.html, status: s.bereik.status, live, alBenaderdOp: s.eerder.op });
  const g = L.leesGoedkeuring(s.goedkeuring.regel);
  const v = L.magVersturen({ goedgekeurd: !!(g && g.akkoord), verzendenAan: s.verzenden.aan, proefgevalKlaar: s.verzenden.proef, eersteVerzending: false });
  const tekst = p.actie === 'voorstel-opstellen' ? L.linkVerzoekTekst(s.bron.bron) : '';
  return { live, prospect: p.actie, goedkeuring: g, versturen: v.mag, nieuw: L.nieuweProblemen(s.audit.vorige, s.audit.huidige).length, opgelost: L.opgelosteProblemen(s.audit.vorige, s.audit.huidige).length, tekst, melding: !!p.reden || !!v.reden };
}

function vergelijk(verwacht, echt) {
  if (echt.live !== verwacht.live) return false;
  if (echt.prospect !== verwacht.prospect) return false;
  if (JSON.stringify(echt.goedkeuring) !== JSON.stringify(verwacht.goedkeuring)) return false;
  if (echt.versturen !== verwacht.versturen) return false;
  if (echt.nieuw !== verwacht.nieuw || echt.opgelost !== verwacht.opgelost) return false;
  // uitgaande tekst: kort, één vraag, geen beloften, geen concurrentnamen
  if (echt.tekst) {
    if (echt.tekst.split('?').length - 1 !== 1) return false;
    if (echt.tekst.length > 900) return false;
    if (/gratis|korting|garantie|beste van|nummer 1/i.test(echt.tekst)) return false;
  }
  return true;
}

module.exports = { naam: 'seo-agent', scenarios: () => combinaties(dimensies), orakel, voerUit, vergelijk };

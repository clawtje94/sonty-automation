// Onderdeel: WACHTMELDING-REACTIE — Sunny vraagt in de wachtmelding om voorkeursdagen; het antwoord
// van de klant moet ALTIJD tot actie leiden (Daimy 02-09, Rowie Post: "donderdag of vrijdag deze week"
// bleef 2 dagen liggen en eindigde als Mens nodig zonder antwoord).
//
// Echte code: scripts/lib/sunny-start.js → wachtmeldingReactieBesluit. De LLM-duiding (leesReactie)
// wordt hier per scenario als vaste uitkomst meegegeven; het lab test de beslisregel, niet het taalmodel.
//
// FOUT-STIL = klant reageerde inhoudelijk maar het besluit is 'negeren' (dan hoort niemand iets).
const { combinaties } = require('../matrix.js');
const S = require('../../scripts/lib/sunny-start.js');

const GEMELD = '2026-08-31T13:40:16.051Z';
const VOOR = '2026-08-31 12:00:00'; // Trengo-notatie NL-tijd (14:00 = 12:00Z → vóór de melding van 15:40 NL)
const NA = '2026-08-31 18:33:02';

const dim = [
  { naam: 'reactie', waarden: [
    { label: 'leeg', tekst: '', duiding: null, verwacht: 'negeren' },
    { label: 'do-of-vr', tekst: 'Deze week donderdag of vrijdag. Groetjes', duiding: { intent: 'voorkeur', dagen: [4, 5], dagdeel: null, vanaf: null, samenvatting: 'do of vr' }, verwacht: 'stuur-aanbod' },
    { label: 'do-vr-met-vraag', tekst: 'Donderdag of vrijdag. Ps hebben jullie een kleurenwaaier?', duiding: { intent: 'voorkeur', dagen: [4, 5], dagdeel: null, vanaf: null, samenvatting: 'do/vr + vraag', overigeVraag: 'kleurenwaaier?' }, verwacht: 'stuur-aanbod', vraag: true },
    { label: 'ochtend', tekst: 'Liefst in de ochtend', duiding: { intent: 'voorkeur', dagen: [], dagdeel: 'ochtend', vanaf: null, samenvatting: 'ochtend' }, verwacht: 'stuur-aanbod' },
    { label: 'vanaf-datum', tekst: 'Pas vanaf 15 september', duiding: { intent: 'voorkeur', dagen: [], dagdeel: null, vanaf: '2026-09-15', samenvatting: 'vanaf 15-9' }, verwacht: 'stuur-aanbod' },
    { label: 'dagen-als-strings', tekst: 'maandag', duiding: { intent: 'voorkeur', dagen: ['1'], dagdeel: null, vanaf: null, samenvatting: 'ma' }, verwacht: 'stuur-aanbod' },
    { label: 'rare-dagen', tekst: 'ergens', duiding: { intent: 'voorkeur', dagen: [9, -1], dagdeel: 'avond', vanaf: '15 sept', samenvatting: '?' }, verwacht: 'mens' },
    { label: 'alleen-vraag', tekst: 'Hebben jullie een kleurenwaaier?', duiding: { intent: 'vraag', dagen: [], dagdeel: null, vanaf: null, samenvatting: 'vraag over kleuren', overigeVraag: 'kleurenwaaier' }, verwacht: 'mens', vraag: true },
    { label: 'ok-prima', tekst: 'Prima, ik wacht af', duiding: { intent: 'akkoord', dagen: [], dagdeel: null, vanaf: null, samenvatting: 'wacht af' }, verwacht: 'mens' },
    { label: 'afzeggen', tekst: 'Laat maar, we hebben geen interesse meer', duiding: { intent: 'annuleren', dagen: [], dagdeel: null, vanaf: null, samenvatting: 'geen interesse meer' }, verwacht: 'mens' },
    { label: 'afzeggen-met-dag', tekst: 'Toch niet nodig, anders donderdag', duiding: { intent: 'annuleren', dagen: [4], dagdeel: null, vanaf: null, samenvatting: 'zegt af' }, verwacht: 'mens' },
    { label: 'onduidbaar', tekst: 'Ja', duiding: { intent: 'vraag', dagen: [], nietDatums: [], dagdeel: null, vanaf: null, samenvatting: 'niet automatisch te duiden' }, verwacht: 'mens' },
    { label: 'duiding-kapot', tekst: 'Donderdag graag', duiding: undefined, verwacht: 'mens' },
  ] },
  { naam: 'tijd', waarden: [{ label: 'na-melding', op: NA }, { label: 'voor-melding', op: VOOR }, { label: 'geen-tijd', op: null }] },
  { naam: 'alVerwerkt', waarden: [{ label: 'nee', v: false }, { label: 'ja', v: true }] },
];

function orakel(s) {
  if (s.alVerwerkt.v) return { wil: 'blokkeer', actie: 'negeren' };
  if (!s.reactie.tekst) return { wil: 'blokkeer', actie: 'negeren' };
  if (s.tijd.label === 'voor-melding') return { wil: 'blokkeer', actie: 'negeren' };
  return { wil: s.reactie.verwacht === 'stuur-aanbod' ? 'aanbod' : 'mens', actie: s.reactie.verwacht };
}

async function voerUit(s) {
  const r = S.wachtmeldingReactieBesluit({ tekst: s.reactie.tekst, duiding: s.reactie.duiding, alVerwerkt: s.alVerwerkt.v, gemeldOp: GEMELD, reactieOp: s.tijd.op });
  const voorkeurOk = r.actie !== 'stuur-aanbod' || (r.voorkeur && (r.voorkeur.dagen.length || r.voorkeur.dagdeel || r.voorkeur.vanaf) && r.voorkeur.dagen.every((n) => Number.isInteger(n) && n >= 0 && n <= 6));
  const vraagOk = !s.reactie.vraag || r.actie === 'negeren' || !!r.overigeVraag;
  return { actie: r.actie, voorkeurOk: !!voorkeurOk, vraagOk, melding: r.actie !== 'negeren' };
}

function vergelijk(w, e) { return w.actie === e.actie && e.voorkeurOk && e.vraagOk; }

function scenarios() { return combinaties(dim).map((s, i) => ({ ...s, _nr: i + 1 })); }

module.exports = { naam: 'wachtmelding-reactie (antwoord op Sunny\'s wachtmelding: voorkeur → aanbod, anders mens, nooit stil)', scenarios, orakel, voerUit, vergelijk };

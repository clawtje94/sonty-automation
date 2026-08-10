// PLANNING-RESPONDER (Daimy 10-08: "ik blijf mensen hebben die geen antwoord krijgen
// nadat ze op de planning gereageerd hebben, hoe zorgen we dat dit smooth werkt?").
//
// Het gat: reageert een klant op een inmeetvoorstel met iets anders dan een kaal "ja",
// dan herkende het systeem er niets in. De AI-klantenservice mag zich er niet mee
// bemoeien (guard op een lopend aanbod), dus het bleef bij een Telegram-melding —
// en die zakt weg. Rick van Nieuwkerk schreef "Helaas komt dit niet uit vandaag,
// woensdag en donderdag zijn wel opties" en kreeg niets terug.
//
// Deze module leest zo'n reactie en zegt wat er moet gebeuren:
//   akkoord        → de bestaande keuze-route boekt
//   ander-moment   → nieuwe tijden zoeken (met de voorkeur van de klant) en sturen
//   vraag | klacht → mens, maar de klant krijgt WEL meteen een ontvangstbevestiging
//
// Classificatie doet Haiku (goedkoop, één korte call); bij twijfel of storing valt
// alles terug op 'mens', want stilte is hier het enige echt foute antwoord.
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const apiKey = process.env.ANTHROPIC_API_KEY
  || fs.readFileSync(path.join(__dirname, '..', '.anthropic-api-key.txt'), 'utf8').trim();
const client = new Anthropic({ apiKey });

const DAGEN = { maandag: 1, dinsdag: 2, woensdag: 3, donderdag: 4, vrijdag: 5, zaterdag: 6, zondag: 0 };

/**
 * @returns {Promise<{intent: 'akkoord'|'ander-moment'|'vraag'|'klacht', dagen: number[],
 *   dagdeel: 'ochtend'|'middag'|null, samenvatting: string, antwoordVoorstel: string}>}
 */
async function leesReactie(tekst, aangebodenTijden) {
  const veilig = { intent: 'vraag', dagen: [], dagdeel: null, vanaf: null, samenvatting: 'niet automatisch te duiden', antwoordVoorstel: '' };
  if (!String(tekst || '').trim()) return veilig;
  const aanbod = (aangebodenTijden || []).map((s) => new Date(s.aankomst).toLocaleString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam',
  })).join('; ') || 'onbekend';

  try {
    const vandaag = new Date().toISOString().slice(0, 10);
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `Je leest antwoorden van klanten van een zonweringbedrijf op een voorgesteld inmeetmoment.
Geef ALLEEN JSON terug: {"intent","dagen","dagdeel","samenvatting","antwoordVoorstel"}.

intent:
- "akkoord": klant gaat akkoord met een voorgesteld moment, zonder klacht of voorbehoud.
- "ander-moment": het voorstel past niet of de klant wil een andere dag/tijd.
- "vraag": klant stelt een vraag (over de afspraak, montage, product, factuur).
- "klacht": klant is ontevreden, verwijt ons iets, of noemt een gebroken belofte.
Twijfel je tussen akkoord en iets anders? Kies dan NOOIT akkoord.
Staat er instemming én onvrede in één bericht, dan is het "klacht".

dagen: lijst weekdagnummers die de klant zelf noemt (zo=0, ma=1 … za=6). Niets genoemd = [].
dagdeel: "ochtend" of "middag" als de klant dat noemt, anders null.
vanaf: eerste datum (YYYY-MM-DD) waarop de klant WEL kan, als hij een periode uitsluit
("niet beschikbaar t/m 23 augustus" => "2026-08-24"; "vanaf de week van 24 augustus" =>
"2026-08-24"; "pas na onze vakantie, we zijn terug op 5 september" => "2026-09-05").
Geen periode genoemd = null. Vandaag is ${vandaag}.
samenvatting: één zin, wat de klant wil, in het Nederlands.
antwoordVoorstel: bij "vraag" of "klacht" een concept-antwoord van maximaal 3 zinnen in de stijl van
Nanny van de planning (je-vorm, warm, geen beloftes die je niet waar kunt maken). Anders "".`,
      messages: [{ role: 'user', content: `Aangeboden moment(en): ${aanbod}\n\nKlant schreef:\n"""${String(tekst).slice(0, 1200)}"""` }],
    });
    const ruw = resp.content?.[0]?.text || '';
    const json = JSON.parse(ruw.slice(ruw.indexOf('{'), ruw.lastIndexOf('}') + 1));
    const intent = ['akkoord', 'ander-moment', 'vraag', 'klacht'].includes(json.intent) ? json.intent : 'vraag';
    return {
      intent,
      dagen: Array.isArray(json.dagen) ? json.dagen.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [],
      dagdeel: ['ochtend', 'middag'].includes(json.dagdeel) ? json.dagdeel : null,
      vanaf: /^\d{4}-\d{2}-\d{2}$/.test(json.vanaf || '') ? json.vanaf : null,
      samenvatting: String(json.samenvatting || '').slice(0, 200),
      antwoordVoorstel: String(json.antwoordVoorstel || '').slice(0, 600),
    };
  } catch (e) {
    console.log('  reactie-lezer faalde (' + e.message.slice(0, 60) + ') — behandeld als vraag voor een mens');
    return veilig;
  }
}

/** Slots filteren op wat de klant zelf noemde. Levert dat niets op, dan geven we
 *  gewoon de beste tijden — een klant zonder opties helpen we niet. */
function pasBijVoorkeur(slots, { dagen = [], dagdeel = null, vanaf = null } = {}) {
  let kandidaten = slots;
  // Een uitgesloten periode is HARD. Dagen en dagdeel zijn voorkeuren en mogen
  // terugvallen op de beste tijden, maar "wij zijn er niet t/m 23 augustus" betekent dat
  // een eerder voorstel per definitie fout is — Taico (10-08) kreeg exact hetzelfde
  // moment terug dat hij net had afgewezen. Levert het filter niets op, dan dus een
  // LEGE lijst, en dan hoort er een mens naar te kijken.
  if (vanaf) return kandidaten.filter((s) => new Date(s.aankomst) >= new Date(vanaf + 'T00:00:00+02:00'))
    .filter((s) => !dagen.length || dagen.includes(new Date(s.aankomst).getDay()))
    .filter((s) => !dagdeel || (new Date(s.aankomst).getHours() < 12 ? 'ochtend' : 'middag') === dagdeel);
  if (dagen.length) {
    const opDag = kandidaten.filter((s) => dagen.includes(new Date(s.aankomst).getDay()));
    if (opDag.length) kandidaten = opDag;
  }
  if (dagdeel) {
    const opDagdeel = kandidaten.filter((s) => (new Date(s.aankomst).getHours() < 12 ? 'ochtend' : 'middag') === dagdeel);
    if (opDagdeel.length) kandidaten = opDagdeel;
  }
  return kandidaten;
}

module.exports = { leesReactie, pasBijVoorkeur, DAGEN };

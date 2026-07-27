#!/usr/bin/env node
/**
 * MAAKT DE SEGMENTEN IN KLAVIYO (Daimy 2026-07-27).
 *
 * In dit account stonden NUL segmenten en werd er alleen naar hele lijsten gestuurd. Dat is de
 * beste verklaring voor het afmeldpercentage van 4,6% in maart en april, terwijl de norm tussen
 * 0,46% en 0,89% ligt: ongesegmenteerd sturen levert volgens Klaviyo's eigen onderzoek twee keer
 * zoveel afmeldingen op als goed gesegmenteerd sturen.
 *
 * Segmenten zijn ook de veilige route in dit account. De flow "Offerte aanvraag gedaan SMS en
 * mail" staat LIVE en triggert op "toegevoegd aan lijst"; een segment kan zo'n flow niet starten.
 *
 * De condities kijken naar sonty_fase en sonty_categorie, die scripts/email/klaviyo-profielen.js
 * per profiel invult. Daardoor is een segment een simpele gelijk-aan-vergelijking en kun je in
 * het profiel zelf zien waarom iemand erin zit.
 *
 * Gebruik:
 *   node scripts/email/klaviyo-segmenten.js            proefronde
 *   node scripts/email/klaviyo-segmenten.js --doe-het  maakt ze aan
 */
const { KLAVIYO_API_KEY } = require('../secrets.js');

const ECHT = process.argv.includes('--doe-het');
const H = {
  Authorization: 'Klaviyo-API-Key ' + KLAVIYO_API_KEY,
  accept: 'application/json',
  'content-type': 'application/json',
  revision: '2024-10-15',
};

// Eigen profielvelden moeten in Klaviyo als properties['naam'] geschreven worden; de kale naam
// levert een 400 op ("All custom profile properties must be of the form: properties['...']").
const eigen = (naam) => `properties['${naam}']`;

const gelijk = (prop, waarde) => ({
  type: 'profile-property',
  property: eigen(prop),
  filter: { type: 'string', operator: 'equals', value: waarde },
});

const bestaat = (prop) => ({
  type: 'profile-property',
  property: eigen(prop),
  filter: { type: 'existence', operator: 'is-set' },
});

/**
 * De segmenten. Volgorde volgt de klantreis, zodat de lijst in Klaviyo leesbaar blijft.
 * Elk campagnesegment eist ook een offertelink: zonder die link kunnen we geen persoonlijke mail
 * sturen, en juist het ontbreken daarvan maakte de maartcampagne zo algemeen.
 */
const SEGMENTEN = [
  {
    naam: 'Sonty | 1. Offerte vers (0-14 dagen)',
    reeks: 'A1 en A2',
    condities: [gelijk('sonty_fase', 'vers'), bestaat('sonty_offerte_link')],
  },
  {
    naam: 'Sonty | 2. Offerte lopend (15-60 dagen)',
    reeks: 'A3, A4 en A5',
    condities: [gelijk('sonty_fase', 'lopend'), bestaat('sonty_offerte_link')],
  },
  {
    naam: 'Sonty | 3. Offerte koud (60-365 dagen)',
    reeks: 'C, de reactivering',
    condities: [gelijk('sonty_fase', 'koud'), bestaat('sonty_offerte_link')],
  },
  {
    naam: 'Sonty | 4. Offerte zeer koud (1 jaar+)',
    reeks: 'C, maar pas na de eerste resultaten',
    condities: [gelijk('sonty_fase', 'zeer_koud'), bestaat('sonty_offerte_link')],
  },
  {
    naam: 'Sonty | 5. Klant (akkoord gegeven)',
    reeks: 'D en E',
    condities: [gelijk('sonty_fase', 'klant')],
  },
  {
    naam: 'Sonty | 6. Klant met buitenzonwering',
    reeks: 'D, cross-sell naar binnen',
    condities: [gelijk('sonty_fase', 'klant'), gelijk('sonty_categorie', 'buiten')],
  },
  {
    naam: 'Sonty | 7. Klant met raamdecoratie',
    reeks: 'D, cross-sell naar buiten',
    condities: [gelijk('sonty_fase', 'klant'), gelijk('sonty_categorie', 'binnen')],
  },
  {
    naam: 'Sonty | 8. Koud, buitenzonwering',
    reeks: 'C, voorjaarscampagne',
    condities: [gelijk('sonty_fase', 'koud'), gelijk('sonty_categorie', 'buiten'), bestaat('sonty_offerte_link')],
  },
  {
    naam: 'Sonty | 9. Koud, raamdecoratie',
    reeks: 'C, najaarscampagne',
    condities: [gelijk('sonty_fase', 'koud'), gelijk('sonty_categorie', 'binnen'), bestaat('sonty_offerte_link')],
  },
];

/**
 * De segment-endpoint is streng: ongeveer één verzoek per seconde, daarna 429. Zonder deze
 * wachtlus faalde in de eerste run 7 van de 9 segmenten op throttling alleen.
 */
async function api(pad, opties = {}) {
  for (let poging = 0; poging < 5; poging++) {
    const r = await fetch('https://a.klaviyo.com/api/' + pad, { headers: H, ...opties });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch {}
    if (r.status === 429) { await new Promise((s) => setTimeout(s, 1600 * (poging + 1))); continue; }
    return { ok: r.ok, status: r.status, j, t };
  }
  return { ok: false, status: 429, j: null, t: 'na 5 pogingen nog steeds throttled' };
}

(async () => {
  const bestaandeSegmenten = await api('segments/');
  if (!bestaandeSegmenten.ok) { console.error('Kan segmenten niet ophalen: ' + bestaandeSegmenten.t.slice(0, 200)); process.exit(1); }
  const opNaam = new Map((bestaandeSegmenten.j.data || []).map((d) => [d.attributes.name, d.id]));
  console.log(`Klaviyo bevat nu ${opNaam.size} segmenten.\n`);

  for (const s of SEGMENTEN) {
    if (opNaam.has(s.naam)) { console.log(`  bestaat al: ${s.naam}`); continue; }
    if (!ECHT) { console.log(`  ZOU AANMAKEN: ${s.naam}   (voor reeks ${s.reeks})`); continue; }

    const body = {
      data: {
        type: 'segment',
        attributes: {
          name: s.naam,
          definition: { condition_groups: [{ conditions: s.condities }] },
        },
      },
    };
    const r = await api('segments/', { method: 'POST', body: JSON.stringify(body) });
    if (!r.ok) { console.error(`  FOUT bij ${s.naam}: ${r.status} ${r.t.slice(0, 300)}`); continue; }
    console.log(`  aangemaakt: ${s.naam}  (id ${r.j?.data?.id})`);
    await new Promise((x) => setTimeout(x, 1400));
  }

  if (!ECHT) console.log('\nProefronde. Draai met --doe-het om ze echt aan te maken.');
  else console.log('\nKlaar. Segmenten vullen zichzelf zodra de profielen bijgewerkt zijn; er is niets verstuurd.');
})();

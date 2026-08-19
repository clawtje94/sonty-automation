/**
 * READ-ONLY WHATSAPP-ASSISTENT VOOR COLLEGA'S (Daimy 19-08): alleen Joey en Sjoerd mogen
 * Sunny appen met vragen ("wat is het telefoonnummer van gripp offerte 4676", "welk adres
 * heeft ..."); Sunny antwoordt met feiten uit Gripp (alleen-lezen sleutel) en de
 * RP-export. ER WORDT NOOIT IETS AANGEPAST: de tools hieronder zijn uitsluitend
 * opzoek-functies, er bestaat hier geen enkele schrijf-route.
 */
const fs = require('fs');
const path = require('path');
const { GRIPP_API_KEY } = require('../secrets.js');

const ANTHROPIC_KEY = fs.readFileSync(path.join(__dirname, '..', '.anthropic-api-key.txt'), 'utf8').trim();

async function grippCall(body) {
  const r = await fetch('https://api.gripp.com/public/api3.php', {
    method: 'POST', headers: { Authorization: 'Bearer ' + GRIPP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function grippOfferte(nummer) {
  const j = await grippCall([{ method: 'offer.get', params: [[
    { field: 'offer.number', operator: 'equals', value: Number(nummer) }],
    { paging: { firstresult: 0, maxresults: 3 } }], id: 1 }]);
  const rows = j?.[0]?.result?.rows || [];
  if (!rows.length) return { gevonden: false };
  const uit = [];
  for (const o of rows) {
    const basis = {
      nummer: o.number, klant: o.company?.searchname, status: o.status?.searchname || o.status,
      bedragInclBtw: o.totalinclvat, gemaakt: o.createdon?.date, geaccepteerd: o.acceptedon?.date || null,
      onderwerp: o.subject || null,
    };
    if (o.company?.id) {
      const c = await grippCall([{ method: 'company.get', params: [[
        { field: 'company.id', operator: 'equals', value: o.company.id }],
        { paging: { firstresult: 0, maxresults: 1 } }], id: 1 }]);
      const bedrijf = c?.[0]?.result?.rows?.[0];
      if (bedrijf) {
        basis.telefoon = bedrijf.phone || null;
        basis.email = bedrijf.email || null;
        basis.adres = [bedrijf.visitingaddress_street, bedrijf.visitingaddress_streetnumber,
          bedrijf.visitingaddress_zipcode, bedrijf.visitingaddress_city].filter(Boolean).join(' ') || null;
        basis.contactpersoon = bedrijf.contact || null;
      }
    }
    uit.push(basis);
  }
  return { gevonden: true, offertes: uit };
}

function rpZoek(zoekterm) {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'email', 'rp-export.json'), 'utf8'));
  const lijst = Array.isArray(d) ? d : (d.rijen || d.data || []);
  const z = String(zoekterm).toLowerCase().trim();
  const hits = lijst.filter((r) =>
    String(r.offerteNummer) === z
    || `${r.voornaam} ${r.achternaam}`.toLowerCase().includes(z)
    || String(r.email || '').toLowerCase() === z
    || String(r.telefoon || '').replace(/\D/g, '').endsWith(z.replace(/\D/g, '') || 'x'));
  return hits.slice(0, 5).map((r) => ({
    naam: `${r.voornaam} ${r.achternaam}`.trim(), telefoon: r.telefoon || null, email: r.email,
    plaats: r.plaats || null, postcode: r.postcode || null, product: r.product,
    offerteNummer: r.offerteNummer, status: r.offerteStatus, bedrag: r.offerteBedrag,
    akkoord: r.heeftAkkoord === true, offerteLink: r.offerteLink,
    datum: r.offerteDatum ? new Date(Number(r.offerteDatum)).toISOString().slice(0, 10) : null,
  }));
}

const TOOLS = [
  { name: 'gripp_offerte', description: 'Zoek een Gripp-offerte op nummer (Gripp-nummers zijn meestal 4-5 cijfers). Geeft klant, telefoon, e-mail, adres, status en bedrag.', input_schema: { type: 'object', properties: { nummer: { type: 'string' } }, required: ['nummer'] } },
  { name: 'rp_zoek', description: 'Zoek in de offerte-administratie (Reuzenpanda) op offertenummer (2026xxxx), klantnaam, e-mail of telefoonnummer. Geeft naam, telefoon, plaats, product, status en bedrag.', input_schema: { type: 'object', properties: { zoekterm: { type: 'string' } }, required: ['zoekterm'] } },
];

async function antwoordCollega(naam, vraag) {
  const berichten = [{ role: 'user', content: vraag }];
  for (let ronde = 0; ronde < 4; ronde += 1) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-5', max_tokens: 700, tools: TOOLS,
        system: `Je bent Sunny, de interne assistent van Sonty (zonwering, Rijswijk). Je appt met collega ${naam}. Beantwoord zijn vraag kort en direct in het Nederlands met feiten uit je opzoek-tools (Gripp en de offerte-administratie). Regels: je bent STRIKT alleen-lezen, je kunt niks aanpassen, boeken of versturen en belooft dat ook nooit; als een vraag om een actie vraagt zeg je dat een mens dat moet doen. Vind je niks of twijfel je, zeg dat eerlijk. Geen gedachtestreepjes. Dit is een intern gesprek, klantgegevens delen mag.`,
        messages: berichten,
      }),
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    berichten.push({ role: 'assistant', content: j.content });
    if (j.stop_reason !== 'tool_use') {
      return j.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
    }
    const resultaten = [];
    for (const c of j.content.filter((c) => c.type === 'tool_use')) {
      let uit;
      try {
        uit = c.name === 'gripp_offerte' ? await grippOfferte(c.input.nummer) : rpZoek(c.input.zoekterm);
      } catch (e) { uit = { fout: String(e.message).slice(0, 120) }; }
      resultaten.push({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(uit) });
    }
    berichten.push({ role: 'user', content: resultaten });
  }
  return 'Dat krijg ik nu niet opgezocht; vraag het even aan Daimy.';
}

module.exports = { antwoordCollega };

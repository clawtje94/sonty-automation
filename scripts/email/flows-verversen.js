#!/usr/bin/env node
/**
 * FLOWS VERVERSEN (19-08). Klaviyo kloont een template in de flow-mail op het moment van
 * aanmaken en die kloon is daarna onbereikbaar (geen /templates-item, PATCH op het
 * flow-bericht geeft 405). Fotowijzigingen bereiken live flows dus alleen via een verse
 * versie van de flow. Dit script:
 *  1. pakt elke live "Sonty"-flow, leest de definitie (triggers, filters, delays)
 *  2. maakt een nieuwe flow aan met dezelfde definitie; de template_ids wijzen naar de
 *     masters, dus de nieuwe klonen krijgen de ACTUELE fotos/teksten
 *  3. zet de nieuwe live en de oude op concept
 * LET OP: mensen die in de oude flow zaten stoppen daar (concept = stil). De aanroeper
 * moet dus weten wat er in-flight is; dit script print per flow hoeveel ontvangers de
 * oude versie had. Herinstroom regel je per flow (zie herinjectie in de rapportage).
 *
 * Gebruik: node scripts/email/flows-verversen.js --doe-het   (zonder = alleen tonen)
 */
const { KLAVIYO_API_KEY } = require('../secrets.js');
const H = { Authorization: 'Klaviyo-API-Key ' + KLAVIYO_API_KEY, revision: '2026-07-15', accept: 'application/json', 'content-type': 'application/vnd.api+json' };
const HPRE = { ...H, revision: '2024-10-15.pre' };
const ECHT = process.argv.includes('--doe-het');

function schoon(o) {
  if (Array.isArray(o)) { for (const v of o) schoon(v); return; }
  if (o && typeof o === 'object') { delete o.id; for (const v of Object.values(o)) schoon(v); }
}

(async () => {
  const fl = await (await fetch('https://a.klaviyo.com/api/flows/?page%5Bsize%5D=50', { headers: H })).json();
  const live = (fl.data || []).filter((f) => f.attributes.status === 'live' && f.attributes.name.startsWith('Sonty'));
  const stempel = new Date().toISOString().slice(5, 10).replace('-', '');
  for (const f of live) {
    const det = await (await fetch(`https://a.klaviyo.com/api/flows/${f.id}/?additional-fields%5Bflow%5D=definition`, { headers: H })).json();
    const df = det.data.attributes.definition;
    const basis = f.attributes.name.replace(/ \((live[^)]*|v\d{4})\)$/, '').replace(/ \[v\d{4}\]$/, '');
    const naam = `${basis} [v${stempel}]`;
    if (!ECHT) { console.log(`ZOU VERVERSEN: ${f.attributes.name} -> ${naam}`); continue; }
    df.actions.forEach((a, i) => {
      schoon(a.data || {});
      a.temporary_id = 'stap-' + i;
      delete a.id;
      a.links = { next: i + 1 < df.actions.length ? 'stap-' + (i + 1) : null };
    });
    df.entry_action_id = 'stap-0';
    const mk = await (await fetch('https://a.klaviyo.com/api/flows/', { method: 'POST', headers: HPRE, body: JSON.stringify({ data: { type: 'flow', attributes: { name: naam, definition: df } } }) })).json();
    if (mk.errors) { console.error(`FOUT ${naam}: ${JSON.stringify(mk.errors[0]).slice(0, 160)}`); continue; }
    await fetch(`https://a.klaviyo.com/api/flows/${mk.data.id}/`, { method: 'PATCH', headers: H, body: JSON.stringify({ data: { type: 'flow', id: mk.data.id, attributes: { status: 'live' } } }) });
    await fetch(`https://a.klaviyo.com/api/flows/${f.id}/`, { method: 'PATCH', headers: H, body: JSON.stringify({ data: { type: 'flow', id: f.id, attributes: { status: 'draft' } } }) });
    console.log(`VERVERST: ${f.attributes.name} (${f.id}, nu concept) -> ${naam} (${mk.data.id}, live)`);
    await new Promise((x) => setTimeout(x, 800));
  }
  console.log(ECHT ? 'Klaar.' : 'Proefronde; draai met --doe-het.');
})();

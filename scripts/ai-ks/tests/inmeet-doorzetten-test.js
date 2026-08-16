#!/usr/bin/env node
// Regressietest voor inmeet_afspraak_voorstellen (bugfix 2026-08-16, casus Edwin Kanters):
// een ondertekende offerte moet de akkoord-guards overslaan maar de UITVOERING (plannernotitie
// + status naar Inmeten inplannen) wél echt doen. Vroeger returnde dat pad "DOORGEZET" zonder
// iets te doen. Draait volledig op een fetch-stub, raakt geen echte systemen.
const CFG = require('../config.js');
const ITEM = 'test-item-1234';

let patches = [];   // alle PATCH-calls {url, body}
let accepted = true; // of de stub een ACCEPTED-offerte teruggeeft

global.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (opts.method === 'PATCH') { patches.push({ url: u, body: JSON.parse(opts.body || '{}') }); return { ok: true, json: async () => ({}) }; }
  if (u.includes('/quotations?lead_configuration_id=')) return { ok: true, json: async () => ({ quotationDatas: accepted ? [{ quotationNumber: '202699999', quotationStatus: 'ACCEPTED' }] : [{ quotationNumber: '202699999', quotationStatus: 'SENT' }] }) };
  if (u.includes(`/items/${ITEM}`)) return { ok: true, json: async () => ({ item: { id: ITEM, item_subject: { id: 'lc-1' }, description: 'Bestaande omschrijving' } }) };
  return { ok: true, json: async () => ({}) };
};

const { runTool } = require('../tools.js');
const basisInput = { itemId: ITEM, klantNaam: 'Test Klant', product: 'testproduct', notitie: 'Testnotitie voor de planner' };
const ctx = (over = {}) => ({ liveTest: true, kanaal: 'WA', acties: [], klantTeksten: ['Heb hem getekend', 'Welke kleuren doek zijn er'], offerteLinkGedeeld: false, ...over });
const statusPatch = () => patches.find(p => p.body?.item?.status_id === CFG.RP_STATUS_INMETEN_INPLANNEN);
const notitiePatch = () => patches.find(p => typeof p.body?.item?.description === 'string' && p.body.item.description.includes('Testnotitie voor de planner'));

(async () => {
  let fouten = 0;
  const check = (naam, cond) => { console.log((cond ? '  ok  ' : '  FOUT') + ' ' + naam); if (!cond) fouten++; };

  // 1. Getekende offerte: guards overslaan, maar verplaatsing + notitie ECHT uitvoeren
  patches = []; accepted = true;
  let r = JSON.parse(await runTool('inmeet_afspraak_voorstellen', { ...basisInput, akkoordCitaat: 'Heb hem getekend' }, ctx()));
  check('getekend: status DOORGEVOERD', r.status === 'DOORGEVOERD');
  check('getekend: RP-status echt naar Inmeten inplannen gePATCHt', !!statusPatch());
  check('getekend: plannernotitie echt in RP gezet', !!notitiePatch());
  check('getekend: opmerking zegt dat akkoord vaststaat', /ondertekend/.test(r.opmerking || ''));

  // 2. Geen getekende offerte + citaat is een vraag: blokkeren, niets patchen
  patches = []; accepted = false;
  r = JSON.parse(await runTool('inmeet_afspraak_voorstellen', { ...basisInput, akkoordCitaat: 'Welke kleuren doek zijn er' }, ctx()));
  check('vraag-citaat: GEBLOKKEERD', r.status === 'GEBLOKKEERD');
  check('vraag-citaat: geen RP-patches', patches.length === 0);

  // 3. Akkoord-taal maar link nooit gedeeld: blokkeren, niets patchen
  patches = []; accepted = false;
  r = JSON.parse(await runTool('inmeet_afspraak_voorstellen', { ...basisInput, akkoordCitaat: 'Heb hem getekend' }, ctx()));
  check('link niet gedeeld: GEBLOKKEERD', r.status === 'GEBLOKKEERD');
  check('link niet gedeeld: geen RP-patches', patches.length === 0);

  // 4. Normaal akkoord + link gedeeld: doorvoeren
  patches = []; accepted = false;
  r = JSON.parse(await runTool('inmeet_afspraak_voorstellen', { ...basisInput, akkoordCitaat: 'Heb hem getekend' }, ctx({ offerteLinkGedeeld: true })));
  check('normaal akkoord: DOORGEVOERD', r.status === 'DOORGEVOERD');
  check('normaal akkoord: RP-status gePATCHt', !!statusPatch());

  // 5. Schaduwmodus: alleen voorstel, niets patchen
  patches = []; accepted = true;
  const oudeMode = CFG.MODE; CFG.MODE = 'shadow';
  r = JSON.parse(await runTool('inmeet_afspraak_voorstellen', { ...basisInput, akkoordCitaat: 'Heb hem getekend' }, ctx({ liveTest: false })));
  CFG.MODE = oudeMode;
  check('schaduw: VOORGESTELD', /VOORGESTELD/.test(r.status));
  check('schaduw: geen RP-patches', patches.length === 0);

  console.log(fouten ? `\n${fouten} FOUT(EN)` : '\nalle checks geslaagd');
  process.exit(fouten ? 1 : 0);
})();

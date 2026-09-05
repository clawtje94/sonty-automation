#!/usr/bin/env node
// Registreer alle herstelde, goedgekeurde foto's in de portfolio-galerij (sonty:portfolio-additions),
// de stap die de normale 'besluit ok' ook doet maar die de directe goedkeuring oversloeg.
(async () => {
  const { kv } = require('@vercel/kv');
  const l = (await kv.get('sonty:media-uploads')) || [];
  const add = (await kv.get('sonty:portfolio-additions')) || {};
  let n = 0; const per = {};
  for (const x of l) {
    if (x.hersteld && x.status === 'ok' && x.type === 'foto' && !add[x.url]) {
      add[x.url] = { cat: x.cat || x.aiCat || 'overig', alt: (x.aiOordeel || x.naam || '').slice(0, 120) };
      n++; per[add[x.url].cat] = (per[add[x.url].cat] || 0) + 1;
    }
  }
  await kv.set('sonty:portfolio-additions', add);
  console.log('toegevoegd aan galerij:', n, '| per categorie:', JSON.stringify(per), '| additions totaal:', Object.keys(add).length);
})().catch((e) => { console.error('FOUT', e.message); process.exit(1); });

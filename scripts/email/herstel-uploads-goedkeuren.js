#!/usr/bin/env node
// Zet alle herstelde foto's (hersteld:true) op status 'ok' met hun AI-categorie, zodat ze direct in de kiezer staan.
(async () => {
  const { kv } = require('@vercel/kv');
  const KEY = 'sonty:media-uploads';
  const l = (await kv.get(KEY)) || [];
  let n = 0; const per = {};
  for (const x of l) {
    if (x.hersteld && x.status !== 'ok' && x.status !== 'afgewezen') {
      x.cat = x.cat || x.aiCat || 'overig';
      x.status = 'ok'; n++; per[x.cat] = (per[x.cat] || 0) + 1;
    }
  }
  await kv.set(KEY, l);
  const st = {}; for (const x of l) st[x.status || '?'] = (st[x.status || '?'] || 0) + 1;
  console.log('goedgekeurd:', n, '| per categorie:', JSON.stringify(per));
  console.log('lijst nu:', l.length, '| status:', JSON.stringify(st), '| pergola ok:', l.filter(x => x.status === 'ok' && /pergola/i.test(x.cat)).length);
})().catch((e) => { console.error('FOUT', e.message); process.exit(1); });

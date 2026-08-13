#!/usr/bin/env node
// Leest de huidige Klaviyo-stand uit (ALLEEN-LEZEN, alleen GET-calls).
// Output: compact overzicht van lijsten, flows, campagnes, metrics.
// Key komt uit ~/olivida/handoff/env-productie-backup.txt

const fs = require('fs');
const path = require('path');

// Default: Sonty-key. Override met KLAVIYO_KEY_FILE=<pad naar bestand met alleen de key>
const KEY = fs
  .readFileSync(process.env.KLAVIYO_KEY_FILE || path.join(process.env.HOME, 'sonty/scripts/.klaviyo-private-key.txt'), 'utf8')
  .trim();
const REVISION = '2025-07-15';

async function get(pathname, params = '') {
  const url = `https://a.klaviyo.com/api/${pathname}${params ? '?' + params : ''}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Klaviyo-API-Key ${KEY}`,
      revision: REVISION,
      accept: 'application/vnd.api+json',
    },
  });
  if (!res.ok) return { error: `${res.status} ${pathname}`, body: (await res.text()).slice(0, 300) };
  return res.json();
}

(async () => {
  // Lijsten met profielaantal
  const lists = await get('lists');
  console.log('=== LIJSTEN ===');
  for (const l of lists.data || []) {
    console.log(`- ${l.attributes.name} (${l.id}) — ${l.attributes.profile_count ?? '?'} profielen, aangemaakt ${(l.attributes.created || '').slice(0, 10)}`);
  }
  if (lists.error) console.log('FOUT lijsten:', lists.error, lists.body);

  // Flows
  const flows = await get('flows', 'page[size]=50');
  console.log('\n=== FLOWS ===');
  for (const f of flows.data || []) {
    const a = f.attributes;
    console.log(`- ${a.name} (${f.id}) — status: ${a.status}, trigger: ${a.trigger_type || '?'}, aangemaakt ${(a.created || '').slice(0, 10)}, bijgewerkt ${(a.updated || '').slice(0, 10)}`);
  }
  if (flows.error) console.log('FOUT flows:', flows.error, flows.body);

  // Campagnes (e-mail, recentste eerst)
  const camps = await get('campaigns', "filter=equals(messages.channel,'email')&sort=-created_at&page[size]=20");
  console.log('\n=== CAMPAGNES (laatste 20, e-mail) ===');
  for (const c of camps.data || []) {
    const a = c.attributes;
    console.log(`- ${a.name} (${c.id}) — status: ${a.status}, verstuurd: ${a.send_time ? a.send_time.slice(0, 10) : 'niet'}`);
  }
  if (camps.error) console.log('FOUT campagnes:', camps.error, camps.body);

  // Segmenten
  const segs = await get('segments', 'page[size]=10');
  console.log('\n=== SEGMENTEN ===');
  for (const s of segs.data || []) {
    console.log(`- ${s.attributes.name} (${s.id})`);
  }
  if (segs.error) console.log('FOUT segmenten:', segs.error, segs.body);

  // Metrics (welke events komen binnen — toont integraties)
  const metrics = await get('metrics');
  console.log('\n=== METRICS (events die binnenkomen) ===');
  for (const m of metrics.data || []) {
    const integ = m.attributes.integration ? ` [${m.attributes.integration.name}]` : '';
    console.log(`- ${m.attributes.name}${integ}`);
  }
  if (metrics.error) console.log('FOUT metrics:', metrics.error, metrics.body);
})();

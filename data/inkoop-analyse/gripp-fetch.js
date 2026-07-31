// Haalt Gripp-verkoopfacturen + factuurregels op voor de laatste 12 maanden.
// ALLEEN LEZEN. Zuinig: 250 per call, gefilterd op datum.
const fs = require('fs');
const KEY = 'WZvM6r0bAGGONGRhrkWTxVrydXq9H2';
const SINCE = '2025-07-26';

async function gripp(calls) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch('https://api.gripp.com/public/api3.php', {
      method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(calls),
    });
    const t = await r.text();
    try { return JSON.parse(t); } catch { await new Promise(s => setTimeout(s, 5000)); }
  }
  throw new Error('gripp onbereikbaar');
}

async function pageAll(method, filters, label) {
  const out = [];
  let first = 0;
  while (true) {
    const res = await gripp([{ id: 1, method, params: [filters, { paging: { firstresult: first, maxresults: 250 } }] }]);
    const r = res?.[0];
    if (r?.error || r?.result === undefined) { console.log('FOUT', method, JSON.stringify(r).slice(0, 300)); break; }
    const rows = r.result.rows || [];
    out.push(...rows);
    process.stdout.write(`\r${label}: ${out.length}/${r.result.count}   `);
    if (rows.length < 250 || out.length >= r.result.count) break;
    first += 250;
  }
  console.log();
  return out;
}

(async () => {
  const inv = await pageAll('invoice.get',
    [{ field: 'invoice.date', operator: 'greaterequals', value: SINCE }], 'facturen');
  const invMap = {};
  for (const i of inv) invMap[i.id] = { nr: i.number, datum: (i.date?.date || '').slice(0, 10), subject: i.subject, status: i.status?.searchname };

  const lines = await pageAll('invoiceline.get',
    [{ field: 'invoiceline.createdon', operator: 'greaterequals', value: '2025-07-01' }], 'regels');

  const rows = [];
  for (const l of lines) {
    const iv = invMap[l.invoice?.id];
    if (!iv) continue; // regel hoort bij factuur buiten de periode
    rows.push({
      factuur: iv.nr, datum: iv.datum, status: iv.status,
      product: l.product?.searchname || '', omschrijving: (l.description || '').replace(/\s+/g, ' ').slice(0, 120),
      aantal: Number(l.amount) || 0, prijs: Number(l.sellingprice) || 0, eenheid: l.unit?.searchname || '',
    });
  }
  fs.writeFileSync(__dirname + '/gripp-regels.json', JSON.stringify(rows));
  console.log('facturen in periode:', inv.length, '| regels gekoppeld:', rows.length);
})();

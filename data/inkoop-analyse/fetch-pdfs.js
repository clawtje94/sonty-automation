// Downloadt PDF-bijlagen uit de inkoop-mappen van facturen@sonty.nl, laatste 12 maanden.
const fs = require('fs');
const path = require('path');
const T = fs.readFileSync(__dirname + '/owa-token.txt', 'utf8').trim();
const H = { Authorization: 'Bearer ' + T, Accept: 'application/json' };
const SINCE = '2025-07-26T00:00:00Z';
const PDFDIR = __dirname + '/pdfs';
const BASE = 'https://outlook.office.com/api/v2.0/users/facturen@sonty.nl';

// mappen die inkoop bevatten (naam zoals in Outlook)
const WANT = ['Bonnen materialen', 'Sunmaster', 'ROMA', 'TOPPOINT', 'unilux', 'ABZ Raamdecoratie',
  'Belakos', 'ARTE', 'Horren.com', 'Zonweringbestellen', 'Peitsman', 'JAB', 'diversen'];

async function get(url, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: H });
    if (r.status === 429 || r.status === 503) { await new Promise(s => setTimeout(s, 20000)); continue; }
    if (!r.ok) { console.log('\nERR', r.status, url.slice(0, 100)); return null; }
    return r.json();
  }
  return null;
}

async function allFolders() {
  const found = [];
  const top = await get(`${BASE}/mailFolders?$top=100&$select=DisplayName,TotalItemCount,ChildFolderCount`);
  for (const f of top.value) {
    if (WANT.includes(f.DisplayName)) found.push(f);
    if (f.ChildFolderCount) {
      const c = await get(`${BASE}/mailFolders/${f.Id}/childFolders?$top=100&$select=DisplayName,TotalItemCount,ChildFolderCount`);
      for (const ch of (c?.value || [])) if (WANT.includes(ch.DisplayName)) found.push(ch);
    }
  }
  return found;
}

(async () => {
  fs.mkdirSync(PDFDIR, { recursive: true });
  const index = [];
  const folders = await allFolders();
  console.log('mappen:', folders.map(f => `${f.DisplayName}(${f.TotalItemCount})`).join(', '));

  for (const f of folders) {
    const dir = path.join(PDFDIR, f.DisplayName.replace(/[^\w.-]/g, '_'));
    fs.mkdirSync(dir, { recursive: true });
    let skip = 0, done = false, n = 0;
    while (!done) {
      const j = await get(`${BASE}/mailFolders/${f.Id}/messages?$top=50&$skip=${skip}` +
        `&$select=Subject,From,ReceivedDateTime,HasAttachments&$orderby=ReceivedDateTime desc`);
      if (!j) break;
      const b = j.value || [];
      for (const m of b) {
        if (m.ReceivedDateTime < SINCE) { done = true; break; }
        if (!m.HasAttachments) continue;
        const a = await get(`${BASE}/messages/${m.Id}/attachments`);
        for (const at of (a?.value || [])) {
          const nm = at.Name || '';
          if (!/\.pdf$/i.test(nm)) continue;
          if (!at.ContentBytes) continue;
          const safe = `${m.ReceivedDateTime.slice(0, 10)}_${n}_${nm.replace(/[^\w.-]/g, '_')}`;
          fs.writeFileSync(path.join(dir, safe), Buffer.from(at.ContentBytes, 'base64'));
          index.push({ folder: f.DisplayName, file: path.join(f.DisplayName.replace(/[^\w.-]/g, '_'), safe),
            date: m.ReceivedDateTime, from: m.From?.EmailAddress?.Address || '', subject: m.Subject || '' });
          n++;
        }
        process.stdout.write(`\r${f.DisplayName}: ${n} pdf's, index ${index.length}        `);
      }
      skip += 50;
      if (b.length < 50) break;
    }
    console.log();
    fs.writeFileSync(__dirname + '/pdf-index.json', JSON.stringify(index, null, 1)); // incrementeel
  }
  fs.writeFileSync(__dirname + '/pdf-index.json', JSON.stringify(index, null, 1));
  console.log('TOTAAL PDF:', index.length);
})();

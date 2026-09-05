#!/usr/bin/env node
// Upload ad-set naar Google Drive via service account. Wacht tot de map gedeeld is.
// Gebruik: node scripts/drive-upload-ads.js <drive-map-id> <product> <lokale map met lever/>
const { google } = require('googleapis'); const fs = require('fs'); const path = require('path'); const { execSync } = require('child_process');
const [mapId, product, bron] = process.argv.slice(2);
const sa = require(path.join(__dirname, '..', 'data', 'google-service-account.json'));
const drive = google.drive({ version: 'v3', auth: new google.auth.GoogleAuth({ credentials: sa, scopes: ['https://www.googleapis.com/auth/drive'] }) });
const mime = f => ({ '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.md': 'text/markdown', '.zip': 'application/zip' })[path.extname(f)] || 'application/octet-stream';
const slaap = ms => new Promise(r => setTimeout(r, ms));
async function map(naam, parent) {
  const q = `name='${naam.replace(/'/g, "\\'")}' and '${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const r = await drive.files.list({ q, fields: 'files(id)', supportsAllDrives: true, includeItemsFromAllDrives: true });
  if (r.data.files[0]) return r.data.files[0].id;
  const c = await drive.files.create({ requestBody: { name: naam, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }, fields: 'id', supportsAllDrives: true });
  return c.data.id;
}
(async () => {
  for (let i = 0; i < 720; i++) { // max 12 uur wachten
    try { await drive.files.get({ fileId: mapId, fields: 'id', supportsAllDrives: true }); break; }
    catch (e) { if (i % 10 === 0) console.log(new Date().toISOString(), 'nog geen toegang, wacht...'); await slaap(60000); if (i === 719) { console.log('opgegeven'); process.exit(1); } }
  }
  const pid = await map(product, mapId); let n = 0;
  for (const sub of fs.readdirSync(bron).filter(d => fs.statSync(path.join(bron, d)).isDirectory())) {
    const sid = await map(sub, pid);
    const bestaand = new Set((await drive.files.list({ q: `'${sid}' in parents and trashed=false`, fields: 'files(name)', supportsAllDrives: true, includeItemsFromAllDrives: true })).data.files.map(f => f.name));
    for (const f of fs.readdirSync(path.join(bron, sub))) {
      if (bestaand.has(f)) continue;
      await drive.files.create({ requestBody: { name: f, parents: [sid] }, media: { mimeType: mime(f), body: fs.createReadStream(path.join(bron, sub, f)) }, fields: 'id', supportsAllDrives: true }); n++;
    }
  }
  for (const f of fs.readdirSync(bron).filter(f => fs.statSync(path.join(bron, f)).isFile())) {
    await drive.files.create({ requestBody: { name: f, parents: [pid] }, media: { mimeType: mime(f), body: fs.createReadStream(path.join(bron, f)) }, fields: 'id', supportsAllDrives: true }); n++;
  }
  console.log('klaar, geupload:', n);
  execSync(`node ${path.join(__dirname, 'telegram-stuur.js')} ${JSON.stringify(`Drive-upload klaar: ${n} bestanden in map ${product} (submappen 1x1, 4x5, 9x16, carrousel, video + flow-document). https://drive.google.com/drive/folders/${pid}`)}`);
})().catch(e => { console.error('FOUT', e.message); process.exit(1); });

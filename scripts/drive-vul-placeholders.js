#!/usr/bin/env node
// Vult Drive-placeholders (eigendom Daimy, aangemaakt via de chat-koppeling) met echte inhoud via de service-account.
// Gebruik: node scripts/drive-vul-placeholders.js '{"<drive-map-id>":"<lokale map>", ...}'
const { google } = require('googleapis'); const fs = require('fs'); const path = require('path');
const drive = google.drive({ version: 'v3', auth: new google.auth.GoogleAuth({ credentials: require(path.join(__dirname, '..', 'data', 'google-service-account.json')), scopes: ['https://www.googleapis.com/auth/drive'] }) });
const mime = f => ({ '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.md': 'text/markdown' })[path.extname(f)] || 'application/octet-stream';
(async () => {
  const map = JSON.parse(process.argv[2]); let n = 0, ontbreekt = [];
  for (const [mapId, lokaal] of Object.entries(map)) {
    const r = await drive.files.list({ q: `'${mapId}' in parents and trashed=false`, fields: 'files(id,name,size)', pageSize: 200 });
    const opDrive = Object.fromEntries(r.data.files.map(f => [f.name, f]));
    for (const f of fs.readdirSync(lokaal).filter(f => fs.statSync(path.join(lokaal, f)).isFile())) {
      const d = opDrive[f]; if (!d) { ontbreekt.push(`${path.basename(lokaal)}/${f}`); continue; }
      const lokSize = fs.statSync(path.join(lokaal, f)).size; if (Number(d.size) === lokSize) continue;
      await drive.files.update({ fileId: d.id, media: { mimeType: mime(f), body: fs.createReadStream(path.join(lokaal, f)) }, fields: 'id' }); n++; console.log('gevuld', path.basename(lokaal), f);
    }
  }
  console.log('KLAAR gevuld:', n, 'ontbrekende placeholders:', ontbreekt.length, ontbreekt.join(' '));
})().catch(e => { console.error('FOUT', e.message); process.exit(1); });

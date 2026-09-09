// Verstuurt de standaard offerteaanvraag per mail naar een lijst aanbieders (code:email:plaats), logt in offertes.csv
const { execFileSync } = require('child_process');
const fs = require('fs');
const OUT = '/Users/clawdboot/sonty/data/prijsonderzoek';
const ADRES = {
  Wassenaar: 'Backershagenlaan 56, 2243 AE Wassenaar',
  Bilthoven: 'Soestdijkseweg Zuid 103, 3721 AA Bilthoven',
  Oosterbeek: 'Pietersbergseweg 22, 6862 BV Oosterbeek',
  Vught: 'Boslaan 47, 5263 NX Vught',
  Breda: 'Ulvenhoutselaan 74, 4834 MH Breda',
  Enschede: 'Boddenkampsingel 23, 7514 AN Enschede',
  Rhoon: 'Kleidijk 39, 3161 EK Rhoon',
};
const base = fs.readFileSync(OUT + '/aanvraag-body.txt', 'utf8');
const list = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
const today = new Date().toISOString().slice(0, 10);
for (const line of list) {
  const [code, domein, email, plaats] = line.split(':');
  const adres = ADRES[plaats]; if (!adres) { console.log(code, 'GEEN ADRES voor', plaats); continue; }
  const body = base.replace(/Adres: .*? Ik ben/, `Adres: ${adres}. Ik ben`);
  if (!body.includes(adres)) { console.log(code, 'adres niet vervangen'); continue; }
  const bf = `${OUT}/verzonden/body-${code}.txt`; fs.writeFileSync(bf, body);
  const subject = `Offerte 2 ritsscreens + 2 rolluiken (${plaats})`;
  let status = 'FOUT';
  try {
    const out = execFileSync('node', ['/Users/clawdboot/sonty/scripts/prijsonderzoek-proton-send.js', email, subject, bf], { env: { ...process.env, NODE_PATH: '/Users/clawdboot/sonty/node_modules' }, timeout: 300000 }).toString();
    status = /VERZONDEN/.test(out) ? 'verzonden' : 'onzeker';
    console.log(code, domein, email, plaats, '->', status);
  } catch (e) { console.log(code, domein, email, plaats, '-> FOUT', (e.stdout || '').toString().slice(-200)); }
  fs.appendFileSync(OUT + '/offertes.csv', `${code},${domein},${today},mail,4 producten + pergola/knikarm-vraag,${status},,,onbekend,"naar ${email}; adres ${plaats}"\n`);
}

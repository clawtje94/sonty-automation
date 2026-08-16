#!/usr/bin/env node
// Regressietest V9-guard tegen ECHTE dossiers (oplevercheck poort 1): de bekende
// gevallen van de audit 16-08 moeten allemaal geweigerd worden, elk om hun eigen reden.
const CFG = require('../ai-ks/config.js');
const { magBenaderd } = require('./mag-benaderd.js');
const H = { Authorization: 'Bearer ' + CFG.RP_API_KEY };

const MOET_NEE = [
  ['Edwin Kanters', 'ad8c60c2'],      // getekend + geboekt + Afgerond
  ['Kirsten de Koning', '38c2bec4'],  // Afgerond, handmatig geholpen
  ['Victor Ansink', ''],              // Afgerond ZONDER getekende offerte — de scherpste casus
  ['Barbara Weeink', ''],             // geboekt
  ['Daimy TEST BOOT', '45aeb252'],    // testdossier: net een "getekbare" offerte, maar open Trengo/na status?
];

(async () => {
  const items = (await (await fetch(`https://backend.reuzenpanda.nl/contact-service/${CFG.RP_PID}/backlogs/${CFG.RP_BACKLOG}/items`, { headers: H })).json()).items || [];
  let fouten = 0;
  for (const [naam, idPrefix] of MOET_NEE) {
    const kand = items.find((i) => (idPrefix && i.id.startsWith(idPrefix)) || (!idPrefix && (i.summary || '').toLowerCase().includes(naam.toLowerCase().split(' ')[0]) && (i.summary || '').toLowerCase().includes(naam.toLowerCase().split(' ').pop())));
    if (!kand) { console.log('??   ' + naam + ': item niet gevonden'); fouten++; continue; }
    const r = await magBenaderd(kand, items);
    const ok = r.mag === false;
    console.log((ok ? 'ok  ' : 'FOUT') + ' ' + naam + ' → ' + (r.mag ? 'ZOU GEMAILD WORDEN!' : 'geweigerd: ' + r.reden));
    if (!ok) fouten++;
  }
  console.log(fouten ? `\n${fouten} FOUT(EN)` : '\nalle weiger-checks geslaagd');
  process.exit(fouten ? 1 : 0);
})();

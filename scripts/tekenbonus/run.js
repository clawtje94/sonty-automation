// Tekenbonus-runner (A/B-test, besluit Daimy 16-08). Drie armen, round-robin:
//   controle  : gewone herinnering zonder bonus
//   bonus-2d  : tekenbonus met deadline verzenddag+2 (weekend schuift naar maandag)
//   bonus-4d  : tekenbonus met deadline verzenddag+4 (idem)
//
// TESTMODUS IS DE STANDAARD. Er kan pas iets naar een klant als het bestand
// scripts/tekenbonus/.tekenbonus-live bestaat EN je --execute meegeeft. Zonder dat:
//   node run.js            → proeflijst (niets aangepast, niets verstuurd)
//   node run.js --proef 3  → daarnaast 3 voorbeeldmails naar daimyboot@gmail.com
//                            (offertes van die klanten worden NIET aangepast)
const fs = require('fs');
const path = require('path');
const CFG = require('../ai-ks/config.js');
const { magBenaderd, klantIdentiteit, BONUS_LOG } = require('./mag-benaderd.js');
const { kandidaten } = require('./selectie.js');
const { bereidVoor, ruimOp, staffel, magBonus, deadline, datumLang, datumKort } = require('./offerte-prep.js');

const H = { Authorization: 'Bearer ' + CFG.RP_API_KEY };
const AB_FILE = path.join(__dirname, '..', '..', 'data', 'tekenbonus-ab.json');
const ARMEN = ['controle', 'bonus-2d', 'bonus-4d'];
const LIVE = fs.existsSync(path.join(__dirname, '.tekenbonus-live')) && process.argv.includes('--execute');
const PROEF = process.argv.includes('--proef') ? parseInt(process.argv[process.argv.indexOf('--proef') + 1] || '3', 10) : 0;
const CAP = 30; // max klanten per run, ook straks live

const euro = (n) => '€ ' + n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function volgendeArm() {
  let st = { teller: 0 };
  try { st = JSON.parse(fs.readFileSync(AB_FILE, 'utf8')); } catch { /* eerste run */ }
  const arm = ARMEN[st.teller % ARMEN.length];
  st.teller += 1;
  fs.writeFileSync(AB_FILE, JSON.stringify(st));
  return arm;
}

async function docVan(item) {
  const lcId = item.item_subject?.id;
  if (!lcId) return null;
  const q = await (await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${CFG.RP_PID}/quotations?lead_configuration_id=${lcId}`, { headers: H })).json();
  const docs = (q?.quotationDatas || []).filter((d) => d.quotationNumber);
  docs.sort((a, b) => (b.quotationCreationTimestamp || 0) - (a.quotationCreationTimestamp || 0));
  return docs[0] || null;
}

function bouwMail(w) {
  let html = fs.readFileSync(path.join(__dirname, 'mail-template.html'), 'utf8');
  for (const [k, v] of Object.entries(w)) html = html.split('{{' + k + '}}').join(v);
  return html;
}

(async () => {
  console.log(LIVE ? '=== LIVE RUN ===' : '=== TESTMODUS (er wordt niets naar klanten gestuurd of aangepast) ===');
  const items = (await (await fetch(`https://backend.reuzenpanda.nl/contact-service/${CFG.RP_PID}/backlogs/${CFG.RP_BACKLOG}/items`, { headers: H })).json()).items || [];
  const kand = (await kandidaten(items)).sort((a, b) => a.timestamp_created - b.timestamp_created);
  console.log('kandidaten:', kand.length);
  const log = fs.existsSync(BONUS_LOG) ? JSON.parse(fs.readFileSync(BONUS_LOG, 'utf8')) : {};
  let gedaan = 0, proefGedaan = 0;
  // Eén klant = één mail en één arm, ook als hij meerdere dossiers heeft
  // (bug gevonden in de eerste proeflijst: zelfde klant in twee armen).
  const alGezien = new Set();
  for (const item of kand) {
    if (gedaan >= CAP) break;
    const wieCheck = klantIdentiteit(item);
    const sleutel = wieCheck.email || wieCheck.tel;
    if (!sleutel || alGezien.has(sleutel)) continue;
    const guard = await magBenaderd(item, items);
    if (!guard.mag) continue;
    alGezien.add(sleutel);
    const doc = await docVan(item);
    if (!doc || /ACCEPTED|SIGNED/i.test(String(doc.quotationStatus || ''))) continue;
    const wie = klantIdentiteit(item);
    const arm = volgendeArm();
    const dagen = arm === 'bonus-2d' ? 2 : 4;
    const dl = deadline(dagen);
    const full = await (await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${CFG.RP_PID}/quotations/${doc.documentId}`, { headers: H })).json();
    const totaal = Math.round((full?.quotationData?.pricing?.total ?? 0) * 100) / 100;
    if (!magBonus(totaal)) continue; // lab-regel: onder 750 of kapot totaal → geen mail
    const bonus = staffel(totaal);
    gedaan++;
    console.log(`${String(gedaan).padStart(2)} ${arm.padEnd(9)} ${(wie.naam || '?').slice(0, 26).padEnd(26)} ${doc.quotationNumber} ${euro(totaal)}${arm === 'controle' ? '' : ` → bonus ${bonus}, deadline ${datumKort(dl)}`}`);

    if (LIVE) {
      // Echte flow: offerte prepareren, mail via Klaviyo, log bijwerken. Bewust nog
      // niet actief: pas nadat Daimy expliciet "aan" heeft gezegd bouwen we de
      // Klaviyo-verzending hier in en gaat .tekenbonus-live erop.
      throw new Error('LIVE-pad is nog niet vrijgegeven');
    }
    if (PROEF && proefGedaan < PROEF && arm !== 'controle') {
      proefGedaan++;
      const html = bouwMail({
        AANHEF: 'Hoi ' + ((wie.naam || '').split(' ')[0] || 'daar') + ',',
        PRODUCT: 'Zonwering op maat', NUMMER: String(doc.quotationNumber),
        GELDIG_TOT: datumKort(dl) + ' 2026', TOTAAL: euro(totaal), TOTAAL_MET_BONUS: euro(totaal - bonus),
        BONUS: String(bonus), DEADLINE_DAG: datumLang(dl), DEADLINE_KORT: datumKort(dl),
        LINK: `https://document.reuzenpanda.nl/nl/${CFG.RP_PID}/${doc.documentId}/latest?pdfAction=DOCSIGN`,
      });
      const token = fs.readFileSync(path.join(__dirname, '..', '.owa-token.txt'), 'utf8').trim();
      const r = await fetch('https://outlook.office.com/api/v2.0/me/sendmail', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ Message: { Subject: `[PROEF ${arm}] Er kan eenmalig ${bonus} euro van je offerte af`, Body: { ContentType: 'HTML', Content: html }, ToRecipients: [{ EmailAddress: { Address: 'daimyboot@gmail.com' } }] }, SaveToSentItems: false }),
      });
      console.log(`   → proefmail (${arm}) naar daimyboot@gmail.com: ${r.status}`);
    }
  }
  console.log(`klaar: ${gedaan} in de lijst${PROEF ? `, ${proefGedaan} proefmails` : ''}. Er is niets aan klant-offertes veranderd en niets naar klanten gestuurd.`);
})();

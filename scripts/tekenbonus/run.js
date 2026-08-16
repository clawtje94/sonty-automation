// Tekenbonus-runner (A/B-test, GO Daimy 16-08 avond: "morgen de eerste 30+ dagen
// mensen gaan mailen"). Drie armen, round-robin:
//   controle  : GEEN mail (zuivere nulmeting; de gewone herinnering-mail wacht op de
//               review-sessie van Daimy en Joey van het hele flow-pakket)
//   bonus-2d  : tekenbonus-mail, deadline verzenddag+2 (weekend schuift naar maandag)
//   bonus-4d  : tekenbonus-mail, deadline verzenddag+4 (idem)
//
// TESTMODUS IS DE STANDAARD. Live vereist het bestand scripts/tekenbonus/.tekenbonus-live
// ÉN --execute (de cron geeft beide). Bestand weghalen = kill switch.
//   node run.js            → proeflijst (niets aangepast, niets verstuurd)
//   node run.js --execute  → live: offertes prepareren + mail via Klaviyo + log
//
// Live-volgorde per klant (V9-eis): guard → doc-hercheck (niet getekend) → offerte
// prepareren (backup + totaal-verificatie + rollback) → profiel → campagne per arm.
// Faalt de campagne, dan worden de zojuist geprepareerde offertes teruggedraaid.
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
// Cap bouwt automatisch op (vraag Daimy 16-08: "wat als het er meer dan 30 zijn?"):
// week 1 = 30/dag (rustige start + mail-reputatie van aanvragen@ opwarmen), daarna
// +15 per week tot 75/dag. Bij ~55-70 nieuwe kandidaten per dag dekt 75 de instroom
// en wordt de wachtrij (oudste eerst) vanzelf ingehaald.
const START = new Date('2026-08-17').getTime();
const weken = Math.max(0, Math.floor((Date.now() - START) / (7 * 86400000)));
const CAP = Math.min(75, 30 + 15 * weken);
const TG = { token: '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40', chat: 1700128390 };

const euro = (n) => '€ ' + n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const telegram = (tekst) => fetch(`https://api.telegram.org/bot${TG.token}/sendMessage`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: TG.chat, text: tekst.substring(0, 4000) }),
}).catch(() => {});

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

function productTekst(fullDoc) {
  const lines = fullDoc?.quotationData?.segments?.defaultTemplatePriceLineGroup?.data?.lines || [];
  const titels = lines.map((l) => (l.description || '').split('\n')[0].replace(/\*\*/g, '').trim())
    .filter((t) => t && !/montage|inmeten|korting|tekenbonus|actie/i.test(t));
  return titels.slice(0, 2).join(' en ') || 'Zonwering op maat';
}

(async () => {
  console.log(LIVE ? '=== LIVE RUN ===' : '=== TESTMODUS (er wordt niets naar klanten gestuurd of aangepast) ===');
  const items = (await (await fetch(`https://backend.reuzenpanda.nl/contact-service/${CFG.RP_PID}/backlogs/${CFG.RP_BACKLOG}/items`, { headers: H })).json()).items || [];
  const kand = (await kandidaten(items)).sort((a, b) => a.timestamp_created - b.timestamp_created);
  console.log('kandidaten:', kand.length);

  // fase 1: selecteren (guard, doc-check, arm, staffel) — nog niets aangepast
  const selectie = [];
  const alGezien = new Set(); // één klant = één mail en één arm (bug uit proeflijst 1)
  for (const item of kand) {
    if (selectie.length >= CAP) break;
    const wie = klantIdentiteit(item);
    const sleutel = wie.email || wie.tel;
    if (!sleutel || alGezien.has(sleutel)) continue;
    if (LIVE && !wie.email) continue; // mailen vereist een e-mailadres
    const guard = await magBenaderd(item, items);
    if (!guard.mag) continue;
    const doc = await docVan(item);
    if (!doc || /ACCEPTED|SIGNED/i.test(String(doc.quotationStatus || ''))) continue;
    const full = await (await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${CFG.RP_PID}/quotations/${doc.documentId}`, { headers: H })).json();
    const totaal = Math.round((full?.quotationData?.pricing?.total ?? 0) * 100) / 100;
    if (!magBonus(totaal)) continue; // lab-regel: onder 750 of kapot totaal → geen mail
    alGezien.add(sleutel);
    const arm = volgendeArm();
    const dagen = arm === 'bonus-2d' ? 2 : 4;
    const dl = deadline(dagen);
    selectie.push({ item, wie, doc, totaal, arm, dl, bonus: staffel(totaal), product: productTekst(full) });
    console.log(`${String(selectie.length).padStart(2)} ${arm.padEnd(9)} ${(wie.naam || '?').slice(0, 26).padEnd(26)} ${doc.quotationNumber} ${euro(totaal)}${arm === 'controle' ? ' (geen mail, nulmeting)' : ` → bonus ${staffel(totaal)}, deadline ${datumKort(dl)}`}`);
  }

  if (!LIVE) {
    console.log(`klaar: ${selectie.length} in de lijst. Er is niets aan klant-offertes veranderd en niets naar klanten gestuurd.`);
    return;
  }

  // fase 2: live uitvoeren via de FLOW-route (events; besluit Daimy 16-08: flows,
  // geen losse campagnes). Eerst checken of de flow live staat — anders zouden we
  // offertes prepareren terwijl er nooit een mail volgt.
  const { flowStatus, stuurEvent } = require('./klaviyo-events.js');
  const flow = await flowStatus();
  if (!flow.live) {
    const m = `⏸ Tekenbonus-run overgeslagen: ${flow.reden}. Zet de flow live in Klaviyo (Flows → Tekenbonus), dan gaat de volgende run vanzelf.`;
    console.log(m); await telegram(m); return;
  }

  const log = fs.existsSync(BONUS_LOG) ? JSON.parse(fs.readFileSync(BONUS_LOG, 'utf8')) : {};
  const bewaarLog = () => fs.writeFileSync(BONUS_LOG, JSON.stringify(log, null, 1));
  const rapport = { controle: 0, 'bonus-2d': 0, 'bonus-4d': 0, fouten: [] };

  // controle-arm: alleen registreren (nulmeting, geen mail)
  for (const s of selectie.filter((x) => x.arm === 'controle')) {
    log[s.doc.documentId] = { email: s.wie.email, telefoon: s.wie.tel, naam: s.wie.naam, itemId: s.item.id, nummer: String(s.doc.quotationNumber), arm: 'controle', verstuurdOp: new Date().toISOString(), status: 'controle-geen-mail', totaal: s.totaal };
    rapport.controle++;
  }
  bewaarLog();

  for (const s of selectie.filter((x) => x.arm !== 'controle')) {
    try {
      const prep = await bereidVoor(s.doc.documentId, { deadlineDatum: s.dl });
      if (prep.fout) { rapport.fouten.push(`${s.wie.naam}: prep ${prep.fout}`); continue; }
      const voornaam = (s.wie.naam || '').trim().split(/\s+/)[0] || '';
      try {
        await stuurEvent(s.wie.email, {
          arm: s.arm,
          aanhef: voornaam ? `Hoi ${voornaam},` : 'Hoi,',
          product: s.product,
          offertenummer: String(s.doc.quotationNumber),
          geldig_tot: prep.deadlineKort + ' ' + s.dl.getFullYear(),
          totaal: euro(prep.totaalVoor),
          totaal_met_bonus: euro(prep.totaalNa),
          bonus: String(prep.bonus),
          deadline_dag: prep.deadlineDag,
          deadline_kort: prep.deadlineKort,
          offerte_link: `https://document.reuzenpanda.nl/nl/${CFG.RP_PID}/${s.doc.documentId}/latest?pdfAction=DOCSIGN`,
        }, s.arm);
      } catch (e) {
        // event faalde: offerte meteen terugdraaien, niets laten hangen
        await ruimOp(s.doc.documentId, prep.origineleGroupDiscount).catch(() => {});
        rapport.fouten.push(`${s.wie.naam}: event ${String(e.message).slice(0, 80)} — offerte teruggedraaid`);
        continue;
      }
      log[s.doc.documentId] = { email: s.wie.email, telefoon: s.wie.tel, naam: s.wie.naam, itemId: s.item.id, nummer: String(s.doc.quotationNumber), arm: s.arm, bonus: prep.bonus, totaalVoor: prep.totaalVoor, totaalNa: prep.totaalNa, deadline: s.dl.toISOString(), origineleGroupDiscount: prep.origineleGroupDiscount, verstuurdOp: new Date().toISOString(), status: 'verstuurd' };
      rapport[s.arm]++;
      bewaarLog();
    } catch (e) {
      rapport.fouten.push(`${s.wie.naam}: ${String(e.message).slice(0, 80)}`);
    }
  }
  bewaarLog();

  const melding = `📨 Tekenbonus-run (flow "${flow.naam}"): ${rapport['bonus-2d']}x 2-dagen, ${rapport['bonus-4d']}x 4-dagen, ${rapport.controle}x controle (geen mail).${rapport.fouten.length ? '\n⚠️ ' + rapport.fouten.slice(0, 5).join('\n⚠️ ') : ''}`;
  console.log(melding);
  await telegram(melding);
})();

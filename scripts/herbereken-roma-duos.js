#!/usr/bin/env node
// Herberekent bestaande Roma duo-offertes met de actuele logica van
// roma-duo-offerte.js (2026-07-10: rolluiken .P i.p.v. .XP, opdracht Daimy;
// eerder 2026-07-06: solar-bron → solar-matrix). Verwijdert bij --live ook het
// geërfde "Waarom Sonty"-blok. Werkt de documenten IN-PLACE bij
// (zelfde documentId, dus al gedeelde links tonen daarna de juiste prijzen).
// Gebruik: node scripts/herbereken-roma-duos.js [--live]
// Zonder --live: dry-run, toont alleen oud → nieuw totaal per klant.

const fs = require('fs');
const path = require('path');
const { bouwRomaLines } = require('./roma-duo-offerte.js');
const CFG = require('./ai-ks/config.js');

const RP = 'https://backend.reuzenpanda.nl';
const PID = CFG.RP_PID;
const H = { Authorization: 'Bearer ' + CFG.RP_API_KEY, 'Content-Type': 'application/json' };
const LIVE = process.argv.includes('--live');
const DUO_FILE = path.join(__dirname, '..', 'data', 'roma-duo-gemaakt.json');

const lineTotaal = (lines) => lines.reduce((s, l) => s + (l.pricePerUnit || 0) * (l.units || 1), 0);

(async () => {
  const duoLog = JSON.parse(fs.readFileSync(DUO_FILE, 'utf8'));
  let bijgewerkt = 0, gelijk = 0, fouten = 0;

  for (const [key, d] of Object.entries(duoLog)) {
    try {
      const duoDoc = (await (await fetch(`${RP}/document-service/v1/${PID}/quotations/${d.romaDocumentId}`, { headers: H })).json()).quotationData;
      if (!duoDoc) { console.log('FOUT: duo-doc niet gevonden:', d.klant, d.romaNummer); fouten++; continue; }
      const lcId = duoDoc.subjects?.leadConfiguration;
      const qs = (await (await fetch(`${RP}/document-service/v1/${PID}/quotations?lead_configuration_id=${lcId}`, { headers: H })).json()).quotationDatas || [];
      const bronRef = qs.find(q => String(q.quotationNumber) === String(d.bron));
      if (!bronRef) { console.log('FOUT: bron niet gevonden:', d.klant, d.bron); fouten++; continue; }
      // Klant heeft al akkoord gegeven? Dan documenten met rust laten (instructie Daimy 2026-07-10)
      if (bronRef.documentStatus === 'ACCEPTED' || duoDoc.documentStatus === 'ACCEPTED') {
        console.log('SKIP (akkoord gegeven):', d.klant, '(' + d.romaNummer + ')');
        continue;
      }
      const bronDoc = (await (await fetch(`${RP}/document-service/v1/${PID}/quotations/${bronRef.documentId}`, { headers: H })).json()).quotationData;
      const bronPlg = bronDoc?.segments?.defaultTemplatePriceLineGroup?.data;
      if (!bronPlg) { console.log('FOUT: bron zonder prijsregels:', d.klant, d.bron); fouten++; continue; }

      const gebouwd = bouwRomaLines(bronPlg);
      if (gebouwd.skip) { console.log('SKIP:', d.klant, '(' + gebouwd.skip + ')'); continue; }

      const oudeLines = duoDoc.segments?.defaultTemplatePriceLineGroup?.data?.lines || [];
      const oudTotaal = lineTotaal(oudeLines);
      const nieuwTotaal = lineTotaal(gebouwd.romaLines);
      if (Math.abs(oudTotaal - nieuwTotaal) < 0.01 && oudeLines.length === gebouwd.romaLines.length) {
        gelijk++;
        console.log('GELIJK:', d.klant, '(' + d.romaNummer + ') €' + oudTotaal.toFixed(2));
        continue;
      }

      console.log((LIVE ? 'UPDATE' : 'DRY') + ':', d.klant, '(' + d.romaNummer + ') €' + oudTotaal.toFixed(2) + ' → €' + nieuwTotaal.toFixed(2) + ' (vóór 15% actie)');

      if (LIVE) {
        duoDoc.segments.defaultTemplatePriceLineGroup.data.lines = gebouwd.romaLines;
        duoDoc.segments.defaultTemplatePriceLineGroup.data.groupDiscount = { type: 'PERCENTAGE', amount: 15, name: '15% tijdelijke actie', vatPercentage: 21 };
        // Geërfd "Waarom Sonty"-blok (Sunmaster-verkooppraatje) hoort niet in het Roma-document
        for (const [segId, seg] of Object.entries(duoDoc.segments || {})) {
          if (seg?.type === 'text' && typeof seg.data === 'string' && seg.data.includes('Waarom Sonty')) {
            delete duoDoc.segments[segId];
            duoDoc.renderRows = (duoDoc.renderRows || []).filter(r => !r.columns?.some(c => c.elements?.some(el => el.target === segId)));
          }
        }
        const put = await fetch(`${RP}/document-service/v1/${PID}/quotations/${d.romaDocumentId}`, { method: 'PUT', headers: H, body: JSON.stringify(duoDoc) });
        if (!put.ok) { console.log('  FOUT bij PUT: HTTP', put.status); fouten++; continue; }
        const check = (await (await fetch(`${RP}/document-service/v1/${PID}/quotations/${d.romaDocumentId}`, { headers: H })).json()).quotationData;
        const naLines = check?.segments?.defaultTemplatePriceLineGroup?.data?.lines || [];
        if (Math.abs(lineTotaal(naLines) - nieuwTotaal) > 0.01) { console.log('  FOUT: totaal na PUT klopt niet'); fouten++; continue; }
        duoLog[key].herberekendSolar = new Date().toISOString();
        fs.writeFileSync(DUO_FILE, JSON.stringify(duoLog, null, 2));
        bijgewerkt++;
      } else {
        bijgewerkt++;
      }
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      console.log('FOUT:', d.klant, (e.message || '').slice(0, 60)); fouten++;
    }
  }
  console.log('===', LIVE ? 'Bijgewerkt' : 'Te updaten (dry)', ':', bijgewerkt, '| al goed:', gelijk, '| fouten:', fouten);
})();

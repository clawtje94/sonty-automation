#!/usr/bin/env node
// Losse volledige V4-verwerking op één offerte, ZONDER status/mails/links aan te raken.
// Gebruik: node scripts/v4-los-op-offerte.js <documentId | offertenummer-uit-backups>
// Doet exact de v4-offertestappen: prijscorrectie via de tabellen (incl. SunEye XL- en
// Square->ZipDesign-fallbacks), voorraadkorting 20%, verrijking (kleur-annotaties +
// opties-blokken), verkoopteksten, titels bold, herordenen/montage-merge, Waarom Sonty.
// Voorraad-regels behouden hun eigen prijs. Backup vooraf; draai vanuit ~/sonty/scripts.
const fs = require('fs');
const path = require('path');
const CFG = require('/Users/clawdboot/sonty/scripts/ai-ks/config.js');
const { v4 } = require('/Users/clawdboot/sonty/scripts/ai-ks/v4-pricing.js');

const invoer = process.argv[2];
if (!invoer) { console.log('gebruik: node v4-los-op-offerte.js <documentId of offertenummer>'); process.exit(1); }

const rpGet = async (ep) => {
  const r = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY } });
  return r.ok ? r.json() : null;
};
const veld = (d, naam) => (String(d).match(new RegExp(naam + ':\\s*([^\\n]+)')) || [])[1]?.trim() || '';

(async () => {
  // documentId bepalen (uuid direct, of via backup-bestand op offertenummer)
  let docId = invoer;
  if (!/^[0-9a-f-]{36}$/.test(invoer)) {
    const b = JSON.parse(fs.readFileSync(`/Users/clawdboot/sonty/data/offerte-backups/${invoer}.json`, 'utf8'));
    docId = b.documentId;
  }
  const d = await rpGet(`/document-service/v1/${CFG.RP_PID}/quotations/${docId}`);
  const qd = d?.quotationData;
  const plg = qd?.segments?.defaultTemplatePriceLineGroup;
  if (!plg?.data?.lines) { console.log('FOUT: geen prijsregels'); process.exit(1); }
  const nr = qd.quotationNumber;
  fs.writeFileSync(`/Users/clawdboot/sonty/data/offerte-backups/${nr}-losserun-${Date.now()}.json`, JSON.stringify(qd, null, 2));
  console.log(`=== ${nr} (${docId})`);

  let lines = plg.data.lines;
  const heeftTahoma = lines.some((l) => /tahoma/i.test(String(l.description || '')));

  // 1) Voorraadkorting (v4 stap 2a)
  const isVoorraad = lines.some((l) => (String(l.description || '').split('\n')[0].toLowerCase()).includes('voorraad'));
  if (isVoorraad && plg.data.groupDiscount?.amount !== 20) {
    if (!plg.data.groupDiscount) plg.data.groupDiscount = {};
    plg.data.groupDiscount.amount = 20;
    plg.data.groupDiscount.name = '20% korting voorraad scherm';
    console.log('  voorraadkorting -> 20%');
  }

  // 2) Prijscorrectie per productregel (voorraad-regels overslaan)
  for (const l of lines) {
    const desc = String(l.description || '');
    const first = desc.split('\n')[0].replace(/\*\*/g, '');
    if (/montage|windsensor|tahoma/i.test(first)) continue;
    if (first.toLowerCase().includes('voorraad')) { console.log('  voorraad-regel, prijs blijft: €' + l.pricePerUnit); continue; }
    let pKey;
    try { pKey = v4.getProductKey(first + '\n' + desc); } catch { pKey = null; }
    if (!pKey) { console.log('  geen productKey:', first.slice(0, 45)); continue; }
    const b = parseFloat(veld(desc, 'Breedte')) / 10 || null;
    const h = parseFloat(veld(desc, 'Hoogte')) / 10 || null;
    const u = parseFloat(veld(desc, 'Uitval')) / 10 || null;
    const bedStr = (veld(desc, 'Bediening') || '').toLowerCase();
    const bedType = bedStr.includes('afstandsbediening') || bedStr.includes('motor +') ? 'afstandsbediening'
      : bedStr.includes('solar') ? 'solar' : bedStr.includes('draaischakelaar') ? 'draaischakelaar'
      : bedStr.includes('handbediend') || bedStr.includes('slingerstang') ? 'handbediend' : 'afstandsbediening';
    let prijs;
    try { prijs = v4.calculateCorrectPrice(pKey, b, h, u, bedType); } catch { prijs = null; }
    if (!prijs && pKey === 'suneye') {
      try { prijs = v4.calculateCorrectPrice('suneyeXL', b, h, u, bedType); } catch {}
      if (prijs) {
        const delen = l.description.split('\n');
        if (!/xl/i.test(delen[0])) { delen[0] = delen[0].replace(/sun\s*eye/i, (m) => m + ' XL'); l.description = delen.join('\n'); }
        if (!l.description.includes('standaard SunEye gaat tot')) l.description += '\n\nLet op: de standaard SunEye gaat tot 600 cm breedte (en boven de 550 cm alleen met 250 cm uitval). Door de gekozen maat is dit scherm uitgevoerd als SunEye XL (tot 745 cm).';
        pKey = 'suneyeXL';
        console.log('  SunEye buiten bereik -> SunEye XL');
      }
    }
    if (prijs && Math.abs(l.pricePerUnit - prijs) > 1) {
      console.log(`  Prijs gecorrigeerd: €${l.pricePerUnit} -> €${Math.round(prijs * 100) / 100} (${pKey})`);
      l.pricePerUnit = Math.round(prijs * 100) / 100;
    } else if (prijs) {
      console.log(`  Prijs OK: €${l.pricePerUnit} (${pKey})`);
    } else {
      console.log(`  geen tabelprijs (${pKey}) — prijs blijft €${l.pricePerUnit}`);
    }
  }

  // 3) Verrijking + verkoopteksten + bold + herordenen + Waarom Sonty
  for (const l of lines) {
    const first = String(l.description || '').split('\n')[0].replace(/\*\*/g, '');
    if (/\bROMA\b/i.test(first)) continue;
    try { l.description = v4.addV4Enhancements(l.description, first, heeftTahoma, l.pricePerUnit); } catch {}
  }
  try {
    const code = fs.readFileSync('/Users/clawdboot/sonty/scripts/cron-offerte-controle-v4-combined.js', 'utf8');
    const oudCwd = process.cwd(); process.chdir('/Users/clawdboot/sonty/scripts');
    const api = eval(code.slice(0, code.indexOf('async function main(')) + ';({ enhanceAllDescriptions })');
    api.enhanceAllDescriptions(lines);
    process.chdir(oudCwd);
  } catch (e) { console.log('  verkooptekst-stap overgeslagen:', e.message.slice(0, 80)); }
  for (const l of lines) {
    const firstLine = l.description?.split('\n')[0] || '';
    if (!firstLine.startsWith('**') && l.pricePerUnit > 0) l.description = '**' + firstLine.replace(/^\*\*|\*\*$/g, '') + '**' + l.description.substring(firstLine.length);
  }
  try { const res = v4.reorderAndMerge(lines); if (res?.newLines) lines = res.newLines; } catch {}
  try { v4.addWaaromSontyBlock(qd); } catch {}
  lines.forEach((l, i) => { l.position = i; });
  plg.data.lines = lines;

  const ok = await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${CFG.RP_PID}/quotations/${docId}`, {
    method: 'PUT', headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(qd) });
  console.log('  opgeslagen:', ok.ok);

  const c = await rpGet(`/document-service/v1/${CFG.RP_PID}/quotations/${docId}`);
  const cl = c?.quotationData?.segments?.defaultTemplatePriceLineGroup?.data?.lines || [];
  const prijsRegels = cl.filter((l) => (l.pricePerUnit || 0) > 0);
  const segs = Object.values(c?.quotationData?.segments || {}).filter((s) => s?.type === 'text' && typeof s.data === 'string').map((s) => s.data);
  const disc = c?.quotationData?.segments?.defaultTemplatePriceLineGroup?.data?.groupDiscount?.amount || 0;
  const totaal = cl.reduce((s, l) => s + (l.units || 1) * (l.pricePerUnit || 0), 0);
  console.log('  VERIFY — bold:', prijsRegels.every((l) => String(l.description || '').startsWith('**')), '| Waarom Sonty:', segs.some((t) => t.includes('Waarom Sonty')), '| korting:', disc + '%');
  cl.forEach((l) => console.log('   ', (l.units || 1) + 'x', String(l.description || '').split('\n')[0].slice(0, 55), '| €' + l.pricePerUnit));
  console.log(`  totaal: €${totaal.toFixed(2)} | met ${disc}%: €${(totaal * (1 - disc / 100)).toFixed(2)}`);
})().catch((e) => { console.log('FOUT:', e.message); process.exit(1); });

#!/usr/bin/env node
/**
 * V4 Self-Check Daemon
 * Draait 30 min na elke V4 run (10:00, 13:30, 17:30)
 *
 * Checkt:
 * 1. Items die nog in OC staan (V4 had ze moeten verwerken)
 * 2. Self-check failures in de laatste V4 log
 * 3. Probeert stuck items opnieuw te verwerken
 * 4. Rapporteert via Telegram
 */

const fs = require('fs');
const path = require('path');

const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BACKLOG_ID = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const OC_STATUS = '64788881-632c-4217-8f56-d20732c94b08';
const GECONTROLEERD = 'c860c5ae-7eef-45cc-8e79-3b4bcd285b7a';
const GORDIJNEN_STATUS = '7286b1fb-bca1-4772-a993-373f957b3b61';
const HANDMATIG = '6221c9fd-c835-45dc-a494-f81e40a8e184';

const LOG_FILE = path.join(__dirname, '../logs/v4.log');
const SELFCHECK_LOG = path.join(__dirname, '../logs/v4-selfcheck.log');

function log(msg) {
  const line = '[' + new Date().toISOString().substring(11, 19) + '] ' + msg;
  console.log(line);
  fs.appendFileSync(SELFCHECK_LOG, line + '\n');
}

async function sendTelegram(text) {
  await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: 1700128390, text: text.substring(0, 4000) }),
  }).catch(() => {});
}

async function rpGet(ep) {
  const res = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: { 'Authorization': 'Bearer ' + RP_API_KEY } });
  // THROW bij API-fout i.p.v. null: anders lijkt "0 stuck items" op succes terwijl de RP API down is.
  // De crash-handler onderaan stuurt dan een Telegram-alert.
  if (!res.ok) throw new Error('RP API ' + res.status + ' op ' + ep.split('?')[0]);
  try { return await res.json(); } catch { throw new Error('RP API gaf ongeldige JSON op ' + ep.split('?')[0]); }
}

async function rpPut(ep, body) {
  const res = await fetch('https://backend.reuzenpanda.nl' + ep, {
    method: 'PUT', headers: { 'Authorization': 'Bearer ' + RP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function rpPatch(ep, body) {
  const res = await fetch('https://backend.reuzenpanda.nl' + ep, {
    method: 'PATCH', headers: { 'Authorization': 'Bearer ' + RP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function setStatus(itemId, statusId) {
  return rpPatch('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items/' + itemId, { item: { status_id: statusId } });
}

async function getDocForItem(lcId) {
  // Per-item fetch: één kapot item mag de run niet afbreken — log en ga door.
  let data;
  try { data = await rpGet('/document-service/v1/' + PID + '/quotations?lead_configuration_id=' + lcId); }
  catch (e) { log('WARN: ' + e.message); return null; }
  const docs = data?.quotationDatas || [];
  docs.sort((a, b) => (b.quotationCreationTimestamp || 0) - (a.quotationCreationTimestamp || 0));
  return docs[0] || null;
}

async function getFullDoc(docId) {
  let data;
  try { data = await rpGet('/document-service/v1/' + PID + '/quotations/' + docId); }
  catch (e) { log('WARN: ' + e.message); return null; }
  return data?.quotationData || data;
}

// ============ SELF-CHECK REPAIR ============

function diagnoseAndFix(origLines, newLines) {
  // Diagnose: wat is er mis en kan het gefixt worden?
  const issues = [];
  const fixes = [];

  const isTahoma = l => (l.description?.split('\n')[0] || '').toLowerCase().includes('tahoma');
  const isMontage = l => {
    const d = (l.description?.split('\n')[0] || '').toLowerCase();
    return d.includes('montage') || d.includes('inmeten');
  };
  const isProduct = l => !isTahoma(l) && !isMontage(l) && l.pricePerUnit > 0;

  const origProducts = origLines.filter(isProduct).length;
  const newProducts = newLines.filter(isProduct).length;

  // Check 1: product count
  if (origProducts !== newProducts) {
    issues.push('producten: ' + origProducts + ' → ' + newProducts);
    // Niet automatisch fixbaar — product verdwenen of toegevoegd
    return { issues, fixable: false, fixedLines: null };
  }

  // Check 2: units mismatch (excl Tahoma)
  const origUnits = origLines.filter(l => !isTahoma(l)).reduce((s, l) => s + l.units, 0);
  const newUnits = newLines.filter(l => !isTahoma(l)).reduce((s, l) => s + l.units, 0);
  if (origUnits !== newUnits) {
    issues.push('units (excl tahoma): ' + origUnits + ' → ' + newUnits);
    // Check of het verschil door montage-merge komt
    const origMontage = origLines.filter(isMontage);
    const newMontage = newLines.filter(isMontage);
    if (origMontage.length > newMontage.length) {
      // Montage lijnen samengevoegd — units moeten kloppen via units veld
      const origMontageUnits = origMontage.reduce((s, l) => s + l.units, 0);
      const newMontageUnits = newMontage.reduce((s, l) => s + l.units, 0);
      if (origMontageUnits === newMontageUnits) {
        issues.push('(montage merge OK, units kloppen)');
      }
    }
    return { issues, fixable: false, fixedLines: null };
  }

  // Check 3: Tahoma duplicaten
  const tahomaCount = newLines.filter(isTahoma).length;
  if (tahomaCount > 1) {
    issues.push('tahoma duplicaat: ' + tahomaCount + 'x');
    // Fix: dedup Tahoma naar 1 met units=1
    const fixed = newLines.filter(l => !isTahoma(l));
    const firstTahoma = newLines.find(isTahoma);
    if (firstTahoma) fixed.push({ ...firstTahoma, units: 1 });
    fixes.push('tahoma gedesupt naar 1');
    return { issues, fixable: true, fixedLines: fixed, fixes };
  }

  // Geen bekende issues
  return { issues: [], fixable: true, fixedLines: newLines, fixes: [] };
}

// ============ MAIN ============

async function main() {
  log('=== V4 Self-Check start ===');

  const sevenDaysAgo = Date.now() - 7 * 86400000;

  // 1. Check welke items nog in OC staan (V4 had ze moeten verwerken)
  const itemsData = await rpGet('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items');
  const allItems = itemsData?.items || [];
  const stuckItems = allItems.filter(i =>
    i.status_id === OC_STATUS && i.timestamp_created > sevenDaysAgo &&
    !i.technical_labels?.some(l => l.type === 'ITEM_ARCHIVED')
  );

  log('Items nog in OC: ' + stuckItems.length);

  if (stuckItems.length === 0) {
    log('Alles verwerkt, geen stuck items.');
    return;
  }

  // 2. Per stuck item: analyseer waarom V4 het niet kon verwerken
  let fixed = 0, reported = 0;
  const report = [];

  for (const item of stuckItems) {
    const lcId = item.item_subject?.id;
    if (!lcId) continue;

    const desc = item.description || '';
    const descLower = desc.toLowerCase();

    // Check: gordijnen/behang/plissé met lege offerte
    const isGordijn = descLower.includes('gordijn') || (descLower.includes('pliss') && !descLower.includes('zip')) || descLower.includes('behang');

    const docInfo = await getDocForItem(lcId);
    if (!docInfo) continue;

    const fullData = await getFullDoc(docInfo.documentId);
    if (!fullData) continue;

    const plg = fullData.segments?.defaultTemplatePriceLineGroup;
    const lines = plg?.data?.lines || [];

    // Lege offerte met gordijnen → naar Gordijnen status
    if (isGordijn && lines.length <= 1 && (!lines[0] || !lines[0].pricePerUnit)) {
      await setStatus(item.id, GORDIJNEN_STATUS);
      log('FIX: ' + item.summary + ' (#' + docInfo.quotationNumber + ') → Gordijnen (lege offerte met gordijnen/behang/plissé)');
      report.push('✅ ' + item.summary + ' → Gordijnen');
      fixed++;
      continue;
    }

    // Lege offerte zonder specifiek product → handmatig
    if (lines.length === 0 || (lines.length === 1 && !lines[0].pricePerUnit)) {
      await setStatus(item.id, HANDMATIG);
      log('FIX: ' + item.summary + ' (#' + docInfo.quotationNumber + ') → Handmatig (lege offerte)');
      report.push('✅ ' + item.summary + ' → Handmatig (leeg)');
      fixed++;
      continue;
    }

    // Check v4 log voor self-check fail op dit nummer
    let failReason = '';
    try {
      const logContent = fs.readFileSync(LOG_FILE, 'utf8');
      const failMatch = logContent.match(new RegExp('SELF-CHECK FAIL #' + docInfo.quotationNumber + '[^\\n]*'));
      if (failMatch) failReason = failMatch[0];
    } catch {}

    if (failReason) {
      log('Stuck: ' + item.summary + ' (#' + docInfo.quotationNumber + ') — ' + failReason);
      report.push('⚠️ ' + item.summary + ' (#' + docInfo.quotationNumber + '): ' + failReason);
      reported++;
    } else {
      log('Stuck: ' + item.summary + ' (#' + docInfo.quotationNumber + ') — geen bekende reden');
      report.push('❓ ' + item.summary + ' (#' + docInfo.quotationNumber + '): onbekende reden');
      reported++;
    }
  }

  // 3. Telegram rapportage
  if (fixed > 0 || reported > 0) {
    let msg = '🔧 V4 Self-Check: ' + fixed + ' gefixt, ' + reported + ' open\n\n' + report.join('\n');
    await sendTelegram(msg);
  }

  log('Klaar: ' + fixed + ' gefixt, ' + reported + ' gerapporteerd');
}

main().catch(async (e) => {
  log('CRASH: ' + e.message);
  await sendTelegram('🚨 V4 Self-check daemon gecrasht: ' + e.message);
  process.exit(1);
});

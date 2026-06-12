#!/usr/bin/env node
// EENMALIG (13 juni 2026, 10:00): alle Gecontroleerd items → Offerte verstuurd
// Na afloop schakelt dit script zichzelf uit (plist verwijderen + bootout)

const { execSync } = require('child_process');
const fs = require('fs');

const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BACKLOG_ID = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const GECONTROLEERD = 'c860c5ae-7eef-45cc-8e79-3b4bcd285b7a';
const OV = '15c4f0be-c6bf-447d-bf5f-a233c482eb53';
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const PLIST = '/Users/clawdboot/Library/LaunchAgents/nl.sonty.oneshot-gc-naar-ov.plist';

async function fetchRetry(url, options, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try { return await fetch(url, options); }
    catch (e) { if (i === tries) throw e; await new Promise(r => setTimeout(r, i * 5000)); }
  }
}

async function sendTelegram(text) {
  await fetchRetry('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: 1700128390, text: text.substring(0, 4000) }),
  }).catch(() => {});
}

async function main() {
  console.log('[' + new Date().toISOString().substring(11, 19) + '] Eenmalig: Gecontroleerd → Offerte verstuurd');

  const res = await fetchRetry('https://backend.reuzenpanda.nl/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items', {
    headers: { 'Authorization': 'Bearer ' + RP_API_KEY }
  });
  const data = await res.json();
  const gcItems = (data?.items || []).filter(i =>
    i.status_id === GECONTROLEERD && !i.technical_labels?.some(l => l.type === 'ITEM_ARCHIVED')
  );

  let ok = 0, fail = 0;
  const names = [];
  for (const item of gcItems) {
    const p = await fetchRetry('https://backend.reuzenpanda.nl/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items/' + item.id, {
      method: 'PATCH', headers: { 'Authorization': 'Bearer ' + RP_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { status_id: OV } }),
    });
    if (p.ok) { ok++; names.push(item.summary); }
    else fail++;
  }

  console.log(ok + '/' + gcItems.length + ' verplaatst');
  await sendTelegram('Gecontroleerd → Offerte verstuurd: ' + ok + '/' + gcItems.length + ' verplaatst' + (fail ? ' (' + fail + ' mislukt!)' : '') + '\n\n' + names.join('\n'));

  // Zichzelf uitschakelen (eenmalige taak)
  try {
    if (fs.existsSync(PLIST)) fs.unlinkSync(PLIST);
    execSync('launchctl bootout gui/501/nl.sonty.oneshot-gc-naar-ov 2>/dev/null &');
  } catch {}
}

main().catch(async (e) => {
  console.error(e);
  await sendTelegram('Eenmalige GC→OV taak MISLUKT: ' + e.message);
  process.exit(1);
});

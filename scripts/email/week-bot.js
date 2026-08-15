#!/usr/bin/env node
/**
 * WEKELIJKSE MAILMARKETING-BOT (masterplan stap 5, Daimy's /goal 13-08).
 *
 * Elke maandagochtend: meet Klaviyo (per flow-mail en campagne), legt het naast de
 * benchmarks en de conversiesheet, bewaakt de gezondheid (spam/afmeldingen) en stuurt
 * één kort weekbericht naar Daimy op Telegram. VERSTUURT NOOIT IETS NAAR KLANTEN;
 * wijzigingen aan flows of mails gebeuren pas na akkoord van Daimy.
 *
 * Gebruik: node scripts/email/week-bot.js [--dry]   (--dry = printen, niet naar Telegram)
 */
const path = require('path');
const { execFileSync } = require('child_process');

const DRY = process.argv.includes('--dry');
// Benchmarks uit email-marketing/KENNISBANK.md (health & beauty / lead-gen, 2026)
const BENCH = { flowClick: 4.6, campClick: 1.2, spamMax: 0.1, unsubMax: 0.3 };

function pct(v) { return v == null ? '?' : (v * 100).toFixed(2).replace('.', ',') + '%'; }

(async () => {
  const raw = execFileSync(process.execPath,
    [path.join(__dirname, '..', '..', 'email-marketing', 'scripts', 'klaviyo-week-rapport.js'), '7', '--json'],
    { timeout: 10 * 60000 }).toString().trim().split('\n').pop();
  const d = JSON.parse(raw);

  const regels = ['MAILMARKETING WEEKRAPPORT'];

  if (!d.flows.length && !d.campagnes.length) {
    regels.push('Afgelopen 7 dagen is er niets verstuurd (flows staan uit, geen campagnes).');
  }

  // Gezondheid eerst: dit zijn de alarmen waarop we direct moeten dempen.
  const alarmen = [];
  for (const r of [...d.flows, ...d.campagnes]) {
    if ((r.spam_complaint_rate || 0) * 100 > BENCH.spamMax) alarmen.push(`spam ${pct(r.spam_complaint_rate)} bij ${r.naam}`);
    if ((r.unsubscribe_rate || 0) * 100 > BENCH.unsubMax) alarmen.push(`afmeldingen ${pct(r.unsubscribe_rate)} bij ${r.naam}`);
  }
  if (alarmen.length) regels.push('ALARM (boven de gezondheidsgrens):\n' + alarmen.slice(0, 5).map((a) => '• ' + a).join('\n'));

  if (d.flows.length) {
    const top = d.flows.slice(0, 3);
    regels.push('Flows (top op omzet):\n' + top.map((r) =>
      `• ${r.naam}: ${r.recipients} mails, click ${pct(r.click_rate)}${r.conversion_value != null ? `, omzet €${Math.round(r.conversion_value)}` : ''}`).join('\n'));
    const zwak = d.flows.filter((r) => r.recipients >= 30 && (r.click_rate || 0) * 100 < BENCH.flowClick);
    if (zwak.length) regels.push('Onder de benchmark (flow-click hoort boven de 4,6%):\n' + zwak.slice(0, 3).map((r) =>
      `• ${r.naam}: click ${pct(r.click_rate)} — voorstel: onderwerpregel of eerste blok herschrijven`).join('\n'));
  }

  if (d.campagnes.length) {
    regels.push('Campagnes:\n' + d.campagnes.slice(0, 3).map((r) =>
      `• ${r.naam}: ${r.recipients} mails, click ${pct(r.click_rate)} (benchmark 1,2%)`).join('\n'));
  }

  // Conversie uit DE bron die Daimy als juist heeft aangewezen (sheet, per maandtab).
  try {
    const uit = execFileSync(process.execPath,
      [path.join(__dirname, '..', 'conversie-week-sheet.js'), '--maanden', '1'],
      { timeout: 5 * 60000 }).toString();
    const w = uit.trim().split('\n').filter((r) => /^\d{4}-W/.test(r)).slice(-2);
    if (w.length) regels.push('Conversie (sheet, methode Daimy):\n' + w.join('\n'));
  } catch { regels.push('Conversieblok niet beschikbaar deze week.'); }

  regels.push('Wil je dat ik iets aanpas of bijbouw: zeg het, ik bouw niets zonder akkoord.');
  const bericht = regels.join('\n\n');

  if (DRY) { console.log(bericht); return; }
  const { TELEGRAM } = (() => { try { return require('../secrets.js'); } catch { return {}; } })();
  const token = (TELEGRAM && TELEGRAM.token) || '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
  const chat = (TELEGRAM && TELEGRAM.chatId) || 1700128390;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: bericht }),
  });
  console.log('weekrapport verstuurd:', r.ok);
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });

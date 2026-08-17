#!/usr/bin/env node
/**
 * FOTOKEUZES AUTOMATISCH DOORZETTEN NAAR KLAVIYO (Daimy 17-08: "als ik in het dashboard
 * de foto's aanpas, past die ze niet aan in Klaviyo?").
 *
 * Draait elk kwartier (launchd nl.sonty.fotokeuzes-sync). Eén goedkope API-call haalt de
 * keuzes op; alleen als ze veranderd zijn draait de hele keten: gekozen foto's als JPEG
 * naar de Klaviyo-CDN, templates opnieuw bouwen, stijlcontrole (poort: bij een fout gaat
 * er niets naar Klaviyo), preview-htmls verversen en de sjablonen in Klaviyo bijwerken.
 * VERSTUURT NIETS: sjablonen zijn ontwerpen. Meldt het resultaat op Telegram.
 *
 * De "Bekijk mail"-previews op de website verversen pas bij de eerstvolgende site-deploy;
 * de fotokiezer zelf toont de gekozen foto altijd direct.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ADMIN_PASSWORD } = require('../secrets.js');

const DOEL = path.join(__dirname, '..', '..', 'data', 'email', 'foto-keuzes.json');

async function telegram(tekst) {
  try {
    await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendMessage', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: 1700128390, text: tekst }),
    });
  } catch { /* melding is best-effort */ }
}

(async () => {
  // Stap 0: nieuwe dashboard-uploads beoordelen (AI-voorstel, Daimy akkordeert in de UI)
  try { execFileSync(process.execPath, [path.join(__dirname, 'upload-triage.js')], { stdio: 'inherit', timeout: 10 * 60000 }); }
  catch (e) { console.error('triage overgeslagen:', String(e.message).slice(0, 60)); }

  const r = await fetch('https://sonty-website.vercel.app/api/admin/mailfotos', {
    headers: { Authorization: 'Bearer ' + ADMIN_PASSWORD },
  });
  if (!r.ok) { console.error('keuzes ophalen mislukt:', r.status); process.exit(1); }
  const { keuzes } = await r.json();
  const nieuw = JSON.stringify(keuzes || {}, null, 1);
  const oud = fs.existsSync(DOEL) ? fs.readFileSync(DOEL, 'utf8') : '';
  if (nieuw === oud) { console.log('geen wijziging'); return; }

  console.log('fotokeuzes gewijzigd, keten draait');
  fs.writeFileSync(DOEL, nieuw);
  try {
    for (const [script, args] of [
      ['fotos-uploaden.js', []],
      ['bouw-templates.js', []],
      ['stijlcheck.js', []],
      ['controle-beeld.js', []],
      ['preview.js', ['--alleen-html']],
      ['export-mailpreviews.js', []],
      ['klaviyo-sync.js', ['--doe-het']],
    ]) {
      console.log('--- ' + script);
      execFileSync(process.execPath, [path.join(__dirname, script), ...args], { stdio: 'inherit', timeout: 15 * 60000 });
    }
    const aantal = Object.values(keuzes || {}).reduce((n, s) => n + Object.keys(s).length, 0);
    await telegram(`📸 Fotokeuzes uit het dashboard verwerkt: ${aantal} eigen keuze(s) actief. De mails in Klaviyo zijn bijgewerkt met jouw foto's. Er is niets verstuurd.`);
  } catch (e) {
    // Keuzes terugdraaien zodat de volgende run het opnieuw probeert
    fs.writeFileSync(DOEL, oud || '{}');
    await telegram(`⚠️ Fotokeuzes verwerken mislukt (${String(e.message).slice(0, 80)}). Ik probeer het volgende kwartier opnieuw; jouw keuzes in het dashboard blijven bewaard.`);
    process.exit(1);
  }
})();

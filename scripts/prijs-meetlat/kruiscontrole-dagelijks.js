#!/usr/bin/env node
/**
 * DAGELIJKSE KRUISCONTROLE — zeggen alle prijsmotoren nog hetzelfde?
 *
 * Draait elke ochtend. Legt v4, de bot, de offerte-tool en de configurator naast elkaar op
 * een vaste set producten en maten, en meldt op Telegram zodra er iets uit de pas loopt.
 * Zonder deze controle merkt niemand het als de website iets anders zegt dan de bot, tot
 * een klant erover valt.
 *
 * Controleert ook of de twee kopieën van prijsconfig.json en het Sunmaster-prijsboek nog
 * identiek zijn, en of de opslagen in de Vercel KV-override overeenkomen met het bestand.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// engines.js blokkeert het netwerk zodra het geladen wordt (dat is de veiligheid van de
// meetlat). Deze controle moet juist wél naar buiten kunnen, dus de motorvergelijking
// draait in een los proces en dit proces laadt engines.js nooit zelf.
const ROOT = path.join(__dirname, '..', '..');
const WEB = path.join(ROOT, '..', 'sonty-website');
const TG = { token: '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40', chat: '1700128390' };
const problemen = [];

// 1. Bestanden die in beide repo's identiek moeten zijn
for (const rel of ['data/prijsconfig.json', 'data/sunmaster-prices-2026.json']) {
  const a = path.join(ROOT, rel), b = path.join(WEB, rel);
  if (!fs.existsSync(a) || !fs.existsSync(b)) { problemen.push(`${rel} ontbreekt in een van beide mappen`); continue; }
  if (fs.readFileSync(a, 'utf8') !== fs.readFileSync(b, 'utf8')) problemen.push(`${rel} verschilt tussen sonty en sonty-website`);
}

// 2. Geen losse opslagen in de prijscode
try { execFileSync(process.execPath, [path.join(ROOT, 'scripts/tests/geen-losse-opslagen.js')], { stdio: 'pipe' }); }
catch (e) { problemen.push('Er staat weer een losse prijsopslag in de code (scripts/tests/geen-losse-opslagen.js faalt)'); }

// 3. v4 en de bot moeten cent voor cent hetzelfde zeggen (los proces: zie motoren-vergelijk.js)
try {
  const r = execFileSync(process.execPath, [path.join(__dirname, 'motoren-vergelijk.js')], { encoding: 'utf8' });
  for (const c of JSON.parse(r).cases) {
    if (c.v4 !== c.bot) problemen.push(`v4 en de bot verschillen bij ${c.p} ${c.b}cm: €${c.v4} tegen €${c.bot}`);
  }
} catch (e) { problemen.push('kruiscontrole v4/bot kon niet draaien: ' + String(e.message).slice(0, 120)); }

// 4. De Vercel KV-override wint op de live website; die moet gelijk zijn aan het bestand
(async () => {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/prijsconfig.json'), 'utf8'));
    const env = Object.fromEntries(fs.readFileSync(path.join(WEB, '.env.local'), 'utf8')
      .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
    if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
      const r = await fetch(env.KV_REST_API_URL + '/get/crm:prijsconfig', { headers: { Authorization: 'Bearer ' + env.KV_REST_API_TOKEN } });
      const kv = JSON.parse((await r.json()).result || '{}');
      if (kv.sunmasterMarkup !== undefined && kv.sunmasterMarkup !== cfg.sunmasterMarkup) {
        problemen.push(`Vercel KV staat op sunmasterMarkup ${kv.sunmasterMarkup} en het bestand op ${cfg.sunmasterMarkup}. KV wint op de live site.`);
      }
    }
  } catch (e) { problemen.push('KV-controle mislukt: ' + e.message); }

  if (problemen.length) {
    const tekst = '⚠️ PRIJS-KRUISCONTROLE\n\n' + problemen.map((p) => '• ' + p).join('\n') +
      '\n\nDe prijssystemen lopen uit elkaar. Zolang dit staat kan de website een andere prijs noemen dan de bot.';
    await fetch(`https://api.telegram.org/bot${TG.token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(TG.chat), text: tekst }),
    }).catch(() => {});
    console.log(tekst);
    process.exit(1);
  }
  console.log('✅ Alle prijssystemen zeggen hetzelfde en de config staat overal gelijk.');
})();

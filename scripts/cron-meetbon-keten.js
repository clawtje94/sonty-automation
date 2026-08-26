// Meetbon-keten: elke 5 min kijken of een klant de (via de meetbon-app bijgewerkte)
// Gripp-offerte heeft getekend. Zo ja, dan maakt de website direct de aanbetalingsfactuur
// van 40% (definitief in Gripp) en mailt die. Dit script roept alleen het endpoint aan en
// meldt de uitkomst op Telegram; de logica zit in sonty-website/lib/meetbon/keten.ts.
// launchd: nl.sonty.meetbon-keten (StartInterval 300). Kill: data/kill/nl.sonty.meetbon-keten
const fs = require('fs');
const path = require('path');
const SECRETS = require('/Users/clawdboot/sonty/scripts/secrets.js');

const API = 'https://sonty-website.vercel.app/api/meetbon/keten';
const STATE = path.join(__dirname, '..', 'data', 'meetbon-keten-state.json');
const KILL = path.join(__dirname, '..', 'data', 'kill', 'nl.sonty.meetbon-keten');

const telegram = (t) => fetch(`https://api.telegram.org/bot${SECRETS.TELEGRAM_BOT_TOKEN}/sendMessage`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: SECRETS.TELEGRAM_CHAT_ID, text: t.slice(0, 3900) }),
}).catch(() => {});

async function main() {
  if (fs.existsSync(KILL)) { console.log('kill-switch aanwezig, niets gedaan'); return; }
  let state = { gemeld: {}, foutGemeld: {} };
  try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE, 'utf8')) }; } catch { /* eerste run */ }

  const r = await fetch(API, { method: 'POST', headers: { Authorization: 'Bearer ' + SECRETS.ADMIN_PASSWORD } }).catch((e) => ({ ok: false, status: e.message }));
  if (!r.ok) { console.log(new Date().toISOString(), 'API-fout', r.status); return; }
  const d = await r.json();
  console.log(new Date().toISOString(), `gecontroleerd ${d.gecontroleerd}, getekend ${d.getekend.length}, fouten ${d.fouten.length}`);

  for (const g of d.getekend) {
    const key = `${g.gripp}:${g.factuur || ''}:${g.gemaild || ''}`;
    if (g.gemaild && !state.gemeld[key]) {
      state.gemeld[key] = new Date().toISOString();
      await telegram(`✍️ Offerte ${g.gripp} is getekend. Aanbetalingsfactuur ${g.factuur} (40%) staat definitief in Gripp en is gemaild naar ${g.gemaild}. Zodra hij betaald is gaat de meetbon automatisch naar bestellen.`);
    }
  }
  for (const f of d.fouten) {
    const dag = new Date().toISOString().slice(0, 10);
    const key = `${f.gripp}:${dag}`;
    if (!state.foutGemeld[key]) {
      state.foutGemeld[key] = new Date().toISOString();
      await telegram(`⚠️ Meetbon-keten ${f.gripp}: ${f.fout}\nDe factuur staat (als hij gemaakt is) in Gripp; de klant heeft hem mogelijk NIET ontvangen. Even checken. (1x per dag gemeld)`);
    }
  }
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
}

main().catch((e) => console.log('FOUT', e.message));

#!/usr/bin/env node
// Uptime-wacht voor de website (elke 5 min via launchd nl.sonty.site-wacht).
// Vóór de domeinswitch: alleen sonty-website.vercel.app moet 200 geven. Zodra data/.site-wacht-sonty-nl bestaat
// (zetten op de switchdag) moet ook https://sonty.nl 200 geven én door Vercel geserveerd worden (header server: Vercel).
// Alarm op Telegram (hoofdchat) bij afwijking, max 1x per 30 min per doel; herstelmelding zodra het weer goed is.
const fs = require('fs'); const path = require('path');
const DATA = path.join(__dirname, '..', 'data'); const STAND = path.join(DATA, 'site-wacht.json');
const VLAG = path.join(DATA, '.site-wacht-sonty-nl');
async function check(url, moetVercel) {
  try { const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'sonty-site-wacht' } });
    const server = r.headers.get('server') || ''; const ok = r.status === 200 && (!moetVercel || /vercel/i.test(server));
    return { url, status: r.status, server, ok, reden: ok ? '' : (r.status !== 200 ? 'status ' + r.status : 'niet via Vercel (server: ' + server + ')') };
  } catch (e) { return { url, status: 0, server: '', ok: false, reden: String(e).slice(0, 80) }; }
}
async function telegram(t) { try { const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const tok = /TELEGRAM_BOT_TOKEN=(.+)/.exec(env)[1].trim(); const chat = /TELEGRAM_CHAT_ID=(.+)/.exec(env)[1].trim(); await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text: t }) }); } catch {} }
(async () => {
  const doelen = [{ url: 'https://sonty-website.vercel.app/', vercel: true }];
  if (fs.existsSync(VLAG)) doelen.push({ url: 'https://sonty.nl/', vercel: true }, { url: 'https://sonty.nl/configurator', vercel: true });
  const stand = fs.existsSync(STAND) ? JSON.parse(fs.readFileSync(STAND)) : {};
  const uit = [];
  for (const d of doelen) {
    const r = await check(d.url, d.vercel); uit.push(r);
    const vorige = stand[d.url] || {}; const nu = Date.now();
    if (!r.ok && (!vorige.alarmOp || nu - vorige.alarmOp > 30 * 60e3)) { await telegram(`ALARM website: ${d.url} → ${r.reden}`); vorige.alarmOp = nu; }
    if (r.ok && vorige.alarmOp && !vorige.hersteldGemeld) { await telegram(`Website weer goed: ${d.url} (200 via Vercel)`); vorige.hersteldGemeld = true; }
    if (!r.ok) vorige.hersteldGemeld = false;
    vorige.laatste = { tijd: new Date().toISOString(), ...r }; stand[d.url] = vorige;
  }
  fs.writeFileSync(STAND, JSON.stringify(stand, null, 2));
  console.log('[site-wacht]', uit.map(r => `${r.url} ${r.ok ? 'ok' : 'FOUT ' + r.reden}`).join(' | '));
})();

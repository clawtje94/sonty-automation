#!/usr/bin/env node
// Eenmalige herstel-mail naar de 98 onterecht TE VER-afgewezen klanten (juli 2026).
// Akkoord Daimy 23-07: ondertekening Sunny, offerte wordt doorgeappt, WhatsApp-ons-knop
// ZONDER telefoonnummer (anders gaan mensen bellen). Verstuurt via aanvragen@-kanaal,
// dedupe in data/sorry-mail-verzonden.json, 429-backoff, tempo ~9s per mail.
const fs = require('fs');
const { audit } = require('/Users/clawdboot/sonty/scripts/audit.js');

const TOKEN = fs.readFileSync('/Users/clawdboot/sonty/scripts/ai-ks/.trengo-sonny-token.txt', 'utf8').trim();
const H = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };
const KANAAL = 1363384; // aanvragen@sonty.nl (waar de afwijzing ook vandaan kwam)
const SENT_FILE = '/Users/clawdboot/sonty/data/sorry-mail-verzonden.json';
const ONDERWERP = 'Ons foutje: je valt wél binnen ons werkgebied';
const WA = 'https://wa.me/31850069681?text=' + encodeURIComponent('Hoi Sonty! Ik heb een vraag over mijn offerte.');

const TUSSEN = /^(van|de|den|der|het|ter|ten|te|vd)$/i;
function aanhef(naam) {
  const eerste = String(naam || '').trim().split(/\s+/)[0] || '';
  if (eerste.length >= 3 && !eerste.includes('.') && !TUSSEN.test(eerste) && /^[A-Za-zÀ-ÿ]/.test(eerste)) return 'Hi ' + eerste + ',';
  return 'Hallo,';
}

const mailHtml = (groet) => `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #222; line-height: 1.6; max-width: 560px;">
<p>${groet}</p>
<p>We moeten even iets rechtzetten. Je kreeg onlangs van ons een mail dat jouw locatie buiten ons werkgebied valt. Dat klopte niet: door een foutje met de locatie-instelling in ons nieuwe systeem werd de afstand verkeerd berekend. Sorry daarvoor!</p>
<p>Het goede nieuws: je valt gewoon binnen ons werkgebied en we helpen je graag alsnog. <b>We appen je je offerte gewoon even door</b>, dus houd je WhatsApp in de gaten.</p>
<p>Wil je ons zelf iets vragen of even overleggen? <a href="${WA}" style="color:#FF6B00;"><b>WhatsApp ons</b></a> of mail gewoon terug, dan pakken we het meteen op.</p>
<p>Nogmaals excuses voor de verwarring. We maken het graag goed!</p>
<p>Met vriendelijke groet,<br>Sunny | Sonty</p>
</div>`;

const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
const laadSent = () => { try { return JSON.parse(fs.readFileSync(SENT_FILE, 'utf8')); } catch { return {}; } };

(async () => {
  const lijst = JSON.parse(fs.readFileSync('/Users/clawdboot/sonty/data/tever-hercheck-juli.json', 'utf8')).onterecht;
  const sent = laadSent();
  let ok = 0, fout = 0;
  for (const o of lijst) {
    if (sent[o.email]) continue;
    let klaar = false;
    for (let p = 0; p < 5 && !klaar; p++) {
      const r1 = await fetch('https://app.trengo.com/api/v2/tickets', { method: 'POST', headers: H,
        body: JSON.stringify({ channel_id: KANAAL, contact_identifier: o.email, subject: ONDERWERP }) });
      if (r1.status === 429) { await wacht(45000); continue; }
      if (!r1.ok) { console.log('FOUT ticket', o.email, r1.status); fout++; break; }
      const t = await r1.json();
      const r2 = await fetch(`https://app.trengo.com/api/v2/tickets/${t.id}/messages`, { method: 'POST', headers: H,
        body: JSON.stringify({ message: mailHtml(aanhef(o.naam)), body_type: 'html' }) });
      if (r2.status === 429) { await wacht(45000); continue; }
      if (!r2.ok) { console.log('FOUT message', o.email, r2.status); fout++; break; }
      for (let c = 0; c < 4; c++) {
        const rc = await fetch(`https://app.trengo.com/api/v2/tickets/${t.id}/close`, { method: 'POST', headers: H, body: '{}' }).catch(() => null);
        if (rc && rc.ok) break;
        await wacht(20000);
      }
      sent[o.email] = new Date().toISOString();
      fs.writeFileSync(SENT_FILE, JSON.stringify(sent));
      ok++; klaar = true;
      if (ok % 20 === 0) console.log('voortgang:', ok);
    }
    await wacht(9000);
  }
  console.log(`klaar: ${ok} verstuurd, ${fout} fouten, ${Object.keys(sent).length} totaal in log`);
  audit('tever-herstel', 'sorry-mail-verstuurd', { ok, fout, totaal: Object.keys(sent).length });
})().catch((e) => { console.log('FOUT:', e.message); process.exit(1); });

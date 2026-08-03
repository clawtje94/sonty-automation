#!/usr/bin/env node
/**
 * EINDRAPPORT A/B-test offerte-templates (afspraak Daimy 2026-08-03: op 8 augustus).
 *
 * Verschil met het dagelijkse ab-test-rapport.js: dat meet de afgelopen 24 uur.
 * Dit meet de VOLLEDIGE looptijd, rekent uit of het verschil statistisch standhoudt
 * en geeft een concreet advies (wel of geen winnaar), zodat er een keuze te maken is.
 *
 * Gebruik:
 *   node scripts/ab-test-eindrapport.js          → meet alles + stuurt naar Telegram
 *   node scripts/ab-test-eindrapport.js --dry    → alleen op het scherm
 */
const fs = require('fs');
const path = require('path');
const { getToken } = require('./trengo-api.js');
const CFG = require('./ai-ks/config.js');
const { toewijzingenSinds, TEMPLATES } = require('./ab-template-verdeler.js');

const DRY = process.argv.includes('--dry');
// Ruim genoeg om de hele test te vangen (gestart 26 juli 2026)
const UREN = 24 * 60;
// Reacties hebben tijd nodig: verzendingen van de laatste 3 dagen tellen niet mee,
// anders drukken die de percentages kunstmatig omlaag.
const RIJP_UREN = 72;

async function telegram(tekst) {
  if (DRY) return;
  await fetch(`https://api.telegram.org/bot${CFG.TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CFG.TG_CHAT, text: tekst }),
  }).catch((e) => console.error('telegram:', e.message));
}

/** z-waarde van deze variant tegen alle andere varianten samen. */
function zWaarde(r, n, totR, totN) {
  const ar = totR - r, an = totN - n;
  if (!n || !an) return 0;
  const p = totR / totN;
  const se = Math.sqrt(p * (1 - p) * (1 / n + 1 / an));
  return se ? ((r / n) - (ar / an)) / se : 0;
}

(async () => {
  const sinds = Date.now() - UREN * 3600000;
  const grensRijp = Date.now() - RIJP_UREN * 3600000;
  const toew = toewijzingenSinds(sinds).filter((t) => new Date(t.tijd).getTime() < grensRijp);
  if (!toew.length) { console.log('geen toewijzingen gevonden'); return; }

  const jwt = await getToken();
  const H = { Authorization: 'Bearer ' + jwt };
  const per = {};
  for (const t of TEMPLATES) per[t.naam] = { verstuurd: 0, gereageerd: 0 };

  for (const t of toew) {
    const vak = per[t.naam];
    if (!vak) continue;
    vak.verstuurd++;
    try {
      const zoek = await (await fetch(`https://app.trengo.com/api/v2/tickets?term=${t.telefoon}`, { headers: H })).json();
      const ticket = (zoek.data || [])[0];
      if (!ticket) continue;
      const j = await (await fetch(`https://app.trengo.com/api/v2/tickets/${ticket.id}/messages`, { headers: H })).json();
      const verstuurdOp = new Date(t.tijd).getTime();
      const reacties = (j.data || []).filter((m) => m.type === 'INBOUND' && !m.internal_note
        && new Date(String(m.created_at).replace(' ', 'T') + 'Z').getTime() > verstuurdOp);
      if (reacties.length) vak.gereageerd++;
    } catch { /* overslaan */ }
    await new Promise((s) => setTimeout(s, 130));
  }

  const rijen = Object.entries(per).filter(([, v]) => v.verstuurd > 0)
    .map(([naam, v]) => ({ naam, ...v, pct: v.gereageerd / v.verstuurd }))
    .sort((a, b) => b.pct - a.pct);
  const totR = rijen.reduce((s, r) => s + r.gereageerd, 0);
  const totN = rijen.reduce((s, r) => s + r.verstuurd, 0);

  let uit = 'EINDRAPPORT A/B-test offerte-WhatsApp\n\n';
  uit += `Volledige looptijd. ${totN} offertes verstuurd, ${totR} klanten reageerden = ${(totR / totN * 100).toFixed(1)}%.\n`;
  uit += 'De oude template deed 26,8%.\n\n';

  for (const r of rijen) {
    const z = zWaarde(r.gereageerd, r.verstuurd, totR, totN);
    r.z = z;
    const sd = Math.sqrt((r.pct * (1 - r.pct)) / r.verstuurd);
    r.lo = (r.pct - 1.96 * sd) * 100;
    r.hi = (r.pct + 1.96 * sd) * 100;
    uit += `${r.naam}: ${r.gereageerd} van ${r.verstuurd} = ${(r.pct * 100).toFixed(1)}% (werkelijk tussen ${r.lo.toFixed(0)}% en ${r.hi.toFixed(0)}%)\n`;
  }

  // Advies: bij 4 varianten pas een winnaar aanwijzen boven z = 2,5
  const beste = rijen[0];
  const tweede = rijen[1];
  uit += '\nADVIES: ';
  if (beste && beste.z > 2.5) {
    const winst = tweede ? (beste.pct - tweede.pct) * 100 : 0;
    uit += `zet alles op "${beste.naam}". Die wint met ${(beste.pct * 100).toFixed(1)}% tegen `
      + `${tweede ? (tweede.pct * 100).toFixed(1) + '% voor de nummer 2' : 'de rest'}, `
      + `en dat verschil is groot genoeg om niet op toeval te berusten. `
      + `Op ${totN} offertes zijn dat ruwweg ${Math.round(winst / 100 * totN)} extra reacties.`;
  } else if (beste && beste.z > 1.6) {
    uit += `"${beste.naam}" staat bovenaan met ${(beste.pct * 100).toFixed(1)}%, maar het verschil is nog niet hard `
      + `(de marge overlapt met de andere varianten). Keuze: doorgaan tot ongeveer 150 per variant voor zekerheid, `
      + 'of nu al op deze variant gokken omdat hij consequent bovenaan staat.';
  } else {
    uit += 'geen enkele variant wint aantoonbaar. Kies dan de tekst die je zelf het prettigst vindt, '
      + 'of stop de test en zet alles op één vaste template.';
  }
  uit += '\n\n(Verzendingen van de laatste 3 dagen tellen niet mee: die klanten hebben nog geen tijd gehad om te reageren.)';

  console.log(uit);
  await telegram(uit);
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'ai-ks', 'ab-eindrapport.txt'), uit);
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });

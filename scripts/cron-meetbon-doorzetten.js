#!/usr/bin/env node
// MEETBON-DOORZETTER (keten-sluitstuk, opdracht Daimy 01-08): complete meetbonnen waarvan de
// Gripp-AANBETALINGSFACTUUR betaald is, automatisch als nette bestelmail naar orders@sonty.nl
// sturen en in het systeem op "doorgezet" zetten. Fail-safes:
// - aanbetaling niet gevonden of niet betaald → bon blijft staan (volgende run opnieuw)
// - geen factuur gevonden na 14 dagen compleet → 1x Telegram-melding (handmatig checken)
// - mail versturen mislukt → NIET markeren als doorgezet, Telegram-melding
// Draait elk uur via launchd (nl.sonty.meetbon-doorzetten). Kill: data/kill/nl.sonty.meetbon-doorzetten
const fs = require('fs');
const path = require('path');
const SECRETS = require('/Users/clawdboot/sonty/scripts/secrets.js');

const API = 'https://sonty-website.vercel.app/api/meetbon/doorzetten';
const STATE = path.join(__dirname, '..', 'data', 'meetbon-doorzet-state.json');
const KILL = path.join(__dirname, '..', 'data', 'kill', 'nl.sonty.meetbon-doorzetten');
const LOCK = path.join(__dirname, '..', 'data', '.meetbon-doorzet.lock');

const telegram = (t) => fetch(`https://api.telegram.org/bot${SECRETS.TELEGRAM_BOT_TOKEN}/sendMessage`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: SECRETS.TELEGRAM_CHAT_ID, text: t.slice(0, 3900) }),
}).catch(() => {});

// Outlook-mail via bewaard OWA-token (zelfde infra als planning-mail-daemon)
function owaToken() {
  return fs.readFileSync(path.join(__dirname, '.owa-token.txt'), 'utf8').trim();
}
async function stuurMail(onderwerp, html) {
  const r = await fetch('https://outlook.office.com/api/v2.0/me/sendmail', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + owaToken(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Message: {
        Subject: onderwerp,
        Body: { ContentType: 'HTML', Content: html },
        ToRecipients: [{ EmailAddress: { Address: 'orders@sonty.nl' } }],
      },
      SaveToSentItems: true,
    }),
  });
  return r.ok || r.status === 202;
}

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function meetbonHtml(bon, factuur) {
  const veldLabels = { breedte: 'Breedte', hoogte: 'Hoogte', uitval: 'Uitval' };
  const prod = (p, i) => {
    const rijen = Object.entries(p.waarden || {})
      .filter(([, w]) => w)
      .map(([k, w]) => `<tr><td style="padding:2px 10px 2px 0;color:#666">${esc(veldLabels[k] || k.replace(/_/g, ' '))}</td><td>${esc(w)}</td></tr>`)
      .join('');
    const fotos = (p.fotos || []).map((f, fi) => `<a href="${esc(f)}">foto ${fi + 1}</a>`).join(' · ');
    return `<h3 style="margin:14px 0 4px">${i + 1}. ${esc(p.typeNaam || p.type)} — ${esc(p.plek || 'plek onbekend')} (${p.aantal || 1}×)</h3>
      <table style="font-size:13px;border-collapse:collapse">${rijen}</table>
      ${fotos ? `<p style="font-size:13px">Foto's: ${fotos}</p>` : ''}`;
  };
  const algemeen = Object.entries(bon.algemeen || {})
    .filter(([, w]) => w)
    .map(([k, w]) => `<tr><td style="padding:2px 10px 2px 0;color:#666">${esc(k.replace(/_/g, ' '))}</td><td>${esc(w)}</td></tr>`)
    .join('');
  return `<div style="font-family:Arial,sans-serif;max-width:640px">
    <h2 style="margin:0">MEETBON — klaar om te bestellen</h2>
    <p style="margin:4px 0 12px;color:#444">${esc(bon.klant?.naam)} · ${esc([bon.klant?.adres, bon.klant?.plaats].filter(Boolean).join(', '))}<br>
    Gripp <b>${esc(bon.gripp)}</b> · aanbetaling betaald (factuur ${esc(factuur || '?')}) · ingemeten door ${esc(bon.inmeter || 'onbekend')}</p>
    ${(bon.producten || []).map(prod).join('')}
    <h3 style="margin:16px 0 4px">Situatie ter plaatse</h3>
    <table style="font-size:13px;border-collapse:collapse">${algemeen}</table>
    <p style="font-size:12px;color:#888;margin-top:14px">Volledige bon: https://sonty-website.vercel.app/admin/meetbon/${esc(bon.gripp)}</p>
  </div>`;
}

// VANGNET (Daimy 01-08: "krijgt iemand automatisch de juiste meetbon-link?"): afspraken die
// het team rechtstreeks in Planado aanmaakt hebben geen meetbon-link. Deze stap loopt de
// komende inmeet-opdrachten na: link ontbreekt + Gripp-nr herkenbaar → link toevoegen aan de
// beschrijving; geen Gripp-nr herkenbaar → 1x Telegram zodat het via het dashboard kan.
async function vangnetPlanadoLinks(state) {
  const KEY_PLANADO = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
  const H = { Authorization: 'Bearer ' + KEY_PLANADO, 'Content-Type': 'application/json' };
  const r = await fetch('https://api.planadoapp.com/v2/jobs?limit=100', { headers: H });
  if (!r.ok) { console.log('vangnet: jobs-lijst faalde', r.status); return; }
  const jobs = (await r.json()).jobs || [];
  const nu = Date.now();
  for (const kandidaat of jobs) {
    const gepland = kandidaat.scheduled_at ? Date.parse(kandidaat.scheduled_at) : 0;
    if (!gepland || gepland < nu - 86400000 || gepland > nu + 30 * 86400000) continue;
    // de lijst bevat geen beschrijving; detail ophalen
    const dr = await fetch(`https://api.planadoapp.com/v2/jobs/${kandidaat.uuid}`, { headers: H });
    if (!dr.ok) continue;
    const j = (await dr.json()).job || {};
    const desc = String(j.description || '');
    const isInmeet = /inmeet|inmeten/i.test(desc) || String(j.external_id || '').startsWith('meetbon-');
    if (!isInmeet || desc.includes('/admin/meetbon/')) continue;
    const nr = (desc.match(/gripp\s*#?\s*(\d{3,7})/i) || desc.match(/\((\d{3,7})\)/) || [])[1];
    if (nr) {
      const nieuw = desc + `\n\nMEETBON (invullen op telefoon):\nhttps://sonty-website.vercel.app/admin/meetbon/${nr}`;
      const pr = await fetch(`https://api.planadoapp.com/v2/jobs/${j.uuid}`, { method: 'PATCH', headers: { ...H, 'X-Planado-Notify-Assignees': 'false' }, body: JSON.stringify({ description: nieuw }) });
      console.log(`  vangnet: link toegevoegd aan opdracht #${j.serial_no || j.uuid.slice(0, 8)} (Gripp ${nr}): ${pr.ok ? 'OK' : 'FOUT ' + pr.status}`);
    } else {
      // Keten-boekingen (external_id rp-*) koppelen hun Gripp-nummer ZELF zodra de
      // Gripp-cron de offerte heeft aangemaakt — daar pas over melden als het na
      // 24 uur nog ontbreekt (06-08: melding kwam 2 min na de automatische boeking).
      const eigenKeten = String(j.external_id || '').startsWith('rp-');
      const jobLeeftijdMs = j.created_at ? nu - Date.parse(j.created_at) : Infinity;
      if (eigenKeten && jobLeeftijdMs < 24 * 3600000) continue;
      // Dedup op external_id (stabiel): bij herbouw krijgt een job een nieuwe uuid
      // en kwam dezelfde melding opnieuw (06-08: 15 meldingen op één avond).
      const sleutel = j.external_id || j.uuid;
      state.linkGemeld = state.linkGemeld || {};
      if (state.linkGemeld[sleutel]) continue;
      state.linkGemeld[sleutel] = new Date().toISOString();
      await telegram(`📐 Inmeet-afspraak #${j.serial_no || '?'} (${(desc.split('\n')[0] || 'zonder omschrijving').slice(0, 60)}) heeft geen meetbon-link en ik herken geen Gripp-nummer in de omschrijving. Zet "Gripp <nummer>" in de opdracht-omschrijving of plan via het dashboard, dan koppel ik hem automatisch.`);
    }
  }
}

async function main() {
  if (fs.existsSync(KILL)) { console.log('kill-switch actief'); return; }
  if (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs < 50 * 60 * 1000) { console.log('lock actief'); return; }
  fs.writeFileSync(LOCK, String(process.pid));
  const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { gemeld: {} };
  try {
    await vangnetPlanadoLinks(state).catch((e) => console.log('vangnet-fout:', e.message.slice(0, 80)));
    const r = await fetch(API, { headers: { Authorization: 'Bearer ' + SECRETS.ADMIN_PASSWORD } });
    if (!r.ok) { console.log('API-fout', r.status); return; }
    const { klaar } = await r.json();
    console.log(`${klaar.length} complete meetbon(nen)`);
    for (const { bon, aanbetaling } of klaar) {
      // ADVIES-POORT: "Weet nog niet / advies" is een geldig tussenantwoord voor de
      // inmeter, maar nooit een eindantwoord om op te BESTELLEN. Zo'n bon gaat niet
      // automatisch de bestelketen in; kantoor beslist eerst. Eén melding per bon.
      const adviesPunten = [];
      for (const p of bon.producten || []) {
        for (const [veld, waarde] of Object.entries(p.waarden || {})) {
          if (/weet (nog )?niet|advies/i.test(String(waarde))) adviesPunten.push(`${p.type}: ${veld} = "${waarde}"`);
        }
      }
      if (adviesPunten.length) {
        state.adviesGemeld = state.adviesGemeld || {};
        if (!state.adviesGemeld[bon.gripp]) {
          state.adviesGemeld[bon.gripp] = new Date().toISOString();
          fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
          await telegram(`✋ Meetbon ${bon.gripp} (${bon.klant?.naam || '?'}) is compleet en de aanbetaling is binnen, maar er staat nog "advies/weet nog niet" in:\n- ${adviesPunten.join('\n- ')}\n\nNIET automatisch doorgezet naar bestellen. Kantoor moet eerst de keuze maken; daarna zet ik hem door.`);
        }
        console.log(`  ✋ ${bon.gripp}: adviespunten open, niet doorgezet`);
        continue;
      }
      // Eerder gemeld maar inmiddels opgelost: melding resetten zodat een nieuwe
      // advieswaarde later opnieuw gemeld wordt.
      if (state.adviesGemeld?.[bon.gripp]) { delete state.adviesGemeld[bon.gripp]; fs.writeFileSync(STATE, JSON.stringify(state, null, 2)); }

      const wie = `${bon.klant?.naam || '?'} (Gripp ${bon.gripp})`;
      if (!aanbetaling.gevonden) {
        const dagen = (Date.now() - Date.parse(bon.compleetOp || bon.bijgewerkt)) / 86400000;
        if (dagen > 14 && !state.gemeld[bon.gripp]) {
          state.gemeld[bon.gripp] = new Date().toISOString();
          await telegram(`⚠️ Meetbon ${wie} is al ${Math.round(dagen)} dagen compleet maar ik vind GEEN aanbetalingsfactuur in Gripp (zoek op "Aanbetaling...(${bon.gripp})"). Even handmatig checken.`);
        }
        console.log(`  − ${wie}: geen aanbetalingsfactuur gevonden`);
        continue;
      }
      if (!aanbetaling.betaald) { console.log(`  − ${wie}: aanbetaling nog niet betaald`); continue; }
      // verrijk producttype-naam voor de mail
      try {
        const cfg = { rolluik: 'Rolluik', zipscreen: 'Zipscreen/screen', knikarm: 'Knikarmscherm/SunEye', uitvalscherm: 'Uitvalscherm', markies: 'Markies', pergola: 'Pergola', plissehordeur: 'Plisséhordeur', rolhor: 'Rolhor', vastehor: 'Vaste hor/inklemhor', binnenzonwering: 'Binnenzonwering', gordijnen: 'Gordijnen/vitrage', velux: 'Velux', anders: 'Anders/maatwerk' };
        for (const p of bon.producten || []) p.typeNaam = cfg[p.type] || p.type;
      } catch {}
      const verstuurd = await stuurMail(
        `MEETBON ${bon.gripp} ${bon.klant?.naam || ''} — aanbetaling binnen, klaar om te bestellen`,
        meetbonHtml(bon, aanbetaling.factuur)
      ).catch(() => false);
      if (!verstuurd) {
        await telegram(`⚠️ Meetbon ${wie}: aanbetaling is binnen maar de mail naar orders@ is MISLUKT (OWA-token verlopen?). Bon blijft staan.`);
        console.log(`  ⚠️ ${wie}: mail mislukt`);
        continue;
      }
      const m = await fetch(API, { method: 'POST', headers: { Authorization: 'Bearer ' + SECRETS.ADMIN_PASSWORD, 'Content-Type': 'application/json' }, body: JSON.stringify({ gripp: bon.gripp }) });
      console.log(`  ✓ ${wie}: doorgezet naar orders@ (${m.ok ? 'gemarkeerd' : 'MARKEREN MISLUKT'})`);
      await telegram(`📐➡️🛒 Meetbon ${wie} is doorgezet naar bestellen: aanbetaling betaald (factuur ${aanbetaling.factuur}), bestelmail staat in orders@sonty.nl.`);
    }
  } finally {
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
    fs.unlinkSync(LOCK);
  }
}
main().catch(async (e) => { console.log('FOUT:', e.message); try { fs.unlinkSync(LOCK); } catch {} });

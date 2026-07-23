#!/usr/bin/env node
// VACATUREMAIL-BATCH — verstuurt de wervingsmail (v7 definitief, akkoord Daimy 22-07-2026)
// naar data/vacaturemail-doelgroep.csv in batches van max 150 per run (1 run per dag via
// launchd nl.sonty.vacaturemail). Nieuwste klanten eerst (CSV-volgorde).
// - Verzendt vanaf info@sonty.nl (Trengo-kanaal 1364806), ticket -> toewijzen aan DAIMY -> sluiten,
//   zodat reacties bij Daimy terechtkomen en de bots eraf blijven (guards staan ook in de daemons).
// - State: data/vacaturemail-verzonden.json (nooit dubbel). Kill-switch: data/kill/nl.sonty.vacaturemail.
// - Handtekening zit NIET in de mail: Outlook plakt die er zelf onder (Daimy 22-07).
const fs = require('fs');
const SECRETS = require('/Users/clawdboot/sonty/scripts/secrets.js');
const { audit } = require('/Users/clawdboot/sonty/scripts/audit.js');

const TOKEN = fs.readFileSync('/Users/clawdboot/sonty/scripts/ai-ks/.trengo-sonny-token.txt', 'utf8').trim();
const H = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };
const INFO_KANAAL = 1364806;
const DAIMY_USER = 736327;
const ONDERWERP = 'Ken jij onze nieuwe collega?';
const CSV = '/Users/clawdboot/sonty/data/vacaturemail-doelgroep.csv';
const STATE = '/Users/clawdboot/sonty/data/vacaturemail-verzonden.json';
const KILL = '/Users/clawdboot/sonty/data/kill/nl.sonty.vacaturemail';
const BATCH = 150;
const PAUZE_MS = 15000;

const FORMULIER = 'Hoi Sonty! Ik heb interesse in de vacature.\n\nFunctie: \nNaam: \nWoonplaats: \nErvaring in de zonwering: \nHuidige baan en werkgever: \nWaarom dit me leuk lijkt: \nIk kom via: ';
const WA_INTERESSE = 'https://wa.me/31850069681?text=' + encodeURIComponent(FORMULIER);
const DOORSTUUR = "Hoi! Misschien iets voor jou: Sonty uit Rijswijk (zonwering en raamdecoratie) zoekt nieuwe collega's. Een servicemonteur, monteurs, inmeters en een winkelmedewerker voor de showroom. Interesse? App ze even via " + WA_INTERESSE + ' en zeg dat je via mij komt.';
const WA_DOORSTUREN = 'https://wa.me/?text=' + encodeURIComponent(DOORSTUUR);

const TUSSEN = /^(van|de|den|der|het|ter|ten|te|vd|v\.d\.|el|al|le|la)$/i;
function aanhef(naam, type) {
  if (type === 'Bedrijf') return 'Beste Sonty-klant';
  const delen = String(naam || '').trim().split(/\s+/);
  if (delen.length >= 2 && delen[0].length >= 3 && !TUSSEN.test(delen[0]) && /^[A-ZÀ-Ž]/.test(delen[0])) return 'Beste ' + delen[0];
  return 'Beste Sonty-klant';
}

const mailHtml = (groet) => `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #222; line-height: 1.6; max-width: 560px;">
<p>${groet},</p>
<p>Een tijdje terug mochten wij bij jou thuis aan de slag met zonwering of raamdecoratie. Daar denken we nog steeds met plezier aan terug, want klanten zoals jij zijn de reden dat Sonty groeit. En dat groeien gaat hard. Zo hard dat ons team versterking nodig heeft.</p>
<p>Daarom zoeken we:</p>
<ul>
<li>een <b>servicemonteur</b> (ervaring is een pré)</li>
<li>twee <b>monteurs</b> (minimaal 2 jaar montage-ervaring)</li>
<li>twee <b>inmeters</b> (ervaring is een pré)</li>
<li>een <b>winkelmedewerker</b> voor onze showroom in Rijswijk (woensdag, vrijdag en zaterdag, later mogelijk meer dagen), vooral iemand die ergens een passie voor kan ontwikkelen en klanten blij maakt</li>
</ul>
<p>Voor de technische functies zoeken we mensen die de zonweringbranche al kennen. Voor de showroom hoeft dat niet, daar gaat het ons om de juiste persoon.</p>
<p><b>Ben jij het zelf?</b> Geen sollicitatiegedoe: <a href="${WA_INTERESSE}" style="color:#FF6B00;"><b>WhatsApp ons</b></a>, het berichtje staat al voor je klaar en je vult alleen even je gegevens aan. Ook voor vragen over bijvoorbeeld het salaris kun je ons <a href="${WA_INTERESSE}" style="color:#FF6B00;">even appen</a>, of mail gewoon terug.</p>
<p><b>Ken je iemand?</b> Een buurman met gouden handen, een neef die toe is aan iets nieuws: <a href="${WA_DOORSTUREN}" style="color:#FF6B00;"><b>stuur deze vacature door via WhatsApp</b></a> (ook dat berichtje staat al klaar).</p>
<p>En dat doorsturen maken we graag de moeite waard: komt jouw tip bij ons aan de slag en door de proeftijd, dan krijg jij als bedankje <b>1.000 euro</b> van ons. Zelf houden of delen met degene die je aandraagt, die keuze is helemaal aan jou. Diegene hoeft bij het appen alleen jouw naam even te noemen.</p>
<p style="font-size:12px;color:#999;">Liever geen mail meer van ons? Laat het even weten, dan halen we je van de lijst.</p>
</div>`;

const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
const laadState = () => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; } };

async function verstuur(adres, groet) {
  for (let p = 0; p < 6; p++) {
    const r1 = await fetch('https://app.trengo.com/api/v2/tickets', { method: 'POST', headers: H,
      body: JSON.stringify({ channel_id: INFO_KANAAL, contact_identifier: adres, subject: ONDERWERP }) });
    if (r1.status === 429) { await wacht(60000 + p * 30000); continue; }
    if (!r1.ok) return { ok: false, fout: 'ticket ' + r1.status };
    const t = await r1.json();
    const r2 = await fetch(`https://app.trengo.com/api/v2/tickets/${t.id}/messages`, { method: 'POST', headers: H,
      body: JSON.stringify({ message: mailHtml(groet), body_type: 'html' }) });
    if (r2.status === 429) { await wacht(60000); continue; }
    if (!r2.ok) return { ok: false, fout: 'message ' + r2.status };
    // BEWUST NIET aan Daimy toewijzen bij verzending (Daimy 22-07: "ik krijg van alles wat je
    // verstuurt een toegewezen-mail"). Alleen sluiten — MET retry: een stil mislukte close
    // (429) liet tickets open staan. Toewijzen aan Daimy gebeurt pas bij een ECHT antwoord
    // (vacature-guards in email-daemon.js en daemon.js); de e-maildaemon veegt bovendien
    // open vacature-tickets zonder antwoord alsnog dicht.
    for (let c = 0; c < 5; c++) {
      const rc = await fetch(`https://app.trengo.com/api/v2/tickets/${t.id}/close`, { method: 'POST', headers: H, body: '{}' }).catch(() => null);
      if (rc && rc.ok) break;
      await wacht(30000);
    }
    return { ok: true, ticket: t.id };
  }
  return { ok: false, fout: 'rate-limit bleef' };
}

(async () => {
  // --test: alleen de definitieve versie naar Daimy en Joey, geen klanten
  if (process.argv[2] === '--test') {
    for (const [adres, groet] of [['daimyboot@gmail.com', 'Beste Daimy'], ['joey@sonty.nl', 'Beste Joey']]) {
      const res = await verstuur(adres, groet);
      console.log('test', adres, res.ok ? 'OK ticket ' + res.ticket : 'FOUT ' + res.fout);
      await wacht(5000);
    }
    return;
  }
  if (fs.existsSync(KILL)) { console.log('kill-switch actief, batch overgeslagen'); return; }
  const state = laadState();
  const regels = fs.readFileSync(CSV, 'utf8').trim().split('\n').slice(1).map((r) => r.split(';'));
  const wachtrij = regels.filter((k) => !state[k[1]]);
  if (!wachtrij.length) { console.log('alles verstuurd, klaar'); return; }
  const batch = wachtrij.slice(0, BATCH);
  console.log(`[${new Date().toLocaleString('sv-SE')}] batch start: ${batch.length} van ${wachtrij.length} resterend (totaal ${regels.length})`);
  let ok = 0, fout = 0;
  for (const [naam, email, , type] of batch) {
    if (fs.existsSync(KILL)) { console.log('kill-switch, batch afgebroken'); break; }
    const res = await verstuur(email, aanhef(naam, type));
    if (res.ok) { ok++; state[email] = new Date().toISOString(); fs.writeFileSync(STATE, JSON.stringify(state)); }
    else { fout++; console.log('  FOUT', email, res.fout); }
    if ((ok + fout) % 25 === 0) console.log(`  voortgang: ${ok} ok, ${fout} fout`);
    await wacht(PAUZE_MS);
  }
  const totaalVerstuurd = Object.keys(state).length;
  console.log(`batch klaar: ${ok} verstuurd, ${fout} fouten. Totaal ${totaalVerstuurd}/${regels.length}`);
  audit('vacaturemail', 'batch-verstuurd', { ok, fout, totaal: totaalVerstuurd, van: regels.length });
  await fetch(`https://api.telegram.org/bot${SECRETS.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: SECRETS.TELEGRAM_CHAT_ID, text: `Vacaturemail batch klaar: ${ok} verstuurd${fout ? `, ${fout} fouten` : ''}. Totaal nu ${totaalVerstuurd} van ${regels.length}. Reacties komen bij jou in Trengo binnen (mail en WhatsApp), de bots blijven eraf.` }) }).catch(() => {});
})().catch((e) => { console.log('FOUT:', e.message); process.exit(1); });

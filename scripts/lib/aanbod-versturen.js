// Inmeet-aanbod naar de klant sturen: WhatsApp ÉN e-mail (Daimy 2026-08-05:
// "via mail en via whatsapp zodat we zo veel mogelijk kans hebben dat iemand het ziet").
//
// Kanalen, allebei via bewezen Trengo-routes:
// - WhatsApp: antwoord op het bestaande WA-gesprek van de klant (kanaal 1359857).
//   Kan alleen binnen het 24-uursvenster van WhatsApp Business; daarbuiten geeft
//   Trengo 422 en melden we dat eerlijk (goedgekeurde template is een vervolgstap).
// - E-mail: nieuwe mail vanuit het Aanvragen-kanaal (1363384) — dezelfde route als de
//   te-ver-mails. NOOIT vanaf joey@ (vaste regel).
const fs = require('fs');
const path = require('path');

const TT = fs.readFileSync(path.join(__dirname, '..', '.trengo-api-token.txt'), 'utf8').trim();
const TH = { Authorization: 'Bearer ' + TT, 'Content-Type': 'application/json' };
const WA_KANAAL = 1359857;
const AANVRAGEN_KANAAL = 1363384;

const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

async function tFetch(ep, opties = {}) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch('https://app.trengo.com/api/v2' + ep, { headers: TH, ...opties });
    if (r.status === 429) { await wacht(2000 + i * 1500); continue; }
    return r;
  }
  return { ok: false, status: 429 };
}

/** Meest recente WhatsApp-ticket van dit nummer, of null. */
async function zoekWaTicket(telefoon) {
  const cijfers = String(telefoon || '').replace(/\D/g, '').slice(-9);
  if (cijfers.length < 9) return null;
  const r = await tFetch(`/tickets?term=${cijfers}`);
  if (!r.ok) return null;
  const d = await r.json().catch(() => null);
  const wa = (d?.data || []).filter((t) => t.channel?.id === WA_KANAAL || t.channel?.type === 'WA_BUSINESS');
  wa.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  return wa[0] || null;
}

function berichtTekst(voornaam, url, duurMin) {
  return `Hoi ${voornaam}, goed nieuws: we kunnen bij je langskomen om in te meten (duurt ongeveer ${duurMin} minuten). Kies hier de tijd die jou het beste uitkomt:\n\n${url}\n\nDe tijden staan 24 uur voor je vast. Lukt kiezen niet, stuur dan gewoon een berichtje terug.\n\nGroetjes, Jaimy van Sonty`;
}

async function stuurWhatsApp(aanbod, url) {
  const ticket = await zoekWaTicket(aanbod.lead.telefoon);
  if (!ticket) return { ok: false, reden: 'geen WhatsApp-gesprek gevonden voor dit nummer' };
  const voornaam = (aanbod.lead.naam || 'daar').split(' ')[0];
  const r = await tFetch(`/tickets/${ticket.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message: berichtTekst(voornaam, url, aanbod.duurMin), type: 'OUTBOUND' }),
  });
  if (r.status === 422) return { ok: false, reden: '24-uursvenster dicht (template nodig, nog niet ingericht)', ticket: ticket.id };
  return { ok: r.ok, reden: r.ok ? undefined : `Trengo ${r.status}`, ticket: ticket.id };
}

async function stuurMail(aanbod, url) {
  if (!aanbod.lead.email) return { ok: false, reden: 'geen e-mailadres bij de lead' };
  const voornaam = (aanbod.lead.naam || 'daar').split(' ')[0];
  const r1 = await tFetch('/tickets', {
    method: 'POST',
    body: JSON.stringify({
      channel_id: AANVRAGEN_KANAAL,
      contact_identifier: aanbod.lead.email,
      subject: 'Kies je inmeetmoment bij Sonty',
    }),
  });
  if (!r1.ok) return { ok: false, reden: `ticket aanmaken: Trengo ${r1.status}` };
  const nieuw = await r1.json().catch(() => null);
  if (!nieuw?.id) return { ok: false, reden: 'geen ticket-id terug' };

  const html = `<p>Hoi ${voornaam},</p>
<p>Goed nieuws: we kunnen bij je langskomen om in te meten (duurt ongeveer ${aanbod.duurMin} minuten).</p>
<p><a href="${url}" style="display:inline-block;background:#F97316;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Kies je inmeetmoment</a></p>
<p>De tijden staan 24 uur voor je vast. Lukt kiezen niet, beantwoord dan gewoon deze mail.</p>
<p>Groetjes,<br>Jaimy van Sonty</p>`;
  const r2 = await tFetch(`/tickets/${nieuw.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message: html, body_type: 'html' }),
  });
  if (r2.ok) await tFetch(`/tickets/${nieuw.id}/close`, { method: 'POST', body: '{}' });
  return { ok: r2.ok, reden: r2.ok ? undefined : `mail versturen: Trengo ${r2.status}`, ticket: nieuw.id };
}

/** Beide kanalen; geeft per kanaal terug wat er gebeurd is. Eén kanaal gelukt = aanbod is onderweg. */
async function verstuurAanbod(aanbod, url) {
  const wa = await stuurWhatsApp(aanbod, url).catch((e) => ({ ok: false, reden: e.message }));
  const mail = await stuurMail(aanbod, url).catch((e) => ({ ok: false, reden: e.message }));
  return { wa, mail, ergensGelukt: wa.ok || mail.ok };
}

module.exports = { verstuurAanbod, stuurWhatsApp, stuurMail, zoekWaTicket };

// CLI: node scripts/lib/aanbod-versturen.js <token> — verstuurt een bestaand aanbod.
if (require.main === module) {
  (async () => {
    const token = process.argv[2];
    if (!token) { console.error('gebruik: node aanbod-versturen.js <token>'); process.exit(1); }
    const r = await fetch('https://sonty-website.vercel.app/api/inmeet-aanbod?status=open', {
      headers: { 'x-meet-code': process.env.BELSCHERM_CODE || 'sonty2288' },
    });
    const { aanbiedingen } = await r.json();
    const aanbod = (aanbiedingen || []).find((a) => a.token === token);
    if (!aanbod) { console.error('aanbod niet gevonden of niet meer open'); process.exit(1); }
    const url = `https://sonty-website.vercel.app/inmeten/${token}`;
    const uit = await verstuurAanbod(aanbod, url);
    console.log('WhatsApp:', JSON.stringify(uit.wa));
    console.log('Mail:    ', JSON.stringify(uit.mail));
    process.exit(uit.ergensGelukt ? 0 : 1);
  })();
}

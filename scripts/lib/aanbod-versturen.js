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
const PLANNING_KANAAL_BESTAND = require('path').join(__dirname, '..', '..', 'data', 'planning-kanaal.txt');
let PLANNING_KANAAL_OVERRIDE = null;
try { PLANNING_KANAAL_OVERRIDE = Number(require('fs').readFileSync(PLANNING_KANAAL_BESTAND, 'utf8').trim()) || null; } catch {}
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

function verWegRegel(ver) {
  // Eerlijke uitleg voor klanten buiten de vaste route (Daimy 06-08): scheelt
  // manuren, brandstof en uitstoot — en de klant snapt waarom het iets later kan.
  return ver
    ? ' Je woont wat verder bij ons vandaan; we plannen ritten zo slim mogelijk in en combineren klussen bij jou in de buurt. Dat scheelt onnodige kilometers (en uitstoot), maar daardoor kan het soms iets langer duren voor we bij je zijn.'
    : '';
}

function berichtTekst(voornaam, url, duurMin, geldigUren = 24, ver = false) {
  return `Hoi ${voornaam}, goed nieuws: we kunnen bij je langskomen om in te meten (duurt ongeveer ${duurMin} minuten).${verWegRegel(ver)} Kies hier de tijd die jou het beste uitkomt:\n\n${url}\n\nDe tijden staan ${geldigUren} uur voor je vast. Lukt kiezen niet, stuur dan gewoon een berichtje terug.\n\nGroetjes, Nanny van Sonty`;
}

// Goedgekeurde template "inmeetafspraak_kiezen" (id 243999): voor klanten buiten het
// 24-uursvenster of zonder bestaand WhatsApp-gesprek. Werkt pas na Meta-goedkeuring.
const TEMPLATE_HSM = 243999;

const DAGK = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MNDK = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
function slotTekst(sl) {
  const d = new Date(sl.aankomst);
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${DAGK[d.getDay()]} ${d.getDate()} ${MNDK[d.getMonth()]} om ${t}`;
}

async function stuurWhatsAppTemplate(aanbod, url) {
  const tel = String(aanbod.lead.telefoon || '').replace(/\D/g, '').replace(/^0/, '31');
  if (tel.length < 11) return { ok: false, reden: 'geen bruikbaar telefoonnummer voor template' };
  // Twee templates ZONDER link (Daimy 06-08: "gewoon drukken en klaar"): normaal en
  // ver-weg. ID's in data/wa-templates.json zodra Meta ze goedkeurt; tot die tijd
  // valt de verzending terug op het (oude) 5-variabelen-template of het vrije bericht.
  let ids = {};
  try { ids = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'data', 'wa-templates.json'), 'utf8')); } catch {}
  const slots = aanbod.slots || [];

  // ÉÉN-MOMENT-AANBOD (Daimy 07-08): eigen template met {{1}} voornaam,
  // {{2}} moment, {{3}} duur en knoppen "Dat past" / "Ander moment".
  if (slots.length === 1) {
    const hsm1 = aanbod.ver === true ? (ids.momentVer || ids.moment) : ids.moment;
    if (!hsm1) return { ok: false, reden: '1-moment-template nog niet goedgekeurd/aangemaakt' };
    if (!slots[0]) return { ok: false, reden: 'leeg slot — NIET verstuurd' };
    const p1 = [
      { type: 'body', key: '{{1}}', value: (aanbod.lead.naam || 'daar').split(' ')[0] },
      { type: 'body', key: '{{2}}', value: slotTekst(slots[0]) },
      { type: 'body', key: '{{3}}', value: String(aanbod.duurMin || 30) },
    ];
    let bestaand1 = null;
    try {
      const zoek = await tFetch(`/tickets?term=${tel.slice(-9)}`, { method: 'GET' });
      if (zoek.ok) bestaand1 = (((await zoek.json())?.data || []).find((tk) => tk.channel?.type === 'WA_BUSINESS' && tk.status !== 'CLOSED'))?.id || null;
    } catch { /* dan op nummer */ }
    const body1 = bestaand1
      ? { ticket_id: bestaand1, hsm_id: hsm1, params: p1 }
      : { recipient_phone_number: '+' + tel, hsm_id: hsm1, channel_id: WA_KANAAL, params: p1 };
    const r1 = await tFetch('/wa_sessions', { method: 'POST', body: JSON.stringify(body1) });
    if (!r1.ok) return { ok: false, reden: `moment-template: Trengo ${r1.status}` };
    let ticket1 = bestaand1;
    try { ticket1 = ticket1 || (await r1.json())?.message?.ticket_id || null; } catch {}
    return { ok: true, via: aanbod.ver ? 'moment-template-ver' : 'moment-template', ticket: ticket1 };
  }

  const hsm = aanbod.ver === true ? (ids.ver || ids.normaal) : ids.normaal;
  const basis = [
    { type: 'body', key: '{{1}}', value: (aanbod.lead.naam || 'daar').split(' ')[0] },
    { type: 'body', key: '{{2}}', value: slots[0] ? slotTekst(slots[0]) : '-' },
    { type: 'body', key: '{{3}}', value: slots[1] ? slotTekst(slots[1]) : '-' },
    { type: 'body', key: '{{4}}', value: slots[2] ? slotTekst(slots[2]) : '-' },
  ];
  // NOOIT een template met lege tijden versturen (incident 06-08: 4 klanten kregen
  // streepjes doordat het slots-veld niet was doorgegeven)
  if (basis.slice(1).some((p) => p.value === '-')) {
    return { ok: false, reden: 'lege tijden in het template — NIET verstuurd (slots ontbreken)' };
  }
  const params = hsm ? basis : [...basis, { type: 'body', key: '{{5}}', value: url }];
  // In het BESTAANDE gesprek sturen als dat er is (Daimy 06-08: Carlo's template
  // opende een tweede, naamloos gesprek en was onvindbaar). wa_sessions accepteert
  // ticket_id i.p.v. recipient_phone_number; dan blijft alles in één thread.
  let bestaandTicket = null;
  try {
    const zoek = await tFetch(`/tickets?term=${tel.slice(-9)}`, { method: 'GET' });
    if (zoek.ok) {
      const hit = ((await zoek.json())?.data || []).find(
        (tk) => tk.channel?.type === 'WA_BUSINESS' && tk.status !== 'CLOSED',
      );
      bestaandTicket = hit?.id || null;
    }
  } catch { /* zoeken mislukt: dan gewoon op nummer */ }
  const body = bestaandTicket
    ? { ticket_id: bestaandTicket, hsm_id: hsm || TEMPLATE_HSM, params }
    : { recipient_phone_number: '+' + tel, hsm_id: hsm || TEMPLATE_HSM, channel_id: WA_KANAAL, params };
  const r = await tFetch('/wa_sessions', { method: 'POST', body: JSON.stringify(body) });
  if (!r.ok) return { ok: false, reden: `template: Trengo ${r.status} (nog niet door Meta goedgekeurd?)` };
  // Het ticket-id komt gewoon terug in de respons (message.ticket_id) — vastleggen,
  // want de telefoon-zoektocht van de monitor is niet betrouwbaar voor elk nummer
  // (Hendrik-Jan 06-08: term-search op zijn nummer gaf 0 treffers).
  let ticket = bestaandTicket;
  try { ticket = ticket || (await r.json())?.message?.ticket_id || null; } catch {}
  return { ok: true, via: hsm ? (aanbod.ver ? 'template-ver' : 'template') : 'template (oud)', ticket };
}

async function stuurWhatsApp(aanbod, url) {
  // TEMPLATE EERST (Daimy 06-08: "die gaan we gewoon altijd gebruiken") — werkt ook
  // buiten het 24-uursvenster. Zolang Meta het template nog niet heeft goedgekeurd
  // (PENDING) valt hij automatisch terug op een gewoon bericht in een open gesprek.
  const viaTemplate = await stuurWhatsAppTemplate(aanbod, url);
  if (viaTemplate.ok) return viaTemplate;
  const ticket = await zoekWaTicket(aanbod.lead.telefoon);
  if (ticket) {
    const voornaam = (aanbod.lead.naam || 'daar').split(' ')[0];
    const r = await tFetch(`/tickets/${ticket.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message: berichtTekst(voornaam, url, aanbod.duurMin, aanbod.geldigUren || 24, aanbod.ver === true), type: 'OUTBOUND' }),
    });
    if (r.ok) return { ok: true, ticket: ticket.id, via: 'vrij bericht (template: ' + viaTemplate.reden + ')' };
    return { ok: false, reden: `Trengo ${r.status} (template: ${viaTemplate.reden})`, ticket: ticket.id };
  }
  return { ok: false, reden: `geen WhatsApp-gesprek en ${viaTemplate.reden}` };
}

/** Bestaand e-mailticket van dit adres op ons kanaal — nieuwe mails horen dáár in,
 *  niet in een vers ticket (Daimy 07-08: "moet gewoon onder de tickets komen die de
 *  mensen al hadden, anders wordt het onoverzichtelijk"). Actief ticket wint; is er
 *  alleen een gesloten, dan gebruiken we dat (bericht heropent het netjes met alle
 *  historie erbij). Term-search is niet 100% betrouwbaar (memory-les), dus niets
 *  vinden is geen fout: dan pas een nieuw ticket. */
async function zoekMailTicket(email) {
  try {
    const r = await tFetch(`/tickets?term=${encodeURIComponent(email)}`);
    if (!r.ok) return null;
    const lijst = (await r.json())?.data || [];
    const vanKlant = lijst.filter((t) =>
      String(t.contact?.email || '').toLowerCase() === String(email).toLowerCase() &&
      /email/i.test(t.channel?.name || t.channel?.type || ''));
    vanKlant.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const actief = vanKlant.find((t) => ['OPEN', 'ASSIGNED'].includes(String(t.status || '').toUpperCase()));
    return (actief || vanKlant[0])?.id || null;
  } catch { return null; }
}

async function stuurMail(aanbod, url) {
  if (!aanbod.lead.email) return { ok: false, reden: 'geen e-mailadres bij de lead' };
  const voornaam = (aanbod.lead.naam || 'daar').split(' ')[0];
  const bestaand = await zoekMailTicket(aanbod.lead.email);
  let nieuw = bestaand ? { id: bestaand, hergebruikt: true } : null;
  if (!nieuw) {
    const r1 = await tFetch('/tickets', {
      method: 'POST',
      body: JSON.stringify({
        channel_id: PLANNING_KANAAL_OVERRIDE || AANVRAGEN_KANAAL,
        contact_identifier: aanbod.lead.email,
        subject: 'Kies je inmeetmoment bij Sonty',
      }),
    });
    if (!r1.ok) return { ok: false, reden: `ticket aanmaken: Trengo ${r1.status}` };
    nieuw = await r1.json().catch(() => null);
    if (!nieuw?.id) return { ok: false, reden: 'geen ticket-id terug' };
  }

  // 06-08: 'geldigUren' bestond hier niet → ReferenceError → GEEN ENKELE mail ging
  // ooit weg (stil opgeslikt door de catch in verstuurAanbod). Uit het aanbod zelf
  // afleiden, met 24 uur als vangnet.
  const geldigUren = aanbod.verlooptOp
    ? Math.max(1, Math.round((Date.parse(aanbod.verlooptOp) - Date.now()) / 3600000))
    : 24;

  const html = `<p>Hoi ${voornaam},</p>
<p>Goed nieuws: we kunnen bij je langskomen om in te meten (duurt ongeveer ${aanbod.duurMin} minuten).${verWegRegel(aanbod.ver === true)}</p>
<p><a href="${url}" style="display:inline-block;background:#F97316;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Kies je inmeetmoment</a></p>
<p>De tijden staan ${geldigUren} uur voor je vast. Lukt kiezen niet, beantwoord dan gewoon deze mail.</p>
<p>Groetjes,<br>Nanny van Sonty</p>`;
  const r2 = await tFetch(`/tickets/${nieuw.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message: html, body_type: 'html' }),
  });
  // Alleen een ZELF aangemaakt ticket weer sluiten — een hergebruikt actief ticket
  // is van de klant/collega en moet open blijven.
  if (r2.ok && !nieuw.hergebruikt) await tFetch(`/tickets/${nieuw.id}/close`, { method: 'POST', body: '{}' });
  return { ok: r2.ok, reden: r2.ok ? undefined : `mail versturen: Trengo ${r2.status}`, ticket: nieuw.id, hergebruikt: !!nieuw.hergebruikt };
}

/** Bevestiging na klantkeuze + herinnering dag ervoor (Daimy 06-08: "krijgen ze dan
 * een bevestigingsmail en afspraak-herinneringen?"). Zelfde kanalen als het aanbod. */
function bevestigingTekst(voornaam, slot, duurMin) {
  const d = new Date(slot.aankomst);
  const dag = d.toLocaleString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' });
  const van = d.toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  const tot = new Date(+d + 30 * 60000).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  return `Hoi ${voornaam}, je inmeetafspraak staat vast: ${dag} tussen ${van} en ${tot}. ` +
    `Onze inmeter ${slot.inmeter} komt langs en is er ongeveer ${duurMin} minuten mee bezig. ` +
    `Komt er toch iets tussen? Reageer dan even op dit bericht.`;
}

async function verstuurBevestiging(aanbod, slot) {
  const voornaam = (aanbod.lead.naam || 'daar').split(' ')[0];
  const tekst = bevestigingTekst(voornaam, slot, aanbod.duurMin);
  let wa = { ok: false, reden: 'geen telefoon' };
  if (aanbod.lead.telefoon) {
    const ticket = await zoekWaTicket(aanbod.lead.telefoon).catch(() => null);
    if (ticket) {
      const r = await tFetch(`/tickets/${ticket.id}/messages`, {
        method: 'POST', body: JSON.stringify({ message: tekst, type: 'OUTBOUND' }),
      });
      wa = { ok: r.ok, reden: r.ok ? undefined : `Trengo ${r.status}` };
    } else wa = { ok: false, reden: 'geen WhatsApp-gesprek' };
  }
  let mail = { ok: false, reden: 'geen e-mailadres' };
  if (aanbod.lead.email) {
    const r1 = await tFetch('/tickets', {
      method: 'POST',
      body: JSON.stringify({ channel_id: PLANNING_KANAAL_OVERRIDE || AANVRAGEN_KANAAL, contact_identifier: aanbod.lead.email, subject: 'Je inmeetafspraak bij Sonty staat vast' }),
    });
    const nieuw = r1.ok ? await r1.json().catch(() => null) : null;
    if (nieuw?.id) {
      const html = `<p>${tekst.replace(/\. /g, '.</p><p>')}</p><p>Groetjes,<br>Nanny van Sonty</p>`;
      const r2 = await tFetch(`/tickets/${nieuw.id}/messages`, { method: 'POST', body: JSON.stringify({ message: html, body_type: 'html' }) });
      if (r2.ok) await tFetch(`/tickets/${nieuw.id}/close`, { method: 'POST', body: '{}' });
      mail = { ok: r2.ok, reden: r2.ok ? undefined : `Trengo ${r2.status}` };
    } else mail = { ok: false, reden: `ticket: Trengo ${r1.status}` };
  }
  return { wa, mail, ergensGelukt: wa.ok || mail.ok };
}

function herinneringTekst(voornaam, slot, duurMin, dagenVooraf = 1) {
  const d = new Date(slot.aankomst);
  const van = d.toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  const tot = new Date(+d + 30 * 60000).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  const wanneer = dagenVooraf <= 1 ? 'morgen'
    : d.toLocaleString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' });
  const slot2 = dagenVooraf <= 1 ? 'Tot morgen!' : 'Komt het toch niet uit? Stuur dan even een berichtje terug.';
  return `Hoi ${voornaam}, een herinnering aan je inmeetafspraak: ${wanneer} tussen ${van} en ${tot} komt onze inmeter ${slot.inmeter} ` +
    `bij je langs (ongeveer ${duurMin} minuten). ${slot2}`;
}

/** Beide kanalen; geeft per kanaal terug wat er gebeurd is. Eén kanaal gelukt = aanbod is onderweg. */
async function verstuurAanbod(aanbod, url) {
  const wa = await stuurWhatsApp(aanbod, url).catch((e) => ({ ok: false, reden: e.message }));
  const mail = await stuurMail(aanbod, url).catch((e) => ({ ok: false, reden: e.message }));
  // VERZEND-SPIEGEL (les 06-08, lege-tijden-incident): het bericht zoals de klant het
  // krijgt gaat 1-op-1 mee naar Telegram. Een kapotte verzending is dan binnen een
  // minuut zichtbaar in plaats van pas als de klant (of Daimy) hem ziet.
  try {
    const slots = (aanbod.slots || []).map((sl, i) => `${i + 1}. ${slotTekst(sl)}`).join('\n');
    const spiegel = `Hoi ${(aanbod.lead.naam || 'daar').split(' ')[0]}, goed nieuws: we kunnen bij je langskomen om in te meten.${aanbod.ver ? ' [ver-weg-versie]' : ''}\n\n${slots || '(GEEN TIJDEN?!)'}\n\nTik op een knop en we zetten hem vast.`;
    const { PLANNING_TG_TOKEN, PLANNING_TG_CHAT } = require('./telegram-planning.js');
    await fetch(`https://api.telegram.org/bot${PLANNING_TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: PLANNING_TG_CHAT, text: `📤 Verstuurd naar ${aanbod.lead.naam} (wa: ${wa.ok ? wa.via : 'niet — ' + wa.reden}, mail: ${mail.ok ? 'ok' : 'niet — ' + mail.reden}). Dit kreeg de klant:\n\n${spiegel}` }),
    });
  } catch { /* spiegel mag verzending nooit blokkeren */ }
  return { wa, mail, ergensGelukt: wa.ok || mail.ok };
}

module.exports = { verstuurAanbod, verstuurBevestiging, herinneringTekst, stuurWhatsApp, stuurMail, zoekWaTicket };

// CLI: node scripts/lib/aanbod-versturen.js <token> — verstuurt een bestaand aanbod.
if (require.main === module) {
  (async () => {
    const token = process.argv[2];
    if (!token) { console.error('gebruik: node aanbod-versturen.js <token>'); process.exit(1); }
    const r = await fetch('https://sonty-website.vercel.app/api/inmeet-aanbod?status=open', {
      headers: { 'x-meet-code': process.env.BELSCHERM_CODE || '2288' },
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

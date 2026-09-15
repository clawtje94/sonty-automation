// Excuusmail vanuit aanvragen@sonty.nl (Trengo-kanaal 1363384) aan de klanten die 14-09 per ongeluk "Geannuleerd: Inmeten" kregen.
// Gebruik: node excuus-mail.js --proef daimy@sonty.nl [joey@sonty.nl]   (voorbeeld op basis van 1 echte klant, onderwerp met [VOORBEELD])
//          node excuus-mail.js --execute                                  (echt, naar de 10 klanten)
const HOME = process.env.HOME; const { trengoFetch } = require('./lib/trengo-fetch.js');
const j = require('../data/inmeet-boekingen.json');
const KANAAL = 1363384; // aanvragen@sonty.nl
const N = ['van der wal', 'Quevedo', 'Engincicek', 'Van Eeden', 'Dunk', 'Kroon', 'Vlek', 'Guijt', 'Maastrigt', 'de Haan'];
const args = process.argv.slice(2); const EXEC = args.includes('--execute'); const PROEF = args.includes('--proef') ? args.slice(args.indexOf('--proef') + 1).filter(a => /@/.test(a)) : [];
const dag = d => new Date(d).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'long', day: 'numeric', month: 'long' });
const tijd = d => new Date(d).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' });
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function mail(r) {
  const voornaam = (r.naam || '').trim().split(/\s+/)[0].replace(/[^a-zA-ZÀ-ſ]/g, '') || 'daar';
  const onderwerp = `Onze excuses: je inmeetafspraak op ${dag(r.aankomst)} staat gewoon`;
  const html = `<p>Beste ${esc(voornaam)},</p>
<p>Gisteren heb je van ons een e-mail ontvangen met de tekst "Geannuleerd: Inmeten". Daarvoor bieden we je onze excuses aan. We stappen op dit moment over naar een nieuw planningssysteem, en bij het opruimen van een dubbele agenda-uitnodiging is die annuleringsmail per ongeluk verstuurd.</p>
<p><b>Je afspraak is niet geannuleerd.</b> Onze inmeter Patrick komt gewoon bij je langs op <b>${dag(r.aankomst)} om ${tijd(r.aankomst)}</b>. Omdat we die dag een route rijden, kan het een uur eerder of later worden. Onderweg krijg je een sms met een volglink.</p>
<p>Komt de afspraak toch niet uit? Laat het ons weten door op deze mail te antwoorden of via WhatsApp op 085 006 9681, dan plannen we samen een nieuw moment.</p>
<p>Met vriendelijke groet,<br>Nanny<br>Sonty Zonwering<br>aanvragen@sonty.nl · 085 006 9681</p>`;
  return { onderwerp, html };
}
async function verstuur(email, onderwerp, html) {
  const r1 = await trengoFetch('/tickets', { method: 'POST', body: JSON.stringify({ channel_id: KANAAL, contact_identifier: email, subject: onderwerp }) });
  const t = r1.ok ? await r1.json().catch(() => null) : null; if (!t?.id) return { ok: false, stap: 'ticket', status: r1.status, body: (await r1.text().catch(() => '')).slice(0, 200) };
  const r2 = await trengoFetch(`/tickets/${t.id}/messages`, { method: 'POST', body: JSON.stringify({ message: html, body_type: 'html' }) });
  if (!r2.ok) return { ok: false, stap: 'bericht', status: r2.status, ticket: t.id, body: (await r2.text().catch(() => '')).slice(0, 200) };
  const m = await r2.json().catch(() => null);
  await trengoFetch(`/tickets/${t.id}/close`, { method: 'POST', body: '{}' }).catch(() => null);
  return { ok: true, ticket: t.id, bericht: m?.id || m?.message_id || null };
}
(async () => {
  const recs = N.map(n => Object.values(j).filter(x => new RegExp(n, 'i').test(x.naam || '') && x.inmeter === 'Patrick' && x.status === 'geboekt').slice(-1)[0]).filter(Boolean);
  if (PROEF.length) { const r = recs.find(x => /guijt/i.test(x.naam)); const { onderwerp, html } = mail(r);
    for (const to of PROEF) { const u = await verstuur(to, '[VOORBEELD] ' + onderwerp, html); console.log('PROEF →', to, JSON.stringify(u)); } return; }
  if (!EXEC) { for (const r of recs) { const { onderwerp } = mail(r); console.log('DROOG', r.naam, '|', r.email, '|', onderwerp); } console.log(recs.length, 'klanten'); return; }
  for (const r of recs) { if (!r.email || !/@/.test(r.email)) { console.log('GEEN MAIL', r.naam); continue; } const { onderwerp, html } = mail(r); const u = await verstuur(r.email.trim(), onderwerp, html); console.log(u.ok ? 'VERSTUURD' : 'MISLUKT', r.naam, r.email.trim(), JSON.stringify(u)); await new Promise(res => setTimeout(res, 1500)); }
})().catch(e => { console.error('FOUT', e.message); process.exit(1); });

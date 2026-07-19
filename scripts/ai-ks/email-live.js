#!/usr/bin/env node
// LIVE e-mailverwerking (WhatsApp-manier) voor aanvragen@-tickets. Per ticket: Sunny beoordeelt
// met dezelfde agent-logica; kan hij het → in-thread antwoorden, aan zichzelf toewijzen, sluiten;
// kan hij het niet → toewijzen aan team Sonty Klantenservice + label 👤 Mens nodig, open laten.
// Alle uitgaande tekst gaat door het vangnet (geen redenering/kopjes naar de klant — Déborah 18 juli).
// Gebruik: node email-live.js <ticketId> [ticketId ...]
const fs = require('fs');
const path = require('path');
const { beantwoord } = require('./agent.js');

const SONNY_USER = 747786;
const TEAM_MENS_NODIG = 431872; // Daimy 19 juli: escalaties naar het team "Mens nodig"
const LABEL = { AI_BOT: 1821763, MENS_NODIG: 1821764, OPMETING: 1815410, OFFERTE_VERSTUURD: 1815411 };

const TT = (() => {
  try { return fs.readFileSync(path.join(__dirname, '.trengo-sonny-token.txt'), 'utf8').trim(); }
  catch { return fs.readFileSync(path.join(__dirname, '..', '.trengo-api-token.txt'), 'utf8').trim(); }
})();
const H = { Authorization: 'Bearer ' + TT, 'Content-Type': 'application/json' };
const clean = (s) => String(s || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// VANGNET: haal meta-redenering en interne kopjes eruit zodat NOOIT iets naar de klant gaat dat
// niet voor de klant bedoeld is (identiek aan daemon veiligeKlantTekst).
function schoonKlantTekst(tekst) {
  let s = String(tekst || '');
  const kop = s.match(/(?:^|\n)\s*Bericht(?:\s+aan\s+(?:de\s+)?klant)?\s*:\s*\n?([\s\S]*)$/i);
  if (kop) s = kop[1];
  s = s.replace(/^(?:\s*[—–-]\s*(?:ik|eerst|dan|hier)\b[^\n]*\n+)+/i, '');
  return s.trim();
}
const naarHtml = (t) => '<p>' + schoonKlantTekst(t).split(/\n\n+/).map(p => p.replace(/\n/g, '<br>')).join('</p><p>') + '</p>';

async function tGet(ep) { const r = await fetch('https://app.trengo.com/api/v2' + ep, { headers: H }); return r.ok ? r.json() : null; }
async function tPost(ep, body) { const r = await fetch('https://app.trengo.com/api/v2' + ep, { method: 'POST', headers: H, body: body ? JSON.stringify(body) : undefined }); return r.ok; }
const zetLabel = (id, l) => tPost(`/tickets/${id}/labels`, { label_id: l });

async function verwerk(ticketId) {
  const t = (await tGet(`/tickets/${ticketId}`))?.data || await tGet(`/tickets/${ticketId}`);
  if (!t) return { ticketId, resultaat: 'ticket niet gevonden' };
  const msgs = await tGet(`/tickets/${ticketId}/messages`);

  // WEBFLOW-FORMULIER: afzender is no-reply@webflow, dus in-thread antwoorden zou naar webflow
  // gaan i.p.v. de klant. Voor nu: netjes uitgelezen naar team Mens nodig (een mens pakt de nieuwe
  // lead op met alle gegevens). Echt zelf beantwoorden = nieuwe mail naar het adres uit het
  // formulier (aparte bouwstap).
  if (/no-reply@webflow/i.test(t.contact?.email || '') || /New form submission/i.test(t.subject || '')) {
    const inb = (msgs?.data || []).find(m => m.type === 'INBOUND');
    const body = clean(inb?.body || inb?.message);
    const veld = (label, eind) => { const m = body.match(new RegExp(label + '\\s*[:]?\\s*([^]*?)(?=' + eind + ')', 'i')); return m ? m[1].trim() : ''; };
    const naam = veld('Naam', 'ik wil|Email|Telefoon');
    const wil = veld('ik wil:?', 'Email|Telefoon');
    const email = (body.match(/Email\s*:?\s*([\w.+-]+@[\w-]+\.[a-z]{2,6})/i) || [])[1] || '';
    const tel = (body.match(/Telefoonnummer\s*:?\s*([\d +]{6,15})/i) || [])[1] || '';
    const adres = veld('Adres', 'Huisnummer|postcode|Woonplaats|Field|Bericht');
    const hn = (body.match(/Huisnummer\s*:?\s*([^\s]+)/i) || [])[1] || '';
    const pc = (body.match(/postcode\s*:?\s*([^\s]+)/i) || [])[1] || '';
    const plaats = veld('Woonplaats', 'Field|Bericht');
    const note = `@jorren745487 @tanya748440\n\nNieuwe aanvraag via het website-formulier — Sunny kan hier niet direct op antwoorden (formulier komt van webflow).\n\n${naam || 'Klant'} (${email}${tel ? ' / ' + tel : ''})\n${[adres, hn, pc, plaats].filter(Boolean).join(' ')}\n\nVraag: ${wil || body.slice(0, 200)}`;
    await tPost(`/tickets/${ticketId}/messages`, { internal_note: true, message: note });
    await tPost(`/tickets/${ticketId}/assign`, { type: 'team', team_id: TEAM_MENS_NODIG });
    await zetLabel(ticketId, LABEL.MENS_NODIG);
    return { ticketId, klant: naam || email, resultaat: '👤 MENS NODIG (webflow-lead, naar team Mens nodig)', concept: 'reden: nieuwe website-aanvraag ' + (wil || '').slice(0, 90) };
  }

  const rijen = (msgs?.data || []).map(m => ({ van: m.type === 'INBOUND' ? 'klant' : 'sonty', tekst: clean(m.body || m.message), tijd: m.created_at }))
    .filter(m => m.tekst).sort((a, b) => String(a.tijd).localeCompare(String(b.tijd)));
  if (!rijen.length || rijen[rijen.length - 1].van !== 'klant') return { ticketId, resultaat: 'laatste bericht niet van klant — overgeslagen' };

  const gesprek = {
    kanaal: 'EMAIL',
    klant: { naam: t.contact?.full_name || null, email: t.contact?.email || null, phone: t.contact?.phone || null },
    berichten: rijen.slice(-20),
    liveTest: true, // tools + versturen echt uitvoeren
    sonny: false,
    ticketId: t.id,
  };
  const res = await beantwoord(gesprek);
  const escal = (res.acties || []).find(a => a.type === 'escalatie');
  const mutaties = (res.acties || []).filter(a => a.type !== 'escalatie');

  if (res.antwoord && !escal) {
    // Antwoorden → in-thread sturen, aan Sunny toewijzen, label, sluiten
    const html = naarHtml(res.antwoord);
    const verstuurd = await tPost(`/tickets/${ticketId}/messages`, { message: html });
    await tPost(`/tickets/${ticketId}/assign`, { type: 'user', user_id: SONNY_USER });
    await zetLabel(ticketId, LABEL.AI_BOT);
    if (mutaties.some(a => a.type === 'inmeet_afspraak')) await zetLabel(ticketId, LABEL.OPMETING);
    if (mutaties.some(a => /offerte/.test(a.type))) await zetLabel(ticketId, LABEL.OFFERTE_VERSTUURD);
    await tPost(`/tickets/${ticketId}/close`, {});
    return { ticketId, klant: gesprek.klant.naam || gesprek.klant.email, resultaat: verstuurd ? '✅ BEANTWOORD + gesloten' : '⚠️ versturen mislukt', concept: schoonKlantTekst(res.antwoord).slice(0, 220), acties: mutaties.map(a => a.type) };
  }
  // Escalatie of leeg → naar team Mens nodig, Mens nodig, open laten
  await tPost(`/tickets/${ticketId}/assign`, { type: 'team', team_id: TEAM_MENS_NODIG });
  await zetLabel(ticketId, LABEL.MENS_NODIG);
  if (escal?.reden) await tPost(`/tickets/${ticketId}/messages`, { internal_note: true, message: `@jorren745487 @tanya748440\n\n${String(escal.reden).trim()}` });
  return { ticketId, klant: gesprek.klant.naam || gesprek.klant.email, resultaat: '👤 MENS NODIG (naar team Mens nodig)', concept: 'reden: ' + (escal?.reden || 'geen antwoord').slice(0, 200) };
}

module.exports = { verwerk, tGet, tPost };

if (require.main === module) (async () => {
  const ids = process.argv.slice(2);
  if (!ids.length) { console.log('Geef ticket-ids op.'); return; }
  const beantwoord = [], mensNodig = [], overig = [];
  const rij = [...ids];
  await Promise.all(Array.from({ length: Math.min(3, rij.length) }, async () => {
    let id;
    while ((id = rij.shift())) {
      try {
        const r = await verwerk(id);
        const regel = `${r.klant || r.ticketId} (ticket ${r.ticketId})`;
        if (/BEANTWOORD/.test(r.resultaat)) beantwoord.push(regel);
        else if (/MENS NODIG/.test(r.resultaat)) mensNodig.push(`${regel} — ${(r.concept || '').replace(/^reden:\s*/, '').slice(0, 90)}`);
        else overig.push(`${regel} — ${r.resultaat}`);
        console.log(`[${r.ticketId}] ${r.resultaat} — ${r.klant || ''}`);
      } catch (e) { overig.push(`${id} — FOUT ${e.message}`); console.log(`[${id}] FOUT: ${e.message}`); }
    }
  }));
  console.log('\n\n======== SAMENVATTING ========');
  console.log(`✅ BEANTWOORD door Sunny (gesloten): ${beantwoord.length}`);
  console.log(`\n👤 MOET NOG DOOR EEN MENS (team Mens nodig): ${mensNodig.length}`);
  mensNodig.forEach(m => console.log('  • ' + m));
  if (overig.length) { console.log(`\n➖ Overig/overgeslagen: ${overig.length}`); overig.forEach(o => console.log('  • ' + o)); }
})().catch(e => console.error('FOUT:', e.message));

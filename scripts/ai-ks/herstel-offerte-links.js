#!/usr/bin/env node
/**
 * EENMALIG HERSTEL (Daimy 2026-07-26): offerte-links die de klant nooit heeft gekregen.
 *
 * De bot maakte de offerte, beloofde "je ontvangt de link over een paar minuten" en gooide de
 * link daarna weg, omdat verwerkPendingOffertes() geen leverpad had voor een WhatsApp-klant in
 * een actief gesprek. Die bug is gefixt in daemon.js, maar de klanten die er al in vielen
 * hebben hun link nog steeds niet. Dit script stuurt hem na.
 *
 * Gebruik:
 *   node scripts/ai-ks/herstel-offerte-links.js         → dry-run, laat zien wat er zou gaan
 *   node scripts/ai-ks/herstel-offerte-links.js --echt  → daadwerkelijk versturen
 */

const { getToken } = require('../trengo-api.js');
const CFG = require('./config.js');
const { loadPending } = require('./rp-offerte-create.js');

const ECHT = process.argv.includes('--echt');

// Per klant een eigen tekst: Rogier zit nú in het gesprek en verwacht de offerte, Yorenzo
// wacht al 4 dagen en dat moet je benoemen in plaats van doen alsof het net gebeurde.
const GEVALLEN = [
  {
    ticketId: 967185427,
    voornaam: 'Rogier',
    // Geen opsomming van de inhoud: die staat al in het gesprek van 10:55 en de offerteregels
    // zijn hier niet uitleesbaar, dus niets beweren wat niet gecontroleerd is.
    tekst: (link, nr) => `Hier is je nieuwe offerte, Rogier, zoals net besproken:\n\n${link}\n\nOffertenummer: ${nr}\n\nNeem hem rustig door en laat maar weten wat je ervan vindt, of als er nog iets aangepast moet worden.`,
  },
  {
    ticketId: 967801351,
    voornaam: 'Yorenzo',
    tekst: (link, nr) => `Hoi Yorenzo, mijn excuses: ik had je woensdag de rolluik-offerte toegezegd en die is door een storing aan onze kant nooit verstuurd. Hier is hij:\n\n${link}\n\nOffertenummer: ${nr}\n\nZo kun je hem alsnog naast de screen-offerte leggen en samen vergelijken. Het gaat om de 2 rolluiken voor €2.034 totaal, dus zoals we het toen besproken hebben, met de 15% actiekorting erop. Hij is nog geldig tot woensdag 29 juli. Laat gerust weten als je ergens vragen over hebt of als je iets aangepast wilt zien.`,
  },
];

(async () => {
  const jwt = await getToken();
  const H = { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' };
  const pending = loadPending();

  for (const g of GEVALLEN) {
    const p = pending.find((x) => String(x.ticketId) === String(g.ticketId));
    if (!p) { console.log(`${g.voornaam}: geen pending-offerte gevonden, overgeslagen`); continue; }

    // Link opnieuw ophalen uit Reuzenpanda. Bewust NIET pasOfferteAan opnieuw draaien:
    // de offerte is al gevuld, nog een keer bewerken zou regels kunnen dubbelen.
    const docs = await (await fetch(
      `https://backend.reuzenpanda.nl/document-service/v1/${CFG.RP_PID}/quotations?lead_configuration_id=${p.lcId}`,
      { headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY } },
    )).json();
    const doc = (docs?.quotationDatas || [])[0];
    if (!doc) { console.log(`${g.voornaam}: geen offerte in RP, overgeslagen`); continue; }
    const link = `https://document.reuzenpanda.nl/nl/${CFG.RP_PID}/${doc.documentId}/latest`;

    // Veiligheidschecks, dezelfde als in de daemon: WhatsApp-ticket, binnen de bot-uren.
    const t = await (await fetch(`https://app.trengo.com/api/v2/tickets/${g.ticketId}`, { headers: H })).json();
    const ticket = t.data || t;
    if (ticket?.channel?.type !== 'WA_BUSINESS') { console.log(`${g.voornaam}: geen WhatsApp-ticket, overgeslagen`); continue; }
    if (!CFG.binnenBotUren()) { console.log(`${g.voornaam}: buiten de bot-uren (${CFG.amsterdamNu().hhmm}), niets verstuurd`); continue; }

    // Dubbelcheck: staat er al een link ná het aanmaakmoment? Dan is hij inmiddels geleverd.
    const m = await (await fetch(`https://app.trengo.com/api/v2/tickets/${g.ticketId}/messages`, { headers: H })).json();
    const alGeleverd = (m.data || []).some((x) => x.type === 'OUTBOUND'
      && new Date(String(x.created_at).replace(' ', 'T') + 'Z') >= new Date(p.aangemaakt)
      && String(x.body_plain || x.message || '').includes(doc.documentId));
    if (alGeleverd) { console.log(`${g.voornaam}: link is inmiddels al geleverd, overgeslagen`); continue; }

    const bericht = g.tekst(link, doc.quotationNumber || '');
    if (!ECHT) {
      console.log(`\n--- DRY-RUN ${g.voornaam} (ticket ${g.ticketId}, offerte ${doc.quotationNumber}) ---`);
      console.log(bericht);
      continue;
    }
    const r = await fetch(`https://app.trengo.com/api/v2/tickets/${g.ticketId}/messages`, {
      method: 'POST', headers: H, body: JSON.stringify({ message: bericht, type: 'OUTBOUND' }),
    });
    console.log(`${g.voornaam} (ticket ${g.ticketId}): ${r.ok ? 'VERSTUURD' : 'FOUT ' + r.status + ' ' + (await r.text()).substring(0, 200)}`);
  }
  if (!ECHT) console.log('\n(dry-run — met --echt worden deze berichten daadwerkelijk verstuurd)');
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });

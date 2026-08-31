#!/usr/bin/env node
// LIVE e-mailverwerking (WhatsApp-manier) voor aanvragen@-tickets. Per ticket: Sunny beoordeelt
// met dezelfde agent-logica; kan hij het → in-thread antwoorden, aan zichzelf toewijzen, sluiten;
// kan hij het niet → toewijzen aan team Sonty Klantenservice + label 👤 Mens nodig, open laten.
// Alle uitgaande tekst gaat door het vangnet (geen redenering/kopjes naar de klant — Déborah 18 juli).
// Gebruik: node email-live.js <ticketId> [ticketId ...]
const fs = require('fs');
const { teamTags, OVERDRACHT_HERKENNING } = require(`./team-tags.js`);
const path = require('path');
const { beantwoord } = require('./agent.js');

const SONNY_USER = 747786;
const { magSluiten } = require('./mag-sluiten.js');
const TEAM_MENS_NODIG = 431872; // Daimy 19 juli: escalaties naar het team "Mens nodig"
const AANVRAGEN_KANAAL = 1363384; // e-mailkanaal aanvragen@sonty.nl
const LABEL = { AI_BOT: 1821763, MENS_NODIG: 1821764, OPMETING: 1815410, OFFERTE_VERSTUURD: 1815411 };

const TT = (() => {
  try { return fs.readFileSync(path.join(__dirname, '.trengo-sonny-token.txt'), 'utf8').trim(); }
  catch { return fs.readFileSync(path.join(__dirname, '..', '.trengo-api-token.txt'), 'utf8').trim(); }
})();
const H = { Authorization: 'Bearer ' + TT, 'Content-Type': 'application/json' };
const clean = (s) => String(s || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
// E-mailreplies bevatten onder het nieuwe bericht vaak de hele oude thread als quote. Die
// NIET weghalen (context blijft leesbaar) maar duidelijk labelen, zodat agent én QA-poort
// het bovenste deel als hét nieuwe klantbericht zien. (Cor Haakman-case 23-07: de QA las de
// gequote prijsopmerking als het bericht en keurde het afspraak-antwoord onterecht af.)
/**
 * Waar begint de geciteerde oude thread? Elke mailclient schrijft dat anders op, en de
 * Nederlandse varianten ontbraken hier.
 *
 * Daimy 2026-08-04 (Winston Wareman): zijn iPhone zette de oude mail eronder met
 * "Op 04.08.2026 om 09:03 heeft Aanvragen | Sonty het volgende geschreven:". Die vorm stond er
 * niet bij, dus de hele geciteerde offertemail telde mee als zijn bericht. Daarin staat onze
 * eigen FAQ-zin "hoe snel lossen jullie een storing op", en daardoor werd zijn maatwijziging
 * als storingsmelding gezien en bleef het ticket bij Mens nodig liggen.
 */
const QUOTE_START = new RegExp([
  /-{2,}\s*Oorspronkelijk bericht\s*-{2,}/.source,
  /-{3,}\s*Original Message\s*-{3,}/.source,
  // Ook hier geen \b: "JuliaOn Tue, Aug 4" plakt de naam aan de kopregel vast. Dit was de
  // DERDE keer dat een woordgrens op geplakte tekst stukliep (eerder iPhoneOp en HeuvelOp);
  // in mail-quotes dus nooit meer \b aan het begin van een kopregelpatroon.
  /On .{5,80}? wrote:/.source,
  /Van:\s?.{2,80}?(?:Verzonden|Datum):/.source,
  /From:.{2,120}?Sent:.{2,120}?(?:To|Aan):/.source,      // Engelse Outlook, ook aan elkaar geplakt
  // GEEN \b voor "Op": in de echte mail van Winston plakte zijn iPhone het aan de vorige regel
  // vast als "Verstuurd vanaf mijn iPhoneOp 04.08.2026 om 09:03 heeft ...". Met een woordgrens
  // matcht dat niet, en dan telt de hele geciteerde thread alsnog mee. Mijn eigen testzin had
  // netjes een spatie; de echte mail niet. Vandaar deze los van elkaar.
  /Op \d{1,2}[-./]\d{1,2}[-./]\d{2,4}.{0,90}?het volgende geschreven:/.source,   // iPhone, NL
  /Op .{5,120}? het volgende geschreven:/.source,                                 // Apple Mail, NL
  /Op .{5,70}? om \d{1,2}[:.]\d{2}\s.{0,90}?(?:heeft|schreef)\b/.source,          // Gmail, NL
  // Gmail zonder "om": "Op wo 5 aug 2026, 09:03 schreef Aanvragen | Sonty <...>". Derde gemiste
  // vorm op rij (Jan-Henk Tuk, 2026-08-06). De tijd en "schreef" samen zijn onderscheidend
  // genoeg; een klant die zelf "op woensdag" schrijft gebruikt geen tijdstip plus "schreef".
  // Zonder \b voor "Op": clients plakken de vorige regel eraan vast ("A vd HeuvelOp di 4 aug",
  // "TukOp wo 5 aug"), precies zoals eerder bij "iPhoneOp". Tijd plus "schreef" samen zijn
  // onderscheidend genoeg om valse treffers te voorkomen.
  /Op [^\n]{2,60}?\d{1,2}[:.]\d{2}[^\n]{0,90}?schreef\b/.source,
].join('|'), 'i');

/**
 * De klassieke quote met een groter-dan aan het begin van de regel. Sommige clients zetten geen
 * kopregel maar prefixen alleen de oude tekst met ">".
 *
 * Daimy 2026-08-05 (juliaavo@gmail.com): zij vroeg netjes om een inmeetafspraak, maar onder haar
 * bericht stond de hele offertemail met ">" ervoor, inclusief onze eigen FAQ-zin "hoe snel lossen
 * jullie een storing op". Dat woord telde mee en haar inmeetverzoek belandde bij Mens nodig.
 */
const QUOTE_REGELPREFIX = /^[ \t]*>/m;

function markeerQuote(tekst) {
  // De vroegste van de twee vormen wint: een mail kan zowel een kopregel als >-prefixen hebben,
  // en dan begint de quote bij wat het eerst komt.
  const iKop = tekst.search(QUOTE_START);
  const iPrefix = tekst.search(QUOTE_REGELPREFIX);
  const kandidaten = [iKop, iPrefix].filter((x) => x >= 4);
  const i = kandidaten.length ? Math.min(...kandidaten) : -1;
  // Drempel bewust laag: een kort antwoord als "Ja graag." of "Prima, doe maar." is een volwaardig
  // bericht en moet ook van zijn quote gescheiden worden. Stond op 15, waardoor juist die korte
  // replies de hele geciteerde thread meekregen in het sluit-oordeel.
  if (i < 4) return tekst; // geen quote gevonden, of de mail begint er meteen mee
  return '[NIEUW BERICHT] ' + tekst.slice(0, i).trim() + ' [EINDE NIEUW BERICHT, hieronder staat de eerdere thread als quote, die is al gelezen] ' + tekst.slice(i).trim();
}


// VANGNET: haal meta-redenering en interne kopjes eruit zodat NOOIT iets naar de klant gaat dat
// niet voor de klant bedoeld is (identiek aan daemon veiligeKlantTekst).
function schoonKlantTekst(tekst) {
  let s = String(tekst || '');
  const kop = s.match(/(?:^|\n)\s*Bericht(?:\s+aan\s+(?:de\s+)?klant)?\s*:\s*\n?([\s\S]*)$/i);
  if (kop) s = kop[1];
  s = s.replace(/^(?:\s*[—–-]\s*(?:ik|eerst|dan|hier)\b[^\n]*\n+)+/i, '');
  return s.trim();
}
// VANGNET MAILOPBOUW (Daimy 20 juli): elke mail heeft dezelfde opbouw — begroeting op een
// eigen regel, witregel, dan pas de inhoud, en afsluiten met "Met vriendelijke groet," +
// "Sunny | Sonty" op eigen regels. De prompt schrijft dit al voor; dit dwingt het ook
// technisch af als het model toch "Hoi Peter, bedankt voor..." aan elkaar plakt.
function formatteerEmail(tekst) {
  let s = schoonKlantTekst(tekst);
  // Markdown-vet weghalen (Daimy 2026-08-03): ** rendert niet in e-mail, klant ziet letterlijk de
  // sterretjes. *tekst* en **tekst** worden platte tekst, losse sterretjes eruit.
  s = s.replace(/\*{1,2}([^*\n]+?)\*{1,2}/g, '$1').replace(/\*+/g, '');
  // Begroeting op eigen regel + witregel erna ("Hoi Peter, tekst..." → "Hoi Peter,\n\ntekst...")
  s = s.replace(/^((?:Hoi|Hallo|Hi|Beste|Goedemorgen|Goedemiddag|Goedenavond|Dag)(?:\s+[^\n,]{1,40})?,)[ \t]*\n?[ \t]*(?=\S)/i, '$1\n\n');
  // Afsluiting normaliseren: bestaande groet-varianten eraf, dan de vaste afsluiting erop.
  s = s.replace(/\n*[ \t]*(?:Met vriendelijke groet(?:en)?|Vriendelijke groet(?:en)?|Groet(?:en|jes)?|Hartelijke groet(?:en)?)[,.]?[ \t]*\n*[ \t]*(?:Sunny(?:[ \t]*\|[ \t]*Sonty)?|Sonty)?[ \t]*$/i, '');
  return s.trim() + '\n\nMet vriendelijke groet,\nSunny | Sonty';
}
const naarHtml = (t) => '<p>' + formatteerEmail(t).split(/\n\n+/).map(p => p.replace(/\n/g, '<br>')).join('</p><p>') + '</p>';

// E-mailinteracties naar dezelfde log.jsonl als WhatsApp schrijven (met email:true), zodat ze in
// het dagrapport meelopen.
const CFG = require('./config.js');
function logKS(entry) {
  try { fs.mkdirSync(path.dirname(CFG.LOG_FILE), { recursive: true });
    fs.appendFileSync(CFG.LOG_FILE, JSON.stringify({ tijd: new Date().toISOString(), email: true, ...entry }) + '\n'); } catch {}
}

const _sleep = ms => new Promise(r => setTimeout(r, ms));
// 429-bestendig: Trengo rate-limit → wachten en opnieuw i.p.v. null teruggeven (anders leek een
// ticket "niet gevonden" terwijl het er wél was, en werd het onterecht overgeslagen).
async function tGet(ep) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch('https://app.trengo.com/api/v2' + ep, { headers: H });
    if (r.status === 429) { await _sleep(2000 + i * 1500); continue; }
    return r.ok ? r.json() : null;
  }
  return null;
}
async function tPost(ep, body) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch('https://app.trengo.com/api/v2' + ep, { method: 'POST', headers: H, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 429) { await _sleep(2000 + i * 1500); continue; }
    return r.ok;
  }
  return false;
}
const zetLabel = (id, l) => tPost(`/tickets/${id}/labels`, { label_id: l });

// NIEUWE uitgaande mail naar een klantadres via het Aanvragen-kanaal — zelfde bewezen route
// als de TE VER-mails in cron-offerte-controle-v4 (nieuw ticket op contact_identifier → mail →
// toewijzen aan Sunny → sluiten). Nodig voor webflow-leads: in-thread antwoorden gaat daar naar
// no-reply@webflow, dus het echte antwoord moet als nieuwe mail naar het adres uit het formulier.
async function stuurNieuweMail(naar, subject, html) {
  for (let i = 0; i < 3; i++) {
    const r1 = await fetch('https://app.trengo.com/api/v2/tickets', {
      method: 'POST', headers: H,
      body: JSON.stringify({ channel_id: AANVRAGEN_KANAAL, contact_identifier: naar, subject }),
    });
    if (r1.status === 429) { await _sleep(3000 + i * 2000); continue; }
    if (!r1.ok) return false;
    const nieuw = await r1.json().catch(() => null);
    if (!nieuw?.id) return false;
    const ok = await tPost(`/tickets/${nieuw.id}/messages`, { message: html, body_type: 'html' });
    if (ok) {
      await tPost(`/tickets/${nieuw.id}/assign`, { type: 'user', user_id: SONNY_USER });
      await zetLabel(nieuw.id, LABEL.AI_BOT);
      await tPost(`/tickets/${nieuw.id}/close`, {});
    }
    return ok;
  }
  return false;
}

async function verwerk(ticketId) {
  const t = (await tGet(`/tickets/${ticketId}`))?.data || await tGet(`/tickets/${ticketId}`);
  if (!t) return { ticketId, resultaat: 'ticket niet gevonden' };
  const msgs = await tGet(`/tickets/${ticketId}/messages`);

  // EIGEN/SYSTEEMMAIL (22-07, Bookings-loop op info@): mail van onze eigen adressen
  // (Bookings-notificaties, interne doorstuur) is geen klant — NOOIT beantwoorden, alleen
  // sluiten. Anders mailt Sunny zijn interne notitie terug naar info@ en ontstaat een lus.
  if (/@sonty\.nl$|@sontymontage\.nl$/i.test(String(t.contact?.email || '').trim())) {
    await tPost(`/tickets/${ticketId}/close`, {});
    return { ticketId, resultaat: 'eigen/systeemmail, gesloten zonder antwoord', klant: t.contact?.email };
  }

  // LOPEND INMEET-AANBOD op dit mailadres of nummer? Dan is de planner de enige
  // responder — zelfde regel als in daemon.js (Irene-incident 06-08); het mail-pad
  // was hier nog onbeschermd (audit 06-08). De aanbod-monitor rapporteert elke
  // reactie al naar Daimy.
  try {
    const stP = JSON.parse(require('fs').readFileSync('/Users/clawdboot/sonty/data/inmeten-planner-state.json', 'utf8'));
    const mail = String(t.contact?.email || '').trim().toLowerCase();
    const tel9 = String(t.contact?.phone || '').replace(/\D/g, '').slice(-9);
    const lopend = Object.values(stP.aanbodTickets || {}).some((a) => {
      if (Date.now() - Date.parse(a.verstuurdOp) >= 48 * 3600000) return false;
      const aMail = String(a.email || '').trim().toLowerCase();
      const aTel = String(a.telefoon || '').replace(/\D/g, '').slice(-9);
      return (!!mail && aMail === mail) || (tel9.length === 9 && aTel === tel9);
    });
    if (lopend) return { ticketId, resultaat: 'lopend inmeet-aanbod — planner/monitor handelen af, AI blijft eraf', klant: t.contact?.email };
  } catch { /* state onleesbaar: normale flow */ }

  // WEBFLOW-FORMULIER: afzender is no-reply@webflow, dus in-thread antwoorden zou naar webflow
  // gaan i.p.v. de klant. Voor nu: netjes uitgelezen naar team Mens nodig (een mens pakt de nieuwe
  // lead op met alle gegevens). Echt zelf beantwoorden = nieuwe mail naar het adres uit het
  // formulier (aparte bouwstap).
  if (/no-reply@webflow/i.test(t.contact?.email || '') || /New form submission/i.test(t.subject || '')) {
    // Het FORMULIER-bericht pakken, niet zomaar de nieuwste inbound: op een webflow-ticket kan
    // ook een bounce ("kan niet worden afgeleverd") als INBOUND binnenkomen (20 juli).
    const inbounds = (msgs?.data || []).filter(m => m.type === 'INBOUND')
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const inb = inbounds.find(m => /form submission/i.test(m.body || m.message || '')) || inbounds[0];
    const body = clean(inb?.body || inb?.message);
    const veld = (label, eind) => { const m = body.match(new RegExp(label + '\\s*[:]?\\s*([^]*?)(?=' + eind + ')', 'i')); return m ? m[1].trim() : ''; };
    const naam = veld('Naam', 'ik wil|Email|Telefoon');
    const wil = veld('ik wil:?', 'Email|Telefoon');
    // Het BERICHT-veld is de eigenlijke vraag van de klant (Daimy 20 juli: parser liet dit weg,
    // waardoor de bot generieke wedervragen stelde i.p.v. de echte vraag te beantwoorden).
    const bericht = veld('Bericht', '-{4,}|If you believe|Unsubscribe');
    const vraag = [wil, bericht].filter(Boolean).join(', ') || body.slice(0, 400);
    const email = (body.match(/Email\s*:?\s*([\w.+-]+@[\w-]+\.[a-z]{2,4})(?![a-z])/) || [])[1] || '';
    const tel = (body.match(/Telefoonnummer\s*:?\s*([\d +]{6,15})/i) || [])[1] || '';
    const adres = veld('Adres', 'Huisnummer|postcode|Woonplaats|Field|Bericht');
    // Lazy match met lookahead: webflow plakt velden zonder spatie aan elkaar ("268postcode: 2583Cp...")
    const hn = (body.match(/Huisnummer\s*:?\s*(.*?)(?=\s|postcode|Woonplaats|Field|Bericht|$)/i) || [])[1] || '';
    const pc = (body.match(/postcode\s*:?\s*(.*?)(?=\s|Woonplaats|Field|Bericht|$)/i) || [])[1] || '';
    const plaats = veld('Woonplaats', 'Field|Bericht');
    const adresRegel = [adres, hn, pc, plaats].filter(Boolean).join(' ');

    // Geen bruikbaar e-mailadres uit het formulier → naar team Mens nodig (kan niet antwoorden).
    if (!email) {
      const note = `${teamTags()}\n\nNieuwe website-aanvraag, maar zonder bruikbaar e-mailadres, pak dit zelf op.\n\n${naam || 'Klant'}${tel ? ' / ' + tel : ''}\n${adresRegel}\n\nVraag: ${vraag.slice(0, 300)}`;
      await tPost(`/tickets/${ticketId}/messages`, { internal_note: true, message: note });
      await tPost(`/tickets/${ticketId}/assign`, { type: 'team', team_id: TEAM_MENS_NODIG });
      await zetLabel(ticketId, LABEL.MENS_NODIG);
      return { ticketId, klant: naam || 'onbekend', resultaat: '👤 MENS NODIG (webflow zonder e-mail)', concept: 'reden: geen adres' };
    }

    // In-thread antwoorden op een webflow-ticket gaat naar no-reply@webflow — Trengo negeert de
    // contact-swap, dus de klant krijgt dat NOOIT (geverifieerd 19 juli). Daarom stuurt Sunny
    // het antwoord als NIEUWE mail naar het adres uit het formulier, via dezelfde bewezen route
    // als de TE VER-mails (Daimy 20 juli: webflow-leads nu wél zelf beantwoorden). Lukt het
    // versturen niet, dan valt hij terug op het oude gedrag: concept + lead naar team Mens nodig.
    let conceptDraft = '';
    try {
      const res = await beantwoord({
        kanaal: 'EMAIL',
        klant: { naam: naam || null, email, phone: tel || null },
        berichten: [{ van: 'klant', tekst: `Nieuwe aanvraag via ons website-formulier.\nNaam: ${naam}\nAdres: ${adresRegel}\nTelefoon: ${tel}\nType aanvraag: ${wil || '-'}\nBericht/vraag van de klant: ${bericht || wil || body.slice(0, 400)}\n\n(LET OP: dit is het EERSTE antwoord op een formulier-aanvraag. Je kunt in deze beurt nog GEEN offerte aanmaken of iets doorzetten, dus zeg niet dat je hem NU maakt of dat er zo een link komt. Wat je WEL doet: de vraag inhoudelijk beantwoorden (prijzen berekenen met prijs_berekenen mag gewoon), de nog ontbrekende keuzes uitvragen (bv. bediening, framekleur), en toezeggen dat je de offerte direct in orde maakt zodra de klant die doorgeeft, als de klant antwoordt kun je daarna wél alles.)`, tijd: inb?.created_at }],
        liveTest: false, sonny: false, ticketId, // geen tools/offertes uitvoeren op een formulier-lead
      });
      conceptDraft = res.antwoord ? formatteerEmail(res.antwoord) : '';
    } catch {}

    if (conceptDraft) {
      const verstuurd = await stuurNieuweMail(email, 'Je aanvraag bij Sonty', naarHtml(conceptDraft));
      if (verstuurd) {
        // BELOOFT HET ANTWOORD DAT IEMAND CONTACT OPNEEMT? Dan NIET sluiten (mevr. Langenberg,
        // ticket 970863017, 1 aug: Sunny mailde "onze serviceafdeling neemt persoonlijk contact
        // met je op" en sloot daarna het ticket zonder toewijzing — niemand pakte het op, en
        // gesloten tickets vallen ook buiten de onbeantwoord-wachtlijst). Zo'n belofte hoort
        // bij een mens te liggen tot die is nagekomen.
        const poort = magSluiten({ klantTekst: `${wil || ''} ${body || ''} ${vraag || ''}`, antwoord: conceptDraft });
        await tPost(`/tickets/${ticketId}/messages`, { internal_note: true, message: `🤖 Sunny heeft deze website-lead zelf per mail beantwoord (naar ${email}).\n\n--- Verstuurde mail ---\n${conceptDraft}` });
        if (!poort.mag) {
          // Webflow-leads NIET naar Mens nodig en geen notitie (Daimy 2026-08-06: "die
          // webflow-tickets hoeven niet naar mens nodig en elke keer die opmerking is
          // irritant"). Gewoon open laten; het team ziet hem in de open lijst.
          logKS({ ticket: ticketId, webflow: true, laatsteKlantBericht: (wil || body).slice(0, 200), antwoord: conceptDraft, acties: [{ type: 'open-laten', reden: poort.reden }] });
          return { ticketId, klant: naam || email, resultaat: `✅ BEANTWOORD (webflow-lead) + open gelaten (${poort.soort})`, concept: conceptDraft.slice(0, 220) };
        }
        await tPost(`/tickets/${ticketId}/assign`, { type: 'user', user_id: SONNY_USER });
        await zetLabel(ticketId, LABEL.AI_BOT);
        await tPost(`/tickets/${ticketId}/close`, {});
        logKS({ ticket: ticketId, webflow: true, laatsteKlantBericht: (wil || body).slice(0, 200), antwoord: conceptDraft, acties: [] });
        return { ticketId, klant: naam || email, resultaat: '✅ BEANTWOORD (webflow-lead, eigen mail naar klantadres) + gesloten', concept: conceptDraft.slice(0, 220) };
      }
    }
    const note = `${teamTags()}\n\nNieuwe website-aanvraag, Sunny kon de mail niet zelf versturen, stuur dit zelf naar de klant (in-thread antwoord zou naar no-reply@webflow gaan).\n\nKlant: ${naam || '-'}\nMail: ${email}${tel ? '\nTel: ' + tel : ''}\nAdres: ${adresRegel || '-'}\nVraag: ${vraag.slice(0, 300)}` + (conceptDraft ? `\n\n--- Concept-antwoord van Sunny (controleer en verstuur naar ${email}) ---\n${conceptDraft}` : '');
    await tPost(`/tickets/${ticketId}/messages`, { internal_note: true, message: note });
    await tPost(`/tickets/${ticketId}/assign`, { type: 'team', team_id: TEAM_MENS_NODIG });
    await zetLabel(ticketId, LABEL.MENS_NODIG);
    return { ticketId, klant: naam || email, resultaat: '👤 MENS NODIG (webflow-lead + concept, mail versturen mislukte)', concept: conceptDraft.slice(0, 150) };
  }

  const rijen = (msgs?.data || []).map(m => ({ van: m.type === 'INBOUND' ? 'klant' : 'sonty', tekst: m.type === 'INBOUND' ? markeerQuote(clean(m.body || m.message)) : clean(m.body || m.message), tijd: m.created_at }))
    .filter(m => m.tekst).sort((a, b) => String(a.tijd).localeCompare(String(b.tijd)));
  // @sonny-notities van Daimy/het team op dit ticket = sturing voor Sunny (net als op WhatsApp).
  const teamNotities = (msgs?.data || [])
    .filter(m => (m.type === 'NOTE' || m.internal_note) && /@s[ou]nny/i.test(m.body || m.message || ''))
    .map(m => ({ tijd: m.created_at, tekst: clean(m.body || m.message) }))
    .sort((a, b) => String(a.tijd).localeCompare(String(b.tijd)));
  if (!rijen.length || rijen[rijen.length - 1].van !== 'klant') return { ticketId, resultaat: 'laatste bericht niet van klant, overgeslagen' };

  const gesprek = {
    kanaal: 'EMAIL',
    klant: { naam: t.contact?.full_name || null, email: t.contact?.email || null, phone: t.contact?.phone || null },
    berichten: rijen.slice(-25),
    teamNotities,
    liveTest: true, // tools + versturen echt uitvoeren
    sonny: false,
    ticketId: t.id,
  };
  const res = await beantwoord(gesprek);
  const escal = (res.acties || []).find(a => a.type === 'escalatie');
  const mutaties = (res.acties || []).filter(a => a.type !== 'escalatie');

  if (res.antwoord && !escal) {
    // TAALPOORT (31-08, Judith Bauwi kreeg 2x Nederlands op Engelse mails): botst de taal van het
    // antwoord met die van de klant, dan NIET sturen maar overdragen met uitleg.
    const laatsteKlant = [...rijen].reverse().find((b) => b.van === 'klant');
    const { taalMismatch } = require('../lib/taal-check.js');
    if (laatsteKlant && taalMismatch(String(laatsteKlant.tekst ?? laatsteKlant.inhoud ?? ''), res.antwoord)) {
      await tPost(`/tickets/${ticketId}/messages`, { internal_note: true, message: `${teamTags()} Taalpoort: het concept-antwoord was in een andere taal dan het klantbericht en is NIET verstuurd. Graag in de taal van de klant beantwoorden.` });
      await zetLabel(ticketId, LABEL.MENS_NODIG);
      return { ticketId, resultaat: 'taalpoort: antwoord tegengehouden (taal klopte niet met klant)' };
    }
    // Antwoorden → in-thread sturen, aan Sunny toewijzen, label, sluiten
    const html = naarHtml(res.antwoord);
    const verstuurd = await tPost(`/tickets/${ticketId}/messages`, { message: html });
    await tPost(`/tickets/${ticketId}/assign`, { type: 'user', user_id: SONNY_USER });
    await zetLabel(ticketId, LABEL.AI_BOT);
    if (mutaties.some(a => a.type === 'inmeet_afspraak')) await zetLabel(ticketId, LABEL.OPMETING);
    if (mutaties.some(a => /offerte/.test(a.type))) await zetLabel(ticketId, LABEL.OFFERTE_VERSTUURD);
    // Alleen het NIEUWE berichtdeel telt voor het sluit-oordeel, niet de geciteerde thread
    // (Daimy 2026-08-03, casus Theo/ghosty_buster: onze eigen FAQ-zin "hoe snel lossen jullie een
    // storing op" stond meegequote en werd als service/klacht gezien → onterecht naar Mens nodig).
    const poortMail = magSluiten({ klantTekst: rijen.filter(r => r.van === 'klant').map(r => String(r.tekst).split('[EINDE NIEUW BERICHT')[0]).join(' '), antwoord: res.antwoord, acties: res.acties });
    if (!poortMail.mag) {
      // Servicemelding: alleen open laten, geen Mens nodig en geen notitie (Daimy 2026-08-06,
      // "die dingen die doorgezet worden naar service hoeven niet naar mens nodig, en ook die
      // opmerking niet"). Het team ziet het ticket gewoon in de open lijst. Beloftes en
      // escalaties gaan nog wel naar Mens nodig, want daar moet echt iemand iets mee.
      if (poortMail.soort !== 'service') {
        await tPost(`/tickets/${ticketId}/assign`, { type: 'team', team_id: TEAM_MENS_NODIG });
        await zetLabel(ticketId, LABEL.MENS_NODIG);
        await tPost(`/tickets/${ticketId}/messages`, { internal_note: true, message: `👤 Ticket blijft OPEN bij Mens nodig: ${poortMail.reden}.` });
      }
    } else await tPost(`/tickets/${ticketId}/close`, {});
    logKS({ ticket: ticketId, laatsteKlantBericht: rijen[rijen.length - 1]?.tekst?.slice(0, 200), antwoord: schoonKlantTekst(res.antwoord), acties: mutaties });
    return { ticketId, klant: gesprek.klant.naam || gesprek.klant.email, resultaat: verstuurd ? '✅ BEANTWOORD + gesloten' : '⚠️ versturen mislukt', concept: schoonKlantTekst(res.antwoord).slice(0, 220), acties: mutaties.map(a => a.type) };
  }
  // Escalatie of leeg → naar team Mens nodig, Mens nodig, open laten
  await tPost(`/tickets/${ticketId}/assign`, { type: 'team', team_id: TEAM_MENS_NODIG });
  await zetLabel(ticketId, LABEL.MENS_NODIG);
  if (escal?.reden) await tPost(`/tickets/${ticketId}/messages`, { internal_note: true, message: `${teamTags()}\n\n${String(escal.reden).trim()}` });
  return { ticketId, klant: gesprek.klant.naam || gesprek.klant.email, resultaat: '👤 MENS NODIG (naar team Mens nodig)', concept: 'reden: ' + (escal?.reden || 'geen antwoord').slice(0, 200) };
}

// ============================== @SONNY-NOTITIES ==============================
// (Daimy 20 juli: "reageer je nu ook op mijn @sonny tags? naar mij terug en pas je dat aan
// in de kennis?") Zelfde werkwijze als verwerkSonnyNotities in de WhatsApp-daemon:
// - STOPCOMMANDO ("@sonny stop / neem over") → ticket uit AI-beheer (email-stop.json),
//   ✅-notitie terug naar de tagger + Telegram-melding.
// - Al het andere = LEERPUNT: naar leerpunten.md (zit per direct in de prompt van BEIDE
//   kanalen), Telegram-melding, en de bot beoordeelt ZELF of de notitie ook een actie
//   (tools) of een mail aan de klant vraagt (GEEN_BERICHT / NOTITIE:-protocol, identiek
//   aan WhatsApp). Er gaat ALTIJD een ✅-notitie terug naar wie tagde.
// Dedupe via hetzelfde notitie-leerpunten.json als WhatsApp (sleutel "ticket:tijd").
const NOTITIE_STATE = path.join(path.dirname(CFG.LOG_FILE), 'notitie-leerpunten.json');
const EMAIL_STOP_FILE = path.join(path.dirname(CFG.LOG_FILE), 'email-stop.json');
const NOTITIE_MAX_DAGEN = 7; // oudere notities (van vóór deze functie) stil markeren, nooit alsnog mails afvuren

function loadJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } }

async function telegram(tekst) {
  try {
    await fetch(`https://api.telegram.org/bot${CFG.TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CFG.TG_CHAT, text: tekst }),
    });
  } catch {}
}

// Tag voor de auteur van een notitie (zelfde als de WA-daemon; fallback Daimy).
const userTagCache = {};
async function tagVoor(userId) {
  if (!userId) return '@daimy736327';
  if (userTagCache[userId]) return userTagCache[userId];
  try {
    const u = await tGet(`/users/${userId}`);
    const naam = (u?.first_name || u?.data?.first_name || '').toLowerCase().replace(/[^a-z]/g, '');
    userTagCache[userId] = naam ? `@${naam}${userId}` : '@daimy736327';
  } catch { userTagCache[userId] = '@daimy736327'; }
  return userTagCache[userId];
}

async function verwerkNotities(t, rowsAll) {
  const notes = (rowsAll || [])
    .filter(m => m.type === 'NOTE' || m.internal_note)
    .map(m => ({ tijd: m.created_at, tekst: clean(m.body || m.message), userId: m.user_id || null }))
    .filter(n => /@s[ou]nny/i.test(n.tekst) && !n.tekst.includes('✅'))
    .sort((a, b) => String(a.tijd).localeCompare(String(b.tijd)));
  if (!notes.length) return;
  const st = loadJson(NOTITIE_STATE);
  const nieuwe = notes.filter(n => !st[`${t.id}:${n.tijd}`]);
  if (!nieuwe.length) return;
  const wie = t.contact?.full_name || t.contact?.email || t.id;
  const nuAms = () => Date.parse(new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' }).replace(' ', 'T'));

  const teDoen = [];
  for (const n of nieuwe) {
    const key = `${t.id}:${n.tijd}`;
    const punt = n.tekst.replace(/@s[ou]nny(747786)?[,:]?\s*/i, '').trim();
    // Stokoude notities (van vóór deze functie bestond) stil markeren.
    if ((nuAms() - Date.parse(String(n.tijd).replace(' ', 'T'))) / 86400000 > NOTITIE_MAX_DAGEN) { st[key] = 'te-oud'; continue; }
    // STOPCOMMANDO — zelfde patronen als WhatsApp (géén los "stop": "stopcontact" is er geen).
    if (/\b(niet verder|stop met dit gesprek|stop ermee|stoppen met dit gesprek|neem (het |dit )?over|pauzeer|laat dit gesprek)\b/i.test(punt)) {
      const stop = loadJson(EMAIL_STOP_FILE);
      stop[t.id] = new Date().toISOString();
      fs.writeFileSync(EMAIL_STOP_FILE, JSON.stringify(stop, null, 1));
      await tPost(`/tickets/${t.id}/messages`, { internal_note: true, message: `${await tagVoor(n.userId)} ✅ Verwerkt: dit e-mailticket is uit AI-beheer gehaald. Sunny beantwoordt hier niets meer, het team neemt het over.` });
      // Alleen Daimy's eigen stopcommando op Telegram melden (collega-gebruik niet — 20 juli).
      if (Number(n.userId) === 736327) await telegram(`🛑 E-mailticket ${wie} (${t.id}) is op jouw @sonny-notitie UIT het AI-beheer gehaald. Sunny beantwoordt daar niets meer.`);
      st[key] = new Date().toISOString();
      continue;
    }
    if (punt) {
      // VASTE KENNIS alleen bij notities van DAIMY (20 juli: collega's gebruiken @sonny ook —
      // hun notitie is een eenmalige opdracht voor dít ticket, geen leerpunt). Leerpunt direct
      // vastleggen en markeren, zodat een fout in de beoordeling nooit tot dubbele leidt.
      if (Number(n.userId) === 736327) {
        fs.appendFileSync(path.join(path.dirname(CFG.LOG_FILE), 'leerpunten.md'), `- (${new Date().toISOString().slice(0, 10)}) [team-notitie bij e-mail ${wie}] ${punt}\n`);
        await telegram(`🎓 @sonny-notitie op e-mailticket ${wie} verwerkt als leerpunt:\n"${punt.substring(0, 300)}"\n\nSunny beoordeelt nu zelf of dit ticket ook een actie of mail nodig heeft.`);
      }
      teDoen.push({ key, punt, userId: n.userId });
    }
    st[key] = new Date().toISOString();
  }
  fs.writeFileSync(NOTITIE_STATE, JSON.stringify(st, null, 1));
  if (!teDoen.length) return;

  const feedback = teDoen.map(i => i.punt).join('\n');
  // Zelfde feedback-beoordeling als WhatsApp: opdrachten voert de agent NU uit met zijn tools,
  // en hij bepaalt zelf of er nog een mail naar de klant moet (GEEN_BERICHT als dat niet zo is).
  const rijen = (rowsAll || []).map(m => ({ van: m.type === 'INBOUND' ? 'klant' : 'sonty', tekst: m.type === 'INBOUND' ? markeerQuote(clean(m.body || m.message)) : clean(m.body || m.message), tijd: m.created_at }))
    .filter(m => (m.tekst)).sort((a, b) => String(a.tijd).localeCompare(String(b.tijd)));
  const res = await beantwoord({
    kanaal: 'EMAIL',
    klant: { naam: t.contact?.full_name || null, email: t.contact?.email || null, phone: t.contact?.phone || null },
    berichten: rijen.slice(-25),
    teamNotities: notes,
    teamInstructie: feedback,
    liveTest: true, sonny: false, ticketId: t.id,
  });
  const ruw = res.antwoord || '';
  const teamAntwoord = ((ruw.match(/NOTITIE:\s*([\s\S]+)$/i) || [])[1] || '').trim();
  let klantTekst = schoonKlantTekst(ruw.replace(/NOTITIE:\s*[\s\S]+$/i, '').replace(/GEEN_BERICHT/g, '').trim());
  // Interne agent-notities tussen blokhaken ("[Automatische Bookings-notificatie ... sluiten.]")
  // zijn GEEN klanttekst — nooit als mail versturen (bug 22-07: als antwoord naar info@ gemaild).
  if (/^\s*\[[\s\S]*\]\s*$/.test(klantTekst)) klantTekst = '';
  let verstuurd = false;
  let klantMail = null;
  // Op webflow-/bounce-tickets is het ticketcontact GEEN klantadres: in-thread mailen komt dan
  // bij no-reply@webflow terecht (Winny, 20 juli — Jorrens @sonny-opdracht stuiterde). Dan het
  // echte klantadres uit het formulier of uit de notitie zelf halen en als NIEUWE mail sturen.
  const contactOnbruikbaar = /no-reply@webflow|microsoftexchange|mailer-daemon|postmaster/i.test(String(t.contact?.email || ''));
  if (klantTekst) {
    if (contactOnbruikbaar) {
      const formTekst = (rowsAll || []).filter(m => m.type === 'INBOUND').map(m => clean(m.body || m.message)).find(b => /form submission/i.test(b)) || '';
      klantMail = (formTekst.match(/Email\s*:?\s*([\w.+-]+@[\w-]+\.[a-z]{2,4})(?![a-z])/i) || [])[1]
        || (feedback.match(/([\w.+-]+@[\w.-]+\.[a-z]{2,})/i) || [])[1] || null;
      if (klantMail) verstuurd = await stuurNieuweMail(klantMail, 'Je aanvraag bij Sonty', naarHtml(klantTekst));
    } else {
      verstuurd = await tPost(`/tickets/${t.id}/messages`, { message: naarHtml(klantTekst) });
    }
  }
  const mutaties = (res.acties || []).filter(a => a.type !== 'escalatie');
  const actieTekst = mutaties.length ? '\nUitgevoerd: ' + mutaties.map(a => a.samenvatting || a.type).join('; ') : '';
  // Eerlijke terugkoppeling over de aflevering: nooit "mail gestuurd" claimen als het niet lukte.
  const aflevering = verstuurd ? `\n(De klant heeft hierover een mail gekregen${klantMail ? ' op ' + klantMail : ''}.)`
    : (klantTekst ? '\n(⚠️ LET OP: de mail naar de klant kon NIET verstuurd worden, stuur hem zelf naar het klantadres.)' : '');
  for (const i of teDoen) {
    await tPost(`/tickets/${t.id}/messages`, { internal_note: true, message: `${await tagVoor(i.userId)} ✅ ${teamAntwoord || 'Verwerkt.'}${actieTekst}${aflevering}` });
  }
  logKS({ ticket: t.id, teamOpdracht: feedback.slice(0, 300), antwoord: verstuurd ? klantTekst : '(geen klantmail)', teamAntwoord: teamAntwoord.slice(0, 200), acties: res.acties });
}

module.exports = { verwerk, tGet, tPost, formatteerEmail, verwerkNotities };

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
        else if (/MENS NODIG/.test(r.resultaat)) mensNodig.push(`${regel}, ${(r.concept || '').replace(/^reden:\s*/, '').slice(0, 90)}`);
        else overig.push(`${regel}, ${r.resultaat}`);
        console.log(`[${r.ticketId}] ${r.resultaat}, ${r.klant || ''}`);
      } catch (e) { overig.push(`${id}, FOUT ${e.message}`); console.log(`[${id}] FOUT: ${e.message}`); }
    }
  }));
  console.log('\n\n======== SAMENVATTING ========');
  console.log(`✅ BEANTWOORD door Sunny (gesloten): ${beantwoord.length}`);
  console.log(`\n👤 MOET NOG DOOR EEN MENS (team Mens nodig): ${mensNodig.length}`);
  mensNodig.forEach(m => console.log('  • ' + m));
  if (overig.length) { console.log(`\n➖ Overig/overgeslagen: ${overig.length}`); overig.forEach(o => console.log('  • ' + o)); }
})().catch(e => console.error('FOUT:', e.message));

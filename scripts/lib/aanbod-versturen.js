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
  const id = await zoekWaTicketBreed(telefoon);
  return id ? { id } : null;
}


/** Trengo's zoekfunctie vindt een WhatsApp-ticket ALLEEN op de notatie waarin het
 *  nummer is opgeslagen. Zoeken op de laatste 9 cijfers (625583218) gaf nul hits,
 *  terwijl "+31625583218" het ticket wél vond — daarom opende elke verzending een
 *  NIEUW gesprek in plaats van door te gaan in het bestaande (Daimy 10-08, geval
 *  Katuscha). We proberen daarom alle gangbare notaties, meest specifiek eerst.
 *  @returns {Promise<number|null>} id van het meest recente actieve WA-ticket */
async function zoekWaTicketBreed(telefoon, { ookGesloten = false } = {}) {
  const cijfers = String(telefoon || '').replace(/\D/g, '');
  if (cijfers.length < 9) return null;
  const nat = cijfers.slice(-9);                    // 625583218
  const varianten = [`+31${nat}`, `0031${nat}`, `31${nat}`, `0${nat}`, nat];
  let gesloten = null;
  for (const term of varianten) {
    try {
      const r = await tFetch(`/tickets?term=${encodeURIComponent(term)}`);
      if (!r.ok) continue;
      const rijen = (await r.json())?.data || [];
      const wa = rijen.filter((t) => t.channel?.id === WA_KANAAL || t.channel?.type === 'WA_BUSINESS');
      const nieuwste = (lijst) => [...lijst].sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))[0];
      const open = wa.filter((t) => t.status !== 'CLOSED');
      if (open.length) return nieuwste(open).id;
      // Een gesloten gesprek is prima om te VOLGEN (een klantreactie heropent het);
      // voor verzenden willen we het niet, vandaar de schakelaar. Zonder deze terugval
      // bleef Rene Blauw's gesprek "onvindbaar" terwijl het gewoon gesloten was.
      if (wa.length && !gesloten) gesloten = nieuwste(wa).id;
    } catch { /* volgende notatie */ }
  }
  return ookGesloten ? gesloten : null;
}

/** TAAL (Daimy 21-08, Fatih: Engelstalige klant kreeg aanbod, reminder én mail in het
 *  Nederlands terwijl de taalvlag al stond). Alle planningsteksten gaan via deze toets. */
function taalVan(lead) {
  try {
    const { isEngels } = require('./taal-voorkeur.js');
    return isEngels(lead?.telefoon, lead?.email, lead?.rpItemId) ? 'en' : 'nl';
  } catch { return 'nl'; }
}
const GROET = { nl: 'Groetjes, Nanny van Sonty', en: 'Kind regards, Nanny from Sonty' };

function verWegRegel(ver, taal = 'nl') {
  // Eerlijke uitleg voor klanten buiten de vaste route (Daimy 06-08): scheelt
  // manuren, brandstof en uitstoot — en de klant snapt waarom het iets later kan.
  if (!ver) return '';
  return taal === 'en'
    ? ' You live a bit further away from us; we plan our routes as smartly as possible and combine jobs in your area. That saves unnecessary kilometres (and emissions), but it can mean it takes a little longer before we get to you.'
    : ' Je woont wat verder bij ons vandaan; we plannen ritten zo slim mogelijk in en combineren klussen bij jou in de buurt. Dat scheelt onnodige kilometers (en uitstoot), maar daardoor kan het soms iets langer duren voor we bij je zijn.';
}

/** Ligt het voorgestelde moment ver weg? Dan is "goed nieuws" de verkeerde toon
 *  (Daimy 09-08, geval Rita van Schagen: haar was 2-3 weken beloofd, ze kreeg een
 *  moment 6 weken later te horen als "goed nieuws" en reageerde terecht boos).
 *  Vanaf drie weken benoemen we het eerlijk in plaats van het te verkopen. */
function opening(voornaam, slots, taal = 'nl') {
  const eerste = slots?.[0]?.aankomst ? Date.parse(slots[0].aankomst) : null;
  const wekenWeg = eerste ? (eerste - Date.now()) / (7 * 86400000) : 0;
  if (wekenWeg >= 3) {
    return taal === 'en'
      ? `Hi ${voornaam}, I'll be honest: it's busier than we'd like (summer holidays and the construction break), so this is the first moment I can offer you for the measuring`
      : `Hoi ${voornaam}, ik ben eerlijk: het is drukker dan we zouden willen (bouwvak en vakanties), dus dit is het eerste moment dat ik je kan aanbieden om in te meten`;
  }
  return taal === 'en'
    ? `Hi ${voornaam}, good news: we can come by to measure`
    : `Hoi ${voornaam}, goed nieuws: we kunnen bij je langskomen om in te meten`;
}

function berichtTekst(voornaam, url, duurMin, geldigUren = 24, ver = false, slots = null, taal = 'nl') {
  // DE TIJD HOORT IN HET BERICHT (Daimy 26-08: "in het bericht staat helemaal niet
  // wanneer het is en hoe laat"). Wie op zijn telefoon een appje krijgt wil meteen zien
  // welk moment het is, niet eerst een link openen. Bij één moment vragen we gewoon of
  // het past; bij meer noemen we ze en dient de link om te kiezen.
  const lijst = (slots || []).filter((sl) => sl && sl.aankomst);
  const wanneer = lijst.map((sl) => slotTekst(sl, taal)).join(taal === 'en' ? ' or ' : ' of ');
  if (taal === 'en') {
    if (lijst.length === 1) {
      return `${opening(voornaam, slots, 'en')}: ${wanneer} (takes about ${duurMin} minutes).${verWegRegel(ver, 'en')} Does that work for you? Reply "yes" and I'll lock it in, or pick another time here:\n\n${url}\n\nThe time is held for you for ${geldigUren} hours.\n\n${GROET.en}`;
    }
    return `${opening(voornaam, slots, 'en')}${wanneer ? `: ${wanneer}` : ''} (takes about ${duurMin} minutes).${verWegRegel(ver, 'en')} Pick the time that suits you best here:\n\n${url}\n\nThe times are held for you for ${geldigUren} hours. If choosing doesn't work, just reply to this message.\n\n${GROET.en}`;
  }
  if (lijst.length === 1) {
    return `${opening(voornaam, slots)}: ${wanneer} (duurt ongeveer ${duurMin} minuten).${verWegRegel(ver)} Past dat bij je? Antwoord dan gewoon "ja", dan zet ik het vast. Past het niet, kies hier een andere tijd:\n\n${url}\n\nDe tijd staat ${geldigUren} uur voor je vast.\n\n${GROET.nl}`;
  }
  return `${opening(voornaam, slots)}${wanneer ? `: ${wanneer}` : ''} (duurt ongeveer ${duurMin} minuten).${verWegRegel(ver)} Kies hier de tijd die jou het beste uitkomt:\n\n${url}\n\nDe tijden staan ${geldigUren} uur voor je vast. Lukt kiezen niet, stuur dan gewoon een berichtje terug.\n\n${GROET.nl}`;
}

/** HERHAALD VOORSTEL (opvolging ronde 2). Mirjam kreeg 19-08 en 20-08 twee keer exact
 *  hetzelfde "goed nieuws"-bericht; dat leest als een bot die hapert. Een tweede ronde
 *  met dezelfde tijd zegt gewoon dat het een herinnering is. */
function herhalingTekst(voornaam, slots, taal = 'nl') {
  const wanneer = (slots || []).map((x) => slotTekst(x, taal)).join(taal === 'en' ? ' or ' : ' of ');
  if (taal === 'en') {
    return `Hi ${voornaam}, a quick follow-up from the planning team. I had suggested ${wanneer} for the measuring and would love to hear whether that works for you. If it does, just reply "that works" and I'll lock it in. If not, name a day that suits you and I'll look again.\n\n${GROET.en}`;
  }
  return `Hoi ${voornaam}, even een berichtje van de planning. Ik had je ${wanneer} voorgesteld om in te meten en hoor graag of dat past. Past het, antwoord dan gewoon "dat past" en ik zet hem vast. Past het niet, noem dan gerust een dag die jou wel uitkomt, dan kijk ik opnieuw.\n\n${GROET.nl}`;
}

/** GEEN ALTERNATIEF GEVONDEN. De klant vroeg een andere dag of eerder, en de motor kan
 *  niets bieden. Dan mag het niet stil blijven (Fatih 19-08 vroeg "faster?", de motor vond
 *  niets en niemand zei dat). Eerlijk zeggen wat wél kan en het oude voorstel laten staan. */
function geenAlternatiefTekst(voornaam, { slots = [], wilEerder = false, dagen = [], taal = 'nl' } = {}) {
  const oud = (slots || []).map((x) => slotTekst(x, taal)).join(taal === 'en' ? ' or ' : ' of ');
  const DAGNL = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  const DAGEN_ = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const gevraagd = (dagen || []).map((d) => (taal === 'en' ? DAGEN_[d] : DAGNL[d])).filter(Boolean).join(taal === 'en' ? ' or ' : ' of ');
  if (taal === 'en') {
    const wat = wilEerder ? 'earlier' : (gevraagd ? `on ${gevraagd}` : 'on another day');
    return `Hi ${voornaam}, I've had a good look, but unfortunately I can't offer you anything ${wat} at the moment. It's busier than we'd like (holidays and the construction break) and our surveyors only measure Monday to Thursday between 09:00 and 15:00.${oud ? ` ${oud.charAt(0).toUpperCase() + oud.slice(1)} is still available for you; reply "that works" and I'll lock it in.` : ''} Would a different day work for you? Then I'll look again. A colleague is also keeping an eye on this.\n\n${GROET.en}`;
  }
  const wat = wilEerder ? 'eerder' : (gevraagd ? `op ${gevraagd}` : 'op een andere dag');
  return `Hoi ${voornaam}, ik heb goed gekeken, maar ik kan je op dit moment helaas niets ${wat} aanbieden. Het is drukker dan we zouden willen (vakanties en bouwvak) en onze inmeters meten alleen van maandag tot en met donderdag tussen 09:00 en 15:00.${oud ? ` ${oud.charAt(0).toUpperCase() + oud.slice(1)} staat nog voor je klaar; antwoord "dat past" en ik zet hem vast.` : ''} Zou een andere dag je wel uitkomen? Dan kijk ik opnieuw. Een collega kijkt hier ook even mee.\n\n${GROET.nl}`;
}

// Goedgekeurde template "inmeetafspraak_kiezen" (id 243999): voor klanten buiten het
// 24-uursvenster of zonder bestaand WhatsApp-gesprek. Werkt pas na Meta-goedkeuring.
const TEMPLATE_HSM = 243999;

const DAGK = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MNDK = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const DAGK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MNDK_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function slotTekst(sl, taal = 'nl') {
  const d = new Date(sl.aankomst);
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (taal === 'en') return `${DAGK_EN[d.getDay()]} ${d.getDate()} ${MNDK_EN[d.getMonth()]} at ${t}`;
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
    const bestaand1 = await zoekWaTicketBreed(tel);
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
  const bestaandTicket = await zoekWaTicketBreed(tel);
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
  const taal = taalVan(aanbod.lead);
  const voornaam = (aanbod.lead.naam || 'daar').split(' ')[0];
  let vrijeTekst = aanbod.herhaling
    ? herhalingTekst(voornaam, aanbod.slots, taal)
    : berichtTekst(voornaam, url, aanbod.duurMin, aanbod.geldigUren || 24, aanbod.ver === true, aanbod.slots, taal);
  if (aanbod.klantReply && !aanbod.herhaling) {
    // antwoord op wat de klant vroeg: aanhef ervoor, "Hoi X," uit de hoofdtekst halen
    const DAGNL = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
    const DAGEN_ = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dagen = (aanbod.klantReply.dagen || []).map((d) => (taal === 'en' ? DAGEN_[d] : DAGNL[d])).filter(Boolean).join(taal === 'en' ? ' or ' : ' of ');
    const aanhef = taal === 'en'
      ? `Hi ${voornaam}, thanks for your message${dagen ? ` and sorry for the wait. You asked about ${dagen}: that is possible` : " and sorry for the wait. I have looked again"}. `
      : `Hoi ${voornaam}, dank voor je bericht${dagen ? ` en sorry dat je even moest wachten. Je vroeg naar ${dagen}: dat kan` : ' en sorry dat je even moest wachten. Ik heb opnieuw gekeken'}. `;
    vrijeTekst = aanhef + vrijeTekst.replace(/^(Hoi|Hi) [^,]+, /, '').replace(/^(goed nieuws|good news): /i, '');
  }
  const stuurVrij = async () => {
    const ticket = await zoekWaTicket(aanbod.lead.telefoon);
    if (!ticket) return { ok: false, reden: 'geen WhatsApp-gesprek' };
    const r = await tFetch(`/tickets/${ticket.id}/messages`, {
      method: 'POST', body: JSON.stringify({ message: vrijeTekst, type: 'OUTBOUND' }),
    });
    return r.ok ? { ok: true, ticket: ticket.id, via: 'vrij bericht' + (taal === 'en' ? ' (EN)' : '') + (aanbod.herhaling ? ' (herhaling)' : '') }
      : { ok: false, reden: `Trengo ${r.status}`, ticket: ticket.id };
  };
  // ENGELS of HERHALING: de goedgekeurde templates zijn Nederlands en zeggen altijd
  // "goed nieuws". Dan eerst het vrije bericht proberen (lukt binnen het 24-uursvenster,
  // en dat staat bijna altijd open omdat de klant net met ons appte); pas als dat niet
  // kan het template als vangnet — liever een Nederlands voorstel dan geen voorstel.
  // Ook bij een moment ≥3 weken weg (template zegt altijd "goed nieuws" — Marius 21-08 kreeg
  // "goed nieuws: di 29 sep" na twee dagen stilte) en bij een antwoord op een klantreactie
  // (dan hoort er "dank voor je bericht, je vroeg naar dinsdag" boven te staan).
  const eerste = aanbod.slots?.[0]?.aankomst ? Date.parse(aanbod.slots[0].aankomst) : 0;
  const verWeg = eerste && (eerste - Date.now()) / (7 * 86400000) >= 3;
  if (taal === 'en' || aanbod.herhaling || verWeg || aanbod.klantReply) {
    const vrij = await stuurVrij();
    if (vrij.ok) return vrij;
    const viaTemplate = await stuurWhatsAppTemplate(aanbod, url);
    if (viaTemplate.ok) return { ...viaTemplate, via: viaTemplate.via + ' (vrij bericht lukte niet: ' + vrij.reden + ')' };
    return { ok: false, reden: `${vrij.reden}; template: ${viaTemplate.reden}` };
  }
  // TEMPLATE EERST (Daimy 06-08: "die gaan we gewoon altijd gebruiken") — werkt ook
  // buiten het 24-uursvenster. Zolang Meta het template nog niet heeft goedgekeurd
  // (PENDING) valt hij automatisch terug op een gewoon bericht in een open gesprek.
  const viaTemplate = await stuurWhatsAppTemplate(aanbod, url);
  if (viaTemplate.ok) return viaTemplate;
  const vrij = await stuurVrij();
  if (vrij.ok) return { ...vrij, via: 'vrij bericht (template: ' + viaTemplate.reden + ')' };
  return { ok: false, reden: `${vrij.reden} (template: ${viaTemplate.reden})`, ticket: vrij.ticket };
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
        subject: taalVan(aanbod.lead) === 'en' ? 'Choose your measuring slot at Sonty' : 'Kies je inmeetmoment bij Sonty',
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

  const taal = taalVan(aanbod.lead);
  // zelfde eerlijke opening als WhatsApp: vanaf 3 weken geen "goed nieuws" meer
  const kop = opening(voornaam, aanbod.slots, taal).replace(/^(Hoi|Hi) [^,]+, /, '');
  const html = taal === 'en'
    ? `<p>Hi ${voornaam},</p>
<p>${kop.charAt(0).toUpperCase() + kop.slice(1)} (takes about ${aanbod.duurMin} minutes).${verWegRegel(aanbod.ver === true, 'en')}</p>
<p><a href="${url}" style="display:inline-block;background:#F97316;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Choose your measuring slot</a></p>
<p>The times are held for you for ${geldigUren} hours. If choosing doesn't work, simply reply to this e-mail.</p>
<p>Good to know: our surveyor drives a route, so it can sometimes be an hour earlier or later than the chosen time. If so, we'll let you know.</p>
<p>Kind regards,<br>Nanny from Sonty</p>`
    : `<p>Hoi ${voornaam},</p>
<p>${kop.charAt(0).toUpperCase() + kop.slice(1)} (duurt ongeveer ${aanbod.duurMin} minuten).${verWegRegel(aanbod.ver === true)}</p>
<p><a href="${url}" style="display:inline-block;background:#F97316;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Kies je inmeetmoment</a></p>
<p>De tijden staan ${geldigUren} uur voor je vast. Lukt kiezen niet, beantwoord dan gewoon deze mail.</p>
<p>Goed om te weten: onze inmeter rijdt een route, dus het kan soms een uur eerder of later worden dan het gekozen moment. Als dat zo is laten we het je even weten.</p>
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
function bevestigingTekst(voornaam, slot, duurMin, taal = 'nl') {
  const d = new Date(slot.aankomst);
  if (taal === 'en') {
    const dagEn = d.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' });
    const vanEn = d.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
    const vVan = new Date(+d - 60 * 60000).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
    const vTot = new Date(+d + 90 * 60000).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
    return `Hi ${voornaam}, good news, it's booked! On ${dagEn} ${slot.inmeter} will come by to measure, which takes about ${duurMin} minutes. ` +
      `We expect to be with you around ${vanEn}. As we drive a route that day it can shift a little, so please be home between ${vVan} and ${vTot}. ` +
      `Something come up? Just send us a message.`;
  }
  const dag = d.toLocaleString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' });
  const van = d.toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  const tot = new Date(+d + 30 * 60000).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  // Thuisblijf-venster (Daimy 18-08): geen "wij laten het weten"-belofte, de klant
  // moet er gewoon zijn van een uur vóór tot een uur ná het geplande blok.
  const vensterVan = new Date(+d - 60 * 60000).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  const vensterTot = new Date(+d + 90 * 60000).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  return `Hoi ${voornaam}, goed nieuws, hij staat! ${dag.charAt(0).toUpperCase() + dag.slice(1)} komt ${slot.inmeter} bij je langs om in te meten, dat duurt zo'n ${duurMin} minuutjes. ` +
    `We verwachten rond ${van} bij je te zijn. Omdat we die dag een route rijden kan het iets schuiven, dus fijn als je tussen ${vensterVan} en ${vensterTot} thuis bent. ` +
    `Komt er iets tussen? Stuur gerust een berichtje.`;
}

async function verstuurBevestiging(aanbod, slot) {
  // Verzendpoort: bevestiging na boeking is fail-open (mag door bij storing en
  // mens-actief — stilte na een boeking is de enige echt foute uitkomst), maar
  // de stil-lijst wint altijd.
  {
    const { magSturen } = require('./verzend-poort.js');
    const tel = aanbod?.telefoon || aanbod?.lead?.telefoon;
    const ticket = tel ? await zoekWaTicket(tel).catch(() => null) : null;
    const poort = await magSturen({ telefoon: tel, ticketId: ticket?.id, soort: 'bevestiging' });
    if (!poort.ok) { console.log('  verzendpoort: bevestiging NIET verstuurd (' + poort.reden + ')'); return { ok: false, stil: true, poort: poort.reden }; }
  }
  const voornaam = (aanbod.lead.naam || 'daar').split(' ')[0];
  const taalB = taalVan(aanbod.lead);
  const tekst = bevestigingTekst(voornaam, slot, aanbod.duurMin, taalB);
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
      body: JSON.stringify({ channel_id: PLANNING_KANAAL_OVERRIDE || AANVRAGEN_KANAAL, contact_identifier: aanbod.lead.email, subject: taalB === 'en' ? 'Your measuring appointment at Sonty is confirmed' : 'Je inmeetafspraak bij Sonty staat vast' }),
    });
    const nieuw = r1.ok ? await r1.json().catch(() => null) : null;
    if (nieuw?.id) {
      const html = `<p>${tekst.replace(/\. /g, '.</p><p>')}</p><p>${taalB === 'en' ? 'Kind regards,<br>Nanny from Sonty' : 'Groetjes,<br>Nanny van Sonty'}</p>`;
      const r2 = await tFetch(`/tickets/${nieuw.id}/messages`, { method: 'POST', body: JSON.stringify({ message: html, body_type: 'html' }) });
      if (r2.ok) await tFetch(`/tickets/${nieuw.id}/close`, { method: 'POST', body: '{}' });
      mail = { ok: r2.ok, reden: r2.ok ? undefined : `Trengo ${r2.status}` };
    } else mail = { ok: false, reden: `ticket: Trengo ${r1.status}` };
  }
  return { wa, mail, ergensGelukt: wa.ok || mail.ok };
}

function herinneringTekst(voornaam, slot, duurMin, dagenVooraf = 1, taal = 'nl') {
  const d = new Date(slot.aankomst);
  if (taal === 'en') {
    const vanEn = d.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
    const wanneerEn = dagenVooraf <= 1 ? 'tomorrow' : `on ${d.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })}`;
    const slot2En = dagenVooraf <= 1 ? 'See you tomorrow!' : "Doesn't suit after all? Just send us a message.";
    const vVan = new Date(+d - 60 * 60000).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
    const vTot = new Date(+d + 90 * 60000).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
    return `Hi ${voornaam}, a quick reminder: ${wanneerEn} ${slot.inmeter} will come by to measure, which only takes about ${duurMin} minutes. ` +
      `We expect to be with you around ${vanEn}. As we drive a route it can shift a little, so please be home between ${vVan} and ${vTot}. ${slot2En}`;
  }
  const van = d.toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  const tot = new Date(+d + 30 * 60000).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  const wanneer = dagenVooraf <= 1 ? 'morgen'
    : d.toLocaleString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' });
  const slot2 = dagenVooraf <= 1 ? 'Tot morgen!' : 'Komt het toch niet uit? Stuur dan even een berichtje terug.';
  const vensterVan = new Date(+d - 60 * 60000).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  const vensterTot = new Date(+d + 90 * 60000).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  return `Hoi ${voornaam}, kleine herinnering: ${wanneer} komt ${slot.inmeter} bij je langs om in te meten, dat duurt maar zo'n ${duurMin} minuutjes. ` +
    `We verwachten rond ${van} bij je te zijn. Omdat we een route rijden kan het iets schuiven, dus fijn als je tussen ${vensterVan} en ${vensterTot} thuis bent. ${slot2}`;
}

/** Beide kanalen; geeft per kanaal terug wat er gebeurd is. Eén kanaal gelukt = aanbod is onderweg. */
async function verstuurAanbod(aanbod, url) {
  // VERZENDPOORT (18-08, Hans de Lamboij): stil-lijst + mens-actief + max 2
  // voorstellen per week — alles in één toets vóór er iets de deur uit gaat.
  {
    const { magSturen, meldMensNodig } = require('./verzend-poort.js');
    const ticket = aanbod?.lead?.telefoon ? await zoekWaTicket(aanbod.lead.telefoon).catch(() => null) : null;
    const poort = await magSturen({ telefoon: aanbod?.lead?.telefoon, email: aanbod?.lead?.email, ticketId: ticket?.id, soort: 'voorstel', opVerzoek: !!aanbod?.klantReply });
    if (!poort.ok) {
      if (poort.mensNodig) await meldMensNodig(aanbod?.lead?.naam || aanbod?.lead?.telefoon || '?', poort.reden);
      console.log('  verzendpoort: aanbod NIET verstuurd (' + poort.reden + ')');
      return { wa: { ok: false, reden: poort.reden }, mail: { ok: false, reden: poort.reden }, ergensGelukt: false, stil: true, poort: poort.reden };
    }
  }
  const wa = await stuurWhatsApp(aanbod, url).catch((e) => ({ ok: false, reden: e.message }));
  const mail = await stuurMail(aanbod, url).catch((e) => ({ ok: false, reden: e.message }));
  // VERZEND-SPIEGEL (les 06-08, lege-tijden-incident): het bericht zoals de klant het
  // krijgt gaat 1-op-1 mee naar Telegram. Een kapotte verzending is dan binnen een
  // minuut zichtbaar in plaats van pas als de klant (of Daimy) hem ziet.
  try {
    const slots = (aanbod.slots || []).map((sl, i) => `${i + 1}. ${slotTekst(sl)}`).join('\n');
    const spiegel = `Hoi ${(aanbod.lead.naam || 'daar').split(' ')[0]}, goed nieuws: we kunnen bij je langskomen om in te meten.${aanbod.ver ? ' [ver-weg-versie]' : ''}\n\n${slots || '(GEEN TIJDEN?!)'}\n\nTik op een knop en we zetten hem vast.`;
    const { planningTelegram } = require('./telegram-planning.js');
    await planningTelegram(`📤 Verstuurd naar ${aanbod.lead.naam} (wa: ${wa.ok ? wa.via : 'niet — ' + wa.reden}, mail: ${mail.ok ? 'ok' : 'niet — ' + mail.reden}). Dit kreeg de klant:\n\n${spiegel}`);
  } catch { /* spiegel mag verzending nooit blokkeren */ }
  return { wa, mail, ergensGelukt: wa.ok || mail.ok };
}

module.exports = { verstuurAanbod, verstuurBevestiging, herinneringTekst, bevestigingTekst, herhalingTekst, geenAlternatiefTekst, taalVan, GROET, slotTekst, stuurWhatsApp, stuurMail, zoekWaTicket, zoekWaTicketBreed };

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

#!/usr/bin/env node
// SEO-agent (Daimy 29-08-2026): "een agent die zodra de website live is linkbuilding gaat doen en SEO op alle
// vlakken", met als doel: organisch nummer 1 op de betaalde zoekwoorden en nieuwe goede zoekwoorden, en vindbaar
// zijn voor grote afnemers (VvE's, gemeenten, overheid, bedrijven).
//
// Rondes:  node scripts/seo-agent.js --dag       (dagelijks 07:30: livegang-check, techniek-audit, goedkeuringen, TenderNed)
//          node scripts/seo-agent.js --week      (maandag 08:30: posities, links, content, zakelijk, weekrapport)
//          node scripts/seo-agent.js --status    (alleen tonen, niets schrijven)
//          --dry  = niets naar Telegram, niets versturen, geen state opslaan
// Beslislogica staat in scripts/lib/seo-agent-logica.js en is gedekt door scenario-lab/onderdelen/seo-agent.js.
// Regels: nooit versturen zonder "ja L<nr>" van Daimy + proefgeval + verzendenAan; geen betaalde links; geen namen
// van andere zonweringbedrijven; alleen nieuwe technische problemen melden; vóór livegang alleen voorbereiden.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require('./lib/seo-agent-logica.js');

const ROOT = path.join(__dirname, '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/seo-agent/config.json'), 'utf8'));
const STATE_PAD = path.join(ROOT, 'data/seo-agent/state.json');
const BRONNEN_PAD = path.join(ROOT, 'data/seo-agent/link-bronnen.json');
const BRIEFS_MAP = path.join(ROOT, 'data/seo-agent/briefs');
const DRY = process.argv.includes('--dry');
const MODE = process.argv.includes('--week') ? 'week' : process.argv.includes('--status') ? 'status' : 'dag';
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh) sonty-seo-agent/1.0', 'Accept-Language': 'nl-NL,nl' };
const nu = () => new Date().toISOString();
const log = (...a) => console.log(nu().slice(0, 19), ...a);

function leesState() { try { return JSON.parse(fs.readFileSync(STATE_PAD, 'utf8')); } catch { return { live: false, techniek: { problemen: [] }, links: {}, voorstellen: [], briefs: [], tenders: {}, rapporten: [] }; } }
function bewaarState(s) { if (DRY) return; fs.mkdirSync(path.dirname(STATE_PAD), { recursive: true }); fs.writeFileSync(STATE_PAD, JSON.stringify(s, null, 1)); }

async function fetchTekst(url, ms = 20000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { headers: UA, signal: ctl.signal, redirect: 'follow' }); return { status: r.status, html: await r.text(), url: r.url }; }
  catch (e) { return { status: 0, html: '', fout: e.message }; } finally { clearTimeout(t); }
}

// ── Telegram (hoofdchat Daimy), zelfde bot als de poller ──
const TG_TOKEN = (() => { try { return /BOT_TOKEN = '([^']+)'/.exec(fs.readFileSync(path.join(__dirname, 'telegram-poller.js'), 'utf8'))[1]; } catch { return process.env.TELEGRAM_BOT_TOKEN; } })();
const TG_CHAT = 1700128390;
async function telegram(tekst) {
  if (DRY) { log('[dry] telegram:\n' + tekst); return; }
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TG_CHAT, text: tekst }) }).catch((e) => log('telegram-fout', e.message));
}
/** Goedkeuringen uit de Telegram-inbox (scripts/telegram-inbox.txt) sinds de vorige ronde. */
function leesGoedkeuringen(sinds) {
  let regels = [];
  try { regels = fs.readFileSync(path.join(__dirname, 'telegram-inbox.txt'), 'utf8').split('\n'); } catch { return []; }
  const uit = [];
  for (const r of regels) {
    const m = /^\[([^\]]+)\]\s*(.*)$/.exec(r); if (!m) continue;
    const ts = m[1].replace(' ', 'T'); if (sinds && ts < sinds) continue;
    const g = L.leesGoedkeuring(m[2]); if (g) uit.push({ ...g, op: ts });
  }
  return uit;
}

// ── 1. Livegang ──
async function checkLive(state) {
  const r = await fetchTekst(CFG.siteLive);
  const live = L.isNieuweSiteLive(r.html);
  if (live && !state.live) { state.liveSinds = nu(); await telegram('SEO-agent: sonty.nl serveert nu de nieuwe site. Ik ga over van voorbereiden naar actief (linkverzoeken en Bedrijfsprofiel-acties komen als voorstel op Telegram).'); }
  state.live = live;
  return live;
}

// ── 2. Techniek: audit van de sitemap van de site die telt (live = sonty.nl, anders de nieuwe site) ──
async function techniek(state) {
  const base = state.live ? CFG.siteLive : CFG.siteNieuw;
  const sm = await fetchTekst(base + '/sitemap.xml');
  const urls = [...sm.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, base));
  const problemen = []; let gecheckt = 0;
  for (const u of urls.slice(0, 150)) {
    const r = await fetchTekst(u, 15000); gecheckt++;
    const pad = u.replace(base, '') || '/';
    if (r.status !== 200) { problemen.push({ pad, probleem: `HTTP ${r.status}` }); continue; }
    const h = r.html;
    const title = (h.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '';
    const desc = (h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    if (!title) problemen.push({ pad, probleem: 'geen titel' }); else if (title.length > 65) problemen.push({ pad, probleem: `titel te lang (${title.length})` });
    if (!desc) problemen.push({ pad, probleem: 'geen meta-omschrijving' }); else if (desc.length > 160) problemen.push({ pad, probleem: `omschrijving te lang (${desc.length})` });
    if (!/<link rel="canonical"/.test(h)) problemen.push({ pad, probleem: 'geen canonical' });
    const h1 = (h.match(/<h1[^>]*>/g) || []).length; if (h1 !== 1) problemen.push({ pad, probleem: `${h1} H1's` });
    if (/<meta name="robots" content="[^"]*noindex/.test(h)) problemen.push({ pad, probleem: 'noindex' });
    if (!/application\/ld\+json/.test(h) && !/\/(privacy|cookie|algemene-voorwaarden)/.test(pad)) problemen.push({ pad, probleem: 'geen structured data' });
    const zonderAlt = (h.match(/<img\b(?![^>]*\balt="[^"]+")[^>]*>/g) || []).length; if (zonderAlt) problemen.push({ pad, probleem: `${zonderAlt} afbeeldingen zonder alt` });
  }
  const nulmeting = !state.techniek?.op; // eerste ronde: alleen samenvatten, geen alarm per punt (R4)
  const nieuw = L.nieuweProblemen(state.techniek.problemen, problemen);
  const opgelost = L.opgelosteProblemen(state.techniek.problemen, problemen);
  state.techniek = { op: nu(), base, paginas: gecheckt, problemen, laatsteNieuw: nieuw.length, laatsteOpgelost: opgelost.length };
  const telPer = {}; for (const p of problemen) telPer[p.probleem.replace(/\s*\(.*\)|\d+ /g, '')] = (telPer[p.probleem.replace(/\s*\(.*\)|\d+ /g, '')] || 0) + 1;
  if (nulmeting) await telegram(`SEO-agent nulmeting techniek op ${base}: ${gecheckt} pagina's, ${problemen.length} punten.\n` + Object.entries(telPer).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${v}x ${k}`).join('\n') + '\nVanaf nu meld ik alleen nieuwe punten.');
  else if (nieuw.length) await telegram(`SEO-agent techniek: ${nieuw.length} ${nieuw.length === 1 ? 'nieuw probleem' : 'nieuwe problemen'} op ${base}:\n` + nieuw.slice(0, 8).map((p) => `- ${p.pad}: ${p.probleem}`).join('\n') + (nieuw.length > 8 ? `\n… en ${nieuw.length - 8} meer` : ''));
  log(`techniek: ${gecheckt} pagina's, ${problemen.length} open, ${nieuw.length} nieuw, ${opgelost.length} opgelost`);
  return { paginas: gecheckt, nieuw: nieuw.length, opgelost: opgelost.length, open: problemen.length };
}

// ── 3. Posities via Search Console (pas als de sleutel er is) ──
async function posities(state) {
  const sleutel = path.join(ROOT, CFG.searchConsole.sleutel);
  if (!fs.existsSync(sleutel)) { log('posities: geen Search Console-sleutel, overslaan'); return { beschikbaar: false }; }
  try {
    const { google } = require('googleapis');
    const auth = new google.auth.GoogleAuth({ keyFile: sleutel, scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });
    const sc = google.searchconsole({ version: 'v1', auth });
    const eind = new Date(); const start = new Date(eind - 28 * 86400000);
    const res = await sc.searchanalytics.query({ siteUrl: CFG.searchConsole.property, requestBody: { startDate: start.toISOString().slice(0, 10), endDate: eind.toISOString().slice(0, 10), dimensions: ['query'], rowLimit: 5000 } });
    const rijen = res.data.rows || [];
    const betaald = JSON.parse(fs.readFileSync(path.join(ROOT, CFG.betaaldeZoekwoordenBron), 'utf8')).top_kosten.map((k) => k.zoekwoord);
    const per = new Map(rijen.map((r) => [r.keys[0], r]));
    const match = betaald.map((w) => ({ zoekwoord: w, positie: per.get(w)?.position ?? null, klikken: per.get(w)?.clicks ?? 0 }));
    const uit = { beschikbaar: true, op: nu(), totaal: betaald.length, top3: match.filter((m) => m.positie && m.positie <= 3).length, top10: match.filter((m) => m.positie && m.positie <= 10).length, klikken: Math.round(rijen.reduce((s, r) => s + r.clicks, 0)), betaald: match };
    state.posities = uit; return uit;
  } catch (e) { log('posities-fout', e.message.slice(0, 120)); return { beschikbaar: false, fout: e.message }; }
}

// ── 4. Links: bronnen controleren, voorstellen opstellen, goedkeuringen verwerken ──
async function links(state) {
  const bronnen = JSON.parse(fs.readFileSync(BRONNEN_PAD, 'utf8')).bronnen;
  state.links = state.links || {}; state.voorstellen = state.voorstellen || [];
  let vermeld = 0, nieuweVoorstellen = 0;
  for (const b of bronnen) {
    const st = state.links[b.id] || {};
    const r = b.url ? await fetchTekst(b.url) : { status: 0, html: '' };
    const besluit = L.beslisProspect({ bron: b, html: r.html, status: b.url ? r.status : null, live: state.live, alBenaderdOp: st.benaderdOp });
    st.status = r.status; st.actie = besluit.actie; st.reden = besluit.reden; st.gecheckt = nu();
    if (besluit.actie === 'al-vermeld') { st.vermeld = true; vermeld++; }
    log(`link ${b.id} ${b.naam}: HTTP ${r.status}, ${besluit.actie}${besluit.reden ? ' (' + besluit.reden + ')' : ''}`);
    if (besluit.actie === 'voorstel-opstellen' && !state.voorstellen.some((v) => v.bronId === b.id && v.status === 'open') && nieuweVoorstellen < CFG.maxVoorstellenPerWeek) {
      const id = `L${b.id.replace(/\D/g, '')}`;
      state.voorstellen.push({ id, bronId: b.id, naam: b.naam, url: b.url, tekst: L.linkVerzoekTekst(b), status: 'open', op: nu() });
      nieuweVoorstellen++;
    }
    state.links[b.id] = st;
  }
  const open = state.voorstellen.filter((v) => v.status === 'open');
  if (nieuweVoorstellen) await telegram(`SEO-agent links: ${nieuweVoorstellen} nieuw linkverzoek klaar voor jouw akkoord.\n` + open.slice(-nieuweVoorstellen).map((v) => `${v.id}: ${v.naam}\n${v.tekst.split('\n').slice(2, 5).join(' ')}`).join('\n\n') + `\n\nAntwoord "ja ${open[open.length - 1].id}" om te versturen (ik verstuur pas na jouw ja, en pas als verzenden aan staat).`);
  return { vermeld, voorstellen: nieuweVoorstellen, verstuurd: state.voorstellen.filter((v) => v.status === 'verstuurd').length };
}
async function goedkeuringen(state) {
  const sinds = state.goedkeuringenTot || null;
  for (const g of leesGoedkeuringen(sinds)) {
    const v = (state.voorstellen || []).find((x) => x.id === g.id && x.status === 'open');
    if (!v) continue;
    if (!g.akkoord) { v.status = 'afgewezen'; v.beslistOp = g.op; continue; }
    const mag = L.magVersturen({ goedgekeurd: true, verzendenAan: CFG.verzendenAan, proefgevalKlaar: CFG.proefgevalKlaar, eersteVerzending: !(state.voorstellen || []).some((x) => x.status === 'verstuurd') });
    if (!mag.mag) { v.status = 'goedgekeurd-wacht'; v.reden = mag.reden; await telegram(`SEO-agent: ${v.id} is goedgekeurd maar nog niet verstuurd: ${mag.reden}. Zet verzendenAan in data/seo-agent/config.json na het proefgeval.`); continue; }
    v.status = 'goedgekeurd'; // versturen gebeurt in verstuur(); hier alleen registreren
  }
  state.goedkeuringenTot = nu().replace('Z', '');
}
/** Versturen via Trengo (aanvragen@), alleen goedgekeurde voorstellen mét schakelaar aan. Contact-e-mail moet in de bron staan. */
async function verstuur(state) {
  const TT = (() => { try { return fs.readFileSync(path.join(ROOT, '.trengo-api-token.txt'), 'utf8').trim(); } catch { return null; } })();
  for (const v of (state.voorstellen || []).filter((x) => x.status === 'goedgekeurd')) {
    const bron = JSON.parse(fs.readFileSync(BRONNEN_PAD, 'utf8')).bronnen.find((b) => b.id === v.bronId);
    if (!bron?.contactEmail) { v.status = 'goedgekeurd-wacht'; v.reden = 'geen contactadres in link-bronnen.json'; continue; }
    if (!TT || DRY) { log(`[dry/geen token] zou versturen: ${v.id} naar ${bron.contactEmail}`); continue; }
    try {
      const contact = await (await fetch('https://app.trengo.com/api/v2/contacts', { method: 'POST', headers: { Authorization: 'Bearer ' + TT, 'Content-Type': 'application/json' }, body: JSON.stringify({ channel_id: 1363384, email: bron.contactEmail, name: bron.contactNaam || bron.naam }) })).json();
      const ticket = await (await fetch('https://app.trengo.com/api/v2/tickets', { method: 'POST', headers: { Authorization: 'Bearer ' + TT, 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: contact.id, channel_id: 1363384, subject: `Vermelding Sonty op ${bron.naam}`, body_text: v.tekst }) })).json();
      v.status = 'verstuurd'; v.verstuurdOp = nu(); v.ticket = ticket.id; state.links[v.bronId].benaderdOp = nu();
      await telegram(`SEO-agent: ${v.id} verstuurd naar ${bron.naam} (${bron.contactEmail}), ticket ${ticket.id}.`);
    } catch (e) { v.reden = e.message; log('verstuur-fout', v.id, e.message); }
  }
}

// ── 5. Content: zoekwoord-ontdekking (autocomplete) + briefs, incl. zakelijk ──
async function suggest(q) {
  try { const r = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&hl=nl&gl=nl&q=${encodeURIComponent(q)}`, { headers: UA }); return (await r.json())[1] || []; } catch { return []; }
}
async function content(state) {
  fs.mkdirSync(BRIEFS_MAP, { recursive: true });
  const betaald = JSON.parse(fs.readFileSync(path.join(ROOT, CFG.betaaldeZoekwoordenBron), 'utf8')).top_kosten.slice(0, 25).map((k) => k.zoekwoord);
  const seeds = [...new Set([...betaald.map((w) => w.split(' ').slice(0, 2).join(' ')), ...CFG.zakelijkeSeeds])];
  const gevonden = new Map();
  for (const s of seeds.slice(0, 40)) { for (const v of await suggest(s)) if (!gevonden.has(v)) gevonden.set(v, s); await new Promise((r) => setTimeout(r, 150)); }
  const bekend = new Set((state.zoekwoorden || []).map((z) => z.woord));
  const nieuw = [...gevonden].filter(([w]) => !bekend.has(w)).map(([w, seed]) => ({ woord: w, seed, zakelijk: CFG.zakelijkeSeeds.includes(seed), gezien: nu() }));
  state.zoekwoorden = [...(state.zoekwoorden || []), ...nieuw];
  // brief: zakelijke termen gebundeld tot één wekelijkse brief (één sterke pagina per groep, geen massaproductie)
  const zakelijk = state.zoekwoorden.filter((z) => z.zakelijk).map((z) => z.woord);
  const briefPad = path.join(BRIEFS_MAP, `${nu().slice(0, 10)}-zakelijk.md`);
  if (!DRY && nieuw.some((z) => z.zakelijk)) fs.writeFileSync(briefPad, ['# Brief zakelijk (VvE, gemeente, overheid, bedrijven)', '', `Bijgewerkt ${nu().slice(0, 10)}. Echte zoekformuleringen uit Google-autocomplete (Nederland); volumes onbekend, formuleringen wel zeker.`, '', ...zakelijk.map((w) => `- ${w}`), '', '## Regels voor de tekst', '- Alleen feiten uit eigen systemen: prijsmotor, garantie 3 jaar montage / 5 jaar product / 7 jaar motor, Arbo-verplichting (Arbobesluit art. 6.4) alleen met bronvermelding, referenties alleen met toestemming van de klant.', '- Eén pagina per doelgroep (VvE, kantoor/bedrijfspand, school/zorg, gemeente/overheid), geen varianten.', '- Originaliteitscheck vóór publicatie: node scripts/originaliteit-check.mjs (sonty-website).', '- Geen namen van andere zonweringbedrijven.'].join('\n'));
  log(`content: ${gevonden.size} suggesties, ${nieuw.length} nieuw (${nieuw.filter((z) => z.zakelijk).length} zakelijk)`);
  return { briefs: fs.existsSync(BRIEFS_MAP) ? fs.readdirSync(BRIEFS_MAP).length : 0, concepten: 0, nieuweZoekwoorden: nieuw.length, nieuwZakelijk: nieuw.filter((z) => z.zakelijk).map((z) => z.woord) };
}

// ── 6. Zakelijk: TenderNed-aanbestedingen met zonwering in de regio (publieke API; bij storing: melden, niets verzinnen) ──
async function tenders(state) {
  if (!CFG.tenderned?.aan) return { aan: false };
  state.tenders = Array.isArray(state.tenders?.gezien) ? state.tenders : { gezien: [] };
  const nieuw = [];
  for (const term of CFG.tenderned.zoektermen) {
    // 'search=' is de werkende zoekparameter (q/zoekterm worden genegeerd, gemeten 29-08); daarnaast zelf op titel filteren
    const url = `https://www.tenderned.nl/papi/tenderned-rs-tns/v2/publicaties?search=${encodeURIComponent(term)}&page=0&size=20&sort=publicatieDatum,desc`;
    const r = await fetchTekst(url, 20000);
    if (r.status !== 200) { log(`tenderned ${term}: HTTP ${r.status}`); continue; }
    let d; try { d = JSON.parse(r.html); } catch { continue; }
    for (const p of d.content || []) {
      const id = String(p.publicatieId || p.kenmerk); if (!id || state.tenders.gezien.includes(id)) continue;
      const titel = String(p.aanbestedingNaam || ''); const besch = String(p.opdrachtBeschrijving || '');
      const ZONW = /\b(zonwering|zonweringen|buitenzonwering|binnenzonwering|zonneschermen?|screens?|rolluiken?|zonwerend|markiezen|lamellen)\b/i; // heel woord: geen touchscreens/screening
      const inRegio = new RegExp('\\b(' + [...CFG.regio, 'Zuid-Holland', 'Haaglanden', 'Rijnmond'].map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i').test((p.opdrachtgeverNaam || '') + ' ' + besch);
      if (!(ZONW.test(titel) || (ZONW.test(besch) && inRegio))) continue; // zonwering in de titel, of in de tekst én in onze regio
      if (p.sluitingsDatum && new Date(p.sluitingsDatum) < new Date()) { state.tenders.gezien.push(id); continue; } // al gesloten
      state.tenders.gezien.push(id);
      nieuw.push({ id, titel: titel.slice(0, 120), ag: p.opdrachtgeverNaam || '', plaats: '', sluit: (p.sluitingsDatum || '').slice(0, 10), term, url: `https://www.tenderned.nl/aankondigingen/overzicht/${id}` });
    }
  }
  state.tenders.gezien = state.tenders.gezien.slice(-2000);
  if (nieuw.length) await telegram(`SEO-agent zakelijk: ${nieuw.length} nieuwe aanbesteding${nieuw.length === 1 ? '' : 'en'} met zonwering op TenderNed:\n` + nieuw.slice(0, 6).map((t) => `- ${t.titel} (${t.ag}${t.sluit ? ', sluit ' + t.sluit : ''})\n  ${t.url}`).join('\n'));
  log(`tenders: ${nieuw.length} nieuw`);
  return { nieuw: nieuw.length };
}

// ── 7. Weekrapport ──
async function weekrapport(state, delen) {
  const tekst = L.weekrapportTekst({ live: state.live, techniek: delen.techniek, posities: delen.posities, links: delen.links, content: delen.content });
  const extra = [];
  if (delen.content?.nieuwZakelijk?.length) extra.push(`- Zakelijk: ${delen.content.nieuwZakelijk.length} nieuwe zakelijke zoekformuleringen (${delen.content.nieuwZakelijk.slice(0, 4).join(', ')}).`);
  if (delen.tenders?.nieuw) extra.push(`- Aanbestedingen: ${delen.tenders.nieuw} nieuw op TenderNed deze week.`);
  await telegram(tekst + (extra.length ? '\n' + extra.join('\n') : '') + '\n\nVRAAG\nGeen, tenzij er voorstellen open staan (zie L-nummers hierboven).');
  state.rapporten = [...(state.rapporten || []), { op: nu(), tekst }].slice(-20);
}

(async () => {
  const state = leesState();
  if (MODE === 'status') { console.log(JSON.stringify({ live: state.live, liveSinds: state.liveSinds, techniek: { op: state.techniek?.op, open: state.techniek?.problemen?.length }, voorstellen: (state.voorstellen || []).map((v) => `${v.id}:${v.status}`), zoekwoorden: (state.zoekwoorden || []).length, tenders: state.tenders?.gezien?.length || 0 }, null, 1)); return; }
  log(`SEO-agent ${MODE}${DRY ? ' (dry)' : ''}`);
  const delen = {};
  await checkLive(state);
  await goedkeuringen(state);
  await verstuur(state);
  delen.techniek = await techniek(state);
  delen.tenders = await tenders(state);
  if (MODE === 'week') {
    delen.posities = await posities(state);
    delen.links = await links(state);
    delen.content = await content(state);
    await weekrapport(state, delen);
  }
  state.laatsteRonde = { mode: MODE, op: nu() };
  bewaarState(state);
  log('klaar');
})().catch((e) => { console.error(e); process.exit(1); });

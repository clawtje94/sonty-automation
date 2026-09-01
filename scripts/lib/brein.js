// BREIN — het gedeelde geheugen van "het bedrijf" op deze Mac mini (Daimy 29-08-2026:
// "één scherm waarin ik zie wat er draait, welke agents er zijn, wie wanneer wat aanroept,
// en waarmee ik die terminals kan aansturen; echt een bedrijf dat samenwerkt").
//
// Alles staat in ~/sonty/data/brein/ (lokaal, bron van waarheid) en wordt elke minuut door
// brein-collect.js naar /admin/brein (KV) gepusht. Opdrachten van de pagina komen via
// dezelfde ronde terug en landen in het postvak van de betreffende collega.
//
//  sessies.json         — aangemelde Claude-sessies/collega's {naam: {taak, status, sinds, laatst, pid, sessionId}}
//  gebeurtenissen.jsonl — tijdlijn "wie deed wat" (1 regel per gebeurtenis, max 30 dagen)
//  postvak.json         — opdrachten {id, aan, tekst, van, op, status, antwoord, antwoordOp}
//  inbox-<naam>.txt     — per collega een tekstbestand; een sessie draait `tail -f` erop (Monitor)
//                          en wordt zo wakker zodra er een opdracht binnenkomt.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '..', 'data', 'brein');
const P = {
  sessies: path.join(DIR, 'sessies.json'),
  gebeurtenissen: path.join(DIR, 'gebeurtenissen.jsonl'),
  postvak: path.join(DIR, 'postvak.json'),
  inbox: (naam) => path.join(DIR, `inbox-${slug(naam)}.txt`),
};

function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'onbekend'; }
function lees(p, leeg) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return leeg; } }
function schrijf(p, d) { fs.mkdirSync(DIR, { recursive: true }); const tmp = p + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d, null, 1)); fs.renameSync(tmp, p); }

/** Tijdlijn: wie deed wat. wie = 'Sunny' | 'Nanny' | 'planner' | sessienaam; wat = korte zin. */
function gebeurtenis(wie, wat, detail) {
  fs.mkdirSync(DIR, { recursive: true });
  const r = { t: new Date().toISOString(), wie: String(wie).slice(0, 40), wat: String(wat).slice(0, 200) };
  if (detail) r.detail = String(detail).slice(0, 400);
  fs.appendFileSync(P.gebeurtenissen, JSON.stringify(r) + '\n');
  return r;
}

function gebeurtenissen({ max = 300, sindsMs = 7 * 86400000 } = {}) {
  let txt = ''; try { txt = fs.readFileSync(P.gebeurtenissen, 'utf8'); } catch { return []; }
  const grens = Date.now() - sindsMs;
  const uit = [];
  for (const regel of txt.split('\n')) {
    if (!regel) continue;
    try { const r = JSON.parse(regel); if (Date.parse(r.t) >= grens) uit.push(r); } catch { /* kapotte regel overslaan */ }
  }
  return uit.slice(-max);
}

/** Collega's/sessies. */
function sessies() { return lees(P.sessies, {}); }
function meld(naam, { taak = '', status = 'bezig', sessionId = null, pid = process.ppid, cwd = process.cwd(), rol = 'claude-sessie' } = {}) {
  const s = sessies();
  const nu = new Date().toISOString();
  const oud = s[naam] || {};
  s[naam] = { ...oud, naam, rol, taak: taak || oud.taak || '', status, sinds: oud.sinds || nu, laatst: nu, pid, cwd, sessionId: sessionId || oud.sessionId || null };
  schrijf(P.sessies, s);
  gebeurtenis(naam, status === 'klaar' ? 'sessie klaar' : (oud.naam ? `status: ${status}${taak ? ' — ' + taak : ''}` : `aangemeld: ${taak}`));
  return s[naam];
}
function afmelden(naam) { const s = sessies(); if (s[naam]) { s[naam].status = 'klaar'; s[naam].laatst = new Date().toISOString(); schrijf(P.sessies, s); gebeurtenis(naam, 'afgemeld'); } }

/** Postvak. */
function postvak() { return lees(P.postvak, []); }
function bewaarPostvak(lijst) { schrijf(P.postvak, lijst.slice(-500)); }
function nieuweOpdracht({ aan, tekst, van = 'Daimy', id = null, bron = null, soort = null }) {
  const lijst = postvak();
  const o = { id: id || Math.random().toString(36).slice(2, 10), aan, tekst: String(tekst).slice(0, 4000), van, op: new Date().toISOString(), status: 'nieuw', antwoord: null, antwoordOp: null, bron: bron || null, soort: soort || null };
  if (lijst.some((x) => x.id === o.id)) return null; // al bekend (idempotent bij herhaalde pull)
  lijst.push(o); bewaarPostvak(lijst);
  // wakker maken: één regel in het inbox-bestand van de collega
  fs.appendFileSync(P.inbox(aan), `[${o.op}] OPDRACHT ${o.id} van ${van}: ${o.tekst.replace(/\s+/g, ' ')}\n`);
  gebeurtenis(van, `opdracht aan ${aan}: ${o.tekst.slice(0, 120)}`, o.id);
  return o;
}
function opdrachtenVoor(naam, { alleenNieuw = true } = {}) {
  return postvak().filter((o) => o.aan === naam && (!alleenNieuw || o.status === 'nieuw'));
}
function markeer(id, status, antwoord) {
  const lijst = postvak(); const o = lijst.find((x) => x.id === id); if (!o) return null;
  o.status = status; if (antwoord !== undefined) { o.antwoord = String(antwoord).slice(0, 4000); o.antwoordOp = new Date().toISOString(); }
  bewaarPostvak(lijst); return o;
}

module.exports = { DIR, P, slug, gebeurtenis, gebeurtenissen, sessies, meld, afmelden, postvak, bewaarPostvak, nieuweOpdracht, opdrachtenVoor, markeer };

#!/usr/bin/env node
// MEDEWERKER-RUNNER — draait een Sonty-medewerker (AI-agent) als `claude -p`-sessie met zijn eigen
// profiel, geheugen en toegestane tools. Daimy (29-08-2026): "maak er stuk voor stuk agents van die
// bij Sonty passen, en een Brein waarmee ik als één man het bedrijf perfect kan aansturen".
//
//   node scripts/medewerker.js lijst                      — het team (uit medewerkers/*/profiel.md)
//   node scripts/medewerker.js dienst <slug>              — de vaste dienst van deze medewerker draaien
//   node scripts/medewerker.js diensten                   — alle medewerkers met een dienst-tijd die nu aan de beurt zijn
//   node scripts/medewerker.js opdracht <slug> "<tekst>" [opdracht-id] — ad-hoc opdracht (bv. uit het Brein-postvak)
//
// Per medewerker: medewerkers/<slug>/profiel.md (frontmatter: naam, functie, afdeling, model, dienst,
// tools, scripts, jobs, kpis, magZelf), geheugen.md (eigen werkgeheugen), dagrapport/<datum>.md.
// Stand in data/brein/medewerkers.json → brein-collect → /admin/brein (tab Team).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const B = require('./lib/brein.js');

const ROOT = path.join(__dirname, '..');
const MAP = path.join(ROOT, 'medewerkers');
const STAND = path.join(B.DIR, 'medewerkers.json');
const CLAUDE = '/opt/homebrew/bin/claude';

function leesProfiel(slug) {
  const p = path.join(MAP, slug, 'profiel.md');
  const txt = fs.readFileSync(p, 'utf8');
  const m = txt.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`profiel ${slug} mist frontmatter`);
  const fm = {};
  let sleutel = null;
  for (const regel of m[1].split('\n')) {
    const lijst = regel.match(/^\s+- (.*)$/);
    if (lijst && sleutel) { (fm[sleutel] = Array.isArray(fm[sleutel]) ? fm[sleutel] : []).push(lijst[1].trim()); continue; }
    const kv = regel.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (kv) { sleutel = kv[1]; fm[sleutel] = kv[2].trim() === '' ? [] : kv[2].trim(); }
  }
  return { slug, ...fm, tekst: m[2].trim(), model: fm.model || 'sonnet', tools: Array.isArray(fm.tools) ? fm.tools : [], jobs: Array.isArray(fm.jobs) ? fm.jobs : [], kpis: Array.isArray(fm.kpis) ? fm.kpis : [], magZelf: Array.isArray(fm.magZelf) ? fm.magZelf : [] };
}
function team() {
  if (!fs.existsSync(MAP)) return [];
  return fs.readdirSync(MAP).filter((d) => fs.existsSync(path.join(MAP, d, 'profiel.md'))).map((d) => { try { return leesProfiel(d); } catch (e) { return { slug: d, naam: d, fout: e.message }; } });
}
function stand() { try { return JSON.parse(fs.readFileSync(STAND, 'utf8')); } catch { return {}; } }
function bewaarStand(s) { fs.mkdirSync(B.DIR, { recursive: true }); fs.writeFileSync(STAND, JSON.stringify(s, null, 1)); }
function lees(p, leeg = '') { try { return fs.readFileSync(p, 'utf8'); } catch { return leeg; } }
function datumNL(d = new Date()) { return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }); }

/** Rapport in vier vaste kopjes uit elkaar halen; ontbrekend kopje = zichtbaar leeg, nooit stil. */
function parseRapport(txt) {
  const pak = (kop) => { const m = txt.match(new RegExp(`##\\s*${kop}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i')); return m ? m[1].trim() : ''; };
  const vragen = pak('VRAGEN AAN DAIMY').split('\n').map((r) => r.replace(/^\s*(\d+[.)]|[-*])\s*/, '').trim()).filter((r) => r && !/^(geen|niets|nvt|n\.v\.t\.|-)\.?$/i.test(r));
  return { gedaan: pak('GEDAAN'), cijfers: pak('CIJFERS'), vragen, morgen: pak('MORGEN'), volledig: ['GEDAAN', 'CIJFERS', 'VRAGEN AAN DAIMY', 'MORGEN'].every((k) => new RegExp(`##\\s*${k}`, 'i').test(txt)) };
}

function draai(prof, opdracht, { soort = 'dienst', opdrachtId = null } = {}) {
  const dir = path.join(MAP, prof.slug);
  const geheugenPad = path.join(dir, 'geheugen.md');
  const vandaag = datumNL();
  const rapportPad = path.join(dir, 'dagrapport', `${vandaag}${soort === 'opdracht' ? '-opdracht-' + (opdrachtId || Date.now().toString(36)) : ''}.md`);
  fs.mkdirSync(path.dirname(rapportPad), { recursive: true });
  const systeem = [
    `Je bent ${prof.naam}, ${prof.functie} bij Sonty. Vandaag is ${vandaag}.`,
    '\n# BEDRIJFSHANDVEST\n' + lees(path.join(MAP, 'BEDRIJF.md')),
    '\n# JOUW PROFIEL\n' + prof.tekst,
    '\n# JOUW GEHEUGEN (door jou bijgehouden, pad: ' + geheugenPad + ')\n' + (lees(geheugenPad) || '(nog leeg)'),
    `\n# OPLEVERING\nSchrijf je rapport ALS BESTAND naar ${rapportPad} met precies de kopjes ## GEDAAN, ## CIJFERS, ## VRAGEN AAN DAIMY, ## MORGEN (in die volgorde) en werk ${geheugenPad} bij. Je laatste tekstantwoord is een kopie van dat rapport. Kort, telefoon-leesbaar, geen gedachtestreepjes.`,
  ].join('\n');
  const tools = ['Read', 'Write', 'Edit', 'Grep', 'Glob', ...prof.tools];
  const args = ['-p', opdracht, '--model', prof.model, '--system-prompt', systeem, '--allowedTools', ...tools, '--permission-mode', 'default', '--output-format', 'json'];
  const t0 = Date.now();
  const s = stand(); s[prof.slug] = { ...(s[prof.slug] || {}), naam: prof.naam, status: soort === 'dienst' ? 'in dienst' : 'aan een opdracht', bezigSinds: new Date().toISOString(), bezigMet: opdracht.slice(0, 160) }; bewaarStand(s);
  B.gebeurtenis(prof.naam, `${soort === 'dienst' ? 'begint dienst' : 'pakt opdracht op'}: ${opdracht.slice(0, 100)}`);
  const r = spawnSync(CLAUDE, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20e6, timeout: 25 * 60000, env: { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' } });
  let tekst = '', kosten = null, fout = null;
  if (r.error) fout = r.error.message;
  try { const j = JSON.parse(r.stdout || '{}'); tekst = j.result || ''; kosten = j.total_cost_usd ?? null; if (j.is_error) fout = (j.result || 'agent-fout').slice(0, 300); } catch { tekst = (r.stdout || '').trim(); }
  if (!tekst && !fout) fout = 'geen antwoord (stderr: ' + (r.stderr || '').slice(-300) + ')';
  const opBestand = lees(rapportPad);
  const rapport = parseRapport(opBestand || tekst);
  if (!opBestand && tekst) fs.writeFileSync(rapportPad, tekst);
  const duurMin = Math.round((Date.now() - t0) / 6000) / 10;
  const s2 = stand();
  s2[prof.slug] = { naam: prof.naam, functie: prof.functie, afdeling: prof.afdeling || '', status: fout ? 'fout' : rapport.vragen.length ? 'wacht op Daimy' : 'klaar', laatsteDienst: soort === 'dienst' ? new Date().toISOString() : (s2[prof.slug] || {}).laatsteDienst || null, laatsteActie: new Date().toISOString(), soort, duurMin, kostenUsd: kosten, fout, rapport: { ...rapport, pad: rapportPad.replace(ROOT, '~/sonty') }, bezigMet: null, bezigSinds: null };
  bewaarStand(s2);
  B.gebeurtenis(prof.naam, fout ? `FOUT in ${soort}: ${fout.slice(0, 120)}` : `${soort} klaar (${duurMin} min${kosten ? ', $' + kosten.toFixed(2) : ''}): ${rapport.gedaan.split('\n')[0].slice(0, 100)}${rapport.vragen.length ? ` · ${rapport.vragen.length} vraag/vragen aan Daimy` : ''}`);
  if (opdrachtId) B.markeer(opdrachtId, fout ? 'fout' : 'klaar', fout ? 'Mislukt: ' + fout : (opBestand || tekst).slice(0, 3500));
  return { fout, rapport, duurMin, kosten, tekst: opBestand || tekst };
}

const [, , cmd, a, b, c] = process.argv;
(async () => {
  if (cmd === 'lijst') {
    for (const m of team()) console.log(m.fout ? `!! ${m.slug}: ${m.fout}` : `${m.slug.padEnd(18)} ${m.naam.padEnd(10)} ${String(m.functie).padEnd(34)} ${m.afdeling || ''} · model ${m.model} · dienst ${m.dienst || '-'} · jobs ${m.jobs.length}`);
  } else if (cmd === 'dienst' && a) {
    const prof = leesProfiel(a);
    const r = draai(prof, prof.dienstOpdracht || 'Doe je dagelijkse dienst zoals in je profiel beschreven en lever het rapport op.', { soort: 'dienst' });
    console.log(r.fout ? 'FOUT: ' + r.fout : r.tekst.slice(0, 1500));
    process.exit(r.fout ? 1 : 0);
  } else if (cmd === 'diensten') {
    // alleen wie nu aan de beurt is: dienst-tijd (HH:MM) is verstreken en vandaag nog niet gedraaid
    const nu = new Date(); const nuMin = nu.getHours() * 60 + nu.getMinutes(); const s = stand();
    for (const prof of team().filter((m) => m.dienst && !m.fout)) {
      const [h, mi] = String(prof.dienst).split(':').map(Number);
      const vandaagGedaan = s[prof.slug]?.laatsteDienst && datumNL(new Date(s[prof.slug].laatsteDienst)) === datumNL();
      const weekend = nu.getDay() === 0 || nu.getDay() === 6;
      if (nuMin < h * 60 + mi || vandaagGedaan || (weekend && prof.weekend !== 'ja')) continue;
      console.log(`→ dienst ${prof.slug} (${prof.dienst})`);
      const r = draai(prof, prof.dienstOpdracht || 'Doe je dagelijkse dienst zoals in je profiel beschreven en lever het rapport op.', { soort: 'dienst' });
      console.log(r.fout ? '   FOUT: ' + r.fout : `   klaar in ${r.duurMin} min, ${r.rapport.vragen.length} vragen`);
    }
  } else if (cmd === 'opdracht' && a && b) {
    const r = draai(leesProfiel(a), b, { soort: 'opdracht', opdrachtId: c || null });
    console.log(r.fout ? 'FOUT: ' + r.fout : r.tekst.slice(0, 1500));
    process.exit(r.fout ? 1 : 0);
  } else { console.error('gebruik: lijst | dienst <slug> | diensten | opdracht <slug> "<tekst>" [id]'); process.exit(1); }
})();

module.exports = { team, leesProfiel, stand, parseRapport };

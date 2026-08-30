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
    if (kv) { sleutel = kv[1]; fm[sleutel] = kv[2].trim(); } // leeg = '' (lijstregels eronder maken er een array van)
  }
  return { slug, ...fm, tekst: m[2].trim(), model: fm.model || 'sonnet', tools: Array.isArray(fm.tools) ? fm.tools : [], jobs: Array.isArray(fm.jobs) ? fm.jobs : [], kpis: Array.isArray(fm.kpis) ? fm.kpis : [], magZelf: Array.isArray(fm.magZelf) ? fm.magZelf : [] };
}
function team() {
  if (!fs.existsSync(MAP)) return [];
  return fs.readdirSync(MAP).filter((d) => fs.existsSync(path.join(MAP, d, 'profiel.md'))).map((d) => { try { return leesProfiel(d); } catch (e) { return { slug: d, naam: d, fout: e.message }; } });
}
function stand() { try { return JSON.parse(fs.readFileSync(STAND, 'utf8')); } catch { return {}; } }
function bewaarStand(s) { fs.mkdirSync(B.DIR, { recursive: true }); const tmp = STAND + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(s, null, 1)); fs.renameSync(tmp, STAND); } // atomisch (M3)
function lees(p, leeg = '') { try { return fs.readFileSync(p, 'utf8'); } catch { return leeg; } }
function datumNL(d = new Date()) { return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }); }

/** Rapport in vier vaste kopjes uit elkaar halen; ontbrekend kopje = zichtbaar leeg, nooit stil. */
function parseRapport(txt) {
  // secties op kopregels knippen; een lege sectie blijft leeg (en lekt nooit de volgende sectie)
  const secties = {};
  let huidig = null;
  for (const regel of String(txt || '').split('\n')) {
    const kop = regel.match(/^\s*##\s*(.+?)\s*$/);
    if (kop) { huidig = kop[1].toUpperCase(); secties[huidig] = []; continue; }
    if (huidig) secties[huidig].push(regel);
  }
  const pak = (kop) => (secties[kop.toUpperCase()] || []).join('\n').trim();
  const vragen = pak('VRAGEN AAN DAIMY').split('\n').map((r) => r.replace(/^\s*(\d+[.)]|[-*])\s*/, '').trim()).filter((r) => r && !/^(geen|niets|nvt|n\.v\.t\.|-)\.?$/i.test(r));
  return { gedaan: pak('GEDAAN'), cijfers: pak('CIJFERS'), vragen, morgen: pak('MORGEN'), volledig: ['GEDAAN', 'CIJFERS', 'VRAGEN AAN DAIMY', 'MORGEN'].every((k) => new RegExp(`##\\s*${k}`, 'i').test(txt)) };
}

function draai(prof, opdracht, { soort = 'dienst', opdrachtId = null, extraTools = [] } = {}) {
  const dir = path.join(MAP, prof.slug);
  const geheugenPad = path.join(dir, 'geheugen.md');
  const vandaag = datumNL();
  const rapportPad = path.join(dir, 'dagrapport', `${vandaag}${soort === 'opdracht' ? '-opdracht-' + (opdrachtId || Date.now().toString(36)) : soort === 'bijscholing' ? '-bijscholing' : ''}.md`);
  fs.mkdirSync(path.dirname(rapportPad), { recursive: true });
  const systeem = [
    `Je bent ${prof.naam}, ${prof.functie} bij Sonty. Vandaag is ${vandaag}.`,
    '\n# RAAMWERK-REGELS (gelden in elk bedrijf)\n' + lees(path.join(MAP, 'RAAMWERK.md')),
    '\n# BEDRIJFSHANDVEST (dit bedrijf)\n' + lees(path.join(MAP, 'BEDRIJF.md')),
    '\n# JOUW PROFIEL\n' + prof.tekst,
    // vakkennis (Daimy 29-08: "altijd voorop lopen, de besten zijn in wat ze doen"): eigen playbook uit wekelijkse bijscholing
    ...(lees(path.join(dir, 'vakkennis.md')) ? ['\n# JOUW VAKKENNIS (hoe de besten dit vak doen; door jou bijgehouden via bijscholing)\n' + lees(path.join(dir, 'vakkennis.md')).slice(0, 6000)] : []),
    '\n# JOUW GEHEUGEN (door jou bijgehouden, pad: ' + geheugenPad + ')\n' + (lees(geheugenPad) || '(nog leeg)'),
    // coaching-lus: Ori (kwaliteit) schrijft per medewerker feedback; die krijgt de medewerker elke dienst mee
    ...(lees(path.join(MAP, 'ori', 'feedback', `${prof.slug}.md`)) ? ['\n# FEEDBACK VAN ORI (kwaliteit) — pas dit toe\n' + lees(path.join(MAP, 'ori', 'feedback', `${prof.slug}.md`)).slice(0, 2500)] : []),
    `\n# OPLEVERING\nSchrijf je rapport ALS BESTAND naar ${rapportPad} met precies de kopjes ## GEDAAN, ## CIJFERS, ## VRAGEN AAN DAIMY, ## MORGEN (in die volgorde) en werk ${geheugenPad} bij. Je laatste tekstantwoord is een kopie van dat rapport. Kort, telefoon-leesbaar, geen gedachtestreepjes.`,
  ].join('\n');
  // M1 (Mats-audit 29-08): schrijven/bewerken ALLEEN in de eigen medewerkersmap; lezen mag overal (Read zonder pad).
  const eigenMap = `//Users/clawdboot/sonty/medewerkers/${prof.slug}/**`;
  // Bram-les 30-08: agents typen vaak `node scripts/x.js` (relatief) i.p.v. het absolute pad → "requires approval".
  // Daarom staan we van elk toegestaan script ook de relatieve vormen toe.
  const relatief = prof.tools.flatMap((t) => { const m = t.match(/^Bash\(node \/Users\/clawdboot\/sonty\/scripts\/(.+)\)$/); return m ? [`Bash(node scripts/${m[1]})`, `Bash(node ./scripts/${m[1]})`, `Bash(cd /Users/clawdboot/sonty && node scripts/${m[1]})`] : []; });
  const tools = ['Read', `Write(${eigenMap})`, `Edit(${eigenMap})`, 'Grep', 'Glob', ...prof.tools, ...relatief, ...extraTools];
  // markering zodat het Brein deze run niet als 'Claude-terminal' telt (collector slaat '[medewerker:…]'-transcripten over)
  // '--setting-sources project': de gebruikersinstellingen van Daimy (bypassPermissions, Edit(*)) gelden NIET voor
  // medewerkers; alleen de whitelist hieronder. Bewezen 29-08: eigen map schrijfbaar, BEDRIJF.md geweigerd.
  const args = ['-p', `[medewerker:${prof.slug}] ${opdracht}`, '--model', prof.model, '--setting-sources', 'project', '--system-prompt', systeem, '--allowedTools', ...tools, '--permission-mode', 'default', '--output-format', 'json'];
  const t0 = Date.now();
  const s = stand(); s[prof.slug] = { ...(s[prof.slug] || {}), naam: prof.naam, status: soort === 'dienst' ? 'in dienst' : 'aan een opdracht', bezigSinds: new Date().toISOString(), bezigMet: opdracht.slice(0, 160) }; bewaarStand(s);
  B.gebeurtenis(prof.naam, `${soort === 'dienst' ? 'begint dienst' : 'pakt opdracht op'}: ${opdracht.slice(0, 100)}`);
  const r = spawnSync(CLAUDE, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20e6, timeout: 25 * 60000, env: { ...process.env, BREIN_VAN: prof.slug, PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' } });
  let tekst = '', kosten = null, fout = null;
  if (r.error) fout = r.error.message;
  try { const j = JSON.parse(r.stdout || '{}'); tekst = j.result || ''; kosten = j.total_cost_usd ?? null; if (j.is_error) fout = (j.result || 'agent-fout').slice(0, 300); } catch { tekst = (r.stdout || '').trim(); }
  if (!tekst && !fout) fout = 'geen antwoord (stderr: ' + (r.stderr || '').slice(-300) + ')';
  const opBestand = lees(rapportPad);
  const rapport = parseRapport(opBestand || tekst);
  if (!opBestand && tekst) fs.writeFileSync(rapportPad, tekst);
  const duurMin = Math.round((Date.now() - t0) / 6000) / 10;
  // AUDIT (Daimy 29-08: "alles moet gelogd"): per run één bestand met opdracht, systeemprompt-lengte, tools, ruwe output, kosten.
  try {
    const auditDir = path.join(B.DIR, 'audit', prof.slug); fs.mkdirSync(auditDir, { recursive: true });
    let usage = null, sessionId = null; try { const j = JSON.parse(r.stdout || '{}'); usage = j.usage || null; sessionId = j.session_id || null; } catch { /* geen json */ }
    fs.writeFileSync(path.join(auditDir, `${new Date(t0).toISOString().replace(/[:.]/g, '-')}-${soort}.json`), JSON.stringify({ medewerker: prof.slug, naam: prof.naam, soort, opdrachtId, opdracht, model: prof.model, tools, systeemTekens: systeem.length, start: new Date(t0).toISOString(), duurMin, kostenUsd: kosten, usage, sessionId, fout, exit: r.status, rapportPad, stderr: (r.stderr || '').slice(-2000), output: tekst.slice(0, 20000) }, null, 1));
    // oude audits opruimen: max 60 per medewerker
    const oud = fs.readdirSync(auditDir).sort(); for (const f of oud.slice(0, Math.max(0, oud.length - 60))) fs.unlinkSync(path.join(auditDir, f));
  } catch (e) { B.gebeurtenis('Mats', `audit-log mislukt voor ${prof.slug}: ${e.message.slice(0, 80)}`); }
  const s2 = stand();
  const oud = s2[prof.slug] || {};
  const ditRapport = { ...rapport, pad: rapportPad.replace(ROOT, '~/sonty') };
  // de kaart toont het DIENST-rapport; een ad-hoc opdracht overschrijft dat niet (antwoord staat in het postvak)
  s2[prof.slug] = { herkansing: oud.herkansing || false, naam: prof.naam, functie: prof.functie, afdeling: prof.afdeling || '',
    status: fout ? 'fout' : soort === 'dienst' ? (rapport.vragen.length ? 'wacht op Daimy' : 'klaar') : (oud.status && oud.status !== 'aan een opdracht' && oud.status !== 'in dienst' ? oud.status : 'klaar'),
    laatsteDienst: soort === 'dienst' ? new Date().toISOString() : oud.laatsteDienst || null, laatsteBijscholing: soort === 'bijscholing' && !fout ? new Date().toISOString() : oud.laatsteBijscholing || null, laatsteActie: new Date().toISOString(), soort, duurMin, kostenUsd: kosten, fout,
    rapport: soort === 'dienst' ? ditRapport : oud.rapport || ditRapport, laatsteOpdracht: soort === 'opdracht' ? { id: opdrachtId, op: new Date().toISOString(), rapport: ditRapport } : oud.laatsteOpdracht || null,
    bezigMet: null, bezigSinds: null };
  bewaarStand(s2);
  B.gebeurtenis(prof.naam, fout ? `FOUT in ${soort}: ${fout.slice(0, 120)}` : `${soort} klaar (${duurMin} min${kosten ? ', $' + kosten.toFixed(2) : ''}): ${rapport.gedaan.split('\n')[0].slice(0, 100)}${rapport.vragen.length ? ` · ${rapport.vragen.length} vraag/vragen aan Daimy` : ''}`);
  if (opdrachtId) B.markeer(opdrachtId, fout ? 'fout' : 'klaar', fout ? 'Mislukt: ' + fout : (opBestand || tekst).slice(0, 3500));
  return { fout, rapport, duurMin, kosten, tekst: opBestand || tekst };
}

function bijscholingOpdracht(prof) {
  const vk = path.join(MAP, prof.slug, 'vakkennis.md');
  return `BIJSCHOLING (wekelijks). Jouw functie: ${prof.functie}. Onderzoek online hoe de allerbesten in dit vak werken en schrijf/ververs jouw vakkennis-bestand ${vk} (max 90 regels).
Gebruik WebSearch en WebFetch (max 12 zoekopdrachten/pagina's, token-zuinig): recente vakartikelen en blogs, samenvattingen van de beste boeken over dit vak, vacatureteksten van topbedrijven (wat vragen zij van deze functie), transcripten of beschrijvingen van YouTube-video's van vakmensen (je kunt video's niet kijken, wel de tekst erbij lezen), brancheorganisaties en cursussen.
Vaste vorm van ${vk}:
# Vakkennis <naam> — <functie> (bijgewerkt <datum>)
## Zo werken de besten (10-15 concrete regels, elk toepasbaar in jouw dagelijkse dienst bij Sonty)
## Dagelijkse routine van een topper (kort, in volgorde)
## Cijfers waarop de besten sturen (KPI's en normen, met bron)
## Valkuilen die de besten vermijden
## Wat ik hiervan vanaf morgen anders doe (3 punten, concreet)
## Bronnen (minimaal 4, met URL en één zin waarom deze bron)
Regels: NOOIT namen van andere zonweringbedrijven (schrijf "een groot zonweringbedrijf"); geen verzonnen bronnen; vervang verouderde punten uit je vorige versie in plaats van eindeloos aan te vullen; Nederlands. Lever daarna je rapport in de vaste vier kopjes: onder GEDAAN welke bronnen je las en wat je veranderde in je vakkennis, onder MORGEN wat je vanaf morgen anders doet.`;
}

const [, , cmd, a, b, c] = process.argv;
if (require.main === module) (async () => {
  if (cmd === 'lijst') {
    for (const m of team()) console.log(m.fout ? `!! ${m.slug}: ${m.fout}` : `${m.slug.padEnd(18)} ${m.naam.padEnd(10)} ${String(m.functie).padEnd(34)} ${m.afdeling || ''} · model ${m.model} · dienst ${m.dienst || '-'} · jobs ${m.jobs.length}`);
  } else if (cmd === 'dienst' && a) {
    const prof = leesProfiel(a);
    const r = draai(prof, prof.dienstOpdracht || 'Doe je dagelijkse dienst zoals in je profiel beschreven en lever het rapport op.', { soort: 'dienst' });
    console.log(r.fout ? 'FOUT: ' + r.fout : r.tekst.slice(0, 1500));
    process.exit(r.fout ? 1 : 0);
  } else if (cmd === 'diensten') {
    // hartslag voor het Brein: de scheduler leeft ook als er niemand aan de beurt is (log blijft dan leeg)
    try { const h = path.join(B.DIR, 'hartslag'); fs.mkdirSync(h, { recursive: true }); fs.writeFileSync(path.join(h, 'medewerkers-dienst'), new Date().toISOString()); } catch { /* best effort */ }
    // alleen wie nu aan de beurt is: dienst-tijd (HH:MM) is verstreken en vandaag nog niet gedraaid
    const nu = new Date(); const nuMin = nu.getHours() * 60 + nu.getMinutes(); const s = stand();
    // volgorde = diensttijd: medewerkers eerst, dan de hoofden (07:45), dan Bram (08:00)
    for (const prof of team().filter((m) => m.dienst && !m.fout && m.sessie !== 'ja').sort((x, y) => String(x.dienst).localeCompare(String(y.dienst)))) {
      const [h, mi] = String(prof.dienst).split(':').map(Number);
      const st = s[prof.slug] || {};
      const vandaagGedaan = st.laatsteDienst && datumNL(new Date(st.laatsteDienst)) === datumNL();
      // zelfherstel: is de dienst van vandaag op 'fout' geëindigd, dan één herkansing (nooit eindeloos)
      if (vandaagGedaan && st.status === 'fout' && st.herkansing !== datumNL()) {
        console.log(`→ herkansing ${prof.slug} (vorige dienst mislukt: ${String(st.fout).slice(0, 80)})`);
        const s3 = stand(); s3[prof.slug] = { ...s3[prof.slug], herkansing: datumNL() }; bewaarStand(s3);
        const r = draai(prof, prof.dienstOpdracht || 'Doe je dagelijkse dienst zoals in je profiel beschreven en lever het rapport op.', { soort: 'dienst' });
        console.log(r.fout ? '   FOUT (ook na herkansing): ' + r.fout : `   klaar in ${r.duurMin} min`);
        continue;
      }
      const weekend = nu.getDay() === 0 || nu.getDay() === 6;
      if (nuMin < h * 60 + mi || vandaagGedaan || (weekend && prof.weekend !== 'ja')) continue;
      console.log(`→ dienst ${prof.slug} (${prof.dienst})`);
      const r = draai(prof, prof.dienstOpdracht || 'Doe je dagelijkse dienst zoals in je profiel beschreven en lever het rapport op.', { soort: 'dienst' });
      console.log(r.fout ? '   FOUT: ' + r.fout : `   klaar in ${r.duurMin} min, ${r.rapport.vragen.length} vragen`);
    }
  } else if (cmd === 'bijscholing' && a) {
    const prof = leesProfiel(a);
    if (prof.sessie === 'ja') { console.error('levende sessie heeft geen bijscholing-run'); process.exit(2); }
    const r = draai({ ...prof, model: prof.bijscholingModel || 'sonnet' }, bijscholingOpdracht(prof), { soort: 'bijscholing', extraTools: ['WebSearch', 'WebFetch'] });
    console.log(r.fout ? 'FOUT: ' + r.fout : r.tekst.slice(0, 1200));
    process.exit(r.fout ? 1 : 0);
  } else if (cmd === 'bijscholingen') {
    // wekelijks (launchd, maandag 06:00): iedereen die langer dan 6 dagen geleden bijgeschoold is, op volgorde
    const s = stand();
    for (const prof of team().filter((m) => !m.fout && m.sessie !== 'ja')) {
      const lb = s[prof.slug]?.laatsteBijscholing;
      if (lb && Date.now() - Date.parse(lb) < 6 * 86400000) continue;
      console.log(`→ bijscholing ${prof.slug}`);
      const r = draai({ ...prof, model: prof.bijscholingModel || 'sonnet' }, bijscholingOpdracht(prof), { soort: 'bijscholing', extraTools: ['WebSearch', 'WebFetch'] });
      console.log(r.fout ? '   FOUT: ' + r.fout : `   klaar in ${r.duurMin} min${r.kosten ? ', $' + r.kosten.toFixed(2) : ''}`);
    }
  } else if (cmd === 'opdracht' && a && b) {
    const prof = leesProfiel(a);
    // Daimy leest het antwoord op zijn telefoon: eerst een direct antwoord, dan pas het rapport
    b = `OPDRACHT VAN ${c ? 'Daimy' : 'een collega'} (ad hoc): ${b}\n\nBegin je tekstantwoord én je rapportbestand met een kopje "## ANTWOORD" met maximaal 5 korte zinnen die de vraag direct beantwoorden in gewone taal (wat je gedaan hebt, wat het antwoord is, wat er nu gebeurt). Kun je iets niet zelf (bouwen, wijzigen, aanzetten), zeg dat dan letterlijk en zet het door: \`node scripts/brein-sessie.js opdracht claude "<de vraag + jouw advies>"\`. Daarna pas de vier vaste kopjes.`;
    if (prof.sessie === 'ja') { console.error(`${a} is een levende sessie: opdracht gaat via het postvak/inbox, niet via claude -p`); process.exit(2); }
    const r = draai(prof, b, { soort: 'opdracht', opdrachtId: c || null });
    console.log(r.fout ? 'FOUT: ' + r.fout : r.tekst.slice(0, 1500));
    process.exit(r.fout ? 1 : 0);
  } else { console.error('gebruik: lijst | dienst <slug> | diensten | bijscholing <slug> | bijscholingen | opdracht <slug> "<tekst>" [id]'); process.exit(1); }
})();

module.exports = { team, leesProfiel, stand, parseRapport };

// Scenario-lab: BREIN-MEDEWERKERS (runner scripts/medewerker.js, 29-08-2026).
// Orakel (beleid):
//  O1 Een rapport zonder één van de vier kopjes is ONVOLLEDIG (zichtbaar op de kaart), nooit stil "ok".
//  O2 "geen"/"niets"/"-" onder VRAGEN AAN DAIMY telt als 0 vragen; echte regels tellen elk als 1 (nummering/bullets weg).
//  O3 Status: fout → 'fout'; vragen > 0 → 'wacht op Daimy'; anders 'klaar'.
//  O4 Scheduler: een dienst draait pas als de diensttijd is verstreken, nog niet vandaag draaide en (weekend) alleen bij
//     weekend: ja. Volgorde = diensttijd: medewerkers vóór hoofden vóór Bram.
//  O5 Profiel: lijstvelden zijn arrays, model bekend, dienst HH:MM, ## Regels aanwezig; zonder frontmatter = zichtbare fout.
//  O6 Piramide: hoofden/directie rapporteren aan daimy, medewerkers aan een hoofd, niemand aan zichzelf; alleen Bram
//     mag Telegram sturen; niemand heeft muterende tools (launchctl kickstart/bootout, rm, git push).
const path = require('path');
const fs = require('fs');
const { combinaties } = require('../matrix.js');
const M = require('../../scripts/medewerker.js');

// ── A. rapport-parser ──
const dimA = [
  { naam: 'kopjes', waarden: [
    { label: 'alle4', k: ['GEDAAN', 'CIJFERS', 'VRAGEN AAN DAIMY', 'MORGEN'] },
    { label: 'zonder-vragen', k: ['GEDAAN', 'CIJFERS', 'MORGEN'] },
    { label: 'zonder-cijfers', k: ['GEDAAN', 'VRAGEN AAN DAIMY', 'MORGEN'] },
    { label: 'leeg', k: [] },
    { label: 'kleine-letters', k: ['gedaan', 'cijfers', 'vragen aan daimy', 'morgen'] },
  ] },
  { naam: 'vragen', waarden: [
    { label: 'geen-woord', v: 'geen', n: 0 }, { label: 'niets', v: 'Niets.', n: 0 }, { label: 'streep', v: '-', n: 0 },
    { label: '2-genummerd', v: '1. Sjoerd vrij? Voorstel: ja\n2. Job X uit? Voorstel: nee', n: 2 },
    { label: '3-bullets', v: '- a\n- b\n* c', n: 3 }, { label: 'leeg', v: '', n: 0 },
  ] },
  { naam: 'fout', waarden: [{ label: 'nee', f: null }, { label: 'ja', f: 'agent-fout' }] },
];
function orakelA(s) {
  const heeftVragenKop = s.kopjes.k.some((k) => /vragen/i.test(k));
  const volledig = s.kopjes.k.length === 4;
  const vragen = heeftVragenKop ? s.vragen.n : 0;
  const status = s.fout.f ? 'fout' : vragen ? 'wacht op Daimy' : 'klaar';
  return { wil: volledig && !s.fout.f ? 'ok' : 'blokkeer', volledig, vragen, status };
}
function voerUitA(s) {
  const txt = s.kopjes.k.map((k) => `## ${k}\n${/vragen/i.test(k) ? s.vragen.v : 'tekst ' + k}\n`).join('\n');
  const r = M.parseRapport(txt);
  const status = s.fout.f ? 'fout' : r.vragen.length ? 'wacht op Daimy' : 'klaar';
  return { volledig: r.volledig, vragen: r.vragen.length, status, melding: !r.volledig || !!s.fout.f };
}
function vergelijkA(w, e) { return w.volledig === e.volledig && w.vragen === e.vragen && w.status === e.status; }

// ── B. scheduler-besluit (zelfde regels als `diensten`) ──
function magDraaien({ dienst, weekendJa, nuMin, dag, vandaagGedaan }) {
  const [h, mi] = dienst.split(':').map(Number);
  const weekend = dag === 0 || dag === 6;
  return !(nuMin < h * 60 + mi || vandaagGedaan || (weekend && !weekendJa));
}
const dimB = [
  { naam: 'dienst', waarden: [{ label: '07:00' }, { label: '07:45' }, { label: '08:00' }] },
  { naam: 'nu', waarden: [{ label: '06:59', m: 419 }, { label: '07:00', m: 420 }, { label: '07:50', m: 470 }, { label: '20:05', m: 1205 }] },
  { naam: 'dag', waarden: [{ label: 'ma', d: 1 }, { label: 'za', d: 6 }, { label: 'zo', d: 0 }] },
  { naam: 'weekend', waarden: [{ label: 'nee', j: false }, { label: 'ja', j: true }] },
  { naam: 'gedaan', waarden: [{ label: 'nee', g: false }, { label: 'ja', g: true }] },
];
function orakelB(s) {
  const [h, mi] = s.dienst.label.split(':').map(Number);
  const draait = s.nu.m >= h * 60 + mi && !s.gedaan.g && !((s.dag.d === 0 || s.dag.d === 6) && !s.weekend.j);
  return { wil: draait ? 'ok' : 'blokkeer', draait };
}
function voerUitB(s) { return { draait: magDraaien({ dienst: s.dienst.label, weekendJa: s.weekend.j, nuMin: s.nu.m, dag: s.dag.d, vandaagGedaan: s.gedaan.g }), melding: false }; }
function vergelijkB(w, e) { return w.draait === e.draait; }

// ── C. profielen en piramide ──
function scenariosC() {
  const alle = M.team();
  const lijst = alle.filter((m) => !m.fout).map((m) => ({ _laag: 'C', _label: `profiel:${m.slug}`, slug: m.slug }));
  lijst.push({ _laag: 'C', _label: 'volgorde medewerkers → hoofden → Bram', slug: '__volgorde' });
  lijst.push({ _laag: 'C', _label: 'profiel zonder frontmatter', slug: '__geen-frontmatter' });
  return lijst;
}
function orakelC(s) { return { wil: s.slug === '__geen-frontmatter' ? 'blokkeer' : 'ok', problemen: '' }; }
function voerUitC(s) {
  if (s.slug === '__geen-frontmatter') {
    const tmp = path.join(__dirname, '..', '..', 'medewerkers', '_labtest');
    try {
      fs.mkdirSync(tmp, { recursive: true }); fs.writeFileSync(path.join(tmp, 'profiel.md'), '# geen frontmatter');
      const t = M.team().find((m) => m.slug === '_labtest');
      return { problemen: t && t.fout ? '' : 'stil geaccepteerd', melding: !!(t && t.fout) };
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  const alle = M.team().filter((m) => !m.fout);
  if (s.slug === '__volgorde') {
    const team = alle.filter((m) => m.dienst).sort((x, y) => String(x.dienst).localeCompare(String(y.dienst)));
    const idx = (slug) => team.findIndex((m) => m.slug === slug);
    const p = [];
    for (const h of team.filter((m) => m.niveau === 'hoofd')) {
      const eigen = team.filter((m) => m.rapporteertAan === h.slug).map((m) => idx(m.slug));
      if (eigen.length && Math.max(...eigen) > idx(h.slug)) p.push(`${h.slug} draait vóór een eigen medewerker`);
    }
    if (idx('bram') !== team.length - 1) p.push('Bram is niet de laatste');
    return { problemen: p.join('; '), melding: false };
  }
  const m = alle.find((x) => x.slug === s.slug);
  const slugs = new Set(alle.map((x) => x.slug));
  const p = [];
  if (!m.naam || !m.functie || !m.afdeling) p.push('naam/functie/afdeling mist');
  if (!['directie', 'hoofd', 'medewerker'].includes(m.niveau)) p.push('niveau ongeldig');
  if (m.rapporteertAan !== 'daimy' && !slugs.has(m.rapporteertAan)) p.push(`rapporteert aan onbekende ${m.rapporteertAan}`);
  if (m.rapporteertAan === m.slug) p.push('rapporteert aan zichzelf');
  if (['hoofd', 'directie'].includes(m.niveau) && m.rapporteertAan !== 'daimy') p.push('hoofd rapporteert niet aan Daimy');
  if (m.niveau === 'medewerker' && (alle.find((x) => x.slug === m.rapporteertAan) || {}).niveau !== 'hoofd') p.push('medewerker rapporteert niet aan een hoofd');
  if (![m.tools, m.jobs, m.kpis, m.magZelf].every(Array.isArray)) p.push('lijstvelden geen array');
  if (!/^\d\d:\d\d$/.test(String(m.dienst))) p.push('dienst geen HH:MM');
  if (!['haiku', 'sonnet', 'opus'].includes(m.model)) p.push('model onbekend');
  if (!/## Regels/.test(m.tekst)) p.push('geen ## Regels in profiel');
  if (m.tools.some((t) => /brein-telegram/.test(t)) && m.slug !== 'bram') p.push('mag Telegram sturen maar is Bram niet');
  if (m.tools.some((t) => /launchctl (kickstart|bootout|bootstrap)|\brm\b|git push|Write\(|Edit\(/.test(t))) p.push('heeft muterende tool');
  return { problemen: p.join('; '), melding: false };
}
function vergelijkC(w, e) { return e.problemen === ''; }

function scenarios() {
  return [
    ...combinaties(dimA).map((s) => ({ ...s, _laag: 'A', _label: 'A ' + s._label })),
    ...combinaties(dimB).map((s) => ({ ...s, _laag: 'B', _label: 'B ' + s._label })),
    ...scenariosC(),
  ];
}
function orakel(s) { return s._laag === 'A' ? orakelA(s) : s._laag === 'B' ? orakelB(s) : orakelC(s); }
function voerUit(s) { return s._laag === 'A' ? voerUitA(s) : s._laag === 'B' ? voerUitB(s) : voerUitC(s); }
function vergelijk(w, e, s) { return s._laag === 'A' ? vergelijkA(w, e) : s._laag === 'B' ? vergelijkB(w, e) : vergelijkC(w, e); }

module.exports = { naam: 'brein-medewerkers (rapport-parser, dienst-scheduler, profielen en piramide)', scenarios, orakel, voerUit, vergelijk };

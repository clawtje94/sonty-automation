#!/usr/bin/env node
// Bouwt het HTML-rapport uit data/conversie-2025-tabellen.json en -2026-tabellen.json.
// Genereren i.p.v. handmatig overtypen: zo kunnen de cijfers in het rapport niet
// afwijken van de cijfers uit de sheet.
const fs = require('fs');
const path = require('path');
const D25 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'conversie-2025-tabellen.json'), 'utf8'));
const D26 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'conversie-2026-tabellen.json'), 'utf8'));

const MND = ['', 'jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const eur = n => '€' + Math.round(n).toLocaleString('nl-NL');
const pc = (a, b) => b ? (a / b * 100) : 0;
const f1 = n => n.toFixed(1).replace('.', ',');
const f0 = n => n.toFixed(0);
const sign = n => (n >= 0 ? '+' : '') + f1(n);
const sign0 = n => (n >= 0 ? '+' : '') + f0(n);

// Peildatum 27-07-2026. Mediane doorlooptijd offerte->akkoord is ~24 dagen, 90% binnen
// ~51 dagen. Een maand is dus pas betrouwbaar als hij ~60 dagen achter ons ligt.
const RIJPHEID = { 5: '~90% uitgerijpt', 6: 'nog niet uitgerijpt', 7: 'loopt nog' };
const RIJP = [1, 2, 3, 4];               // volledig uitgerijpt in beide jaren
const SPEND = { 3: { Meta: 19800, Google: 6300 }, 4: { Meta: 22000, Google: 10300 }, 5: { Meta: 23700, Google: 17100 } };

const tot25 = D25.totaal.alles, tot26 = D26.totaal.alles;
const gemMarge = (tot25.omzet - tot25.inkoop) / tot25.akk;

function blok(D, maanden) {
  const s = { off: 0, akk: 0, omzet: 0, inkoop: 0 };
  for (const m of maanden) { const d = D.maand[m]; if (!d) continue;
    s.off += d.off; s.akk += d.akk; s.omzet += d.omzet; s.inkoop += d.inkoop; }
  return s;
}
const b25 = blok(D25, RIJP), b26 = blok(D26, RIJP);
const b25m = blok(D25, [1, 2, 3, 4, 5]), b26m = blok(D26, [1, 2, 3, 4, 5]);

// bronnen samenvoegen (Facebook+Instagram = Meta wegens labelwissel)
function bronnen(D) {
  const r = {};
  const bij = (naam, keys) => { r[naam] = { off: 0, akk: 0, omzet: 0, inkoop: 0 };
    for (const k of keys) { const d = D.afkomst[k]; if (!d) continue;
      for (const p of ['off', 'akk', 'omzet', 'inkoop']) r[naam][p] += d[p]; } };
  bij('Google', ['Google']);
  bij('Meta', ['Facebook', 'Instagram']);
  bij('Buren/Bekenden', ['Bekenden', 'Buren']);
  bij('Anders', Object.keys(D.afkomst).filter(k => !['Google', 'Facebook', 'Instagram', 'Bekenden', 'Buren'].includes(k)));
  return r;
}
const br25 = bronnen(D25), br26 = bronnen(D26);
const KOL = ['Google', 'Meta', 'Buren/Bekenden', 'Anders'];
function celBron(D, m, kol) {
  const d = D.maandGroep[m + '|' + kol];
  return d ? { off: d.off, akk: d.akk } : { off: 0, akk: 0 };
}
function bronBlok(D, kol) {
  const s = { off: 0, akk: 0 };
  for (const m of RIJP) { const c = celBron(D, m, kol); s.off += c.off; s.akk += c.akk; }
  return s;
}

const RAMP = 7;
const heat = (v, max) => v === null ? 'leeg' : 'h' + Math.min(RAMP - 1, Math.max(0, Math.round(v / max * (RAMP - 1))));

const H = [];
H.push(`<title>Sonty conversie 2025 en 2026 — per maand, bron en productgroep</title>`);
H.push(`<style>
:root{
  --surface:#FAF8F5; --surface-2:#FFFFFF; --surface-3:#F2EEE8;
  --ink:#1C1815; --ink-2:#554D45; --ink-3:#8A8078;
  --rule:#E4DDD3; --rule-strong:#CFC5B8;
  --accent:#D95F02; --accent-soft:#FBEADC;
  --s1:#D95F02; --s2:#1F6FEB; --s3:#0E8A6A; --s4:#7C3AED; --s5:#B8336A;
  --goed:#1F7A4C; --slecht:#A8321F;
  --h0:#FBF3EA; --h1:#F7E2CB; --h2:#F1C79E; --h3:#E7A76B; --h4:#D9853B; --h5:#BC6716; --h6:#944C09;
  --h0i:#6B6259; --h1i:#4A3B28; --h2i:#3A2C1A; --h3i:#2E2112; --h4i:#FFF6EC; --h5i:#FFF6EC; --h6i:#FFF6EC;
  --grid:#EAE3D9;
}
@media (prefers-color-scheme:dark){:root{
  --surface:#14110E; --surface-2:#1D1916; --surface-3:#241F1A;
  --ink:#F5F0EA; --ink-2:#B5ABA1; --ink-3:#7E756C;
  --rule:#302A24; --rule-strong:#463D34;
  --accent:#FF8438; --accent-soft:#2A1C11;
  --s1:#DB7020; --s2:#4C8DFF; --s3:#2AA888; --s4:#A078F5; --s5:#E0578F;
  --goed:#3FBF7F; --slecht:#F0705A;
  --h0:#1B1712; --h1:#2C2318; --h2:#42311C; --h3:#5B4220; --h4:#7A5626; --h5:#9C6C2C; --h6:#C08536;
  --h0i:#7E756C; --h1i:#C0A98C; --h2i:#E5CDA9; --h3i:#F6E3C6; --h4i:#FFF3E2; --h5i:#FFF6EC; --h6i:#1B1712;
  --grid:#2A241E;
}}
:root[data-theme="dark"]{
  --surface:#14110E; --surface-2:#1D1916; --surface-3:#241F1A;
  --ink:#F5F0EA; --ink-2:#B5ABA1; --ink-3:#7E756C;
  --rule:#302A24; --rule-strong:#463D34;
  --accent:#FF8438; --accent-soft:#2A1C11;
  --s1:#DB7020; --s2:#4C8DFF; --s3:#2AA888; --s4:#A078F5; --s5:#E0578F;
  --goed:#3FBF7F; --slecht:#F0705A;
  --h0:#1B1712; --h1:#2C2318; --h2:#42311C; --h3:#5B4220; --h4:#7A5626; --h5:#9C6C2C; --h6:#C08536;
  --h0i:#7E756C; --h1i:#C0A98C; --h2i:#E5CDA9; --h3i:#F6E3C6; --h4i:#FFF3E2; --h5i:#FFF6EC; --h6i:#1B1712;
  --grid:#2A241E;
}
:root[data-theme="light"]{
  --surface:#FAF8F5; --surface-2:#FFFFFF; --surface-3:#F2EEE8;
  --ink:#1C1815; --ink-2:#554D45; --ink-3:#8A8078;
  --rule:#E4DDD3; --rule-strong:#CFC5B8;
  --accent:#D95F02; --accent-soft:#FBEADC;
  --s1:#D95F02; --s2:#1F6FEB; --s3:#0E8A6A; --s4:#7C3AED; --s5:#B8336A;
  --goed:#1F7A4C; --slecht:#A8321F;
  --h0:#FBF3EA; --h1:#F7E2CB; --h2:#F1C79E; --h3:#E7A76B; --h4:#D9853B; --h5:#BC6716; --h6:#944C09;
  --h0i:#6B6259; --h1i:#4A3B28; --h2i:#3A2C1A; --h3i:#2E2112; --h4i:#FFF6EC; --h5i:#FFF6EC; --h6i:#FFF6EC;
  --grid:#EAE3D9;
}
*{box-sizing:border-box}
body{margin:0;background:var(--surface);color:var(--ink);
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;}
h1,h2,h3{letter-spacing:-0.022em;text-wrap:balance;margin:0;font-weight:750;line-height:1.14;}
h1{font-size:clamp(2rem,5.2vw,3.35rem);}
h2{font-size:clamp(1.4rem,3vw,1.95rem);}
h3{font-size:1.06rem;letter-spacing:-0.01em;}
p{margin:0;}
a{color:var(--accent);}
em{font-style:italic;}
.wrap{max-width:1180px;margin:0 auto;padding:0 clamp(1rem,4vw,2.75rem);}
.eyebrow{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  font-size:.688rem;letter-spacing:.15em;text-transform:uppercase;color:var(--ink-3);}
header.top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--surface) 88%,transparent);
  backdrop-filter:blur(12px);border-bottom:1px solid var(--rule);}
header.top .wrap{display:flex;align-items:center;gap:1.5rem;height:52px;}
.brandmark{display:flex;align-items:center;gap:.55rem;font-weight:750;letter-spacing:-.02em;flex-shrink:0;}
.brandmark i{width:9px;height:9px;border-radius:2px;background:var(--accent);display:block;}
nav.jump{display:flex;gap:1.15rem;overflow-x:auto;margin-left:auto;}
nav.jump a{color:var(--ink-2);text-decoration:none;font-size:.8rem;white-space:nowrap;padding:.2rem 0;border-bottom:1.5px solid transparent;}
nav.jump a:hover,nav.jump a:focus-visible{color:var(--ink);border-bottom-color:var(--accent);}
@media(max-width:900px){nav.jump{display:none}}
.hero{padding:clamp(2.75rem,7vw,5rem) 0 clamp(1.75rem,4vw,2.75rem);}
.hero h1{margin:.7rem 0 0;max-width:26ch;}
.lede{margin-top:1.15rem;max-width:62ch;font-size:1.075rem;color:var(--ink-2);}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:1px;
  background:var(--rule);border:1px solid var(--rule);margin:clamp(1.75rem,4vw,2.5rem) 0 0;}
.kpi{background:var(--surface-2);padding:1.15rem 1.15rem 1.05rem;}
.kpi .v{font-size:clamp(1.5rem,3.6vw,2.1rem);font-weight:750;letter-spacing:-.03em;
  font-variant-numeric:tabular-nums;line-height:1.05;margin-top:.4rem;}
.kpi .n{font-size:.78rem;color:var(--ink-3);margin-top:.35rem;line-height:1.4;}
.kpi .v.neg{color:var(--slecht)}.kpi .v.pos{color:var(--goed)}
section{padding:clamp(2.5rem,6vw,4.25rem) 0;border-top:1px solid var(--rule);}
section > .wrap > .eyebrow{display:block;margin-bottom:.6rem;}
section h2 + p.intro{margin-top:1rem;max-width:66ch;color:var(--ink-2);}
.note{border-left:2.5px solid var(--accent);background:var(--accent-soft);
  padding:1.05rem 1.25rem;margin-top:1.6rem;font-size:.925rem;}
.note strong{color:var(--ink);}
.note + .note{margin-top:.75rem;}
.scroller{overflow-x:auto;margin-top:1.75rem;border:1px solid var(--rule);background:var(--surface-2);}
table{border-collapse:collapse;width:100%;font-size:.85rem;}
caption{text-align:left;padding:.85rem 1rem;font-size:.8rem;color:var(--ink-3);border-bottom:1px solid var(--rule);}
th,td{padding:.5rem .7rem;text-align:right;border-bottom:1px solid var(--rule);white-space:nowrap;
  font-variant-numeric:tabular-nums;}
th{font-size:.72rem;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-3);font-weight:600;
  background:var(--surface-3);position:sticky;top:0;}
th:first-child,td:first-child{text-align:left;font-variant-numeric:normal;}
tbody tr:hover td{background:var(--surface-3);}
tr.tot td{font-weight:700;border-top:2px solid var(--rule-strong);background:var(--surface-3);}
tr.tot:hover td{background:var(--surface-3);}
tr.onrijp td:first-child{color:var(--ink-3);font-style:italic;}
td.h0{background:var(--h0);color:var(--h0i)}td.h1{background:var(--h1);color:var(--h1i)}
td.h2{background:var(--h2);color:var(--h2i)}td.h3{background:var(--h3);color:var(--h3i)}
td.h4{background:var(--h4);color:var(--h4i)}td.h5{background:var(--h5);color:var(--h5i)}
td.h6{background:var(--h6);color:var(--h6i)}
td.leeg{color:var(--ink-3);}
tbody tr:hover td[class^="h"]{filter:brightness(1.06)}
td .sub{color:var(--ink-3);font-size:.75rem;margin-left:.3rem;}
td.h4 .sub,td.h5 .sub,td.h6 .sub{color:inherit;opacity:.7}
.pos{color:var(--goed);font-weight:600}.neg{color:var(--slecht);font-weight:600}
.legend{display:flex;flex-wrap:wrap;gap:1rem;align-items:center;margin-top:1rem;font-size:.8rem;color:var(--ink-2);}
.legend .item{display:flex;align-items:center;gap:.4rem;}
.legend .sw{width:11px;height:11px;border-radius:2px;flex-shrink:0;}
.ramp{display:flex;align-items:center;gap:.45rem;font-size:.75rem;color:var(--ink-3);margin-top:1rem;}
.ramp .cells{display:flex;}
.ramp .cells i{width:19px;height:11px;display:block;}
figure{margin:1.75rem 0 0;}
figcaption{font-size:.8rem;color:var(--ink-3);margin-top:.7rem;max-width:62ch;}
.chart{position:relative;background:var(--surface-2);border:1px solid var(--rule);padding:1.1rem .9rem .6rem;}
svg{display:block;width:100%;height:auto;overflow:visible;}
.gridline{stroke:var(--grid);stroke-width:1;}
.axis{fill:var(--ink-3);font-size:10.5px;font-family:ui-monospace,Menlo,monospace;}
.axlabel{fill:var(--ink-3);font-size:10px;letter-spacing:.08em;text-transform:uppercase;}
.dlabel{font-size:10.5px;font-weight:700;font-variant-numeric:tabular-nums;}
.hit{fill:transparent;cursor:pointer;}
.tip{position:absolute;pointer-events:none;opacity:0;transition:opacity .1s;
  background:var(--ink);color:var(--surface);padding:.5rem .65rem;font-size:.75rem;
  border-radius:4px;white-space:nowrap;z-index:5;line-height:1.45;font-variant-numeric:tabular-nums;}
.tip b{font-weight:700}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(265px,1fr));gap:1px;
  background:var(--rule);border:1px solid var(--rule);margin-top:1.75rem;}
.card{background:var(--surface-2);padding:1.3rem;}
.card .eyebrow{display:block;margin-bottom:.5rem;}
.card h3{margin-bottom:.5rem;}
.card p{font-size:.9rem;color:var(--ink-2);}
.card .big{font-size:1.65rem;font-weight:750;letter-spacing:-.025em;font-variant-numeric:tabular-nums;margin:.15rem 0 .5rem;}
ol.acties{list-style:none;padding:0;margin:1.75rem 0 0;display:grid;gap:1px;background:var(--rule);
  border:1px solid var(--rule);}
ol.acties li{background:var(--surface-2);padding:1.35rem 1.4rem;display:grid;
  grid-template-columns:auto 1fr;gap:0 1.15rem;align-items:start;}
ol.acties .when{font-family:ui-monospace,Menlo,monospace;font-size:.7rem;letter-spacing:.1em;
  text-transform:uppercase;color:var(--accent);padding-top:.25rem;white-space:nowrap;}
ol.acties h3{grid-column:2;}
ol.acties p{grid-column:2;margin-top:.45rem;font-size:.925rem;color:var(--ink-2);}
ol.acties .bedrag{grid-column:2;margin-top:.6rem;font-size:.8rem;color:var(--ink-3);
  font-family:ui-monospace,Menlo,monospace;}
@media(max-width:560px){ol.acties li{grid-template-columns:1fr}ol.acties h3,ol.acties p,ol.acties .bedrag{grid-column:1}
  ol.acties .when{padding-bottom:.5rem}}
footer{border-top:1px solid var(--rule);padding:2.25rem 0 3.25rem;color:var(--ink-3);font-size:.83rem;}
footer p{max-width:70ch;}
footer p + p{margin-top:.65rem;}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>`);

H.push(`<header class="top"><div class="wrap">
<span class="brandmark"><i></i>Sonty&nbsp;data</span>
<nav class="jump">
<a href="#vergelijk">2025 vs 2026</a><a href="#maand">Per maand</a><a href="#bron">Per bron</a>
<a href="#product">Per product</a><a href="#showroom">Showroom</a><a href="#geld">Advertentiegeld</a><a href="#plan">Wat te doen</a>
</nav></div></header>`);

// ---------- hero ----------
H.push(`<div class="wrap hero">
<span class="eyebrow">Offerteregister 2025 &amp; 2026 &middot; ${(tot25.off + tot26.off).toLocaleString('nl-NL')} offertes geanalyseerd</span>
<h1>Je verdubbelde het aantal offertes en kreeg er ${sign0(pc(b26.akk, b25.akk) - 100)}% meer orders voor terug.</h1>
<p class="lede">In januari tot en met april 2026 gingen er ${b26.off.toLocaleString('nl-NL')} offertes de deur uit tegen ${b25.off.toLocaleString('nl-NL')} in dezelfde maanden van 2025 &mdash; ruim het dubbele. Daar kwamen ${b26.akk} akkoorden uit tegen ${b25.akk}. De conversie zakte van ${f1(pc(b25.akk, b25.off))}% naar ${f1(pc(b26.akk, b26.off))}%. En dat gebeurde bij <em>elk</em> kanaal, ook bij de showroom en bij mond-tot-mond. Dat maakt het geen advertentieprobleem.</p>
<div class="kpis">
<div class="kpi"><span class="eyebrow">Offertes jan&ndash;apr</span><div class="v">${sign0(pc(b26.off, b25.off) - 100)}%</div><div class="n">${b25.off.toLocaleString('nl-NL')} &rarr; ${b26.off.toLocaleString('nl-NL')}</div></div>
<div class="kpi"><span class="eyebrow">Akkoorden</span><div class="v">${sign0(pc(b26.akk, b25.akk) - 100)}%</div><div class="n">${b25.akk} &rarr; ${b26.akk}</div></div>
<div class="kpi"><span class="eyebrow">Conversie</span><div class="v neg">${sign(pc(b26.akk, b26.off) - pc(b25.akk, b25.off))}pp</div><div class="n">${f1(pc(b25.akk, b25.off))}% &rarr; ${f1(pc(b26.akk, b26.off))}%</div></div>
<div class="kpi"><span class="eyebrow">Omzet</span><div class="v pos">${sign0(pc(b26.omzet, b25.omzet) - 100)}%</div><div class="n">${eur(b25.omzet)} &rarr; ${eur(b26.omzet)}</div></div>
<div class="kpi"><span class="eyebrow">Heel 2025</span><div class="v">${f1(pc(tot25.akk, tot25.off))}%</div><div class="n">${tot25.off.toLocaleString('nl-NL')} offertes, ${eur(tot25.omzet)} omzet</div></div>
</div>
</div>`);

// ---------- datawaarschuwingen ----------
H.push(`<section id="data"><div class="wrap">
<span class="eyebrow">Eerst dit</span>
<h2>Drie dingen in de sheet die de cijfers anders vertellen dan je denkt</h2>
<div class="note"><strong>Wat als akkoord telt (bijgesteld 30 juli, na correctie van Daimy).</strong> De vinkjeskolom &ldquo;Akkoord&rdquo; is onbruikbaar (313 vinkjes voor heel 2025, juni op 0 bij 1.221 offertes). Een offerte telt hier als akkoord wanneer het akkoord-blok gevuld is (Gripp-nummer, akkoorddatum of akkoordbedrag) <strong>of wanneer de inkoopkolom gevuld is</strong> &mdash; de &euro;1-markering die het team vooral in 2026 gebruikt voor akkoorden waarvan de administratie nog volgt (296 rijen in 2026, 9 in 2025). Zo geteld: ${tot25.akk.toLocaleString('nl-NL')} akkoorden in 2025 en ${tot26.akk.toLocaleString('nl-NL')} in 2026 t/m juli. Controle juni 2026: deze telling 187, Daimy zelf ~190. Alleen juli heeft daarnaast nog RP-pijplijn die niet in de sheet staat (17 leads op &ldquo;Inmeten inplannen&rdquo;/&ldquo;Gripp invullen&rdquo;).</div>
<div class="note"><strong>Recente maanden zijn nog niet uitgerijpt.</strong> Tussen offerte en akkoord zit mediaan 24 dagen; 90% valt binnen ongeveer 51 dagen. Juli 2026 staat daarom op ${D26.maand[7].akk} akkoorden bij ${D26.maand[7].off.toLocaleString('nl-NL')} offertes, en dat zegt nog niets. Elke vergelijking tussen de jaren in dit rapport gebruikt daarom <strong>januari tot en met april</strong>, in beide jaren volledig uitgerijpt. Mei, juni en juli 2026 staan wel in de tabellen, maar met een markering.</div>
<div class="note"><strong>Je afkomst-labels zijn medio 2025 omgezet.</strong> Tot en met augustus 2025 heette Meta-traffic &ldquo;Facebook&rdquo;, vanaf september &ldquo;Instagram&rdquo;: Facebook zakt van 558 offertes in augustus naar 4 in september, terwijl Instagram in dezelfde stap van 63 naar 345 springt. Los gelezen lijkt Facebook dood en Instagram nieuw. Ze zijn hier overal samengevoegd als &eacute;&eacute;n kanaal Meta.</div>
</div></section>`);

// ---------- vergelijking ----------
H.push(`<section id="vergelijk"><div class="wrap">
<span class="eyebrow">01 &middot; 2025 tegenover 2026</span>
<h2>Het is niet het verkeer. Alles zakt tegelijk.</h2>
<p class="intro">Als &eacute;&eacute;n kanaal instort, is het dat kanaal. Als Google, Meta, mond-tot-mond &eacute;n de showroom allemaal ongeveer halveren, ligt het aan wat er n&aacute; binnenkomst gebeurt. Hieronder januari tot en met april, in beide jaren volledig uitgerijpt.</p>`);

let vt = `<div class="scroller"><table><caption>Januari tot en met april, 2025 tegenover 2026. Beide periodes volledig uitgerijpt.</caption>
<thead><tr><th>Kanaal</th><th>Offertes 2025</th><th>Offertes 2026</th><th>Conv. 2025</th><th>Conv. 2026</th><th>Verschil</th><th>Akkoord 2025</th><th>Akkoord 2026</th></tr></thead><tbody>`;
for (const k of KOL) {
  const a = bronBlok(D25, k), b = bronBlok(D26, k);
  if (!a.off && !b.off) continue;
  const ca = pc(a.akk, a.off), cb = pc(b.akk, b.off);
  vt += `<tr><td>${k === 'Meta' ? 'Meta (FB+IG)' : k}</td><td>${a.off.toLocaleString('nl-NL')}</td><td>${b.off.toLocaleString('nl-NL')}</td>
<td>${f1(ca)}%</td><td>${f1(cb)}%</td><td class="${cb - ca < 0 ? 'neg' : 'pos'}">${sign(cb - ca)}pp</td>
<td>${a.akk}</td><td>${b.akk}</td></tr>`;
}
for (const kan of ['Winkel', 'Online']) {
  const s = D => { const t = { off: 0, akk: 0 }; for (const m of RIJP) { const d = D.maandKanaal[m + '|' + kan]; if (d) { t.off += d.off; t.akk += d.akk; } } return t; };
  const a = s(D25), b = s(D26);
  const ca = pc(a.akk, a.off), cb = pc(b.akk, b.off);
  vt += `<tr><td>${kan === 'Winkel' ? 'Showroom (winkel)' : 'Online'}</td><td>${a.off.toLocaleString('nl-NL')}</td><td>${b.off.toLocaleString('nl-NL')}</td>
<td>${f1(ca)}%</td><td>${f1(cb)}%</td><td class="${cb - ca < 0 ? 'neg' : 'pos'}">${sign(cb - ca)}pp</td><td>${a.akk}</td><td>${b.akk}</td></tr>`;
}
vt += `<tr class="tot"><td>Alles samen</td><td>${b25.off.toLocaleString('nl-NL')}</td><td>${b26.off.toLocaleString('nl-NL')}</td>
<td>${f1(pc(b25.akk, b25.off))}%</td><td>${f1(pc(b26.akk, b26.off))}%</td><td class="neg">${sign(pc(b26.akk, b26.off) - pc(b25.akk, b25.off))}pp</td>
<td>${b25.akk}</td><td>${b26.akk}</td></tr></tbody></table></div>`;
H.push(vt);

H.push(`<div class="note"><strong>Neem mei erbij en het wordt nog scherper.</strong> Januari tot en met mei: ${b25m.off.toLocaleString('nl-NL')} offertes in 2025 tegen ${b26m.off.toLocaleString('nl-NL')} in 2026 (${sign0(pc(b26m.off, b25m.off) - 100)}%), en daar kwamen ${b25m.akk} tegen ${b26m.akk} akkoorden uit &mdash; praktisch hetzelfde aantal. Je hebt bijna twee keer zoveel offertewerk verzet voor evenveel orders. De omzet steeg wel (${sign0(pc(b26m.omzet, b25m.omzet) - 100)}%, ${eur(b25m.omzet)} naar ${eur(b26m.omzet)}), dus de orders die er kwamen waren gemiddeld groter.</div>`);
H.push(`<div class="note"><strong>&Eacute;&eacute;n voorbehoud dat je moet meewegen.</strong> Dit gaat ervan uit dat de sheet in 2026 net zo consequent is bijgehouden als in 2025. Dat de omzet w&eacute;l meestijgt pleit ervoor dat er geen akkoorden ontbreken &mdash; als er rijen niet werden ingevuld, zou de omzet mee zakken. Zeker weten kan pas door de akkoorden tegen Gripp aan te houden. Doe dat voordat je op deze cijfers een grote beslissing neemt.</div>`);
H.push(`</div></section>`);

// ---------- per maand ----------
H.push(`<section id="maand"><div class="wrap">
<span class="eyebrow">02 &middot; Per maand</span>
<h2>Per maand, beide jaren naast elkaar</h2>
<p class="intro">In 2025 zakte de conversie alleen in de zomerpiek: juni tot augustus op 9,2% tegen 15,2% in het voorjaar. In 2026 begint het jaar al op dat lage niveau en blijft het daar. Het patroon is hetzelfde &mdash; meer aanvragen, slechtere conversie &mdash; maar het is van een seizoensprobleem een jaarrondprobleem geworden.</p>`);

const CW = 1000, CH = 210, PADL = 46, PADR = 90;
const bw = (CW - PADL - PADR) / 12;
const px = i => PADL + i * bw + bw / 2;
const py = v => 22 + (CH - 46) * (1 - v / 24);
let sv = `<svg viewBox="0 0 ${CW} ${CH}" role="img" aria-label="Conversie per maand, 2025 tegenover 2026">`;
for (let g = 0; g <= 4; g++) { const y = 22 + (CH - 46) * g / 4;
  sv += `<line class="gridline" x1="${PADL}" y1="${y.toFixed(1)}" x2="${CW - PADR}" y2="${y.toFixed(1)}"/>`;
  sv += `<text class="axis" x="${PADL - 7}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${24 - 6 * g}%</text>`; }
for (const [naam, D, kleur, mx] of [['2025', D25, 'var(--s2)', 12], ['2026', D26, 'var(--s1)', 7]]) {
  const serie = [];
  for (let m = 1; m <= mx; m++) { const d = D.maand[m]; serie.push(d ? pc(d.akk, d.off) : null); }
  const vast = naam === '2026' ? serie.slice(0, 5) : serie;
  sv += `<polyline points="${vast.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${kleur}" stroke-width="2" stroke-linejoin="round"/>`;
  if (naam === '2026') sv += `<polyline points="${serie.slice(4).map((v, i) => `${px(i + 4).toFixed(1)},${py(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${kleur}" stroke-width="2" stroke-dasharray="3 3" opacity=".55"/>`;
  serie.forEach((v, i) => { const d = D.maand[i + 1]; const onrijp = naam === '2026' && i >= 5;
    sv += `<circle cx="${px(i).toFixed(1)}" cy="${py(v).toFixed(1)}" r="4.5" fill="${kleur}" stroke="var(--surface-2)" stroke-width="2" opacity="${onrijp ? '.5' : '1'}"/>`;
    sv += `<rect class="hit" x="${(px(i) - bw / 2).toFixed(1)}" y="${(py(v) - 14).toFixed(1)}" width="${bw.toFixed(1)}" height="28" data-tip="<b>${MND[i + 1]} ${naam}</b><br>${f1(v)}% conversie<br>${d.akk} van ${d.off.toLocaleString('nl-NL')} offertes<br>${eur(d.omzet)} omzet${onrijp ? '<br><i>nog niet uitgerijpt</i>' : ''}"/>`; });
  const idx = naam === '2026' ? 6 : 11;
  sv += `<text class="dlabel" x="${(px(idx) + 9).toFixed(1)}" y="${(py(serie[idx]) + 3.5).toFixed(1)}" fill="${kleur}">${naam}</text>`;
}
for (let i = 0; i < 12; i++) sv += `<text class="axis" x="${px(i).toFixed(1)}" y="${CH - 8}" text-anchor="middle">${MND[i + 1]}</text>`;
sv += `<text class="axlabel" x="${PADL}" y="11">Conversie naar akkoord per maand</text></svg>`;
H.push(`<figure><div class="chart">${sv}<div class="tip"></div></div>
<div class="legend"><div class="item"><span class="sw" style="background:var(--s2)"></span>2025</div>
<div class="item"><span class="sw" style="background:var(--s1)"></span>2026</div>
<div class="item"><span class="sw" style="background:var(--s1);opacity:.5"></span>2026 nog niet uitgerijpt (gestippeld)</div></div>
<figcaption>2026 ligt het hele jaar op of onder het niveau waar 2025 alleen in de zomerpiek kwam.</figcaption></figure>`);

for (const [jaar, D] of [[2026, D26], [2025, D25]]) {
  const t = D.totaal.alles;
  let mt = `<div class="scroller"><table><caption>Conversie per maand ${jaar}${jaar === 2026 ? '. Mei, juni en juli zijn nog niet volledig uitgerijpt en tellen dus te laag.' : '.'}</caption>
<thead><tr><th>Maand</th><th>Offertes</th><th>Akkoord</th><th>Conversie</th><th>Omzet akkoord</th><th>Productmarge</th><th>Gem. order</th>${jaar === 2026 ? '<th>Rijpheid</th>' : ''}</tr></thead><tbody>`;
  const maxC = Math.max(...D.maandenAanwezig.map(m => pc(D.maand[m].akk, D.maand[m].off)));
  for (const m of D.maandenAanwezig) { const d = D.maand[m]; const onrijp = jaar === 2026 && m >= 5;
    mt += `<tr class="${onrijp ? 'onrijp' : ''}"><td>${MND[m]} ${jaar}</td><td>${d.off.toLocaleString('nl-NL')}</td><td>${d.akk}</td>
<td class="${heat(pc(d.akk, d.off), maxC)}">${f1(pc(d.akk, d.off))}%</td><td>${eur(d.omzet)}</td><td>${eur(d.omzet - d.inkoop)}</td>
<td>${d.akk ? eur(d.omzet / d.akk) : '&mdash;'}</td>${jaar === 2026 ? `<td style="color:var(--ink-3)">${RIJPHEID[m] || 'uitgerijpt'}</td>` : ''}</tr>`; }
  mt += `<tr class="tot"><td>Totaal ${jaar}</td><td>${t.off.toLocaleString('nl-NL')}</td><td>${t.akk.toLocaleString('nl-NL')}</td>
<td>${f1(pc(t.akk, t.off))}%</td><td>${eur(t.omzet)}</td><td>${eur(t.omzet - t.inkoop)}</td><td>${eur(t.omzet / t.akk)}</td>${jaar === 2026 ? '<td></td>' : ''}</tr></tbody></table></div>`;
  H.push(mt);
}
H.push(`</div></section>`);

// ---------- per bron ----------
H.push(`<section id="bron"><div class="wrap">
<span class="eyebrow">03 &middot; Afkomst offerte</span>
<h2>Per bron: in 2025 was Google je beste kanaal, in 2026 zakte ook die weg</h2>
<p class="intro">In 2025 stond Google in alle twaalf maanden boven Meta: ${f1(pc(br25.Google.akk, br25.Google.off))}% tegen ${f1(pc(br25.Meta.akk, br25.Meta.off))}% over het jaar. In 2026 verdrievoudigde je Google-volume in januari&ndash;april (${bronBlok(D25, 'Google').off.toLocaleString('nl-NL')} naar ${bronBlok(D26, 'Google').off.toLocaleString('nl-NL')} offertes) en zakte de conversie van ${f1(pc(bronBlok(D25, 'Google').akk, bronBlok(D25, 'Google').off))}% naar ${f1(pc(bronBlok(D26, 'Google').akk, bronBlok(D26, 'Google').off))}%. Precies wat Meta in 2025 deed toen je daar het budget opvoerde.</p>`);

for (const [jaar, D, br] of [[2026, D26, br26], [2025, D25, br25]]) {
  const t = D.totaal.alles;
  let bt = `<div class="scroller"><table><caption>Per afkomst, ${jaar}${jaar === 2026 ? ' (jan t/m juli, deels nog niet uitgerijpt)' : ''}. Facebook en Instagram samengevoegd tot Meta.</caption>
<thead><tr><th>Bron</th><th>Offertes</th><th>Aandeel</th><th>Akkoord</th><th>Conversie</th><th>Omzet</th><th>Gem. order</th></tr></thead><tbody>`;
  const maxC = Math.max(...KOL.map(k => pc(br[k].akk, br[k].off)));
  for (const k of KOL) { const d = br[k]; if (!d.off) continue;
    bt += `<tr><td>${k === 'Meta' ? 'Meta (FB+IG)' : k}</td><td>${d.off.toLocaleString('nl-NL')}</td><td>${f1(pc(d.off, t.off))}%</td><td>${d.akk}</td>
<td class="${heat(pc(d.akk, d.off), maxC)}">${f1(pc(d.akk, d.off))}%</td><td>${eur(d.omzet)}</td><td>${d.akk ? eur(d.omzet / d.akk) : '&mdash;'}</td></tr>`; }
  bt += `<tr class="tot"><td>Totaal</td><td>${t.off.toLocaleString('nl-NL')}</td><td>100%</td><td>${t.akk.toLocaleString('nl-NL')}</td>
<td>${f1(pc(t.akk, t.off))}%</td><td>${eur(t.omzet)}</td><td>${eur(t.omzet / t.akk)}</td></tr></tbody></table></div>`;
  H.push(bt);

  let am = `<div class="scroller"><table><caption>Conversie per maand per bron, ${jaar}. Kleur = hoogte van het percentage; het kleine getal is het aantal offertes.</caption>
<thead><tr><th>Maand</th>${KOL.map(k => `<th>${k === 'Meta' ? 'Meta (FB+IG)' : k}</th>`).join('')}<th>Alle bronnen</th></tr></thead><tbody>`;
  for (const m of D.maandenAanwezig) {
    const onrijp = jaar === 2026 && m >= 5;
    am += `<tr class="${onrijp ? 'onrijp' : ''}"><td>${MND[m]}${onrijp ? ' *' : ''}</td>`;
    for (const k of KOL) { const c = celBron(D, m, k);
      if (!c.off) { am += `<td class="leeg">&mdash;</td>`; continue; }
      am += `<td class="${heat(pc(c.akk, c.off), 45)}">${f0(pc(c.akk, c.off))}%<span class="sub">${c.off}</span></td>`; }
    const d = D.maand[m];
    am += `<td class="${heat(pc(d.akk, d.off), 45)}">${f0(pc(d.akk, d.off))}%<span class="sub">${d.off}</span></td></tr>`;
  }
  am += `<tr class="tot"><td>${jaar === 2026 ? 'Jan–jul' : 'Jaar'}</td>${KOL.map(k => { const d = br[k];
    return `<td>${f1(pc(d.akk, d.off))}%<span class="sub">${d.off.toLocaleString('nl-NL')}</span></td>`; }).join('')}
<td>${f1(pc(t.akk, t.off))}%<span class="sub">${t.off.toLocaleString('nl-NL')}</span></td></tr></tbody></table></div>`;
  H.push(am);
  H.push(`<div class="ramp"><span>0%</span><span class="cells">${[0,1,2,3,4,5,6].map(i => `<i style="background:var(--h${i})"></i>`).join('')}</span><span>45%+ conversie${jaar === 2026 ? ' &nbsp;&middot;&nbsp; * = nog niet uitgerijpt' : ''}</span></div>`);
}
H.push(`</div></section>`);

// ---------- per product ----------
const P25 = D25.product, P26 = D26.product;
const perg25 = P25.Pergola, perg26 = P26.Pergola, vs25 = P25.Voorraadscherm, vs26 = P26.Voorraadscherm;
H.push(`<section id="product"><div class="wrap">
<span class="eyebrow">04 &middot; Productgroep</span>
<h2>Per product: pergola en voorraadscherm zijn in 2026 uit de hand gelopen</h2>
<p class="intro">In 2025 kostten pergola en voorraadscherm samen ${(perg25.off + vs25.off).toLocaleString('nl-NL')} offertes voor ${perg25.akk + vs25.akk} akkoorden. In de eerste zeven maanden van 2026 zijn dat al ${(perg26.off + vs26.off).toLocaleString('nl-NL')} offertes voor ${perg26.akk + vs26.akk} akkoorden: ${f0(pc(perg26.off + vs26.off, tot26.off))}% van alles wat je uitstuurde, voor ${f1(pc(perg26.akk + vs26.akk, tot26.akk))}% van je orders. Dat is de grootste losse verklaring voor je gedaalde conversie.</p>`);

H.push(`<div class="cards">
<div class="card"><span class="eyebrow">Pergola</span><h3>Veel offertewerk, weinig orders</h3>
<div class="big neg">${f1(pc(perg26.akk, perg26.off))}%</div>
<p><strong>2025:</strong> ${perg25.off.toLocaleString('nl-NL')} offertes, ${perg25.akk} akkoord, ${eur(perg25.omzet)} omzet.<br>
<strong>2026 (7 mnd):</strong> ${perg26.off.toLocaleString('nl-NL')} offertes, ${perg26.akk} akkoord, ${eur(perg26.omzet)} omzet.<br>
Wel je duurste product: ${eur(perg26.omzet / perg26.akk)} gemiddeld per order.</p></div>
<div class="card"><span class="eyebrow">Voorraadscherm</span><h3>Bijna verdrievoudigd in volume</h3>
<div class="big neg">${f1(pc(vs26.akk, vs26.off))}%</div>
<p><strong>2025:</strong> ${vs25.off.toLocaleString('nl-NL')} offertes, ${vs25.akk} akkoord, ${eur(vs25.omzet)} omzet.<br>
<strong>2026 (7 mnd):</strong> ${vs26.off.toLocaleString('nl-NL')} offertes, ${vs26.akk} akkoord, ${eur(vs26.omzet)} omzet.<br>
Gemiddelde order ${eur(vs26.omzet / vs26.akk)}, gezakt van ${eur(vs25.omzet / vs25.akk)}.</p></div>
<div class="card"><span class="eyebrow">Samen</span><h3>Wat het je kost aan capaciteit</h3>
<div class="big">${(perg26.off + vs26.off).toLocaleString('nl-NL')}</div>
<p>offertes in 2026, ${f0(pc(perg26.off + vs26.off, tot26.off))}% van je totale offertewerk, voor ${perg26.akk + vs26.akk} orders. Elk van die offertes kostte tijd die niet naar rolluiken, knikarmschermen of screens ging &mdash; de groepen die w&eacute;l converteren.</p></div>
</div>`);

for (const [jaar, D] of [[2026, D26], [2025, D25]]) {
  const prods = Object.entries(D.product).filter(([, d]) => d.off >= 20).sort((a, b) => b[1].off - a[1].off);
  let pt = `<div class="scroller"><table><caption>Productgroepen met 20+ offertes, ${jaar}${jaar === 2026 ? ' (jan t/m juli)' : ''}.</caption>
<thead><tr><th>Productgroep</th><th>Offertes</th><th>Akkoord</th><th>Conversie</th><th>Omzet</th><th>Gem. order</th><th>Marge %</th></tr></thead><tbody>`;
  const maxC = Math.max(...prods.map(([, d]) => pc(d.akk, d.off)));
  for (const [naam, d] of prods) {
    pt += `<tr><td>${naam}</td><td>${d.off.toLocaleString('nl-NL')}</td><td>${d.akk}</td>
<td class="${heat(pc(d.akk, d.off), maxC)}">${f1(pc(d.akk, d.off))}%</td><td>${eur(d.omzet)}</td>
<td>${d.akk ? eur(d.omzet / d.akk) : '&mdash;'}</td><td>${d.omzet ? f0(pc(d.omzet - d.inkoop, d.omzet)) + '%' : '&mdash;'}</td></tr>`; }
  pt += `</tbody></table></div>`;
  H.push(pt);

  const topP = Object.entries(D.product).filter(([k, d]) => d.off >= 100 && k !== 'Niet ingevuld')
    .sort((a, b) => b[1].off - a[1].off).map(([k]) => k);
  let pm = `<div class="scroller"><table><caption>Conversie per maand per productgroep, ${jaar} (groepen met 100+ offertes). Klein getal = aantal offertes.</caption>
<thead><tr><th>Maand</th>${topP.map(p => `<th>${p}</th>`).join('')}</tr></thead><tbody>`;
  for (const m of D.maandenAanwezig) {
    const onrijp = jaar === 2026 && m >= 5;
    pm += `<tr class="${onrijp ? 'onrijp' : ''}"><td>${MND[m]}${onrijp ? ' *' : ''}</td>`;
    for (const p of topP) { const c = D.maandProduct[m + '|' + p];
      if (!c || !c.off) { pm += `<td class="leeg">&mdash;</td>`; continue; }
      pm += `<td class="${heat(pc(c.akk, c.off), 45)}">${f0(pc(c.akk, c.off))}%<span class="sub">${c.off}</span></td>`; }
    pm += `</tr>`;
  }
  pm += `<tr class="tot"><td>${jaar === 2026 ? 'Jan–jul' : 'Jaar'}</td>${topP.map(p => { const d = D.product[p];
    return `<td>${f1(pc(d.akk, d.off))}%<span class="sub">${d.off.toLocaleString('nl-NL')}</span></td>`; }).join('')}</tr></tbody></table></div>`;
  H.push(pm);
  H.push(`<div class="ramp"><span>0%</span><span class="cells">${[0,1,2,3,4,5,6].map(i => `<i style="background:var(--h${i})"></i>`).join('')}</span><span>45%+ conversie${jaar === 2026 ? ' &nbsp;&middot;&nbsp; * = nog niet uitgerijpt' : ''}</span></div>`);
}
H.push(`</div></section>`);

// ---------- showroom ----------
const win25 = D25.kanaal.Winkel, onl25 = D25.kanaal.Online;
const winR25 = { off: 0, akk: 0 }, winR26 = { off: 0, akk: 0 };
for (const m of RIJP) { const a = D25.maandKanaal[m + '|Winkel'], b = D26.maandKanaal[m + '|Winkel'];
  if (a) { winR25.off += a.off; winR25.akk += a.akk; } if (b) { winR26.off += b.off; winR26.akk += b.akk; } }
H.push(`<section id="showroom"><div class="wrap">
<span class="eyebrow">05 &middot; Showroom</span>
<h2>De showroom blijft je sterkste punt, maar ook daar zakt het</h2>
<p class="intro">In 2025 converteerden offertes met &ldquo;Winkel&rdquo; erbij op ${f1(pc(win25.akk, win25.off))}% tegen ${f1(pc(onl25.akk, onl25.off))}% online, en dat gold v&oacute;&oacute;r elke bron &mdash; ook Meta-leads sprongen van ${f1(pc(D25.kanaalGroep['Online|Meta'].akk, D25.kanaalGroep['Online|Meta'].off))}% naar ${f1(pc(D25.kanaalGroep['Winkel|Meta'].akk, D25.kanaalGroep['Winkel|Meta'].off))}%. Het raakte maar ${win25.off} van ${tot25.off.toLocaleString('nl-NL')} offertes (${f1(pc(win25.off, tot25.off))}%) en leverde ${f0(pc(win25.omzet, tot25.omzet))}% van de omzet. In 2026 zakte de showroom in januari&ndash;april van ${f1(pc(winR25.akk, winR25.off))}% naar ${f1(pc(winR26.akk, winR26.off))}% &mdash; nog altijd verreweg je beste kanaal, maar het daalt mee.</p>`);

const hef = KOL.map(g => ({ bron: g, on: D25.kanaalGroep['Online|' + g], win: D25.kanaalGroep['Winkel|' + g] }))
  .filter(x => x.on && x.win && x.win.off >= 10);
const CH4 = 60 + hef.length * 46;
let s4 = `<svg viewBox="0 0 ${CW} ${CH4}" role="img" aria-label="Conversie online versus showroom per bron in 2025">`;
const bx = 155, bmax = CW - bx - 135;
for (let g = 0; g <= 4; g++) { const x = bx + bmax * g / 4;
  s4 += `<line class="gridline" x1="${x.toFixed(1)}" y1="26" x2="${x.toFixed(1)}" y2="${CH4 - 20}"/>`;
  s4 += `<text class="axis" x="${x.toFixed(1)}" y="${CH4 - 6}" text-anchor="middle">${g * 20}%</text>`; }
hef.forEach((h, i) => {
  const yb = 38 + i * 46, co = pc(h.on.akk, h.on.off), cw = pc(h.win.akk, h.win.off);
  s4 += `<text class="axis" x="${bx - 10}" y="${yb + 15}" text-anchor="end" style="font-size:11.5px;fill:var(--ink)">${h.bron}</text>`;
  s4 += `<rect x="${bx}" y="${yb}" width="${Math.max(bmax * co / 80, 2).toFixed(1)}" height="13" rx="4" fill="var(--s2)"/>`;
  s4 += `<rect class="hit" x="${bx}" y="${yb - 2}" width="${bmax}" height="15" data-tip="<b>${h.bron} &middot; online</b><br>${f1(co)}%<br>${h.on.akk} van ${h.on.off.toLocaleString('nl-NL')}"/>`;
  s4 += `<text class="dlabel" x="${(bx + bmax * co / 80 + 7).toFixed(1)}" y="${yb + 11}" fill="var(--s2)">${f1(co)}%</text>`;
  s4 += `<rect x="${bx}" y="${yb + 15}" width="${Math.max(bmax * cw / 80, 2).toFixed(1)}" height="13" rx="4" fill="var(--s1)"/>`;
  s4 += `<rect class="hit" x="${bx}" y="${yb + 15}" width="${bmax}" height="15" data-tip="<b>${h.bron} &middot; showroom</b><br>${f1(cw)}%<br>${h.win.akk} van ${h.win.off}"/>`;
  s4 += `<text class="dlabel" x="${(bx + bmax * cw / 80 + 7).toFixed(1)}" y="${yb + 26}" fill="var(--s1)">${f1(cw)}% &middot; ${(cw / co).toFixed(1).replace('.', ',')}x</text>`;
});
s4 += `<text class="axlabel" x="${bx}" y="14">Conversie online tegenover showroom per bron, 2025</text></svg>`;
H.push(`<figure><div class="chart">${s4}<div class="tip"></div></div>
<div class="legend"><div class="item"><span class="sw" style="background:var(--s2)"></span>Online</div>
<div class="item"><span class="sw" style="background:var(--s1)"></span>In de showroom geweest</div></div>
<figcaption>Cijfers over heel 2025. Elke bron converteert fors beter zodra de klant in de showroom is geweest.</figcaption></figure>`);
H.push(`<div class="note"><strong>Pas op met de conclusie.</strong> Dit is geen zuiver experiment. Klanten die naar Berkel en Rodenrijs rijden hebben zichzelf al geselecteerd op koopbereidheid, dus een deel van dat verschil zit in de klant en niet in de showroom. De eerlijke lezing: de showroom is v&eacute;&eacute;l te klein om zo veel omzet te verklaren en het is het enige punt in je proces waar &aacute;lle bronnen goed converteren. Voordat je hier kapitaal in stopt, meet het: nodig een willekeurige helft van je Meta-leads actief uit voor de showroom en houd de andere helft als controlegroep.</div>`);
H.push(`</div></section>`);

// ---------- advertentiegeld ----------
const spendRijen = [];
for (const m of [3, 4, 5]) for (const k of ['Meta', 'Google']) {
  const d = D25.maandGroep[m + '|' + k], s = SPEND[m][k];
  const marge = d.omzet - d.inkoop;
  spendRijen.push({ m, k, off: d.off, akk: d.akk, spend: s, cpa: s / d.akk, marge, roas: marge / s });
}
H.push(`<section id="geld"><div class="wrap">
<span class="eyebrow">06 &middot; Advertentiekosten</span>
<h2>Wat je advertentiegeld deed in maart, april en mei 2025</h2>
<p class="intro">Alleen die drie maanden hebben ingevulde kosten in je tab &ldquo;conversie %&rdquo;; voor de rest van 2025 en heel 2026 staat die kolom leeg. Wat er staat is wel duidelijk: Meta&rsquo;s rendement halveerde terwijl het budget omhoog ging, Google bleef stabiel. In 2026 volgde Google hetzelfde patroon zodra je daar het volume opvoerde.</p>`);
let gt = `<div class="scroller"><table><caption>Advertentiekosten uit de tab &ldquo;conversie %&rdquo;, gecombineerd met akkoorden en marges uit het offerteregister. Rendement = productmarge gedeeld door advertentiekosten, v&oacute;&oacute;r montage-uren en overhead.</caption>
<thead><tr><th>Maand</th><th>Kanaal</th><th>Offertes</th><th>Akkoord</th><th>Conversie</th><th>Advertentiekosten</th><th>Kosten per akkoord</th><th>Productmarge</th><th>Rendement</th></tr></thead><tbody>`;
for (const r of spendRijen) {
  gt += `<tr><td>${MND[r.m]} 2025</td><td>${r.k}</td><td>${r.off}</td><td>${r.akk}</td><td>${f1(pc(r.akk, r.off))}%</td>
<td>${eur(r.spend)}</td><td class="${r.cpa > 350 ? 'neg' : 'pos'}">${eur(r.cpa)}</td><td>${eur(r.marge)}</td>
<td class="${r.roas < 3 ? 'neg' : 'pos'}">${r.roas.toFixed(1).replace('.', ',')}x</td></tr>`;
}
gt += `</tbody></table></div>`;
H.push(gt);
H.push(`<div class="note"><strong>Het patroon herhaalt zich.</strong> Meta ging van ${spendRijen[0].roas.toFixed(1).replace('.', ',')}x naar ${spendRijen[4].roas.toFixed(1).replace('.', ',')}x rendement terwijl je het budget van ${eur(19800)} naar ${eur(23700)} bracht. Google hield ${spendRijen[5].roas.toFixed(1).replace('.', ',')} tot ${spendRijen[1].roas.toFixed(1).replace('.', ',')}x vast en was toen nog niet verzadigd. In 2026 verdrievoudigde je het Google-volume en zakte de conversie daar van ${f1(pc(bronBlok(D25, 'Google').akk, bronBlok(D25, 'Google').off))}% naar ${f1(pc(bronBlok(D26, 'Google').akk, bronBlok(D26, 'Google').off))}%. Meer volume op hetzelfde kanaal koopt steeds slechtere leads &mdash; en zonder ingevulde kosten voor 2026 kun je niet zien waar dat omslagpunt lag. <strong>Vul die kostenkolom aan.</strong></div>`);
H.push(`</div></section>`);

// ---------- plan ----------
const bur26 = br26['Buren/Bekenden'], bur25 = br25['Buren/Bekenden'];
const extraOff = b26.off - b25.off, extraAkk = b26.akk - b25.akk;
const herstelAkk = Math.round(b26.off * pc(b25.akk, b25.off) / 100 - b26.akk);
H.push(`<section id="plan"><div class="wrap">
<span class="eyebrow">07 &middot; Advies</span>
<h2>Wat je nu moet doen</h2>
<p class="intro">De diagnose is veranderd sinds vorig jaar. Op de 2025-cijfers alleen was het advies: verschuif budget van Meta naar Google. Nu Google w&eacute;l is opgeschaald en samen met alles &eacute;n de showroom &eacute;n mond-tot-mond is gezakt, is de conclusie een andere: je koopt meer leads dan je bedrijf kan verwerken. Alles hieronder is gerekend met de gemiddelde productmarge van ${eur(gemMarge)} per akkoord uit 2025.</p>

<ol class="acties">
<li><span class="when">Deze maand</span><h3>Stop met opschalen en zet het volume terug</h3>
<p>Je bracht januari&ndash;april van ${b25.off.toLocaleString('nl-NL')} naar ${b26.off.toLocaleString('nl-NL')} offertes en kreeg ${extraAkk} orders extra. Elke offerte die niet sluit kost inmeettijd, opvolging en rekenwerk. Zet het advertentievolume terug richting het niveau van 2025 en kijk wat er met de conversie gebeurt. Veert die terug naar ${f1(pc(b25.akk, b25.off))}%, dan leverde het extra volume je per saldo niets op behalve kosten.</p>
<p class="bedrag">${extraOff.toLocaleString('nl-NL')} extra offertes leverden ${extraAkk} extra akkoorden = 1 order per ${Math.round(extraOff / extraAkk)} extra offertes</p></li>

<li><span class="when">Deze maand</span><h3>Zet pergola en voorraadscherm stil tot ze werken</h3>
<p>Samen ${(perg26.off + vs26.off).toLocaleString('nl-NL')} offertes in zeven maanden voor ${perg26.akk + vs26.akk} orders. Dat is ${f0(pc(perg26.off + vs26.off, tot26.off))}% van je offertewerk voor ${f1(pc(perg26.akk + vs26.akk, tot26.akk))}% van je orders. Dit is de snelste manier om capaciteit vrij te maken zonder omzet te verliezen &mdash; die offertes sluiten toch niet. Zoek eerst uit waar het misgaat (prijs, levertijd of het verkoopgesprek) voordat je er weer budget op zet.</p>
<p class="bedrag">Maakt direct ruimte vrij voor ongeveer ${Math.round((perg26.off + vs26.off) / 7)} offertes per maand aan opvolgcapaciteit</p></li>

<li><span class="when">Voor je iets groots beslist</span><h3>Controleer de akkoorden tegen Gripp</h3>
<p>Alles hierboven gaat ervan uit dat de sheet in 2026 net zo netjes is bijgehouden als in 2025. Dat de omzet w&eacute;l meestijgt (${sign0(pc(b26.omzet, b25.omzet) - 100)}% in januari&ndash;april) pleit ervoor dat er geen akkoorden ontbreken, maar het is geen bewijs. Tel de Gripp-opdrachten van januari tot april 2026 en leg ze naast de ${b26.akk} akkoorden uit de sheet. Wijkt dat sterk af, dan is een deel van de conversiedaling een registratieprobleem in plaats van een verkoopprobleem &mdash; en dat verandert het hele advies.</p>
<p class="bedrag">Een halve dag werk; het bepaalt of je een verkoopprobleem of een boekhoudprobleem hebt</p></li>

<li><span class="when">Voor het najaar</span><h3>Bouw verwerkingscapaciteit, niet meer vraag</h3>
<p>De doorlooptijd van offerte naar akkoord is in 2026 mediaan 24 dagen; in januari 2025 was dat nog 11. Dat is de opvolgachterstand die zich opbouwt. Wie je in mei aanneemt is in juli nog aan het inwerken; wie je in het najaar aanneemt draait volgend voorjaar mee. Werf en train dus in het dal, niet in de piek.</p>
<p class="bedrag">De conversie terug naar ${f1(pc(b25.akk, b25.off))}% over de huidige ${b26.off.toLocaleString('nl-NL')} offertes = ${herstelAkk} akkoorden extra &asymp; ${eur(herstelAkk * gemMarge)} productmarge</p></li>

<li><span class="when">Doorlopend</span><h3>Bescherm je twee gratis kanalen</h3>
<p>Buren en bekenden: in 2025 ${bur25.off.toLocaleString('nl-NL')} offertes op ${f1(pc(bur25.akk, bur25.off))}% conversie, in 2026 ${bur26.off.toLocaleString('nl-NL')} op ${f1(pc(bur26.akk, bur26.off))}%. De showroom idem. Dit zijn je twee kanalen zonder advertentiekosten en met verreweg de beste conversie, en juist die zakken nu mee &mdash; het duidelijkste teken dat het aan de opvolging ligt en niet aan de leads. Zet ze vooraan in de wachtrij: een klant uit de showroom of via mond-tot-mond mag nooit achter een koude Meta-lead staan.</p>
<p class="bedrag">Zonradar staat al klaar voor burenacties en verdient een vast maandbudget</p></li>

<li><span class="when">Deze week</span><h3>Repareer de akkoordregistratie in de sheet</h3>
<p>De vinkjeskolom &ldquo;Akkoord&rdquo; staat op 313 voor heel 2025 terwijl het er ${tot25.akk.toLocaleString('nl-NL')} zijn. Wie op die kolom stuurt ziet juni 2025 als een maand met nul verkoop. Haal de kolom weg of laat hem automatisch vullen zodra er een Gripp-nummer in de rij staat. Vul meteen de kostenkolom in de tab &ldquo;conversie %&rdquo; aan, want zonder advertentiekosten over 2026 kun je niet berekenen wat een order je kost.</p>
<p class="bedrag">Kost niets en voorkomt dat je op een factor 3,5 te lage conversie stuurt</p></li>
</ol>
</div></section>`);

H.push(`<footer><div class="wrap">
<p><strong style="color:var(--ink)">Waar dit op gebaseerd is.</strong> Google Sheet &ldquo;Offerte formulier register 2024/2025/2026&rdquo;, de twaalf maandtabbladen van 2025 en de zeven van 2026, uitgelezen op 27 juli 2026. ${tot25.off.toLocaleString('nl-NL')} offerterijen over 2025 en ${tot26.off.toLocaleString('nl-NL')} over 2026. De tabbladen &ldquo;2025 alles bij elkaar&rdquo; en &ldquo;Augustus 2025&rdquo; zijn overgeslagen: het eerste is een deelkopie van januari tot 18 maart en zou dubbeltellen, het tweede is leeg.</p>
<p><strong style="color:var(--ink)">Keuzes die de cijfers be&iuml;nvloeden.</strong> Een offerte geldt als akkoord wanneer het akkoord-blok gevuld is (Gripp-nummer, akkoorddatum of akkoordbedrag), niet op basis van de vinkjeskolom. De maand komt van het tabblad, omdat de datumcel regelmatig onvolledig is of een verkeerd jaartal heeft. Alle vergelijkingen tussen de jaren gebruiken januari tot en met april, omdat mei tot juli 2026 nog niet zijn uitgerijpt. Facebook en Instagram zijn samengevoegd vanwege de labelwissel in augustus/september 2025. In beide jaren staan enkele tientallen losse akkoordrijen zonder offertedatum (51 in 2025, 46 in 2026); die be&iuml;nvloeden de conversie met 0,1 procentpunt en zijn niet apart behandeld.</p>
<p><strong style="color:var(--ink)">Wat hier niet in zit.</strong> Marge is verkoop min inkoop uit de sheet zelf, dus productmarge v&oacute;&oacute;r montage-uren, inmeten, garantie en overhead &mdash; de echte winst per order is lager. Advertentiekosten zijn alleen bekend voor maart, april en mei 2025; voor de rest van 2025 en heel 2026 staat die kolom leeg, dus kosten per order zijn voor 2026 niet te berekenen. De 2026-cijfers zijn niet tegen Gripp gecontroleerd.</p>
</div></footer>`);

H.push(`<script>
document.querySelectorAll('.chart').forEach(function(chart){
  var tip = chart.querySelector('.tip');
  if(!tip) return;
  chart.querySelectorAll('.hit').forEach(function(hit){
    function toon(){
      tip.innerHTML = hit.getAttribute('data-tip');
      tip.style.opacity = '1';
      var cb = chart.getBoundingClientRect(), hb = hit.getBoundingClientRect();
      var x = hb.left + hb.width/2 - cb.left, y = hb.top - cb.top;
      var tb = tip.getBoundingClientRect();
      tip.style.left = Math.max(4, Math.min(cb.width - tb.width - 4, x - tb.width/2)) + 'px';
      tip.style.top  = Math.max(4, y - tb.height - 8) + 'px';
    }
    hit.addEventListener('mouseenter', toon);
    hit.addEventListener('mousemove', toon);
    hit.addEventListener('focus', toon);
    hit.addEventListener('mouseleave', function(){ tip.style.opacity='0'; });
    hit.addEventListener('blur', function(){ tip.style.opacity='0'; });
    hit.setAttribute('tabindex','0');
  });
});
</script>`);

const uit = path.join(__dirname, '..', 'data', 'conversie-2025-rapport.html');
fs.writeFileSync(uit, H.join('\n'));
console.log('geschreven:', uit, (fs.statSync(uit).size / 1024).toFixed(0) + ' kB');

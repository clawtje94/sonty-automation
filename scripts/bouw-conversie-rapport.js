#!/usr/bin/env node
// Bouwt het HTML-rapport uit data/conversie-2025-tabellen.json.
// Genereren i.p.v. handmatig overtypen: zo kunnen de cijfers in het rapport niet
// afwijken van de cijfers uit de sheet.
const fs = require('fs');
const path = require('path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'conversie-2025-tabellen.json'), 'utf8'));

const MND = ['', 'jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const eur = n => '€' + Math.round(n).toLocaleString('nl-NL');
const eurK = n => '€' + Math.round(n / 1000).toLocaleString('nl-NL') + 'k';
const pc = (a, b) => b ? (a / b * 100) : 0;
const f1 = n => n.toFixed(1).replace('.', ',');
const f0 = n => n.toFixed(0);

// Advertentiekosten zoals Daimy ze zelf in de tab "conversie %" heeft ingevuld.
// Alleen maart t/m mei 2025 zijn gevuld; juni is leeg gelaten.
const SPEND = { 3: { Meta: 19800, Google: 6300 }, 4: { Meta: 22000, Google: 10300 }, 5: { Meta: 23700, Google: 17100 } };

const tot = D.totaal.alles;
const gemMarge = (tot.omzet - tot.inkoop) / tot.akk;

// ---- afkomst: Facebook+Instagram samenvoegen tot Meta (labelwissel medio 2025) ----
const afkomstRuw = D.afkomst;
const meta = { off: 0, akk: 0, omzet: 0, inkoop: 0 };
for (const k of ['Facebook', 'Instagram']) for (const p of ['off', 'akk', 'omzet', 'inkoop']) meta[p] += afkomstRuw[k][p];
const bureken = { off: 0, akk: 0, omzet: 0, inkoop: 0 };
for (const k of ['Bekenden', 'Buren']) for (const p of ['off', 'akk', 'omzet', 'inkoop']) bureken[p] += afkomstRuw[k][p];

const bronnen = [
  ['Google', D.afkomst.Google, 'Zoekende klant met een concreet plan.'],
  ['Meta (FB+IG)', meta, 'Facebook en Instagram samen: de labels zijn medio 2025 omgezet.'],
  ['Buren &amp; bekenden', bureken, 'Mond-tot-mond. Kost vrijwel niets.'],
  ['Anders', D.afkomst.Anders, 'Overige herkomst.'],
  ['Niet ingevuld', D.afkomst['(leeg)'], 'Afkomst leeg gelaten in de sheet.'],
];

// ---- maandtabel ----
const maanden = [];
for (let m = 1; m <= 12; m++) maanden.push({ m, ...D.maand[m] });
const maxOff = Math.max(...maanden.map(x => x.off));

// ---- afkomst-matrix: kolommen met genoeg volume ----
const kolAfkomst = ['Google', 'Meta', 'Buren/Bekenden', 'Anders'];
function celAfkomst(m, kol) {
  const bron = { off: 0, akk: 0 };
  const bij = k => { const c = D.maandAfkomst[m + '|' + k]; if (c) { bron.off += c.off; bron.akk += c.akk; } };
  if (kol === 'Google') bij('Google');
  else if (kol === 'Meta') { bij('Facebook'); bij('Instagram'); }
  else if (kol === 'Buren/Bekenden') { bij('Bekenden'); bij('Buren'); }
  else { bij('Anders'); bij('(leeg)'); }
  return bron;
}

// ---- productmatrix ----
const prodNamen = Object.entries(D.product).filter(([k, v]) => v.off >= 100 && k !== '(leeg)')
  .sort((a, b) => b[1].off - a[1].off).map(([k]) => k);
const prodAlle = Object.entries(D.product).sort((a, b) => b[1].off - a[1].off);

// ---- showroom-hefboom ----
const kx = D.kanaalAfkomst;
const hefboom = ['Meta', 'Google', 'Buren/Bekenden', 'Anders'].map(g => ({
  bron: g, on: kx['Online|' + g], win: kx['Winkel|' + g],
})).filter(x => x.on && x.win);

// ---- capaciteit ----
const som = (ms, f) => ms.reduce((a, m) => a + f(D.maand[m]), 0);
const rustig = [1, 2, 3, 4, 5], piek = [6, 7, 8];
const rConv = som(rustig, d => d.akk) / som(rustig, d => d.off);
const pConv = som(piek, d => d.akk) / som(piek, d => d.off);
const gemistAkk = Math.round(som(piek, d => d.off) * rConv - som(piek, d => d.akk));
const gemistEur = gemistAkk * gemMarge;

// ---- adspend-tabel ----
const spendRijen = [];
for (const m of [3, 4, 5]) for (const k of ['Meta', 'Google']) {
  const d = D.maandMeta[m + '|' + k], s = SPEND[m][k];
  const marge = d.omzet - d.inkoop;
  spendRijen.push({ m, k, off: d.off, akk: d.akk, spend: s, cpa: s / d.akk, marge, na: marge - s, roas: marge / s });
}

// ---- heatmap-kleur ----
const RAMP = 7;
function heatKlasse(v, max) {
  if (v === null) return 'leeg';
  const stap = Math.min(RAMP - 1, Math.max(0, Math.round(v / max * (RAMP - 1))));
  return 'h' + stap;
}

// ================= HTML =================
const H = [];
H.push(`<title>Sonty conversie 2025 — per maand, bron en productgroep</title>`);
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
.mono{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;}
h1,h2,h3{letter-spacing:-0.022em;text-wrap:balance;margin:0;font-weight:750;line-height:1.14;}
h1{font-size:clamp(2rem,5.2vw,3.35rem);}
h2{font-size:clamp(1.4rem,3vw,1.95rem);}
h3{font-size:1.06rem;letter-spacing:-0.01em;}
p{margin:0;}
a{color:var(--accent);}
.wrap{max-width:1180px;margin:0 auto;padding:0 clamp(1rem,4vw,2.75rem);}

/* eyebrow: monospace label, de meetinstrument-taal van een sheet-audit */
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
@media(max-width:760px){nav.jump{display:none}}

.hero{padding:clamp(2.75rem,7vw,5rem) 0 clamp(1.75rem,4vw,2.75rem);}
.hero h1{margin:.7rem 0 0;max-width:24ch;}
.lede{margin-top:1.15rem;max-width:62ch;font-size:1.075rem;color:var(--ink-2);}

.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:1px;
  background:var(--rule);border:1px solid var(--rule);margin:clamp(1.75rem,4vw,2.5rem) 0 0;}
.kpi{background:var(--surface-2);padding:1.15rem 1.15rem 1.05rem;}
.kpi .v{font-size:clamp(1.5rem,3.6vw,2.1rem);font-weight:750;letter-spacing:-.03em;
  font-variant-numeric:tabular-nums;line-height:1.05;margin-top:.4rem;}
.kpi .n{font-size:.78rem;color:var(--ink-3);margin-top:.35rem;line-height:1.4;}

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
.ramp{display:flex;align-items:center;gap:.45rem;font-size:.75rem;color:var(--ink-3);}
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

// ---------- header ----------
H.push(`<header class="top"><div class="wrap">
<span class="brandmark"><i></i>Sonty&nbsp;data</span>
<nav class="jump">
<a href="#maand">Per maand</a><a href="#bron">Per bron</a><a href="#product">Per product</a>
<a href="#showroom">Showroom</a><a href="#geld">Advertentiegeld</a><a href="#plan">Investeringsplan</a>
</nav></div></header>`);

// ---------- hero ----------
H.push(`<div class="wrap hero">
<span class="eyebrow">Offerteregister 2025 &middot; ${tot.off.toLocaleString('nl-NL')} offertes geanalyseerd</span>
<h1>Het probleem is niet te weinig aanvragen. Het is wat er daarna mee gebeurt.</h1>
<p class="lede">Sonty haalde in 2025 ${tot.off.toLocaleString('nl-NL')} offertes op en zette daar ${tot.akk.toLocaleString('nl-NL')} akkoorden uit: ${f1(pc(tot.akk, tot.off))}%. De maanden met de m&eacute;&eacute;ste aanvragen zijn precies de maanden met de sl&eacute;chtste conversie, en het duurste kanaal levert de laagste. Hieronder per maand, per bron en per productgroep, plus waar het geld het beste heen kan.</p>
<div class="kpis">
<div class="kpi"><span class="eyebrow">Offertes</span><div class="v">${tot.off.toLocaleString('nl-NL')}</div><div class="n">in heel 2025</div></div>
<div class="kpi"><span class="eyebrow">Akkoord</span><div class="v">${tot.akk.toLocaleString('nl-NL')}</div><div class="n">${f1(pc(tot.akk, tot.off))}% conversie</div></div>
<div class="kpi"><span class="eyebrow">Omzet akkoord</span><div class="v">${eur(tot.omzet).replace('€', '€ ')}</div><div class="n">incl. btw</div></div>
<div class="kpi"><span class="eyebrow">Productmarge</span><div class="v">${eur(tot.omzet - tot.inkoop).replace('€', '€ ')}</div><div class="n">${f0(pc(tot.omzet - tot.inkoop, tot.omzet))}% &mdash; v&oacute;&oacute;r montage en overhead</div></div>
<div class="kpi"><span class="eyebrow">Gem. order</span><div class="v">${eur(tot.omzet / tot.akk).replace('€', '€ ')}</div><div class="n">${eur(gemMarge)} marge per akkoord</div></div>
</div>
</div>`);

// ---------- datawaarschuwing ----------
H.push(`<section id="data"><div class="wrap">
<span class="eyebrow">Eerst dit</span>
<h2>Twee dingen in de sheet die de cijfers anders vertellen dan je denkt</h2>
<div class="note"><strong>De kolom &ldquo;Akkoord&rdquo; met vinkjes is onbruikbaar.</strong> Die staat op 313 akkoorden voor heel 2025, maar in juni staat hij op 0 terwijl er 1.221 offertes uitgingen, en in mei op 1. Dat kan niet. Het akkoord-blok ernaast &mdash; Gripp-nummer, akkoorddatum en akkoordbedrag &mdash; is w&eacute;l consistent gevuld en komt onderling overeen (1.059 / 1.081 / 1.088 rijen). Alle cijfers hier komen uit dat blok: ${tot.akk.toLocaleString('nl-NL')} akkoorden. Ter controle naast jouw eigen tab &ldquo;conversie %&rdquo;: maart 625 offertes tegen jouw 627, april 907 tegen 896, mei 1.240 tegen 1.227.</div>
<div class="note"><strong>Je afkomst-labels zijn medio 2025 omgezet.</strong> Tot en met augustus heette Meta-traffic &ldquo;Facebook&rdquo;, vanaf september &ldquo;Instagram&rdquo;: Facebook zakt van 558 offertes in augustus naar 4 in september, terwijl Instagram in dezelfde stap van 63 naar 345 springt. Los gelezen lijkt Facebook dood en Instagram nieuw. Ze zijn hier samengevoegd als &eacute;&eacute;n kanaal Meta.</div>
</div></section>`);

// ---------- 1. per maand ----------
const conv = maanden.map(x => pc(x.akk, x.off));
H.push(`<section id="maand"><div class="wrap">
<span class="eyebrow">01 &middot; Seizoen</span>
<h2>Per maand: de drukste maanden converteren het slechtst</h2>
<p class="intro">Januari tot mei liep op ${f1(rConv * 100)}% conversie. Juni tot augustus &mdash; ruim m&eacute;&eacute;r aanvragen &mdash; op ${f1(pConv * 100)}%. De correlatie tussen offertevolume en conversie is &minus;0,50: hoe meer er binnenkomt, hoe minder er uitkomt. Dat is geen vraagprobleem, dat is een verwerkingsprobleem.</p>`);

// twee uitgelijnde charts (geen dubbele as)
const CW = 1000, CH1 = 150, CH2 = 165, PADL = 46, PADR = 16;
const bw = (CW - PADL - PADR) / 12;
let s1 = `<svg viewBox="0 0 ${CW} ${CH1}" role="img" aria-label="Offertevolume per maand 2025">`;
for (let g = 0; g <= 3; g++) { const y = 18 + (CH1 - 40) * g / 3;
  s1 += `<line class="gridline" x1="${PADL}" y1="${y.toFixed(1)}" x2="${CW - PADR}" y2="${y.toFixed(1)}"/>`;
  s1 += `<text class="axis" x="${PADL - 7}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${Math.round(1500 - 500 * g)}</text>`; }
maanden.forEach((d, i) => {
  const h = (d.off / 1500) * (CH1 - 40);
  const x = PADL + i * bw + bw * 0.17, y = CH1 - 22 - h, w = bw * 0.66;
  s1 += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(h, 1).toFixed(1)}" rx="4" fill="var(--s2)"/>`;
  s1 += `<text class="axis" x="${(x + w / 2).toFixed(1)}" y="${CH1 - 8}" text-anchor="middle">${MND[d.m]}</text>`;
  s1 += `<rect class="hit" x="${(PADL + i * bw).toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${CH1 - 22}" data-tip="<b>${MND[d.m]} 2025</b><br>${d.off.toLocaleString('nl-NL')} offertes"/>`;
});
s1 += `<text class="axlabel" x="${PADL}" y="9">Offertes per maand</text></svg>`;

let s2 = `<svg viewBox="0 0 ${CW} ${CH2}" role="img" aria-label="Conversiepercentage per maand 2025">`;
for (let g = 0; g <= 4; g++) { const y = 18 + (CH2 - 40) * g / 4;
  s2 += `<line class="gridline" x1="${PADL}" y1="${y.toFixed(1)}" x2="${CW - PADR}" y2="${y.toFixed(1)}"/>`;
  s2 += `<text class="axis" x="${PADL - 7}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${(24 - 6 * g)}%</text>`; }
const px = i => PADL + i * bw + bw / 2;
const py = v => 18 + (CH2 - 40) * (1 - v / 24);
const pts = conv.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
s2 += `<polyline points="${pts}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round"/>`;
conv.forEach((v, i) => {
  s2 += `<circle cx="${px(i).toFixed(1)}" cy="${py(v).toFixed(1)}" r="4.5" fill="var(--s1)" stroke="var(--surface-2)" stroke-width="2"/>`;
  if ([0, 5, 6, 10].includes(i)) s2 += `<text class="dlabel" x="${px(i).toFixed(1)}" y="${(py(v) - 11).toFixed(1)}" text-anchor="middle" fill="var(--s1)">${f1(v)}%</text>`;
  s2 += `<text class="axis" x="${px(i).toFixed(1)}" y="${CH2 - 8}" text-anchor="middle">${MND[i + 1]}</text>`;
  s2 += `<rect class="hit" x="${(PADL + i * bw).toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${CH2 - 22}" data-tip="<b>${MND[i + 1]} 2025</b><br>${f1(v)}% conversie<br>${maanden[i].akk} van ${maanden[i].off.toLocaleString('nl-NL')}<br>${eur(maanden[i].omzet)} omzet"/>`;
});
s2 += `<text class="axlabel" x="${PADL}" y="9">Conversie naar akkoord</text></svg>`;

H.push(`<figure><div class="chart">${s1}<div class="tip"></div></div>
<div class="chart" style="border-top:0">${s2}<div class="tip"></div></div>
<figcaption>Zelfde tijdas, twee losse schalen &mdash; volume in aantallen, conversie in procenten. De piek in aanvragen (mei&ndash;augustus) valt samen met de dip in conversie.</figcaption></figure>`);

// maandtabel
let mt = `<div class="scroller"><table><caption>Conversie per maand, 2025. Omzet en marge zijn incl. btw uit de akkoordkolommen.</caption>
<thead><tr><th>Maand</th><th>Offertes</th><th>Akkoord</th><th>Conversie</th><th>Omzet akkoord</th><th>Productmarge</th><th>Gem. order</th></tr></thead><tbody>`;
const maxConvM = Math.max(...conv);
maanden.forEach((d, i) => {
  mt += `<tr><td>${MND[d.m]} 2025</td><td>${d.off.toLocaleString('nl-NL')}</td><td>${d.akk}</td>
<td class="${heatKlasse(conv[i], maxConvM)}">${f1(conv[i])}%</td>
<td>${eur(d.omzet)}</td><td>${eur(d.omzet - d.inkoop)}</td><td>${eur(d.omzet / d.akk)}</td></tr>`;
});
mt += `<tr class="tot"><td>Totaal 2025</td><td>${tot.off.toLocaleString('nl-NL')}</td><td>${tot.akk.toLocaleString('nl-NL')}</td>
<td>${f1(pc(tot.akk, tot.off))}%</td><td>${eur(tot.omzet)}</td><td>${eur(tot.omzet - tot.inkoop)}</td><td>${eur(tot.omzet / tot.akk)}</td></tr>
</tbody></table></div>`;
H.push(mt);
H.push(`<div class="note"><strong>Wat de zomerdip kost.</strong> Had juni tot augustus op het niveau van januari&ndash;mei gezeten (${f1(rConv * 100)}%), dan waren dat ${gemistAkk} akkoorden extra geweest: ongeveer ${eur(gemistEur)} productmarge. Dat is meer dan het hele Meta-advertentiebudget van die periode. De doorlooptijd van offerte naar akkoord loopt in dezelfde beweging op van 11 dagen in januari naar 24&ndash;27 dagen in juni&ndash;augustus en 32&ndash;38 dagen in het najaar &mdash; dat is de opvolgachterstand die zich opbouwt.</div>`);
H.push(`</div></section>`);

// ---------- 2. per bron ----------
H.push(`<section id="bron"><div class="wrap">
<span class="eyebrow">02 &middot; Afkomst offerte</span>
<h2>Per bron: Google converteert twee keer beter dan Meta, elke maand van het jaar</h2>
<p class="intro">Meta leverde ${pc(meta.off, tot.off).toFixed(0)}% van alle offertes maar ${pc(meta.akk, tot.akk).toFixed(0)}% van de akkoorden. Google is precies omgekeerd. En dit is geen ruis in &eacute;&eacute;n maand: Google staat in alle twaalf maanden boven Meta, met een verschil van 2 tot 16 procentpunt.</p>`);

let bt = `<div class="scroller"><table><caption>Per afkomst over heel 2025. Facebook en Instagram zijn samengevoegd tot Meta vanwege de labelwissel.</caption>
<thead><tr><th>Bron</th><th>Offertes</th><th>Aandeel</th><th>Akkoord</th><th>Conversie</th><th>Omzet</th><th>Productmarge</th><th>Gem. order</th></tr></thead><tbody>`;
const maxConvB = Math.max(...bronnen.map(([, d]) => pc(d.akk, d.off)));
for (const [naam, d] of bronnen) {
  bt += `<tr><td>${naam}</td><td>${d.off.toLocaleString('nl-NL')}</td><td>${f1(pc(d.off, tot.off))}%</td><td>${d.akk}</td>
<td class="${heatKlasse(pc(d.akk, d.off), maxConvB)}">${f1(pc(d.akk, d.off))}%</td>
<td>${eur(d.omzet)}</td><td>${eur(d.omzet - d.inkoop)}</td><td>${eur(d.omzet / (d.akk || 1))}</td></tr>`;
}
bt += `<tr class="tot"><td>Totaal</td><td>${tot.off.toLocaleString('nl-NL')}</td><td>100%</td><td>${tot.akk.toLocaleString('nl-NL')}</td>
<td>${f1(pc(tot.akk, tot.off))}%</td><td>${eur(tot.omzet)}</td><td>${eur(tot.omzet - tot.inkoop)}</td><td>${eur(tot.omzet / tot.akk)}</td></tr>
</tbody></table></div>`;
H.push(bt);

// Meta vs Google lijnchart
const CH3 = 200;
let s3 = `<svg viewBox="0 0 ${CW} ${CH3}" role="img" aria-label="Conversie Meta versus Google per maand 2025">`;
for (let g = 0; g <= 4; g++) { const y = 22 + (CH3 - 46) * g / 4;
  s3 += `<line class="gridline" x1="${PADL}" y1="${y.toFixed(1)}" x2="${CW - PADR}" y2="${y.toFixed(1)}"/>`;
  s3 += `<text class="axis" x="${PADL - 7}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${(24 - 6 * g)}%</text>`; }
const py3 = v => 22 + (CH3 - 46) * (1 - v / 24);
for (const [naam, kleur, sleutel] of [['Google', 'var(--s2)', 'Google'], ['Meta', 'var(--s1)', 'Meta']]) {
  const serie = [];
  for (let m = 1; m <= 12; m++) { const d = D.maandMeta[m + '|' + sleutel]; serie.push(d ? pc(d.akk, d.off) : null); }
  const p = serie.map((v, i) => v === null ? null : `${px(i).toFixed(1)},${py3(v).toFixed(1)}`).filter(Boolean).join(' ');
  s3 += `<polyline points="${p}" fill="none" stroke="${kleur}" stroke-width="2" stroke-linejoin="round"/>`;
  serie.forEach((v, i) => { if (v === null) return;
    const d = D.maandMeta[(i + 1) + '|' + sleutel];
    s3 += `<circle cx="${px(i).toFixed(1)}" cy="${py3(v).toFixed(1)}" r="4.5" fill="${kleur}" stroke="var(--surface-2)" stroke-width="2"/>`;
    s3 += `<rect class="hit" x="${(px(i) - bw / 2).toFixed(1)}" y="${(py3(v) - 14).toFixed(1)}" width="${bw.toFixed(1)}" height="28" data-tip="<b>${naam} &middot; ${MND[i + 1]}</b><br>${f1(v)}% conversie<br>${d.akk} van ${d.off.toLocaleString('nl-NL')} offertes"/>`;
  });
  // directe labels aan het einde van elke lijn
  const laatste = serie.length - 1;
  s3 += `<text class="dlabel" x="${(px(laatste) + 9).toFixed(1)}" y="${(py3(serie[laatste]) + 3.5).toFixed(1)}" fill="${kleur}">${naam}</text>`;
}
for (let i = 0; i < 12; i++) s3 += `<text class="axis" x="${px(i).toFixed(1)}" y="${CH3 - 8}" text-anchor="middle">${MND[i + 1]}</text>`;
s3 += `<text class="axlabel" x="${PADL}" y="11">Conversie per bron per maand</text></svg>`;
H.push(`<figure><div class="chart">${s3}<div class="tip"></div></div>
<div class="legend"><div class="item"><span class="sw" style="background:var(--s2)"></span>Google</div>
<div class="item"><span class="sw" style="background:var(--s1)"></span>Meta (Facebook + Instagram)</div></div>
<figcaption>Google ligt in elke maand boven Meta. Het gat is het grootst in februari (+16 pp) en april (+12 pp).</figcaption></figure>`);

// matrix maand x afkomst
let am = `<div class="scroller"><table><caption>Conversie per maand per bron. Kleur = hoogte van het percentage; het kleine getal is het aantal offertes.</caption>
<thead><tr><th>Maand</th>${kolAfkomst.map(k => `<th>${k === 'Meta' ? 'Meta (FB+IG)' : k}</th>`).join('')}<th>Alle bronnen</th></tr></thead><tbody>`;
for (let m = 1; m <= 12; m++) {
  am += `<tr><td>${MND[m]}</td>`;
  for (const k of kolAfkomst) {
    const c = celAfkomst(m, k);
    if (!c.off) { am += `<td class="leeg">&mdash;</td>`; continue; }
    const v = pc(c.akk, c.off);
    am += `<td class="${heatKlasse(v, 45)}">${f0(v)}%<span class="sub">${c.off}</span></td>`;
  }
  const d = D.maand[m];
  am += `<td class="${heatKlasse(pc(d.akk, d.off), 45)}">${f0(pc(d.akk, d.off))}%<span class="sub">${d.off}</span></td></tr>`;
}
am += `<tr class="tot"><td>Jaar</td>`;
for (const k of kolAfkomst) {
  let o = 0, a = 0; for (let m = 1; m <= 12; m++) { const c = celAfkomst(m, k); o += c.off; a += c.akk; }
  am += `<td>${f1(pc(a, o))}%<span class="sub">${o.toLocaleString('nl-NL')}</span></td>`;
}
am += `<td>${f1(pc(tot.akk, tot.off))}%<span class="sub">${tot.off.toLocaleString('nl-NL')}</span></td></tr></tbody></table></div>`;
H.push(am);
H.push(`<div class="ramp" style="margin-top:1rem"><span>0%</span><span class="cells">${[0, 1, 2, 3, 4, 5, 6].map(i => `<i style="background:var(--h${i})"></i>`).join('')}</span><span>45%+ conversie</span></div>`);
H.push(`<div class="note"><strong>Buren en bekenden zijn je beste kanaal en je kleinste.</strong> ${bureken.off} offertes (${f1(pc(bureken.off, tot.off))}% van het totaal) met ${f1(pc(bureken.akk, bureken.off))}% conversie en ${eur(bureken.omzet)} omzet, tegen vrijwel geen advertentiekosten. Meta heeft ${(meta.off / bureken.off).toFixed(0)}x zoveel offertes nodig voor ${(meta.omzet / bureken.omzet).toFixed(1).replace('.', ',')}x de omzet.</div>`);
H.push(`</div></section>`);

// ---------- 3. per productgroep ----------
H.push(`<section id="product"><div class="wrap">
<span class="eyebrow">03 &middot; Productgroep</span>
<h2>Per product: pergola&rsquo;s en voorraadschermen slurpen offertes en leveren niks</h2>
<p class="intro">Rolluiken zijn de motor: ${D.product.Rolluiken.off.toLocaleString('nl-NL')} offertes, ${f1(pc(D.product.Rolluiken.akk, D.product.Rolluiken.off))}% conversie, ${eur(D.product.Rolluiken.omzet)} omzet. Maar pergola en voorraadscherm samen kostten ${(D.product.Pergola.off + D.product.Voorraadscherm.off).toLocaleString('nl-NL')} offertes &mdash; ${f0(pc(D.product.Pergola.off + D.product.Voorraadscherm.off, tot.off))}% van alles wat je uitstuurde &mdash; en leverden ${D.product.Pergola.akk + D.product.Voorraadscherm.akk} akkoorden op.</p>`);

let pt = `<div class="scroller"><table><caption>Alle productgroepen uit de kolom &ldquo;Product cat&rdquo;, 2025.</caption>
<thead><tr><th>Productgroep</th><th>Offertes</th><th>Akkoord</th><th>Conversie</th><th>Omzet</th><th>Gem. order</th><th>Marge %</th></tr></thead><tbody>`;
for (const [naam, d] of prodAlle) {
  if (d.off < 3) continue;
  const v = pc(d.akk, d.off);
  pt += `<tr><td>${naam === '(leeg)' ? 'Niet ingevuld' : naam}</td><td>${d.off.toLocaleString('nl-NL')}</td><td>${d.akk}</td>
<td class="${heatKlasse(v, 45)}">${f1(v)}%</td><td>${eur(d.omzet)}</td><td>${d.akk ? eur(d.omzet / d.akk) : '&mdash;'}</td>
<td>${d.omzet ? f0(pc(d.omzet - d.inkoop, d.omzet)) + '%' : '&mdash;'}</td></tr>`;
}
pt += `</tbody></table></div>`;
H.push(pt);

// matrix maand x product
let pm2 = `<div class="scroller"><table><caption>Conversie per maand per productgroep (groepen met 100+ offertes). Klein getal = aantal offertes.</caption>
<thead><tr><th>Maand</th>${prodNamen.map(p => `<th>${p}</th>`).join('')}</tr></thead><tbody>`;
for (let m = 1; m <= 12; m++) {
  pm2 += `<tr><td>${MND[m]}</td>`;
  for (const p of prodNamen) {
    const c = D.maandProduct[m + '|' + p];
    if (!c || !c.off) { pm2 += `<td class="leeg">&mdash;</td>`; continue; }
    pm2 += `<td class="${heatKlasse(pc(c.akk, c.off), 45)}">${f0(pc(c.akk, c.off))}%<span class="sub">${c.off}</span></td>`;
  }
  pm2 += `</tr>`;
}
pm2 += `<tr class="tot"><td>Jaar</td>${prodNamen.map(p => { const d = D.product[p];
  return `<td>${f1(pc(d.akk, d.off))}%<span class="sub">${d.off.toLocaleString('nl-NL')}</span></td>`; }).join('')}</tr></tbody></table></div>`;
H.push(pm2);
H.push(`<div class="ramp" style="margin-top:1rem"><span>0%</span><span class="cells">${[0, 1, 2, 3, 4, 5, 6].map(i => `<i style="background:var(--h${i})"></i>`).join('')}</span><span>45%+ conversie</span></div>`);

H.push(`<div class="cards">
<div class="card"><span class="eyebrow">Stoppen of repareren</span><h3>Pergola</h3>
<div class="big">${f1(pc(D.product.Pergola.akk, D.product.Pergola.off))}%</div>
<p>${D.product.Pergola.off.toLocaleString('nl-NL')} offertes, ${D.product.Pergola.akk} akkoord. Wel de hoogste gemiddelde order van allemaal (${eur(D.product.Pergola.omzet / D.product.Pergola.akk)}), dus de vraag is er &mdash; er sluit alleen bijna niets. Piek juni&ndash;september, precies in de drukste maanden.</p></div>
<div class="card"><span class="eyebrow">Stoppen of repareren</span><h3>Voorraadscherm</h3>
<div class="big">${f1(pc(D.product.Voorraadscherm.akk, D.product.Voorraadscherm.off))}%</div>
<p>${D.product.Voorraadscherm.off.toLocaleString('nl-NL')} offertes, ${D.product.Voorraadscherm.akk} akkoord. Bestaat alleen van juni tot december in de sheet, dus dit lijkt een actie die niet is aangeslagen.</p></div>
<div class="card"><span class="eyebrow">Onderbenut</span><h3>Raamdecoratie binnen</h3>
<div class="big">${f1(pc(D.product['Raamdecoratie binnen'].akk, D.product['Raamdecoratie binnen'].off))}%</div>
<p>Alleen ${D.product['Raamdecoratie binnen'].off} offertes, maar de beste conversie van elke serieuze groep en ${f0(pc(D.product['Raamdecoratie binnen'].omzet - D.product['Raamdecoratie binnen'].inkoop, D.product['Raamdecoratie binnen'].omzet))}% marge. Hier gaat te weinig verkeer naartoe.</p></div>
<div class="card"><span class="eyebrow">Onderbenut</span><h3>Reparatie</h3>
<div class="big">${f1(pc(D.product.Reparatie.akk, D.product.Reparatie.off))}%</div>
<p>Kleine orders (${eur(D.product.Reparatie.omzet / D.product.Reparatie.akk)} gemiddeld) maar ${f0(pc(D.product.Reparatie.omzet - D.product.Reparatie.inkoop, D.product.Reparatie.omzet))}% marge en hoge conversie. Reparatieklanten zijn ook de warmste ingang voor vervanging later.</p></div>
</div>`);
H.push(`</div></section>`);

// ---------- 4. showroom ----------
const win = D.kanaal.Winkel, onl = D.kanaal.Online;
H.push(`<section id="showroom"><div class="wrap">
<span class="eyebrow">04 &middot; Showroom</span>
<h2>De showroom is de grootste hefboom die je hebt, en hij staat bijna stil</h2>
<p class="intro">Offertes waar &ldquo;Winkel&rdquo; bij staat converteren op ${f1(pc(win.akk, win.off))}%. Online offertes op ${f1(pc(onl.akk, onl.off))}%. Dat geldt v&oacute;&oacute;r elke bron: ook Meta-leads &mdash; je slechtste kanaal online &mdash; springen naar ${f1(pc(kx['Winkel|Meta'].akk, kx['Winkel|Meta'].off))}% zodra ze in de winkel staan. En het raakt maar ${win.off} van ${tot.off.toLocaleString('nl-NL')} offertes (${f1(pc(win.off, tot.off))}%), terwijl het ${f0(pc(win.omzet, tot.omzet))}% van de omzet oplevert.</p>`);

const CH4 = 60 + hefboom.length * 46;
let s4 = `<svg viewBox="0 0 ${CW} ${CH4}" role="img" aria-label="Conversie online versus showroom per bron">`;
const bx = 150, bmax = CW - bx - 120;
for (let g = 0; g <= 4; g++) { const x = bx + bmax * g / 4;
  s4 += `<line class="gridline" x1="${x.toFixed(1)}" y1="26" x2="${x.toFixed(1)}" y2="${CH4 - 20}"/>`;
  s4 += `<text class="axis" x="${x.toFixed(1)}" y="${CH4 - 6}" text-anchor="middle">${g * 20}%</text>`; }
hefboom.forEach((h, i) => {
  const yb = 38 + i * 46;
  const co = pc(h.on.akk, h.on.off), cw = pc(h.win.akk, h.win.off);
  s4 += `<text class="axis" x="${bx - 10}" y="${(yb + 15)}" text-anchor="end" style="font-size:11.5px;fill:var(--ink)">${h.bron === 'Meta' ? 'Meta' : h.bron}</text>`;
  // online-balk
  s4 += `<rect x="${bx}" y="${yb}" width="${Math.max(bmax * co / 80, 2).toFixed(1)}" height="13" rx="4" fill="var(--s2)"/>`;
  s4 += `<rect class="hit" x="${bx}" y="${yb - 2}" width="${bmax}" height="15" data-tip="<b>${h.bron} &middot; online</b><br>${f1(co)}% conversie<br>${h.on.akk} van ${h.on.off.toLocaleString('nl-NL')}"/>`;
  s4 += `<text class="dlabel" x="${(bx + bmax * co / 80 + 7).toFixed(1)}" y="${yb + 11}" fill="var(--s2)">${f1(co)}%</text>`;
  // showroom-balk, 2px surface-gap onder de online-balk
  s4 += `<rect x="${bx}" y="${yb + 15}" width="${Math.max(bmax * cw / 80, 2).toFixed(1)}" height="13" rx="4" fill="var(--s1)"/>`;
  s4 += `<rect class="hit" x="${bx}" y="${yb + 15}" width="${bmax}" height="15" data-tip="<b>${h.bron} &middot; showroom</b><br>${f1(cw)}% conversie<br>${h.win.akk} van ${h.win.off}"/>`;
  s4 += `<text class="dlabel" x="${(bx + bmax * cw / 80 + 7).toFixed(1)}" y="${yb + 26}" fill="var(--s1)">${f1(cw)}% &middot; ${(cw / co).toFixed(1).replace('.', ',')}x</text>`;
});
s4 += `<text class="axlabel" x="${bx}" y="14">Conversie online tegenover showroom, per bron</text></svg>`;
H.push(`<figure><div class="chart">${s4}<div class="tip"></div></div>
<div class="legend"><div class="item"><span class="sw" style="background:var(--s2)"></span>Online</div>
<div class="item"><span class="sw" style="background:var(--s1)"></span>In de showroom geweest</div></div>
<figcaption>Elke bron converteert 2 tot 12 keer beter zodra de klant in de showroom is geweest.</figcaption></figure>`);

H.push(`<div class="note"><strong>Pas op met de conclusie.</strong> Dit is geen zuiver experiment. Klanten die naar Berkel en Rodenrijs rijden hebben zichzelf al geselecteerd op koopbereidheid, dus een deel van die ${f1(pc(win.akk, win.off))}% zit in de klant en niet in de showroom. De eerlijke lezing: de showroom is v&eacute;&eacute;l te klein om zo veel omzet te verklaren en het is het enige punt in je proces waar &aacute;lle bronnen goed converteren. Voordat je hier kapitaal in stopt, meet het: nodig een willekeurige helft van je Meta-leads actief uit voor de showroom en houd de andere helft als controlegroep. Dat is een paar weken werk en beslist over een investering van tienduizenden euro&rsquo;s.</div>`);
H.push(`</div></section>`);

// ---------- 5. advertentiegeld ----------
H.push(`<section id="geld"><div class="wrap">
<span class="eyebrow">05 &middot; Advertentiekosten</span>
<h2>Wat je advertentiegeld deed in maart, april en mei</h2>
<p class="intro">Alleen die drie maanden hebben ingevulde kosten in je tab &ldquo;conversie %&rdquo;. Het beeld is er niet minder duidelijk om: Meta&rsquo;s rendement halveerde terwijl het budget omhoog ging, Google bleef stabiel op ${spendRijen[5].roas.toFixed(1).replace('.',',')} tot ${spendRijen[1].roas.toFixed(1).replace('.',',')} keer de advertentiekosten terug in productmarge.</p>`);

let gt = `<div class="scroller"><table><caption>Advertentiekosten uit de tab &ldquo;conversie %&rdquo;, gecombineerd met de akkoorden en marges uit het offerteregister. Rendement = productmarge gedeeld door advertentiekosten, v&oacute;&oacute;r montage-uren en overhead.</caption>
<thead><tr><th>Maand</th><th>Kanaal</th><th>Offertes</th><th>Akkoord</th><th>Conversie</th><th>Advertentiekosten</th><th>Kosten per akkoord</th><th>Productmarge</th><th>Rendement</th></tr></thead><tbody>`;
for (const r of spendRijen) {
  gt += `<tr><td>${MND[r.m]}</td><td>${r.k}</td><td>${r.off}</td><td>${r.akk}</td><td>${f1(pc(r.akk, r.off))}%</td>
<td>${eur(r.spend)}</td><td class="${r.cpa > 350 ? 'neg' : 'pos'}">${eur(r.cpa)}</td><td>${eur(r.marge)}</td>
<td class="${r.roas < 3 ? 'neg' : 'pos'}">${r.roas.toFixed(1).replace('.', ',')}x</td></tr>`;
}
gt += `</tbody></table></div>`;
H.push(gt);

H.push(`<div class="cards">
<div class="card"><span class="eyebrow">Meta &middot; maart naar mei</span><h3>Budget omhoog, rendement omlaag</h3>
<div class="big neg">${spendRijen[0].roas.toFixed(1).replace('.',',')}x &rarr; ${spendRijen[4].roas.toFixed(1).replace('.',',')}x</div>
<p>Van ${eur(19800)} naar ${eur(23700)} per maand, terwijl de kosten per akkoord van ${eur(spendRijen[0].cpa)} naar ${eur(spendRijen[4].cpa)} stegen en de conversie van ${f1(pc(D.maandMeta['3|Meta'].akk, D.maandMeta['3|Meta'].off))}% naar ${f1(pc(D.maandMeta['5|Meta'].akk, D.maandMeta['5|Meta'].off))}% zakte. Je kocht meer van iets dat steeds minder opleverde.</p></div>
<div class="card"><span class="eyebrow">Google &middot; maart naar mei</span><h3>Budget bijna verdrievoudigd, rendement bleef</h3>
<div class="big pos">${spendRijen[1].roas.toFixed(1).replace('.',',')}x &rarr; ${spendRijen[5].roas.toFixed(1).replace('.',',')}x</div>
<p>Van ${eur(6300)} naar ${eur(17100)} per maand en de kosten per akkoord bleven tussen ${eur(spendRijen[3].cpa)} en ${eur(spendRijen[5].cpa)}. Dit kanaal was in die maanden nog niet verzadigd &mdash; er zat meer ruimte in dan je gebruikte.</p></div>
</div>`);
H.push(`<div class="note"><strong>Reken het na op je eigen cijfers.</strong> Gemiddelde productmarge per akkoord is ${eur(gemMarge)}. Meta kostte in mei ${eur(spendRijen[4].cpa)} per akkoord, Google ${eur(spendRijen[5].cpa)}. Beide zijn op papier winstgevend, maar uit die ${eur(gemMarge)} moeten nog montage-uren, inmeten, garantie en overhead komen. Bij Meta blijft daar veel minder van over dan bij Google, en het gat werd elke maand groter.</div>`);
H.push(`</div></section>`);

// ---------- 6. plan ----------
const naarGoogle = 10000;
const extraAkk = Math.round(naarGoogle / spendRijen[5].cpa);
const metaVerlies = Math.round(naarGoogle / spendRijen[4].cpa);
H.push(`<section id="plan"><div class="wrap">
<span class="eyebrow">06 &middot; Advies</span>
<h2>Wanneer je wat moet investeren</h2>
<p class="intro">De rode draad: je hoeft in 2026 niet m&eacute;&eacute;r leads te kopen. Je moet ze anders inkopen en beter verwerken. Alles hieronder is gerekend met de gemiddelde productmarge van ${eur(gemMarge)} per akkoord.</p>

<ol class="acties">
<li><span class="when">Nu &middot; voor februari</span><h3>Schuif advertentiebudget van Meta naar Google</h3>
<p>Google converteerde in elke maand van 2025 beter dan Meta en zat op ${eur(spendRijen[5].cpa)} per akkoord tegen ${eur(spendRijen[4].cpa)} bij Meta. Verplaats om te beginnen ${eur(naarGoogle)} per maand. Op de cijfers van mei kost dat ongeveer ${metaVerlies} Meta-akkoorden en levert het ongeveer ${extraAkk} Google-akkoorden op.</p>
<p class="bedrag">Netto ongeveer +${extraAkk - metaVerlies} akkoorden per maand &asymp; +${eur((extraAkk - metaVerlies) * gemMarge)} productmarge per maand</p></li>

<li><span class="when">November &ndash; februari</span><h3>Bouw verwerkingscapaciteit v&oacute;&oacute;rdat het seizoen begint</h3>
<p>Dit is de belangrijkste en de makkelijkst te missen. In januari kwamen er ${D.maand[1].off} offertes binnen en was de doorlooptijd naar akkoord 11 dagen. In juli waren dat ${D.maand[7].off.toLocaleString('nl-NL')} offertes en 27 dagen. Wie je in mei aanneemt is in juli nog aan het inwerken; wie je in januari aanneemt draait in april mee. Werf en train dus in het dal, niet in de piek.</p>
<p class="bedrag">De zomerdip terugbrengen naar het niveau van januari&ndash;mei is ${gemistAkk} akkoorden &asymp; ${eur(gemistEur)} productmarge</p></li>

<li><span class="when">Januari &ndash; maart</span><h3>Zet een echte doorverwijsactie op voor buren en bekenden</h3>
<p>${bureken.off} offertes uit deze hoek leverden ${bureken.akk} akkoorden en ${eur(bureken.omzet)} omzet op, tegen vrijwel geen advertentiekosten: ${f1(pc(bureken.akk, bureken.off))}% conversie. Het is je beste kanaal en tegelijk je kleinste. Je hebt de Zonradar-tool voor burenacties al staan; die verdient een vast budget en een vaste maandelijkse cadans in plaats van incidenteel gebruik.</p>
<p class="bedrag">Dit kanaal verdubbelen is ongeveer +${bureken.akk} akkoorden &asymp; +${eur(bureken.akk * gemMarge)} productmarge per jaar</p></li>

<li><span class="when">Februari &ndash; april</span><h3>Test de showroom-hefboom voordat je erin investeert</h3>
<p>Showroombezoekers converteren ${(pc(win.akk, win.off) / pc(onl.akk, onl.off)).toFixed(1).replace('.', ',')}x beter dan online, maar dat cijfer is vervuild door zelfselectie. Nodig daarom een willekeurige helft van je Meta-leads actief uit voor de showroom en houd de rest als controlegroep. Valt het verschil ook maar half zo groot uit, dan is een tweede locatie of een mobiele showroom de best onderbouwde investering die je in 2026 kunt doen.</p>
<p class="bedrag">Kosten van de test: een paar weken opvolgwerk. Wat het beslist: tienduizenden euro&rsquo;s</p></li>

<li><span class="when">Voor het pergolaseizoen</span><h3>Repareer pergola of stop met adverteren erop</h3>
<p>${D.product.Pergola.off.toLocaleString('nl-NL')} pergola-offertes leverden ${D.product.Pergola.akk} akkoorden op (${f1(pc(D.product.Pergola.akk, D.product.Pergola.off))}%), met voorraadscherm erbij ${(D.product.Pergola.off + D.product.Voorraadscherm.off).toLocaleString('nl-NL')} offertes voor ${D.product.Pergola.akk + D.product.Voorraadscherm.akk} akkoorden. Die offertes vielen precies in juni tot september: ze vraten de capaciteit op in de maanden waarin je conversie instortte. Zoek eerst uit waar het misgaat &mdash; prijs, levertijd of het verkoopgesprek &mdash; en zet tot die tijd geen budget meer op deze groep.</p>
<p class="bedrag">${(D.product.Pergola.off + D.product.Voorraadscherm.off).toLocaleString('nl-NL')} offertes = ${f0(pc(D.product.Pergola.off + D.product.Voorraadscherm.off, tot.off))}% van je capaciteit voor ${f1(pc(D.product.Pergola.akk + D.product.Voorraadscherm.akk, tot.akk))}% van je akkoorden</p></li>

<li><span class="when">Doorlopend</span><h3>Zet verkeer op raamdecoratie en reparatie</h3>
<p>Raamdecoratie binnen: ${D.product['Raamdecoratie binnen'].off} offertes, ${f1(pc(D.product['Raamdecoratie binnen'].akk, D.product['Raamdecoratie binnen'].off))}% conversie, ${f0(pc(D.product['Raamdecoratie binnen'].omzet - D.product['Raamdecoratie binnen'].inkoop, D.product['Raamdecoratie binnen'].omzet))}% marge. Reparatie: ${D.product.Reparatie.off} offertes, ${f1(pc(D.product.Reparatie.akk, D.product.Reparatie.off))}% conversie, ${f0(pc(D.product.Reparatie.omzet - D.product.Reparatie.inkoop, D.product.Reparatie.omzet))}% marge. Beide klein in volume en sterk in conversie, en beide binnenwerk &mdash; dus precies wat je in het winterdal kunt verkopen wanneer de buitenmonteurs stilliggen.</p>
<p class="bedrag">Binnenwerk vult november tot februari, waar je nu ${(D.maand[11].off + D.maand[12].off + D.maand[1].off + D.maand[2].off).toLocaleString('nl-NL')} offertes en je laagste omzet hebt</p></li>

<li><span class="when">Deze week</span><h3>Repareer de akkoordregistratie in de sheet</h3>
<p>De vinkjeskolom &ldquo;Akkoord&rdquo; staat op 313 voor heel 2025 terwijl het er ${tot.akk.toLocaleString('nl-NL')} zijn. Wie op die kolom stuurt ziet juni als een maand met nul verkoop. Haal de kolom weg of laat hem automatisch vullen zodra er een Gripp-nummer in de rij staat. Zolang hij er zo in staat, is elk dashboard erop fout.</p>
<p class="bedrag">Kost niets en voorkomt dat je op een factor 3,5 te lage conversie stuurt</p></li>
</ol>
</div></section>`);

// ---------- footer ----------
H.push(`<footer><div class="wrap">
<p><strong style="color:var(--ink)">Waar dit op gebaseerd is.</strong> Google Sheet &ldquo;Offerte formulier register 2024/2025/2026&rdquo;, de twaalf maandtabbladen van 2025, uitgelezen op 27 juli 2026. ${tot.off.toLocaleString('nl-NL')} offerterijen. De tabbladen &ldquo;2025 alles bij elkaar&rdquo; en &ldquo;Augustus 2025&rdquo; zijn overgeslagen: het eerste is een deelkopie van januari tot 18 maart en zou dubbeltellen, het tweede is leeg.</p>
<p><strong style="color:var(--ink)">Keuzes die de cijfers be&iuml;nvloeden.</strong> Een offerte geldt als akkoord wanneer het akkoord-blok gevuld is (Gripp-nummer, akkoorddatum of akkoordbedrag), niet op basis van de vinkjeskolom. De maand komt van het tabblad, omdat de datumcel regelmatig onvolledig is (&ldquo;08-01&rdquo;) of een verkeerd jaartal heeft; bij 5 van de ${tot.off.toLocaleString('nl-NL')} rijen weken tab en datumcel af. 62 rijen hadden een datum zonder jaar en zijn via het tabblad toegewezen. Facebook en Instagram zijn samengevoegd vanwege de labelwissel in augustus/september.</p>
<p><strong style="color:var(--ink)">Wat hier niet in zit.</strong> Marge is verkoop min inkoop uit de sheet zelf, dus productmarge v&oacute;&oacute;r montage-uren, inmeten, garantie en overhead &mdash; de echte winst per order is lager. Advertentiekosten zijn alleen bekend voor maart, april en mei; de rest van het jaar staat leeg in je tab &ldquo;conversie %&rdquo;. 3 van de ${tot.akk.toLocaleString('nl-NL')} akkoorden missen een inkoopprijs (${eur(6995)} omzet). 35 rijen hebben een vinkje maar geen akkoord-blok en tellen hier niet mee. Bij 35 telefoonnummer-en-bedrag-combinaties komt dezelfde regel twee keer voor; dat is 0,4% en is niet ontdubbeld.</p>
</div></footer>`);

// ---------- tooltip-gedrag ----------
H.push(`<script>
document.querySelectorAll('.chart').forEach(function(chart){
  var tip = chart.querySelector('.tip');
  if(!tip) return;
  chart.querySelectorAll('.hit').forEach(function(hit){
    function toon(e){
      tip.innerHTML = hit.getAttribute('data-tip');
      tip.style.opacity = '1';
      var cb = chart.getBoundingClientRect();
      var hb = hit.getBoundingClientRect();
      var x = hb.left + hb.width/2 - cb.left;
      var y = hb.top - cb.top;
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

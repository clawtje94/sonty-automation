#!/usr/bin/env node
// Bouwt het adverteerplan aug 2026 - feb 2027 uit data/seizoensplan.json.
const fs = require('fs');
const path = require('path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'seizoensplan.json'), 'utf8'));

const MND = { 8:'aug', 9:'sep', 10:'okt', 11:'nov', 12:'dec', 1:'jan', 2:'feb' };
const VOL = { 8:'Augustus', 9:'September', 10:'Oktober', 11:'November', 12:'December', 1:'Januari', 2:'Februari' };
const M = [8,9,10,11,12,1,2];
const eur = n => '€' + Math.round(n).toLocaleString('nl-NL');
const pc = (a,b) => b ? a/b*100 : 0;
const f1 = n => n.toFixed(1).replace('.', ',');
const f0 = n => Math.round(n).toString();

// Cellen onder dit aantal offertes zijn ruis en krijgen geen kleur/waarde.
const MIN_N = 30;
const heat = (v, max) => 'h' + Math.min(6, Math.max(0, Math.round(v / max * 6)));

const prodVolgorde = Object.entries(D.producten).sort((a,b) => b[1].totaal.mpo - a[1].totaal.mpo);
const kanVolgorde = ['Buren/bekenden', 'Anders', 'Google', 'Meta'];
const slecht = D.combos.filter(c => c.mpo < 140);
const goed = D.combos.filter(c => c.mpo >= 230);
const somOff = a => a.reduce((x,c) => x+c.off, 0);
const somMarge = a => a.reduce((x,c) => x+c.marge, 0);

const H = [];
H.push(`<title>Sonty adverteerplan augustus 2026 – februari 2027</title>`);
H.push(`<style>
:root{
  --surface:#FAF8F5;--surface-2:#FFFFFF;--surface-3:#F2EEE8;
  --ink:#1C1815;--ink-2:#554D45;--ink-3:#8A8078;
  --rule:#E4DDD3;--rule-strong:#CFC5B8;
  --accent:#D95F02;--accent-soft:#FBEADC;
  --s1:#D95F02;--s2:#1F6FEB;--s3:#0E8A6A;--s4:#7C3AED;
  --goed:#1F7A4C;--slecht:#A8321F;
  --h0:#FBF3EA;--h1:#F7E2CB;--h2:#F1C79E;--h3:#E7A76B;--h4:#D9853B;--h5:#BC6716;--h6:#944C09;
  --h0i:#6B6259;--h1i:#4A3B28;--h2i:#3A2C1A;--h3i:#2E2112;--h4i:#FFF6EC;--h5i:#FFF6EC;--h6i:#FFF6EC;
  --grid:#EAE3D9;
}
@media (prefers-color-scheme:dark){:root{
  --surface:#14110E;--surface-2:#1D1916;--surface-3:#241F1A;
  --ink:#F5F0EA;--ink-2:#B5ABA1;--ink-3:#7E756C;
  --rule:#302A24;--rule-strong:#463D34;
  --accent:#FF8438;--accent-soft:#2A1C11;
  --s1:#DB7020;--s2:#4C8DFF;--s3:#2AA888;--s4:#A078F5;
  --goed:#3FBF7F;--slecht:#F0705A;
  --h0:#1B1712;--h1:#2C2318;--h2:#42311C;--h3:#5B4220;--h4:#7A5626;--h5:#9C6C2C;--h6:#C08536;
  --h0i:#7E756C;--h1i:#C0A98C;--h2i:#E5CDA9;--h3i:#F6E3C6;--h4i:#FFF3E2;--h5i:#FFF6EC;--h6i:#1B1712;
  --grid:#2A241E;
}}
:root[data-theme="dark"]{
  --surface:#14110E;--surface-2:#1D1916;--surface-3:#241F1A;
  --ink:#F5F0EA;--ink-2:#B5ABA1;--ink-3:#7E756C;
  --rule:#302A24;--rule-strong:#463D34;
  --accent:#FF8438;--accent-soft:#2A1C11;
  --s1:#DB7020;--s2:#4C8DFF;--s3:#2AA888;--s4:#A078F5;
  --goed:#3FBF7F;--slecht:#F0705A;
  --h0:#1B1712;--h1:#2C2318;--h2:#42311C;--h3:#5B4220;--h4:#7A5626;--h5:#9C6C2C;--h6:#C08536;
  --h0i:#7E756C;--h1i:#C0A98C;--h2i:#E5CDA9;--h3i:#F6E3C6;--h4i:#FFF3E2;--h5i:#FFF6EC;--h6i:#1B1712;
  --grid:#2A241E;
}
:root[data-theme="light"]{
  --surface:#FAF8F5;--surface-2:#FFFFFF;--surface-3:#F2EEE8;
  --ink:#1C1815;--ink-2:#554D45;--ink-3:#8A8078;
  --rule:#E4DDD3;--rule-strong:#CFC5B8;
  --accent:#D95F02;--accent-soft:#FBEADC;
  --s1:#D95F02;--s2:#1F6FEB;--s3:#0E8A6A;--s4:#7C3AED;
  --goed:#1F7A4C;--slecht:#A8321F;
  --h0:#FBF3EA;--h1:#F7E2CB;--h2:#F1C79E;--h3:#E7A76B;--h4:#D9853B;--h5:#BC6716;--h6:#944C09;
  --h0i:#6B6259;--h1i:#4A3B28;--h2i:#3A2C1A;--h3i:#2E2112;--h4i:#FFF6EC;--h5i:#FFF6EC;--h6i:#FFF6EC;
  --grid:#EAE3D9;
}
*{box-sizing:border-box}
body{margin:0;background:var(--surface);color:var(--ink);
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:16px;line-height:1.6;
  -webkit-font-smoothing:antialiased;}
h1,h2,h3{letter-spacing:-.022em;text-wrap:balance;margin:0;font-weight:750;line-height:1.14;}
h1{font-size:clamp(2rem,5vw,3.2rem);}
h2{font-size:clamp(1.4rem,3vw,1.95rem);}
h3{font-size:1.06rem;letter-spacing:-.01em;}
p{margin:0;}
em{font-style:italic}
.wrap{max-width:1180px;margin:0 auto;padding:0 clamp(1rem,4vw,2.75rem);}
.eyebrow{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:.688rem;
  letter-spacing:.15em;text-transform:uppercase;color:var(--ink-3);}
header.top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--surface) 88%,transparent);
  backdrop-filter:blur(12px);border-bottom:1px solid var(--rule);}
header.top .wrap{display:flex;align-items:center;gap:1.5rem;height:52px;}
.brandmark{display:flex;align-items:center;gap:.55rem;font-weight:750;letter-spacing:-.02em;flex-shrink:0;}
.brandmark i{width:9px;height:9px;border-radius:2px;background:var(--accent);display:block;}
nav.jump{display:flex;gap:1.15rem;overflow-x:auto;margin-left:auto;}
nav.jump a{color:var(--ink-2);text-decoration:none;font-size:.8rem;white-space:nowrap;padding:.2rem 0;
  border-bottom:1.5px solid transparent;}
nav.jump a:hover,nav.jump a:focus-visible{color:var(--ink);border-bottom-color:var(--accent);}
@media(max-width:820px){nav.jump{display:none}}
.hero{padding:clamp(2.75rem,7vw,5rem) 0 clamp(1.75rem,4vw,2.5rem);}
.hero h1{margin:.7rem 0 0;max-width:24ch;}
.lede{margin-top:1.15rem;max-width:62ch;font-size:1.075rem;color:var(--ink-2);}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1px;
  background:var(--rule);border:1px solid var(--rule);margin-top:clamp(1.75rem,4vw,2.5rem);}
.kpi{background:var(--surface-2);padding:1.15rem;}
.kpi .v{font-size:clamp(1.5rem,3.4vw,2rem);font-weight:750;letter-spacing:-.03em;
  font-variant-numeric:tabular-nums;line-height:1.05;margin-top:.4rem;}
.kpi .n{font-size:.78rem;color:var(--ink-3);margin-top:.35rem;line-height:1.4;}
.kpi .v.neg{color:var(--slecht)}.kpi .v.pos{color:var(--goed)}
section{padding:clamp(2.5rem,6vw,4.25rem) 0;border-top:1px solid var(--rule);}
section > .wrap > .eyebrow{display:block;margin-bottom:.6rem;}
section h2 + p.intro{margin-top:1rem;max-width:66ch;color:var(--ink-2);}
.note{border-left:2.5px solid var(--accent);background:var(--accent-soft);padding:1.05rem 1.25rem;
  margin-top:1.6rem;font-size:.925rem;}
.note strong{color:var(--ink)}
.note+.note{margin-top:.75rem}
.scroller{overflow-x:auto;margin-top:1.75rem;border:1px solid var(--rule);background:var(--surface-2);}
table{border-collapse:collapse;width:100%;font-size:.85rem;}
caption{text-align:left;padding:.85rem 1rem;font-size:.8rem;color:var(--ink-3);border-bottom:1px solid var(--rule);}
th,td{padding:.5rem .7rem;text-align:right;border-bottom:1px solid var(--rule);white-space:nowrap;
  font-variant-numeric:tabular-nums;}
th{font-size:.72rem;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-3);font-weight:600;
  background:var(--surface-3);position:sticky;top:0;}
th:first-child,td:first-child{text-align:left;font-variant-numeric:normal;}
tbody tr:hover td{background:var(--surface-3)}
tr.tot td{font-weight:700;border-top:2px solid var(--rule-strong);background:var(--surface-3);}
td.h0{background:var(--h0);color:var(--h0i)}td.h1{background:var(--h1);color:var(--h1i)}
td.h2{background:var(--h2);color:var(--h2i)}td.h3{background:var(--h3);color:var(--h3i)}
td.h4{background:var(--h4);color:var(--h4i)}td.h5{background:var(--h5);color:var(--h5i)}
td.h6{background:var(--h6);color:var(--h6i)}
td.dun{color:var(--ink-3);font-size:.78rem;font-style:italic}
td .sub{font-size:.75rem;opacity:.65;margin-left:.3rem}
.pos{color:var(--goed);font-weight:600}.neg{color:var(--slecht);font-weight:600}
.ramp{display:flex;align-items:center;gap:.45rem;font-size:.75rem;color:var(--ink-3);margin-top:1rem;flex-wrap:wrap}
.ramp .cells{display:flex}.ramp .cells i{width:19px;height:11px;display:block}
figure{margin:1.75rem 0 0}
figcaption{font-size:.8rem;color:var(--ink-3);margin-top:.7rem;max-width:62ch}
.chart{position:relative;background:var(--surface-2);border:1px solid var(--rule);padding:1.1rem .9rem .6rem}
svg{display:block;width:100%;height:auto;overflow:visible}
.gridline{stroke:var(--grid);stroke-width:1}
.axis{fill:var(--ink-3);font-size:10.5px;font-family:ui-monospace,Menlo,monospace}
.axlabel{fill:var(--ink-3);font-size:10px;letter-spacing:.08em;text-transform:uppercase}
.dlabel{font-size:10.5px;font-weight:700;font-variant-numeric:tabular-nums}
.hit{fill:transparent;cursor:pointer}
.tip{position:absolute;pointer-events:none;opacity:0;transition:opacity .1s;background:var(--ink);
  color:var(--surface);padding:.5rem .65rem;font-size:.75rem;border-radius:4px;white-space:nowrap;z-index:5;
  line-height:1.45;font-variant-numeric:tabular-nums}
.legend{display:flex;flex-wrap:wrap;gap:1rem;align-items:center;margin-top:1rem;font-size:.8rem;color:var(--ink-2)}
.legend .item{display:flex;align-items:center;gap:.4rem}
.legend .sw{width:11px;height:11px;border-radius:2px;flex-shrink:0}
ol.kalender{list-style:none;padding:0;margin:1.75rem 0 0;display:grid;gap:1px;background:var(--rule);
  border:1px solid var(--rule);}
ol.kalender li{background:var(--surface-2);padding:1.4rem 1.5rem;display:grid;
  grid-template-columns:118px 1fr;gap:0 1.4rem;align-items:start;}
ol.kalender .mnd{font-family:ui-monospace,Menlo,monospace;font-size:.72rem;letter-spacing:.1em;
  text-transform:uppercase;color:var(--accent);padding-top:.3rem;}
ol.kalender .mnd b{display:block;font-size:1.05rem;letter-spacing:-.01em;text-transform:none;
  color:var(--ink);font-family:system-ui,sans-serif;margin-bottom:.15rem}
ol.kalender h3{grid-column:2}
ol.kalender .doen{grid-column:2;margin-top:.7rem;display:grid;gap:.45rem}
ol.kalender .doen div{font-size:.9rem;color:var(--ink-2);padding-left:1.1rem;position:relative}
ol.kalender .doen div::before{content:"";position:absolute;left:0;top:.6em;width:5px;height:5px;
  border-radius:1px;background:var(--accent)}
ol.kalender .doen div.stop::before{background:var(--slecht)}
ol.kalender .cijfer{grid-column:2;margin-top:.8rem;font-family:ui-monospace,Menlo,monospace;
  font-size:.78rem;color:var(--ink-3)}
@media(max-width:620px){ol.kalender li{grid-template-columns:1fr}
  ol.kalender h3,ol.kalender .doen,ol.kalender .cijfer{grid-column:1}
  ol.kalender .mnd{padding-bottom:.6rem}}
footer{border-top:1px solid var(--rule);padding:2.25rem 0 3.25rem;color:var(--ink-3);font-size:.83rem}
footer p{max-width:70ch}footer p+p{margin-top:.65rem}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>`);

H.push(`<header class="top"><div class="wrap">
<span class="brandmark"><i></i>Sonty&nbsp;data</span>
<nav class="jump"><a href="#principe">Het principe</a><a href="#kanaal">Per kanaal</a>
<a href="#product">Per product</a><a href="#combi">Beste combinaties</a><a href="#kalender">Maandplan</a></nav>
</div></header>`);

const totMarge = Object.values(D.maanden).reduce((a,m) => a + (m.omzet - m.inkoop), 0);
H.push(`<div class="wrap hero">
<span class="eyebrow">Adverteerplan augustus 2026 &ndash; februari 2027 &middot; op ${D.totaalOffertes.toLocaleString('nl-NL')} offertes uit twee seizoenen</span>
<h1>Je hebt geen budgetprobleem. Je hebt een verdeelprobleem.</h1>
<p class="lede">Je offertecapaciteit is de schaarse hulpbron, niet je advertentiegeld: het team sluit maximaal ongeveer 35 orders per week. De vraag is dus niet waar je de meeste leads krijgt, maar <em>welke</em> offertes die capaciteit mogen vullen. Daarom staat hier alles gerangschikt op marge per uitgestuurde offerte &mdash; en niet op conversie of op omzet.</p>
<div class="kpis">
<div class="kpi"><span class="eyebrow">Slechtste helft</span><div class="v neg">${f1(somOff(slecht)/D.totaalOffertes*100)}%</div><div class="n">van je capaciteit gaat naar combinaties onder €140 marge per offerte</div></div>
<div class="kpi"><span class="eyebrow">Levert op</span><div class="v">${eur(somMarge(slecht))}</div><div class="n">${f0(somMarge(slecht)/totMarge*100)}% van de marge</div></div>
<div class="kpi"><span class="eyebrow">Beste derde</span><div class="v pos">${f1(somOff(goed)/D.totaalOffertes*100)}%</div><div class="n">van je capaciteit gaat naar combinaties boven €230 marge per offerte</div></div>
<div class="kpi"><span class="eyebrow">Levert op</span><div class="v">${eur(somMarge(goed))}</div><div class="n">${f0(somMarge(goed)/totMarge*100)}% van de marge</div></div>
</div></div>`);

// ---------- principe ----------
const metaRol = D.combos.find(c => c.kanaal==='Meta' && c.product==='Rolluiken');
const metaPerg = D.combos.find(c => c.kanaal==='Meta' && c.product==='Pergola');
const googKnik = D.combos.find(c => c.kanaal==='Google' && c.product==='Knikarmscherm');
H.push(`<section id="principe"><div class="wrap">
<span class="eyebrow">Het principe</span>
<h2>Reken per offerte, niet per order</h2>
<p class="intro">Een pergola-order levert ${eur(metaPerg.margePerOrder)} marge op en een rolluik-order maar ${eur(metaRol.margePerOrder)}. Toch is pergola je slechtste besteding: er sluit maar ${f1(metaPerg.conv)}% van, dus je hebt er ${Math.round(100/metaPerg.conv)} offertes voor nodig. Per uitgestuurde offerte houd je ${eur(metaPerg.mpo)} over. Zolang je offertecapaciteit vol zit, is dat het enige getal dat telt.</p>
<div class="note"><strong>Wat een verschuiving oplevert, concreet.</strong> Meta&ndash;Pergola kostte in dit venster ${metaPerg.off.toLocaleString('nl-NL')} offertes (${f1(metaPerg.aandeel)}% van je capaciteit) voor ${eur(metaPerg.marge)} marge. Diezelfde ${metaPerg.off.toLocaleString('nl-NL')} offertes op Google&ndash;Knikarmscherm (${eur(googKnik.mpo)} per offerte) hadden ${eur(metaPerg.off * googKnik.mpo)} opgeleverd. Dat is ${eur(metaPerg.off * googKnik.mpo - metaPerg.marge)} extra, zonder &eacute;&eacute;n order meer te hoeven verwerken en zonder een euro extra advertentiebudget.</div>
</div></section>`);

// ---------- kanaal ----------
H.push(`<section id="kanaal"><div class="wrap">
<span class="eyebrow">01 &middot; Per kanaal</span>
<h2>Google verslaat Meta in elke maand van het najaar</h2>
<p class="intro">Niet met een klein verschil: Google levert ${f1(D.kanalen.Google.totaal.mpo / D.kanalen.Meta.totaal.mpo)}x zoveel marge per offerte als Meta, en dat geldt in alle zeven maanden. Buren en bekenden zitten daar nog eens ver boven, maar dat kanaal is klein (${D.kanalen['Buren/bekenden'].totaal.off} offertes, ${f1(D.kanalen['Buren/bekenden'].totaal.off / D.totaalOffertes * 100)}% van je capaciteit).</p>`);

const CW=1000, CH=210, PADL=52, PADR=92;
const bw=(CW-PADL-PADR)/M.length;
const px=i=>PADL+i*bw+bw/2;
const maxY=900;
const py=v=>24+(CH-48)*(1-v/maxY);
let sv=`<svg viewBox="0 0 ${CW} ${CH}" role="img" aria-label="Marge per offerte per kanaal per maand">`;
for(let g=0;g<=3;g++){const y=24+(CH-48)*g/3;
 sv+=`<line class="gridline" x1="${PADL}" y1="${y.toFixed(1)}" x2="${CW-PADR}" y2="${y.toFixed(1)}"/>`;
 sv+=`<text class="axis" x="${PADL-8}" y="${(y+3.5).toFixed(1)}" text-anchor="end">€${maxY-300*g}</text>`;}
const kleur={'Buren/bekenden':'var(--s3)','Anders':'var(--s4)','Google':'var(--s2)','Meta':'var(--s1)'};
for(const k of kanVolgorde){
  const serie=M.map(m=>D.kanalen[k].perMaand[m]);
  const pts=serie.map((d,i)=>`${px(i).toFixed(1)},${py(d.mpo).toFixed(1)}`).join(' ');
  sv+=`<polyline points="${pts}" fill="none" stroke="${kleur[k]}" stroke-width="2" stroke-linejoin="round"/>`;
  serie.forEach((d,i)=>{
    sv+=`<circle cx="${px(i).toFixed(1)}" cy="${py(d.mpo).toFixed(1)}" r="4" fill="${kleur[k]}" stroke="var(--surface-2)" stroke-width="2"/>`;
    sv+=`<rect class="hit" x="${(px(i)-bw/2).toFixed(1)}" y="${(py(d.mpo)-13).toFixed(1)}" width="${bw.toFixed(1)}" height="26" data-tip="<b>${k} &middot; ${VOL[M[i]]}</b><br>${eur(d.mpo)} marge per offerte<br>${d.off} offertes, ${d.akk} orders"/>`;});
  sv+=`<text class="dlabel" x="${(px(M.length-1)+9).toFixed(1)}" y="${(py(serie[serie.length-1].mpo)+3.5).toFixed(1)}" fill="${kleur[k]}">${k==='Buren/bekenden'?'Buren':k}</text>`;
}
for(let i=0;i<M.length;i++) sv+=`<text class="axis" x="${px(i).toFixed(1)}" y="${CH-8}" text-anchor="middle">${MND[M[i]]}</text>`;
sv+=`<text class="axlabel" x="${PADL}" y="12">Marge per uitgestuurde offerte</text></svg>`;
H.push(`<figure><div class="chart">${sv}<div class="tip"></div></div>
<div class="legend">${kanVolgorde.map(k=>`<div class="item"><span class="sw" style="background:${kleur[k]}"></span>${k}</div>`).join('')}</div>
<figcaption>Aug t/m dec uit 2024 en 2025 samen, jan en feb uit 2025 en 2026. Meta ligt in elke maand onderaan.</figcaption></figure>`);

let kt=`<div class="scroller"><table><caption>Marge per uitgestuurde offerte per kanaal per maand. Het kleine getal is het aantal offertes.</caption>
<thead><tr><th>Kanaal</th>${M.map(m=>`<th>${MND[m]}</th>`).join('')}<th>Aug&ndash;feb</th><th>Conversie</th></tr></thead><tbody>`;
for(const k of kanVolgorde){const t=D.kanalen[k].totaal;
  kt+=`<tr><td>${k}</td>`;
  for(const m of M){const d=D.kanalen[k].perMaand[m];
    kt+= d.off<MIN_N ? `<td class="dun">${eur(d.mpo)}<span class="sub">${d.off}</span></td>`
      : `<td class="${heat(d.mpo,900)}">${eur(d.mpo)}<span class="sub">${d.off}</span></td>`;}
  kt+=`<td><strong>${eur(t.mpo)}</strong></td><td>${f1(pc(t.akk,t.off))}%</td></tr>`;}
kt+=`</tbody></table></div>`;
H.push(kt);
H.push(`<div class="ramp"><span>€0</span><span class="cells">${[0,1,2,3,4,5,6].map(i=>`<i style="background:var(--h${i})"></i>`).join('')}</span><span>€900+ marge per offerte</span><span style="margin-left:1rem;font-style:italic">cursief = onder ${MIN_N} offertes, te weinig om op te sturen</span></div>`);
H.push(`<div class="note"><strong>Waarom &ldquo;alles naar Google&rdquo; toch te simpel is.</strong> Meta is ook je gr&oacute;&oacute;tste kanaal, en je hebt in 2026 gezien dat conversie zakt zodra het volume stijgt &mdash; ook bij Google, dat van 19,8% naar 8,2% ging toen je het volume verdrievoudigde. Een deel van Meta&rsquo;s slechte cijfer komt dus doordat Meta het volumekanaal is. De juiste conclusie is niet &ldquo;zet alles op Google&rdquo; maar: verlaag eerst het totale volume, en snijd daarbij in de slechtste combinaties. Die zitten toevallig vrijwel allemaal bij Meta.</div>`);
H.push(`</div></section>`);

// ---------- product ----------
H.push(`<section id="product"><div class="wrap">
<span class="eyebrow">02 &middot; Per productgroep</span>
<h2>Wat wanneer verkoopt, en wat het per offerte oplevert</h2>
<p class="intro">Twee dingen tegelijk: hoeveel een offerte in die groep gemiddeld oplevert, en in welke maanden de vraag er &uuml;berhaupt is. Zonwering buiten is een augustusproduct dat in november dood is; raamdecoratie en reparatie zijn juist winterwerk. Rolluiken zijn je enige groep met volume in elke maand.</p>`);

let pt=`<div class="scroller"><table><caption>Marge per uitgestuurde offerte per productgroep per maand. Klein getal = aantal offertes in dat vak.</caption>
<thead><tr><th>Productgroep</th>${M.map(m=>`<th>${MND[m]}</th>`).join('')}<th>Aug&ndash;feb</th><th>Conversie</th></tr></thead><tbody>`;
for(const [p,d] of prodVolgorde){
  pt+=`<tr><td>${p}</td>`;
  for(const m of M){const c=d.perMaand[m];
    pt+= c.off<MIN_N ? `<td class="dun">${c.off?eur(c.mpo):'&mdash;'}<span class="sub">${c.off}</span></td>`
      : `<td class="${heat(c.mpo,700)}">${eur(c.mpo)}<span class="sub">${c.off}</span></td>`;}
  pt+=`<td><strong>${eur(d.totaal.mpo)}</strong></td><td>${f1(pc(d.totaal.akk,d.totaal.off))}%</td></tr>`;}
pt+=`</tbody></table></div>`;
H.push(pt);
H.push(`<div class="ramp"><span>€0</span><span class="cells">${[0,1,2,3,4,5,6].map(i=>`<i style="background:var(--h${i})"></i>`).join('')}</span><span>€700+ marge per offerte</span><span style="margin-left:1rem;font-style:italic">cursief = onder ${MIN_N} offertes</span></div>`);
H.push(`</div></section>`);

// ---------- combinaties ----------
H.push(`<section id="combi"><div class="wrap">
<span class="eyebrow">03 &middot; Kanaal maal product</span>
<h2>De ranglijst waar je op moet sturen</h2>
<p class="intro">Alle combinaties met minstens 25 offertes in dit venster, gerangschikt op wat &eacute;&eacute;n offerte oplevert. De kolom &ldquo;% capaciteit&rdquo; laat zien hoeveel van je offertewerk er nu heen gaat &mdash; en daar zit de scheefheid.</p>`);
let ct=`<div class="scroller"><table><caption>Aug t/m feb, twee seizoenen samen. Gerangschikt op marge per uitgestuurde offerte.</caption>
<thead><tr><th>Kanaal &ndash; product</th><th>Offertes</th><th>% capaciteit</th><th>Conversie</th><th>Marge per order</th><th>Marge per offerte</th><th>Totale marge</th></tr></thead><tbody>`;
const maxMpo = Math.max(...D.combos.map(c=>c.mpo));
for(const c of D.combos)
  ct+=`<tr><td>${c.kanaal} &ndash; ${c.product}</td><td>${c.off.toLocaleString('nl-NL')}</td><td>${f1(c.aandeel)}%</td>
<td>${f1(c.conv)}%</td><td>${eur(c.margePerOrder)}</td><td class="${heat(c.mpo,maxMpo)}"><strong>${eur(c.mpo)}</strong></td><td>${eur(c.marge)}</td></tr>`;
ct+=`</tbody></table></div>`;
H.push(ct);
H.push(`<div class="note"><strong>De twee posten die je meteen kunt aanpakken.</strong> Meta&ndash;Rolluiken is ${f1(metaRol.aandeel)}% van je hele offertecapaciteit tegen ${eur(metaRol.mpo)} per offerte, en Meta&ndash;Pergola nog eens ${f1(metaPerg.aandeel)}% tegen ${eur(metaPerg.mpo)}. Samen ${f1(metaRol.aandeel+metaPerg.aandeel)}% van je capaciteit. Dezelfde rolluiken via Google leveren ${eur(D.combos.find(c=>c.kanaal==='Google'&&c.product==='Rolluiken').mpo)} per offerte op &mdash; bijna het dubbele.</div>`);
H.push(`</div></section>`);

// ---------- kalender ----------
const P = (p, m) => D.producten[p] ? D.producten[p].perMaand[m] : { off:0, mpo:0 };
const kalender = [
  { m: 8, titel: 'Laatste maand voor alles wat buiten hangt',
    doen: [
      ['stop', `Zet pergola en voorraadscherm nu uit. Dat is in augustus alleen al ${P('Pergola',8).off + P('Voorraadscherm',8).off} offertes tegen ${eur(P('Pergola',8).mpo)} en ${eur(P('Voorraadscherm',8).mpo)} per stuk.`],
      ['', `Zonwering buiten maximaal, maar alleen deze maand en september: ${f0(P('Zonwering buiten',8).off / D.producten['Zonwering buiten'].totaal.off * 100)}% van de hele najaarsvraag valt in augustus en in november is het voorbij.`],
      ['', `Knikarmscherm via Google (${eur(googKnik.mpo)} per offerte). Augustus is de tweede piek van het jaar voor die groep.`],
      ['', 'Schuif het budget dat vrijkomt niet door naar meer volume, maar laat het staan. Je zit nu op 177% van je verwerkingscapaciteit.'],
    ],
    cijfer: `augustus levert ${eur(D.maanden[8].mpo)} marge per offerte &middot; ${D.maanden[8].off.toLocaleString('nl-NL')} offertes in de twee gemeten seizoenen` },
  { m: 9, titel: 'Overgangsmaand: buiten uitfaseren, binnen opbouwen',
    doen: [
      ['', `Zonwering buiten loopt door (${P('Zonwering buiten',9).off} offertes) maar zakt naar ${eur(P('Zonwering buiten',9).mpo)} per offerte. Bouw het af richting oktober.`],
      ['', `Rolluiken worden vanaf nu je motor: ${eur(P('Rolluiken',9).mpo)} per offerte in september, het hoogste rolluikcijfer van het hele venster.`],
      ['', 'Begin met opbouwen op raamdecoratie binnen. Kleine aantallen tot nu toe, maar het is je beste groep per offerte en het loopt door tot in februari.'],
    ],
    cijfer: `september ${eur(D.maanden[9].mpo)} marge per offerte` },
  { m: 10, titel: 'Kantelpunt naar binnenwerk',
    doen: [
      ['stop', 'Zonwering buiten uit. De vraag valt weg en wat er nog komt is te dun om op te sturen.'],
      ['', `Rolluiken en screens vasthouden (screens ${eur(P('Screens',10).mpo)} per offerte in oktober).`],
      ['', 'Reparatie aanzetten. Kleine orders, maar de hoogste conversie die je hebt en het is werk dat je monteurs in het dal kunnen doen.'],
    ],
    cijfer: `oktober ${eur(D.maanden[10].mpo)} marge per offerte` },
  { m: 11, titel: 'De beste maand van het najaar, en je adverteert er het minst',
    doen: [
      ['', `November is met ${eur(D.maanden[11].mpo)} per offerte de sterkste maand van het hele venster, en Google doet er ${eur(D.kanalen.Google.perMaand[11].mpo)} per offerte.`],
      ['', `Rolluiken op vol vermogen (${eur(P('Rolluiken',11).mpo)} per offerte) en knikarmscherm meenemen (${eur(P('Knikarmscherm',11).mpo)}).`],
      ['', 'Dit is ook het moment om te werven en in te werken voor het voorjaar. Wie je nu aanneemt draait in maart mee.'],
    ],
    cijfer: `november ${eur(D.maanden[11].mpo)} marge per offerte &middot; hoogste van aug t/m feb` },
  { m: 12, titel: 'Terugschakelen, niet doorduwen',
    doen: [
      ['', `December is de zwakste maand: ${eur(D.maanden[12].mpo)} per offerte, ${f1(pc(D.maanden[12].akk,D.maanden[12].off))}% conversie. Zet het budget bewust lager.`],
      ['', `Alleen rolluiken en screens aanhouden; screens doen het in december verrassend goed (${eur(P('Screens',12).mpo)} per offerte).`],
      ['stop', 'Geen pergola, geen voorraadscherm, geen zonwering buiten. Die staan in december allemaal op vrijwel nul vraag.'],
    ],
    cijfer: `december ${eur(D.maanden[12].mpo)} marge per offerte &middot; laagste van het venster` },
  { m: 1, titel: 'Opbouwen, met binnenwerk voorop',
    doen: [
      ['', `Rolluiken lopen hard aan (${P('Rolluiken',1).off} offertes in de gemeten seizoenen) en raamdecoratie binnen doet ${eur(P('Raamdecoratie binnen',1).mpo)} per offerte.`],
      ['', `Reparatie piekt in januari en februari. Hoogste conversie van al je groepen (${f1(pc(D.producten.Reparatie.totaal.akk,D.producten.Reparatie.totaal.off))}%).`],
      ['', 'Knikarmscherm langzaam aanzetten voor het voorjaar; de doorlooptijd naar akkoord is ongeveer 24 dagen, dus wat je in januari uitstuurt sluit in februari.'],
    ],
    cijfer: `januari ${eur(D.maanden[1].mpo)} marge per offerte` },
  { m: 2, titel: 'Het voorjaar begint hier, niet in april',
    doen: [
      ['', `Knikarmscherm is in februari ${eur(P('Knikarmscherm',2).mpo)} per offerte, het hoogste van alle grote groepen in die maand.`],
      ['', `Raamdecoratie binnen en reparatie draaien door (${eur(P('Raamdecoratie binnen',2).mpo)} respectievelijk ${eur(P('Reparatie',2).mpo)} per offerte).`],
      ['', 'Pas op met opschalen. Februari 2026 was met 795 offertes al 184 per week; in maart en april liep je daarna vast op 346 en 368 per week.'],
    ],
    cijfer: `februari ${eur(D.maanden[2].mpo)} marge per offerte` },
];
H.push(`<section id="kalender"><div class="wrap">
<span class="eyebrow">04 &middot; Maandplan</span>
<h2>Augustus tot februari, maand voor maand</h2>
<p class="intro">Alles hieronder gaat uit van een gelijkblijvend of lager totaalvolume. Zolang de capaciteitsmonitor AFSCHALEN aangeeft, zijn dit verschuivingen binnen hetzelfde budget en geen uitbreidingen.</p>
<ol class="kalender">`);
for (const k of kalender) {
  H.push(`<li><span class="mnd"><b>${VOL[k.m]}</b>${k.m>=8?'2026':'2027'}</span>
<h3>${k.titel}</h3>
<div class="doen">${k.doen.map(([cls,t])=>`<div class="${cls}">${t}</div>`).join('')}</div>
<div class="cijfer">${k.cijfer}</div></li>`);
}
H.push(`</ol></div></section>`);

H.push(`<footer><div class="wrap">
<p><strong style="color:var(--ink)">Waar dit op gebaseerd is.</strong> Het offerteregister in Google Sheets, ${D.totaalOffertes.toLocaleString('nl-NL')} offerterijen in het venster augustus tot en met februari. Augustus tot december komen uit twee seizoenen (2024 en 2025), januari en februari uit twee seizoenen (2025 en 2026). Marge is verkoop min inkoop uit de sheet zelf, dus productmarge v&oacute;&oacute;r montage-uren, inmeten, garantie en overhead.</p>
<p><strong style="color:var(--ink)">Wat je moet meewegen.</strong> Vakken met minder dan ${MIN_N} offertes staan cursief; die zijn te klein om budget op te baseren. De verschillen tussen kanalen zijn deels een volume-effect: Meta is ook je grootste kanaal, en conversie zakt bij hogere volumes &mdash; dat gebeurde in 2026 ook met Google. Buren en bekenden scoren zo hoog omdat die klanten al overtuigd binnenkomen; dat kanaal laat zich niet zomaar opschalen met advertentiegeld. En 2024 had veel lagere volumes dan 2025, dus de conversies uit dat jaar liggen structureel hoger.</p>
<p><strong style="color:var(--ink)">Niet gecontroleerd.</strong> De akkoorden zijn niet tegen Gripp aangehouden. Advertentiekosten per kanaal zijn alleen bekend voor maart tot mei 2025, dus dit plan rangschikt op marge per offerte en niet op rendement per euro advertentiegeld. Zodra de kostenkolom voor 2026 gevuld is, kan die berekening erbij.</p>
</div></footer>`);

H.push(`<script>
document.querySelectorAll('.chart').forEach(function(chart){
  var tip=chart.querySelector('.tip'); if(!tip) return;
  chart.querySelectorAll('.hit').forEach(function(hit){
    function toon(){
      tip.innerHTML=hit.getAttribute('data-tip'); tip.style.opacity='1';
      var cb=chart.getBoundingClientRect(), hb=hit.getBoundingClientRect();
      var x=hb.left+hb.width/2-cb.left, y=hb.top-cb.top, tb=tip.getBoundingClientRect();
      tip.style.left=Math.max(4,Math.min(cb.width-tb.width-4,x-tb.width/2))+'px';
      tip.style.top=Math.max(4,y-tb.height-8)+'px';
    }
    hit.addEventListener('mouseenter',toon); hit.addEventListener('mousemove',toon);
    hit.addEventListener('focus',toon);
    hit.addEventListener('mouseleave',function(){tip.style.opacity='0'});
    hit.addEventListener('blur',function(){tip.style.opacity='0'});
    hit.setAttribute('tabindex','0');
  });
});
</script>`);

const uit2 = path.join(__dirname, '..', 'data', 'adverteerplan.html');
fs.writeFileSync(uit2, H.join('\n'));
console.log('geschreven:', uit2, (fs.statSync(uit2).size/1024).toFixed(0)+' kB');

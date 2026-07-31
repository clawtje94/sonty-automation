#!/usr/bin/env node
// CONVERSIE-DASHBOARD (opdracht Daimy 31 juli): conversie% per productgroep en per
// platform, per maand, met jaartabs. Wordt als statische pagina op sonty.nl gezet
// (public/dashboards/conversie.html) en wekelijks ververst via update-dashboard.sh.
// Toegang: zelfde code als het belscherm (client-side poort, zoals /admin/belscherm).
const fs = require('fs');
const path = require('path');

const JAREN = [2026, 2025, 2024];
const D = {};
for (const j of JAREN) D[j] = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', `conversie-${j}-tabellen.json`), 'utf8'));

const MND = ['', 'jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const pc = (a, b) => b ? a / b * 100 : null;
const f1 = n => n.toFixed(1).replace('.', ',');
const heat = v => v === null ? 'leeg' : 'h' + Math.min(6, Math.max(0, Math.round(v / 45 * 6)));
const nu = new Date();
const stand = nu.toLocaleString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Rijpheid: offertes rijpen ~45-60 dagen na; markeer maanden jonger dan 60 dagen.
const onrijp = (jaar, maand) => (nu - new Date(jaar, maand, 0)) / 864e5 < 60;

const PLATFORMS = ['Google', 'Meta', 'Buren/Bekenden', 'Anders'];
// Landing/campagne-proxy (data/landing-conversie.json via scripts/landing-analyse.js).
let LANDING = null; try { LANDING = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'landing-conversie.json'), 'utf8')); } catch {}
// Meta-campagnerendement (data/campagne-rendement.json via scripts/campagne-rendement.js).
let CAMPAGNES = null; try { CAMPAGNES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'campagne-rendement.json'), 'utf8')); } catch {}
// Advertentiekosten per maand (data/ad-spend.json via scripts/ad-spend.js).
let SPEND = {}; try { SPEND = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ad-spend.json'), 'utf8')); } catch {}
// Break-even advertentiekosten per order (scripts/breakeven-2026.js, 31 juli):
// bandbreedte 513 (conservatief, 2026) tot 592 (2025-methode).
const BREAK_EVEN = [513, 592];
const prodVolgorde = j => Object.entries(D[j].product)
  .filter(([k, v]) => v.off >= 60 && k !== 'Niet ingevuld')
  .sort((a, b) => b[1].off - a[1].off).map(([k]) => k);

function celTd(jaar, n, akk, m) {
  if (!n) return '<td class="leeg">—</td>';
  const v = pc(akk, n);
  const ster = onrijp(jaar, m) ? '<i>*</i>' : '';
  return `<td class="${heat(v)}" title="${akk} akkoord op ${n} offertes">${Math.round(v)}%${ster}<span>${n}</span></td>`;
}

function jaarBlok(jaar) {
  const d = D[jaar];
  const maanden = d.maandenAanwezig;
  const H = [];
  const t = d.totaal.alles;
  H.push(`<div class="jaar" id="jaar-${jaar}">`);
  H.push(`<div class="kpis">
<div class="kpi"><b>Offertes</b><span>${t.off.toLocaleString('nl-NL')}</span></div>
<div class="kpi"><b>Akkoord</b><span>${t.akk.toLocaleString('nl-NL')}</span></div>
<div class="kpi"><b>Conversie</b><span>${f1(pc(t.akk, t.off))}%</span></div>
<div class="kpi"><b>Omzet akkoord</b><span>€${Math.round(t.omzet / 1000).toLocaleString('nl-NL')}k</span></div>
</div>`);

  // per platform
  H.push(`<h2>Per platform</h2><div class="scroll"><table><thead><tr><th></th>${maanden.map(m => `<th>${MND[m]}</th>`).join('')}<th>jaar</th></tr></thead><tbody>`);
  for (const p of PLATFORMS) {
    let to = 0, ta = 0;
    const cellen = maanden.map(m => { const c = d.maandGroep[m + '|' + p] || { off: 0, akk: 0 };
      to += c.off; ta += c.akk; return celTd(jaar, c.off, c.akk, m); }).join('');
    H.push(`<tr><th>${p}</th>${cellen}<td class="tot">${to ? f1(pc(ta, to)) + '%' : '—'}<span>${to.toLocaleString('nl-NL')}</span></td></tr>`);
  }
  // kanaal-rijen
  for (const k of ['Winkel', 'Online']) {
    let to = 0, ta = 0;
    const cellen = maanden.map(m => { const c = d.maandKanaal[m + '|' + k] || { off: 0, akk: 0 };
      to += c.off; ta += c.akk; return celTd(jaar, c.off, c.akk, m); }).join('');
    H.push(`<tr class="kanaal"><th>${k === 'Winkel' ? 'Showroom' : 'Online'}</th>${cellen}<td class="tot">${to ? f1(pc(ta, to)) + '%' : '—'}<span>${to.toLocaleString('nl-NL')}</span></td></tr>`);
  }
  H.push(`</tbody></table></div>`);

  // per productgroep
  H.push(`<h2>Per productgroep</h2><div class="scroll"><table><thead><tr><th></th>${maanden.map(m => `<th>${MND[m]}</th>`).join('')}<th>jaar</th></tr></thead><tbody>`);
  for (const p of prodVolgorde(jaar)) {
    const jt = D[jaar].product[p];
    const cellen = maanden.map(m => { const c = d.maandProduct[m + '|' + p] || { off: 0, akk: 0 };
      return celTd(jaar, c.off, c.akk, m); }).join('');
    H.push(`<tr><th>${p}</th>${cellen}<td class="tot">${f1(pc(jt.akk, jt.off))}%<span>${jt.off.toLocaleString('nl-NL')}</span></td></tr>`);
  }
  H.push(`</tbody></table></div>`);

  // Rendement per platform — alleen maanden van dit jaar waar kostendata voor is.
  const spendMaanden = Object.keys(SPEND).filter(m => m.startsWith(String(jaar))).sort();
  H.push('<h2>Rendement advertenties</h2>');
  if (!spendMaanden.length) {
    H.push(`<p class="melding">Geen advertentiekosten bekend voor ${jaar}. Zet maandbedragen in de tab &ldquo;conversie %&rdquo; of in data/ad-spend-handmatig.json en dit blok rekent zichzelf uit (kosten per offerte, per order en of je boven of onder break-even zit).</p>`);
  } else {
    H.push(`<div class="scroll"><table><thead><tr><th>maand</th><th>platform</th><th>kosten</th><th>offertes</th><th>&euro;/offerte</th><th>orders</th><th>&euro;/order</th><th>oordeel</th></tr></thead><tbody>`);
    for (const m of spendMaanden) {
      const mnd = Number(m.slice(5, 7));
      for (const pf of ['Meta', 'Google']) {
        const kost = SPEND[m][pf]; if (!kost) continue;
        const c = d.maandGroep[mnd + '|' + pf] || { off: 0, akk: 0 };
        const perOff = c.off ? kost / c.off : null;
        const perOrd = c.akk ? kost / c.akk : null;
        const oordeel = perOrd === null ? '—' : perOrd < BREAK_EVEN[0] ? '<b class="goed">winstgevend</b>' : perOrd <= BREAK_EVEN[1] ? 'krap (rond break-even)' : '<b class="slecht">VERLIES</b>';
        H.push(`<tr><th>${MND[mnd]}</th><td style="text-align:left">${pf}</td><td>&euro;${Math.round(kost).toLocaleString('nl-NL')}</td><td>${c.off}</td><td>${perOff ? '&euro;' + Math.round(perOff) : '—'}</td><td>${c.akk}</td><td>${perOrd ? '&euro;' + Math.round(perOrd) : '—'}</td><td>${oordeel}</td></tr>`);
      }
    }
    H.push(`</tbody></table></div><p class="melding">Break-even &asymp; &euro;${BREAK_EVEN[0]}&ndash;&euro;${BREAK_EVEN[1]} advertentiekosten per order (productmarge min montage/overhead). Jonge maanden rijpen na: &euro;/order daalt dan nog.</p>`);
  }
  H.push('</div>');
  return H.join('\n');
}

const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Sonty · Conversie-dashboard</title>
<style>
:root{--surface:#FAF8F5;--surface-2:#FFF;--ink:#1C1815;--ink-2:#554D45;--ink-3:#8A8078;
--rule:#E4DDD3;--accent:#D95F02;
--h0:#FBF3EA;--h1:#F7E2CB;--h2:#F1C79E;--h3:#E7A76B;--h4:#D9853B;--h5:#BC6716;--h6:#944C09;
--h0i:#6B6259;--h1i:#4A3B28;--h2i:#3A2C1A;--h3i:#2E2112;--h4i:#FFF6EC;--h5i:#FFF6EC;--h6i:#FFF6EC;}
@media(prefers-color-scheme:dark){:root{--surface:#14110E;--surface-2:#1D1916;--ink:#F5F0EA;--ink-2:#B5ABA1;--ink-3:#7E756C;--rule:#302A24;--accent:#FF8438;
--h0:#1B1712;--h1:#2C2318;--h2:#42311C;--h3:#5B4220;--h4:#7A5626;--h5:#9C6C2C;--h6:#C08536;
--h0i:#7E756C;--h1i:#C0A98C;--h2i:#E5CDA9;--h3i:#F6E3C6;--h4i:#FFF3E2;--h5i:#FFF6EC;--h6i:#1B1712;}}
*{box-sizing:border-box}body{margin:0;background:var(--surface);color:var(--ink);
font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:15px;line-height:1.5}
.wrap{max-width:1150px;margin:0 auto;padding:1.2rem clamp(.8rem,3vw,2rem) 3rem}
header{display:flex;align-items:baseline;gap:.8rem;flex-wrap:wrap;margin:.6rem 0 1rem}
header h1{font-size:1.35rem;margin:0;letter-spacing:-.02em}
header .stand{color:var(--ink-3);font-size:.78rem}
.tabs{display:flex;gap:.4rem;margin:0 0 1.2rem}
.tabs button{font:inherit;font-weight:650;padding:.45rem 1rem;border:1px solid var(--rule);
background:var(--surface-2);color:var(--ink-2);border-radius:6px;cursor:pointer}
.tabs button.actief{background:var(--accent);border-color:var(--accent);color:#fff}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1px;background:var(--rule);border:1px solid var(--rule);margin-bottom:1.4rem}
.kpi{background:var(--surface-2);padding:.7rem .9rem}
.kpi b{display:block;font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);font-weight:600}
.kpi span{font-size:1.35rem;font-weight:750;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
h2{font-size:1.02rem;margin:1.4rem 0 .5rem;letter-spacing:-.01em}
.scroll{overflow-x:auto;border:1px solid var(--rule);background:var(--surface-2)}
table{border-collapse:collapse;width:100%;font-size:.8rem}
th,td{padding:.42rem .5rem;text-align:right;border-bottom:1px solid var(--rule);white-space:nowrap;font-variant-numeric:tabular-nums}
thead th{font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-3);position:sticky;top:0;background:var(--surface-2)}
tbody th{text-align:left;font-weight:600;position:sticky;left:0;background:var(--surface-2)}
tr.kanaal th{color:var(--ink-3);font-style:italic}
td span{display:block;font-size:.62rem;opacity:.65;font-weight:400}
td i{font-style:normal;opacity:.7}
td.tot{font-weight:700}
td.leeg{color:var(--ink-3)}
td.h0{background:var(--h0);color:var(--h0i)}td.h1{background:var(--h1);color:var(--h1i)}
td.h2{background:var(--h2);color:var(--h2i)}td.h3{background:var(--h3);color:var(--h3i)}
td.h4{background:var(--h4);color:var(--h4i)}td.h5{background:var(--h5);color:var(--h5i)}
td.h6{background:var(--h6);color:var(--h6i)}
.legenda{display:flex;gap:.5rem;align-items:center;color:var(--ink-3);font-size:.72rem;margin:.8rem 0 0;flex-wrap:wrap}
.legenda .cells{display:flex}.legenda .cells i{width:18px;height:10px;display:block}
.melding{color:var(--ink-3);font-size:.78rem;max-width:80ch;margin:.4rem 0}
.goed{color:#1F7A4C}.slecht{color:#A8321F}
@media(prefers-color-scheme:dark){.goed{color:#3FBF7F}.slecht{color:#F0705A}}
footer{color:var(--ink-3);font-size:.75rem;margin-top:1.6rem;max-width:75ch}
#poort{position:fixed;inset:0;background:var(--surface);display:flex;align-items:center;justify-content:center;z-index:9}
#poort form{background:var(--surface-2);border:1px solid var(--rule);padding:2rem;border-radius:8px;text-align:center}
#poort input{font:inherit;padding:.5rem .8rem;border:1px solid var(--rule);border-radius:6px;background:var(--surface);color:var(--ink);margin-top:.8rem;text-align:center}
#poort button{font:inherit;font-weight:650;margin-top:.8rem;padding:.5rem 1.4rem;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;display:block;width:100%}
.verborgen{display:none!important}
</style></head><body>
<div id="poort"><form onsubmit="return controleer(event)"><b>Sonty dashboard</b><br>
<input id="code" type="password" placeholder="toegangscode" autofocus><button>Open</button></form></div>
<div class="wrap verborgen" id="inhoud">
<header><h1>Conversie per product &amp; platform</h1><span class="stand">bijgewerkt ${stand} · ververst elke maandagochtend</span></header>
<div class="tabs">${JAREN.map((j, i) => `<button class="${i === 0 ? 'actief' : ''}" onclick="kies(${j},this)">${j}</button>`).join('')}</div>
${JAREN.map((j, i) => jaarBlok(j)).join('\n')}
${CAMPAGNES ? (() => {
  const eurK = n => '&euro;' + Math.round(n).toLocaleString('nl-NL');
  // platform-totalen: alle spend vs alle orders van die bron = zuiverste cijfer
  const pt = Object.entries(CAMPAGNES.platformen || {}).map(([plat, mnd]) => {
    const t = Object.values(mnd).reduce((a, v) => ({ spend: a.spend + v.spend, off: a.off + v.off, akk: a.akk + v.akk, omzet: a.omzet + v.omzet, marge: a.marge + (v.margeEx !== undefined ? v.margeEx : v.marge), netto: a.netto + v.netto }), { spend: 0, off: 0, akk: 0, omzet: 0, marge: 0, netto: 0 });
    return `<tr><th>${plat} totaal</th><td>${eurK(t.spend)}</td><td>${t.off}</td><td>${t.akk}</td><td>${eurK(t.omzet)}</td><td>${eurK(t.marge)}</td><td class="${t.netto >= 0 ? 'goed' : 'slecht'}"><b>${eurK(t.netto)}</b></td></tr>`;
  }).join('');
  const tot = {};
  for (const cs of Object.values(CAMPAGNES.maanden)) for (const c of cs) {
    const t = (tot[c.platform + '|' + c.campagne] = tot[c.platform + '|' + c.campagne] || { plat: c.platform, spend: 0, akk: 0, omzet: 0, marge: 0, netto: 0, toe: c.offertes !== null });
    t.spend += c.spend; if (c.offertes !== null) { t.akk += c.akkoorden; t.omzet += c.omzet || 0; t.marge += c.marge || 0; t.netto += c.netto || 0; }
  }
  const rij = t => t.toe
    ? `<tr><th>${t.plat} · ${t.naam}</th><td>${eurK(t.spend)}</td><td>${t.akk}</td><td>${eurK(t.omzet)}</td><td>${eurK(t.marge)}</td><td class="${t.netto >= 0 ? 'goed' : 'slecht'}"><b>${eurK(t.netto)}</b></td></tr>`
    : `<tr><th>${t.plat} · ${t.naam}</th><td>${eurK(t.spend)}</td><td colspan="4" style="text-align:left;color:var(--ink-3)">niet aan &eacute;&eacute;n product toe te wijzen (generiek) — telt wel mee in het platformtotaal</td></tr>`;
  const maandRijen = [];
  const alleMaanden = [...new Set(Object.values(CAMPAGNES.platformen || {}).flatMap(m => Object.keys(m)))].sort();
  for (const m of alleMaanden) for (const plat of ['Meta', 'Google']) {
    const v = (CAMPAGNES.platformen[plat] || {})[m]; if (!v) continue;
    maandRijen.push(`<tr><th>${m.slice(5)} · ${plat}</th><td>${eurK(v.spend)}</td><td>${v.off}</td><td>${v.akk}</td><td>${eurK(v.margeEx)}</td><td>${eurK(v.lasten)}</td><td class="${v.netto >= 0 ? 'goed' : 'slecht'}"><b>${eurK(v.netto)}</b></td></tr>`);
  }
  return `<h2>Advertenties: wat kost het en wat blijft er over (jan&ndash;jul 2026)</h2>
<div class="scroll"><table><thead><tr><th>platform</th><th>kosten</th><th>offertes</th><th>orders</th><th>omzet</th><th>productmarge</th><th>netto na ads+montage</th></tr></thead><tbody>${pt}</tbody></table></div>
<h2>Per maand, Meta naast Google (directe toerekening, ex btw)</h2>
<div class="scroll"><table><thead><tr><th>maand</th><th>kosten</th><th>offertes</th><th>orders</th><th>marge ex</th><th>lasten-deel</th><th>netto</th></tr></thead><tbody>${maandRijen.join('')}</tbody></table></div>
<h2>Per campagne (echte marges uit de sheet)</h2>
<div class="scroll"><table><thead><tr><th>campagne</th><th>kosten</th><th>orders</th><th>omzet</th><th>productmarge</th><th>netto</th></tr></thead><tbody>
${Object.entries(tot).map(([k, t]) => ({ ...t, naam: k.split('|')[1] })).sort((a, b) => b.spend - a.spend).map(rij).join('')}
</tbody></table></div>
<p class="melding">Netto = productmarge ex btw (akkoordbedrag min inkoop, /1,21; bij &euro;1-placeholder inkoop geschat via de inkoopratio van het product) min het aandeel in de <b>echte maandlasten</b> uit het lasten-blok in de sheet (alles behalve ad spend, toegerekend naar rato van orders: &euro;573&ndash;&euro;1.213 per order per maand) min advertentiekosten (ex btw). Jonge maanden rijpen na: netto stijgt nog. Productcampagnes krijgen ook orders die generieke campagnes (PMax, Plaatsen, Retargeting, Branding) mede veroorzaakten — het platformtotaal is het hardste cijfer.</p>`;
})() : ''}
${LANDING ? `<h2>Per landingspagina / actie (campagne-proxy, laatste ${LANDING.dagen} dagen)</h2>
<div class="scroll"><table><thead><tr><th>landing / actie</th><th>leads</th><th>akkoord</th><th>conv%</th><th>akkoordwaarde</th></tr></thead><tbody>
${Object.entries(LANDING.labels).map(([k, v]) => `<tr><th>${k}</th><td>${v.leads}</td><td>${v.akk}</td><td class="${heat(pc(v.akk, v.leads))}">${f1(pc(v.akk, v.leads))}%</td><td>&euro;${Math.round(v.waarde).toLocaleString('nl-NL')}</td></tr>`).join('')}
</tbody></table></div>
<p class="melding">Elke advertentie landt op een specifieke actie/configuratorpagina; dit is dus per campagne-familie. Voor exacte kosten-per-campagne: rapportmails op campagneniveau (loopt) en UTM-doorsluizing (gepland). Jonge leads rijpen nog na.</p>` : ''}
<div class="legenda"><span>0%</span><span class="cells">${[0,1,2,3,4,5,6].map(i => `<i style="background:var(--h${i})"></i>`).join('')}</span><span>45%+</span><span>· klein getal = aantal offertes · * = maand jonger dan 60 dagen, rijpt nog na (mediaan 24 dagen tot akkoord)</span></div>
<footer>Akkoord = inkoopkolom gevuld (ook €1-markering) of akkoord-blok (Gripp-nummer / akkoorddatum / akkoordbedrag) — definitie Daimy 28 juli. Platform Meta = Facebook + Instagram samengevoegd (labelwissel medio 2025). Bron: offerteregister-sheet, automatisch uitgelezen. 2024 begint in mei (eerdere maanden staan niet in de sheet).</footer>
</div>
<script>
function kies(j,btn){document.querySelectorAll('.jaar').forEach(e=>e.classList.add('verborgen'));
document.getElementById('jaar-'+j).classList.remove('verborgen');
document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('actief'));btn.classList.add('actief');}
document.querySelectorAll('.jaar').forEach((e,i)=>{if(i>0)e.classList.add('verborgen')});
function open_(){document.getElementById('poort').classList.add('verborgen');document.getElementById('inhoud').classList.remove('verborgen');}
function controleer(ev){ev.preventDefault();const c=document.getElementById('code').value.trim();
if(c==='sonty2288'){localStorage.setItem('sonty-dash','1');open_();}else{document.getElementById('code').value='';document.getElementById('code').placeholder='onjuiste code';}return false;}
// Vanuit het admin-dashboard geen tweede code vragen: de admin-login zet sonty-admin
// in sessionStorage op dezelfde origin.
if(localStorage.getItem('sonty-dash')==='1'||sessionStorage.getItem('sonty-admin')==='true')open_();
</script></body></html>`;

const uit = path.join(process.env.HOME, 'sonty-website', 'public', 'dashboards', 'conversie.html');
fs.mkdirSync(path.dirname(uit), { recursive: true });
fs.writeFileSync(uit, html);
console.log('geschreven:', uit, (fs.statSync(uit).size / 1024).toFixed(0) + ' kB');

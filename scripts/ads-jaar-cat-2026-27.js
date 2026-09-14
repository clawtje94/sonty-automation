// Per kanaal per productgroep per maand (okt-mei): doel/plafond/stop CPA (regel B), verwachte offertes, orders, max spend, netto.
// Basis: online-only (kanaal != Winkel), gepoold 2 seizoenen; maandindex per kanaal; 25/26-volume x groeifactor.
const fs = require('fs'); const B = '/Users/clawdboot/sonty/data/';
const rows = []; for (const j of [2024, 2025, 2026]) rows.push(...JSON.parse(fs.readFileSync(B + `conversie-${j}-raw.json`, 'utf8')).rows);
const META = JSON.parse(fs.readFileSync(B + 'campagne-spend-meta.json')); const GOOG = JSON.parse(fs.readFileSync(B + 'campagne-spend-google.json'));
const isAkk = r => r.inkoop > 0 || r.akkoordBedrag > 0 || /^\d{3,6}$/.test(r.nummer || '') || !!r.akkoordDatum;
const KAN = r => { const t = String(r.afkomst || '').trim().toLowerCase(); if (t.startsWith('face') || t.startsWith('insta')) return 'Meta'; if (t.startsWith('goog')) return 'Google'; return null; };
const PROD = p => { const t = String(p || '').trim().toLowerCase(); if (!t) return 'Onbekend';
  if (t.startsWith('rolluik')) return 'Rolluiken'; if (t.startsWith('screen')) return 'Screens'; if (t.startsWith('knikarm')) return 'Knikarmscherm'; if (t.startsWith('markiez')) return 'Markiezen'; if (t.startsWith('pergola')) return 'Pergola';
  if (t.startsWith('repara')) return 'Reparatie'; if (t.includes('raamdeco') || t.includes('zonwering binnen')) return 'Raamdecoratie'; if (t.includes('zonwering buiten')) return 'Zonwering buiten';
  if (t.startsWith('voorraad') || t.startsWith('vooraad')) return 'Voorraadscherm'; if (t.startsWith('uitval')) return 'Uitvalscherm'; return 'Overig'; };
const EX = 1.21; const M = [10, 11, 12, 1, 2, 3, 4, 5]; const MND = { 10: 'okt', 11: 'nov', 12: 'dec', 1: 'jan', 2: 'feb', 3: 'mrt', 4: 'apr', 5: 'mei' };
const SEAS = m => (m >= 10 || m <= 2) ? 'W' : 'L'; const POOL = { 10: [2024, 2025], 11: [2024, 2025], 12: [2024, 2025], 1: [2025, 2026], 2: [2025, 2026], 3: [2025, 2026], 4: [2025, 2026], 5: [2025, 2026] };
const MM = { 10: '2025-10', 11: '2025-11', 12: '2025-12', 1: '2026-01', 2: '2026-02', 3: '2026-03', 4: '2026-04', 5: '2026-05' };
const A = {}; const add = (k, r) => { const s = (A[k] = A[k] || { off: 0, akk: 0, m: 0 }); s.off++; if (isAkk(r)) { s.akk++; s.m += ((r.akkoordBedrag || r.bedrag || 0) - (r.inkoop || 0)) / EX; } };
for (const r of rows) { const k = KAN(r); if (!k) continue; if (String(r.kanaal || '').toLowerCase().startsWith('winkel')) continue; // online-only
  const p = PROD(r.prod); const ym = `${r.jaar}-${String(r.maand).padStart(2, '0')}`;
  if (POOL[r.maand] && POOL[r.maand].includes(r.jaar)) { add(`S|${k}|${p}|${SEAS(r.maand)}`, r); add(`S|${k}|ALLE|${SEAS(r.maand)}`, r); add(`M|${k}|ALLE|${r.maand}`, r); add(`M|${k}|${p}|${r.maand}`, r); }
  add(`W|${k}|${p}|${ym}`, r); add(`W|${k}|ALLE|${ym}`, r); }
const g = k => A[k] || { off: 0, akk: 0, m: 0 }; const bpo = s => s.off ? s.m / s.off : 0;
const idx = {}; for (const k of ['Google', 'Meta']) { idx[k] = {}; for (const m of M) { const s = SEAS(m); idx[k][m] = Math.min(1.3, Math.max(0.6, bpo(g(`M|${k}|ALLE|${m}`)) / bpo(g(`S|${k}|ALLE|${s}`)))); } }
const CATS = { Google: ['Rolluiken', 'Screens', 'Knikarmscherm', 'Zonwering buiten', 'Markiezen', 'Uitvalscherm', 'Raamdecoratie', 'Voorraadscherm', 'Pergola'], Meta: ['Rolluiken', 'Knikarmscherm', 'Screens', 'Pergola', 'Raamdecoratie', 'Markiezen', 'Uitvalscherm', 'Zonwering buiten', 'Voorraadscherm'] };
// groeifactor verwachte online offertes t.o.v. 25/26 per kanaal|cat|maand
const GF = {
  'Google|Rolluiken': { 10: 1.5, 11: 1.5, 12: 1.5, 1: 1.1, 2: 1.1, 3: 1.0, 4: 1.1, 5: 1.1 }, 'Google|Screens': { 10: 1.5, 11: 1.5, 12: 1.5, 1: 1.1, 2: 1.1, 3: 1.0, 4: 1.1, 5: 1.1 },
  'Google|Knikarmscherm': { 10: 0.7, 11: 0.7, 12: 0.7, 1: 1.1, 2: 1.2, 3: 1.0, 4: 1.1, 5: 1.1 }, 'Google|Zonwering buiten': { 10: 1.1, 11: 1.1, 12: 0, 1: 1.1, 2: 1.1, 3: 1.0, 4: 1.1, 5: 1.1 },
  'Google|Markiezen': { 10: 1, 11: 0.5, 12: 0.5, 1: 0.5, 2: 1, 3: 1.2, 4: 1.2, 5: 1.2 }, 'Google|Uitvalscherm': { 10: 0.5, 11: 0.5, 12: 0.5, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
  'Google|Raamdecoratie': { 10: 1.5, 11: 1.5, 12: 1.5, 1: 1.1, 2: 1.1, 3: 1.5, 4: 1.5, 5: 1.5 }, 'Google|Voorraadscherm': { 10: 1, 11: 1, 12: 1, 1: 1, 2: 1, 3: 0.5, 4: 0.5, 5: 0.5 },
  'Google|Pergola': { 10: 0, 11: 0, 12: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  'Meta|Rolluiken': { 10: 1.0, 11: 1.0, 12: 0.7, 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.2, 5: 1.2 }, 'Meta|Knikarmscherm': { 10: 0.5, 11: 0.5, 12: 0.3, 1: 1.5, 2: 1.5, 3: 1.1, 4: 1.2, 5: 1.2 },
  'Meta|Screens': { 10: 1, 11: 1, 12: 1, 1: 0.8, 2: 0.8, 3: 1.1, 4: 1.1, 5: 1.1 }, 'Meta|Pergola': { 10: 1, 11: 1, 12: 1, 1: 1, 2: 1, 3: 0.5, 4: 0.5, 5: 0.5 },
  'Meta|Raamdecoratie': { 10: 1.5, 11: 1.5, 12: 1.5, 1: 1.1, 2: 1.1, 3: 1.5, 4: 1.5, 5: 1.5 }, 'Meta|Markiezen': { 10: 0, 11: 0, 12: 0, 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 },
  'Meta|Uitvalscherm': { 10: 0, 11: 0, 12: 0, 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 }, 'Meta|Zonwering buiten': { 10: 0, 11: 0, 12: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, 'Meta|Voorraadscherm': { 10: 0, 11: 0, 12: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
// werkelijke spend per categorie per maand 25/26: Meta per campagne; Google eigen campagne + aandeel generiek naar offerte-aandeel (jan-mei)
const MC = n => { const t = n.toLowerCase(); if (t.includes('rolluik')) return 'Rolluiken'; if (t.includes('pergola')) return 'Pergola'; if (t.includes('screen')) return 'Screens'; if (t.includes('gordijn') || t.includes('raamdeco')) return 'Raamdecoratie'; if (t.includes('markiez')) return 'Markiezen'; if (t.includes('knikarm')) return 'Knikarmscherm'; return 'Generiek'; };
const GC = n => { const t = n.toLowerCase(); if (t.includes('rolluik')) return 'Rolluiken'; if (t.includes('pergola')) return 'Pergola'; if (t.includes('screen')) return 'Screens'; if (t.includes('knikarm')) return 'Knikarmscherm'; if (t.includes('markiez')) return 'Markiezen'; return 'Generiek'; };
const SP = {};
for (const m of M) { const mm = MM[m];
  for (const [n, v] of Object.entries(META[mm] || {})) { const c = MC(n); SP[`Meta|${c}|${m}`] = (SP[`Meta|${c}|${m}`] || 0) + v.spend; }
  for (const [n, v] of Object.entries(GOOG[mm] || {})) { const c = GC(n); SP[`Google|${c}|${m}`] = (SP[`Google|${c}|${m}`] || 0) + v.spend; } }
const eur = n => '€' + Math.round(n).toLocaleString('nl-NL'); const r5 = n => Math.round(n / 5) * 5; const pc = (a, b) => b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : '-';
const OUT = { idx, cat: {}, tot: {} }; let md = '', html = '';
const th = (t, n) => `<th${n ? ' class="n"' : ''}>${t}</th>`, td = (t, cls) => `<td class="${cls || ''}">${t}</td>`;
for (const k of ['Google', 'Meta']) {
  const totM = {}; for (const m of M) totM[m] = { off: 0, ord: 0, marge: 0, bud: 0, max: 0 };
  const yr = {};
  // tabel 1: CPA per maand
  md += `\n### ${k}\n\nMaandindex (marge per online-offerte t.o.v. seizoensgemiddelde): ${M.map(m => `${MND[m]} ${idx[k][m].toFixed(2)}`).join(' · ')}\n\n**${k}: doel / plafond / stop CPA per sheet-offerte (regel B: 50% / 70% / 100% van de marge per online-offerte × maandindex)**\n\n| productgroep | conv online W / L | marge per akkoord W / L | BE online W / L | ${M.map(m => MND[m]).join(' | ')} |\n|---|---|---|---|${M.map(() => '---').join('|')}|\n`;
  html += `<h3>${k}: doel / <b>plafond</b> / stop CPA per sheet-offerte</h3><div class="scroll"><table><tr>${th('Productgroep')}${th('Conv. online W / L', 1)}${th('Marge/akkoord W / L', 1)}${th('Break-even online W / L', 1)}${M.map(m => th(MND[m], 1)).join('')}</tr>`;
  const T2 = [], T3 = [];
  for (const p of CATS[k]) { const sw = g(`S|${k}|${p}|W`), sl = g(`S|${k}|${p}|L`); const cells = [], cells2 = [], cells2h = [], cellsh = [];
    yr[p] = { off: 0, ord: 0, marge: 0, bud: 0, max: 0, was: { off: 0, sp: 0, spKnown: true, akk: 0, m: 0 } };
    for (const m of M) { const s = SEAS(m) === 'W' ? sw : sl; const conv = s.off ? s.akk / s.off : 0, mpa = s.akk ? s.m / s.akk : 0, be = bpo(s) * idx[k][m];
      const doel = r5(be * 0.5), plaf = r5(be * 0.7), stop = r5(be * 1.0);
      const w = g(`W|${k}|${p}|${MM[m]}`); const gf = GF[`${k}|${p}`][m]; const verw = Math.round(w.off * gf); const ord = verw * conv; const marge = ord * mpa; const bud = verw * doel, max = verw * plaf;
      // werkelijk spend
      let sp = SP[`${k}|${p}|${m}`] || 0; let known = true;
      if (k === 'Google') { if (!GOOG[MM[m]]) { known = false; sp = null; } else { const gen = SP[`Google|Generiek|${m}`] || 0; const allOff = g(`W|Google|ALLE|${MM[m]}`).off; sp += gen * (allOff ? w.off / allOff : 0); } }
      if (k === 'Meta' && p !== 'Rolluiken' && p !== 'Pergola' && p !== 'Screens' && p !== 'Raamdecoratie' && p !== 'Markiezen') { sp = null; known = false; }
      OUT.cat[`${k}|${p}|${m}`] = { conv, mpa, be: Math.round(be), doel, plaf, stop, was: { off: w.off, akk: w.akk, m: Math.round(w.m), sp: sp === null ? null : Math.round(sp), cpl: (sp !== null && w.off) ? Math.round(sp / w.off) : null }, verw, ord: +ord.toFixed(1), marge: Math.round(marge), bud, max, nettoBud: Math.round(marge - bud), nettoMax: Math.round(marge - max) };
      totM[m].off += verw; totM[m].ord += ord; totM[m].marge += marge; totM[m].bud += bud; totM[m].max += max;
      const y = yr[p]; y.off += verw; y.ord += ord; y.marge += marge; y.bud += bud; y.max += max; y.was.off += w.off; y.was.akk += w.akk; y.was.m += w.m; if (sp === null) y.was.spKnown = false; else y.was.sp += sp;
      const uit = !verw; cells.push(`${uit ? 'uit: ' : ''}${doel} / ${plaf} / ${stop}`); cellsh.push(td(`${uit ? '<span class="tag uit">uit</span> ' : ''}€${doel} / <b>€${plaf}</b> / €${stop}`, 'n' + (uit ? ' uitc' : '')));
      const wasTxt = sp === null ? (w.off ? `was ${w.off} off` : '') : `was ${w.off} off à €${w.off ? Math.round(sp / w.off) : 0}`;
      cells2.push(uit ? `uit (${wasTxt || '-'})` : `${verw} off · ${Math.round(ord)} ord · **${eur(max)}** (basis ${eur(bud)}) · ${wasTxt}`); cells2h.push(td(uit ? `<span class="tag uit">uit</span> <small>${wasTxt}</small>` : `${verw} off · ${Math.round(ord)} ord<br><b>max ${eur(max)}</b> <small>(basis ${eur(bud)})</small><br><small>${wasTxt}</small>`, 'n')); }
    md += `| ${p} (n ${sw.off} / ${sl.off}${(sw.off < 40 || sl.off < 40) ? ', klein' : ''}) | ${pc(sw.akk, sw.off)} / ${pc(sl.akk, sl.off)} | ${eur(sw.akk ? sw.m / sw.akk : 0)} / ${eur(sl.akk ? sl.m / sl.akk : 0)} | €${Math.round(bpo(sw))} / €${Math.round(bpo(sl))} | ${cells.join(' | ')} |\n`;
    html += `<tr>${td(p + `<br><small>n ${sw.off} / ${sl.off}${(sw.off < 40 || sl.off < 40) ? ' <span class="tag uit">klein</span>' : ''}</small>`)}${td(`${pc(sw.akk, sw.off)} / ${pc(sl.akk, sl.off)}`, 'n')}${td(`${eur(sw.akk ? sw.m / sw.akk : 0)} / ${eur(sl.akk ? sl.m / sl.akk : 0)}`, 'n')}${td(`€${Math.round(bpo(sw))} / €${Math.round(bpo(sl))}`, 'n')}${cellsh.join('')}</tr>`;
    T2.push(`| ${p} | ${cells2.join(' | ')} |`); T3.push(`<tr>${td(p)}${cells2h.join('')}</tr>`); }
  html += '</table></div>';
  md += `\n**${k}: max spend per maand (verwachte online-offertes × plafond; basis = × doel) met verwachte orders, en wat het vorig jaar was**\n\n| productgroep | ${M.map(m => MND[m]).join(' | ')} |\n|---|${M.map(() => '---').join('|')}|\n${T2.join('\n')}\n| **totaal ${k}** | ${M.map(m => `**${totM[m].off} off · ${Math.round(totM[m].ord)} ord · max ${eur(totM[m].max)} (basis ${eur(totM[m].bud)})**`).join(' | ')} |\n`;
  html += `<h3>${k}: max spend per maand (verwachte online-offertes × plafond), basis (× doel), verwachte orders, en vorig jaar</h3><div class="scroll"><table><tr>${th('Productgroep')}${M.map(m => th(MND[m], 1)).join('')}</tr>${T3.join('')}<tr>${th('totaal ' + k)}${M.map(m => th(`${totM[m].off} off · ${Math.round(totM[m].ord)} ord<br>max ${eur(totM[m].max)}<br><small>basis ${eur(totM[m].bud)}</small>`, 1)).join('')}</tr></table></div>`;
  // jaartabel
  md += `\n**${k}: okt-mei per productgroep** (verwacht bij regel B; netto = marge − spend, vóór lasten)\n\n| productgroep | verwacht offertes | orders | marge | spend basis-max | netto bij basis / bij max | vorig jaar offertes / orders / marge / spend / netto |\n|---|---|---|---|---|---|---|\n`;
  html += `<h3>${k}: okt-mei per productgroep</h3><div class="scroll"><table><tr>${th('Productgroep')}${th('Verwacht offertes', 1)}${th('Orders', 1)}${th('Marge', 1)}${th('Spend basis-max', 1)}${th('Netto bij basis / bij max', 1)}${th('Vorig jaar: offertes / orders / marge / spend / netto', 1)}</tr>`;
  let Y = { off: 0, ord: 0, marge: 0, bud: 0, max: 0, wo: 0, wa: 0, wm: 0, ws: 0 };
  for (const p of CATS[k]) { const y = yr[p]; Y.off += y.off; Y.ord += y.ord; Y.marge += y.marge; Y.bud += y.bud; Y.max += y.max; Y.wo += y.was.off; Y.wa += y.was.akk; Y.wm += y.was.m; Y.ws += y.was.sp;
    const wasTxt = `${y.was.off} / ${y.was.akk} / ${eur(y.was.m)} / ${y.was.spKnown ? eur(y.was.sp) : '≥' + eur(y.was.sp)} / ${y.was.spKnown ? eur(y.was.m - y.was.sp) : '?'}`;
    md += `| ${p} | ${y.off} | ${Math.round(y.ord)} | ${eur(y.marge)} | ${eur(y.bud)}-${eur(y.max)} | ${eur(y.marge - y.bud)} / ${eur(y.marge - y.max)} | ${wasTxt} |\n`;
    html += `<tr>${td(p)}${td(y.off, 'n')}${td(Math.round(y.ord), 'n')}${td(eur(y.marge), 'n')}${td(`${eur(y.bud)}-${eur(y.max)}`, 'n')}${td(`${eur(y.marge - y.bud)} / ${eur(y.marge - y.max)}`, 'n')}${td(wasTxt, 'n')}</tr>`; }
  md += `| **totaal** | ${Y.off} | ${Math.round(Y.ord)} | ${eur(Y.marge)} | ${eur(Y.bud)}-${eur(Y.max)} | ${eur(Y.marge - Y.bud)} / ${eur(Y.marge - Y.max)} | ${Y.wo} / ${Y.wa} / ${eur(Y.wm)} / ≥${eur(Y.ws)} / - |\n`;
  html += `<tr>${th('totaal')}${th(Y.off, 1)}${th(Math.round(Y.ord), 1)}${th(eur(Y.marge), 1)}${th(`${eur(Y.bud)}-${eur(Y.max)}`, 1)}${th(`${eur(Y.marge - Y.bud)} / ${eur(Y.marge - Y.max)}`, 1)}${th(`${Y.wo} / ${Y.wa} / ${eur(Y.wm)} / ≥${eur(Y.ws)}`, 1)}</tr></table></div>`;
  OUT.tot[k] = { totM, yr, Y }; }
fs.writeFileSync(__dirname + '/jaar-cat.md', md); fs.writeFileSync(__dirname + '/jaar-cat.html', html); fs.writeFileSync(__dirname + '/jaar-cat.json', JSON.stringify(OUT, null, 1));
console.log(md);

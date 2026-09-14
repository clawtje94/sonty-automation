// Twee simpele briefings (Google Ads-beheerder, Meta Ads-beheerder) uit jaar-cat.json.
const fs = require('fs'); const J = JSON.parse(fs.readFileSync(__dirname + '/../data/ads-jaar-cat-2026-27.json'));
const M = [10, 11, 12, 1, 2, 3, 4, 5]; const MND = { 10: 'okt', 11: 'nov', 12: 'dec', 1: 'jan', 2: 'feb', 3: 'mrt', 4: 'apr', 5: 'mei' };
const JR = { 10: '2026', 11: '2026', 12: '2026', 1: '2027', 2: '2027', 3: '2027', 4: '2027', 5: '2027' };
const eur = n => '€' + Math.round(n).toLocaleString('nl-NL'); const r100 = n => Math.round(n / 100) * 100; const r5 = n => Math.round(n / 5) * 5;
const c = (k, p, m) => J.cat[`${k}|${p}|${m}`];
const CSS = `body{margin:0;background:#fff;color:#1d1d1b;font:14px/1.45 -apple-system,Segoe UI,Helvetica,Arial,sans-serif}.wrap{max-width:1000px;margin:0 auto;padding:24px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:17px;margin:26px 0 8px;border-bottom:2px solid #f2a900;padding-bottom:3px}.sub{color:#6b6a66;margin-bottom:16px}
table{width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e4e2dc}th,td{padding:6px 8px;border-bottom:1px solid #e4e2dc;text-align:left;vertical-align:top}th{background:#f0eee8;font-size:12px}
td.n,th.n{text-align:right;white-space:nowrap}.uit{color:#b42318;font-weight:600}.aan{color:#1f7a3a;font-weight:600}.box{background:#fff8e6;border-left:4px solid #f2a900;padding:10px 14px;border-radius:6px;margin:12px 0}
ul{margin:6px 0 0 18px}li{margin:3px 0}small{color:#6b6a66}tr{break-inside:avoid}`;
function doc(k, titel, intro, GROEPEN, factor, cpaLabel, regels, extra) {
  let h = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>${titel}</title><style>${CSS}</style></head><body><div class="wrap"><h1>${titel}</h1><div class="sub">Sonty, periode oktober 2026 t/m mei 2027. Opgesteld 14-09-2026. Alle bedragen ex btw.</div>${intro}`;
  h += `<h2>1. Budget en ${cpaLabel} per productgroep per maand</h2><div class="box">Per cel: <b>maandbudget</b> en daaronder <b>doel / max / stop</b> ${cpaLabel}. Doel = waar we op sturen. Max = tot hier is het goed. Stop = daarboven de campagne pauzeren en overleggen. "uit" = die maand niet adverteren op deze productgroep.</div><table><tr><th>Productgroep (campagne)</th>${M.map(m => `<th class="n">${MND[m]} ${JR[m]}</th>`).join('')}<th class="n">okt-mei</th></tr>`;
  const tot = {}; for (const m of M) tot[m] = 0; let totY = 0;
  for (const gr of GROEPEN) { const cells = []; let y = 0;
    for (const m of M) { let bud = 0, doel = 0, plaf = 0, stop = 0, on = false;
      for (const p of gr.cats) { const x = c(k, p, m); if (!x) continue; if (x.verw > 0) { on = true; bud += x.bud; if (!doel || x.doel < doel) { doel = x.doel; plaf = x.plaf; stop = x.stop; } } }
      if (gr.vast) { bud = gr.vast; on = true; }
      if (gr.onOverride && gr.onOverride[m] === false) on = false;
      if (!on) { cells.push('<td class="n uit">uit</td>'); continue; }
      const b = r100(bud); tot[m] += b; y += b;
      cells.push(`<td class="n"><b>${eur(b)}</b>${gr.vast ? '' : `<br><small>€${r5(doel * factor)} / €${r5(plaf * factor)} / €${r5(stop * factor)}</small>`}</td>`); }
    totY += y; h += `<tr><td><b>${gr.naam}</b><br><small>${gr.camp}</small></td>${cells.join('')}<td class="n"><b>${eur(y)}</b></td></tr>`; }
  h += `<tr><th>Totaal ${k}</th>${M.map(m => `<th class="n">${eur(tot[m])}</th>`).join('')}<th class="n">${eur(totY)}</th></tr></table>`;
  h += `<h2>2. Regels</h2><ul>${regels.map(r => `<li>${r}</li>`).join('')}</ul>`;
  h += extra + `<p><small>Contact: Daimy Boot, daimy@sonty.nl. Wekelijkse cijfers naar aanvragen@sonty.nl.</small></p></div></body></html>`;
  return { h, tot, totY };
}
// ---------- GOOGLE ----------
const G = doc('Google', 'Briefing Google Ads: winter en lente 2026/27',
  `<div class="box"><b>Doel van deze periode:</b> in oktober en november zoveel mogelijk goede aanvragen voor rolluiken en screens binnenhalen (die worden in december en januari gemonteerd), december rustig, vanaf de tweede week van januari knikarmschermen erbij, in de lente vol op rolluiken, screens en knikarmschermen. Pergola en voorraadschermen krijgen geen eigen budget meer. Wij meten per productgroep op offerte-aanvragen in ons eigen systeem; de CPA-waarden hieronder zijn al omgerekend naar Google Ads-conversies (factor 0,75).</div>`,
  [ { naam: 'Rolluiken', camp: '01 | Zonwering | Rolluiken + asset group in Performance Max', cats: ['Rolluiken'] },
    { naam: 'Screens', camp: '01 | Zonwering | Schermen + Screens + asset group PMax', cats: ['Screens'] },
    { naam: 'Knikarmschermen (+ uitvalschermen)', camp: '01 | Zonwering | Knikarmschermen; okt-dec klein, vanaf 2e week jan vol', cats: ['Knikarmscherm', 'Uitvalscherm'] },
    { naam: 'Zonwering algemeen (aanvraag zonder productkeuze)', camp: 'komt uit 01 | Performance Max | Zonwering en Plaatsen; PMax zelf heeft geen apart budget, die aanvragen tellen mee per productgroep hierboven', cats: ['Zonwering buiten'] },
    { naam: 'Markiezen', camp: '01 | Zonwering | Markiezen; winter bijna uit, lente aan', cats: ['Markiezen'] },
    { naam: 'Raamdecoratie binnen', camp: 'nieuw, klein: search "plissé / duette / rolgordijn op maat" met showroom als CTA', cats: ['Raamdecoratie'] },
    { naam: 'Voorraadschermen', camp: 'geen eigen campagne; alleen via PMax; lente halveren', cats: ['Voorraadscherm'] },
    { naam: 'Pergola', camp: '01 | Zonwering | Pergola: UIT (hele periode); pergola ook uit PMax-assets/zoekwoorden', cats: ['Pergola'] },
    { naam: 'Branding / remarketing / discovery', camp: '00 | Branding, 03 | Remarketing, 04 | Discovery', cats: [], vast: 300 } ],
  0.75, 'doel-CPA (per Google Ads-conversie)',
  [ 'Budget per productgroep per maand is leidend; verdeling tussen search en Performance Max is aan jou, maar wij rapporteren per productgroep uit ons offerte-systeem.',
    'Doel-CPA per maand instellen zoals in de tabel (tCPA of maximaliseren conversies met doel). Twee weken boven "max": budget van die productgroep 30% omlaag. Boven "stop": pauzeren en melden.',
    'Onder "doel" en volume beschikbaar: budget mag omhoog, in stappen van 20% per week, tot het volume opdroogt. Meld dat dan.',
    'December: biedingen 20% omlaag van 8 december t/m 5 januari.',
    'Knikarmschermen: klein houden t/m december, vanaf de tweede week van januari volle budgetten (vroegboek: "hangt vóór de eerste mooie dag", levertijd 8-10 weken).',
    'Campagne "01 | Zonwering | Straal": eerst uitleggen wat het is; tot dan maximaal €1.500 per maand.',
    'Pergola: campagne uit, en pergola uit de PMax-asset groups en zoekwoorden (negatief). Voorraadscherm: geen eigen campagne.',
    'Wekelijks (maandag) een kort overzicht: per campagne spend, conversies, CPA, en per productgroep. Wij leggen dat naast onze offerte-aantallen.',
    'Geen prijzen of kortingen in advertenties zonder akkoord van Daimy. Geen namen van andere zonweringbedrijven. Garantie altijd 3 jaar montage / 5 jaar product / 7 jaar motor.' ],
  `<h2>3. Wat je mag verwachten</h2><ul><li>Vorig jaar (jan-jul 2026) kostte een offerte-aanvraag via Google gemiddeld €48-72; in Google Ads-conversies is dat €36-54. De doelen hierboven liggen daar rond of iets boven in okt-nov en jan, en eronder in december.</li><li>Verwachte offerte-aanvragen in ons systeem (alle Google-campagnes samen): okt 147, nov 117, dec 139, jan 199, feb 251, mrt 429, apr 488, mei 602.</li></ul>`);
// ---------- META ----------
const Mt = doc('Meta', 'Briefing Meta Ads (Facebook / Instagram): winter en lente 2026/27',
  `<div class="box"><b>Doel van deze periode:</b> rolluiken blijven de kern, maar alleen tegen een lagere prijs per lead dan vorige winter (toen €88-104 per aanvraag in oktober-november, veel te duur). December bijna uit. Vanaf de tweede week van januari knikarmschermen (vroegboek-set staat klaar). Pergola alleen zolang de leads heel goedkoop blijven. In de lente ruimte voor meer volume op rolluiken en knikarm. Kosten per lead in Meta = kosten per offerte-aanvraag bij ons (die lopen 1-op-1).</div>`,
  [ { naam: 'Rolluiken', camp: '01 | Leads campagne - Rolluiken; nieuwe set (kaart-formule, video met hook, click-to-WhatsApp-variant) staat klaar', cats: ['Rolluiken'] },
    { naam: 'Knikarmschermen (+ uitvalschermen)', camp: 'nieuw: "Knikarm vroegboek 2027"; start 2e week januari', cats: ['Knikarmscherm', 'Uitvalscherm'], onOverride: { 10: false, 11: false, 12: false } },
    { naam: 'Screens', camp: '05 | Leads - Screens; klein, boven max uit', cats: ['Screens'] },
    { naam: 'Pergola', camp: '04 | Leadscampagne - Pergola; alleen zolang de CPL onder max blijft', cats: ['Pergola'] },
    { naam: 'Raamdecoratie / showroom', camp: '06 | Gordijnen ombouwen: showroom als CTA (Bookings-link); doel/max/stop geldt per lead óf per showroomboeking', cats: ['Raamdecoratie'] },
    { naam: 'Markiezen', camp: '07 | Leadscampagne - Markiezen; alleen lente', cats: ['Markiezen'] },
    { naam: 'Retargeting', camp: '02 | Retargeting | Leads (sitebezoekers 30 d, offertepagina zonder bedankt)', cats: [], vast: 1500 },
    { naam: 'Zonwering algemeen', camp: '03 | Leadscampagne - Zonwering: UIT (niet toe te rekenen)', cats: ['Zonwering buiten'] },
    { naam: 'Voorraadschermen', camp: 'UIT (1,5% van de aanvragen wordt een order)', cats: ['Voorraadscherm'] } ],
  1, 'kosten per lead (CPL)',
  [ 'Budget per campagne per maand is leidend. Kostenlimiet per resultaat instellen op "max" uit de tabel; sturen op "doel".',
    'Twee weken boven "max": budget van die campagne 30% omlaag. Boven "stop": campagne pauzeren en melden. Onder "doel" en volume beschikbaar: budget omhoog in stappen van 20% per week.',
    'December: rolluiken op minimum, pergola en screens uit als de CPL boven max komt. Vanaf 8 januari weer opbouwen.',
    'Knikarm vroegboek: start tweede week januari, adsets koud / vragen / warm zoals aangeleverd. Doel-CPL in de tabel.',
    'Rolluiken: eerst de nieuwe set testen (per adset 1 kaart-ad tegen 1 teststijl, 7 dagen, minimaal €150 per variant); beoordelen op kosten per lead, niet op klikratio. Video: hook-rate boven 30%, anders hook vervangen.',
    'Click-to-WhatsApp-variant mag live zodra Daimy het bedrijfsnummer (085 006 9681) in Meta heeft bevestigd.',
    'Leadformulieren: kwalificatievragen (huiseigenaar, product, gewenste periode) laten staan; leads gaan direct naar ons systeem.',
    'Wekelijks (maandag) per campagne: spend, leads, CPL, en de 3 beste en 3 slechtste ads. Wij leggen dat naast onze offertes en akkoorden.',
    'Geen prijzen of kortingen in advertenties zonder akkoord van Daimy (15% actiekorting op maatwerk-zonwering is akkoord). Geen namen van andere zonweringbedrijven. Garantie 3 / 5 / 7 jaar. Geen handbediening aanprijzen.' ],
  `<h2>3. Wat je mag verwachten</h2><ul><li>Historisch: beste rolluik-ads €43-50 per lead, mei 2026 €21, winter 2025 €57-70 in Ads Manager (€88-104 per online-aanvraag in okt-nov). De doelen in de tabel zijn scherper dan vorige winter: dat is bewust.</li><li>Verwachte leads (alle campagnes samen): okt 190, nov 208, dec 146, jan 346, feb 382, mrt 606, apr 704, mei 767.</li></ul>`);
fs.writeFileSync('/Users/clawdboot/sonty/docs/briefing-google-ads-2026-27.html', G.h); fs.writeFileSync('/Users/clawdboot/sonty/docs/briefing-meta-ads-2026-27.html', Mt.h);
console.log('Google per maand', M.map(m => `${MND[m]} ${eur(G.tot[m])}`).join(', '), '=', eur(G.totY));
console.log('Meta per maand', M.map(m => `${MND[m]} ${eur(Mt.tot[m])}`).join(', '), '=', eur(Mt.totY));

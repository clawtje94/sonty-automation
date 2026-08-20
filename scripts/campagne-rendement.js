#!/usr/bin/env node
// KOSTEN & OPBRENGST PER CAMPAGNE, Meta én Google (Daimy 31 juli).
// Toewijzing: campagnenaam -> productbucket(s); de sheet levert per offerte bron + product.
// Generieke campagnes (PMax, Plaatsen, Branding, Remarketing, Discovery, Straal,
// Retargeting) zijn NIET aan een product toe te wijzen en staan apart — belangrijk bij
// Google, waar dat ruim de helft van het budget is. Productcampagne-cijfers zijn daardoor
// geflatteerd (generieke campagnes voeden dezelfde producten). Echte fix = UTM.
const fs = require('fs');
const path = require('path');
const BASIS = path.join(__dirname, '..', 'data');
const isAkk = r => r.inkoop > 0 || r.akkoordBedrag > 0 || /^\d{3,6}$/.test(r.nummer || '') || !!r.akkoordDatum;
// Alle brongroepen (Daimy 31-07: ook winkel/anders/de rest meenemen). Showroom-orders
// tellen bij hun afkomst; de niet-betaalde bronnen zijn buren/bekenden, anders, onbekend.
const groepVan = r => { const t = String(r.afkomst || '').trim().toLowerCase();
  if (/^face|^insta/.test(t)) return 'Meta';
  if (/^goog/.test(t)) return 'Google';
  if (/beken|buren/.test(t)) return 'Buren/bekenden';
  if (!t || t === '(leeg)') return 'Onbekend';
  return 'Anders'; };
const BRON = { Meta: r => groepVan(r) === 'Meta', Google: r => groepVan(r) === 'Google' };
const ALLE_GROEPEN = ['Meta', 'Google', 'Buren/bekenden', 'Anders', 'Onbekend'];
// fijne productbuckets
const PROD = p => { const t = String(p || '').trim().toLowerCase();
  if (t.startsWith('rolluik')) return 'Rolluiken';
  if (t.startsWith('screen')) return 'Screens';
  if (t.startsWith('pergola')) return 'Pergola';
  if (t.startsWith('markiez')) return 'Markiezen';
  if (t.startsWith('knikarm')) return 'Knikarm';
  if (t.includes('zonwering buiten') || t.startsWith('uitval') || t.startsWith('voorraad') || t.startsWith('vooraad')) return 'ZonwOverig';
  if (t.includes('raamdeco') || t.includes('gordijn') || t.includes('zonwering binnen')) return 'Gordijnen';
  return null; };
// campagne -> bucketlijst (null = niet toewijsbaar)
const MAP = n => { const t = n.toLowerCase();
  if (/retargeting|remarketing|branding|discovery|performance max|plaatsen|straal|youtube/.test(t)) return null;
  if (t.includes('rolluik')) return ['Rolluiken'];
  if (t.includes('pergola')) return ['Pergola'];
  if (t.includes('markiez')) return ['Markiezen'];
  if (t.includes('knikarm')) return ['Knikarm'];
  if (t.includes('schermen + screens') || t.includes('schermen+screens')) return ['Screens', 'ZonwOverig', 'Knikarm'];
  if (t.includes('screen')) return ['Screens'];
  if (t.includes('gordijn')) return ['Gordijnen'];
  if (t.includes('zonwering')) return ['Knikarm', 'ZonwOverig'];
  return null; };

const rows = JSON.parse(fs.readFileSync(path.join(BASIS, 'conversie-2026-raw.json'), 'utf8')).rows;
// Echte marge per order: akkoordbedrag min inkoop (incl btw in de sheet).
// €1-inkoop is een placeholder (administratie volgt): schat de inkoop dan via de
// gemiddelde inkoopratio van hetzelfde product (orders met échte inkoop).
const ratioPerProd = {};
for (const r of rows) { if (!isAkk(r) || r.inkoop <= 1) continue;
  const p = PROD(r.prod) || 'overig'; const w = r.akkoordBedrag || r.bedrag || 0; if (!w) continue;
  const t = (ratioPerProd[p] = ratioPerProd[p] || { ink: 0, omz: 0 }); t.ink += r.inkoop; t.omz += w; }
const ratio = p => { const t = ratioPerProd[p] || ratioPerProd['overig']; return t && t.omz ? t.ink / t.omz : 0.55; };
const orderCijfers = r => { const omzet = r.akkoordBedrag || r.bedrag || 0;
  const inkoop = r.inkoop > 1 ? r.inkoop : omzet * ratio(PROD(r.prod) || 'overig');
  return { omzet, marge: omzet - inkoop }; };

const per = {};      // platform|maand|bucket -> {off,akk,omzet,marge} (alleen Meta/Google, voor campagnes)
const platTot = {};  // groep|maand -> alle offertes/orders van die bron
for (const r of rows) {
  const groep = groepVan(r);
  const maand = `2026-${String(r.maand).padStart(2, '0')}`;
  const pt = (platTot[`${groep}|${maand}`] = platTot[`${groep}|${maand}`] || { off: 0, akk: 0, omzet: 0, marge: 0 });
  pt.off++;
  const p = (groep === 'Meta' || groep === 'Google') ? PROD(r.prod) : null;
  const m = p ? (per[`${groep}|${maand}|${p}`] = per[`${groep}|${maand}|${p}`] || { off: 0, akk: 0, omzet: 0, marge: 0 }) : null;
  if (m) m.off++;
  if (isAkk(r)) { const c = orderCijfers(r);
    pt.akk++; pt.omzet += c.omzet; pt.marge += c.marge;
    if (m) { m.akk++; m.omzet += c.omzet; m.marge += c.marge; } }
}
// ECHTE MAANDLASTEN (Daimy 31 juli): elk maandtab heeft een lasten-blok = alle
// bedrijfslasten van die maand behalve ad spend (monteurs, buslease, overhead).
// Toerekening: lasten / alle orders van die maand (elke bron, ook winkel) = lasten
// per order; een campagne draagt orders x dat bedrag. Alles EX btw: marge wordt
// gedeeld door 1,21 (sheetbedragen zijn incl), ad spend is al ex (Ads Manager).
const LASTEN = JSON.parse(fs.readFileSync(path.join(BASIS, 'maand-lasten.json'), 'utf8'));
const ordersPerMaand = {};
for (const r of rows) if (isAkk(r)) { const m = `2026-${String(r.maand).padStart(2, '0')}`;
  ordersPerMaand[m] = (ordersPerMaand[m] || 0) + 1; }
const lastenPerOrder = m => (LASTEN[m] && ordersPerMaand[m]) ? LASTEN[m] / ordersPerMaand[m] : 0;
const EX = 1.21;
const BRONNEN = { Meta: 'campagne-spend-meta.json', Google: 'campagne-spend-google.json' };
const uit = {};
for (const [plat, bestand] of Object.entries(BRONNEN)) {
  let spend; try { spend = JSON.parse(fs.readFileSync(path.join(BASIS, bestand), 'utf8')); } catch { continue; }
  for (const [maand, campagnes] of Object.entries(spend)) {
    for (const [naam, v] of Object.entries(campagnes)) {
      if (!v.spend) continue;
      const buckets = MAP(naam);
      let st = null;
      if (buckets) { st = { off: 0, akk: 0 };
        for (const b of buckets) { const c = per[`${plat}|${maand}|${b}`]; if (c) { st.off += c.off; st.akk += c.akk; } } }
      let st2 = null;
      if (buckets) { st2 = { off: 0, akk: 0, omzet: 0, marge: 0 };
        for (const b of buckets) { const c = per[`${plat}|${maand}|${b}`]; if (c) { st2.off += c.off; st2.akk += c.akk; st2.omzet += c.omzet; st2.marge += c.marge; } } }
      const netto = st2 ? st2.marge / EX - st2.akk * lastenPerOrder(maand) - v.spend : null;
      (uit[maand] = uit[maand] || []).push({ platform: plat, campagne: naam, spend: v.spend,
        kliks: v.kliks ?? null, metaLeads: v.leads ?? null, cpl: v.cpl ?? null,
        offertes: st2 ? st2.off : null, akkoorden: st2 ? st2.akk : null,
        omzet: st2 ? +st2.omzet.toFixed(0) : null, marge: st2 ? +st2.marge.toFixed(0) : null,
        netto: netto !== null ? +netto.toFixed(0) : null,
        perOfferte: st2 && st2.off ? +(v.spend / st2.off).toFixed(0) : null,
        perOrder: st2 && st2.akk ? +(v.spend / st2.akk).toFixed(0) : null });
    }
  }
}
// Platform-totalen: ALLE spend van het platform tegen ALLE offertes/orders van die bron —
// dit is het zuiverste cijfer (generieke campagnes zitten er automatisch in).
const spendTot = {};
for (const [plat, bestand] of Object.entries(BRONNEN)) {
  let sp; try { sp = JSON.parse(fs.readFileSync(path.join(BASIS, bestand), 'utf8')); } catch { continue; }
  for (const [maand, cs] of Object.entries(sp))
    spendTot[`${plat}|${maand}`] = Object.values(cs).reduce((a, v) => a + (v.spend || 0), 0);
}
const platformen = {};
for (const [k, t] of Object.entries(platTot)) {
  const [plat, maand] = k.split('|');
  // Ad spend alleen bij Meta/Google; gratis bronnen krijgen 0 maar dragen wel lasten.
  const spend = spendTot[k] !== undefined ? spendTot[k] : ((plat === 'Meta' || plat === 'Google') ? undefined : 0);
  if (spend === undefined) continue;
  (platformen[plat] = platformen[plat] || {})[maand] = { spend: +spend.toFixed(0), ...t,
    omzet: +t.omzet.toFixed(0), marge: +t.marge.toFixed(0), margeEx: +(t.marge / EX).toFixed(0),
    lasten: +(t.akk * lastenPerOrder(maand)).toFixed(0),
    netto: +(t.marge / EX - t.akk * lastenPerOrder(maand) - spend).toFixed(0) };
}
const lastenInfo = Object.fromEntries(Object.keys(ordersPerMaand).sort().map(m => [m, { lasten: LASTEN[m] || null, orders: ordersPerMaand[m], perOrder: +lastenPerOrder(m).toFixed(0) }]));
fs.writeFileSync(path.join(BASIS, 'campagne-rendement.json'), JSON.stringify({ peildatum: new Date().toISOString(), lasten: lastenInfo, maanden: uit, platformen }, null, 1));
console.log('campagne-rendement.json:', Object.keys(uit).sort().join(', '));

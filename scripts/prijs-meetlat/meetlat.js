#!/usr/bin/env node
/**
 * DE PRIJS-MEETLAT (opdracht Daimy 2026-08-03).
 *
 * Doel: bewijzen dat een verbouwing van de prijscode geen enkele prijs verandert.
 * Werkwijze: elke prijsvraag die ooit in een echte offerte gesteld is, opnieuw
 * doorrekenen en de uitkomst vastleggen. Na de verbouwing nog een keer, en dan moet
 * elke cent identiek zijn.
 *
 * DEZE CODE WIJZIGT NIETS. Hij leest de backups van schijf, rekent in het geheugen en
 * schrijft één rapportbestand weg. Netwerk is hard geblokkeerd (zie engines.js), dus
 * er kan geen offerte, geen sheet en geen klantbericht door geraakt worden.
 *
 * Gebruik:
 *   node scripts/prijs-meetlat/meetlat.js --vastleggen      → nulmeting wegschrijven
 *   node scripts/prijs-meetlat/meetlat.js --vergelijk       → opnieuw meten en diffen
 *   node scripts/prijs-meetlat/meetlat.js --vergelijk --factor 1.090909
 *                                                          → verwacht dat ALLES exact
 *                                                            deze factor meebeweegt
 */
const fs = require('fs');
const path = require('path');
const E = require('./engines.js');           // blokkeert het netwerk bij het inladen
const { bouwCorpus, sleutel } = require('./corpus.js');
const { bouwRaster } = require('./raster.js');

const ARG = process.argv.slice(2);
const VASTLEGGEN = ARG.includes('--vastleggen');
const VERGELIJK = ARG.includes('--vergelijk');
const FACTOR = ARG.includes('--factor') ? Number(ARG[ARG.indexOf('--factor') + 1]) : null;
const UIT = path.join(E.ROOT, 'data', 'prijs-meetlat');
// Gezipt weggeschreven: de meting is ~29 MB onbewerkt, en die moet wel in git passen
// zodat je later kunt aantonen waartegen je gemeten hebt.
const SNAPSHOT = path.join(UIT, 'nulmeting.json.gz');
const zlib = require('zlib');
const schrijf = (p, o) => fs.writeFileSync(p, zlib.gzipSync(Buffer.from(JSON.stringify(o)), { level: 9 }));
const lees = (p) => JSON.parse(zlib.gunzipSync(fs.readFileSync(p)).toString());

const CATS = ['knikarmscherm', 'screen', 'rolluik', 'uitvalscherm', 'serre', 'pergola', 'markies'];
const BEDS = ['io', 'afstandsbediening', 'draaischakelaar', 'solar', 'solarBrel', 'handbediend'];
const eur = (n) => (n === null || n === undefined ? '—' : '€' + Number(n).toFixed(2));

/** Draait de website-motoren in een apart proces en geeft hun prijzen terug.
 *  Faalt dat, dan is dat een harde fout: stil doorgaan zou betekenen dat de meetlat
 *  groen geeft terwijl twee van de vier motoren niet gemeten zijn. */
function meetWebsite(markupOverride) {
  const args = ['--no-warnings', '--import', path.join(__dirname, 'ts-register.mjs'), path.join(__dirname, 'website-motoren.mjs')];
  if (markupOverride) args.push('--markup', String(markupOverride));
  const r = require('child_process').spawnSync(process.execPath, args, { maxBuffer: 512 * 1024 * 1024, encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout) {
    throw new Error('MEETLAT: de website-motoren konden niet gemeten worden — ' + (r.stderr || 'geen uitvoer').slice(0, 300));
  }
  return JSON.parse(r.stdout);
}

/** Doet de volledige meting. Geeft een object terug dat 1-op-1 vergelijkbaar is.
 *  markupOverride is alleen voor de zelftest — dat verandert niets op schijf. */
function meet({ markupOverride } = {}) {
  const v4 = markupOverride
    ? (() => { const api = E.laadV4Api({ markup: markupOverride }); return { naam: 'v4', markup: markupOverride, api, prijs: (v) => api.calculateCorrectPrice(v.productKey, v.breedte, v.hoogte, v.uitval, v.bedType), montage: (c, b) => api.getMontagePrice(c, b) }; })()
    : E.motorV4();
  const bot = markupOverride ? v4 : E.motorBot();
  const markiezen = E.motorMarkiezen(v4.api);
  const roma = E.motorRoma();
  const corpus = bouwCorpus(v4.api);

  // Naast de historie ook het volledige prijsboek aflopen. De historie dekt alleen wat
  // klanten besteld hebben; het raster dekt alles wat de motor gevraagd kán worden,
  // inclusief de staffelgrenzen (maat-1 en maat+1).
  const raster = bouwRaster();
  const alleVragen = [...corpus.unieke];
  const alGezien = new Set(corpus.unieke.map(sleutel));
  let rasterToegevoegd = 0;
  for (const v of raster.vragen) {
    const k = sleutel(v);
    if (alGezien.has(k)) continue;
    alGezien.add(k); alleVragen.push(v); rasterToegevoegd++;
  }

  const prijzen = {};
  const telling = { berekend: 0, geenPrijs: 0, gecrasht: 0 };
  const perSoort = {};
  const geenPrijsVoorbeelden = [];

  for (const v of alleVragen) {
    const k = sleutel(v);
    const soort = v.soort || 'sunmaster';
    perSoort[soort] = perSoort[soort] || { totaal: 0, metPrijs: 0 };
    perSoort[soort].totaal++;

    let hoofd = null, tweede = null, fout = null;
    try {
      if (soort === 'roma') hoofd = roma.prijs(v);
      else if (soort === 'markies') hoofd = markiezen.prijs(v);
      else { hoofd = v4.prijs(v); tweede = bot.prijs(v); }
    } catch (e) { fout = e.message; }

    if (fout) { telling.gecrasht++; prijzen[k] = { fout }; continue; }
    if (hoofd === null) {
      telling.geenPrijs++;
      if (geenPrijsVoorbeelden.length < 15) geenPrijsVoorbeelden.push({ ...v });
    } else {
      telling.berekend++;
      perSoort[soort].metPrijs++;
    }
    // 'bot' alleen gevuld voor Sunmaster: markiezen en Roma lopen bij de bot via dezelfde
    // functies, daar valt niets aparts te vergelijken.
    prijzen[k] = { v4: hoofd, bot: soort === 'sunmaster' ? tweede : hoofd, soort, kop: v._kop };
  }

  // De twee website-motoren draaien in een los proces (TypeScript + @/-imports).
  // Zonder dit deel zou de meetlat alleen v4 en de bot bewijzen, terwijl juist de
  // configurator en de offerte-tool zichtbaar zijn voor klanten.
  const web = meetWebsite(markupOverride);
  for (const [k, v] of Object.entries(web.offerteTool || {})) prijzen['web|' + k] = { v4: v, bot: v, soort: 'offerte-tool' };
  for (const [k, v] of Object.entries(web.configurator || {})) prijzen['web|' + k] = { v4: v, bot: v, soort: 'configurator' };
  perSoort['offerte-tool'] = { totaal: Object.keys(web.offerteTool || {}).length, metPrijs: Object.values(web.offerteTool || {}).filter((x) => Array.isArray(x) ? x[0] > 0 : x > 0).length };
  perSoort['configurator'] = { totaal: Object.keys(web.configurator || {}).length, metPrijs: Object.values(web.configurator || {}).filter((x) => x > 0).length };

  // Montageprijzen horen er ook bij: die zitten in dezelfde motor en zijn even fout-gevoelig.
  const montage = {};
  for (const c of CATS) for (const b of BEDS) {
    try { montage[`${c}|${b}`] = v4.montage(c, b); } catch { montage[`${c}|${b}`] = 'FOUT'; }
  }

  return {
    gemetenOp: new Date().toISOString(),
    corpus: {
      bestandenGevonden: corpus.bestandenGevonden,
      bestandenGelezen: corpus.bestandenGelezen,
      bestandenZonderRegels: corpus.bestandenZonderRegels,
      regelsBekeken: corpus.regelsBekeken,
      uniekePrijsvragenUitHistorie: corpus.unieke.length,
      extraUitPrijsboekRaster: rasterToegevoegd,
      totaalGemeten: alleVragen.length,
      overgeslagen: corpus.overgeslagen,
    },
    telling,
    perSoort,
    geenPrijsVoorbeelden,
    markups: {
      v4: v4.markup,
      bot: bot.markup,
      roma: roma.opslag,
      regressietest: E.markupVanRegressietest(),
      ...E.markupsWebsite(),
    },
    ingebakken: [
      E.ingebakkenMarkup('rolluik-s37-prijstabel.json', 'rolluikS37.table'),
      E.ingebakkenMarkup('zipscreen-prijstabel.json', 'zipSquare85100.table'),
      E.ingebakkenMarkup('screen-square85-prijstabel.json', 'screenSquare85100.table'),
    ],
    montage,
    prijzen,
  };
}

/** Zet twee metingen naast elkaar. factor=null → alles moet identiek zijn. */
function vergelijk(oud, nieuw, factor) {
  const alle = new Set([...Object.keys(oud.prijzen), ...Object.keys(nieuw.prijzen)]);
  const uit = { vergeleken: 0, gelijk: 0, afwijkend: [], verdwenen: [], nieuw: [] };

  for (const k of alle) {
    const a = oud.prijzen[k], b = nieuw.prijzen[k];
    if (!b) { uit.verdwenen.push(k); continue; }
    if (!a) { uit.nieuw.push(k); continue; }
    if (a.fout || b.fout) {
      if (String(a.fout) !== String(b.fout)) uit.afwijkend.push({ k, oud: a.fout, nieuw: b.fout, soort: 'fout veranderd' });
      continue;
    }
    uit.vergeleken++;
    // 1 cent speling bij een factor: afronding van boekprijs × opslag kan een cent schelen.
    const speling = factor ? 0.011 : 0;
    const gelijkGetal = (oud, nu, meeBewegen) => {
      if (oud === null || oud === undefined) return nu === null || nu === undefined;
      if (typeof nu !== 'number') return false;
      const verw = factor && meeBewegen ? Math.round(oud * factor * 100) / 100 : oud;
      return Math.abs(nu - verw) <= speling;
    };

    let ok;
    if (Array.isArray(a.v4)) {
      // offerte-tool: [totaal, productPrijs, kleurMeerprijs, montagePrijs].
      // Bij --factor hoort de montage NIET mee te bewegen, de rest wel.
      ok = Array.isArray(b.v4) && a.v4.every((x, i) => gelijkGetal(x, b.v4[i], i !== 3));
    } else {
      ok = gelijkGetal(a.v4, b.v4, true) && b.bot === b.v4; // bot en v4 horen hetzelfde te zeggen
    }
    if (ok) { uit.gelijk++; continue; }
    uit.afwijkend.push({
      k, kop: a.kop, soort: a.soort,
      oudV4: a.v4, nieuwV4: b.v4, nieuwBot: b.bot,
    });
  }
  return uit;
}

function toonMeting(m) {
  const c = m.corpus;
  console.log('CORPUS');
  console.log(`  backupbestanden (2026)   ${c.bestandenGevonden}`);
  console.log(`  daarvan gelezen          ${c.bestandenGelezen}${c.bestandenGelezen === c.bestandenGevonden ? '  (alles)' : '  ⚠️ NIET ALLES'}`);
  console.log(`  offerteregels bekeken    ${c.regelsBekeken}`);
  console.log(`  prijsvragen uit historie ${c.uniekePrijsvragenUitHistorie}`);
  console.log(`  extra uit prijsboek-raster ${c.extraUitPrijsboekRaster}`);
  console.log(`  TOTAAL GEMETEN           ${c.totaalGemeten}`);
  console.log('  overgeslagen regels:');
  for (const [r, n] of Object.entries(c.overgeslagen).sort((a, b) => b[1] - a[1])) console.log(`     ${String(n).padStart(6)}  ${r}`);
  console.log('\nPER LEVERANCIER');
  for (const [s, t] of Object.entries(m.perSoort || {})) console.log(`  ${s.padEnd(24)} ${t.metPrijs}/${t.totaal} met prijs`);
  console.log('\nBEREKEND');
  console.log(`  prijs gevonden           ${m.telling.berekend}`);
  console.log(`  geen prijs (buiten tabel) ${m.telling.geenPrijs}`);
  console.log(`  gecrasht                 ${m.telling.gecrasht}`);
  console.log('\nOPSLAGEN DIE NU IN DE CODE STAAN');
  for (const [k, v] of Object.entries(m.markups)) console.log(`  ${k.padEnd(34)} ${v}`);
  console.log('\nINGEBAKKEN OPSLAG IN DE CONFIGURATOR-TABELLEN');
  for (const t of m.ingebakken) {
    console.log(`  ${t.bestand.padEnd(34)} factor ${t.factor ?? '?'} over ${t.vergeleken ?? 0} cellen` +
      (t.nietInBoek ? ` (${t.nietInBoek} cellen niet in boek)` : ''));
  }
}

/**
 * ZELFTEST — bewijst dat de meetlat een verandering écht ziet.
 *
 * Dit is het belangrijkste stuk. Een meetlat die altijd groen geeft bewijst niets, en
 * die fout zou onzichtbaar blijven. Daarom: meet één keer normaal, meet één keer met de
 * opslag opzettelijk op 1,20, en eis dat vrijwel élke Sunmaster-prijs als afwijking
 * gemeld wordt. Gebeurt dat niet, dan deugt de meetlat niet en mag hij niet gebruikt worden.
 * De opslag wordt alleen in het geheugen aangepast; op schijf verandert er niets.
 */
function zelftest() {
  console.log('ZELFTEST — ziet de meetlat een prijswijziging?\n');
  const normaal = meet();
  const verstoord = meet({ markupOverride: 1.20 });

  const d = vergelijk(normaal, verstoord, null);
  const gemeldPer = {};
  for (const a of d.afwijkend) gemeldPer[a.soort || '?'] = (gemeldPer[a.soort || '?'] || 0) + 1;

  // Per motor: hoeveel Sunmaster-prijzen zitten erin, en hoeveel zag de meetlat bewegen.
  const telPer = {};
  for (const [k, p] of Object.entries(normaal.prijzen)) {
    const w = Array.isArray(p.v4) ? p.v4[0] : p.v4;
    if (w === null || w === undefined || w <= 0) continue;
    telPer[p.soort] = (telPer[p.soort] || 0) + 1;
  }

  console.log('  motor                 prijzen   gezien bewegen');
  for (const s of Object.keys(telPer).sort()) {
    console.log(`  ${s.padEnd(20)} ${String(telPer[s]).padStart(7)}   ${String(gemeldPer[s] || 0).padStart(7)}`);
  }

  // Wat MOET bewegen bij een Sunmaster-opslag van 1,10 → 1,20:
  //   v4, bot en de Sunmaster-producten in de offerte-tool.
  // Wat NIET mag bewegen: markiezen en Roma (eigen prijsbasis).
  const moet = (gemeldPer['sunmaster'] || 0) >= Math.floor((telPer['sunmaster'] || 0) * 0.99);
  const magNiet = (gemeldPer['markies'] || 0) === 0 && (gemeldPer['roma'] || 0) === 0;
  const otBeweegt = (gemeldPer['offerte-tool'] || 0) > 0;
  const cfBeweegt = (gemeldPer['configurator'] || 0) > 0;
  const geslaagd = moet && magNiet && otBeweegt;

  console.log('\n' + '═'.repeat(64));
  if (geslaagd) {
    console.log('✅ ZELFTEST GESLAAGD — de meetlat ziet een prijswijziging in v4, de bot én de offerte-tool,');
    console.log('   en meldt géén valse afwijkingen bij markiezen en Roma (die horen niet mee te bewegen).');
  } else {
    console.log('❌ ZELFTEST GEFAALD — de meetlat is niet betrouwbaar, niet gebruiken als bewijs.');
  }
  if (!cfBeweegt) {
    console.log('\n⚠️  DE CONFIGURATOR BEWOOG NIET MEE, en dat is geen fout in de meetlat.');
    console.log('   De opslag is daar ingebakken in de prijstabellen, dus rekenConfig omzetten');
    console.log('   verandert er niets. Wie alleen de config aanpast, laat de hele configurator');
    console.log('   op de oude prijs staan. Dit is precies waarvoor de meetlat er is.');
  }
  process.exit(geslaagd ? 0 : 1);
}

function main() {
  fs.mkdirSync(UIT, { recursive: true });
  if (ARG.includes('--zelftest')) return zelftest();
  if (!VASTLEGGEN && !VERGELIJK) {
    console.log('Gebruik:');
    console.log('  --zelftest      controleert of de meetlat een wijziging ziet (doe dit eerst)');
    console.log('  --vastleggen    nulmeting wegschrijven');
    console.log('  --vergelijk     opnieuw meten en diffen  [--factor 1.090909]');
    console.log('\nDeze code wijzigt nooit iets: netwerk geblokkeerd, alleen-lezen.');
    process.exit(1);
  }

  console.log('MEETLAT — netwerk geblokkeerd, alleen-lezen\n');
  const m = meet();
  toonMeting(m);

  if (VASTLEGGEN) {
    schrijf(SNAPSHOT, m);
    console.log(`\n✅ NULMETING VASTGELEGD: ${m.telling.berekend + m.telling.geenPrijs} prijsvragen`);
    console.log(`   ${path.relative(E.ROOT, SNAPSHOT)}`);
    console.log('   Bewaar dit bestand. Hier wordt straks tegenaan gemeten.');
    return;
  }

  if (!fs.existsSync(SNAPSHOT)) { console.error('\n❌ Geen nulmeting gevonden. Draai eerst --vastleggen.'); process.exit(1); }
  const oud = lees(SNAPSHOT);
  const d = vergelijk(oud, m, FACTOR);

  console.log('\n' + '─'.repeat(64));
  console.log(FACTOR ? `VERGELIJKING — alles moet exact ×${FACTOR} zijn` : 'VERGELIJKING — alles moet tot op de cent identiek zijn');
  console.log(`  nulmeting van            ${oud.gemetenOp}`);
  console.log(`  vergeleken               ${d.vergeleken}`);
  console.log(`  gelijk                   ${d.gelijk}`);
  console.log(`  afwijkend                ${d.afwijkend.length}`);
  console.log(`  verdwenen t.o.v. eerder  ${d.verdwenen.length}`);
  console.log(`  nieuw t.o.v. eerder      ${d.nieuw.length}`);

  if (d.afwijkend.length) {
    console.log('\nEERSTE 25 AFWIJKINGEN:');
    for (const a of d.afwijkend.slice(0, 25)) {
      console.log(`  ${String(a.soort || '?').padEnd(16)} ${a.k}`);
      console.log(`      was ${JSON.stringify(a.oudV4)}  →  nu ${JSON.stringify(a.nieuwV4)}`);
    }
  }

  const rapport = path.join(UIT, 'vergelijking.json');
  // Alleen de eerste 500 afwijkingen bewaren; bij een echte fout zijn het er duizenden
  // en dan is het rapport zelf onhanteerbaar. Het aantal staat er wel volledig in.
  fs.writeFileSync(rapport, JSON.stringify({ factor: FACTOR, nulmeting: oud.gemetenOp, nu: m.gemetenOp, ...d, afwijkend: d.afwijkend.slice(0, 500), afwijkendTotaal: d.afwijkend.length }, null, 1));

  const compleet = d.verdwenen.length === 0 && d.nieuw.length === 0;
  const schoon = d.afwijkend.length === 0 && compleet;
  console.log('\n' + '═'.repeat(64));
  if (schoon) console.log(`✅ GOEDGEKEURD — ${d.gelijk} van ${d.vergeleken} prijsvragen kloppen, geen enkele afwijking.`);
  else console.log(`❌ AFGEKEURD — ${d.afwijkend.length} afwijkingen${compleet ? '' : `, en het corpus is niet gelijk gebleven (${d.verdwenen.length} verdwenen, ${d.nieuw.length} nieuw)`}. Niet uitrollen.`);
  console.log(`Rapport: ${path.relative(E.ROOT, rapport)}`);
  process.exit(schoon ? 0 : 1);
}

if (require.main === module) main();
module.exports = { meet, vergelijk };

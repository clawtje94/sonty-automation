#!/usr/bin/env node
// Eenmalig: goedgekeurde verkoopteksten toepassen op alle Gecontroleerd items
// Gebruikt exact dezelfde logica als cron-offerte-controle-v3.js (2026-06-10)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BACKLOG_ID = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const GECONTROLEERD = 'c860c5ae-7eef-45cc-8e79-3b4bcd285b7a';

const WAAROM_SONTY_TEXT = '**Waarom Sonty?**\n\n- Sunmaster Premium Dealer: wij leveren uitsluitend A-merk zonwering van de hoogste kwaliteit\n- Eigen montageteam: al onze monteurs zijn in dienst, geen onderaannemers\n- Persoonlijk advies: gratis inmeetafspraak bij u thuis\n- 3000+ tevreden klanten\n- 4.9/5.0 op Google met 500+ reviews\n- Alles uit eigen hand: van advies tot montage en nazorg';

async function rpGet(ep) {
  const res = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: { 'Authorization': 'Bearer ' + RP_API_KEY } });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

function getCategory(firstLine) {
  const d = firstLine.toLowerCase();
  if (d.includes('montage') || d.includes('inmeten') || d.includes('tahoma') || d.includes('eolis') || d.includes('connectivity')) return null;
  if (d.includes('rolluik')) return 'rolluik';
  if (d.includes('zip design') || d.includes('square') || d.includes('zipscreen')) return 'screen';
  if (d.includes('sunproject') || d.includes('suncube')) return 'uitvalscherm';
  if (d.includes('suneye') || d.includes('sunbasic') || d.includes('sunelite') || d.includes('knikarm')) return 'knikarmscherm';
  if (d.includes('pergola')) return 'pergola';
  if (d.includes('suncontrol') || d.includes('serre')) return 'serre';
  return null;
}

function getBedType(bediening, motor) {
  const b = (bediening || '').toLowerCase();
  const m = (motor || '').toLowerCase();
  if (b.includes('solar') || b.includes('brel') || m.includes('solar') || m.includes('brel')) return 'solar';
  if (b.includes('draaischakelaar') || m.includes('somfy lt')) return 'draaischakelaar';
  if (b.includes('slingerstang') || b.includes('handbediend')) return 'handbediend';
  return 'bedraad';
}

function extractField(desc, field) {
  const m = desc.match(new RegExp(field + ':\\s*([^\\n]+)', 'i'));
  return m ? m[1].trim() : '';
}

function getWaaromBlock(firstLine, cat, bedType) {
  const fl = firstLine.toLowerCase();
  const isSolar = bedType === 'solar';
  const isDraai = bedType === 'draaischakelaar';
  const isHand = bedType === 'handbediend';

  if (cat === 'rolluik') {
    const b = ['Waarom dit rolluik:',
      '- Sunmaster RollSUPER: premium kwaliteit, Nederlands geproduceerd',
      '- Dubbelwandige aluminium lamellen met PU-schuim voor isolatie'];
    if (isSolar) b.push('- Op zonne-energie: geen bekabeling nodig, volledig draadloos', '- Geen elektricien nodig: bespaart op installatiekosten');
    else if (isDraai) b.push('- Somfy motor met vaste draaischakelaar op de muur');
    else b.push('- Fluisterstille Somfy motor met afstandsbediening');
    b.push('- Bescherming tegen inbraak, zon, warmte en kou');
    return b;
  }
  if (cat === 'screen') {
    const b = ['Waarom dit screen:',
      '- Sunmaster screen: premium kwaliteit met zip-technologie',
      '- Ritsgeleidingssysteem: doek zit vast in de geleiders, geen klapperen bij wind'];
    if (isSolar) b.push('- Op zonne-energie: geen bekabeling nodig, volledig draadloos');
    else if (isDraai) b.push('- Somfy motor met vaste draaischakelaar op de muur');
    else b.push('- Fluisterstille Somfy motor met afstandsbediening');
    b.push('- Bescherming tegen zon, warmte en inkijk met behoud van uitzicht');
    b.push('- Compacte cassette: doek en motor beschermd tegen weersinvloeden');
    return b;
  }
  if (cat === 'knikarmscherm') {
    const b = ['Waarom dit knikarmscherm:'];
    if (fl.includes('sunelite')) {
      b.push('- Sunmaster Sunelite: knikarmscherm uit het hoogste segment');
      b.push('- Volledig gesloten cassette: doek en mechaniek maximaal beschermd');
    } else if (fl.includes('suneye')) {
      b.push('- Sunmaster Suneye: premium knikarmscherm met gesloten cassette');
      if (fl.includes('voorraad')) b.push('- Direct leverbaar uit voorraad: snellere levertijd dan maatwerk');
      b.push('- Gesloten cassette: doek en mechaniek volledig beschermd');
    } else {
      b.push('- Sunmaster knikarmscherm: premium kwaliteit, Nederlands geproduceerd');
    }
    b.push('- Sterke aluminium armen: lang meegaand en stabiel');
    if (isHand) b.push('- Bediening via slingerstang aan de buitenzijde', '- Geen motor of elektra nodig: eenvoudige installatie');
    else if (isDraai) b.push('- Somfy motor met vaste draaischakelaar op de muur');
    else b.push('- Fluisterstille Somfy motor met afstandsbediening');
    return b;
  }
  if (cat === 'uitvalscherm') {
    const b = ['Waarom dit uitvalscherm:',
      '- Sunmaster uitvalscherm: compact en stijlvol'];
    if (isHand) b.push('- Bediening via slingerstang aan de buitenzijde', '- Geen motor of elektra nodig');
    else if (isSolar) b.push('- Op zonne-energie: geen bekabeling nodig, volledig draadloos');
    else if (isDraai) b.push('- Somfy motor met vaste draaischakelaar op de muur');
    else b.push('- Fluisterstille Somfy motor met afstandsbediening');
    b.push('- Bescherming tegen directe zonnestraling en warmte');
    return b;
  }
  if (cat === 'pergola') {
    return ['Waarom deze pergola:',
      '- Sunmaster Pergola: terrasoverkapping met waterdicht doek',
      '- Beschermd tegen zon en regen: uw terras het hele jaar bruikbaar',
      '- Stevig aluminium frame: duurzaam en onderhoudsarm',
      '- Gemotoriseerd: doek in- en uitrollen met afstandsbediening'];
  }
  if (cat === 'serre') {
    return ['Waarom deze serre zonwering:',
      '- Sunmaster Suncontrol: speciaal ontworpen voor glazen daken en serres',
      '- Houdt warmte buiten: aangenaam klimaat in uw serre',
      '- Stevig aluminium frame met strakke afwerking',
      '- Fluisterstille Somfy motor met afstandsbediening'];
  }
  return null;
}

function insertWaaromBlock(desc, waaromLines) {
  let lines = desc.split('\n');
  const oldIdx = lines.findIndex(l => /^Waarom (dit|deze) .+:$/.test(l.trim()) || l.trim().startsWith('Wat u krijgt'));
  if (oldIdx >= 0) {
    const garIdx = lines.findIndex((l, i) => i > oldIdx && l.trim().startsWith('Garantie'));
    lines.splice(oldIdx, garIdx >= 0 ? garIdx - oldIdx : lines.length - oldIdx);
  }
  const gi = lines.findIndex(l => l.trim().startsWith('Garantie'));
  const insertAt = gi >= 0 ? gi : lines.length;
  lines.splice(insertAt, 0, '', ...waaromLines, '');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

function enhanceTahoma(desc) {
  const title = desc.split('\n')[0].replace(/^\*\*|\*\*$/g, '');
  return title + '\n- Automatiseren van je Somfy producten\n- Producten bedienen waar je ook bent met de telefoon\n- Inclusief installatie en uitleg\n- Al uw smart home producten op 1 app (zoals Philips Hue)';
}

function enhanceEolis(desc) {
  const title = desc.split('\n')[0].replace(/^\*\*|\*\*$/g, '');
  return title + '\n- Automatische windbeveiliging\n- Zonwering rolt automatisch in bij harde wind\n- Ingebouwd in de voorlijst\n- Werkt draadloos samen met uw Somfy motor';
}

function enhanceAllDescriptions(lines) {
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    const fl = (lines[i].description?.split('\n')[0] || '').replace(/^\*\*|\*\*$/g, '').toLowerCase();
    const orig = lines[i].description;
    if (fl.includes('montage') || fl.includes('inmeten')) {
      continue;
    } else if (fl.includes('tahoma')) {
      lines[i].description = enhanceTahoma(lines[i].description);
    } else if (fl.includes('eolis')) {
      lines[i].description = enhanceEolis(lines[i].description);
    } else if (fl.includes('connectivity')) {
      continue;
    } else if (lines[i].pricePerUnit > 0) {
      const cat = getCategory(fl);
      if (cat) {
        const bediening = extractField(lines[i].description, 'Bediening');
        const motor = extractField(lines[i].description, 'Motor');
        const bedType = getBedType(bediening, motor);
        const waarom = getWaaromBlock(fl, cat, bedType);
        if (waarom) {
          lines[i].description = insertWaaromBlock(lines[i].description, waarom);
        }
      }
    }
    if (lines[i].description !== orig) changed = true;
  }
  return changed;
}

function addWaaromSontyBlock(qd) {
  for (const seg of Object.values(qd.segments || {})) {
    if (seg?.type === 'text' && typeof seg.data === 'string' && seg.data.includes('Waarom Sonty')) return false;
  }
  const textId = crypto.randomUUID();
  qd.segments[textId] = { type: 'text', data: WAAROM_SONTY_TEXT };
  const sigIdx = (qd.renderRows || []).findIndex(r => r.columns?.some(c => c.elements?.some(e => e.type === 'signature' || e.type === 'userDecline')));
  const insertAt = sigIdx >= 0 ? sigIdx : qd.renderRows.length;
  qd.renderRows.splice(insertAt, 0,
    { delegateMargins: false, widths: [100], columns: [{ elements: [{ type: 'empty', target: '2lh' }] }] },
    { delegateMargins: false, widths: [100], columns: [{ elements: [{ type: 'text', target: textId }] }] },
    { delegateMargins: false, widths: [100], columns: [{ elements: [{ type: 'empty', target: '2lh' }] }] }
  );
  return true;
}

async function main() {
  const res = await rpGet('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items');
  const gcItems = (res?.items || []).filter(i =>
    i.status_id === GECONTROLEERD && !i.technical_labels?.some(l => l.type === 'ITEM_ARCHIVED')
  );
  console.log('Gecontroleerd items: ' + gcItems.length);

  const backupDir = path.join(__dirname, '../data/offerte-backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  let ok = 0, skip = 0, fail = 0;

  for (const item of gcItems) {
    const lcId = item.item_subject?.id;
    if (!lcId) { skip++; continue; }
    const docData = await rpGet('/document-service/v1/' + PID + '/quotations?lead_configuration_id=' + lcId);
    const docs = docData?.quotationDatas || [];
    docs.sort((a, b) => (b.quotationCreationTimestamp || 0) - (a.quotationCreationTimestamp || 0));
    if (!docs[0]) { skip++; continue; }

    const full = await rpGet('/document-service/v1/' + PID + '/quotations/' + docs[0].documentId);
    const qd = full?.quotationData;
    const lines = qd?.segments?.defaultTemplatePriceLineGroup?.data?.lines;
    if (!lines) { skip++; continue; }

    // Backup (alleen eerste keer)
    const backupFile = path.join(backupDir, docs[0].quotationNumber + '-pre-enhance.json');
    if (!fs.existsSync(backupFile)) {
      fs.writeFileSync(backupFile, JSON.stringify({ name: item.summary, lines: JSON.parse(JSON.stringify(lines)) }, null, 2));
    }

    let changed = false;

    // Waarom blokken + tahoma/eolis
    if (enhanceAllDescriptions(lines)) changed = true;

    // Bold titels
    for (const l of lines) {
      const firstLine = l.description?.split('\n')[0] || '';
      if (!firstLine.startsWith('**') && l.pricePerUnit > 0) {
        const clean = firstLine.replace(/^\*\*|\*\*$/g, '');
        l.description = '**' + clean + '**' + l.description.substring(firstLine.length);
        changed = true;
      }
    }

    // Waarom Sonty blok
    if (addWaaromSontyBlock(qd)) changed = true;

    if (!changed) { console.log('SKIP #' + docs[0].quotationNumber + ' ' + item.summary + ' (geen wijzigingen)'); skip++; continue; }

    const saveRes = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + PID + '/quotations/' + docs[0].documentId, {
      method: 'PUT', headers: { 'Authorization': 'Bearer ' + RP_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(qd),
    });
    if (saveRes.ok) { console.log('OK #' + docs[0].quotationNumber + ' ' + item.summary); ok++; }
    else { console.log('FAIL #' + docs[0].quotationNumber + ' ' + item.summary + ' (' + saveRes.status + ')'); fail++; }
  }

  console.log('\nKlaar: ' + ok + ' aangepast, ' + skip + ' overgeslagen, ' + fail + ' fouten');
}

main().catch(console.error);

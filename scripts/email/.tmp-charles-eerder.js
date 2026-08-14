// EENMALIG, ALLEEN-LEZEN (Daimy 14-08): kan Charles Gevers (Bilthoven) eerder dan ma 21 sep?
// Leest agenda's en rekent sloten door. Boekt niets, stuurt niets.
const p = require('../cron-inmeten-planner.js');
const { zoekSlots, kiesAanbod, venster } = require('../lib/slotzoeker');

(async () => {
  await p.laadVakanties?.();
  const agenda = await p.haalAgenda();
  const ADRES = 'Gerard Terborchlaan 13, 3723EJ Bilthoven';
  const GRENS = new Date('2026-09-21T00:00:00');
  for (const naam of ['Sjoerd', 'Joey']) {
    const slots = await zoekSlots({ agenda: agenda[naam], adres: ADRES, duurMin: 20, werkdagen: p.werkdagenVoor(naam, 26) });
    const eerder = slots.filter((s) => s.aankomst < GRENS).sort((a, b) => a.aankomst - b.aankomst);
    console.log(`\n=== ${naam}: ${eerder.length} slot(en) vóór 21 sep`);
    for (const s of eerder.slice(0, 6)) {
      console.log(`  ${venster(s)} — extra rijtijd +${s.extraRijtijdMin ?? s.omrijMin ?? '?'} min`);
    }
    const top = kiesAanbod(eerder, 3, { negeerGrens: true });
    if (top.length) console.log('  beste keuzes:', top.map((s) => venster(s)).join(' | '));
  }
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });

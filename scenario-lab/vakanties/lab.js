// Scenario-lab vakanties-collect: gegenereerde Outlook-events met bekend antwoord (orakel).
// Bakken: hele dag (all-day / meerdaags / 1-uur-marker), deel dag, geen genodigde,
// naam alleen in onderwerp, geannuleerd, niet-vakantie, zomer/wintertijd, samenvoegen.
const { verwerk } = require('../../scripts/vakanties-collect.js');
let seed = 42; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const NAMEN = ['Sjoerd Hoogduin | Sonty', 'Joey Engelen | Sonty', 'Yudi den Heijer', 'Mick | Sonty', 'Nanny van Vliet', 'ZZP 1'];
const pad = (n) => String(n).padStart(2, '0');
function utc(datum, uur, min = 0) { // NL-lokaal → UTC-string zoals Outlook die geeft
  const d = new Date(datum + 'T' + pad(uur) + ':' + pad(min) + ':00');
  const off = -new Date(new Date(datum + 'T12:00:00Z').toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })).getTimezoneOffset; // niet gebruikt
  // bepaal offset via Intl
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Amsterdam', timeZoneName: 'shortOffset' }).formatToParts(new Date(datum + 'T12:00:00Z')).find(p => p.type === 'timeZoneName').value;
  const h = +(f.match(/[+-]\d+/) || [0])[0];
  const t = Date.UTC(+datum.slice(0, 4), +datum.slice(5, 7) - 1, +datum.slice(8, 10), uur - h, min);
  return new Date(t).toISOString().slice(0, 19) + '.0000000';
}
function dagPlus(d, n) { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
const bak = {}; let fouten = 0, crashes = 0, totaal = 0;
function test(naamBak, ev, verwacht) {
  totaal++; bak[naamBak] = bak[naamBak] || { n: 0, fout: 0 }; bak[naamBak].n++;
  let uit;
  try { uit = verwerk([ev], new Set()); } catch (e) { crashes++; bak[naamBak].fout++; console.log('CRASH', naamBak, e.message); return; }
  const it = uit[0];
  const ok = verwacht === null ? uit.length === 0
    : it && it.wie === verwacht.wie && it.van === verwacht.van && it.tot === verwacht.tot && it.heleDag === verwacht.heleDag
      && (verwacht.controle === undefined || (it.controle.length > 0) === verwacht.controle);
  if (!ok) { fouten++; bak[naamBak].fout++; if (bak[naamBak].fout <= 2) console.log('FOUT', naamBak, JSON.stringify({ ev: ev.Subject, s: ev.Start.DateTime, e: ev.End.DateTime, verwacht, kreeg: it && { wie: it.wie, van: it.van, tot: it.tot, heleDag: it.heleDag, controle: it.controle } })); }
}
const att = (n) => [{ EmailAddress: { Name: 'Sonty' } }, { EmailAddress: { Name: n } }];
const schoon = (n) => n.replace(/\s*\|\s*Sonty$/, '');
for (let i = 0; i < 700; i++) {
  const naam = pick(NAMEN);
  const maand = 1 + Math.floor(rnd() * 12), dag = 1 + Math.floor(rnd() * 27);
  const datum = `2026-${pad(maand)}-${pad(dag)}`;
  const soort = i % 10;
  if (soort === 0) { // all-day 1..5 dagen
    const n = 1 + Math.floor(rnd() * 5);
    test('allday', { Id: 'a' + i, Subject: 'Vakantie', IsAllDay: true, Attendees: att(naam), Start: { DateTime: datum + 'T00:00:00.0000000' }, End: { DateTime: dagPlus(datum, n) + 'T00:00:00.0000000' } },
      { wie: schoon(naam), van: datum, tot: dagPlus(datum, n - 1), heleDag: true });
  } else if (soort === 1) { // meerdaags 08:00 → +n dagen 17:00
    const n = 1 + Math.floor(rnd() * 20);
    test('meerdaags', { Id: 'b' + i, Subject: 'Vakantie', Attendees: att(naam), Start: { DateTime: utc(datum, 8) }, End: { DateTime: utc(dagPlus(datum, n), 17) } },
      { wie: schoon(naam), van: datum, tot: dagPlus(datum, n), heleDag: true });
  } else if (soort === 2) { // 1-uur-marker 's ochtends = hele dag
    const u = 7 + Math.floor(rnd() * 3);
    test('marker-1u', { Id: 'c' + i, Subject: pick(['Vakantie', 'Montage Sonty - Yudi vrij', 'Vakantie - SJOERD VRIJ']), Attendees: att(naam), Start: { DateTime: utc(datum, u) }, End: { DateTime: utc(datum, u + 1) } },
      { wie: schoon(naam), van: datum, tot: datum, heleDag: true });
  } else if (soort === 3) { // middag = deel van de dag
    test('deeldag', { Id: 'd' + i, Subject: 'Vakantie', Attendees: att(naam), Start: { DateTime: utc(datum, 15) }, End: { DateTime: utc(datum, 17) } },
      { wie: schoon(naam), van: datum, tot: datum, heleDag: false });
  } else if (soort === 4) { // geen genodigde, geen naam
    test('geen-genodigde', { Id: 'e' + i, Subject: 'Vakantie', Attendees: [{ EmailAddress: { Name: 'Sonty' } }], Start: { DateTime: utc(datum, 8) }, End: { DateTime: utc(dagPlus(datum, 2), 17) } },
      { wie: 'Onbekend', van: datum, tot: dagPlus(datum, 2), heleDag: true, controle: true });
  } else if (soort === 5) { // naam alleen in onderwerp
    test('naam-in-onderwerp', { Id: 'f' + i, Subject: 'Telefonisch advies - djo VAKANTIE', Attendees: [], Start: { DateTime: utc(datum, 8) }, End: { DateTime: utc(datum, 17) } },
      { wie: 'Joey Engelen', van: datum, tot: datum, heleDag: true, controle: true });
  } else if (soort === 6) { // geannuleerd
    test('geannuleerd', { Id: 'g' + i, Subject: 'Vakantie', IsCancelled: true, Attendees: att(naam), Start: { DateTime: utc(datum, 8) }, End: { DateTime: utc(datum, 17) } }, null);
  } else if (soort === 7) { // gewone afspraak, geen vakantie ("vrijdag" mag niet matchen)
    test('geen-vakantie', { Id: 'h' + i, Subject: pick(['Inmeten - Jansen', 'Montage vrijdag', 'Bevrijdingsdag borrel', 'Service - Vries']), Attendees: att(naam), Start: { DateTime: utc(datum, 8) }, End: { DateTime: utc(datum, 10) } }, null);
  } else if (soort === 8) { // onderwerp noemt andere naam dan genodigde
    test('naam-wijkt-af', { Id: 'i' + i, Subject: 'Vakantie - TYGO MAGAZIJN', Attendees: att('Mick | Sonty'), Start: { DateTime: utc(datum, 8) }, End: { DateTime: utc(datum, 14) } },
      { wie: 'Mick', van: datum, tot: datum, heleDag: true, controle: true });
  } else { // samenvoegen: twee aansluitende all-day items → 1 periode
    totaal++; bak.samenvoegen = bak.samenvoegen || { n: 0, fout: 0 }; bak.samenvoegen.n++;
    const evs = [0, 1].map((k) => ({ Id: 'j' + i + k, Subject: 'Vakantie - Disney', IsAllDay: true, Attendees: att(naam), Start: { DateTime: dagPlus(datum, k) + 'T00:00:00.0000000' }, End: { DateTime: dagPlus(datum, k + 1) + 'T00:00:00.0000000' } }));
    try {
      const uit = verwerk(evs, new Set());
      if (!(uit.length === 1 && uit[0].van === datum && uit[0].tot === dagPlus(datum, 1) && uit[0].bronnen === 2)) { fouten++; bak.samenvoegen.fout++; if (bak.samenvoegen.fout <= 2) console.log('FOUT samenvoegen', JSON.stringify(uit)); }
    } catch (e) { crashes++; bak.samenvoegen.fout++; console.log('CRASH samenvoegen', e.message); }
  }
}
console.log(`scenario's: ${totaal}, fouten: ${fouten}, crashes: ${crashes}`);
for (const [k, v] of Object.entries(bak)) console.log(`  ${k.padEnd(18)} ${v.n} scenario's, ${v.fout} fout`);
process.exitCode = fouten || crashes ? 1 : 0;

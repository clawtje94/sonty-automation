#!/usr/bin/env node
// GESPREK-LAB (Daimy 10-08: "je bent steeds shit aan het doen die het alleen maar
// slechter maakt").
//
// Het scenario-lab test de MOTOR: rijtijden, staffels, slotgrenzen. Honderden scenario's,
// keurig groen. Maar in veertien dagen kwam vrijwel elke echte fout uit het GESPREK:
// Rita kreeg een boeking op een klacht, Eric een tweede voorstel terwijl hij al stond,
// Rick geen antwoord, Connie een woensdag die ze net had afgezegd. Daar was geen enkele
// test voor. Elke fout moest door een echte klant gevonden worden, en dat is precies
// één klant te laat.
//
// Dit lab draait de beslisketen over ECHTE gesprekken uit Trengo en vraagt bij elk
// klantbericht: wat zou het systeem nu doen, en had dat gemogen?
//
//   FOUT-BOEKING  het systeem zou boeken terwijl het laatste woord van de klant geen
//                 kale instemming is (het geval Connie/Rita)
//   FOUT-STIL     de klant schreef iets en kreeg binnen 2 uur niets terug (het geval Rick)
//
// De berichten worden gecachet in data/gesprek-lab-cache.json, zodat een herhaalde run
// Trengo niet opnieuw belast. Draaien: node scripts/gesprek-lab.js [--vers]
const fs = require('fs');
const path = require('path');

const TT = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const CACHE = path.join(__dirname, '..', 'data', 'gesprek-lab-cache.json');
const STATE = path.join(__dirname, '..', 'data', 'inmeten-planner-state.json');
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

async function berichten(ticketId) {
  for (let poging = 0; poging < 6; poging++) {
    const r = await fetch(`https://app.trengo.com/api/v2/tickets/${ticketId}/messages?per_page=50`, {
      headers: { Authorization: 'Bearer ' + TT },
    });
    if (r.status === 429) { await wacht(12000); continue; }
    if (r.status === 404) return null;
    if (!r.ok) return null;
    const d = await r.json();
    return (d.data || []).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }
  return null;
}

/** Alle inmeet-gesprekken ophalen (of uit de cache halen). */
async function haalGesprekken(vers) {
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { /* eerste run */ }
  const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  const tickets = state.aanbodTickets || {};
  let nieuw = 0;
  for (const [token, info] of Object.entries(tickets)) {
    if (!info.waTicket) continue;
    if (cache[token] && !vers) continue;
    const msgs = await berichten(info.waTicket);
    await wacht(800);
    if (!msgs) continue;
    // De bevestiging gaat soms via het mail-ticket. Kijken we alleen naar WhatsApp, dan
    // lijkt een keurig afgehandelde klant onbeantwoord — vals alarm dat het lab waardeloos maakt.
    let mail = [];
    if (info.mailTicket) { mail = (await berichten(info.mailTicket)) || []; await wacht(800); }
    cache[token] = { naam: info.naam, ticket: info.waTicket, verstuurdOp: info.verstuurdOp,
      mailUit: mail.filter((m) => (m.message_type || m.type) === 'OUTBOUND').map((m) => m.created_at),
      msgs: msgs.map((m) => ({
      op: m.created_at,
      richting: m.message_type || m.type,
      tekst: String(m.message || m.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      })) };
    nieuw++;
  }
  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));
  if (nieuw) console.log(`${nieuw} gesprek(ken) opgehaald; ${Object.keys(cache).length} in de cache\n`);
  return cache;
}

(async () => {
  const { leesKeuze } = require('./cron-aanbod-replies.js');
  const { leesReactie } = require('./lib/planning-antwoord.js');
  const { magBoeken } = require('./lib/boek-poort.js');
  const cache = await haalGesprekken(process.argv.includes('--vers'));

  const bevindingen = [];
  let klantberichten = 0;
  for (const [token, g] of Object.entries(cache)) {
    const msgs = g.msgs || [];
    const slots = [{ aankomst: g.verstuurdOp }]; // exacte tijd doet er voor de duiding niet toe

    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.richting !== 'INBOUND' || !m.tekst) continue;
      klantberichten++;
      const volgend = msgs.slice(i + 1);
      const laterKlant = volgend.find((x) => x.richting === 'INBOUND' && x.tekst);
      const opMs = Date.parse(String(m.op).replace(' ', 'T'));
      const ietsTerug = volgend.find((x) => x.richting === 'OUTBOUND')
        || (g.mailUit || []).some((d) => Date.parse(String(d).replace(' ', 'T')) > opMs);

      // 1. DE GOEDKOPE LEZER TEGEN HET ORAKEL. leesKeuze is een regex: snel en gratis,
      //    maar hij leest geen stemming. De AI-duiding is de maatstaf. Zegt de regex
      //    "boeken" terwijl de duiding onvrede of een andere dag ziet, dan boekt het
      //    systeem tegen de klant in — dat is wat er bij Rita van Schagen gebeurde.
      const keuze = leesKeuze(m.tekst, slots);
      if (keuze !== null) {
        const duiding = await leesReactie(m.tekst, slots);
        const poort = magBoeken(duiding, m.tekst, g.adres);
        // De regex is bewust simpel; de poort is de rem. Houdt die het tegen, dan werkt
        // de keten zoals bedoeld — dat is goed nieuws, geen fout.
        if (!poort.mag) {
          bevindingen.push({ soort: 'GEBLOKKEERD', naam: g.naam, token,
            detail: `regex zou boeken op "${m.tekst.slice(0, 60)}", poort houdt tegen: klant ${poort.reden}` });
        } else if (laterKlant) {
          // 2. En stond het laatste woord van de klant het boeken nog toe? Connie zei
          //    "Dat past" en daarna dat woensdag niet kon.
          const dLaatst = await leesReactie(laterKlant.tekst, slots);
          const pLaatst = magBoeken(dLaatst, laterKlant.tekst, g.adres);
          if (!pLaatst.mag) {
            bevindingen.push({ soort: 'GEBLOKKEERD', naam: g.naam, token,
              detail: `keuze "${m.tekst.slice(0, 40)}" wordt tegengehouden: daarna ${pLaatst.reden} ("${laterKlant.tekst.slice(0, 55)}")` });
          }
        }
      }

      // 2. Kreeg de klant iets terug? Het laatste bericht van nu telt niet mee: daar mag
      //    het antwoord nog onderweg zijn.
      // Een duimpje of "dat is goed, fijne avond" hoeft geen antwoord; dat is een
      // afsluiter. Zou het lab die melden, dan verdrinkt het echte geval (Ebru, die
      // 12 oktober voorstelde en nooit iets hoorde) in de ruis.
      // Woordgebaseerd (19-08): de oude regex faalde op "Dankjewel👍🏽" (aan elkaar),
      // namen ("Is goed Nanny, dankjewel!") en "Dank je, hetzelfde!" — 8 van de 9
      // meldingen in het dagrapport waren zulke afsluiters. Werkwijze: emoji's en
      // leestekens weg, namen (hoofdletterwoorden midden in de zin) weg, en dan
      // moet elk overgebleven woord een afsluit-woord zijn. Een vraagteken maakt
      // het nooit een afsluiter.
      // Bijlage-placeholders ("Image", "Video") zijn geen vraag; de tekst eromheen wel.
      if (/^(image|video|audio|document|sticker|bijlage)$/i.test(m.tekst.trim())) continue;
      const AFSLUIT_WOORDEN = new Set(['nakijken', 'reactie', 'bericht', 'info', 'informatie', 'moeite', 'uitleg', 'hulp', 'even', 'heel', 'erg', 'alvast', 'in', 'ieder', 'geval', 'thank', 'you', 'great', 'fine', 'good', 'see', 'then', 'bye', 'cheers', 'dank', 'dankje', 'dankjewel', 'danku', 'dankuwel', 'bedankt', 'thanks', 'thnx', 'top', 'prima', 'oke', 'oké', 'ok', 'okay', 'is', 'goed', 'dat', 'past', 'helemaal', 'hoor', 'ja', 'graag', 'fijn', 'fijne', 'avond', 'dag', 'weekend', 'tot', 'dan', 'ziens', 'snel', 'ook', 'je', 'jij', 'u', 'jullie', 'wel', 'hetzelfde', 'insgelijks', 'gelijk', 'doei', 'doeg', 'groetjes', 'groeten', 'super', 'perfect', 'duidelijk', 'begrepen', 'komt', 'voor', 'elkaar', 'we', 'zien', 'het', 'de', 'een']);
      const isAfsluiter = (tekst) => {
        if (/\?/.test(tekst)) return false;
        const kaal = String(tekst)
          .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F3FB}-\u{1F3FF}]/gu, ' ')
          .replace(/(?<=\S)\s+([A-Z][a-zà-ü]+)/g, (vol, w) => (AFSLUIT_WOORDEN.has(w.toLowerCase()) ? ' ' + w : ' '))
          .toLowerCase().replace(/[^a-zà-ü]+/g, ' ').trim();
        const woorden = kaal.split(/\s+/).filter(Boolean);
        if (!woorden.length) return true; // alleen emoji ("👍") = afsluiter (Michel 19-08)
        return woorden.every((w) => AFSLUIT_WOORDEN.has(w));
      };
      if (isAfsluiter(m.tekst)) continue;
      // Verjaring (19-08): het lab draait dagelijks; alles ouder dan 7 dagen is al
      // eerder gemeld of allang afgehandeld (Colijn: "20 aug lukt niet" was in
      // werkelijkheid beantwoord met een nieuwe boeking op 25 aug).
      if ((Date.now() - Date.parse(String(m.op).replace(' ', 'T'))) > 7 * 24 * 3600000) continue;
      // Het team beantwoordt ook buiten Trengo om (bellen, mailen) en legt dat vast als
      // interne notitie. Dat is een antwoord, ook al staat het niet in de tijdlijn.
      const CONTACT = /\b(gebeld|teruggebeld|voicemail|ingesproken|gemaild|mail (gestuurd|verstuurd)|gesproken|langsgeweest|opgelost|afgehandeld)\b/i;
      if (volgend.some((x) => x.richting === 'NOTE' && CONTACT.test(x.tekst))) continue;
      const isLaatste = i === msgs.length - 1;
      const urenOud = (Date.now() - Date.parse(String(m.op).replace(' ', 'T'))) / 3600000;
      if (!ietsTerug && !(isLaatste && urenOud < 2)) {
        bevindingen.push({ soort: 'FOUT-STIL', naam: g.naam, token,
          detail: `"${m.tekst.slice(0, 80)}" — nooit beantwoord` });
      }
    }
  }

  console.log(`=== GESPREK-LAB: ${Object.keys(cache).length} gesprekken, ${klantberichten} klantberichten ===\n`);
  // Dedupe (19-08): hetzelfde bericht dook via samengevoegde tickets dubbel op
  // (Valentin en Galante stonden 2x in het dagrapport).
  const gezien = new Set();
  const uniek = bevindingen.filter((b) => {
    const sleutel = b.soort + '|' + b.naam + '|' + b.detail;
    if (gezien.has(sleutel)) return false;
    gezien.add(sleutel);
    return true;
  });
  const perSoort = {};
  for (const b of uniek) (perSoort[b.soort] = perSoort[b.soort] || []).push(b);
  for (const soort of ['FOUT-BOEKING', 'FOUT-STIL', 'GEBLOKKEERD']) {
    const lijst = perSoort[soort] || [];
    console.log(`${soort}: ${lijst.length}`);
    for (const b of lijst) console.log(`   ${b.naam}: ${b.detail}`);
    console.log();
  }
  // GEBLOKKEERD is geen fout maar bewijs dat de poort werkt: dit zijn precies de
  // gevallen die eerder wél de mist in gingen.
  const echt = bevindingen.filter((b) => b.soort !== 'GEBLOKKEERD');
  if (!echt.length) console.log('schoon — geen boeking tegen de klant in, geen onbeantwoorde klant.');

  // Met --melden (de dagelijkse run) gaat een bevinding naar Telegram. Alleen als er
  // écht iets is: een lab dat elke ochtend "alles goed" roept wordt niet meer gelezen.
  if (process.argv.includes('--melden') && echt.length) {
    const { telegram } = require('./cron-inmeten-planner.js');
    await telegram(`🔬 Gesprek-lab vond ${echt.length} ding(en) over ${Object.keys(cache).length} echte gesprekken:\n\n`
      + echt.map((b) => `• ${b.soort} — ${b.naam}: ${b.detail}`).join('\n'));
  }
  process.exitCode = echt.length ? 1 : 0;
})().catch((e) => { console.error('FOUT:', e.message); process.exit(2); });

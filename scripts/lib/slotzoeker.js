// Slot-zoeker voor de inmeet-planner.
// Kernprincipe (Daimy: "zo efficient mogelijk plannen is by far het belangrijkste"):
// een nieuwe klus wordt niet in het eerste gaatje geduwd, maar op de plek waar hij de
// MINSTE EXTRA RIJTIJD kost. Dat levert vanzelf regio-clustering op, zonder dat je
// regio's hoeft te definieren.
const { reistijd, MAGAZIJN } = require('./reistijd');

const MINUUT = 60 * 1000;

/** Aankomsttijd naar boven afronden op hele 5 minuten (Daimy: ronde getallen —
 *  "tussen 11:40 en 12:10" leest beter dan "tussen 11:38 en 12:08"). Naar boven,
 *  zodat we nooit een aankomst beloven die vóór de vroegst haalbare tijd ligt. */
function rondAf5(datum) {
  return new Date(Math.ceil(+datum / (5 * MINUUT)) * (5 * MINUUT));
}

/** Marge tussen twee afspraken: uitloop bij de klant mag de rest van de dag niet omgooien. */
const MARGE_MIN = 5;

/**
 * Boven deze extra rijtijd bieden we een slot NIET aan.
 * Zonder deze grens propt de planner elke klus in het eerstvolgende gaatje, ook als dat
 * 67 minuten omrijden kost. Dan geef je de besparing die clusteren oplevert direct weer
 * weg. Past een lead nergens goedkoop, dan is wachten beter: over een paar dagen ligt er
 * bijna altijd een tweede klus in dezelfde hoek.
 *
 * De grens volgt uit de huidige praktijk: 14,3 uur rijden per week op ongeveer 27
 * inmetingen is ruim 30 minuten reistijd per klus (reistijden-analyse 22 juli). Kost een
 * invoeging MINDER dan dat, dan is hij per definitie beter dan hoe het nu gaat. Kost hij
 * meer, dan rijd je de besparing weer weg en is wachten op een buur verstandiger.
 *
 * Bewust geen scherpere grens: dan blijven leads liggen zonder dat het iets oplevert.
 * Wat "goed" is, moet uit de praktijk blijken -- vandaar de wachtteller in de planner.
 */
const MAX_EXTRA_RIJTIJD_MIN = 30;
// Verre-klant-regel (Daimy 06-08): we beloven de klant "de planning neemt binnen
// 5 dagen contact op". Wachten op een klus in dezelfde hoek mag dus, maar uiterlijk
// op dag 4 (kalenderdagen, 1 dag marge op de belofte) krijgt de klant gewoon de
// goedkoopste plekken — een klant kwijtraken kost altijd meer dan omrijden.
const MAX_WACHT_DAGEN = 4;

/**
 * @param {Object} opts
 * @param {Array<{start: Date|string, eind: Date|string, adres: string}>} opts.agenda
 *        Bestaande afspraken van deze inmeter (alle dagen door elkaar mag).
 * @param {string} opts.adres            Adres van de nieuwe klus.
 * @param {number} opts.duurMin          Geschatte inmeetduur.
 * @param {Array<{datum: string, van: string, tot: string}>} opts.werkdagen
 *        Rooster: per dag 'YYYY-MM-DD' met begin- en eindtijd 'HH:MM'.
 * @returns {Promise<Array>} slots, oplopend op extra rijtijd.
 */
/**
 * Bezette blokken van een dag: afspraken die (deels) in de werkdag vallen, met
 * OVERLAPPENDE afspraken samengevoegd. Pure functie, los getest in tests/keten-regressie.js
 * — de bug van 2026-08-04 (winkeldienst 09:00-17:00 naast losse inmeet-uren gaf
 * niet-bestaande gaten) mag nooit terugkomen.
 */
function bezetteBlokken(agenda, dagStart, dagEind) {
  const ruw = agenda
    .map((a) => ({ ...a, start: new Date(a.start), eind: new Date(a.eind) }))
    .filter((a) => a.eind > dagStart && a.start < dagEind)
    .sort((a, b) => a.start - b.start);

  const blokken = [];
  for (const a of ruw) {
    const laatste = blokken[blokken.length - 1];
    if (laatste && a.start < laatste.eind) {
      if (a.eind > laatste.eind) {
        laatste.eind = a.eind;
        if (a.adres) { laatste.adres = a.adres; laatste.klant = a.klant; }
      }
      laatste.samengevoegd = true;
    } else {
      blokken.push({ ...a });
    }
  }
  return blokken;
}

async function zoekSlots({ agenda, adres, duurMin, werkdagen, agendaOnbetrouwbaar = false, startAdres = MAGAZIJN, eindAdres = null }) {
  const slots = [];
  // De bestaande Outlook-afspraken hebben de reistijd IN het blok zitten (Daimy
  // 2026-08-04: "het is nu allemaal ingepland met reistijd erin en we denken dat de
  // jongens er niet netjes mee zijn omgegaan"). Reken je daar reistijd bovenop, dan tel
  // je dubbel en lijkt elke invoeging peperduur. Zolang de agenda niet schoon is,
  // beoordelen we alleen op de RUIMTE en niet op een berekende meerprijs.
  const extraBuffer = agendaOnbetrouwbaar ? 20 : 0;

  for (const dag of werkdagen) {
    const dagStart = new Date(`${dag.datum}T${dag.van}:00`);
    const dagEind = new Date(`${dag.datum}T${dag.tot}:00`);

    const opDeDag = bezetteBlokken(agenda, dagStart, dagEind);

    // Begin en eind van de dag zijn aparte punten (Daimy 2026-08-05): Joey vertrekt
    // thuis in Den Haag en eindigt bij de winkel in Rijswijk; Sjoerd vertrekt en
    // eindigt in Woerden. Standaard allebei het magazijn.
    const punten = [
      { adres: startAdres, eind: dagStart, start: dagStart, magazijn: true },
      ...opDeDag,
      { adres: eindAdres || startAdres, start: dagEind, eind: dagEind, magazijn: true },
    ];

    for (let i = 0; i < punten.length - 1; i++) {
      const vorige = punten[i];
      const volgende = punten[i + 1];

      // Ruimte tussen het vertrek bij de vorige klus en de aankomst bij de volgende.
      const ruimteMin = (volgende.start - vorige.eind) / MINUUT;
      if (ruimteMin < duurMin + 2 * MARGE_MIN) continue;

      let heen, terug, direct;
      try {
        heen = await reistijd(vorige.adres, adres, vorige.eind);
        terug = await reistijd(adres, volgende.adres, new Date(+vorige.eind + (heen.minuten + duurMin) * MINUUT));
        // Wat de rit zou kosten zonder deze klus ertussen: dat is de vergelijking.
        direct = vorige.magazijn && volgende.magazijn
          ? { minuten: 0 }
          : await reistijd(vorige.adres, volgende.adres, vorige.eind);
      } catch (e) {
        continue; // adres niet te vinden of routing faalt: dit gat overslaan
      }

      // De werkdag is KLANTTIJD (Daimy 07-08: "plan gerust zo dat ze om 9:00 bij de
      // eerste klant staan en om 15:00 bij de laatste weggaan"): de aanrit naar de
      // eerste klus valt vóór de dagstart en de terugrit ná het dageinde. Alleen
      // ritten tussen klanten kosten dagtijd. De rijtijd telt wél gewoon mee in de
      // omrij-afweging (extraRijtijdMin) — gratis is hij niet, hij past alleen niet
      // ín het klantvenster.
      const heenDagMin = vorige.magazijn ? 0 : heen.minuten + MARGE_MIN;
      const terugDagMin = volgende.magazijn ? 0 : terug.minuten + MARGE_MIN;
      const nodigMin = heenDagMin + duurMin + terugDagMin + extraBuffer;
      if (nodigMin > ruimteMin) continue;

      const aankomst = rondAf5(new Date(+vorige.eind + heenDagMin * MINUUT));
      const vertrek = new Date(+aankomst + duurMin * MINUUT);
      // Door het afronden schuift de aankomst tot 4 min op; check dat het dan nog past.
      if (+vertrek + (terugDagMin + extraBuffer) * MINUUT > +volgende.start) continue;

      // KEUZE VOOR DE KLANT (Daimy 2026-08-05: altijd meerdere tijden geven, dan
      // kunnen volgende leads er beter bij aansluiten): is het gat ruim genoeg, dan
      // bieden we naast de vroege tijd ook een middag-variant in hetzelfde gat aan.
      // Elke aangeboden tijd wordt een anker in het aanbod-register.
      const middag = new Date(`${dag.datum}T12:30:00`);
      const vroegste = +vorige.eind + heenDagMin * MINUUT;
      if (
        aankomst.getHours() < 11 &&
        +middag >= vroegste &&
        +middag + (duurMin + terugDagMin + extraBuffer) * MINUUT <= +volgende.start
      ) {
        slots.push({
          datum: dag.datum,
          aankomst: middag,
          vertrek: new Date(+middag + duurMin * MINUUT),
          extraRijtijdMin: heen.minuten + terug.minuten - direct.minuten,
          kostenBetrouwbaar: !agendaOnbetrouwbaar,
          heenMin: heen.minuten,
          terugMin: terug.minuten,
          kmHeen: heen.km,
          fileVertragingMin: heen.fileVertragingMin,
          naVorige: vorige.magazijn ? 'magazijn' : (vorige.klant || vorige.adres),
          voorVolgende: volgende.magazijn ? 'magazijn' : (volgende.klant || volgende.adres),
          ruimteMin: Math.round(ruimteMin),
        });
      }

      slots.push({
        datum: dag.datum,
        aankomst,
        vertrek,
        // Wat deze klus de dag extra kost aan rijtijd. Dit is het getal waarop we kiezen.
        extraRijtijdMin: heen.minuten + terug.minuten - direct.minuten,
        // Bij een onbetrouwbare agenda is dat getal een indicatie, geen feit: de
        // buurblokken bevatten zelf al reistijd.
        kostenBetrouwbaar: !agendaOnbetrouwbaar,
        heenMin: heen.minuten,
        terugMin: terug.minuten,
        kmHeen: heen.km,
        fileVertragingMin: heen.fileVertragingMin,
        naVorige: vorige.magazijn ? 'magazijn' : (vorige.klant || vorige.adres),
        voorVolgende: volgende.magazijn ? 'magazijn' : (volgende.klant || volgende.adres),
        ruimteMin: Math.round(ruimteMin),
      });
    }
  }

  return slots.sort((a, b) => a.extraRijtijdMin - b.extraRijtijdMin || a.aankomst - b.aankomst);
}

/**
 * Kies de slots die je aan de klant voorlegt: de goedkoopste, maar gespreid over
 * verschillende dagen en dagdelen. Drie keer hetzelfde tijdstip aanbieden is geen keuze.
 */
function kiesAanbod(slots, aantal = 3, { wachtDagen = 0, deadlineDagen = MAX_WACHT_DAGEN, maxOmrijdenMin = MAX_EXTRA_RIJTIJD_MIN, negeerGrens = false } = {}) {
  // EERDER-WILLEN-route (Daimy 07-08, geval Rene: klant vroeg "kan het eerder" en
  // kreeg dezelfde dag terug omdat eerdere-maar-duurdere plekken buiten de grens
  // vielen): wil de klant expliciet eerder, dan telt de omrij-grens niet — "een
  // klant kwijtraken kost altijd meer dan omrijden". Puur vroegste eerst.
  if (negeerGrens) {
    const opDatum = [...slots].sort((a, b) => +a.aankomst - +b.aankomst || a.extraRijtijdMin - b.extraRijtijdMin);
    return opDatum.slice(0, aantal);
  }
  // CLUSTEREN gebeurt hier: altijd rangschikken op marginale rijtijd, zodat een slot
  // náást een bestaande afspraak in dezelfde buurt wint van een losse lege dag.
  // De formule heen + terug - direct blijft geldig, ook op een vuile agenda; alleen het
  // harde MAX-filter is daar niet eerlijk (blokken bevatten zelf al reistijd), dus dat
  // filter staat alleen aan als de kosten betrouwbaar zijn.
  const betrouwbaar = !slots.some((s) => s.kostenBetrouwbaar === false);
  slots = [...slots].sort((a, b) => a.extraRijtijdMin - b.extraRijtijdMin || a.aankomst - b.aankomst);
  if (betrouwbaar) {
    const binnenGrens = slots.filter((s) => s.extraRijtijdMin <= maxOmrijdenMin);
    if (binnenGrens.length) {
      // VROEGSTE DATUM WINT binnen de omrij-grens (Daimy 07-08 akkoord): de
      // 100-dagen-sync zette verre ankers neer waardoor "15 okt +9 min" won van
      // "23 sep +13 min" — een klant maanden laten schuiven om 4 minuten rijtijd
      // is nooit de bedoeling. Binnen de grens is rijtijd alleen nog de
      // scheidsrechter bij gelijke datum.
      slots = binnenGrens.sort((a, b) => +a.aankomst - +b.aankomst || a.extraRijtijdMin - b.extraRijtijdMin);
    } else if (wachtDagen < deadlineDagen) {
      // niets binnen de grens: wachten op een buurklus is een zichtbare keuze,
      // geen stille nul — tot de deadline, daarna gewoon de goedkoopste plekken
      slots = binnenGrens;
    }
  }
  const gekozen = [];
  const gebruikt = new Set();
  for (const s of slots) {
    const dagdeel = s.aankomst.getHours() < 12 ? 'ochtend' : 'middag';
    const sleutel = `${s.datum}-${dagdeel}`;
    if (gebruikt.has(sleutel)) continue;
    gebruikt.add(sleutel);
    gekozen.push(s);
    if (gekozen.length === aantal) break;
  }
  // Nog niet vol? Aanvullen met de eerstvolgende goedkoopste, ook al valt hij samen.
  for (const s of slots) {
    if (gekozen.length === aantal) break;
    if (!gekozen.includes(s)) gekozen.push(s);
  }
  return gekozen;
}


/**
 * WINKEL-KEUZES (Daimy 09-08: "als iemand in de winkel staat wil ik gewoon alle
 * beschikbare tijden zien, zeg 5, met de snelste maar ook de efficiëntste").
 *
 * Aan de balie beslist de klant mee, dus daar hoort een échte keuzelijst bij in
 * plaats van het ene "beste" moment dat we naar klanten sturen. Deze functie kiest
 * een gevarieerde set en zegt er per optie bij wáárom hij in de lijst staat:
 *  - 'vroegste'      : eerste moment dat kan (ongeacht omrijden)
 *  - 'minste rijtijd': goedkoopste rit (past bij een volle route)
 *  - rest            : spreiding over andere dagen/dagdelen, oplopend in datum
 *
 * Eén slot kan beide labels verdienen; dan staat dat er ook zo bij. Zonder labels
 * zou de winkel moeten raden wat het verschil is tussen vijf regels met tijden.
 */
function kiesWinkelOpties(slots, aantal = 5) {
  if (!slots.length) return [];
  const opDatum = [...slots].sort((a, b) => +a.aankomst - +b.aankomst || a.extraRijtijdMin - b.extraRijtijdMin);
  const opKosten = [...slots].sort((a, b) => a.extraRijtijdMin - b.extraRijtijdMin || +a.aankomst - +b.aankomst);
  const vroegste = opDatum[0];
  const goedkoopste = opKosten[0];

  const gekozen = [];
  const gebruikt = new Set(); // dag+dagdeel: twee keer dezelfde ochtend is geen keuze
  const sleutelVan = (s) => `${s.datum}-${s.aankomst.getHours() < 12 ? 'o' : 'm'}`;
  const voegToe = (s) => {
    if (!s || gekozen.includes(s)) return;
    gekozen.push(s);
    gebruikt.add(sleutelVan(s));
  };
  voegToe(vroegste);
  voegToe(goedkoopste);
  // aanvullen op datum, maar gespreid: nooit twee keer hetzelfde dagdeel
  for (const s of opDatum) {
    if (gekozen.length >= aantal) break;
    if (gebruikt.has(sleutelVan(s))) continue;
    voegToe(s);
  }
  // nog niet vol (weinig gaten): dan mag spreiding los, anders toont de winkel er 2
  for (const s of opDatum) {
    if (gekozen.length >= aantal) break;
    voegToe(s);
  }

  return gekozen
    .sort((a, b) => +a.aankomst - +b.aankomst)
    .map((s) => {
      const labels = [];
      if (s === vroegste) labels.push('vroegste');
      if (s === goedkoopste) labels.push('minste rijtijd');
      return { ...s, label: labels.join(' + ') || null };
    });
}

/** Aankomstvenster van 30 minuten, zoals afgesproken met de klant. */
function venster(slot) {
  const tot = new Date(+slot.aankomst + 30 * MINUUT);
  const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${hhmm(slot.aankomst)} - ${hhmm(tot)}`;
}

/**
 * Waarom een lead (nog) geen aanbod krijgt. Zonder deze uitleg lijkt "geen slot" op een
 * storing, terwijl het meestal een bewuste keuze is om te wachten op een buur.
 */
function waaromGeenAanbod(slots) {
  if (!slots.length) return 'geen enkel gat groot genoeg in de komende werkdagen';
  const goedkoopste = Math.min(...slots.map((s) => s.extraRijtijdMin));
  return `alle plekken kosten te veel omrijden (goedkoopste +${goedkoopste} min, grens is ${MAX_EXTRA_RIJTIJD_MIN}) — we wachten max ${MAX_WACHT_DAGEN} dagen op een klus in dezelfde hoek, daarna plannen we gewoon de goedkoopste plek`;
}

module.exports = { zoekSlots, kiesAanbod, kiesWinkelOpties, venster, waaromGeenAanbod, bezetteBlokken, rondAf5, MARGE_MIN, MAX_EXTRA_RIJTIJD_MIN, MAX_WACHT_DAGEN };

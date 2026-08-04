// Slot-zoeker voor de inmeet-planner.
// Kernprincipe (Daimy: "zo efficient mogelijk plannen is by far het belangrijkste"):
// een nieuwe klus wordt niet in het eerste gaatje geduwd, maar op de plek waar hij de
// MINSTE EXTRA RIJTIJD kost. Dat levert vanzelf regio-clustering op, zonder dat je
// regio's hoeft te definieren.
const { reistijd, MAGAZIJN } = require('./reistijd');

const MINUUT = 60 * 1000;

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
async function zoekSlots({ agenda, adres, duurMin, werkdagen, agendaOnbetrouwbaar = false }) {
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

    // Afspraken van deze dag, op tijd gesorteerd. Ook afspraken die vóór de werkdag
    // beginnen maar erin doorlopen tellen mee (een blok 09:00-17:00 dat om 08:00 begon).
    const ruw = agenda
      .map((a) => ({ ...a, start: new Date(a.start), eind: new Date(a.eind) }))
      .filter((a) => a.eind > dagStart && a.start < dagEind)
      .sort((a, b) => a.start - b.start);

    // OVERLAPPENDE afspraken samenvoegen. Zonder dit ontstaat er een gat dat er niet is:
    // staat er 09:00-10:00 inmeten EN 09:00-17:00 winkeldienst, dan zag de oude versie
    // na dat eerste uur ruimte, terwijl de man de hele dag in de winkel staat.
    const opDeDag = [];
    for (const a of ruw) {
      const laatste = opDeDag[opDeDag.length - 1];
      if (laatste && a.start < laatste.eind) {
        // Overlap: één bezet blok van maken. Het adres van de afspraak die het laatst
        // eindigt bepaalt waar hij daarna vandaan vertrekt.
        if (a.eind > laatste.eind) {
          laatste.eind = a.eind;
          if (a.adres) { laatste.adres = a.adres; laatste.klant = a.klant; }
        }
        laatste.samengevoegd = true;
      } else {
        opDeDag.push({ ...a });
      }
    }

    // De dag begint en eindigt bij het magazijn.
    const punten = [
      { adres: MAGAZIJN, eind: dagStart, start: dagStart, magazijn: true },
      ...opDeDag,
      { adres: MAGAZIJN, start: dagEind, eind: dagEind, magazijn: true },
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

      const nodigMin = heen.minuten + duurMin + terug.minuten + 2 * MARGE_MIN + extraBuffer;
      if (nodigMin > ruimteMin) continue;

      const aankomst = new Date(+vorige.eind + (heen.minuten + MARGE_MIN) * MINUUT);
      const vertrek = new Date(+aankomst + duurMin * MINUUT);

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
function kiesAanbod(slots, aantal = 3) {
  // Alleen slots die de route niet onnodig duur maken. Is de kostenberekening niet
  // betrouwbaar (oude agenda met reistijd in de blokken), dan filteren we er niet op:
  // dan zou je op een verzonnen getal leads liggen laten.
  if (slots.some((s) => s.kostenBetrouwbaar === false)) {
    slots = [...slots].sort((a, b) => a.aankomst - b.aankomst);
  } else {
    slots = slots.filter((s) => s.extraRijtijdMin <= MAX_EXTRA_RIJTIJD_MIN);
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
  return `alle plekken kosten te veel omrijden (goedkoopste +${goedkoopste} min, grens is ${MAX_EXTRA_RIJTIJD_MIN}) — beter wachten tot er een klus in dezelfde hoek bijkomt`;
}

module.exports = { zoekSlots, kiesAanbod, venster, waaromGeenAanbod, MARGE_MIN, MAX_EXTRA_RIJTIJD_MIN };

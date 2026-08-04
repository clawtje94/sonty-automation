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
 * @param {Object} opts
 * @param {Array<{start: Date|string, eind: Date|string, adres: string}>} opts.agenda
 *        Bestaande afspraken van deze inmeter (alle dagen door elkaar mag).
 * @param {string} opts.adres            Adres van de nieuwe klus.
 * @param {number} opts.duurMin          Geschatte inmeetduur.
 * @param {Array<{datum: string, van: string, tot: string}>} opts.werkdagen
 *        Rooster: per dag 'YYYY-MM-DD' met begin- en eindtijd 'HH:MM'.
 * @returns {Promise<Array>} slots, oplopend op extra rijtijd.
 */
async function zoekSlots({ agenda, adres, duurMin, werkdagen }) {
  const slots = [];

  for (const dag of werkdagen) {
    const dagStart = new Date(`${dag.datum}T${dag.van}:00`);
    const dagEind = new Date(`${dag.datum}T${dag.tot}:00`);

    // Afspraken van deze dag, op tijd gesorteerd.
    const opDeDag = agenda
      .map((a) => ({ ...a, start: new Date(a.start), eind: new Date(a.eind) }))
      .filter((a) => a.start >= dagStart && a.start < dagEind)
      .sort((a, b) => a.start - b.start);

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

      const nodigMin = heen.minuten + duurMin + terug.minuten + 2 * MARGE_MIN;
      if (nodigMin > ruimteMin) continue;

      const aankomst = new Date(+vorige.eind + (heen.minuten + MARGE_MIN) * MINUUT);
      const vertrek = new Date(+aankomst + duurMin * MINUUT);

      slots.push({
        datum: dag.datum,
        aankomst,
        vertrek,
        // Wat deze klus de dag extra kost aan rijtijd. Dit is het getal waarop we kiezen.
        extraRijtijdMin: heen.minuten + terug.minuten - direct.minuten,
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

module.exports = { zoekSlots, kiesAanbod, venster, MARGE_MIN };

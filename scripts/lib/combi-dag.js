// Combi-dagen (Daimy 06-08 akkoord: "clusters Gouda+Waddinxveen, Utrecht+Zeist").
// Verre klanten die bij elkaar in de buurt wonen wachten niet tot er toevallig een
// klus naast ligt, maar krijgen samen één dag: de vroegste dag waarop de héle groep
// achter elkaar past. De lange rit wordt zo één keer gemaakt en gedeeld.
//
// Alle aangeboden tijden staan op DIE ene dag: wat de klanten ook kiezen, ze landen
// samen. De keuze van de klant gaat over het tijdstip, niet over de dag.
const { zoekSlots, kiesAanbod, MAX_EXTRA_RIJTIJD_MIN } = require('./slotzoeker.js');

/**
 * @param {Object} opts
 * @param {Array<{naam: string, adres: string, duurMin: number}>} opts.leden
 *        Groepsleden, oudste (langst wachtend) eerst — die krijgt de beste tijden.
 * @param {Array<{naam: string, agenda: Array, werkdagen: Array, startAdres?: string, eindAdres?: string}>} opts.inmeters
 *        Kandidaat-inmeters met hun (verlengde-horizon) rooster.
 * @param {number} [opts.aantalOpties=3]  Tijden per lid op de combi-dag.
 * @returns {Promise<null | {datum: string, inmeter: string, totaalExtraMin: number,
 *          perLid: Array<{lid: Object, aanbod: Array}>}>}
 *        null = geen enkele dag haalbaar; de aanroeper moet dat zichtbaar maken.
 */
async function zoekCombiDag({ leden, inmeters, aantalOpties = 3 }) {
  // Alle (dag, inmeter)-paren chronologisch: de VROEGSTE haalbare dag wint — het
  // hele punt van een combi-dag is de klanten niet maanden laten schuiven omdat een
  // verre datum toevallig 4 minuten goedkoper is. Bij dezelfde datum wint de
  // inmeter met de minste totale extra rijtijd.
  const paren = [];
  for (const inm of inmeters) for (const dag of inm.werkdagen) paren.push({ inm, dag });
  paren.sort((a, b) => a.dag.datum.localeCompare(b.dag.datum));

  // Bij lange klussen eten 3 aangeboden tijden per lid de dag op — dan past de rest
  // van de groep niet meer. Liever minder keuze op DEZELFDE dag dan keuze verspreid
  // over maanden: we vallen terug naar 2 en desnoods 1 tijd per lid.
  const optieTrap = [...new Set([aantalOpties, 2, 1])].filter((n) => n >= 1).sort((a, b) => b - a);

  let beste = null;
  for (const { inm, dag } of paren) {
    if (beste && dag.datum > beste.datum) break; // latere datum kan niet meer winnen

    for (const opties of optieTrap) {
      const werkAgenda = [...inm.agenda];
      const perLid = [];
      let totaal = 0;
      let duurste = 0;
      let gelukt = true;
      for (const lid of leden) {
        let slots;
        try {
          slots = await zoekSlots({
            agenda: werkAgenda, adres: lid.adres, duurMin: lid.duurMin, werkdagen: [dag],
            startAdres: inm.startAdres, eindAdres: inm.eindAdres,
          });
        } catch { slots = []; }
        if (!slots.length) { gelukt = false; break; }
        const aanbod = kiesAanbod(slots, opties, { wachtDagen: 999 });
        totaal += aanbod[0].extraRijtijdMin;
        duurste = Math.max(duurste, aanbod[0].extraRijtijdMin);
        // Aangeboden tijden zijn ankers voor het volgende lid: zo valt de rest van de
        // groep er vanzelf strak naast (zelfde mechaniek als de planner-hoofdlus).
        for (const s of aanbod) {
          werkAgenda.push({ start: s.aankomst.toISOString(), eind: s.vertrek.toISOString(), adres: lid.adres, klant: `aanbod ${lid.naam}` });
        }
        perLid.push({ lid, aanbod });
      }
      if (!gelukt) continue;
      // Gedeelde rit: het duurste lid mag kosten wat hij kost — die klant moet er
      // sowieso een keer heen (dag-4-regel boekt hem anders alsnog los, duurder).
      // Elk EXTRA lid moet er wél binnen de normale omrij-grens naast passen,
      // anders is het geen combi maar twee losse dure ritten op één dag.
      if (totaal - duurste > MAX_EXTRA_RIJTIJD_MIN * (leden.length - 1)) continue;

      const kandidaat = { datum: dag.datum, inmeter: inm.naam, totaalExtraMin: totaal, optiesPerLid: opties, perLid };
      const wint = !beste
        || dag.datum < beste.datum
        || (dag.datum === beste.datum && opties > beste.optiesPerLid)
        || (dag.datum === beste.datum && opties === beste.optiesPerLid && totaal < beste.totaalExtraMin);
      if (wint) beste = kandidaat;
      break; // meer opties gelukt: de lagere treden hoeven niet meer voor deze dag
    }
  }
  return beste;
}

module.exports = { zoekCombiDag };

// SEO-agent: pure beslislogica (geen netwerk), zodat het scenario-lab elke beslissing kan doorrekenen.
// Daimy 29-08: "een agent die zodra de website live is linkbuilding gaat doen en SEO op alle vlakken".
//
// Harde regels (orakel):
//  R1 De agent stuurt NOOIT zelf een mail/bericht naar buiten zonder expliciete goedkeuring van Daimy per
//     voorstel ("ja L3"), en pas na een eerste proefgeval dat Daimy heeft gezien (eerst 1, dan de rest).
//  R2 Geen betaalde links, geen linkruil-netwerken, geen gastblogs-op-bestelling: alleen bronnen waar Sonty
//     inhoudelijk thuishoort (gemeentegidsen, branchegidsen, dealerpagina's van eigen leveranciers, partners,
//     lokale organisaties, pers).
//  R3 Nooit namen van andere zonweringbedrijven in uitgaande teksten of rapporten.
//  R4 Alarm alleen bij NIEUWE technische problemen (diff met de vorige ronde), niet elke dag hetzelfde lijstje.
//  R5 Vóór livegang alleen voorbereiden (audits op de nieuwe site, prospects verzamelen, briefs); linkverzoeken en
//     Bedrijfsprofiel-acties pas als sonty.nl de nieuwe site serveert.
//  R6 Elk uitgaand bericht is kort, Sonty-stijl, één vraag, geen beloftenstapel (regel koude outreach).

/** Is sonty.nl de nieuwe (Next.js) site? Op basis van de HTML van de homepage. */
function isNieuweSiteLive(html) {
  const h = String(html || "");
  return /\/_next\/static\//.test(h) && !/webflow/i.test(h);
}

/** Alleen nieuwe problemen melden: verschil tussen vorige en huidige auditlijst (sleutel = pad + probleem). */
function nieuweProblemen(vorige, huidige) {
  const oud = new Set((vorige || []).map((p) => `${p.pad}|${p.probleem}`));
  return (huidige || []).filter((p) => !oud.has(`${p.pad}|${p.probleem}`));
}
function opgelosteProblemen(vorige, huidige) {
  const nu = new Set((huidige || []).map((p) => `${p.pad}|${p.probleem}`));
  return (vorige || []).filter((p) => !nu.has(`${p.pad}|${p.probleem}`));
}

/** Mag deze bron als linkprospect? (R2) */
const VERBODEN_SOORT = new Set(["betaald", "linkruil", "gastblog-netwerk", "pbn", "concurrent"]);
const TOEGESTAAN_SOORT = new Set(["gemeentegids", "branchegids", "dealerpagina", "partner", "lokale-organisatie", "pers", "sponsoring", "reviewplatform", "kaart"]);
function magProspect(bron) {
  if (!bron || !bron.url || !bron.soort) return { mag: false, reden: "onvolledige bron" };
  if (VERBODEN_SOORT.has(bron.soort)) return { mag: false, reden: `soort ${bron.soort} is verboden (R2)` };
  if (!TOEGESTAAN_SOORT.has(bron.soort)) return { mag: false, reden: `soort ${bron.soort} onbekend` };
  if (bron.kosten && Number(bron.kosten) > 0) return { mag: false, reden: "bron vraagt geld voor vermelding (R2)" };
  return { mag: true };
}

/** Staat Sonty al op de pagina? (vermelding zoeken in de HTML) */
function sontyVermeld(html) {
  const h = String(html || "").toLowerCase();
  return /sonty\.nl|sonty b\.?v\.?|>sonty</.test(h) || /\bsonty\b/.test(h);
}

/** Beslissing per prospect: vermeld → niets; anders verzoek opstellen (alleen na livegang), nooit versturen zonder ja. */
function beslisProspect({ bron, html, status, live, alBenaderdOp, nu = new Date() }) {
  const m = magProspect(bron);
  if (!m.mag) return { actie: "overslaan", reden: m.reden };
  if (status != null && status !== 200) return { actie: "onbereikbaar", reden: `HTTP ${status}` }; // nooit een verzoek op basis van een 404/blokkade
  if (sontyVermeld(html)) return { actie: "al-vermeld" };
  if (!live) return { actie: "wachten-op-livegang" };
  if (alBenaderdOp && (nu - new Date(alBenaderdOp)) < 60 * 86400000) return { actie: "wachten", reden: "korter dan 60 dagen geleden benaderd" };
  return { actie: "voorstel-opstellen" };
}

/** Goedkeuring uit een Telegram-regel: "ja L3", "ok L12", "nee L3". */
function leesGoedkeuring(regel) {
  const m = /\b(ja|ok|oke|akkoord|nee|niet)\b\s*(L\d+)/i.exec(String(regel || ""));
  if (!m) return null;
  return { id: m[2].toUpperCase(), akkoord: /^(ja|ok|oke|akkoord)$/i.test(m[1]) };
}

/** Mag een goedgekeurd voorstel worden verstuurd? (R1: goedkeuring + proefgeval + verzenden-schakelaar) */
function magVersturen({ goedgekeurd, verzendenAan, proefgevalKlaar, eersteVerzending }) {
  if (!goedgekeurd) return { mag: false, reden: "niet goedgekeurd" };
  if (!verzendenAan) return { mag: false, reden: "verzenden staat uit in config" };
  if (!proefgevalKlaar && !eersteVerzending) return { mag: false, reden: "eerst 1 proefgeval, door Daimy gezien" };
  return { mag: true };
}

/** Uitgaand linkverzoek in Sonty-stijl (R6): kort, één vraag, geen concurrentnamen, geen beloften. */
function linkVerzoekTekst(bron) {
  const wat = bron.soort === "gemeentegids" || bron.soort === "branchegids" ? "een vermelding" : bron.soort === "dealerpagina" ? "de dealervermelding" : "een vermelding of link";
  return [
    `Beste ${bron.contactNaam || "redactie"},`,
    "",
    `Wij zijn Sonty, zonwering en raamdecoratie uit Rijswijk (Frijdastraat 8F), met eigen montageteam in Haaglanden en omgeving. Op ${bron.naam} zagen we ${bron.soort === "dealerpagina" ? "de dealerlijst" : "vergelijkbare bedrijven"} staan, maar Sonty nog niet.`,
    "",
    `Zouden jullie ${wat} voor Sonty willen toevoegen? Gegevens: Sonty B.V., Frijdastraat 8F, 2288 EX Rijswijk, 085 006 9681, https://sonty.nl.`,
    "",
    "Alvast bedankt,",
    "Daimy Boot, Sonty",
  ].join("\n");
}

/** Weekrapport-tekst voor Telegram (kort, telefoon-leesbaar). */
function weekrapportTekst({ live, techniek, posities, links, content }) {
  const r = [];
  r.push(live ? "SEO-agent weekrapport (site live)" : "SEO-agent weekrapport (voorbereiding, sonty.nl nog oude site)");
  r.push("");
  r.push("WAT IK DEED");
  r.push(`- Techniek: ${techniek.paginas} pagina's gecheckt, ${techniek.nieuw} ${techniek.nieuw === 1 ? "nieuw probleem" : "nieuwe problemen"}, ${techniek.opgelost} opgelost, ${techniek.open} open.`);
  r.push(posities.beschikbaar ? `- Posities (Search Console): ${posities.top3} zoekwoorden top 3, ${posities.top10} top 10 van ${posities.totaal} betaalde zoekwoorden; ${posities.klikken} organische klikken.` : "- Posities: wacht op Search Console-koppeling.");
  r.push(`- Links: ${links.vermeld} bronnen met vermelding, ${links.voorstellen} nieuwe voorstellen klaar (antwoord \"ja L<nr>\"), ${links.verstuurd} verstuurd.`);
  r.push(`- Content: ${content.briefs} briefs, ${content.concepten} concepten klaar voor controle.`);
  return r.join("\n");
}

module.exports = { isNieuweSiteLive, nieuweProblemen, opgelosteProblemen, magProspect, sontyVermeld, beslisProspect, leesGoedkeuring, magVersturen, linkVerzoekTekst, weekrapportTekst, TOEGESTAAN_SOORT, VERBODEN_SOORT };

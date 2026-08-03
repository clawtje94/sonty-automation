#!/usr/bin/env node
// VvE-signaalradar: welke appartementencomplexen in Zuid-Holland zijn NU met hun
// gevel bezig? Elke vergunningplichtige ingreep aan een complex wordt officieel
// bekendgemaakt, met adres. Zo'n VvE heeft een actief bestuur, een lopend
// besluitvormingstraject en geld gereserveerd. Dat is een beter moment dan welk
// koud adressenbestand ook, en het kost niets.
//
// Bron: KOOP SRU (repository.overheid.nl) -> omgevingsvergunningen.
// Werkwijze: adres uit de titel -> PDOK geocoderen -> BAG-pand erbij -> alleen
// panden met genoeg woningen -> KvK erbij voor de naam van de VvE.
//
// Gebruik: node vve-signalen.js [dagen=30] [--dry] [--stil]

const fs = require("fs");
const KVK = fs.readFileSync(`${process.env.HOME}/sonty/scripts/.kvk-api-key.txt`, "utf8").trim();
const BASE = "https://sonty-website.vercel.app";
const CODE = { "x-bel-code": "sonty2288" };
const TG = "8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40";
const CHAT = 1700128390;

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const DRY = process.argv.includes("--dry");
const STIL = process.argv.includes("--stil"); // niets naar Telegram
const DAGEN = parseInt(args[0] || "30", 10);
const MIN_WONINGEN = 8;

const SRU = "https://repository.overheid.nl/sru";
const LOC = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";
const WFS = "https://service.pdok.nl/lv/bag/wfs/v2_0";

// Termen die wijzen op werk aan een gemeenschappelijke gevel. "balkon" en
// "appartementen" leveren het meeste op; zonwering zelf is juist een signaal dat
// een ander er al zit (concurrentie-intel, we melden het apart).
const TERMEN = [
  "balkon", "balkonbeglazing", "appartementen", "gevel", "gevelrenovatie",
  "kozijnen vervangen", "dakrenovatie", "schilderwerk", "renovatie appartementen",
  "zonwering", "zonneschermen", "rolluiken", "markiezen",
];
// Een losse aanvraag van een individuele eigenaar (airco, kozijn, beglazing) laat
// zien dat de VvE geen beleid heeft voor de gevel — precies het gat dat ons
// zonweringsprotocol vult.
const LOSSE_AANVRAAG = /airco|airconditioning|aircounit|warmtepomp|balkonbeglazing|dakkapel|kozijn/i;
const CONCURRENT = /zonwering|zonnescherm|rolluik|markie[sz]|screens|uitvalscherm/i;

const ZH = new Set([
  "Rotterdam", "'s-Gravenhage", "Den Haag", "Dordrecht", "Leiden", "Zoetermeer", "Delft",
  "Schiedam", "Vlaardingen", "Nissewaard", "Capelle aan den IJssel", "Alphen aan den Rijn",
  "Gouda", "Katwijk", "Rijswijk", "Barendrecht", "Ridderkerk", "Papendrecht", "Sliedrecht",
  "Gorinchem", "Voorschoten", "Wassenaar", "Oegstgeest", "Leiderdorp", "Noordwijk", "Lisse",
  "Hillegom", "Teylingen", "Waddinxveen", "Bodegraven-Reeuwijk", "Krimpenerwaard", "Zwijndrecht",
  "Hendrik-Ido-Ambacht", "Albrandswaard", "Lansingerland", "Pijnacker-Nootdorp", "Westland",
  "Midden-Delfland", "Maassluis", "Leidschendam-Voorburg", "Molenlanden", "Hoeksche Waard",
  "Goeree-Overflakkee", "Voorne aan Zee", "Zuidplas", "Kaag en Braassem", "Nieuwkoop",
  "Alblasserdam", "Hardinxveld-Giessendam", "Vijfheerenlanden", "Krimpen aan den IJssel",
]);

const slaap = (ms) => new Promise((s) => setTimeout(s, ms));

async function sru(cql, start = 1) {
  for (let p = 1; p <= 4; p++) {
    const r = await fetch(
      `${SRU}?operation=searchRetrieve&version=2.0&recordSchema=gzd&maximumRecords=50&startRecord=${start}&query=${encodeURIComponent(cql)}`
    );
    if (r.ok) return r.text();
    await slaap(1500 * p);
  }
  throw new Error("sru onbereikbaar");
}

function parseRecords(xml) {
  const totaal = parseInt((xml.match(/numberOfRecords>(\d+)/) || [])[1] || "0", 10);
  const uit = xml.split("<sru:record>").slice(1).map((b) => ({
    titel: (b.match(/<dcterms:title>([^<]*)/) || [])[1] || "",
    gemeente: (b.match(/<dcterms:creator[^>]*>([^<]*)/) || [])[1] || "",
    type: (b.match(/<dcterms:type[^>]*>([^<]*)/) || [])[1] || "",
    datum: (b.match(/<dcterms:(?:issued|available|date)[^>]*>([\d-]+)/) || [])[1] || "",
    url: (b.match(/<preferredUrl>([^<]*)/) || [])[1] || "",
  }));
  return { totaal, uit };
}

// Straat + huisnummer uit een bekendmakingstitel vissen. Titels zijn rommelig:
// "Aanvraag vergunning voor het plaatsen van zonneschermen aan Noorddijk 1-19 te Maassluis"
function adresUitTitel(titel) {
  const schoon = titel.replace(/\s+/g, " ");
  // eerste stuk "<Straatnaam> <nummer>" waarbij de straatnaam met een hoofdletter begint
  const m = schoon.match(/([A-ZÀ-Ý][\wÀ-ÿ'’.]*(?:[ -][A-Za-zÀ-ÿ'’.]+){0,3})\s+(\d{1,4})\s*(?:[a-zA-Z]\b)?\s*(?:-|\/|t\/m|tot en met)?\s*\d{0,4}/);
  if (!m) return null;
  const straat = m[1].replace(/\b(Aanvraag|Verleende?|Verlenging|Omgevingsvergunning|Gemeente|Besluit|Ingekomen|Kennisgeving|Buiten|Het|De)\b/gi, "").trim();
  if (straat.length < 4) return null;
  return { straat, nr: parseInt(m[2], 10) };
}

async function geocode(straat, nr, gemeente) {
  try {
    const r = await fetch(
      `${LOC}?q=${encodeURIComponent(`${straat} ${nr} ${gemeente}`)}&fq=type:adres&rows=1&fl=weergavenaam,centroide_ll,woonplaatsnaam,straatnaam,huisnummer,postcode`
    );
    const doc = (await r.json())?.response?.docs?.[0];
    if (!doc) return null;
    if (String(doc.straatnaam || "").toLowerCase() !== straat.toLowerCase()) return null;
    // ook het huisnummer moet kloppen: de locatieserver geeft anders een ander
    // pand in dezelfde straat terug (Noordendijk 9 werd Noordendijk 380B-9)
    if (parseInt(String(doc.huisnummer ?? "-1"), 10) !== nr) return null;
    const c = String(doc.centroide_ll || "").match(/POINT\(([\d.]+) ([\d.]+)\)/);
    if (!c) return null;
    return {
      lon: parseFloat(c[1]), lat: parseFloat(c[2]),
      adres: doc.weergavenaam, postcode: doc.postcode || "", plaats: doc.woonplaatsnaam || "",
    };
  } catch { return null; }
}

// pand onder dit punt + hoeveel woningen erin zitten
async function pandBij(lon, lat) {
  const d = 0.00004;
  const filter =
    `<Filter xmlns:gml="http://www.opengis.net/gml/3.2"><BBOX><ValueReference>geometrie</ValueReference>` +
    `<gml:Envelope srsName="urn:ogc:def:crs:EPSG::4326"><gml:lowerCorner>${lat - d} ${lon - d}</gml:lowerCorner>` +
    `<gml:upperCorner>${lat + d} ${lon + d}</gml:upperCorner></gml:Envelope></BBOX></Filter>`;
  try {
    const r = await fetch(
      `${WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=bag:pand&count=5&outputFormat=application/json&srsName=EPSG:4326&filter=${encodeURIComponent(filter)}`
    );
    const f = (await r.json())?.features || [];
    let best = null;
    for (const x of f) {
      const p = x.properties || {};
      const won = p.aantalVerblijfsobjecten ?? p.aantal_verblijfsobjecten ?? 0;
      if (!/woonfunctie/i.test(String(p.gebruiksdoel || ""))) continue;
      if (!best || won > best.woningen) best = { pandId: String(p.identificatie), woningen: won, bouwjaar: p.bouwjaar };
    }
    return best;
  } catch { return null; }
}

// Officiele VvE-naam erbij (KvK-zoeken is gratis). Strikt matchen op huisnummer:
// dezelfde straat heeft vaak meerdere VvE's, en een verkeerde naam in de lijst is
// erger dan geen naam.
const { VVE_RE, RANG, plaatsVarianten, plaatsUitNaam, beoordeel } = require("./lib/kvk-vve");

async function vveNaam(straat, nr, plaats) {
  try {
    const r = await fetch(
      `https://api.kvk.nl/api/v2/zoeken?naam=${encodeURIComponent(straat)}&resultatenPerPagina=100`,
      { headers: { apikey: KVK } }
    );
    const res = (await r.json())?.resultaten || [];
    const varianten = plaatsVarianten(plaats);
    const kandidaten = [];
    for (const x of res) {
      if (x.type !== "rechtspersoon" || !VVE_RE.test(x.naam)) continue;
      const genoemd = plaatsUitNaam(x.naam);
      if (genoemd && !varianten.includes(genoemd)) continue; // hoort bij een andere plaats
      const b = beoordeel(x.naam, straat, nr);
      if (!b || b.zekerheid !== "zeker") continue; // alleen een exacte huisnummertreffer, anders liever geen naam
      kandidaten.push({ x, ...b, bewijs: !!genoemd });
    }
    kandidaten.sort(
      (a, b) => RANG[b.zekerheid] - RANG[a.zekerheid] || Number(b.bewijs) - Number(a.bewijs) || a.spreiding - b.spreiding
    );
    const w = kandidaten[0];
    return w ? { naam: w.x.naam.replace(/^"|"$/g, ""), kvk: w.x.kvkNummer, zekerheid: w.zekerheid } : null;
  } catch { return null; }
}

async function telegram(tekst) {
  if (STIL) return;
  await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT, text: tekst }),
  }).catch(() => {});
}

(async () => {
  const vanaf = new Date(Date.now() - DAGEN * 864e5).toISOString().slice(0, 10);
  console.log(`signalen zoeken vanaf ${vanaf} (${TERMEN.length} termen)`);

  // 1) alle bekendmakingen ophalen
  const ruw = new Map();
  for (const term of TERMEN) {
    try {
      for (let start = 1; start <= 151; start += 50) {
        const { totaal, uit } = parseRecords(await sru(`cql.textAndIndexes="${term}" AND dt.modified>="${vanaf}"`, start));
        for (const r of uit) {
          if (!ZH.has(r.gemeente)) continue;
          if (!/omgevingsvergunning/i.test(r.type)) continue;
          if (!ruw.has(r.titel)) ruw.set(r.titel, { ...r, term });
        }
        if (start + 50 > totaal) break;
        await slaap(1200);
      }
    } catch (e) {
      console.log(`  ! term "${term}": ${e.message}`);
    }
    await slaap(1200);
  }
  console.log(`${ruw.size} ZH-omgevingsvergunningen gevonden`);

  // 2) adres -> pand -> alleen echte complexen
  const treffers = [];
  let zonderAdres = 0, teKlein = 0;
  for (const r of ruw.values()) {
    const a = adresUitTitel(r.titel);
    if (!a) { zonderAdres++; continue; }
    const geo = await geocode(a.straat, a.nr, r.gemeente);
    if (!geo) { zonderAdres++; continue; }
    const pand = await pandBij(geo.lon, geo.lat);
    if (!pand || pand.woningen < MIN_WONINGEN) { teKlein++; continue; }
    const kvk = await vveNaam(a.straat, a.nr, geo.plaats);
    treffers.push({
      pandId: pand.pandId,
      adres: geo.adres,
      postcode: geo.postcode,
      plaats: geo.plaats,
      gemeente: r.gemeente,
      woningen: pand.woningen,
      bouwjaar: pand.bouwjaar || null,
      werk: r.titel.slice(0, 220),
      soort: CONCURRENT.test(r.titel)
        ? "zonwering door een ander"
        : LOSSE_AANVRAAG.test(r.titel)
          ? "losse aanvraag van een eigenaar"
          : "gevelwerk aan het complex",
      datum: r.datum,
      bron: r.url,
      vveNaam: kvk?.naam || "",
      kvkNummer: kvk?.kvk || "",
    });
    await slaap(250);
  }
  treffers.sort((a, b) => b.woningen - a.woningen);

  console.log(`\n${treffers.length} complexen (>=${MIN_WONINGEN} woningen); ${zonderAdres} zonder bruikbaar adres, ${teKlein} te klein\n`);
  for (const t of treffers.slice(0, 30)) {
    console.log(`${String(t.woningen).padStart(4)} won  ${t.adres} (${t.plaats}) [${t.soort}]`);
    console.log(`          ${t.vveNaam || "(VvE onbekend)"}`);
    console.log(`          ${t.werk.slice(0, 110)}`);
  }

  if (DRY || !treffers.length) return;

  const res = await fetch(`${BASE}/api/vve-signalen`, {
    method: "POST",
    headers: { ...CODE, "content-type": "application/json" },
    body: JSON.stringify({ rows: treffers }),
  });
  const j = await res.json();
  console.log(`\nopgeslagen: ${j.opgeslagen || 0}, nieuw: ${j.nieuw || 0}`);

  if (j.nieuw > 0) {
    const nieuw = treffers.filter((t) => (j.nieuweIds || []).includes(t.pandId)).slice(0, 8);
    const regels = nieuw.map((t) => `- ${t.adres}, ${t.plaats} (${t.woningen} won): ${t.werk.slice(0, 90)}`);
    await telegram(
      `VvE-signalen: ${j.nieuw} nieuwe complexen die aan hun gevel werken.\n\n${regels.join("\n")}\n\nAlles staat in /admin/vve-signalen`
    );
  }
})().catch((e) => {
  console.error("FOUT:", e.message);
  process.exit(1);
});

#!/usr/bin/env node
// Koppelt de VvE-radar aan het Handelsregister: zoekt per straat alle
// Verenigingen van Eigenaars op (KvK Zoeken API = GRATIS) en matcht ze op
// huisnummer aan de complexen in de radar. Resultaat gaat naar KV "vvekvk"
// via /api/vve-radar/kvk.
//
// Bijvangst: alle VvE's met een bezoekadres dat NIET het complexadres is,
// staan ingeschreven op het adres van hun beheerkantoor. Die tellen we mee,
// zodat we zien welk kantoor hoeveel VvE's in beheer heeft.
//
// Gebruik: node kvk-vve-koppel.js <plaats> [minWoningen=10] [maxComplexen=400]
//          node kvk-vve-koppel.js <plaats> --profiel   (ook correspondentieadres
//          + non-mailing ophalen via Basisprofiel API; kost EUR 0,02 per VvE)

const fs = require("fs");
const KVK = fs.readFileSync(`${process.env.HOME}/sonty/scripts/.kvk-api-key.txt`, "utf8").trim();
const BASE = "https://sonty-website.vercel.app";
const CODE = { "x-bel-code": "sonty2288" };

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const PROFIEL = process.argv.includes("--profiel");
const DRY = process.argv.includes("--dry"); // niets opslaan, alleen rapporteren
const PLAATS = args[0] || "Voorburg";
const MIN = parseInt(args[1] || "10", 10);
const MAX = parseInt(args[2] || "400", 10);

const VVE_RE = /vereniging\s+van\s+eigen(aars|aren)|^\s*"?v\.?v\.?e\.?\b/i;

async function kvkGet(path) {
  for (let poging = 1; poging <= 4; poging++) {
    const r = await fetch(`https://api.kvk.nl${path}`, { headers: { apikey: KVK } });
    if (r.ok) return r.json();
    if (r.status === 404) return null;
    if (poging === 4) throw new Error(`kvk ${r.status} op ${path}`);
    await new Promise((s) => setTimeout(s, 400 * poging));
  }
}

// KvK kent 's-Gravenhage, de volksmond Den Haag; beide gelden als dezelfde plaats
function plaatsVarianten(plaats) {
  const p = (plaats || "").trim().toLowerCase();
  const paren = [
    ["'s-gravenhage", "den haag"],
    ["'s-hertogenbosch", "den bosch"],
  ];
  for (const paar of paren) if (paar.includes(p)) return paar;
  return [p];
}

// NIET op plaats filteren: een VvE staat ingeschreven op het adres van haar
// beheerder, en dat kantoor zit vaak in een andere gemeente (gemeten 2026-08-03:
// het plaatsfilter liet 3 van de 50 complexen over, zonder filter 30+). We halen
// dus alles op met deze straatnaam en bewijzen de plaats daarna zelf.
async function vvesInStraat(straat) {
  const out = [];
  for (let p = 1; p <= 10; p++) {
    const qs = `naam=${encodeURIComponent(straat)}&resultatenPerPagina=100&pagina=${p}`;
    const d = await kvkGet(`/api/v2/zoeken?${qs}`);
    const res = d?.resultaten || [];
    out.push(...res.filter((r) => r.type === "rechtspersoon" && VVE_RE.test(r.naam)));
    if (res.length < 100) break;
  }
  return out;
}

// Noemt de naam een plaats ("... te Voorburg")? Zo ja: welke.
function plaatsUitNaam(naam) {
  const m = naam.match(/\bte\s+([A-Za-zÀ-ÿ'’.\- ]{3,40}?)\s*("|\)|,|$)/);
  return m ? m[1].trim().toLowerCase() : null;
}

// Bestaat deze straatnaam ook in de plaats waar de VvE staat ingeschreven?
// Zo ja, dan gaat de VvE hoogstwaarschijnlijk over HAAR eigen straat daar en
// niet over ons complex ("VvE Nieuwe Havenstraat" in Katwijk hoort in Katwijk).
const LOC = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";
const straatCache = new Map();
async function straatBestaatIn(straat, plaats) {
  const sleutel = `${straat}|${plaats}`.toLowerCase();
  if (straatCache.has(sleutel)) return straatCache.get(sleutel);
  let hit = false;
  try {
    const r = await fetch(
      `${LOC}?q=${encodeURIComponent(`${straat} ${plaats}`)}&fq=type:weg&rows=8&fl=straatnaam,woonplaatsnaam`
    );
    const docs = (await r.json())?.response?.docs || [];
    const pv = plaatsVarianten(plaats);
    hit = docs.some(
      (d) =>
        String(d.straatnaam || "").toLowerCase() === straat.toLowerCase() &&
        pv.includes(String(d.woonplaatsnaam || "").toLowerCase())
    );
  } catch {}
  straatCache.set(sleutel, hit);
  return hit;
}

// Huisnummers uit een VvE-naam halen (het deel achter de straatnaam).
function nummersUitNaam(naam, straat) {
  const schoon = naam.replace(/\b\d{4}\s?[A-Z]{2}\b/g, " "); // postcodes weg
  const i = schoon.toLowerCase().indexOf(straat.toLowerCase());
  if (i < 0) return null;
  let rest = schoon.slice(i + straat.length);
  rest = rest.replace(/\bte\s+[A-Za-z' -]+$/i, " "); // "te Voorburg" weg
  const nums = [...rest.matchAll(/\d+/g)].map((m) => parseInt(m[0], 10)).filter((n) => n > 0 && n < 5000);
  const pariteit = /oneven/i.test(rest) ? 1 : /\beven\b/i.test(rest) ? 0 : null;
  const bereik = /tot en met|t\/m|t\.m\.|\d\s*-\s*\d/i.test(rest);
  return { nums, pariteit, bereik };
}

// Hoe zeker is het dat deze VvE bij dit huisnummer hoort?
function beoordeel(naam, straat, nr) {
  const p = nummersUitNaam(naam, straat);
  if (!p) return null;
  const { nums, pariteit, bereik } = p;
  if (!nums.length) return { zekerheid: "zwak", spreiding: 9999 };
  if (pariteit !== null && nr % 2 !== pariteit) return null;
  if (nums.includes(nr)) return { zekerheid: "zeker", spreiding: 0 };
  const lo = Math.min(...nums), hi = Math.max(...nums);
  if (bereik && nr >= lo && nr <= hi) return { zekerheid: "waarschijnlijk", spreiding: hi - lo };
  return null;
}

const RANG = { zeker: 3, waarschijnlijk: 2, zwak: 1 };

(async () => {
  const res = await fetch(`${BASE}/api/vve-radar?q=${encodeURIComponent(PLAATS)}&min=${MIN}`, { headers: CODE });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  const complexen = data.rows.slice(0, MAX);
  console.log(`${data.totaal} complexen in ${data.zoek}; ${complexen.length} verwerken (min ${MIN} won)`);

  // per straat EN woonplaats groeperen: de radar beslaat een straal van 3 km en
  // loopt dus over gemeentegrenzen heen. 1 KvK-zoekopdracht per straat, niet per pand.
  const perStraat = new Map();
  for (const c of complexen) {
    const m = String(c.adres || "").match(/^(.+?)\s+(\d+)/);
    if (!m || !c.plaats) continue;
    const straat = m[1].trim();
    const sleutel = `${straat}|${c.plaats}`;
    if (!perStraat.has(sleutel)) perStraat.set(sleutel, []);
    perStraat.get(sleutel).push({ ...c, straat, nr: parseInt(m[2], 10) });
  }
  console.log(`${perStraat.size} unieke straat+plaats-combinaties -> evenveel gratis zoekopdrachten`);

  const uitkomst = [];
  const kantoren = new Map(); // bezoekadres -> {aantal, voorbeeld}
  let straatNr = 0;

  for (const [sleutel, panden] of perStraat) {
    straatNr++;
    const [straat, plaats] = sleutel.split("|");
    let alle = [];
    try {
      alle = await vvesInStraat(straat);
    } catch (e) {
      console.log(`  ! ${straat} (${plaats}): ${e.message}`);
      continue;
    }
    // Plaats bewijzen: dezelfde straatnaam bestaat in tientallen gemeenten.
    // Een VvE hoort hier als de naam deze plaats noemt, of als ze op het
    // complexadres zelf staat ingeschreven. Noemt de naam een ANDERE plaats,
    // dan valt ze hard af.
    const varianten = plaatsVarianten(plaats);
    const vves = [], afgewezen = [];
    for (const v of alle) {
      const a = v.adres?.binnenlandsAdres || {};
      const genoemd = plaatsUitNaam(v.naam);
      const opEigenAdres =
        (a.straatnaam || "").toLowerCase() === straat.toLowerCase() &&
        varianten.includes((a.plaats || "").toLowerCase());
      if (genoemd && !varianten.includes(genoemd)) { afgewezen.push(v); continue; }
      const bewijs = (genoemd && varianten.includes(genoemd)) || opEigenAdres;
      if (!bewijs && a.plaats && !varianten.includes(String(a.plaats).toLowerCase())) {
        // geen plaatsbewijs: hoort deze straat bij de vestigingsplaats van de VvE?
        if (await straatBestaatIn(straat, a.plaats)) { afgewezen.push(v); continue; }
      }
      vves.push({ ...v, bewijs });
    }
    // Zonder enig plaatsbewijs mogen we alleen doorgaan als deze straatnaam
    // nergens anders in Nederland een VvE heeft (geen afgewezen kandidaten).
    const bewezen = vves.filter((v) => v.bewijs);
    const bruikbaar = bewezen.length ? bewezen : afgewezen.length ? [] : vves;

    // bijvangst: waar staan deze VvE's ingeschreven? (= adres van de beheerder)
    for (const v of bruikbaar) {
      const a = v.adres?.binnenlandsAdres || {};
      if (!a.straatnaam) continue;
      if (a.straatnaam.toLowerCase() === straat.toLowerCase()) continue; // eigen complex
      const key = `${a.straatnaam}, ${a.plaats}`;
      const k = kantoren.get(key) || { aantal: 0, voorbeeld: v.naam };
      k.aantal++;
      kantoren.set(key, k);
    }

    for (const p of panden) {
      const kandidaten = [];
      for (const v of bruikbaar) {
        const b = beoordeel(v.naam, straat, p.nr);
        if (b) kandidaten.push({ v, ...b });
      }
      kandidaten.sort(
        (a, b) => RANG[b.zekerheid] - RANG[a.zekerheid] || Number(b.v.bewijs) - Number(a.v.bewijs) || a.spreiding - b.spreiding
      );
      const win = kandidaten[0];
      uitkomst.push({
        pandId: p.pandId,
        vveNaam: win ? win.v.naam.replace(/^"|"$/g, "") : "",
        kvkNummer: win ? win.v.kvkNummer : "",
        bezoekadres: win
          ? [win.v.adres?.binnenlandsAdres?.straatnaam, win.v.adres?.binnenlandsAdres?.plaats].filter(Boolean).join(", ")
          : "",
        zekerheid: win ? win.zekerheid : "",
        alternatieven: Math.max(0, kandidaten.length - 1),
      });
    }
    if (straatNr % 10 === 0) console.log(`  ${straatNr}/${perStraat.size} straten`);
  }

  // optioneel: correspondentieadres + non-mailing per gevonden VvE (EUR 0,02 elk)
  if (PROFIEL) {
    const met = uitkomst.filter((u) => u.kvkNummer);
    console.log(`Basisprofiel ophalen voor ${met.length} VvE's (~EUR ${(met.length * 0.02).toFixed(2)})`);
    for (const u of met) {
      try {
        const d = await kvkGet(`/api/v1/basisprofielen/${u.kvkNummer}`);
        const eig = d?._embedded?.eigenaar || {};
        u.rsin = eig.rsin || "";
        u.nonMailing = d?.indNonMailing || "";
        const corr = (eig.adressen || []).find((a) => a.type === "correspondentieadres");
        u.correspondentieadres = corr?.volledigAdres || "";
      } catch (e) {
        console.log(`  ! profiel ${u.kvkNummer}: ${e.message}`);
      }
    }
  }

  // opslaan in batches van 200
  let opgeslagen = 0;
  if (DRY) {
    console.log("\n(droogloop, niets opgeslagen) eerste 15 koppelingen:");
    for (const u of uitkomst.filter((x) => x.vveNaam).slice(0, 15)) {
      console.log(`  [${u.zekerheid}] ${u.vveNaam.slice(0, 75)} · KvK ${u.kvkNummer} · op ${u.bezoekadres}`);
    }
  }
  for (let i = 0; !DRY && i < uitkomst.length; i += 200) {
    const r = await fetch(`${BASE}/api/vve-radar/kvk`, {
      method: "POST",
      headers: { ...CODE, "content-type": "application/json" },
      body: JSON.stringify({ rows: uitkomst.slice(i, i + 200) }),
    });
    const j = await r.json();
    opgeslagen += j.opgeslagen || 0;
  }

  const gevonden = uitkomst.filter((u) => u.vveNaam);
  const zeker = gevonden.filter((u) => u.zekerheid === "zeker").length;
  console.log(`\nKLAAR: ${gevonden.length}/${uitkomst.length} complexen gekoppeld (${zeker} zeker), ${opgeslagen} opgeslagen`);

  const top = [...kantoren.entries()].filter(([, v]) => v.aantal >= 5).sort((a, b) => b[1].aantal - a[1].aantal);
  if (top.length) {
    console.log(`\nBEHEERKANTOREN (adressen waar meerdere VvE's van andere straten staan ingeschreven):`);
    for (const [adres, v] of top.slice(0, 25)) console.log(`  ${String(v.aantal).padStart(4)}x  ${adres}`);
  }
})().catch((e) => {
  console.error("FOUT:", e.message);
  process.exit(1);
});

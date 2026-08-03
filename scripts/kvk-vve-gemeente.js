#!/usr/bin/env node
// Bouwt per gemeente een aanschrijflijst van ZELFBEHEERDE VvE's.
//
// Idee: een VvE die bij een beheerkantoor zit, staat ingeschreven op het adres
// van dat kantoor. Een VvE zonder beheerder staat ingeschreven op haar eigen
// complex, meestal op het huisnummer van de voorzitter of penningmeester. Die
// tweede groep kun je rechtstreeks aanschrijven, zonder kantoor ertussen.
// Gemeten in Voorburg (2026-08-03): 608 van de 998 VvE's zijn zelfbeheerd, en
// 18 van 20 profielen leverden een echt straatadres met huisnummer op.
//
// Zoeken bij de KvK is gratis; per profiel (voor huisnummer, postcode en de
// non-mailing-indicatie) rekent de KvK EUR 0,02.
//
// Gebruik: node kvk-vve-gemeente.js <plaats> [maxProfielen=250]
//          node kvk-vve-gemeente.js <plaats> --dry   (alleen tellen, niets betalen)

const fs = require("fs");
const KVK = fs.readFileSync(`${process.env.HOME}/sonty/scripts/.kvk-api-key.txt`, "utf8").trim();
const BASE = "https://sonty-website.vercel.app";
const CODE = { "x-bel-code": "sonty2288" };

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const DRY = process.argv.includes("--dry");
const PLAATS = args[0] || "Voorburg";
const MAX = parseInt(args[1] || "250", 10);

const VVE_RE = /vereniging\s+van\s+eigen(aars|aren)|^\s*"?v\.?v\.?e\.?\b/i;

async function kvkGet(path) {
  for (let poging = 1; poging <= 4; poging++) {
    const r = await fetch(`https://api.kvk.nl${path}`, { headers: { apikey: KVK } });
    if (r.ok) return r.json();
    if (r.status === 404) return null;
    if (poging === 4) throw new Error(`kvk ${r.status}`);
    await new Promise((s) => setTimeout(s, 400 * poging));
  }
}

(async () => {
  // 1) alle VvE's die in deze plaats staan ingeschreven (max 1000, gratis)
  const alle = [];
  for (let p = 1; p <= 10; p++) {
    const d = await kvkGet(
      `/api/v2/zoeken?naam=${encodeURIComponent("Vereniging van Eigenaars")}&plaats=${encodeURIComponent(PLAATS)}&resultatenPerPagina=100&pagina=${p}`
    );
    const res = d?.resultaten || [];
    alle.push(...res.filter((r) => r.type === "rechtspersoon" && VVE_RE.test(r.naam)));
    if (res.length < 100) break;
  }

  // 2) zelfbeheer: de straat waarop de VvE staat ingeschreven komt terug in haar
  //    eigen naam, dus ze zit op haar eigen complex en niet bij een kantoor
  const zelf = alle.filter((v) => {
    const st = v.adres?.binnenlandsAdres?.straatnaam;
    return st && v.naam.toLowerCase().includes(st.toLowerCase());
  });
  console.log(`${PLAATS}: ${alle.length} VvE's ingeschreven, ${zelf.length} zelfbeheerd (${Math.round((zelf.length / (alle.length || 1)) * 100)}%)`);
  if (alle.length >= 1000) console.log(`LET OP: de KvK geeft max 1000 treffers, deze plaats heeft er waarschijnlijk meer.`);

  const doelen = zelf.slice(0, MAX);
  if (zelf.length > doelen.length) console.log(`beperkt tot ${doelen.length} profielen (${zelf.length - doelen.length} niet opgehaald)`);
  if (DRY) {
    console.log(`(droogloop) zou EUR ${(doelen.length * 0.02).toFixed(2)} kosten aan profielen`);
    return;
  }
  console.log(`profielen ophalen: ${doelen.length} x EUR 0,02 = EUR ${(doelen.length * 0.02).toFixed(2)}`);

  // 3) profiel per VvE: huisnummer, postcode, non-mailing, oprichtingsjaar
  const uit = [];
  let cursor = 0, fout = 0;
  async function worker() {
    while (cursor < doelen.length) {
      const v = doelen[cursor++];
      try {
        const d = await kvkGet(`/api/v1/basisprofielen/${v.kvkNummer}`);
        const ad = d?._embedded?.eigenaar?.adressen || [];
        const bez = ad.find((a) => a.type === "bezoekadres");
        const cor = ad.find((a) => a.type === "correspondentieadres");
        // correspondentieadres gaat voor, tenzij het een postbus is: dan wil je
        // juist het straatadres van het complex hebben
        const kies = cor && !cor.postbusnummer ? cor : bez || cor;
        if (!kies) continue;
        uit.push({
          kvkNummer: v.kvkNummer,
          naam: v.naam.replace(/^"|"$/g, ""),
          adres: [kies.straatnaam, kies.huisnummer, kies.huisletter, kies.postbusnummer ? `Postbus ${kies.postbusnummer}` : ""]
            .filter(Boolean)
            .join(" ")
            .trim(),
          postcode: kies.postcode || "",
          plaats: kies.plaats || PLAATS,
          nonMailing: d?.indNonMailing || "",
          startjaar: parseInt(String(d?.materieleRegistratie?.datumAanvang || "").slice(0, 4), 10) || null,
        });
      } catch (e) {
        fout++;
      }
      if (uit.length % 50 === 0 && uit.length) console.log(`  ${uit.length}/${doelen.length}`);
    }
  }
  await Promise.all(Array.from({ length: 5 }, worker));

  // 4) opslaan
  let opgeslagen = 0;
  for (let i = 0; i < uit.length; i += 200) {
    const r = await fetch(`${BASE}/api/vve-lijst`, {
      method: "POST",
      headers: { ...CODE, "content-type": "application/json" },
      body: JSON.stringify({ rows: uit.slice(i, i + 200) }),
    });
    opgeslagen += (await r.json()).opgeslagen || 0;
  }

  const nm = uit.filter((u) => u.nonMailing === "Ja").length;
  const straat = uit.filter((u) => !/postbus/i.test(u.adres)).length;
  console.log(`\nKLAAR: ${opgeslagen} VvE's opgeslagen${fout ? ` (${fout} profielen mislukt)` : ""}`);
  console.log(`  ${straat} met een straatadres (bestuur woont in het complex), ${uit.length - straat} met een postbus`);
  console.log(`  ${nm} staan op non-mailing: die NIET koud aanschrijven`);
  console.log(`  direct aanschrijfbaar: ${uit.filter((u) => u.nonMailing !== "Ja" && !/postbus/i.test(u.adres)).length}`);
})().catch((e) => {
  console.error("FOUT:", e.message);
  process.exit(1);
});

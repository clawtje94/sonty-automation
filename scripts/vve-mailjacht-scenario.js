#!/usr/bin/env node
// Scenario-run mail-jacht: voor N radar-complexen het mailadres van de
// betreffende VvE zoeken via claude + web_search. Rapporteert hit-rate.
// Nog GEEN opslag in de radar; eerst kijken of dit werkt (regel: scenario-run eerst).
// Gebruik: node vve-mailjacht-scenario.js [plaats] [aantal]

const fs = require("fs");
const KEY = fs.readFileSync(`${process.env.HOME}/sonty/scripts/.anthropic-api-key.txt`, "utf8").trim();
const PLAATS = process.argv[2] || "Delft";
const N = parseInt(process.argv[3] || "10", 10);

(async () => {
  const res = await fetch(
    `https://sonty-website.vercel.app/api/vve-radar?q=${encodeURIComponent(PLAATS)}&min=10`,
    { headers: { "x-bel-code": "sonty2288" } }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  const doelen = data.rows.filter((r) => r.score >= 70).slice(0, N);
  console.log(`${doelen.length} testgebouwen (score 70+) in ${data.zoek}\n`);

  let hits = 0;
  for (const g of doelen) {
    const vraag = `Zoek het e-mailadres van de Vereniging van Eigenaars (VvE) van het appartementencomplex aan de ${g.adres} in ${g.plaats} (postcode ${g.postcode}). Zoek bijvoorbeeld op "VvE ${g.adres.replace(/ \d.*$/, "")} ${g.plaats}" en varianten. Alleen een adres van DEZE specifieke VvE of zijn beheerder telt; niet van willekeurige bedrijven.
Antwoord UITSLUITEND met JSON: {"gevonden": true|false, "email": "", "vve_naam": "", "beheerder": "", "bron_url": "", "toelichting": "1 zin"}`;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
          messages: [{ role: "user", content: vraag }],
        }),
      });
      if (!r.ok) throw new Error(`api ${r.status}: ${(await r.text()).slice(0, 150)}`);
      const d = await r.json();
      const txt = (d.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
      const m = txt.match(/\{[\s\S]*\}/);
      const j = m ? JSON.parse(m[0]) : { gevonden: false };
      if (j.gevonden && j.email) hits++;
      console.log(
        `${j.gevonden && j.email ? "✔" : "✘"} ${g.adres}, ${g.plaats} (${g.woningen} won)` +
          (j.gevonden && j.email ? `\n    ${j.email} | ${j.vve_naam || "?"} ${j.beheerder ? "| beheerder: " + j.beheerder : ""}\n    bron: ${j.bron_url}` : `  — ${j.toelichting || "niets gevonden"}`)
      );
    } catch (e) {
      console.log(`! ${g.adres}: ${e.message}`);
    }
  }
  console.log(`\nHit-rate: ${hits}/${doelen.length}`);
})();

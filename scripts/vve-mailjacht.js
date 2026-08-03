#!/usr/bin/env node
// VvE mail-jacht (batch): zoekt per radar-complex het mailadres van de VvE en
// slaat het resultaat op in de radar (KV vvemail via /api/vve-radar/mail).
// Ook negatieve resultaten worden opgeslagen zodat we niet dubbel zoeken.
// Gebruik: node vve-mailjacht.js <plaats> [minWoningen=10] [maxGebouwen=250]

const fs = require("fs");
const KEY = fs.readFileSync(`${process.env.HOME}/sonty/scripts/.anthropic-api-key.txt`, "utf8").trim();
const BASE = "https://sonty-website.vercel.app";
const CODE = { "x-bel-code": "sonty2288" };
const PLAATS = process.argv[2] || "Voorburg";
const MIN = parseInt(process.argv[3] || "10", 10);
const MAX = parseInt(process.argv[4] || "250", 10);
// --hernieuw: complexen die eerder niets opleverden opnieuw proberen, mits er
// inmiddels een officiele KvK-naam bij staat (daarmee is de zoekvraag sterker)
const HERNIEUW = process.argv.includes("--hernieuw");

async function zoekMail(g) {
  // Staat de officiele KvK-naam al in de radar? Dan zoeken we daar op: dat is
  // veel trefzekerder dan een adres, want VvE's publiceren onder hun eigen naam.
  const kvk = g.kvk?.n
    ? `\nDe VvE is bij de KvK ingeschreven als "${g.kvk.n}" (KvK-nummer ${g.kvk.k}${g.kvk.c ? `, correspondentieadres ${g.kvk.c}` : ""}). Zoek in de eerste plaats op die exacte naam.`
    : "";
  const vraag = `Zoek het e-mailadres van de Vereniging van Eigenaars (VvE) van het appartementencomplex aan de ${g.adres} in ${g.plaats} (postcode ${g.postcode}).${kvk} Ook waardevol: de officiële naam van de VvE en de naam van het beheerkantoor. Alleen gegevens die aantoonbaar bij DIT gebouw/deze VvE horen; corporaties/verhuurders die het hele gebouw bezitten tellen als beheerder, niet als VvE.
Antwoord UITSLUITEND met JSON: {"gevonden":true|false,"email":"","vve_naam":"","beheerder":"","bron_url":"","toelichting":"1 zin"}`;
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
  if (!r.ok) throw new Error(`api ${r.status}`);
  const d = await r.json();
  const txt = (d.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  const m = txt.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : { gevonden: false };
}

(async () => {
  const res = await fetch(`${BASE}/api/vve-radar?q=${encodeURIComponent(PLAATS)}&min=${MIN}`, { headers: CODE });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  // hoogste score eerst; al doorzochte gebouwen (mail-record aanwezig) overslaan
  const doelen = data.rows
    .filter((r) => !r.mail || (HERNIEUW && !r.mail.e && r.kvk?.n))
    .slice(0, MAX);
  console.log(`${data.totaal} complexen in ${data.zoek}; ${doelen.length} nog te doorzoeken (min ${MIN} won)`);

  let mails = 0, beheerders = 0, klaar = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < doelen.length) {
      const g = doelen[cursor++];
      try {
        const j = await zoekMail(g);
        await fetch(`${BASE}/api/vve-radar/mail`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...CODE },
          body: JSON.stringify({
            pandId: g.pandId,
            email: j.email || "",
            vveNaam: j.vve_naam || g.kvk?.n || "",
            beheerder: j.beheerder || "",
            bronUrl: j.bron_url || "",
          }),
        });
        if (j.email) mails++;
        else if (j.vve_naam || j.beheerder) beheerders++;
        klaar++;
        console.log(
          `${j.email ? "✔" : j.vve_naam || j.beheerder ? "~" : "✘"} [${klaar}/${doelen.length}] ${g.adres}` +
            (j.email ? ` → ${j.email}` : j.beheerder ? ` → beheer: ${j.beheerder}` : "")
        );
      } catch (e) {
        console.log(`! ${g.adres}: ${e.message}`);
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  console.log(`\nKlaar: ${mails} mailadressen, ${beheerders} alleen VvE-naam/beheerder, van ${doelen.length} gebouwen.`);
})();

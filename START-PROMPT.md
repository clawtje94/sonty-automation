# Startprompt voor nieuwe Claude-sessie (kopieer alles hieronder)

Je werkt voor Daimy Boot (Sonty, zonwering, Rijswijk) op zijn Mac mini. Taal: Nederlands, je-vorm.

STAP 0 — VERPLICHTE EERSTE ACTIES, in deze volgorde:
1. `cd ~/sonty && node scripts/read-telegram-webhook.js` (Telegram-berichten van Daimy lezen; elke vraag stel je ALTIJD ook via Telegram, bot-gegevens staan in de memory)
2. Lees `~/sonty/HANDOFF.md` volledig (stand van zaken, draaiende processen, wat NIET mag)
3. Lees de memory-index die automatisch geladen is en open de memory-files die relevant zijn voor deze opdracht (minimaal: zonradar, belscherm, credentials)

STAP 1 — SKILLS EERST: gebruik de skill `find-skills` om te zoeken naar skills die deze opdracht beter maken, en installeer wat nuttig is. Zoek minimaal naar: frontend/UI-design, kaarten/geodata, Next.js/Vercel best practices, Playwright/testen, en PDF/print. Pak daarna pas de bouwtaak op, en gebruik die skills ook echt tijdens het werk.

STAP 2 — DE OPDRACHT: maak van de Zonradar het best mogelijke product.
Wat er al staat (live): https://sonty-website.vercel.app/admin/zonradar (code sonty2288) — scan per buurt of kaartgebied, tuinrichting + zonuren per gevel per adres (BAG + kadaster + PDOK, open data), waarde-labels A/B/C, groene straat-chips, persoonlijke burenbrief ({{straat}}/{{richting}}/{{zonuren}}), PDF/CSV, verzendroute klaar voor postbode.nu. Code: `~/sonty-website/app/admin/zonradar/` + `app/api/zonradar/`. PoC-referentie: `~/sonty/scripts/zonradar-poc.js`.

Bouw in deze volgorde af:
1. **AI-luchtfotocheck**: per geselecteerde tuin de PDOK-luchtfotocrop laten beoordelen door een goedkoop vision-model (haiku): heeft dit adres al een overkapping/pergola of een kaal terras? Nieuw filter "nog geen zonwering". Batch, met kosteninschatting vooraf in de UI.
2. **Nieuwbouw-radar**: BAG pand-status "Bouwvergunning verleend"/"Bouw gestart" per gemeente scannen; nieuwe adressen bestaan al bij vergunning. Aparte tab in de tool.
3. **Klant-uitsluiting**: bestaande Sonty-klanten (HubSpot/register) niet aanschrijven.
4. **postbode.nu-koppeling activeren** zodra Daimy de API-key geeft: eerst ÉÉN testbrief naar Daimy's eigen adres, pas na zijn akkoord naar klanten. De huidige API-payload is een aanname en moet tegen hun documentatie gecontroleerd worden.
5. **Schaduw-verfijning** (AHN-hoogtedata) en grotere gebieden (pagination boven 1 km) als de rest staat.

HARDE REGELS (uit eerdere lessen, niet onderhandelbaar):
- NOOIT echte berichten (WhatsApp/brief/mail) naar klanten zonder expliciete toestemming van Daimy; testen alleen op zijn eigen gegevens (staan in memory)
- Niets verzinnen: alleen echte data en echte bronnen; aannames als aanname labelen
- Na elke oplevering: echte browser-screenshots als visuele check (mobiel én desktop)
- Altijd `npm run build` vóór push; git author daimyboot@gmail.com; deploy: `vercel build --prod` gevolgd door `vercel deploy --prebuilt --prod --archive=tgz`
- Altijd commit + push; werk van andere sessies in de repo niet terugdraaien
- Klaar of vraag? Meld het op Telegram

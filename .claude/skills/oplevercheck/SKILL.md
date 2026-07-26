---
name: oplevercheck
description: Verplichte zelf-review vóór je aan Daimy zegt dat iets gefixt, gemeten of klaar is. Gebruik dit ALTIJD voordat je een cijfer rapporteert, een fix oplevert of een analyse verstuurt. Voorkomt dat Daimy zelf de fout moet vinden.
---

# Oplevercheck

Daimy zei op 2026-07-26: *"ik snap niet dat elke keer als jij wat doet ik eerst wat moet vragen voordat je fouten vindt, software development gaat toch ook niet zo."*

Hij had drie keer op één dag gelijk:

| Ik rapporteerde | Hij vroeg | Werkelijkheid |
|---|---|---|
| "169 klanten wachten" | "zo veel zie ik er niet" | 36 — de rest was Scans/Orders/Werkbon |
| "e-mail escaleert 0,5%" | "gaat die mail escalatie wel goed?" | 67–90%, gemeten via een ander codepad |
| "bug gefixt en getest" | "hoeveel waren niet akkoord dan?" | Guard had 2 gaten, gevonden met data die er al lag |

**De rode draad: ik testte tegen gevallen die ik zélf bedacht, niet tegen wat er echt was gebeurd.** De data lag er alle drie de keren al. Dat is het verschil tussen unit-tests op je eigen aannames en een regressietest op productiedata.

## De vier poorten

Loop deze langs vóór je "gefixt", "klaar" of een cijfer naar buiten brengt. Kost minuten, en het alternatief is dat Daimy het vertrouwen in de rest van je rapport verliest.

### 1. Regressietest op echte historie, niet op bedachte voorbeelden

Zelf verzonnen testgevallen bevestigen je aannames; productiedata weerlegt ze. Zoek de echte gevallen op en draai je wijziging daarover.

- Bronnen bij Sonty: `data/ai-ks/log.jsonl` (alle AI-gesprekken met acties), `logs/*.log`, de Trengo-API, `data/ai-ks/*.json`.
- Bouw een guard of filter? Draai hem over **alle** historische gevallen en rapporteer twee getallen: hoeveel echte gevallen hij zou blokkeren (vals-positief) en hoeveel foute gevallen hij zou doorlaten (vals-negatief).
- Bij de akkoord-guard: een eerste versie blokkeerde 6 van de 26 echte akkoorden. Dat zou deals hebben gekost en was alleen zichtbaar door tegen de echte citaten te testen.

### 2. Noemer uitsplitsen

Elk cijfer eerst opsplitsen per kanaal, status, mailbox of bron, en per groep afvragen of die er thuishoort.

- Een getal dat hoger uitvalt dan verwacht is een signaal, geen resultaat.
- Rapporteer altijd wat je hebt weggefilterd en waarom, zodat het cijfer navolgbaar is.
- Zie ook de memory `feedback_cijfers_noemer_checken`.

### 3. Zoek het tweede codepad

Bij een uitkomst van nul of bijna nul: eerst zoeken of hetzelfde ergens anders anders wordt vastgelegd, vóór je "gebeurt vrijwel nooit" concludeert.

- Bij Sonty hebben WhatsApp en e-mail vaak aparte scripts: `daemon.js` tegenover `email-live.js` / `email-daemon.js`. Die loggen niet hetzelfde.
- Grep op de term in álle scripts, niet alleen in het bestand waar je toevallig zat.

### 4. Stel Daimy's vraag zelf

Zijn vragen zijn voorspelbaar. Stel ze vóór hij het doet:

- "Hoeveel zijn het er dan precies, en wat is hun status?"
- "Klopt dit met wat ik dagelijks zie?" Zo niet: eerst uitzoeken waarom.
- "Gaat het andere kanaal dan wel goed?"
- "Hoeveel goede gevallen raakt deze wijziging?"
- "Wat heb je níet gecontroleerd?"

## Hoe je oplevert

Wees expliciet over het verschil tussen wat je hebt gemeten en wat je hebt aangenomen.

- Zeg wat je hebt getest, tegen welke dataset, en met welke score.
- Zeg wat je **niet** hebt gecontroleerd. Bij een net herstarte daemon: de wijziging is live maar nog niet in een echt gesprek gezien. Dat is een andere claim dan "het werkt".
- Vind je onderweg een fout in je eigen eerdere rapport, corrigeer die dan zelf en zichtbaar. Niet wachten tot Daimy het opmerkt.

Zie ook: `feedback_correcties_permanent_borgen`, `feedback_geen_ongeverifieerde_aannames`, `feedback_geen_verzonnen_content`.

# Opvolging via AI — plan (21 juli 2026, opdracht Daimy: "eerst verzinnen en uitwerken, nog niet aanzetten")

## 1. Wat er nu al is

| Onderdeel | Status | Wat het doet |
|---|---|---|
| Reactief terugkomen (WA + mail) | **WERKT AL** | Klant die later terugkomt op een oud gesprek wordt gewoon opgepakt: de bot leest de hele gespreksgeschiedenis, kent de klant (RP/HubSpot/klantkaart) en pakt de draad op. Geldt voor WhatsApp én mail. Hier hoeft niets voor gebouwd te worden. |
| RP-herinneringsmails | AAN (via Reuzenpanda) | Automatische offerte-herinneringen per mail, met opt-out-flow ("geen herinnering meer"). Verdwijnt bij de RP-exit → moet t.z.t. vervangen worden. |
| Oude follow-up-WhatsApp-scripts | **UIT, blijft uit** | cron-followup-whatsapp.js / followup-3dagen.js / followup-offertes.js (plists in `uitgeschakeld/`). Bulk-blasts (25-200/dag, templates) — veroorzaakten juist de WhatsApp-spamwaarschuwing (3 juli). Deze aanpak NIET hergebruiken; hooguit de RP-queries als bron. |
| Vervolgvragen-watcher | AAN | Vangt vervolgvragen binnen lopende gesprekken — geen opvolging, wel verwant. |

Conclusie: **reactief zit het goed; proactief opvolgen bestaat effectief niet meer** (bewust uitgezet). Dit plan is de vervanger.

## 2. Ontwerp: "de AI loopt zijn lijstje na" (geen bulk)

Kernprincipe: géén massamailing, maar per klant een **individuele afweging door de agent** met volledige context — zoals een goede verkoper 's ochtends zijn openstaande offertes naloopt. Elk bericht is persoonlijk geschreven (geen template-tekst), gaat door de QA-poort en wordt gelogd.

### Triggers (elk max 1x per klant per traject)
| # | Trigger | Wachttijd (voorstel) | Bericht-idee |
|---|---|---|---|
| T1 | Prijsindicatie/offerte gedeeld in gesprek, klant daarna stil | 3 werkdagen | "Heb je nog ergens vragen over? Denk graag even mee." |
| T2 | Showroomafspraak geweest | 1-2 dagen erna | "Leuk dat je er was — kunnen we je ergens verder mee helpen?" |
| T3 | Showroomafspraak geannuleerd zonder nieuwe | 3 dagen | Nieuw moment aanbieden |
| T4 | Gesprek halverwege gestopt (bot wachtte op maten/framekleur/keuze) | 2 werkdagen | Vriendelijk herinneren aan het openstaande punt |
| T5 | Definitieve offerte na inmeten, klant stil | 4 werkdagen | Opvolgen; LET OP: afstemmen met RP-herinneringsmails (niet dubbel) |

### Werking (nieuw: `scripts/ai-ks/opvolging-daemon.js`, 1x per dag ±10:30, binnen bot-uren)
1. **Kandidaten verzamelen** uit log.jsonl (AI-gesprekken), Trengo en RP-status — dezelfde bronnen die er al zijn.
2. **Harde filters vóór er ook maar iets naar de AI gaat**: opt-out ("geen herinnering meer") · klant heeft al gereageerd · ticket ligt bij een mens/Mens nodig · al eerder opgevolgd (state in `data/ai-ks/opvolging-state.json`) · "geen interesse"-signaal in het gesprek · order al akkoord/afgerond.
3. **Agent beoordeelt per klant** (zelfde agent.js + context): is opvolging hier gepast, en zo ja schrijf een kort persoonlijk bericht in de toon van het gesprek. Twijfel → overslaan. Nooit korting aanbieden in een opvolger.
4. **QA-poort** keurt elk bericht zoals altijd; afkeuring = overslaan (nooit vangnet-bericht bij proactief contact).
5. **Kanaal = kanaal van het gesprek**: WhatsApp via Trengo (als Jaimy), mail via Sunny in de bestaande thread.
6. **Spam-remmen (hard in code)**: max 10 opvolgingen per dag (start; later op te schroeven) · max 1 opvolging per traject · minimaal 30 dagen tussen twee opvolgingen bij dezelfde klant · teller + lijst in het ochtendrapport · kill-switch: bestand `data/ai-ks/OPVOLGING_STOP`.
7. **Aan-knop**: `scripts/ai-ks/.opvolging-live` (zelfde patroon als showroom) — bestaat pas na expliciet akkoord Daimy. Tot die tijd: schaduwmodus mogelijk (voorstellen alleen loggen + in dagrapport, niets versturen) zodat we een week kunnen meekijken wat hij gestuurd zóu hebben.

## 3. Aandachtspunten / beslissingen voor Daimy
1. **WhatsApp 24-uursvenster**: officieel mag je buiten 24u na het laatste klantbericht alleen goedgekeurde template-berichten sturen. De offerte-link-WhatsApps van v4 gaan nu ook al proactief via Trengo — uitzoeken hoe die route het doet (template of sessie) en dezelfde route gebruiken. Risico bij negeren: WABA-blokkade.
2. **Dubbelloop met RP-herinneringsmails**: kiezen — (a) T5-mail-opvolging pas ná de RP-exit, of (b) RP-herinneringen uitzetten voor klanten die de AI opvolgt. Voorstel: (a), voorlopig alleen T1-T4.
3. **Timing en maximum**: kloppen de voorgestelde wachttijden en max 10/dag?
4. **Schaduwweek**: eerst een week schaduwdraaien (alleen loggen) vóór echt versturen? Voorstel: ja.

## 4. Bouwvolgorde (na akkoord)
1. opvolging-daemon.js met filters + state + schaduwmodus (1 dag werk).
2. Ochtendrapport-integratie + kill-switch + health-check.
3. Schaduwweek → rapport → Daimy beslist → `.opvolging-live`.

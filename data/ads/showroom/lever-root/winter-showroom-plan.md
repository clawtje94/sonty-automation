# Winterverkoop en showroom-flow (05-09-2026)

Bronnen: offerte-register 2025+2026 (21.093 rijen, methode conversie-meten), MS Bookings (kalender SontyMontage1, dienst "Afspraak showroom", 45 min), Trengo-kennisbank (Deel 1, 15, 18, 19, 21), Sunny-regels, bot-gesprekken, sonty.nl/showroom.

## 1. Wat verkoopt in de winter (okt-feb), uit het register
| Product | Winter offertes | Akkoord winter | Gem. offerte | Zomer akkoord | Conclusie |
|---|---|---|---|---|---|
| Rolluiken | 1.622 | 12,2% | €2.409 | 11,7% | Volume-product nr. 1, converteert in de winter net zo goed. Ads lopen (set klaar). |
| Knikarmscherm | 257 | **20,6%** | €3.616 | 10,2% | Wie in de winter aanvraagt is serieus: 2x zo hoge slaging. Vroegboek-hoek ("hangt vóór de eerste mooie dag", 8-10 weken). |
| Raamdecoratie binnen | 104 | **26,9%** | €2.280 | 52,1% | Hoogste slaging van alles, weinig volume: hier zit groei. Isolerende honingraat-plissé, verduisterend voor slaapkamer, 7 jaar fabrieksgarantie (Toppoint). Showroom-product bij uitstek. |
| Screens | 369 | 10,6% | €3.664 | 9,0% | Blijft lopen, geen winterhaakje behalve privacy in donkere avonden. |
| Markiezen | 40 | 20,0% | €3.954 | 13,8% | Klein, maar hoge slaging en hoge orderwaarde. Google Ads staat uit nov-jan; via showroom/mail wel meenemen. |
| Uitvalscherm | 42 | 19,0% | €2.252 | 8,2% | Zelfde patroon als knikarm: serieuze winteraanvragers. |
| Reparatie/service | 33 | 21,2% | €682 | 64,0% | Winter = onderhoudsmoment; eigen serviceteam, ook niet-Sonty zonwering. Lage orderwaarde, wel deurbel voor cross-sell. |
| Pergola | 545 | 2,6% | €7.814 | 2,0% | Veel aanvragen, vrijwel geen slaging; leads onbetaalbaar (CPA-memo). Alleen via showroom-route. |

Extra winterproducten uit de kennisbank en site die nu geen ads hebben: Duette/honingraat-plissé (isolatie), verduisterende rolgordijnen (slaapkamer, donkere ochtenden), Arte behang (woonmaand, showroom), shutters, vloeren (portfolio bestaat, 6 offertes). Kennisbank Deel 18: winter = rustigste periode, snelste levering, "nu bestellen = klaar voor het voorjaar". Doorlopend: 15% actiekorting op maatwerk-zonwering, 20% op voorraadschermen (Deel 21, Sunny zegt dit).

**Advies volgorde winter-ads na rolluiken:** 1) knikarm/uitval vroegboek (jan-feb, hoge slaging), 2) raamdecoratie binnen met showroom als CTA (okt-dec, woonmaand), 3) reparatie/onderhoud (nov-jan, lokaal, klein budget), 4) markiezen alleen retarget.

## 2. Showroom: de cijfers
- Kanaal Winkel 2026 (jan-aug): 426 offertes, **51,4% akkoord, gem. €5.193** tegenover Online 11.138 offertes, 6,5%, €3.641. Per product in de winkel: knikarm 65%, pergola 57%, raamdeco 53%, rolluiken 52%, screens 43%.
- Winkel-offertes per maand 2026: jan 30 (50%), feb 45 (60%), mrt 61 (74%), apr 37, mei 40, jun 33, jul 94 (37%), aug 86 (26%, nog onrijp).
- Afkomst van winkelklanten: Winkel 140, Google 102, Instagram 94, Bekenden 18, Buren 17, Facebook 14. Ads brengen dus wél mensen naar de showroom.
- Showroomafspraken via Bookings (ondergrens, API telt max 200 afspraken/maand): aug-25 14, sep 15, okt 11, nov 12, dec 26, jan 23, **feb 37**, mrt 26, apr 17, mei 11, jun 24, jul 36, aug 15. Winter is een sterke showroomperiode.
- Verschil winkel-offertes (±50/mnd) en boekingen (±20/mnd): een groot deel loopt binnen zonder afspraak.

## 3. Wat klanten echt vragen (bot-gesprekken, mail, kennisbank)
"ik wil langskomen in de winkel zaterdag", "showroom afspraak inplannen", "op welk nummer is de showroom bereikbaar", "welke merken hebben jullie", "kan ik doorkijk-doek zien", "lastig kiezen", prijsbezwaar ("andere leverancier goedkoper"). Sunny biedt showroom aan bij twijfel, prijsbezwaar en nurture (memory: showroom converteert ~10x, nu bevestigd met 51% vs 6,5%).

## 4. Showroom-flow (voorstel)
| Stap | Wat | Bestaat al | Te doen |
|---|---|---|---|
| 0 Trigger | Ads koud (twijfelaars, kleur kiezen), retarget open prijsindicaties ("kom 'm bekijken"), Sunny bij twijfel/prijsbezwaar, mailflows | Sunny-regel, Bookings-link, /showroom-pagina | Ads (zie 5), Klaviyo-mails showroom-CTA prominenter |
| 1 Boeken | /showroom → Bookings (45 min) | Ja | Bookings-vraag "Waar kom je voor?" toevoegen (adviseur bereidt voor); tekst site vs kennisbank gelijktrekken (V4) |
| 2 Vóór bezoek | Bevestiging (Bookings) + WhatsApp 1 dag vooraf: "neem maten of een foto van je raam mee, dan rekenen we ter plekke" | Bevestiging ja, WhatsApp nee | Script op Bookings-kalender + Trengo; eerst scenario-run, dan bouwen (regel) |
| 3 Bezoek | Prijsindicatie open in offerte-tool winkel, tekenen aan tafel, aanbetaling | Ja (winkelflow, tekenen-keten) | Adviseur checklist: product, maat, kleur, bediening, montagedatum |
| 4 Ná bezoek zonder akkoord | Dag 2 WhatsApp met voorstel + "wat hield je tegen", dag 7 herinnering | Deels (Sunny-escalatie na 4 dgn) | Winkel-leads apart taggen (kanaal Winkel) zodat de opvolging niet in de online-stroom valt |
| 4b No-show | Zelfde dag WhatsApp met nieuwe tijden (Sunny kan verzetten) | Sunny kan verzetten | Trigger op Bookings-status |
| 5 Meten | Winkel-offertes en akkoord% per maand (register), boekingen (Bookings), ads-afkomst | Register, Bookings-API | Weekregel in weekrapport: showroombezoeken, winkel-akkoord%, kosten per showroombezoek |

Doelstelling winter: van ±20 naar 40 geboekte bezoeken per maand. Elk extra bezoek is bij 51% en €5.193 gemiddeld ruwweg €2.600 omzet, dus een showroom-lead mag fors meer kosten dan een online-lead (max CPA winter Meta €46 per online-lead; showroom-lead break-even ligt 5-8x hoger).

## 5. Showroom-ads (gebouwd 05-09, `data/ads/showroom/`)
Kaart-formule (winnaar) op echte showroomfoto's, plus 4 teststijlen. Claims uit de kennisbank: werkende modellen van alle producten, alle doek- en kleurstalen, raamdecoratie en Arte behang, persoonlijk advies, Frijdastraat 8F Rijswijk, afspraak 45 minuten, winter = rustig en snelste levering. Geen openingsdagen of "binnenlopen" op de beelden totdat V4 beantwoord is. CTA: "Plan je showroombezoek" naar de Bookings-link.

## Open vragen voor Daimy
- V4: showroom alleen op afspraak (kennisbank: wo/vr/za) of ook binnenlopen (website)? Bepaalt de tekst op ads, site en Sunny.
- V5: mag "15% actiekorting op maatwerk-zonwering" in ads? Sunny zegt het al tegen klanten.
- V6: welk winterproduct na rolluiken eerst: knikarm vroegboek, raamdecoratie binnen, of reparatie/onderhoud?

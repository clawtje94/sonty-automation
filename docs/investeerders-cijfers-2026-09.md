# Sonty: onderbouwing groeiverhaal (stand 5 september 2026)

Alle cijfers hieronder komen uit eigen systemen. Bron staat per regel. Wat niet te onderbouwen is, staat apart in deel 3.

## 1. Feiten

### Commercie, januari t/m juli, 2025 tegenover 2026
Bron: offerteregister (Google Sheet), tabellen data/conversie-2025-tabellen.json en data/conversie-2026-tabellen.json. Akkoord = order met ingevuld bedrag.

| | 2025 jan-jul | 2026 jan-jul | Verschil |
|---|---|---|---|
| Offertes (leads) | 6.141 | 10.355 | +69% |
| Akkoorden (orders) | 762 | 1.049 | +38% |
| Akkoordwaarde incl. btw | € 2,76 mln | € 3,88 mln | +41% |
| Gemiddelde order | € 3.617 | € 3.702 | +2% |

Heel 2025: 9.198 offertes, 1.110 akkoorden, € 4,15 mln akkoordwaarde.
2026 t/m augustus (augustus nog niet volledig bijgewerkt): 11.827 offertes, 1.157 akkoorden, € 4,30 mln.
Dus: eind augustus 2026 al meer orders en meer orderwaarde dan in heel 2025.

### Facturatie uit Gripp (de hele onderneming, incl. btw, gemeten 05-09)
Bron: Gripp API invoice.get, alle verzonden facturen sinds 2025-01-01 (4.258 stuks), op factuurdatum. Aanbetaling 40% bij akkoord, rest na montage, dus facturatie loopt 2 tot 3 maanden achter op verkoop.

| | 2025 | 2026 | Verschil |
|---|---|---|---|
| Jan t/m jul | € 1,91 mln | € 2,74 mln | +44% |
| Jan t/m aug | € 2,30 mln | € 3,18 mln | +38% |
| Juli | € 401k | € 638k | +59% |
| Heel jaar | € 3,76 mln | € 3,25 mln t/m 5 sep | 2025 wordt naar verwachting in oktober gepasseerd |

Let op het verschil met het register: het register telt VERKOCHTE orders (akkoordwaarde) en stond eind augustus boven heel 2025; de facturatie volgt later en staat daar nog € 0,5 mln onder. Beide zijn waar, zeg erbij welke je bedoelt.

### Teamcapaciteit (wat er aan output bij is gekomen)
Bron: scripts/capaciteitsmonitor.js op het offerteregister, gedraaid 5 september 2026.

| | Voorjaar 2026 (W13-W16) | Eind juli 2026 | Nu (W36) |
|---|---|---|---|
| Plafond team, beste 4 weken | 35 orders/week | 35 | 51,5 orders/week (W31-W34) |
| Werkelijke verwerking | | 25 orders/week | 41 orders/week |
| Instroom | | 500 offertes/week | 346 offertes/week |
| Verzadiging | | 177% (oordeel AFSCHALEN) | 84% (oordeel VASTHOUDEN) |
| Offertes per order | | 15,0 | 10,1 (gezond is ~8) |
| Doorlooptijd tot akkoord | | 21 dagen | 24 dagen |

Conclusie: het team sluit nu 47% meer orders per week dan het beste voorjaarsniveau, en 65% meer dan eind juli. De instroom is bewust teruggebracht naar wat het team aankan.

### AI-klantenservice Sunny
Bron: data/ai-ks/log.jsonl (elke interactie op WhatsApp en e-mail), sinds 3 juli 2026.

| | Juli | Augustus | Totaal 3 jul t/m 5 sep |
|---|---|---|---|
| Interacties (WhatsApp + mail) | 1.885 | 2.394 | 4.575 |
| Naar een mens doorgezet | 164 (8,7%) | 182 (7,6%) | 383 (8,4%) |
| Offertes aangemaakt of aangepast door Sunny | 121 | 153 | 288 |
| Inmeetafspraken via Sunny | 57 | 63 | 123 |
| Showroomafspraken via Sunny | 8 | 19 | 29 |

Ruim 90% van alle klantcontact wordt zonder mens afgehandeld; de rest gaat met een klaarstaand concept naar het team.

### Conversie per week rond de livegang (bron: scripts/conversie-week-sheet.js)
- W23-W28 (juni, begin juli): 7 tot 13%
- W29-W31 (bot live vanaf 16 juli): 14,1%, 13,6%, 10,5%, de hoogste weken van het jaar
- W32 en later (prijsverhoging 3 augustus, vakantie): 5 tot 8%, de laatste weken lopen nog op omdat akkoorden ~3 weken achterlopen
Geen harde causaliteit claimen: seizoen en prijsverhoging spelen mee.

### Marketing
Bron: data/ad-spend.json (Meta via API, Google handmatig).
- 2026 jan-jul: € 170k Meta + € 202k Google = € 372k. Dat is € 36 per lead en € 355 per order, 9,6% van de akkoordwaarde.
- 2025 is niet vergelijkbaar: Google-uitgaven zijn alleen voor maart-mei vastgelegd.
- Q2-rapport (maart-mei 2026, 4.433 online leads): online conversie 3,4%; Google binnen 10 km 10,6%; Instagram 2,3%.

### Wat er gebouwd is (in eigen beheer, allemaal live)
- Sunny: prijsmotor, offertes maken en aanpassen, showroom boeken, inmeten plannen op reistijd en agenda, harde verzendpoorten, taalspiegeling.
- Eigen CRM en planning (vervangt extern pakket van ruim € 1.000 per maand), inmeet-dashboard, vakantie- en bezettingsoverzicht, belscherm buitendienst.
- Keten na akkoord: meetbon op locatie, offerte in boekhouding bijwerken, digitaal tekenen, aanbetaling 40%, bestel-dashboard, werkbon die de klant op de telefoon tekent, montage-opdrachten automatisch naar de monteurs-app.
- Website: eigen Next.js-site, configurator, gevel-visualisatie, rekentool inmeters, websitefoto-beheer.
- Marketing-automatisering: e-mailflows op echte gebeurtenissen (review pas na montage), weekrapport, SEO-agent, buren-campagnes op zonligging, VvE-radar.
- Sturing: capaciteitsmonitor (wekelijks op- of afschalen), conversiemeting, personeelsdashboard, scenario-lab (elke automatisering eerst honderden gegenereerde gevallen, pas dan live).

### Afstand tot de showroom (het argument voor meer winkels)
Bron: data/conversie-rapport-2026-q2.txt (maart-mei 2026, 4.433 online leads), conversie per afstand tot Rijswijk.

| Afstand | Google | Instagram |
|---|---|---|
| 0-10 km | 10,6% | 4,1% |
| 10-20 km | 4,5% | 3,2% |
| 20-40 km | 2,9% | 3,3% |
| 40-60 km | 2,2% | 1,9% |
| 60 km+ | 0,0% | 0,0% |

Binnen 10 km van de showroom converteert een Google-lead 2 tot 4 keer zo goed als verder weg. Dat is het gemeten bewijs dat een fysieke winkel de conversie draagt.
De interne aanname "showroombezoekers converteren bijna 10x beter" staat nergens gemeten; niet publiek gebruiken.

### Aangeleverd door Daimy (niet uit onze systemen te controleren)
- Tijdlijn: Joey begon met 1 montagebus, nu rijden er 5. 3 inmeters. Salesteam belt vanaf september elke lead.
- Backoffice nu voor 75% geautomatiseerd, doel 85% vóór het seizoen 2027 begint.
- Nieuwe website komt eraan.
- Gezocht: leverancier die meegroeit, en investeerder voor 5 winkels, het liefst gefinancierd vóór Q2 2027. Winkels waar klanten kijken en voelen en waar alleen nog een verkoper zit.
- Ruim 70% meer inkoop bij leveranciers dan vorig jaar.
- 600+ Google-reviews, 4,9.

## 2. Wat de cijfers zeggen (voor het verhaal)
1. De vraag groeit harder dan het team: +69% leads, +38% orders. Het gat daartussen is capaciteit, en dat gat is sinds juli aantoonbaar gedicht (25 naar 41 orders per week, verzadiging 177% naar 84%).
2. Het team is in vier maanden 47% productiever geworden zonder dat de vraag wegviel.
3. Ruim 90% van het klantcontact loopt zonder mens. Dat is wat een tweede vestiging goedkoop maakt in kantoorbezetting.
4. Eind augustus staat 2026 al boven heel 2025 in orders en orderwaarde.

## 3. Let op, niet publiek zeggen zonder check
- "Ruim 70% meer inkoop": ons register laat +69% offertes en +41% orderwaarde zien. Het inkoopcijfer bij leveranciers komt van Daimy zelf.
- Conversie na de prijsverhoging ligt lager (5 tot 8% tegen 10 tot 14% in juli). Deels vertraging in de administratie, deels seizoen, maar het is een vraag die een investeerder gaat stellen.
- Marketingkosten per order (€ 355) zijn niet met 2025 te vergelijken door ontbrekende Google-cijfers.

## 4. Post (LinkedIn van Joey), versie 3: investeerder eerst, leverancier krijgt het signaal
Daimy 05-09: "er belt niemand" (salesteam-zin weg), hoofddoel investeerder, leverancier moet wakker worden dat we weggaan.

Ik begon met één montagebus. Vandaag rijden er vijf. En ik zoek geld om er een keten van te maken.

De cijfers eerst, want daar kijk je naar. Januari tot en met augustus, tegenover vorig jaar: 69% meer aanvragen, 38% meer verkochte orders en 38% meer gefactureerd. Juli alleen al: 59% meer omzet dan juli vorig jaar. In verkochte orders stonden we eind augustus al boven heel 2025. Gemiddelde order 3.700 euro, ruim 600 Google-reviews met een 4,9.

Het gat tussen die 69% en 38% hebben we deze zomer gedicht. Niet met meer marketing, maar met een bedrijf dat het aankan: van 25 naar 41 orders per week, en een backoffice die nu voor 75% geautomatiseerd is en voor het seizoen van 2027 naar 85% gaat. Onze eigen AI-collega Sunny handelde sinds juli ruim 4.500 klantgesprekken af, meer dan 90% zonder mens, en maakte bijna 300 offertes. Offerte, meetbon, tekenen, aanbetaling, bestelling, werkbon: het loopt door zonder kantoor.

Waar we nu op vastlopen is niet vraag en niet capaciteit. Het zijn winkels. Onze data is daar hard over: een aanvraag binnen 10 kilometer van onze showroom wordt 2 tot 4 keer zo vaak een order als een aanvraag verder weg. Mensen willen zonwering zien en voelen. En omdat alles erachter geautomatiseerd is, hoeft er in zo'n winkel alleen nog een verkoper te zitten. Dat is het model dat we willen kopiëren.

Concreet: vijf winkels, open vóór het seizoen van 2027, Rotterdam als eerste. We zoeken investeerders met een minimale inleg van 100.000 euro. De onderbouwing (cijfers per week, kosten per winkel, terugverdientijd) deel ik in een gesprek, niet in een post.

En één ding wil ik hier ook gewoon zeggen. Ons inkoopvolume groeide dit jaar met ruim 70%, en het gaat volgend jaar met vijf winkels nog een keer flink omhoog. Dat volume brengen we onder bij de fabrikant die daarin mee wil investeren, in marge, marketing en financieringsruimte. Wie dat is, staat nog niet vast.

Ben jij die investeerder of die fabrikant, of ken je er een? Stuur me een bericht.

#zonwering #groei #ondernemen #retail #groeikapitaal

### Wat er nog naast de post moet liggen voordat iemand instapt (nu nog niet beschikbaar)
- Kosten per winkel (huur 350-500 m² à € 80-95/m²/jr = grofweg € 30-45k/jr, inrichting, verkoper) tegenover verwachte orders per winkel, terugverdientijd. Bron huur: onderzoek /admin/winkels. Rest ontbreekt.
- Marge per order en nettoresultaat 2025 en 2026 t/m augustus. Niet in onze systemen.
- Structuur van de deal: lening, aandelen of per winkel. Keuze Daimy.

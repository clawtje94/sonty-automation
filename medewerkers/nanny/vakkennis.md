# Vakkennis Nanny — Planner inmeten (bijgewerkt 2026-09-07)

## Zo werken de besten (10-15 concrete regels)
1. Reageer binnen 5 minuten op een nieuwe aanvraag; latere reactie kan conversie tot 9x lager maken.
2. Bevestig met vaste cadans: verzoek 24-72u vooraf, korte herinnering 2-4u vooraf ("onderweg"-bericht); dit brengt no-shows richting 8-12%, met SMS-gebaseerde flows zelfs onder 5%.
3. Gebruik SMS voor de laatste, tijdgevoelige herinnering (98% open rate) i.p.v. alleen mail (20-25%); laat klant met één simpel antwoord bevestigen/verzetten.
4. Als een klant niet bevestigt tegen een vaste tijd (bv. 08:00 die dag), bel na; onbereikbaar → slot vrijgeven voor een bevestigde of wachtende klant.
5. Houd aankomstmarges kort (Sonty: "een uur eerder of later"); brede vensters zijn een hoofdoorzaak van no-shows.
6. Cluster inmeetafspraken in vaste geografische zones per dag/technicus (richtlijn 15-20 km straal) i.p.v. puur op boekingsvolgorde; scheelt 20-45% reistijd en kan 1-2 extra afspraken per dag opleveren.
7. Bewaak technicus-bezetting rond 75-80%; hoger dan mid-80% laat geen ruimte meer voor spoed of uitloop en werkt averechts.
8. Volg on-time arrival en SLA-compliance als aparte KPI's naast bezetting; koplopers in de branche zitten inmiddels op 85-91%, dus structureel lager is een signaal.
9. Bied een vrijgekomen slot automatisch en binnen enkele minuten aan aan de eerstvolgende wachtende in prioriteitsvolgorde, niet handmatig per geval uitzoeken; goed uitgevoerd vult dit 30-50% van geannuleerde sloten.
10. Bij geen reactie op een aanbod: vaste opvolg-cadans i.p.v. losse pogingen — snel na elkaar in het begin, uitlopend later over 2-3 weken, daarna pas "verlopen" zetten.
11. Een "stille" klant is meestal geen "nee" maar een "nu even niet"; onderscheid dat van een defecte melding (niet bezorgd, verkeerd kanaal) voordat je iemand van de lijst haalt.
12. Elke mutatie (boeking, annulering, verzet) moet in alle drie systemen kloppen (Outlook, Planado, Bookings) — een mismatch daartussen is een KPI op zich, niet een bijzaak.
13. Rapporteer mislukte mutaties altijd per oorzaak (klant niet gereageerd / systeemfout / dubbele boeking), nooit één totaalgetal.
14. Bij twijfel over een systeemactie: niet zelf oplossen buiten mandaat, expliciet voorleggen — een verkeerde automatische actie kost meer dan een dag wachten op een beslissing.

## Dagelijkse routine van een topper (kort, in volgorde)
1. Nieuwe aanvragen/reacties van afgelopen 24u eerst (snelheid is conversie).
2. Bevestigingsstatus van morgen/overmorgen checken, onbevestigden bellen of escaleren.
3. Vrijgekomen sloten direct doorzetten naar de wachtlijst.
4. Systemen kruiselings checken op mismatches (boeking staat overal, niemand dubbel).
5. Stil/verlopen-lijst bijwerken en pas na vaste cadans echt laten vervallen.
6. Cijfers per oorzaak vastleggen voor het dagrapport.

## Cijfers waarop de besten sturen (KPI's en normen, met bron)
- Reactietijd op nieuwe aanvraag: binnen 5 minuten (bron: Sleekflow AI-boekingsagent blog 2026).
- No-show rate: automatische reminders brengen dit naar 8-12% (ServiceTitan-cijfer via getprosper.ai gids mei 2026), SMS-gebaseerde flows tot onder 5%.
- SMS open rate 98% tegenover mail 20-25% — reden om de laatste herinnering via SMS te sturen (bron: getprosper.ai appointment reminders gids 2026).
- Technicus-/planningsbezetting: 75-80% target, geen structurele overschrijding mid-80% (bron: VSight field service KPI-overzicht 2026).
- On-time arrival en SLA-compliance als vaste dispatcher-KPI: koplopers 85-91% on-time (voorbeeld: bedrijf van 76% naar 91% na route-optimalisatie), SLA-compliance boven 90% (bron: ServiceTitan field service metrics 2026).
- Geografisch clusteren scheelt 20-45% reistijd en levert 1-2 extra afspraken per dag op (bron: Fieldproxy dispatcher-guide en Mapline routing-gids 2026).
- Automatische wachtlijst-rebooking vult 30-50% van geannuleerde sloten, vaak binnen minuten (bron: AI meeting scheduler blueprint, rework.com 2026).

## Valkuilen die de besten vermijden
- Te brede aankomstvensters aanbieden "voor de zekerheid" — vergroot no-shows juist.
- Bezetting maximaliseren tot boven 85-90%: lijkt efficiënt, breekt de buffer voor spoed en uitloop.
- Wachtenden pas na lange stilte individueel navragen in plaats van een vaste, voorspelbare cadans te volgen.
- Eén totaalcijfer "X mislukt" rapporteren zonder oorzaak — daarmee kan niemand bijsturen.
- Systemen los van elkaar laten lopen (Outlook wel, Planado niet) en dat pas ontdekken bij een no-show op locatie.
- Alleen op boekingsvolgorde plannen in plaats van geografisch clusteren — onnodige reistijd en minder capaciteit per dag.

## Wat ik hiervan vanaf morgen anders doe (3 punten, concreet)
1. Bij een klant met verhoogd no-show-risico (nog niet bevestigd dicht tegen de afspraakdatum) stel ik expliciet voor de laatste herinnering via SMS te laten lopen i.p.v. alleen mail, want SMS heeft een veel hogere open rate; ik verstuur dit zelf niet, alleen als voorstel.
2. Bij een vrijgekomen slot vermeld ik in mijn rapport expliciet of dit binnen enkele minuten automatisch aan de eerstvolgende wachtende is aangeboden, en meld het als afwijking als dat niet is gebeurd.
3. Als boekingen zonder geografische logica door het werkgebied verspreid raken (Joey/Sjoerd kris-kras op dezelfde dag), meld ik dat als aandachtspunt aan Daimy/Techniek in plaats van het alleen als "gepland" af te vinken.

## Bronnen
- https://www.servicetitan.com/blog/field-service-metrics — actueel (2026) KPI-overzicht incl. on-time arrival en SLA-compliance benchmarks.
- https://vsight.io/field-service-kpis/ — bezettingsnorm 75-80% en KPI-formules voor field service.
- https://www.getprosper.ai/blog/appointment-reminders-reduce-no-shows-guide — reminder-cadans en no-show-percentages, met bron ServiceTitan 2024.
- https://resources.rework.com/libraries/ai-agents/ai-meeting-scheduler-agent — blueprint voor AI-scheduler met wachtlijst-rebooking cijfers.
- https://www.fieldproxy.ai/resources/blog/guide-to-dispatcher — dispatcher-strategie: geografisch clusteren, skill-matching, real-time herplannen.
- https://mapline.com/dispatch-and-routing-software-for-service-techs/ — route-optimalisatie en effect op reistijd/capaciteit.
- https://www.paulenpaul.nl/vacature-planner.html — vacaturetekst planner kozijnen & zonwering, wat een topbedrijf in dit exacte vakgebied vraagt.

# Vakkennis Nanny — Planner inmeten (bijgewerkt 2026-08-29)

## Zo werken de besten (10-15 concrete regels)
1. Reageer binnen 5 minuten op een nieuwe aanvraag; latere reactie kan conversie tot 9x lager maken.
2. Stuur een bevestigingsverzoek 24-48u vooraf, plus een herinnering 2-4u vooraf; dit haalt no-shows met tot 40% omlaag.
3. Als een klant niet bevestigt tegen een vaste tijd (bv. 08:00 die dag), bel handmatig na; onbereikbaar → slot vrijgeven voor een bevestigde klant. Dit alleen scheelt al 30-40% no-shows.
4. Houd aankomstmarges kort (Sonty: "een uur eerder of later"); brede vensters (halve dag) zijn een hoofdoorzaak van no-shows.
5. Cluster inmeetafspraken geografisch per route/dag om reistijd tussen Joey/Sjoerd te minimaliseren, niet puur op wie het eerst boekt.
6. Bewaak technicus-bezetting rond 75-80%; hoger dan mid-80% laat geen ruimte meer voor spoed of uitloop en werkt averechts.
7. Bij geen reactie op een aanbod: vaste opvolg-cadans i.p.v. losse pogingen — snel na elkaar in het begin, uitlopend later (richtlijn: meerdere contactmomenten over 2-3 weken), daarna pas "verlopen" zetten.
8. Een "stille" klant is meestal geen "nee" maar een "nu even niet"; onderscheid dat van een defecte melding (niet bezorgd, verkeerd kanaal) voordat je iemand van de lijst haalt.
9. Wachtlijst/vrijgekomen sloten automatisch aanbieden aan de eerstvolgende wachtende, niet handmatig per geval opnieuw uitzoeken.
10. Elke mutatie (boeking, annulering, verzet) in de planning moet in alle drie systemen kloppen (Outlook, Planado, Bookings) — een mismatch daartussen is een KPI op zich, niet een bijzaak.
11. Rapporteer altijd uitgesplitst per oorzaak (klant niet gereageerd / systeem-fout / dubbele boeking), nooit één totaalgetal "mislukt".
12. Bij twijfel over een systeemactie: niet zelf oplossen buiten mandaat, expliciet voorleggen — een verkeerde automatische actie kost meer dan een dag wachten op een beslissing.

## Dagelijkse routine van een topper (kort, in volgorde)
1. Nieuwe aanvragen/reacties van afgelopen 24u eerst (snelheid is conversie).
2. Bevestigingsstatus van morgen/overmorgen checken, onbevestigden bellen of escaleren.
3. Vrijgekomen sloten meteen doorzetten naar wachtlijst.
4. Systemen kruiselings checken op mismatches (boeking staat overal, niemand dubbel).
5. Stil/verlopen-lijst bijwerken en pas na vaste cadans echt laten vervallen.
6. Cijfers per oorzaak vastleggen voor het dagrapport.

## Cijfers waarop de besten sturen (KPI's en normen, met bron)
- Reactietijd op nieuwe aanvraag: binnen 5 minuten (bron: branche-analyses AI-boekingsagenten, o.a. Salesforce/Sleekflow-achtergrondartikelen 2026).
- No-show rate: doel richting <10-15% via bevestiging + korte vensters (bron: FieldServicely/BuildOps best-practice-artikelen 2026).
- Technicus-/planningsbezetting: 75-80% target, geen structurele overschrijding mid-80% (bron: VSight/ServiceTitan field service KPI-overzichten 2026).
- On-time arrival rate en SLA-compliance als vaste dispatcher-KPI naast bezetting (bron: ServiceTitan field service metrics 2026).
- Follow-up op een gemiste/onbevestigde afspraak: binnen 15 minuten eerste poging, tweede poging 2-4 uur later (bron: EveryCatch no-show follow-up guide 2026).

## Valkuilen die de besten vermijden
- Te brede aankomstvensters aanbieden "voor de zekerheid" — vergroot no-shows juist.
- Bezetting maximaliseren tot >85-90%: lijkt efficiënt, breekt de buffer voor spoed en uitloop.
- Wachtenden pas na lange stilte individueel navragen in plaats van een vaste, voorspelbare cadans te volgen.
- Eén totaalcijfer "X mislukt" rapporteren zonder oorzaak — daarmee kan niemand bijsturen.
- Systemen los van elkaar laten lopen (Outlook wel, Planado niet) en dat pas ontdekken bij een no-show op locatie.

## Wat ik hiervan vanaf morgen anders doe (3 punten, concreet)
1. Klanten die > 5 werkdagen zonder tijd zitten niet in één keer "verlopen" zetten, maar eerst checken of ze een vaste opvolg-cadans (meerdere contactmomenten over 2-3 weken) hebben doorlopen; dat rapporteer ik expliciet aan Daimy per naam voordat ik verlopen voorstel.
2. In mijn dagrapport mislukte mutaties voortaan altijd uitsplitsen naar oorzaak (klant stil / systeemfout / dubbele boeking) i.p.v. één totaal.
3. Bij een boeking zonder bevestiging in logs (zoals Annemarie Westerneng) expliciet checken op systeemmismatch tussen Outlook/Planado/Bookings, en dat als aparte afwijkingsregel melden, niet alleen als "check nodig".

## Bronnen
- https://www.fieldservicely.com/blog/how-to-reduce-missed-appointments-in-field-service — concrete cijfers over bevestigingsproces en effect op no-shows.
- https://vsight.io/field-service-kpis/ — KPI-formules en benchmarks voor first-time-fix en bezetting.
- https://www.servicetitan.com/blog/field-service-metrics — actueel (2026) overzicht kern-KPI's voor field service, incl. bezettingsrisico's.
- https://www.paulenpaul.nl/vacature-planner.html — vacaturetekst planner kozijnen & zonwering, wat een topbedrijf in dit exacte vakgebied vraagt.
- https://everycatch.com/learn/articles/how-to-follow-up-after-a-no-show-appointment — opvolgcadans en tijdslijnen voor gemiste afspraken.
- https://sleekflow.io/en-us/blog/ai-booking-agent — effect van reactiesnelheid op boekingsconversie voor AI-boekingsassistenten.

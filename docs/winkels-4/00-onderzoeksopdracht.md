# Onderzoeksopdracht: locatiekeuze voor 4 Sonty-winkels van 175-250 m²
_Aangescherpt op 2026-09-09 (prompt-agent) uit het verzoek van Daimy: "geografische vergelijkingen met Rijswijk, beste plekken voor 4 winkels 175-250 m², op basis van Sonty-data + koopkracht/koopwoningen"._

## 1. Doel en beslisvraag
Na dit onderzoek moet Daimy kunnen beslissen: (a) welke 4 plaatsen/gebieden samen het beste winkelnetwerk vormen naast showroom Rijswijk, (b) in welke volgorde ze open gaan, (c) of elke locatie rendabel is (break-even in akkoorden/jaar) en (d) welk type vastgoed past (woonboulevard/PDV, bedrijventerrein zichtlocatie, centrum). Output is een ranking van kandidaatgebieden met onderbouwing, geen los "top 10 steden"-lijstje.

## 2. Benchmark: Rijswijk als referentie
Profileer Rijswijk op gemeente- én wijkniveau (CBS Kerncijfers wijken en buurten 2024) rond Frijdastraat 8F: % koopwoningen, gem. WOZ, inkomen, % eengezinswoningen, bouwjaar, stedelijkheid, dichtheid. Reken op wijkniveau binnen ~15/20 min rijtijd van de showroom, want dát gebied leverde de gemeten conversie. Bouw een lookalike-score per CBS-wijk elders (genormaliseerde afstand tot het Rijswijk-profiel, gewogen). Rapporteer de score per variabele apart.

## 3. Variabelen
Vraagzijde (Sonty-data): akkoorden/omzet per woonplaats binnen catchment (hoog gewicht, bewezen vraag); conversiecurve per afstandsband (uplift-model); kanaalmix winkel/online; aandeel buren/bekenden; orderwaarde (alleen in prognose, niet in score).
Aanbodzijde (CBS/PDOK, geen concurrentnamen): % koopwoningen (hoog), % eengezinswoningen (middel), WOZ + inkomen (hoog, met plafond), bouwjaar (middel: jaren '60-'90 beter dan nieuwbouw en dan oude kernen), stedelijkheid/dichtheid (laag-middel, voorkeur suburbaan), transacties/verhuisdynamiek (laag), concurrentiedichtheid als kaal aantal (middel, correctiefactor).

## 4. Netwerklogica voor 4 winkels tegelijk
Set-selectie, geen 4 losse rankings. Per kandidaat het marginale bereik: leads binnen 15/20 min rijtijd die NIET al binnen 20 min van Rijswijk of van een gekozen winkel vallen. Kannibalisatie: gedeelde leads één keer tellen, toegewezen aan dichtstbijzijnde winkel. Harde eis: onderling ≥20-25 min rijden. Vergelijk greedy met een combinatorische toets van de beste 4-sets uit de top-15. Toets logistiek vanaf magazijn Berkel en Rodenrijs.

## 5. Economische toets per winkel (175-250 m²)
Kostenmodel per locatietype (huur/m²/jr met bron of expliciet als aanname met bandbreedte), 1-1,5 FTE, marketing, inrichting; herschaald vanaf het bestaande 200 m²-model. Break-even in akkoorden/jaar bij winkelconversie 65,5%, orderwaarde €3.609, marge 45,8%. Gevoeligheid: ±20% huur, ±20% uplift, ±30% catchmentleads.

## 6. Fasering
Rangschik op (a) hoogste marginale bewezen vraag, (b) laagste opstartrisico, (c) logistiek. Motiveer waarom #1 niet per se de hoogste op leadvolume is.

## 7. Verificatie vóór oplevering
Noemer per gebied (alle leads met datum); dubbele plaatsnamen; Den Haag-wijken apart waar mogelijk; te-ver-leads uit catchment maar apart gerapporteerd; seizoenseffect zichtbaar; data t/m september 2026; elke CBS/PDOK-call met datum gelogd.

## 8. Opleverformat
Rapport (samenvatting, methode, ranking, per-winkel dossier, 4-set scenario, risico's). Rankingtabel: gebied, lookalike-score, marginale leads/jr, akkoorden/jr, omzet, huurklasse+aanname, break-even, fase, aannames. Kaart: admin-pagina/artifact met Rijswijk + kandidaten, catchments, kleur op score. Telegram: max 10 regels.

## 9. Valkuilen
Niet ranken op inwoners of leadvolume alleen; geen ongeverifieerde huurprijzen als hard cijfer; geen concurrentnamen; geen dubbele dekking; geen 4 losse analyses die elkaar kannibaliseren; lege CBS/PDOK-call = "onbekend", nooit verzinnen.

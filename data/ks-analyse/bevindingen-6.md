## Telling
- totaal_gelezen: 193
- intents (één gesprek kan meerdere hebben):
  - productvraag: 52
  - offerte_aanpassen_of_nieuwe_offerte: 32
  - inmeet_afspraak_plannen: 28
  - prijsvraag_of_korting: 27
  - overig: 49
  - status_levering_montage: 17
  - planning_verzetten: 15
  - te_duur_bezwaar: 13
  - service_reparatie_garantie: 11
  - showroom: 8
  - akkoord_geven: 5
  - factuur_betaling: 6
- sonty_stelde_inmeet_voor: 20 (14x via het vaste WA-introtemplate "Jaimy hier van Sonty... Bij akkoord komen we bij je langs" dat standaard naar de showroom/inmeet-stap verwijst, plus ~6x een actief, ad-hoc voorstel middenin een gesprek, bv. ID 951478076 "Zullen we een inmeet afspraak inplannen zodat we de drukte nog een beetje van volgende week voorzijn?" en ID 945549508 waar showroom+inmeet actief wordt aangeboden als "logische volgende stap")
- gemiste_inmeet_kans: circa 35 (koopintentie aanwezig — klant vraagt expliciet naar prijs/proces/product met duidelijke aankoopwens — maar het antwoord bevat geen concrete inmeet-stap of doorverwijzing eindigt puur in "stuur een mailtje naar aanvragen@sonty.nl" zonder actieve vervolgstap). Grootste subgroep: de 10 onbeantwoorde gesprekken met koopintentie (zie hieronder), plus tientallen gesprekken met lange responstijd (soms >1000-13000 minuten) waarbij het enige zichtbare antwoord de automatische "Om de chat opnieuw te openen..."-melding is.
- onbeantwoorde_gesprekken_met_koopintentie: 10 (van de 23 gesprekken met onbeantwoord=True; de overige 13 zijn spam, losse groet/testberichten of te weinig info om te kwalificeren)

## Gemiste sales-kansen (max 10, meest sprekende)
1. ID 943167622 — Klant heeft al offerte en wil expliciet een meetafspraak: "Hoi, ik heb een offerte van jullie ontvangen en ik zou een afspraak willen plannen om te laten meten." Responstijd 6886 minuten (~4,8 dagen); enige zichtbare Sonty-reactie is de automatische "Om de chat opnieuw te openen..."-melding, geen actieve booking.
2. ID 946831551 — Warme lead via buren-aanbeveling, met concreet product en maten: "Onze buren hebben ons getipt over jullie bedrijf... Wij zouden (ook) een Brustor willen laten plaatsen... De achterpui is (als ik goed heb gemeten) 300 cm breed..." Volledig onbeantwoord.
3. ID 947183409 — Terugkerende klant wil uitbreiden: "Hi goedemiddag, Ik heb vorig jaar rolluiken en zonwering bij jullie gehaald en wil voor de bovenetage nu ook zonwering het gaat om 5 stuks. Kan ik hiervoor een offerte krijgen?" — twee keer herhaald, nooit inhoudelijk beantwoord.
4. ID 951689065 — Klant wacht ná een uitgevoerde inmeting nog op de offerte: "Hi, vorige week dinsdag is Sjoerd bij ons geweest voor het inmeten, echter hebben wij de mail met de volledige offerte en bestelling nog niet gehad." Alleen automatisch bericht zichtbaar — risico dat een al-warme, bijna-verkochte klant afhaakt.
5. ID 939509628 — Klant heeft de offerte al geaccepteerd maar meldt een fout die vóór productie hersteld moet worden: "we hebben eerder vandaag de offerte geaccepteerd, alleen zie ik zojuist dat de kleur van de cassette ral 7016 is. Dat moet Ral 9016 zijn." Onbeantwoord — risico op verkeerd product bestellen.
6. ID 937061635 — Verloren order expliciet door trage planning: "de offerte is gecanceld omdat jullie pas over 3 weken kunnen inmeten en we willen binnen 5 weken een zonnescherm hebben omdat we in een nieuw pand zitten." Sonty probeerde nog te redden ("Ik kan eventueel morgen even kijken naar een mogelijkheid om de afspraak... naar voren te kunnen schuiven"), maar de klant had al elders aanbetaald.
7. ID 949994199 — Hernieuwde interesse na een jaar, met concrete productvragen: "In onze straat hebben jullie screens gehangen en hebben aantal vragen... Hoe zit dit met inkijk in de avond... Geeft dit ook veel isolatie?" Alleen automatisch bericht zichtbaar.
8. ID 951171862 — Klant stuurt zelf maten en vraagt direct productadvies: "Mijn terras waar de eettafel staat is vanaf de schuifpui 2,4 mtr diep. Is dan een uitvalscherm van 2,5 meter voldoende..." Onbeantwoord ondanks concrete, snel te beantwoorden vraag.
9. ID 936059182 — Klant vraagt zelf actief om een nieuwe offerte met actuele korting: "Hi! Ik heb in juli vorig jaar deze offerte van jullie ontvangen. Kunnen jullie een nieuwe offerte maken met dezelfde informatie? Ik zie dat jullie nu 15% korting hebben 😊" — kant-en-klare, koopklare lead, onbeantwoord.
10. ID 944243275 — Klant geeft impliciet akkoord: "Offerte is verder akkoord kunnen we een afspraak maken?" maar de reactie van Sonty komt pas na 12625 minuten (~8,8 dagen) en zonder concrete afspraakvoorstel op het moment van akkoord.

## Offerte-aanpassingsverzoeken
Meest voorkomende aanpassingen die klanten vragen:
- **Maten/afmetingen**: verkeerd ingevulde breedte/hoogte (ID 948450856: 3 maten opgegeven, maar 1 verwerkt; ID 939429446: breedte moet 79cm zijn i.p.v. wat werd doorgegeven; ID 941089782: 319cm i.p.v. 338cm; ID 944863590: dakkapel-afmeting vergeten toe te voegen).
- **Kleur**: RAL-kleur wijzigen (ID 939509628: RAL7016 → RAL9016 wit, ná acceptatie van de offerte; ID 936827045: pantser wit i.p.v. antraciet; ID 945610334: verschil RAL7016 glans vs. mat). Afwijkende RAL-kleur kost al snel €300-450 extra (ID 935908091: "Ik heb een nieuwe offerte... De kleur van het frame is nu specifiek een kleur die ik doorgegeven heb en dat kost 450 euro extra?").
- **Aantal producten**: ID 952378220 — "Okee, maar ik wil maar 2 rolluiken ipv 3."
- **Bediening/motor**: ID 949834805 (Tahoma switch laten vervallen — al in bezit), ID 938579134 (Somfy RTS i.p.v. IO voor integratie met bestaand systeem), ID 940624613 (draaischakelaar vs. solar advies).
- **Product/model downgraden naar goedkoper**: ID 936827045 — klant vraagt expliciet om de "goedkopere model uitvalscherm" (Sunproject i.p.v. duurder model).
- **Extra product toevoegen**: ID 935422643 (extra raam toevoegen "met groepskorting 😉"), ID 946258515 (dakkapel toevoegen), ID 947460840 (rolluik toevoegen + oud scherm demonteren).
- **Demontage/afvoer oud product**: ID 947460840, ID 944846656, ID 935115604 — steeds €75 per product.

**Afhandeling en snelheid**: kleine aanpassingen (kleur, extra raam, foutieve maat) worden vaak binnen enkele minuten tot uren door de medewerker zelf rechtgezet in WhatsApp ("Ik zal hem even aanpassen en zo dadelijk toesturen"). Grotere/nieuwe offerte-aanvragen worden structureel doorverwezen naar aanvragen@sonty.nl, waarna doorlooptijd sterk varieert — soms dezelfde dag, vaak pas na 1000+ minuten (uren tot dagen), en in meerdere gevallen (zie gemiste kansen) helemaal niet zichtbaar afgehandeld binnen het gesprek.

## Veelgestelde vragen top-10
1. **"Wat kost het inmeten, en betaal ik iets als ik niet doorga?"** — "Wij komen eerst nog inmeten... mocht je na het inmeten toch niet verder met ons gaan dan brengen wij wel 75,- euro in rekening, 25,- euro hiervan doneren wij aan het prinses maxima kinderziekenhuis." (herhaald in tientallen gesprekken, o.a. ID 948794160, 935780840)
2. **"Hoe lang duurt het voor jullie kunnen inmeten?"** — "Dit proberen we altijd binnen 2-3 weken te plannen, dit lukt niet altijd ivm de drukte" — kan richting zomer oplopen (ID 952294994: "deze week nog op 2-3 weken maar dat zal volgende week fors oplopen").
3. **"Wat is de levertijd na aanbetaling?"** — "Als je die (aanbetaling van 40%) hebt voldaan is de levertijd 7-9 weken." (consistent in vrijwel alle offerte-conversaties, bv. ID 936985855, 940910691)
4. **"Welk merk/motor gebruiken jullie?"** — "Het merk rolluiken wat wij verkopen is van sunmaster en het type motor is een SOMFY io motor... het beste van beide werelden" (ID 952276876); Somfy geeft 7 jaar garantie op de motor tegenover 3 jaar bij Brel (ID 951478076), en Roma-rolluiken zijn een alternatief in extra kleuren en dikker aluminium (ID 936985855).
5. **"Is het doek waterdicht?"** — "De pergola doeken zijn niet waterdicht maar waterafstotend, de doeken zijn van acryl en zijn geïmpregneerd... het is en blijft een zonwerings product" (ID 939405563/939405563-achtige, exact ID 939405563).
6. **"Kan het op zonne-energie (solar)?"** — "Met de solar blijven wij natuurlijk alleen buiten je huis en hoeven dus niet van buiten naar binnen te boren dus zit je dan ook niet met bekabeling" (ID 940624613); voor knikarmschermen wordt solar afgeraden omdat je dan "maximaal 2 à 3 keer per dag" kan in/uitrollen (ID 947622718).
7. **"Wat zijn de standaardkleuren en wat kost een afwijkende kleur?"** — "Wij hebben 6 standaard kleuren, Ral 7016, 7016 structuur, 9001, 9010, 9005 structuur en Quarts grijs. Mocht je een andere kleur willen dan kan dit uiteraard alleen komt er dan een meerprijs bij va 20%." (ID 936827045)
8. **"Kunnen jullie mijn oude scherm/rolluik demonteren en afvoeren?"** — "Wij kunnen zeker je oude screen demonteren en afvoeren wij rekenen hier 75,- euro voor per product." (ID 947460840)
9. **"Wordt het duurder als de maten na inmeten afwijken van de offerte?"** — "Wij werken met staffels van 20cm dus mocht het product 20 cm groter zijn dan opgegeven dan wordt het inderdaad iets duurder maar dit gaat om 50,- euro +- verschil en niet om grote bedragen" (ID 938423563); elders: "Prijs verschil zal nooit 600,- of honderde euro's duurder zijn... Tenzij de maten uiteraard heel veel uitwijken" (ID 944164987).
10. **"Zit er een hoogwerker bij en kost dat extra?"** — "Als er een hoogwerker aan te pas komt zetten wij dit altijd apart op de offerte onder een eigen kopje zodat je weet wat de kosten zijn" (ID 935137519).

## Toon en stijl van het team
Informeel, altijd "je/jij", klant wordt bij de voornaam genoemd, veel emoji (😊😁🙈☺️👋☀️) en uitroeptekens; opvallend veel kleine taal-/tikfouten ("isgoed", "der", "gsiter", "gene die daar over gaat"). Vaste openings- en afsluitzin bij eerste contact ("Hi [Naam], Jaimy hier van Sonty 👋 Leuk dat ik je mag helpen!" / afsluiting "Groetjes, Jaimy" of "Fijne dag/avond/weekend!"). Toon is vriendelijk-verkoperig, met humor en relativering bij prijsonderhandelingen.

Vijf letterlijke voorbeeldzinnen:
1. "Hi Wenda sorry dat was een automatisch antwoord! het merk rolluiken wat wij verkopen is van sunmaster en het type motor is een SOMFY io motor eigenlijk dus het beste van beide werelden!" (ID 952276876)
2. "topper! gaan we helemaal regelen. je hebt de snelste montage die mogelijk is !" (ID 952280932)
3. "mischien net iets te vroeg, maar u vraagt wij draaien snelheid ! haha" (ID 952280932)
4. "Ik zie het verschil Ingrid - bij ons €2.870,79 versus €2.585,40 bij de ander. Dat is ongeveer €285 verschil... Wat vooral het verschil maakt bij ons: eigen ervaren monteurs, Sunmaster premium kwaliteit en onze 4,9/5 service rating 😊" (ID 951478076)
5. "we kunnen niet een audi verkopen voor de prijs van een skoda. ik wil je nog een beetje tegemoet komen met 50 euro maar daar blijft het wel bij" (ID 951478076)

## €75-regel en verwachtingen
De €75-regel wordt zeer consistent en met bijna identieke bewoording herhaald in tientallen gesprekken (o.a. ID 948794160, 941089782, 937105596, 940910691, 939894765, 935780840, 935602446, 935105667, 945039721, 944164987, 936827045, 940624613, 936942372 (Engelse variant)). Standaardzin: *"Mocht je na het inmeten toch niet verder met ons gaan dan brengen wij wel 75,- euro in rekening, 25,- euro hiervan doneren wij aan het prinses maxima kinderziekenhuis."* De donatie-framing wordt bewust gebruikt om de kosten sympathieker te maken.

Losstaand hiervan wordt hetzelfde bedrag (€75) ook gebruikt voor **demontage/afvoer van een oud product** (ID 947460840, 944846656, 935115604) — een andere context die een AI niet mag verwarren met de "niet-doorgaan"-vergoeding.

Een klant vroeg expliciet door op het risico: *"Maar als na inmeten de prijs omhoog schiet en dat niet kunnen of willen betalen, dan betalen we die 75 euro voor niks?"* (ID 938423563) — Sonty stelt gerust dat prijsafwijkingen door de staffel-werkwijze (stappen van 20cm) meestal beperkt blijven tot ca. €50, en dat er nooit honderden euro's bij kunnen komen tenzij de maten sterk afwijken. Ook wordt toegezegd dat er geen kosten in rekening worden gebracht als plaatsing achteraf technisch niet mogelijk blijkt (ID 935602446).

Overige verwachtingen die structureel worden geschetst: inmeten binnen 2-3 weken (oplopend tot 6-8 weken in het drukke seizoen), na inmeten volgt een definitieve offerte, bij akkoord 40% aanbetaling, daarna 7-9 weken levertijd.

## Rode vlaggen voor AI-autonomie
- **ID 942541271 (Jorg/Janszen)** — Meervoudige, emotioneel geladen klacht: kapotte muursteen tijdens montage, niet-werkende Tahoma-koppeling met Velux-luiken, én een betalingsgeschil ("ik krijg aanmaningen om het laatste restant 1000 euro te betalen. Maar ik zou het fijn vinden als eerst alles werkt én de muur gerepareerd is"). Technisch + financieel + emotioneel — vereist mensenoordeel.
- **ID 938204729** — Veiligheidsgerelateerde storing: "ik zie deze ochtend dat er bij ons een rolluik scheef zit deze is omhoog gegaan kan dit opgelost worden??" — vereist snelle monteur-inzet, geen chatbotafhandeling.
- **ID 939109141** — Reparatieverzoek elektrische schakelaar markiezen, onbeantwoord — technische storing bij bestaand product, vraagt vakkennis.
- **ID 938623861** — Technische haalbaarheidsvraag: rolluik plaatsen met weinig ruimte door airco-leidingen naast het kozijn (met foto's) — vereist beoordeling door een monteur/expert, niet generiek te beantwoorden.
- **ID 938579134** — Vraag naar Somfy RTS vs. IO compatibiliteit met een bestaand huisautomatiseringssysteem — technisch integratievraagstuk buiten standaard FAQ-bereik.
- **ID 940565598** — Veiligheidsvraag bij montage op een balkon op de 11e verdieping ("Vraagbaak o.a. of het veilig is") — aansprakelijkheidsgevoelig, mens moet dit beoordelen.
- **ID 938450396** — Boze, ongevraagde klacht na afwijzing offerte met expliciete concurrentievergelijking ("kan 3 rolluiken van een kwalitatief merk leveren voor meer dan de helft van uw aanbieding"), onbeantwoord — reputatierisico, vraagt persoonlijke opvolging door sales/eigenaar in plaats van geautomatiseerd antwoord.
- **Structureel patroon**: veel gesprekken tonen alleen de automatische WhatsApp-melding "Om de chat opnieuw te openen stuur ons een bericht, anders kunnen wij niet reageren" als enige zichtbare reactie op een inhoudelijke, soms urgente klantvraag (voorbeelden: ID 943167622, 951689065, 947183409, 949994199, 951171862). Dit is geen inhoudelijke fout van de medewerkers maar een structureel WhatsApp-sessievenster-probleem dat een autonome AI expliciet moet omzeilen (proactief antwoorden binnen het venster, of escaleren naar een ander kanaal) om te voorkomen dat warme leads categorisch koud worden.

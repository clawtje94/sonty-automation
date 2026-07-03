## Telling
- totaal_gelezen: 195
- intents (één gesprek kan meerdere hebben):
  - inmeet_afspraak_plannen: 24
  - offerte_aanpassen_of_nieuwe_offerte: 36
  - prijsvraag_of_korting: 32
  - te_duur_bezwaar: 22
  - productvraag: 42
  - status_levering_montage: 8
  - service_reparatie_garantie: 13
  - factuur_betaling: 4
  - akkoord_geven: 9
  - planning_verzetten: 3
  - showroom: 13
  - overig: 53 (waarvan ~16 pure geautomatiseerde Reuzenpanda-offerteaanvraag-notificaties zonder verdere dialoog, en de rest korte afwijzingen zonder reden/verkeerd-nummer/duimpjes)
- sonty_stelde_inmeet_voor: 16 (Sonty bevestigt/biedt actief een inmeetafspraak aan, vaak met uitleg van het proces "3 dagen" / "3-4 weken")
- gemiste_inmeet_kans: 6 (klant vraagt expliciet om een afspraak/inmeetdatum, maar krijgt alleen een generieke website-verwijzing of alleen het automatische WhatsApp "24u-heropen"-bericht als antwoord)
- onbeantwoorde_gesprekken_met_koopintentie: 2 (excl. de 16 automatische offerte-notificaties, die apart lopen via Reuzenpanda)

Let op: kanaal "Aanvragen" (e-mail, chunk-begin) bevat grotendeels automatische "X heeft offerte #... aangevraagd"-notificaties zonder klant-dialoog — dit zijn geen echte gesprekken maar systeemmeldingen van nieuwe Reuzenpanda-leads.

## Gemiste sales-kansen (max 10, meest sprekende)

1. **id=958750841** — Rogier vraagt expliciet om een afspraak om de situatie te bekijken, maar krijgt alleen een generieke verwijzing naar het offerteformulier, geen actief aanbod om een afspraak in te plannen. Citaat klant: *"Graag wil ik een afspraak maken om.de situatie te bekijken en een vrijblijvende offerte aan te vragen bij u voor 1 rolluik voor mijn slaapkamer."*
2. **id=956060113** — Onbeantwoorde koopintentie in het Engels, buiten kernregio. Citaat: *"We need curtains and roller shutters. Do you do work in the Arnhem area."* Nooit een vervolgantwoord gekregen op het eigenlijke productverzoek.
3. **id=954511809** — Klant heeft een gemiste oproep voor het inplannen van een inmeetafspraak en vraagt actief terug te bellen; gesprek blijft onbeantwoord. Citaat: *"Hi' ik heb een oproep gemist om een inmeet afspraak in te plannen."* + *"Kunnen we daar vandaag nog over bellen?"*
4. **id=954045909** — Bas vraagt expliciet naar data voor de inmeetafspraak, krijgt alleen het automatische "chat heropenen"-bericht als zichtbare reactie. Citaat: *"Beste Sonty, hebben jullie mijn email ontvangen? Kunnen jullie data doorsturen wanneer de inmeetafspraak gepland kan worden?"*
5. **id=954816912** — Klant heeft al akkoord gegeven en vraagt zelf om het vervolg, maar het enige zichtbare Sonty-antwoord is het automatische WA-heropenbericht. Citaat: *"Bedankt voor de ontvangen offerte. Deze is akkoord. Kunnen we een afspraak maken voor een vervolg?"*
6. **id=953966296** — Engin stuurt 4 foto's en een concrete prijsvraag voor rolluik + hor, geen inhoudelijk antwoord zichtbaar. Citaat: *"Wij willen een prijsje voor zolderkamer voor een rolluik en hor voor de muggen."*
7. **id=953258615** — Marcel en Anita sturen 7 foto's met de vraag "wat zal zoiets ongeveer kosten", eveneens geen inhoudelijke reactie zichtbaar, alleen automatisch bericht.
8. **id=953674285** — Bestaande klant met geplande installatie morgen, telefonisch onbereikbaar, onduidelijkheid over tijdstip (08:00 vs 13:00) blijft onbeantwoord — risico op mislukte afspraak/irritatie. Citaat: *"Morgen komen jullie langs voor de installatie van onze rolluiken... Kunnen jullie mij vertellen hoe laat ik jullie kan verwachten?"*
9. **id=958750885** — Dylan haakt af na een follow-up e-mail zonder dat Sonty doorvraagt naar de reden (in tegenstelling tot andere gesprekken waar dat wel gebeurt). Citaat: *"Hallo, wij kiezen toch voor een andere aanbieder."*
10. **id=957932746** — Mark zegt zelf "ik ga een afspraak inplannen", Sonty reageert alleen met "toppie thanks!" zonder actief de afspraak te bevestigen of het initiatief over te nemen — gemiste kans om direct te sluiten.

## Offerte-aanpassingsverzoeken

Meest voorkomende aanpassingen:
- **Aantal producten** (1 → 2 stuks, of vice versa): id=955925933 (Froukje: *"die offerte gaat maar om 1 scherm en ik wil een offerte voor 2"*), id=954002583 (Chris: *"Alleen voor 1 stuk en moeten er 2 zijn"*), id=956541637 (Siebren: *"Gaat dus om 2 rolluiken"*)
- **Maten/afmetingen fout of gewijzigd**: id=956519519 (Siebren Hofstra: verkeerde afmetingen 185x85 ipv wat ingevuld was), id=953855392 (Ian: breedte moet 2800mm zijn ipv 1000mm, en wil 2-4x 2800x1200)
- **Product wijzigen** (scherm ↔ rolluik): id=953759188 (Michel: screening → rolluiken), id=954046095 (Rachella: wil aanpassing naar rolluik)
- **Bediening/motor** (bedraad ↔ solar, draaischakelaar ↔ afstandsbediening): id=957711341 (Lisette: *"Klopt het dat de motor voor de screens niet solar is, maar bedraad?"*), id=952520543 (François: solar ivm nieuwbouw, geen nieuwe boorgaten)
- **Kleur/RAL**: id=953518870 (Vanessa: *"waarom het pantser in ral 7016 is opgegeven; ik wil de gehele rolluiken/frames in ral 9010"*)
- **Korting/prijs**: id=952815540 (extra 75 euro korting toegekend na lang onderhandelen), id=953346989 (Engelstalig, 2,5% extra korting geboden, verder geen ruimte)

Hoe afgehandeld: bijna altijd via interne @-mentions naar collega's in dezelfde WhatsApp-thread ("@jorren745487 aub offerte aanpassen"), waarna een nieuwe Reuzenpanda-link wordt gestuurd. Doorlooptijd varieert sterk: soms binnen minuten (responstijd_min 1-15), vaak pas de volgende ochtend (WhatsApp Business API laat maar 1x/24u reageren buiten sessie, wat leidt tot herhaalde "chat opnieuw openen"-berichten).

**Terugkerend systeemprobleem**: meerdere keren wordt per ongeluk een oude offerte uit 2025 verstuurd in plaats van de nieuwe 2026-versie, met excuses als "we waren even aan het tijdreizen" (id=953731449 Maarten, id=953731479 Reinier, id=953731530 Raymond, id=953731548 Joan). Dit is een concrete kwaliteitsissue in het huidige Reuzenpanda/offerteproces dat een AI zou moeten kunnen detecteren/vermijden.

## Veelgestelde vragen top-10

1. **"Kost inmeten iets?"** → Gratis als de opdracht doorgaat; anders €75, waarvan bij sommige medewerkers €25 gedoneerd wordt aan het Prinses Máxima Kinderziekenhuis. (id=955925923, id=957173705, id=955254780)
2. **"Hoe lang is de levertijd?"** → Na inmeten + aanbetaling meestal 6-10 weken, exacte range wisselt per medewerker ("7-9 weken", "7-10 weken", "6-8 weken"). (id=954045917, id=952294983)
3. **"Hoe snel word ik gebeld voor een inmeetafspraak?"** → Planning neemt binnen 3 werkdagen na online akkoord contact op; de afspraak zelf wordt 3-4 weken later ingepland. (id=954002384, id=952294983)
4. **"Zit de afstandsbediening/motor bij de prijs inbegrepen?"** → Hangt af van gekozen bedieningsoptie in de configurator; Sonty checkt dit per geval en herberekent zo nodig. (id=952294983, id=954000585)
5. **"Kan het op zonne-energie (solar)?"** → Meestal wel mogelijk, kost circa €300 extra; sommige zware producten (knikarmscherm, serre-zonwering) nog niet op solar. (id=954002384, id=955131220)
6. **"Waarom is jullie prijs hoger dan concurrent X?"** → Uitleg via kwaliteitskenmerken: poedercoating, lagers, aluminiumdikte, doekkwaliteit, rits, geïntegreerde onderlijst tegen klapperen/ongedierte, "appels met appels vergelijken". (id=954002569, id=955925870)
7. **"Kan ik in termijnen betalen?"** → 40% aanbetaling, 60% bij oplevering/na montage. (id=955870403)
8. **"Kunnen jullie iets repareren dat niet bij jullie gekocht is?"** → Nee, wegens drukte geen reparaties aan producten van derden; doorverwijzing naar info@service-nodi.nl. (id=958750851, id=954249796)
9. **"Wat kost het weghalen/afvoeren van de oude zonwering?"** → Vaak inbegrepen (€0), bij voorraadmodellen soms €50 apart voor demontage. (id=952285750, id=957932495)
10. **"Kunnen we langskomen in de showroom?"** → Ja, doordeweeks vrij binnenlopen, in het weekend liever met afspraak; koffie/thee wordt aangeboden. (id=955736359, id=957173772)

## Toon en stijl van het team

Alle medewerkers spreken klanten met voornaam aan, reageren informeel maar behulpzaam, en Daimy Boot ondertekent WhatsApp-berichten opvallend consequent als **"Jaimy"** (niet haar eigen naam) — dit is blijkbaar de klantgerichte WhatsApp-persona/naam van het bedrijf.

Voorbeeldzinnen:
1. Daimy Boot (als "Jaimy"), vaste opener: *"Hi Alex, Jaimy hier van Sonty 👋 Leuk dat ik je mag helpen! Hierbij stuur ik je de prijsindicatie via WhatsApp."*
2. Jorren Plugge, zakelijk-vriendelijk bij reparatievraag: *"Goedemorgen Ahmet, Bedankt voor de mail. Als de rolluiken bij Sonty heeft gekocht, dan horen wij dit graag. (Ordernummer)"*
3. Daimy Boot, heel informeel/plat bij onderhandeling: *"haha oke als iemand het zo snel kan doen hebben ze niks te doen wij doen gemiddeld 70 offertes op een dag maken dus zo snel gaat het jammer genoeg niet."*
4. Tanya Plugge, kort en gastvrij: *"Hi Silvia, Ja die is er, kom je gezellig langs?"* en *"Gezellig, zorgen wij voor koffie, thee en een koekje."*
5. Joey Engelen, formeel-zakelijk bij klacht: *"Goedemorgen Paul, Ik zie in ons systeem dat het laatste bezoek in December vorig jaar is geweest, dat alle bonnen afgetekend zijn en dat alle facturen zijn voldaan? Zou je mij wat meer toelichting kunnen geven?"*

Verder kenmerkend: veel emoji bij Daimy (☀️ 👋 📄 😊), afsluiters als "Zonnige groet!" en "Fijne dag/weekend nog", regelmatig typefouten/kleine letters na punten, en een vaste automatische WhatsApp 24-uursboodschap: *"Ons zakelijke WhatsApp account heeft helaas maar 24 uur om te reageren. Stuur even een kort berichtje terug, dan kunnen wij je weer helpen!"*

## €75-regel en verwachtingen

De €75-regel wordt herhaaldelijk expliciet genoemd, met kleine variaties per medewerker:
- id=955925923 (Jorren): *"Aan een inmeetafspraak zitten geen kosten verbonden als je met ons verder gaat! Mocht je na inmeten niet verder willen gaan, dan sturen we een rekening van 75€ voor het inmeten."*
- id=957173705 (Jorren): *"Mocht je na inmeten niet met ons verder gaan, dan sturen wij een rekening van 75€ voor het inmeten, waarvan we 25€ doneren aan het Maxima Kinderziekenhuis!"* (zelfde donatie-toevoeging ook in id=955254780/Danielle)
- id=955422762 (Daimy): *"wat wel belangrijk is als je vervolgens niks afneemt brengen we 75 euro in rekening voor het inmeten."*
- id=953518870 (Daimy): *"een inmeet afspraak is gratis als onze opdracht doorgaat, maar gaat de opdracht niet door brengen wij 75 euro in rekening."*
- id=952285750 (Daimy): zelfde formulering, plus uitleg dat ze het oude luik gratis meenemen als de deal doorgaat.

Verwachtingen die medewerkers scheppen: inmeten is altijd vrijblijvend qua verplichting tot koop, maar niet kosteloos bij afhaken; de €75 wordt consequent gepresenteerd als redelijk/kleine drempel, soms verzacht met een goededoel-framing (Máxima Kinderziekenhuis). Dit wordt telkens pas genoemd nádat de klant al interesse in een inmeetafspraak toont — niet vooraf als afschrikmiddel.

## Rode vlaggen voor AI-autonomie

- **Klachten met technische/veiligheidscomponent**: id=956656506 (Frans Buiter — katrollen van markies uit de muur gekomen, monteur zit te laag, mogelijk constructiefout); id=953282082 (Lenny/Alfonso — motor van pergola reageert niet, mogelijk mechanisch defect eindschakelaar) — vergen technische diagnose door een monteur, geen chatbot-antwoord.
- **Boze/geëscaleerde klanten**: id=957015368 (Manu — monteur te laat zonder bericht, klant schrijft *"Dit is onprofessioneel van jullie"* en eist herhaaldelijk antwoord); id=957720426 (bericht bestaat letterlijk uit *"Rot op"*) — direct escaleren naar mens, niet laten "sussen" door een bot.
- **Langdurige klachtgeschiedenis + emotionele/gezondheidscontext**: id=955489684 (Paul Dries — meerdere mislukte leveringen/reparaties, klant vertelt over twee beroertes en revalidatie, klaagt dat toegezegde terugbelactie niet gebeurde) — vraagt persoonlijke, empathische afhandeling door een mens.
- **Klanten die openlijk wantrouwen richting geautomatiseerde/AI-communicatie uiten**: id=954002569 (Ferdy — beschuldigt Sonty van *"een soort commerciële fabriek vol opdringerige marketing, AI, geautomatiseerde berichten en snelle uitspraken zonder feitelijke basis"*) — een AI die hier zelf antwoordt zou het wantrouwen kunnen bevestigen; dit gesprek moet naar een mens.
- **Complexe zakelijke/technische maatwerkvragen**: id=953722554 (aannemer vraagt een technische tekening voor een staalconstructie waarin gaten voor de zonwering vooraf geboord moeten worden) — vereist technische input van een monteur/adviseur, niet standaard configuratorkennis.
- **Prijsonderhandelingen met concrete kortingsbeslissingen**: meerdere gesprekken waarin medewerkers zelf een extra korting toekennen (2,5%, 75 euro, prijs "matchen" naar een rond bedrag, id=954000585, id=952815540, id=953346989) — dit is een bevoegdheidsbeslissing die nu impliciet per medewerker verschilt en expliciet beleid/mandaat nodig heeft voordat een AI dit automatisch zou mogen doen.

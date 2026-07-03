## Telling
- totaal_gelezen: 195
- intents (één gesprek kan meerdere hebben):
  - productvraag: 31
  - offerte_aanpassen_of_nieuwe_offerte: 25
  - te_duur_bezwaar: 24
  - prijsvraag_of_korting: 13
  - inmeet_afspraak_plannen: 16
  - akkoord_geven: 12
  - service_reparatie_garantie: 10
  - status_levering_montage: 9
  - planning_verzetten: 6
  - showroom: 3
  - factuur_betaling: 2
  - overig: 79 (afwijzingen "geen interesse"/"al voorzien"/andere leverancier gekozen, korte bedankjes, verkeerde nummers, bounces, systeemklachten zonder verkoopinhoud)
- sonty_stelde_inmeet_voor: 15 (Sonty bevestigt/pusht actief "de planning neemt binnen 3 dagen contact op voor een inmeetafspraak", meestal ná een akkoord-signaal van de klant)
- gemiste_inmeet_kans: 10 (klant toont concrete koopintentie — vraagt exacte prijs, wil offerte aangepast, wil bezoek — maar krijgt geen antwoord of geen inmeet-voorstel)
- onbeantwoorde_gesprekken_met_koopintentie: 21 (van alle ONBEANTWOORD:true gesprekken; exclusief bounces, opt-outs en pure "we wachten nog even af"-berichten)

## Gemiste sales-kansen (max 10, meest sprekende)
1. **962615379** (Aanvragen, onbeantwoord) — Klant vraagt expliciet om een inmeetafspraak, dit week nog. Nooit beantwoord. Citaat: "We would like to arrange an appointment for you to visit our home in Jacob Mulderweg, Den Hagg to look at buying a sunshade for our patio. Is it possible this week?"
2. **962567179** (Aanvragen, onbeantwoord) — Klant wil een specialist langs laten komen om opnieuw in te meten en opties te bespreken. Onbeantwoord. Citaat: "is mogelijk iemand van je specialisten langs laten komen en dan kunnen ook alle opties doorspreken over rolluik?"
3. **962432607** (Aanvragen, onbeantwoord) — Klant zit net boven budget en vraagt expliciet om samen naar een oplossing te zoeken, toont expliciete koopintentie. Onbeantwoord. Citaat: "wilde ik graag vragen of er nog iets mogelijk is met de prijs... Ik ben erg geïnteresseerd in de samenwerking."
4. **962427548** (Aanvragen, onbeantwoord) — Klant is verkoopklaar en vraagt alleen nog een aanpassing (Somfy Solar ipv afstandsbediening) voordat hij tekent. Onbeantwoord. Citaat: "Graag beide screens met Somfy Solar RS100 io (premium) bediening in plaats van afstandsbediening. Alvast dank voor het aanpassen van de offerte."
5. **962380941** (Aanvragen, onbeantwoord) — Klant vraagt expliciet naar goedkopere configuratie-opties om binnen budget te komen. Onbeantwoord. Citaat: "Welke keuzes zouden we kunnen maken om op een goedkopere manier zonwering in te richten voor ons huis bij deze afmetingen?"
6. **962360624** (Aanvragen, onbeantwoord) — Klant noemt concreet budget (€2000) voor rolluiken hele bovenverdieping en vraagt om alternatief. Onbeantwoord. Citaat: "ik heb een budget van 2000 euro) wat kunnen jullie mij hiervoor bieden?"
7. **962339128** (Aanvragen, onbeantwoord) — Klant heeft meerdere concrete, beslissingsbepalende vragen (geldigheid offerte, motormerk, waarom bedrag kan wijzigen, levertijd) om quotes te kunnen vergelijken. Onbeantwoord, terwijl ze expliciet zegt te willen beslissen zodra ze antwoord heeft.
8. **962360436** (Aanvragen, onbeantwoord) — Klant wil twee offertes (RAL 7016 vs 7021) ter vergelijking én meldt een montagecomplicatie (onvoldoende ruimte boven openslaande deuren). Onbeantwoord.
9. **962343892** (Aanvragen, onbeantwoord) — Bestaande, betalende klant vraagt naar orderstatus (zijn materialen binnen, wanneer montage). Onbeantwoord — risico op vertrouwensverlies bij klant die al heeft aanbetaald.
10. **962340903** (WA) — Klant herhaalt bezwaar "te duur, 3k voor een zonnescherm"; hierna volgt alleen het automatische wekelijkse nurture-sjabloon, geen persoonlijk downsell-voorstel (terwijl dat in vergelijkbare gesprekken elders wel gebeurt, bv. cassette/motor-downgrade).

## Offerte-aanpassingsverzoeken
Klanten vragen vooral aanpassingen op:
- **Maten/afmetingen**: 962341796 (390cm volle gevelbreedte vs 335cm tussen regenpijpen + kosten extra steunen), 962334861 (meerdere kamers, maten per stuk gecorrigeerd), 962333288 (pergola 5m vs 6m breed), 962346873 (van standaard voorraadscherm-maat naar 4500x2500mm op maat).
- **Bediening**: 962335817 (solar vs handmatig/draaischakelaar vs Tahoma Switch smart-optie, €195 meerprijs), 961562253 (verwarring solar vs draaischakelaar in offertetekst, rechtgezet), 962346873 (elektrisch met wandschakelaar vs handbediend, prijsverschil €300).
- **Kleur**: 962335817 (wit frame i.p.v. aluminium i.v.m. witte pui), 962343362 (RAL 7022 voor rolluiken), 962360436 (RAL 7016 vs RAL 7021 vergelijking), 962334746 (foutieve RAL-kleur in offerte gecorrigeerd).
- **Product/type**: 962339764 (duurste SunEye vs goedkopere SunBasic), 962576371 (klant wilde Rainbow Ibiza Plus — niet leverbaar, Sonty legt Sunmaster-kwaliteitskeuze uit), 962344799 (SunBasic naar SunEye prijsvergelijking).
- **Aantal**: 962334746 (offerte stond op 2 stuks i.p.v. 1, "upsellen noemen ze dat" — grapje van Daimy over eigen foutje).
- **Korting**: 961749940 (combinatiekorting eigen rolluik+knikarmscherm → GEEN korting), 962327277/962344007 (burenkorting 20% als samen op dezelfde dag getekend/ingemeten/gemonteerd wordt — wél toegekend).

**Afhandeling/snelheid**: tijdens drukke ochtenden (bulk-nurture-run 29/30 juni) reageert het team vaak binnen 1-30 minuten op vragen. Losse individuele gesprekken buiten die burst hebben soms zeer lange "responstijd" (600-1400 minuten), maar dat is meestal omdat het geregistreerde "antwoord" een automatisch wekelijks weer-sjabloon is ("We zien dat het volgende week prachtig weer wordt...") en geen persoonlijke reactie op de specifieke vraag van de klant.

## Veelgestelde vragen top-10
1. **"Waarom is Sonty duurder dan concurrenten/goedkopere aanbieders?"** → "Let bij het vergelijken vooral op: de dikte van het aluminium (wij gebruiken Sunmaster, Nederlands A-merk), welke motor er standaard bij zit (bij ons altijd Somfy), en de service voor en na de montage. Check gerust onze 600+ Google reviews."
2. **"Wat is de garantie?"** → "garantie van 3 jaar op de montage, 5 jaar op het product en 7 jaar op de motor."
3. **"Wat kost het als ik na het inmeten toch niet koop?"** → "als je uiteindelijk toch niet voor ons kiest brengen wij wel 75 euro in rekening puur om onze kosten te dekken van het inmeten" (waarvan €25 naar het Máxima Kinderziekenhuis gaat).
4. **"Hoe lang duurt het van inmeten tot montage?"** → "Levertijd is NA inmeten en betalen aanbetalingsfactuur 8-10 weken" en "wij hebben sowieso 2-3 weken nodig om te komen inmeten."
5. **"Wat kost montage op hoge verdiepingen (hoogwerker/steiger)?"** → "Een hoogwerker gebruiken we altijd [voor] alles boven de 2e verdieping... kosten voor een hoogwerker zijn €650,-." Reguliere montagekosten uitvalscherm: "€220,-".
6. **"Is mijn muur/gevel wel sterk genoeg voor het scherm?"** → "we monteren ruim 150 van die schermen in een jaar, en we hebben nog NOOIT een montage gedaan waar die van de muur af kwam. Maar als onze adviseur op locatie een verlengde steun nodig acht, is dat ook geen probleem."
7. **"Verwijderen jullie het oude scherm/haal je het weg?"** → "Voor 75 euro verwijderen we het scherm en brengen we hem weg, 25 euro gaat daarvan naar het kinder Maxima fonds!"
8. **"Is de Somfy solar-motor echt draadloos?"** → "De Somfy RS100 io solar is inderdaad een draadloos systeem! Heeft een zonnepaneel op de cassette, die de accu oplaadt, waardoor we niet naar binnen hoeven te boren."
9. **"Kan ik zonder afspraak naar de showroom?"** → "tuurlijk! alleen liefst niet op vrijdag en zaterdag aangezien het dan echt heel druk is. En het kan dus dat je even moet wachten dan."
10. **"Doen jullie onderhoud aan een bestaand scherm/rolluik?"** → "Dit is namelijk niet iets wat wij zelf aanbieden. Wij werken wel met een partij die zonneschermen schoonmaakt." (Voor rolluik demontage/montage bij kozijnvervanging: apart dienstenpakket van €300.)

Bonus/randgevallen die een AI ook zou moeten kunnen: exacte grens van het werkgebied (huidig antwoord is vaag — klant op 21 minuten rijden kreeg geen concreet antwoord over de grens), en combinatiekorting-regels (wél korting bij samen met buren, géén korting bij combineren van eigen producten).

## Toon en stijl van het team
Alle medewerkers (Daimy Boot, Jorren Plugge, ook Tanya Plugge) ondertekenen het standaard eerste-contact-sjabloon consequent als **"Jaimy"** — een gedeelde brand-persona, los van wie er daadwerkelijk typt. Stijl is informeel, je/jij-vorm (nooit "u", tenzij de klant zelf "u" gebruikt), kort, veel uitroeptekens en emoji (👋📄☀️😊), en zelfrelativerend bij eigen fouten.

Voorbeeldzinnen (letterlijk):
1. "Helemaal goed! up en downgrade's kun je in de offerte makkelijk bekijken en uitrekenen."
2. "Yes 100%, het is echt een super system."
3. "oeps het systeem is aan het tijdreizen.... sorry hier voor!" (zelfspot bij systeemfout — terugkerend patroon)
4. "Hi Sander, ik heb je zojuist de offerte toegestuurd voor de SunEye. Mocht je vragen hebben, dan hoor ik het uiteraard graag."
5. "Laat maar weten als ik nog wat voor jullie kan doen" / "mocht je vragen hebben, dan hoor ik het graag!" (vaste afsluiter in vrijwel elk gesprek)

## €75-regel en verwachtingen
Ja, meerdere keren expliciet genoemd, altijd met dezelfde framing (kosten dekken + goede-doel-donatie):
- **962335319**: "als je uiteindelijk toch niet voor ons kiest brengen wij wel 75 euro in rekening puur om onze kosten te dekken van het inmeten."
- **961812135**: "Mocht je na inmeten niet met ons verder gaan, dan sturen we daar een rekening voor van 75€, waarvan we 25€ doneren aan het Maxima Kinderziekenhuis. Dit doen wij, omdat niet 'zomaar' overal langs kunnen gaan wegens drukte. Uiteraard vervalt de 75€ als je met ons verder gaat."
- **961562253**: "hou er wel rekening mee dat als we dan toch niks voor je kunnen betekenen dat we dan 75 euro in rekening brengen voor het inmeten."
- **962345267**: "wel rekening mee houden als je het toch niet doet brengen we 75 euro in rekening voor het inmeten!"

Let op: er is een **tweede, ander gebruik van "€75"** dat een AI niet mag verwarren met de inmeet-no-show-fee: in **962338508** kost het weghalen/afvoeren van een oud scherm bij montage ook €75 (waarvan €25 naar het Maxima-fonds) — dit is een montage-service, geen inmeet-annuleringsboete. Verwachting die Sonty steeds schept: de prijsindicatie is vrijblijvend en gratis; pas bij een daadwerkelijke inmeetafspraak geldt de voorwaardelijke €75.

## Rode vlaggen voor AI-autonomie
- **962338104** (Selinda) — klant claimt al een contract per mail te hebben én al met een collega op WhatsApp gesproken; kanalen lopen door elkaar. Citaat: "Weet niet wat er niet goed gaat in jullie bedrijf... En ik heb op WhatsApp je collega ook gesproken." Een AI mag hier niet blind een nieuw offerte-sjabloon versturen.
- **962344049** (Jurgen) — klacht over interne miscommunicatie, zichtbaar voor de klant: "Volgens mij weeken jullie aardig langs elkaar🥴."
- **962343319** (Nathalie) — herhaalde ongewenste berichten ondanks eerdere afmelding: "Hoeveel keer moet ik me afmelden." Opt-out niet correct verwerkt — escalatierisico.
- **962346338** (Adinda) — expliciete ergernis: "Zou t waarderen als jullie me verder met rust laten." AI moet hier direct stoppen, geen nieuw automatisch bericht.
- **952149018** (Wim de Grood) — technisch naverkoop-probleem (pergola-palen aanpassen na montage) dat specifiek door Joey/montageafdeling moet worden opgelost, niet door salesbot.
- **962416291** (Bianca Koole) — complexe VvE-/bevestigingssituatie (mag niets aan plafond bevestigen, wacht op VvE-toestemming) vraagt maatwerkadvies, geen standaardantwoord.
- **962345983** (Marcel) — derde-partijscenario: verhuurder regelt zonwering voor huurder, plus woningbouwvereniging-toestemming nodig — wie is "de klant" is niet triviaal.
- **962339628** (Caroline/Sander) — verkeerd geadresseerde offerte: "Niet voor mij bestemd." Datakwaliteitsprobleem; AI moet zulke afwijkingen escaleren, niet automatisch doorgaan met de foutieve match.
- **962386384** — klant probeert herhaaldelijk telefonisch contact na voicemail zonder zichtbare resolutie in de transcript — bereikbaarheidsprobleem met verloren-lead-risico.
- **962346424** (Mark) — doorverwezen naar "info@service-nodi.nl", een niet-Sonty-domein; mogelijk verouderde/foutieve routing die een AI niet zonder controle zou moeten overnemen.

KLAAR: bevindingen-1.md geschreven, 195 gesprekken gelezen
intents: productvraag: 31, offerte_aanpassen_of_nieuwe_offerte: 25, te_duur_bezwaar: 24, prijsvraag_of_korting: 13, inmeet_afspraak_plannen: 16, akkoord_geven: 12, service_reparatie_garantie: 10, status_levering_montage: 9, planning_verzetten: 6, showroom: 3, factuur_betaling: 2, overig: 79

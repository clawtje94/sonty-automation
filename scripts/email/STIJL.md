# Sonty-schrijfstijl voor e-mail

Vastgelegd 27 juli 2026, op verzoek van Daimy ("geen AI-slop, het moet Sonty ademen").
Niet verzonnen: dit komt uit de stijlregels van de AI-klantenservice (`scripts/ai-ks/system-prompt.js`)
en uit echte verstuurde berichten van het team in Trengo.

## De regels

1. **Kort.** Eén tot drie zinnen per alinea, één ding tegelijk. Een lang gestructureerd blok
   verraadt direct dat er geen mens achter zit.
2. **Geen gedachtestreepjes.** Nooit een `—` of een `-` tussen zinsdelen. Dat is hét kenmerk van
   AI-tekst. Gebruik een komma of maak er twee zinnen van.
3. **Geen emoji's.** Ook geen zonnetjes, ook niet "gezellig" bedoeld.
4. **Geen klantenservice-frasen.** Verboden: "dat waardeer ik", "dank voor je bericht", "wij
   staan voor u klaar", "aarzel niet om contact op te nemen", "graag informeren wij u".
5. **Geen opsmuk.** Geen "heerlijk", "genieten van de zon", "uw droomterras". Sonty verkoopt
   zonwering, geen vakantiegevoel.
6. **Ik, niet wij.** Er schrijft één iemand. "Ik heb even gekeken", niet "wij hebben geconstateerd".
7. **Spreektaal.** Schrijf zoals je het zou appen: "even", "gewoon", "hoor", "trouwens".
8. **Concreet boven vaag.** Niet "op korte termijn" maar "binnen drie werkdagen". Niet "scherp
   geprijsd" maar het bedrag.
9. **Aanhef**: "Hoi [voornaam]," Bij oudere doelgroep of formele mail: "Goedemiddag [voornaam],"
10. **Afsluiting**: "Groet, Jaimy van Sonty". Nooit "Met vriendelijke groet" in een campagnemail;
    dat is briefpapier-taal.

## Zo klinkt het echt

Uit werkelijk verstuurde berichten:

> "Hoi Irene, Sorry voor de herinnering, die had je inderdaad niet meer moeten krijgen. Ik heb je
> nu uit de herinneringsmails gehaald, dus daar heb je geen last meer van."

> "Hoi Henny, Helemaal goed, dank je wel voor je bericht. Ik laat het hierbij en jullie weten ons
> gerust te vinden zodra jullie eruit zijn."

Let op wat daar gebeurt: excuus zonder omhaal, meteen zeggen wat er gedaan is, en afsluiten
zonder de klant onder druk te zetten.

## Herschrijfvoorbeelden

| Te marketing | Zoals Sonty het zegt |
|---|---|
| "Wij willen u graag informeren dat uw offerte gereed staat." | "Je offerte staat klaar." |
| "Kleuren en stoffen zien er thuis anders uit dan op een scherm." | "Op een scherm zie je nooit hoe een doek er echt uitziet." |
| "Klanten die langskomen weten daarna bijna altijd precies wat ze willen." | (weglaten, dat is verkoperspraat) |
| "Wij nemen graag de tijd voor u, geheel vrijblijvend." | "We nemen er rustig de tijd voor, je zit nergens aan vast." |
| "Onze vakkundige monteurs verzorgen een professionele installatie." | "Onze eigen monteurs plaatsen het, geen onderaannemers." |
| "Aarzel niet om contact met ons op te nemen." | "Stuur gerust even een appje." |

## Wat wél mag

- Eén uitroepteken in een hele mail, hooguit.
- Een vraag stellen. "Klopt het zo?" werkt beter dan een stelling.
- Toegeven dat iets vervelend is. "Dat is een flink bedrag, dat snap ik."
- Concrete cijfers en garanties, want die zijn waar.

## Controle vóór verzending

Loop dit af bij elke nieuwe mailtekst:

- [ ] Nul gedachtestreepjes tussen zinsdelen
- [ ] Nul emoji's
- [ ] Geen enkele zin uit de verboden-frasenlijst
- [ ] Geen alinea langer dan drie zinnen
- [ ] Zou Jaimy dit zo appen? Zo niet: korter en gewoner maken.

`scripts/email/stijlcheck.js` controleert de eerste vier punten automatisch.

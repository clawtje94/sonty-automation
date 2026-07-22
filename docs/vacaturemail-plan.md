# Vacaturemail naar klanten — concept + plan (22-07-2026, AKKOORD + LIVE)

**Status: LIVE sinds 22-07 ~18:00.** Akkoord Daimy 22-07 ("daarna klopt alles en mag je beginnen met de batch versturingen") na testmails v1 t/m v7. Definitief: v7 = v6 ZONDER handtekeningblok (Outlook plakt de handtekening er zelf onder).
- Verzending: `scripts/vacaturemail-batch.js` via launchd `nl.sonty.vacaturemail` (dagelijks 10:30, 150/dag, 15s tussenpauze, 429-backoff, state data/vacaturemail-verzonden.json, kill-switch data/kill/nl.sonty.vacaturemail). Batch 1 handmatig gestart 22-07.
- Elk verzonden ticket wordt aan DAIMY (736327) toegewezen en gesloten: reacties heropenen bij hem.
- Bots blijven eraf (Daimy 22-07): email-daemon skipt/verwijst tickets met "nieuwe collega"/"interesse in de vacature" naar Daimy; WhatsApp-daemon wijst appjes met "interesse in de vacature"/"Ik kom via:" direct aan Daimy toe en antwoordt niet.

## Doelgroep (staat klaar)
- `data/vacaturemail-doelgroep.csv` (niet in git): **1.744 unieke adressen**
- Selectie: laatste Gripp-factuur in 2024-2026 (afgeronde opdrachten) én géén lopende order in de planning-sheet (602 klanten met lopende opdracht uitgesloten; die mailen we niet terwijl ze op hun montage wachten)
- Per jaar: 2026: 565 · 2025: 765 · 2024: 414

## Wie we zoeken (input Daimy 22-07)
1x servicemonteur · 2x monteur · 2x inmeter · 1x winkelmedewerker (wo/vr/za, later mogelijk meer dagen)
Aanbrengbonus: **€1.000** voor wie iemand aandraagt die de proeftijd doorkomt.

## Concept-mail (persoonlijk, Sonty-toon)

**Onderwerp (keuze):**
- A: `Ken jij onze nieuwe collega?`
- B: `Sonty groeit en daar kun jij bij helpen (1.000 euro beloning)`
- C: `Wij zoeken collega's, jij kent ze misschien`

**Tekst:**

> Beste {voornaam/naam},
>
> Een tijdje terug mochten wij bij jou thuis aan de slag met zonwering of raamdecoratie. Daar denken we nog steeds met plezier aan terug, want klanten zoals jij zijn de reden dat Sonty groeit. En dat groeien gaat hard. Zo hard dat ons team versterking nodig heeft.
>
> Daarom zoeken we:
> - een **servicemonteur** (ervaring is een pré)
> - twee **monteurs** (minimaal 2 jaar montage-ervaring)
> - twee **inmeters** (ervaring is een pré)
> - een **winkelmedewerker** voor onze showroom in Rijswijk (woensdag, vrijdag en zaterdag, later mogelijk meer dagen), vooral iemand die ergens een passie voor kan ontwikkelen en klanten blij maakt
>
> Voor de technische functies zoeken we mensen die de zonweringbranche al kennen. Voor de showroom hoeft dat niet, daar gaat het ons om de juiste persoon.
>
> Misschien ken jij iemand die dit op het lijf geschreven is. Een buurman met gouden handen, een neef die toe is aan iets nieuws, of misschien ben jij het zelf wel.
>
> **Bonus (v6-formulering):** komt jouw tip bij ons aan de slag en door de proeftijd, dan krijg jij als bedankje **1.000 euro**. "Zelf houden of delen met degene die je aandraagt, die keuze is helemaal aan jou." Diegene noemt bij het appen alleen jouw naam.
> **WhatsApp-formulier (v6, akkoord Daimy):** de interesse-knop opent WhatsApp met invulvelden: Functie / Naam / Woonplaats / Ervaring in de zonwering / Huidige baan en werkgever / Waarom dit me leuk lijkt / Ik kom via. De link in het doorstuurbericht opent hetzelfde formulier.
>
> **Ben jij het zelf?** WhatsApp-knop (voorgevuld: "Hoi Sonty! Ik heb interesse in de vacature. Ik kom via: ") of mail terug. Ook voor salaris-vragen: app-knop. Geen kaal telefoonnummer meer in de mail (mensen gingen anders bellen).
> **Ken je iemand?** Doorstuur-knop: opent WhatsApp met kant-en-klaar doorstuurbericht ZONDER de 1.000 euro erin (creatieve oplossing doorstuur-ongemak). De bonus staat alleen in de originele mail: "dat houden we lekker tussen ons, diegene hoeft alleen jouw naam even te noemen" — zo wordt de aanbrenger toch geregistreerd via het "Ik kom via:"-veld van de kandidaat.
>
> Hartelijke groet,
>
> Team Sonty
> Frijdastraat 8F, Rijswijk
> 085 006 9681 | sonty.nl

*(Toon-checks: geen gedachtestreepjes, persoonlijk, geen corporate vacaturetaal, geen verzonnen details. Aanhef: voornaam als die in Gripp staat, anders "Beste {achternaam}" of "Beste Sonty-klant".)*

## Verzendplan (na akkoord)
1. **Afzender**: voorstel info@sonty.nl (herkenbaar; reacties komen dan in Trengo binnen waar het team + Sunny ze ziet). Alternatief: apart adres zoals collega@sonty.nl.
2. **Batches**: max ±150-200 per dag, gespreid over ±2 weken (spamreputatie van het domein beschermen). Volgorde: 2026-klanten eerst (warmste relatie).
3. **Personalisatie**: aanhef uit de CSV; geen mail-merge-fouten door eerst 5 testmails naar Daimy/Joey.
4. **Reacties**: afspreken wie sollicitaties/aanmeldingen oppakt en hoe we de aanbrenger registreren (nodig om de €1.000 later eerlijk uit te keren; simpelste: "wie mogen we bedanken?" vragen in het eerste gesprek + vastleggen in een sheet).
5. **Opt-out**: onderaan één zinnetje "Liever geen mail meer van ons? Laat het even weten." (afmeldingen bijhouden in de CSV).
6. **Eenmalig**: geen reminders naar niet-reageerders zonder nieuw akkoord van Daimy.

## Openstaande keuzes voor Daimy
- Onderwerpregel A, B of C (of eigen tekst)?
- Tekst akkoord of aanpassen?
- Afzender: info@ of apart adres?
- Startdatum + batch-grootte akkoord?

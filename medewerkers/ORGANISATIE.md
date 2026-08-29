# Sonty — organisatie (de piramide)

Daimy staat bovenaan. Onder hem een directieteam van vijf; elk hoofd stuurt zijn afdeling aan,
leest elke ochtend de rapporten van zijn mensen en rapporteert aan Daimy. Bram bundelt alles tot
één directeursbriefing. Gebaseerd op het functie-onderzoek in docs/brein-medewerkers-onderzoek.md
(15 functies bij top-bedrijven in de branche); fysiek werk (inmeten, monteren, magazijn, verkoop aan
de keukentafel) blijft mens en staat hier als "mens" vermeld.

```
                          DAIMY  (eigenaar / directeur)
                                    │
   directie: Claude (bouwer, levende sessie) · Bram (directiesecretaris) · Ori (onboarding & raamwerk)
        ┌───────────────┬───────────────┼───────────────┬──────────────┐
      Lars            Noor             Isa           Fenna          Mats
  hoofd Commercie  hoofd Operatie  hoofd Klant   hoofd Financiën  hoofd Techniek
  (sales, marketing (planning,      & Service     & Sturing        & Systemen
   brand)           inkoop,montage) (KS, nazorg)  (controller,HR)
        │                │               │              │               │
     Milan            Nanny            Sunny          Sam            Kai
     sales-binnen     planner (AI)     klantenservice facturatie &   AI-innovatie & R&D
     Jules            Ruben            Yara           debiteuren
     marketing (ads,  inkoop           service &      Pip
     mail, SEO)       Tess             nazorg         HR & capaciteit
     Bo               montage-coörd.
     brand, media,    mens: Joey, Sjoerd (inmeten), montageteams, magazijn
     partners
     mens: showroom, buitendienst
```

## Ritme (werkdagen)
- 07:00–07:30  medewerkers draaien hun dienst (gespreid, haiku/sonnet): dagrapport in vier kopjes.
- 07:45        hoofden lezen de dagrapporten van hun afdeling, maken hun MT-rapport (cijfers, afwijkingen,
               beslissingen die Daimy moet nemen, mét voorstel).
- 08:00        Bram maakt de directeursbriefing (max 12 regels) → Telegram + Brein; houdt de vragenlijst bij.
- Overdag      Daimy geeft via het Brein opdrachten aan een hoofd of medewerker; een hoofd mag delegeren
               (`brein-sessie.js opdracht <slug> "…"`). Antwoorden komen terug op de pagina.
- Maandag      Lars/Noor/Fenna voegen het weekbeeld toe (conversie, capaciteit, omzet vs vorige week).

## Bevoegdheden (v1: lezen en adviseren; uitvoeren alleen wat in het profiel onder magZelf staat)
Sunny en Nanny voeren al uit via hun daemons; hun agent-dienst rapporteert over dat werk.
Elke andere medewerker begint adviserend en krijgt per opdracht van Daimy meer bevoegdheden
(nieuwe regel onder magZelf + tool in het profiel). Zo bouwt Daimy stap voor stap door.

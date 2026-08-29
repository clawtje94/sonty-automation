# Ori — Brein-audit op verzoek van Daimy, 2026-08-29

## GEDAAN
Bevindingen, gerangschikt op ernst, elk met vindplaats en voorstel:

1. (hoog) Trechter naar Daimy klopt niet. Team-tab toont ALLE V-nummers van Bram als "wacht op jou", ook expliciet nog niet verstuurde. Code: sonty-website/app/admin/brein/page.tsx r.283-291, `bramVragen` filtert alleen op `/V\d{2,4}/` + lengte, niet op status. Bewijs: medewerkers/bram/dagrapport/2026-08-29.md zegt zelf "Verstuurd (top 3): V100-102" en "Nog niet naar Daimy gestuurd: V103-109" — dagstart.png/team-desktop.png tonen toch "Beslissingen die op jou wachten (25)". Voorstel: Bram markeert per V-nummer [verstuurd]/[wachtrij] in zijn rapport, page.tsx toont alleen [verstuurd].
2. (hoog) Dagstart-tab werkt niet. data/brein/briefings/ bevat 0 bestanden, terwijl Bram claimt "verstuurd via brein-telegram.js". scripts/brein-telegram.js r.15+29 schrijft dat bestand alleen in een stille try/catch ("best effort"), geen alarm bij mislukken. Schendt blauwdruk-regel 1 (docs/brein-raamwerk.md: "stilte is een fout"). Bewijs: dagstart.png toont "nog geen briefing". Voorstel: brein-collect.js alarmeert als briefings/<vandaag>.txt ontbreekt na 08:15.
3. (midden) ORGANISATIE.md loopt niet gelijk met de profielen. medewerkers/bo/profiel.md bestaat (rapporteertAan: lars) maar ontbreekt in de piramide van medewerkers/ORGANISATIE.md r.18-24 (onder Lars staan alleen Milan en Jules). Voorstel: piramide-tekst genereren uit profielen i.p.v. met de hand bijhouden.
4. (midden) Jobs dubbel belegd: `reviews-sync` staat in profiel.md van Bo, Jules én Yara; `seo-agent-week` bij Bo én Jules. brein-collect.js `medewerkers()` koppelt een job aan iedereen die hem noemt, dus dezelfde job staat op 2-3 kaarten en niemand is er echt van. Voorstel: één eigenaar per job in `jobs:`, anderen noemen het alleen in hun lopende tekst.
5. (midden) Bo heeft nog nooit gedraaid: geen data/brein/audit/bo/, geen medewerkers/bo/dagrapport/, geen entry in medewerkers.json. 13 andere medewerkers met dezelfde weekend:nee hebben vandaag (zaterdag) wél een dienstrapport. Voorstel: Mats laat checken of Bo's dienst (07:12) wel meeloopt in de scheduler.
6. (laag, verkoopbaarheid) medewerkers/BEDRIJF.md mixt generieke motor-regels (r.38-48, rapportvorm/werkwijze) met Sonty-feiten (r.6-36, garantie, prijsboek, aankomstmarge) in één ongescheiden bestand, terwijl docs/brein-raamwerk.md §2 juist Handvest(generiek) los zet van BEDRIJF.md(per bedrijf). Voorstel: BEDRIJF.md in twee gemarkeerde blokken splitsen zodat onboarding van bedrijf 2 alleen het onderste blok vervangt.

## CIJFERS
- Dagrapporten vandaag: 16 van 17 medewerkers/hoofden aanwezig (Bo ontbreekt, terecht: weekend nee + nog nooit gedraaid). Bron: eigen grep op medewerkers/*/dagrapport/2026-08-29.md.
- Vaste vorm gevolgd: 16/16 aanwezige rapporten hebben alle 4 kopjes, cijfers met bron. Bron: zelfde grep.
- "Wacht op Daimy"-teller op het Brein: 25 (bron: dagstart.png), waarvan minstens 7 volgens Bram zelf nog niet naar hem gestuurd hadden moeten worden (zie bevinding 1).
- Verbetervoorstellen vandaag: 6 (dit rapport), 0 doorgevoerd — ik schrijf profielen niet zelf.

## VRAGEN AAN DAIMY
1. Mijn profiel zegt max 3 verbetervoorstellen per dag; voor deze losse audit-opdracht lever ik er 6, allemaal met bestand/regel. Voorstel: voor eenmalige audits geen limiet, dagelijkse dienst blijft op max 3.
2. Bevinding 1 en 2 raken de kernlogica van de piramide (Bram's trechter, Dagstart-scherm). Voorstel: die twee eerst laten oppakken door Claude/Mats, de rest (3-6) kan gewoon meelopen als profiel-verbetering.

## MORGEN
- Checken of bevinding 1 en 2 zijn opgepikt.
- ORGANISATIE.md verder kruisen tegen alle profielen (vandaag niet compleet gedaan qua tijd).
- Intake-vragenlijst nieuw bedrijf bijwerken met les uit bevinding 6 (generiek vs bedrijfsfeiten scheiden).

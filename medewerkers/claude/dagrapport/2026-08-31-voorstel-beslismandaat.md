# Voorstel beslismandaat hoofden (opdracht 5qw9oxpt van Bram, 31-08)

## Analyse van de wachtlijst (V104-V128, ~20 open)
Slechts ~6 zijn echte Daimy-beslissingen (geld, personeel, klantbeleving, dagen dicht):
V105, V106, V113, V116, V123, V128. De rest (V107-V111, V114, V117-V119, V121, V122,
V124-V127) is operationeel of technisch werk met een voor de hand liggende eigenaar:
cron weer aanzetten, 1-regel-bugfix, dashboard-fix, adres inkorten. Die horen niet op een
wachtlijst voor Daimy; dat zijn opdrachten voor een expert.

## Voorstel: mandaat-ladder (nieuwe sectie in RAAMWERK.md, pas na akkoord Daimy)
1. ZELF (hoofd of medewerker): omkeerbaar + geen klantcontact + geen geld + eigen domein.
   Direct (laten) doen. Logging verplicht: dagrapport onder GEDAAN, en Bram zet het in de
   briefing als regel "BESLIST ZELF: ..." zodat Daimy kan corrigeren. Mandaat met
   verantwoording, geen stille macht.
2. ONDERLING (twee hoofden): raakt twee domeinen (bijv. V122 Noor+Mats). Samen beslissen,
   zelfde logging. Bram bekrachtigt niet, hij noteert.
3. DAIMY (via Bram, max 3/dag blijft): geld boven EUR 250, personeel en rollen,
   klantbeleving-beleid, onomkeerbaar of extern (klantmail-beleid, prijzen, dagen dicht).
   Bestaande REGELS blijven altijd boven dit mandaat staan (prijzen nooit zonder verzoek,
   sandbox is heilig, eerst 1 dan de rest, enz.).
Vangnet: bij twijfel -> laag 3. Brams bestaande 5-werkdagen-verloopregel blijft bestaan.

## Extra regel die de lijst het snelst leegt
Technische storingen en bugfixes zijn NOOIT een V-vraag. Het hoofd zet ze direct als
opdracht bij Mats/Techniek (of Claude als het bouwen is) en meldt alleen de uitkomst.
Dat alleen al haalt ~2/3 van de huidige wachtlijst weg.

## Wat er bij akkoord gebeurt
Claude werkt RAAMWERK.md en de vijf hoofden-profielen bij (1 proefgeval eerst: Mats,
daarna de rest na check), Bram krijgt de nieuwe brief-regel "BESLIST ZELF".
Drempelbedrag EUR 250 is een voorstel; Daimy kiest het bedrag.

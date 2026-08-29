# Het Brein — medewerker-raamwerk (blauwdruk, 29-08-2026)

Daimy: *"Het moet een power AI company worden waarvan we het systeem straks ook aan andere bedrijven
kunnen verkopen. Alles gelogd, agents die zichzelf aanzetten en zorgen dat alles werkt, de opzet voor
elk bedrijf begeleid door agents. Een medewerkers-wireframe dat later voor andere bedrijven te
gebruiken is. Elke agent een gezicht, alles visueel, top notch."*

Dit document is de blauwdruk. Sonty is klant nummer één; alles wat Sonty-specifiek is, zit in
*bedrijfsbestanden*, niet in de motor.

## 1. Wat het is, in één zin
Een bedrijf als piramide van AI-medewerkers: de eigenaar bovenaan, een directieteam dat aan hem
rapporteert, medewerkers per afdeling, elk met een gezicht, een profiel, een dienst, een geheugen,
een rapport in vaste vorm en een postvak. Eén scherm (het Brein) om alles te zien en aan te sturen.

## 2. Lagen (wat generiek is en wat per bedrijf)

| Laag | Generiek (de motor, verkoopbaar) | Per bedrijf (configuratie) |
|---|---|---|
| Organisatie | piramide-model: eigenaar → directie → hoofden → medewerkers; rapporteertAan, niveau | `medewerkers/ORGANISATIE.md`, wie er is |
| Handvest | vaste rapportvorm (GEDAAN / CIJFERS / VRAGEN AAN DE BAAS / MORGEN), gedragsregels voor agents | `medewerkers/BEDRIJF.md` (feiten, huisregels) |
| Profielen | frontmatter-schema (naam, functie, afdeling, niveau, rapporteertAan, model, dienst, weekend, tools, jobs, kpis, magZelf) + rolsjablonen per functie | `medewerkers/<slug>/profiel.md` per medewerker |
| Runner | `scripts/medewerker.js`: claude -p met profiel+handvest+geheugen, tool-whitelist, rapport-parser, stand, audit | modelkeuze, diensttijden |
| Geheugen | per medewerker `geheugen.md` (max ~60 regels, zelf bijgehouden) | inhoud |
| Ritme | scheduler (elke 5 min: wie is aan de beurt, tijdsvolgorde, weekend-regel, herkansing bij fout) | tijden per rol |
| Postvak | opdrachten van de baas of van een hoofd → inbox → agent → antwoord op het scherm | — |
| Brein | verzamelaar (jobs, sessies, wachtrijen, tijdlijn) + pagina (Team, Overzicht, Jobs, Tijdlijn, Postvak) | bronnen-adapters (welke registers/logs/APIs) |
| Audit | elke run één auditbestand (opdracht, tools, output, kosten, duur, fout) + tijdlijn-gebeurtenissen | bewaartermijn |
| Gezichten | avatar per medewerker (vaste stijl, één set), status-ring, afdelingkleur | namen en gezichten |
| Vakkennis | wekelijkse **bijscholing** per medewerker (WebSearch/WebFetch: vakartikelen, boeksamenvattingen, vacatureteksten van topbedrijven, video-transcripten) → `vakkennis.md` in vaste vorm, elke dienst meegegeven; coaching-feedback van Ori per medewerker | bronnen/vakgebied per functie |

## 3. De medewerker (het "wireframe" van één agent)
```
medewerkers/<slug>/
  profiel.md      wie ben ik, wat doe ik dagelijks, mijn KPI's, wat mag ik zelf, welke tools/systemen
  geheugen.md     mijn werkgeheugen (leerpunten, lopende zaken), door mij bijgehouden
  dagrapport/     <datum>.md (dienst) en <datum>-opdracht-<id>.md (ad-hoc), vaste vier kopjes
  avatar.png      mijn gezicht (gegenereerd in de huisstijl van de set)
  vakkennis.md    hoe de besten mijn vak doen (wekelijkse bijscholing, ma 05:30): werkregels, routine, KPI-normen, valkuilen, bronnen
data/brein/
  medewerkers.json   stand per medewerker (status, laatste dienst, kosten, rapport-samenvatting)
  audit/<slug>/      één json per run
  postvak.json       opdrachten (nieuw → gelezen/gestart → klaar/fout/geweigerd) met antwoord
  inbox-<slug>.txt   wekregel per opdracht (tail -f door een levende sessie)
  gebeurtenissen.jsonl  tijdlijn "wie deed wat"
```
Regels van het wireframe:
1. **Alles wat een agent doet is zichtbaar**: rapport in vaste vorm, gebeurtenis in de tijdlijn, auditbestand. Stilte is een fout.
2. **Bevoegdheden zijn een whitelist** (`tools` + `magZelf`): een nieuwe medewerker mag lezen en adviseren; uitvoeren komt
   er per bevoegdheid bij, na een lab-run en een ja van de baas. Nooit muterende tools (deleten, pushen, launchd) in een profiel.
3. **Eén baas, één briefing**: alleen de directiesecretaris (Bram) spreekt de baas ongevraagd (één bericht per dag); hoofden
   filteren de vragen van hun mensen; de baas ziet op het Brein alleen wat het directieteam doorlaat.
4. **Zelfherstel**: mislukte dienst → één herkansing dezelfde dag; verzamelaar controleert elke minuut of de scheduler
   geladen is; Mats (Techniek) rapporteert wat blijvend stuk is. Agents "zetten zichzelf aan": de scheduler is de motor,
   geen mens hoeft iets te starten.
5. **Altijd de beste in je vak** (Daimy 29-08): elke medewerker schoolt zichzelf wekelijks bij op het web en past zijn
   werkwijze aan ("wat ik vanaf morgen anders doe"); Ori bewaakt of het gebeurt en coacht per medewerker.
6. **Kosten zichtbaar**: per run kosten en duur op de kaart; per dag totaal in het Brein; standaard haiku voor routine,
   sonnet voor hoofden en de directiesecretaris.

## 4. Onboarding van een nieuw bedrijf (begeleid door agents)
Nieuwe klant = nieuwe map `bedrijven/<naam>/` met dezelfde structuur. De **onboarding-agent "Ori"** doet het intakegesprek
(chat of Telegram) en genereert de bestanden:
1. **Intake** (30 min): wat doet het bedrijf, wie beslist, welk klantproces (stappen), welke systemen (CRM, planning,
   boekhouding, mail/WhatsApp), welke cijfers wil de baas dagelijks zien, huisregels (wat mag nooit).
2. **Voorstel organisatie**: op basis van het functie-onderzoek (docs/brein-medewerkers-onderzoek.md) een piramide met
   namen, functies, KPI's en diensttijden; de baas schrapt of voegt toe.
3. **Bronnen koppelen**: per medewerker welke registers/logs/API's hij mag lezen (adapters); eerst alleen-lezen.
4. **Proefweek**: alle medewerkers adviserend; Ori leest de rapporten mee en stelt profielen bij (te lang, te vaag,
   verkeerde bron). Daarna per bevoegdheid uitvoeren aanzetten.
5. **Overdracht**: handvest, organisatie, profielen en gezichten zijn van de klant; de motor blijft één codebase.

## 5. Het Brein-scherm (visueel, fijn om mee te werken)
- **Team** (startscherm): de baas bovenaan met "beslissingen die op jou wachten"; daaronder het directieteam en per
  afdeling de medewerkers als kaarten met gezicht, status-ring (groen klaar, oranje wacht op jou, blauw bezig, rood fout),
  de drie cijfers van vandaag en één klik naar het volledige rapport. Opdracht geven en "dienst nu" per kaart.
- **Dagstart**: de briefing van Bram zoals hij op Telegram stond, met de vragenlijst (V-nummers) en antwoordknop.
- **Overzicht / Jobs / Tijdlijn / Postvak**: techniek en verloop; alarmen altijd bovenaan.
- Stijl: admin-thema (licht/donker), afdelingkleuren, één avatar-set in dezelfde tekenstijl, geen lappen tekst.

## 6. Wat nu staat en wat volgt
- Staat (30-08): motor, scheduler, audit per run, zelfherstel-herkansing, padbeperking (`--setting-sources project`), 18 profielen
  voor Sonty (incl. Claude als levende sessie), gezichten, Team-/Dagstart-tab, postvak twee-fasen, schaduwstand, Ori-coaching,
  wekelijkse bijscholing (vakkennis.md), lab brein-medewerkers (224 sc.), audit door het team zelf (21 bevindingen, 17 verwerkt).
- Volgt: kosten-per-dag in het Brein, automatisch afbreken van hangende runs, `bedrijven/`-structuur voor een tweede bedrijf,
  bronnen-adapters per systeem, Ori's intake-script voor onboarding, bevoegdheden per medewerker uitbreiden op verzoek van Daimy.

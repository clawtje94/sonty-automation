## GEDAAN
Code, verzamelaar, admin-pagina, screenshots, 16 profielen, medewerkers.json en alle dagrapporten van vandaag doorgenomen. Bevindingen, ernstigste eerst:

1. **(ERNSTIG, veiligheid tool-whitelist)** `scripts/medewerker.js:76` geeft ELKE medewerker ongeacht profiel altijd `Write`+`Edit` zonder padbeperking: `['Read','Write','Edit','Grep','Glob', ...prof.tools]`. Dit is in strijd met BEDRIJF.md regel 7/8 en brein-raamwerk.md regel 2 ("nooit muterende tools in een profiel") en met profielen die expliciet "alleen lezen"/"niets versturen" zeggen (Jules, Ruben, Bo, Ori, Sunny). Een medewerker kan zo élk bestand overschrijven, óók zijn eigen `profiel.md` — dus zichzelf bij de volgende dienst extra Bash-tools toekennen (zelf-escalatie), of andermans geheugen/het handvest wijzigen. Voorstel: Write/Edit scopen tot `medewerkers/<eigen-slug>/**`, en `tools:` uit profiel.md valideren tegen een vaste toegestane lijst vóór ze in `--allowedTools` gaan.

2. **(ERNSTIG, scheduler/kosten)** Zelfherstel "één herkansing per dag" werkt niet. `diensten` zet `herkansing:true` in stand (regel 129), maar `draai()` (regel 100) overschrijft het hele stand-record zónder die vlag. Mislukt de herkansing ook, dan is de vlag weer weg en wordt dezelfde medewerker élke volgende tick (om de 5 min, `nl.sonty.medewerkers-dienst`) opnieuw geprobeerd — onbegrensde herhaalde kosten. Bewijs live: `dagstart.png` toont "medewerkers-dienst: al 30 min niets in de log (verwacht elke 5 min)", precies het patroon van een scheduler die vastloopt in herhaalde retries (elke poging blokkeert tot 25 min). Voorstel: bij het wegschrijven in `draai()` de bestaande record-velden (incl. `herkansing`) mergen i.p.v. vervangen.

3. **(HOOG, race)** `medewerkers.json` (STAND) is één gedeeld bestand, gelezen-gewijzigd-geschreven zonder lock en niet atomisch (`fs.writeFileSync` direct in `medewerker.js:44`, i.t.t. `lib/brein.js:27` dat wél tmp+rename gebruikt). Bij twee gelijktijdige processen wint de laatste schrijver en verdwijnt de update van de ander stil. Dit gebeurt nu vermoedelijk zelf: medewerkers.json toont zowel `mats` als `ori` tegelijk op status "aan een opdracht". Voorstel: atomisch schrijven zoals brein.js, en op termijn per medewerker een eigen bestand i.p.v. één gedeeld JSON.

4. **(HOOG, verzamelaar mist alarm)** `brein-collect.js:301-306` bouwt de "Let op"-lijst alleen uit launchd-jobs, Sunny-hartslag, mutaties>5 en Claude-terminals die op een mens wachten. Een medewerker.js-dienst die zelf op status `fout` eindigt komt NERGENS in die lijst — juist wat een hoofd als eerste zou moeten zien. Voorstel: `medewerkers(jobLijst).lijst.filter(m=>m.status==='fout')` toevoegen aan `alarmen`.

5. **(MIDDEN, geen stale-detectie)** Blijft een `claude -p`-proces hangen zonder dat spawnSync het als fout/timeout ziet (bv. hard gekilld), dan blijft `status:'in dienst'`/`'aan een opdracht'` voor altijd staan; geen enkele check meldt "al X uur bezig" (page.tsx toont alleen een animatie, geen leeftijd-check). Zie `ori` nu: "aan een opdracht", geen laatsteActie/rapport. Voorstel: alarm als `bezigSinds` ouder dan ~30 min is.

6. **(MIDDEN, stil dataverlies)** `app/api/admin/brein/route.ts:42-43` markeert een opdracht al "opgehaald" zodra hij in de POST-respons staat, vóórdat de Mac mini hem echt gestart heeft. Crasht het lokale proces net daarna, dan is die opdracht voorgoed onvindbaar als "nieuw" en er is geen alarm voor "opgehaald maar nooit gestart". Voorstel: pas markeren na lokale bevestiging, of terugvalperiode.

7. **(LAAG, onhandhaafde regel)** "max 3 opdrachten/dag" delegeren (profielen/ORGANISATIE.md) is puur tekst; `nieuweOpdracht` in `lib/brein.js` telt en begrenst niets, dus onbeperkt dure runs zijn mogelijk. Voorstel: teller per hoofd/dag, weigeren boven limiet.

## CIJFERS
7 bevindingen (2 ernstig, 3 hoog, 2 midden/laag) op 4 onderdelen onderzocht: runner (medewerker.js), verzamelaar (brein-collect.js), brein-lib (lib/brein.js), admin-route/pagina. Live bevestigd door screenshot: 1 scheduler-alarm (medewerkers-dienst 30 min stil) dat matcht met bevinding 2.

## VRAGEN AAN DAIMY
1. Mag ik bevinding 1 (Write/Edit padbeperking) en 2 (herkansing-merge-bug) als eerste twee losse voorstellen uitwerken voor jouw akkoord? Dit zijn de enige twee met echt risico (privilege-escalatie + herhaalde kosten), de rest kan wachten.
2. Wil je dat ik nu checkt of `ori`'s proces nog leeft of vastzit (staat al een tijd op "aan een opdracht" zonder rapport)? Ik verander zelf niets, alleen kijken.

## MORGEN
Checken of medewerkers-dienst-alarm is opgelost of terugkomt (indicator voor bevinding 2), status van `ori` navragen, en bij akkoord van Daimy een concreet voorstel (geen code-wijziging zonder ja) uitschrijven voor de tool-scoping en de stand-merge-fix.

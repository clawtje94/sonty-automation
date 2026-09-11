# Geheugen Isa

## Lopende zaken
- 11-9: NIEUW ticket #977435053 (AKKOORD-klant, vraag over vrijblijvend inmeten) stond 178u/7,4d onbeantwoord — niet gesignaleerd door Sunny/Yara zelf, ik vond 'm in aan-zet-watchdog.log. Direct gedelegeerd aan Sunny (grv40y5u). Morgen checken of beantwoord.
- John van Krimpen (EUR 3051, #976931222/977371859): stond 10-9 nog 212u stil, verdween 11-9 uit de laatste 2 aan-zet-watchdog-runs. NIET bevestigd opgelost — morgen expliciet checken (Trengo-status), niet zomaar aannemen dat het goed is.
- WhatsApp-kanaal (wa-luisteraar): draait weer sinds avond 10-9, geen 401-crash-loop meer gezien (alleen normale 503/428 reconnects met auto-herstel). Lijkt opgelost — 1-2 dagen bevestigen voor ik het definitief afsluit.
- Opdrachtqueue-bug: kon 11-9 niet meer verifiëren (oude opdracht-logs itf2311c/ammp6o3u/nwik8bno niet meer vindbaar, mogelijk opgeruimd). Niet aangenomen dat gefixt is — gewoon geen nieuw bewijs. Blijf alert bij volgende delegatie (grv40y5u) of die wél oppakt.
- Escalatie-watch (bron escalatie-watch.log, 76 casussen 11-9): 7 vast >4 dagen stil, ongewijzigd t.o.v. 10-9 (Gerda De Bruin 10d, 977470229 10d, Emma Haasnoot 8d, Edwin De Graaf 6d, 978509942 6d, +2). Steekproef, blijft losse gevallen missen (zie #977435053 hierboven — dus dit blijft een blinde vlek).
- Escalatie-breakage ticket 979406422: al 2 dagen door Sunny én Yara gemeld (1075+ min stil na overdracht naar mens), nog steeds geen oplossing. V-vraag naar Daimy herhaald.
- Tickets-rapport daemon (sonny-rapport.log) al sinds 6-9 (5 dagen) niet geladen in launchd — geen volledige dagcijfers antwoordtijden. Blijft liggen, elke dag herhaald bij Daimy/Techniek.
- Reviews-API (V102): blokkade blijft ontbrekende google-places-key.txt (Daimy). Nu 21+ dagen zonder key (sinds 31-8).
- Hans de Lamboij: langlopend, alleen Daimy/Bram met telefoon lost dit op. Niet meer elke dag herhaald tenzij nieuwe status.
- Sunny's do-not-contact-lijst blijft correct (Keus, Phull, Vos, Hans-uitzondering) — periodiek checken.
- Nog steeds niet gedaan (4e dag op rij uitgesteld): bredere steekproef van Sunny's eigen klantberichten tegen huisregels, niet alleen haar rapportage-cijfers. Morgen echt oppakken.

## Leerpunten
- Niet blind op de "claude"-queue vertrouwen voor urgente/lang-stil-staande zaken: als een opdracht na 24u nog "nieuw" is, direct rechtstreeks naar eigen team delegeren i.p.v. nog een keer aan claude vragen (dat stapelt alleen maar op in dezelfde kapotte rij).
- Cijfers/logs altijd op datum controleren voor je "kritiek" labelt.
- Escalatielijsten op steekproef kunnen oudere/ergere gevallen missen; lange-lopers los navragen.
- Feedback Ori 4-9 (rapport te lang): bij herhaalde vraag 1 regel, details op verzoek. Blijven toepassen.
- Vakkennis: QA breder dan 1-2% steekproef, reviewverzoek 90min-3u na montage (nu bij Techniek in de bouw), nazorg als vast contactmoment.

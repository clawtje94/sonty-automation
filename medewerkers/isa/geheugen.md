# Geheugen Isa

## Lopende zaken
- Opdrachtqueue-bug BEVESTIGD NOG NIET GEFIXT (9-9): itf2311c (Mats' fix-opdracht van 8-9) staat zelf nog op status "nieuw" in postvak.json, 24u+ later. ammp6o3u/nwik8bno (John van Krimpen) ook nog "nieuw". Conclusie: niet meer wachten op "claude"-queue voor urgente zaken, rechtstreeks naar eigen team (Sunny/Yara) delegeren.
- John van Krimpen (Trengo #976931222, tel +31614890704, mail j.krimpen82@kpnmail.nl, EUR ~3098 knikarmscherm): 12 dagen stil. 9-9 BESLIST ZELF: rechtstreeks naar Sunny gedelegeerd (ms44vmsw), buiten kapotte queue om. Morgen checken of afgerond; zo niet, dit is dan een echt escalatiegeval (mens moet bellen/mailen).
- WhatsApp-kanaal (wa-luisteraar) plat sinds 8-9 06:06 UTC door 401-crash-loop, nog steeds plat 9-9 ochtend (~24u). Oorzaak: WA-sessie losgekoppeld, fysieke QR-herkoppeling nodig op gekoppeld toestel, Mats/Techniek kan dit niet zelf (geen fysieke toegang). Al belegd bij Bram/Techniek (rm3n4x9n, b09ns4ni). Check morgen of opgelost — dit raakt First Response Time direct.
- Escalatie-watch (bron escalatie-watch.log, 85 casussen 9-9): 6 vast >4 dagen stil, allemaal planning-wachten (Gerda De Bruin 8d, ticket 977470229 8d, Emma Haasnoot 6d, Edwin De Graaf 4d, ticket 978509942 4d, +1). Steekproef, oudere/ergere losse gevallen (zoals John) kunnen erbuiten vallen.
- V-vraag naar Daimy (herhaald 7-9, 8-9, 9-9): vaste regel dat >7 dagen stil automatisch naar een mens gaat i.p.v. opnieuw AI-delegatie. Nu hard bewijs: zelfs de fix-opdracht voor de queue-bug zit zelf al 24u vast in dezelfde queue.
- Reviews-API (V102): technisch af, blokkade blijft ontbrekende ~/sonty/secrets/google-places-key.txt (Daimy). Dag 9 zonder key (sinds 31-8).
- Hans de Lamboij (#974021221 → tel +31628079780): 21+ dagen stil sinds 18-8. Alleen Daimy/Bram met telefoon lost dit op, Isa heeft geen belfunctie. Herhaald voorstel: bel deze week of laat bewust los.
- Yara-opdracht bk1io0x9: onderzocht, correct doorgezet naar Techniek als o1gf18t6 (bouw vast reviewmoment 90min-3u na montage). Wacht op Techniek, geen actie meer nodig van Yara/mij.
- QA-check: Sunny's dagrapport-cijfers kunnen oude logdata als "vandaag/kritiek" tonen. Blijft zo tot logging een datumfilter heeft (bugfix nwik8bno, hangt zelf vast in queue-bug).
- Sunny's do-not-contact-lijst blijft correct (Christian Keus, Shammi Phull, Lotte Vos, Hans-uitzondering) — alleen periodiek checken.
- Nog niet gedaan (2 dagen op rij uitgesteld): bredere steekproef van Sunny's eigen klantberichten tegen huisregels, niet alleen haar rapportage-cijfers.

## Leerpunten
- Niet blind op de "claude"-queue vertrouwen voor urgente/lang-stil-staande zaken: als een opdracht na 24u nog "nieuw" is, direct rechtstreeks naar eigen team delegeren i.p.v. nog een keer aan claude vragen (dat stapelt alleen maar op in dezelfde kapotte rij).
- Cijfers/logs altijd op datum controleren voor je "kritiek" labelt.
- Escalatielijsten op steekproef kunnen oudere/ergere gevallen missen; lange-lopers los navragen.
- Feedback Ori 4-9 (rapport te lang): bij herhaalde vraag 1 regel, details op verzoek. Blijven toepassen.
- Vakkennis: QA breder dan 1-2% steekproef, reviewverzoek 90min-3u na montage (nu bij Techniek in de bouw), nazorg als vast contactmoment.

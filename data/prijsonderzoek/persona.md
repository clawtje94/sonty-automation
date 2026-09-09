# Persona prijsonderzoek (mystery shopping) — aangemaakt 2026-09-09, spec bijgesteld 09-09 avond (Daimy)

- Naam: Sanne Vermeulen (weergavenaam + handtekening in Proton gezet)
- E-mail: sanne.vermeulen84@proton.me (wachtwoord: proton-wachtwoord.txt in deze map, niet in git)
- Adres (FICTIEF, bestaat niet in BAG, ligt tussen echte villa's 54 en 58): Backershagenlaan 56, 2243 AE Wassenaar
- Telefoon: geen (alleen mail); als een formulier een nummer eist: 06 wordt NIET verzonnen -> formulier overslaan en mailen
- Verhaal (alleen als er expliciet naar gevraagd wordt, NIET in de aanvraag): vrijstaand huis, achtergevel zuidwest. Ramen: achter 237x228 en 176x214 (screens), zijgevel 204x236 en 143x197 (rolluiken); maten wijken bewust af zodat het echt oogt (Daimy 09-09). Bij de ene kamer kan de elektricien stroom trekken, bij de andere niet, vandaar per product 1x bedraad + 1x solar.
- Voettekst "Verzonden met Proton Mail" per mail handmatig weghalen (betaald om uit te zetten); handtekening "Met vriendelijke groet, Sanne Vermeulen" staat vast.

## Standaard-uitvraag (zelfde spec bij ELKE aanbieder, prijzen vergelijkbaar)
1. Ritsscreen elektrisch bedraad (Somfy of vergelijkbaar), 237 x 228 cm, antraciet RAL 7016, doek grijs (serge/soltis-achtig), 1 stuk
2. Ritsscreen solar (accu + zonnepaneel), 176 x 214 cm, antraciet, doek grijs, 1 stuk
3. Rolluik elektrisch bedraad, 204 x 236 cm, antraciet, aluminium lamellen, 1 stuk
4. Rolluik solar, 143 x 197 cm, antraciet, 1 stuk
5. Extra vraag (Daimy 09-09): verkopen ze pergola's of knikarmschermen? Dan ook offerte 4,5 m breed x 3 m uitval, elektrisch, antraciet.
Steeds: prijs incl. btw, incl. montage én (als aangeboden) zonder montage, levertijd, garantie, motormerk.
Montage-ondergrond: metselwerk (baksteen), op de dag. Geen inmeetafspraak plannen; vragen om richtprijs/offerte per mail.

## Standaardtekst aanvraag
Onderwerp: Offerte 2 ritsscreens + 2 rolluiken (Wassenaar)
Tekst = aanvraag-body.txt (Daimy 09-09: geen verhaal over vrijstaand huis of elektricien, gewoon offerte vragen + adres).

## Fictieve adressen per regio (PDOK-gecontroleerd: nummer bestaat niet, buren wel, zelfde postcode)
- Zuid-Holland (standaard): Backershagenlaan 56, 2243 AE Wassenaar
- Utrecht: Soestdijkseweg Zuid 103, 3721 AA Bilthoven
- Gelderland: Pietersbergseweg 22, 6862 BV Oosterbeek
- Noord-Brabant oost: Boslaan 47, 5263 NX Vught
- Noord-Brabant west: Ulvenhoutselaan 74, 4834 MH Breda
Regel (Daimy 09-09): aanbieder ver weg (bv. richting Utrecht) krijgt het adres in zijn eigen regio, zodat het in zijn werkgebied ligt. Zoeken: scripts/prijsonderzoek-adres-gap.js "Straat|Plaats".
- Overijssel/Twente: Boddenkampsingel 23, 7514 AN Enschede
- Zuid-Holland zuid (Barendrecht/Rotterdam): Kleidijk 39, 3161 EK Rhoon

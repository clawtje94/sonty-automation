
======================================================================
# Knikarmschermen (priceCalc=None, resultScore=nee)

## [PAGE] Keuzemenu (pos 0)
  - RADIO 'Kies je knikarmscherm': Sunbasic open cassette, Sunbasic dichte cassette, Suneye Dichte Cassette, Sunelite Dichte Cassette

## [PAGE] Sunbasic open cassette (pos 1)
  - RADIO 'Kleur': Cremewit [RAL 9001], Antraciet [RAL 7016 structuur]
  - RADIO 'Welk type bediening wil je?': Handbediend [Slingerstang], Somfy WT motor [Draaischakelaar], Somfy IO motor [Motor + afstandsbediening]
  - NUMBER 'Breedte': min=2800 max=5500 step=1

## [PAGE] Sunbasic open cassette uitval (breedte >5500mm) (pos 2)
  - RADIO 'Uitval': 2000 mm, 2500 mm, 3000 mm

## [PAGE] Sunbasic open cassette uitval (breedte <5500mm) 2 (pos 3)
  - RADIO 'Uitval': 2000 mm, 2500 mm

## [PAGE] Sunbasic gesloten cassette (pos 4)
  - RADIO 'Kleur': Cremewit [RAL 9001], Antraciet [RAL 7016 structuur]
  - RADIO 'Welk type bediening wil je?': Somfy WT motor [Draaischakelaar], Somfy IO motor [Motor + Afstandsbediening]
  - NUMBER 'Breedte': min=2800 max=5500 step=1

## [PAGE] Suneye dichte cassette (pos 5)
  - RADIO 'Kleur': Gebroken wit [RAL 9010], Cremewit [RAL 9001], Antraciet [RAL 7016 structuur], Blank aluminium [RAL 9007], Andere RAL kleur
  - TEXT ''
  - RADIO 'Welk type bediening wil je?': Handbediend [Slingerstang], Somfy WT motor [Draaischakelaar], Somfy IO motor [Motor + Afstandsbediening]
  - NUMBER 'Breedte': min=2250 max=6000 step=1

## [PAGE] Suneye dichte cassette (alle uitvallen) (pos 6)
  - RADIO 'Uitval': 1500 mm, 2000 mm, 2500 mm, 3000 mm

## [PAGE] Suneye dichte cassette (geen 300cm uitval) (pos 7)
  - RADIO 'Uitval': 1500 mm, 2000 mm, 2500 mm

## [PAGE] Sunelite dichte cassette (pos 8)
  - RADIO 'Kleur': Gebroken wit [RAL 9010 mat], Antraciet [RAL 7016 structuur], Andere RAL kleur
  - TEXT ''
  - RADIO 'Welk type bediening wil je?': Somfy WT motor [Draaischakelaar], Somfy IO motor [Motor + Afstandsbediening], Somfy IO motor + ledverlichting [Motor + afstandsbediening + Dimbare ledverlichting]
  - NUMBER 'Breedte': min=2450 max=6000 step=1

## [PAGE] Sunelite dichte cassette (alle opties) (pos 9)
  - RADIO 'Uitval': 2500 mm, 3000 mm, 3500 mm

## [PAGE] Sunelite dichte cassette (2 opties)  (pos 10)
  - RADIO 'Uitval': 2500 mm, 3000 mm

## [PAGE] Sunelite dichte cassette (1 optie)  (pos 11)
  - RADIO 'Uitval': 2500 mm

## [PAGE] Eolis 3D Windsensor (pos 12)
  - RADIO 'Wil je een 100% draadloze windsensor toevoegen?': Ja, Nee
  - RADIO 'Somfy connectivity app bediening': Ja, Nee

## [PAGE] Uitbouw (pos 13)
  - RADIO 'Heeft u een uitbouw?': Ja, Nee

## [PAGE] Contactgegevens (pos 14)
  - TEXT 'Persoonsgegevens'
  - TEXT ''
  - TEXT ''
  - TEXT ''
  - TEXT 'Adresgegevens'
  - TEXT ''
  - TEXT ''
  - TEXT ''
  - TEXT_AREA 'Stel hier jouw vraag'

## [FINAL_PAGE] Bedankt pagina (pos 12)

Relaties: 37 (17 conditioneel)
  Keuzemenu -> Sunbasic open cassette [AND] QUESTION:{"questionId": "e98bf5c3-0197-4b9b-b54d-0d53b38d8ef3", "condition": "", "comparator": "EQU
  Keuzemenu -> Sunbasic gesloten cassette [AND] QUESTION:{"questionId": "e98bf5c3-0197-4b9b-b54d-0d53b38d8ef3", "condition": "", "comparator": "EQU
  Keuzemenu -> Suneye dichte cassette [AND] QUESTION:{"questionId": "e98bf5c3-0197-4b9b-b54d-0d53b38d8ef3", "condition": "", "comparator": "EQU
  Keuzemenu -> Sunelite dichte cassette [AND] QUESTION:{"questionId": "e98bf5c3-0197-4b9b-b54d-0d53b38d8ef3", "comparator": "EQUALS", "value": "0
  Sunbasic open cassette -> Sunbasic open cassette uitval (breedte <5500mm) 2 [AND] QUESTION:{"questionId": "45ceba7b-0a2d-43b3-9a49-3b4381829cf2", "comparator": "IS_LESS_THAN", "valu
  Sunbasic open cassette -> Sunbasic open cassette uitval (breedte <5500mm) 2 [AND] QUESTION:{"questionId": "45ceba7b-0a2d-43b3-9a49-3b4381829cf2", "comparator": "IS_GREATER_THAN", "v
  Sunbasic open cassette uitval (breedte >5500mm) -> Eolis 3D Windsensor [OR] QUESTION:{"questionId": "d5b3a7a4-c32c-4918-96ac-d026a003bea3", "comparator": "EQUALS", "value": "5; QUESTION:{"questionId": "986af40a-27ee-4ce7-b0d9-ea470f1e9e65", "comparator": "EQUALS", "value": "4
  Sunbasic open cassette uitval (breedte <5500mm) 2 -> Eolis 3D Windsensor [OR] QUESTION:{"questionId": "d5b3a7a4-c32c-4918-96ac-d026a003bea3", "comparator": "EQUALS", "value": "5; QUESTION:{"questionId": "986af40a-27ee-4ce7-b0d9-ea470f1e9e65", "comparator": "EQUALS", "value": "4
  Sunbasic gesloten cassette -> Sunbasic open cassette uitval (breedte <5500mm) 2 [AND] QUESTION:{"questionId": "9584ce0a-b795-4132-ad68-fc21a8a5a422", "comparator": "IS_LESS_THAN", "valu
  Suneye dichte cassette -> Suneye dichte cassette (geen 300cm uitval) [OR] QUESTION:{"questionId": "8853c902-9c6b-421e-89a9-df31a5985d9c", "comparator": "IS_LESS_THAN", "valu; QUESTION:{"questionId": "8853c902-9c6b-421e-89a9-df31a5985d9c", "comparator": "IS_GREATER_THAN", "v
  Suneye dichte cassette (alle uitvallen) -> Eolis 3D Windsensor [AND] QUESTION:{"questionId": "9b66c650-50ff-4c77-ae0d-3b6d512a45ed", "comparator": "EQUALS", "value": "c
  Suneye dichte cassette (geen 300cm uitval) -> Eolis 3D Windsensor [AND] QUESTION:{"questionId": "9b66c650-50ff-4c77-ae0d-3b6d512a45ed", "comparator": "EQUALS", "value": "c
  Sunelite dichte cassette -> Sunelite dichte cassette (1 optie)  [AND] QUESTION:{"questionId": "5c56af3d-0fcd-406d-bc50-e70798fcd3e3", "comparator": "IS_LESS_THAN", "valu
  Sunelite dichte cassette -> Sunelite dichte cassette (2 opties)  [AND] QUESTION:{"questionId": "5c56af3d-0fcd-406d-bc50-e70798fcd3e3", "comparator": "IS_GREATER_THAN", "v; QUESTION:{"questionId": "5c56af3d-0fcd-406d-bc50-e70798fcd3e3", "comparator": "IS_LESS_THAN", "valu
  Sunelite dichte cassette (alle opties) -> Eolis 3D Windsensor [AND] QUESTION:{"questionId": "eca13574-3d09-4a2f-956a-370d5c52f053", "comparator": "EQUALS", "value": "2
  Sunelite dichte cassette (2 opties)  -> Eolis 3D Windsensor [AND] QUESTION:{"questionId": "eca13574-3d09-4a2f-956a-370d5c52f053", "comparator": "EQUALS", "value": "2
  Sunelite dichte cassette (1 optie)  -> Eolis 3D Windsensor [AND] QUESTION:{"questionId": "eca13574-3d09-4a2f-956a-370d5c52f053", "comparator": "EQUALS", "value": "2

======================================================================
# Markies (priceCalc=None, resultScore=nee)

## [PAGE] Markies (pos 1)
  - RADIO 'Kies materiaal': Hout, Aluminium
  - RADIO 'Kleur': Cremewit [RAL 9001], Verkeerswit [RAL 9016], Antraciet [RAL 7016], Zwart [RAL 9005], Kwartsgrijs [RAL 7039], Blankaluminium [RAL 9006], Grijs aluminium [RAL 9007], Dennengroen [RAL 6009], Zwartgrijs [RAL 7021], Andere RAL kleur
  - TEXT ''
  - RADIO 'Welk type bediening wil je?': Handbediend [Koord buitenzijde], Somfy LT motor [Draaischakelaat], Somfy IO motor [Motor + Afstandsbediening], Somfy IO motor Solar [Motor zonder kabels], Brel solar motor [Motor zonder kabels]
  - NUMBER 'Breedte': min=1000 max=4000 step=1
  - RADIO 'Uitval': 800 mm, 900 mm, 1000 mm, 1150 mm, 1350 mm, 1550 mm, 1650 mm, 1800 mm, 2000 mm

## [PAGE] Somfy connectivity (pos 1)
  - RADIO 'Somfy connectivity app bediening': Ja, Nee

## [PAGE] Smart hub (pos 2)
  - RADIO 'Smart hub': Ja, Nee

## [PAGE] Contactgegevens (pos 3)
  - TEXT 'Persoonsgegevens'
  - TEXT ''
  - TEXT ''
  - TEXT ''
  - TEXT 'Adresgegevens'
  - TEXT ''
  - TEXT ''
  - TEXT ''
  - TEXT_AREA 'Stel hier jouw vraag'

## [FINAL_PAGE] Bedankt pagina (pos 3)

Relaties: 7 (2 conditioneel)
  Markies -> Somfy connectivity [AND] QUESTION:{"questionId": "74a8f978-981d-4d70-a430-5defbdb6e089", "comparator": "EQUALS", "value": "5
  Markies -> Smart hub [AND] QUESTION:{"questionId": "74a8f978-981d-4d70-a430-5defbdb6e089", "comparator": "EQUALS", "value": "6

======================================================================
# Pergola (priceCalc=None, resultScore=nee)

## [PAGE] Pergola (pos 1)
  - RADIO 'Kleur': Antraciet [RAL 7016 structuur], Gebroken wit [RAL 9010 structuur], Andere RAL kleur
  - TEXT ''
  - RADIO 'Welk type bediening wil je?': Somfy WT motor [Draaischakelaar], Somfy IO motor [Motor + Afstandbediening  ]
  - NUMBER 'Breedte': min=3000 max=6000 step=1
  - NUMBER 'Diepte': min=2500 max=4500 step=1

## [PAGE] Contactgegevens (pos 2)
  - TEXT 'Persoonsgegevens'
  - TEXT ''
  - TEXT ''
  - TEXT ''
  - TEXT 'Adresgegevens'
  - TEXT ''
  - TEXT ''
  - TEXT ''
  - TEXT_AREA 'Stel hier jouw vraag'

## [FINAL_PAGE] Bedankt pagina (pos 3)

Relaties: 3 (0 conditioneel)

======================================================================
# Rolluiken (priceCalc=None, resultScore=nee)

## [PAGE] Rolluiken (pos 1)
  - RADIO 'Kleur': Crèmewit [RAL 9001], Wit [RAL 9016], Antraciet [RAL 7016], Quarts grijs [RAL 7039], Zwart [RAL 9005], Andere RAL kleur
  - TEXT ''
  - RADIO 'Welk type bediening wil je?': Handbediend [Band naar binnen], Somfy WT motor [Draaischakelaar], Somfy IO motor [Motor + Afstandsbediening], Somfy IO motor Solar [Zonder bedrading.]
  - NUMBER 'Breedte': min=1000 max=4000 step=1
  - NUMBER 'Hoogte': min=1000 max=2800 step=1

## [PAGE] Contactgegevens (pos 2)
  - TEXT 'Persoonsgegevens'
  - TEXT ''
  - TEXT ''
  - TEXT ''
  - TEXT 'Adresgegevens'
  - TEXT ''
  - TEXT ''
  - TEXT ''
  - TEXT_AREA 'Stel hier jouw vraag'

## [FINAL_PAGE] Bedankt pagina (pos 3)

Relaties: 3 (0 conditioneel)

======================================================================
# Screens (priceCalc=None, resultScore=nee)

## [PAGE] Keuzemenu (pos 0)
  - RADIO 'Kies je screen': Windvast, Niet windvast

## [PAGE] Square 85 (pos 1)
  - RADIO 'Kleur': Gebroken wit [RAL 9010], Cremewit [RAL 9001], Antraciet [RAL 7016 structuur], Blank aluminium [RAL 9007], Andere RAL kleur
  - TEXT ''
  - RADIO 'Welk type bediening wil je?': Handbediend [Slingerstang buitenzijde], Somfy LT motor [Draaischakelaar], Somfy IO motor [Motor + afstandsbediening]
  - NUMBER 'Breedte': min=1000 max=4000 step=1
  - NUMBER 'Hoogte': min=1000 max=2800 step=1

## [PAGE] Sunzip design (pos 2)
  - RADIO 'Kleur': Gebroken wit [RAL 9010], Cremewit [RAL 9001], Antraciet [RAL 7016 structuur], Blank aluminium [RAL 9007], Andere RAL kleur
  - TEXT ''
  - RADIO 'Welk type bediening wil je?': Somfy LT motor [Draaischakelaar], Somfy IO motor [Motor + afstandsbediening], Somfy IO solar [Motor zonder kabels], Brel Solar motor [Motor zonder kabels]
  - NUMBER 'Breedte': min=2000 max=6000 step=1
  - NUMBER 'Hoogte': min=2000 max=2700 step=1

## [PAGE] Contactgegevens (pos 4)
  - TEXT 'Persoonsgegevens'
  - TEXT ''
  - TEXT ''
  - TEXT ''
  - TEXT 'Adresgegevens'
  - TEXT ''
  - TEXT ''
  - TEXT ''
  - TEXT_AREA 'Stel hier jouw vraag'

## [FINAL_PAGE] Bedankt pagina (pos 5)

Relaties: 7 (2 conditioneel)
  Keuzemenu -> Sunzip design [AND] QUESTION:{"questionId": "c317b655-9db8-421c-ba8d-843a78f9ef91", "condition": "", "comparator": "EQU
  Keuzemenu -> Square 85 [AND] QUESTION:{"questionId": "c317b655-9db8-421c-ba8d-843a78f9ef91", "condition": "", "comparator": "EQU

======================================================================
# Serre zonwering (priceCalc=None, resultScore=nee)

## [PAGE] Keuzemenu (pos 0)
  - RADIO 'Kies je serre zonwering': Onderdak zonwering [Suncontrol 150], ZIP Bovenliggende zonwering [Suncontrol 165]

## [PAGE] Suncontrol 150 (pos 1)
  - RADIO 'Kleur': Gebroken wit [RAL 9010 structuur], Antraciet [RAL 7016 structuur], Andere RAL kleur
  - TEXT ''
  - RADIO 'Welk type bediening wil je?': Somfy WT motor [Draaischakelaar], Somfy IO motor [Motor + afstandsbediening ]
  - NUMBER 'Breedte': min=1400 max=12000 step=1
  - NUMBER 'Diepte': min=2500 max=4500 step=1

## [PAGE] Bovenliggende zonwering (pos 2)
  - RADIO 'Kleur': Gebroken wit [RAL 9010 structuur], Antraciet [RAL 7016 structuur], Andere RAL kleur
  - TEXT ''
  - RADIO 'Welk type bediening wil je?': Somfy WT motor [Draaischakelaar], Somfy IO motor [Motor + afstandsbediening]
  - NUMBER 'Breedte': min=1400 max=6000 step=1
  - NUMBER 'Diepte': min=2500 max=4500 step=1

## [PAGE] Contactgegevens (pos 4)
  - TEXT 'Persoonsgegevens'
  - TEXT ''
  - TEXT ''
  - TEXT ''
  - TEXT 'Adresgegevens'
  - TEXT ''
  - TEXT ''
  - TEXT ''
  - TEXT_AREA 'Stel hier jouw vraag'

## [FINAL_PAGE] Bedankt pagina (pos 5)

Relaties: 7 (2 conditioneel)
  Keuzemenu -> Suncontrol 150 [AND] QUESTION:{"questionId": "004e77fd-ffa1-4518-83a0-75da1561a88f", "condition": "", "comparator": "EQU
  Keuzemenu -> Bovenliggende zonwering [AND] QUESTION:{"questionId": "004e77fd-ffa1-4518-83a0-75da1561a88f", "condition": "", "comparator": "EQU

======================================================================
# Uitvalschermen (priceCalc=None, resultScore=nee)

## [PAGE] Keuzemenu (pos 0)
  - RADIO 'Kies je uitvalscherm': Sunproject, Suncube XL

## [PAGE] Sunproject (pos 1)
  - RADIO 'Kleur': Blank aluminium [RAL 9007], Cremewit [RAL 9001]
  - RADIO 'Welk type bediening wil je?': Somfy IO motor [Motor + Afstandsbediening ], Handbediend [Slingerstang buitenzijde], Somfy LT motor [Draaischakelaar], Brel Solar motor [Zonder kabels]
  - NUMBER 'Breedte': min=800 max=8000 step=1
  - RADIO 'Uitval': 950 mm, 1150 mm

## [PAGE] Suncube XL (pos 2)
  - RADIO 'Kleur': Blank aluminium [RAL 9007], Cremewit [RAL 9001], Antraciet [RAL 7016 structuur], Andere RAL kleur
  - TEXT ''
  - RADIO 'Welk type bediening wil je?': Somfy IO motor [Motor + Afstandsbediening], Handbediend [Slingerstang buitenzijde], Somfy LT motor [Draaischakelaar], Brel Solar motor [Zonder kabels]
  - NUMBER 'Breedte': min=1400 max=6000 step=1
  - RADIO 'Uitval': 950 mm, 1150 mm, 1350 mm

## [PAGE] Contactgegevens (pos 4)
  - TEXT 'Persoonsgegevens'
  - TEXT ''
  - TEXT ''
  - TEXT ''
  - TEXT 'Adresgegevens'
  - TEXT ''
  - TEXT ''
  - TEXT ''
  - TEXT_AREA 'Stel hier jouw vraag'

## [FINAL_PAGE] Bedankt pagina (pos 5)

Relaties: 7 (2 conditioneel)
  Keuzemenu -> Sunproject [AND] QUESTION:{"questionId": "f6b0c3f4-43eb-4096-95a9-40c5a612c5e0", "condition": "", "comparator": "EQU
  Keuzemenu -> Suncube XL [AND] QUESTION:{"questionId": "f6b0c3f4-43eb-4096-95a9-40c5a612c5e0", "condition": "", "comparator": "EQU
#!/usr/bin/env python3
"""Zet de ruwe crawl-resultaten van het Sunmaster ISP-Vision bestelportaal om naar een markdown-document.

Invoer: een of meer JSON-bestanden (window.__SMR dumps) uit ~/.playwright-mcp/smr-*.json
Uitvoer: ~/sonty/docs/sunmaster-bestelportaal-variabelen.md
"""
import glob, json, os, re, sys, datetime

SRC = sys.argv[1:] or sorted(glob.glob(os.path.expanduser('~/.playwright-mcp/smr-*.json')))
OUT = os.path.expanduser('~/sonty/docs/sunmaster-bestelportaal-variabelen.md')
RAW = os.path.expanduser('~/sonty/data/sunmaster-portaal-variabelen.json')

results = []
for f in SRC:
    d = json.load(open(f))
    if isinstance(d, str):
        d = json.loads(d)
    results.extend(d)

# per product: laatste run per tag wint
by_prod = {}
for r in results:
    by_prod.setdefault(r['product'], {})[r.get('tag', 'std')] = r

os.makedirs(os.path.dirname(RAW), exist_ok=True)
json.dump(by_prod, open(RAW, 'w'), indent=1, ensure_ascii=False)

def clean(o):
    return re.sub(r'\s+', ' ', o).strip()

def cell_(o):
    return clean(o).replace('|', '\\|')

LISTS = {}  # inhoud-hash -> (naam, veld, opties)
def list_ref(field, opts):
    opts = sorted(set(opts))
    key = '\n'.join(opts)
    if key not in LISTS:
        LISTS[key] = (f'L{len(LISTS)+1}', field, opts)
    return LISTS[key][0]

L = []
L.append('# Sunmaster bestelportaal (ISP-Vision): bestelflow en variabelen per product')
L.append('')
L.append(f'Gemeten op {datetime.date.today().isoformat()} in het demo-portaal "Demo portaal Zonwering Direct" (account Daimy Boot, geen 2FA). '
         'Alles is live uit de invoerdialoog van het portaal uitgelezen; niets is opgeslagen of verstuurd.')
L.append('')
L.append('## Bestelflow (zo werkt bestellen)')
L.append('')
L.append('1. Inloggen op portal.sunmaster.nl (Servoy "Vision"), portaal `cs`, licentiehouder Sunmaster Nederland B.V.')
L.append('2. Startscherm: knoppen **raadplegen order** (orderportefeuille + nieuwe orders), **offerte aanvraag**, **Documenten** (orderbevestigingen en facturen), **Orderhistorie** (alle orders na 01-04-2021).')
L.append('3. Nieuwe order/offerte = orderkop + orderregels. Orderkop: *Orderreferentie* (vrije tekst, eigen kenmerk), *Leveringsconditie* (standaard `AFH` = afhalen, keuzelijst), *Totaalbedrag excl. btw* (berekend), vinkje *Vul met vorige ingave-productinfo* (kopieert productkeuzes van de vorige regel), *Aflever adres* (vast op het geregistreerde klantadres, alleen land te kiezen uit NL/BE/DE/… en een vrij veld *Afleveropmerking*).')
L.append('4. **Artikel toevoegen** opent "Snelzoeken" met de artikellijst (18 artikelen, eenheid M2). Dubbelklik op een artikel opent de dialoog **Productingave**.')
L.append('5. Productingave is een cascade: velden verschijnen pas nadat het veld ervoor is ingevuld (bijv. *Bedienings kant* verschijnt na *Breedte*; *Type Bediening*, *Bed. optie 1*, *Optie* verschijnen na *Uitval/Arm*). Elke keuzelijst toont max. 50 regels en filtert op "bevat".')
L.append('6. Maten worden direct gevalideerd: buiten bereik geeft een waarschuwing "Waarde X ligt niet tussen MIN en MAX". *Doeklengte* wordt automatisch berekend uit de uitval (bij Sunbasic uitval 1500 → doeklengte 1620).')
L.append('7. *Opslaan (Alt-S)* sluit de productingave en opent de orderregel: *Artikel*, *Product wijzig*, *Hoeveelheid*, *Orderregelreferentie*, *Eenheidsprijs* (inkoopprijs), *Korting %*, *Extra korting %*, *Opmerking*; daarna Ok. Grote aantallen: mail naar verkoop@sunmaster voor projectcalculatie.')
L.append('8. Levertijden (portaalbericht 14-09-2026): zonneschermen 5 wk, rolluiken 5 wk, verandazonwering 5 wk, zipscreens 7-8 wk.')
L.append('')
L.append('## Meetmethode en bevindingen over het portaal')
L.append('')
L.append('- **Keuzelijsten tonen max. 50 regels.** Scrollen helpt niet; de lijst stopt bij regel 50. De volledige lijsten zijn opgehaald door per teken (0-9, a-z, recursief) te filteren en de resultaten samen te voegen. Steekproef: doekkleur "31318 | BROOKE" staat niet in de 50 zichtbare regels, maar is via het filter wel te kiezen en blijft in het veld staan.')
L.append('- **Grote lijsten die bij meerdere producten identiek zijn** staan één keer in het lijstenbestand; bijna-identieke lijsten (bijv. kapkleuren per model) worden daar met hun verschillen genoemd.')
L.append('- **Maatgrenzen** zijn gemeten door 1 mm in te vullen en de waarschuwing van het portaal te lezen. Bij rolluiken gaf het hoogteveld geen directe waarschuwing; die grens wordt vermoedelijk pas bij opslaan gecontroleerd.')
L.append('- **Variant-runs**: voor elk product is elke keuze bij *Type Bediening* apart doorlopen; per keuze staat wat er in de vervolgvelden verandert (andere motorkabels, extra veld *Bed. optie 2* met draaistang bij handbediening, enz.). In de variant-runs zijn de grote lijsten niet opnieuw volledig opgehaald; daar telt de lijst uit de basisrun.')
L.append('- **Leveringsconditie** staat in dit demo-account vast op `AFH`; de zoekknop is uitgeschakeld. **Afleveradres** is het geregistreerde klantadres, niet per order te wijzigen (alleen land en afleveropmerking).')
L.append('- Bij het openen van een productdialoog staan alle velden even zichtbaar (o.a. *Soort doek* bij zonneschermen); na de eerste keuzes verdwijnen afgeleide velden en verschijnen de vervolgvelden. *Soort doek* wordt afgeleid van de gekozen doekkleur en is niet zelf te kiezen.')
L.append('- **Nieuwe order plaatsen** is in dit demo-account niet zichtbaar (alleen *Nieuwe offerte*); volgens de Sunmaster-handleiding werkt de orderflow identiek aan de offerteflow.')
L.append('- Ruwe data: `~/sonty/data/sunmaster-portaal-variabelen.json`; screenshots per product in `~/.playwright-mcp/sm-prod-*.png`.')
L.append('')
L.append('## Artikellijst (Snelzoeken)')
L.append('')
for p in by_prod:
    L.append(f'- {p}')
L.append('')
L.append('## Variabelen per product')
L.append('')

def render_fields(L, r):
    if r.get('widthRange'):
        L.append(f"Breedtebereik: **{r['widthRange'][0]} – {r['widthRange'][1]} mm** (gemeten via waarschuwing van het portaal; uitgelezen bij breedte {r.get('width')}).")
        L.append('')
    fixed = [x for x in (r.get('final') or []) if x['kind'] == 'fixed' and x.get('value')]
    if fixed:
        L.append('Vaste waarden (niet te kiezen): ' + ', '.join(f"*{x['label']}* = {cell_(x['value'])}" for x in fixed))
        L.append('')
    L.append('| # | Veld | Type | Keuzes / bereik | Standaard (1e keuze) |')
    L.append('|---|------|------|-----------------|----------------------|')
    for i, f in enumerate(r.get('fields', []), 1):
        if f['kind'] == 'select':
            opts = [clean(o) for o in f.get('options', [])]
            n = len(opts)
            if n <= 12:
                cell = '<br>'.join(cell_(o) for o in opts)
            else:
                cell = f'{n} keuzes, zie lijst **{list_ref(f["field"], opts)}** in het lijstenbestand'
            if f.get('truncatedAt50') and n == 50:
                cell += ' (mogelijk afgekapt op 50)'
            default = cell_(f.get('chosen') or '')
            extra = ' ⚠ ' + cell_(f['warn']) if f.get('warn') else ''
            L.append(f'| {i} | {f["field"]} | keuzelijst | {cell}{extra} | {default} |')
        else:
            rng = f.get('range') or ''
            m = re.search(r'tussen ([\d.]+) en ([\d.]+)', rng)
            cell = f'{m.group(1)} – {m.group(2)} mm' if m else (cell_(rng) if rng else 'vrije invoer (mm), geen directe grenscontrole gezien')
            extra = ' ⚠ ' + cell_(f['warn']) if f.get('warn') else ''
            L.append(f'| {i} | {f["field"]} | getal | {cell}{extra} | {f.get("filled") or "(automatisch berekend / leeg)"} |')
    L.append('')
    probe = r.get('probe') or []
    if probe:
        L.append('Afhankelijkheid breedte → ' + (next((p.get('field') for p in probe if p.get('field')), None) or 'uitval') + ':')
        L.append('')
        L.append('| Breedte | Keuzes |')
        L.append('|---------|--------|')
        for pr in probe:
            if pr.get('warn'):
                L.append(f"| {pr['width']} | ⚠ {cell_(pr['warn'])} |")
            else:
                L.append(f"| {pr['width']} | {', '.join(cell_(o) for o in pr.get('options', [])) or '(geen)'} |")
        L.append('')

def optset(f):
    return tuple(sorted(clean(o) for o in f.get('options', [])))

for prod, tags in by_prod.items():
    L.append(f'### {prod}')
    L.append('')
    base = tags.get('std') if tags.get('std') and not tags['std'].get('errors') else tags.get('basis') or tags.get('std')
    if base is None:
        L.append('_geen basisrun_'); L.append(''); continue
    if base.get('errors'):
        L.append('> Fouten tijdens uitlezen: ' + '; '.join(cell_(e)[:120] for e in base['errors']))
        L.append('')
    render_fields(L, base)
    variants = [(t, r) for t, r in tags.items() if t.startswith('variant')]
    if variants:
        basef = {f['field']: f for f in base.get('fields', [])}
        L.append('**Varianten (andere keuze bij ' + variants[0][0].split(' = ')[0].replace('variant ', '') + '): wat verandert er in de vervolgvelden**')
        L.append('')
        for t, r in variants:
            keuze = t.split(' = ', 1)[1] if ' = ' in t else t
            diffs = []
            for f in r.get('fields', []):
                b = basef.get(f['field'])
                if f['kind'] == 'select':
                    if b is None:
                        diffs.append(f"nieuw veld *{f['field']}*: " + ' / '.join(cell_(o) for o in f['options'][:12]) + (' …' if len(f['options']) > 12 else ''))
                    elif optset(b) != optset(f) and f['field'] != variants[0][0].split(' = ')[0].replace('variant ', ''):
                        diffs.append(f"*{f['field']}* wordt: " + (' / '.join(cell_(o) for o in f['options'][:12]) + (' …' if len(f['options']) > 12 else '') if f['options'] else '(geen keuzes)'))
                elif b is None:
                    diffs.append(f"nieuw veld *{f['field']}* (getal)")
            weg = [n for n in basef if n not in {f['field'] for f in r.get('fields', [])} and basef[n]['kind'] != 'fixed']
            if weg:
                diffs.append('vervalt: ' + ', '.join(f'*{n}*' for n in weg))
            if r.get('errors'):
                diffs.append('⚠ fout bij uitlezen: ' + cell_(r['errors'][0])[:80])
            L.append(f'- **{cell_(keuze)}** → ' + ('; '.join(diffs) if diffs else 'geen verschil in vervolgvelden'))
        L.append('')

LISTS_OUT = OUT.replace('.md', '-lijsten.md')
M = ['# Sunmaster bestelportaal: volledige keuzelijsten', '', 'Verwezen vanuit sunmaster-bestelportaal-variabelen.md. Identieke lijsten zijn één keer opgenomen.', '']
for key, (name, field, opts) in LISTS.items():
    users = [p for p, tags in by_prod.items() for r in tags.values() for f in r.get('fields', []) if f['kind'] == 'select' and '\n'.join(sorted(set(clean(o) for o in f.get('options', [])))) == key]
    M.append(f'## {name}: {field} ({len(opts)} keuzes)')
    M.append('')
    M.append('Gebruikt bij: ' + ', '.join(sorted(set(users))))
    M.append('')
    for key2, (name2, field2, opts2) in LISTS.items():
        if name2 >= name or field2 != field: continue
        a, b = set(opts), set(opts2)
        if 0 < len(a ^ b) <= 25:
            M.append(f'Verschil t.o.v. {name2}: extra = ' + (', '.join(sorted(a - b)) or 'geen') + '; ontbreekt = ' + (', '.join(sorted(b - a)) or 'geen'))
            M.append('')
    for o in opts:
        M.append(f'- {o}')
    M.append('')
open(LISTS_OUT, 'w').write('\n'.join(M))
L.insert(3, f'Volledige keuzelijsten (doekkleuren, RAL-kleuren enz.) staan in `{os.path.basename(LISTS_OUT)}`.')
open(OUT, 'w').write('\n'.join(L))
print(f'geschreven: {OUT} ({len(by_prod)} producten, {sum(len(t) for t in by_prod.values())} runs)')

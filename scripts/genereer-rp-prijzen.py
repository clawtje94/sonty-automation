#!/usr/bin/env python3
"""
Genereert data/rp-prijzen.json — de centrale prijzenfile voor het Reuzenpanda testprofiel.

Bron: ~/sonty-website/data/sunmaster-prices.json (Sunmaster Prijscatalogus 2026, incl 10% markup).
Prijzen per categorie aanpassen = deze file bewerken (of marge_per_categorie wijzigen)
en daarna `node scripts/sync-rp-artikelen.js` draaien.
"""
import json, os

SRC = os.path.expanduser('~/sonty-website/data/sunmaster-prices.json')
OUT = os.path.expanduser('~/sonty/data/rp-prijzen.json')

d = json.load(open(SRC))

CAT_MAP = {
    'knikarmscherm': 'Knikarmschermen',
    'uitvalscherm': 'Uitvalschermen',
    'screen': 'Screens',
    'zipscreen': 'Screens',
    'rolluik': 'Rolluiken',
    'verandazonwering': 'Serre zonwering',
    'serre': 'Serre zonwering',
    'pergola': 'Pergola',
    'markies': 'Markiezen',
}

prijzen = {
    '_uitleg': 'Centrale prijzenfile voor RP-artikelen (Sonty test). Pas prijzen of marge_per_categorie aan en draai: node scripts/sync-rp-artikelen.js',
    '_bron': d.get('_meta', {}),
    'marge_per_categorie': {
        # 1.0 = prijzen zoals hieronder; 1.05 = 5% erbovenop. Werkt op verkoopprijzen bij sync.
        'Knikarmschermen': 1.0, 'Uitvalschermen': 1.0, 'Screens': 1.0, 'Rolluiken': 1.0,
        'Serre zonwering': 1.0, 'Pergola': 1.0, 'Markiezen': 1.0, 'Montage': 1.0, 'Accessoires': 1.0,
    },
    'categorieen': {},
}

def cat(naam):
    return prijzen['categorieen'].setdefault(naam, [])

# Producten: per model × maatcombinatie een artikel
for key, p in d['products'].items():
    c = CAT_MAP.get(p.get('type', ''), None)
    if c is None:
        c = CAT_MAP.get(key.split('_')[0], 'Overig')
    naam = p['name']
    for maat, prijs in (p.get('voorbeeldPrijzen') or {}).items():
        cat(c).append({
            'naam': f'{naam} {maat.replace("x", "×")} cm',
            'sku': f'SM-{key}-{maat}'.upper().replace('_', '-'),
            'verkoop_incl': round(float(prijs)),
            'omschrijving': f'{naam}, breedte×{"uitval" if p.get("uitval") else "hoogte"} {maat} cm, incl. {p.get("bediening", "standaard bediening")}',
        })

# Montage per categorie
for key, prijs in d.get('montage', {}).items():
    naam = key.replace('_', ' ').capitalize()
    cat('Montage').append({
        'naam': f'Montage — {naam}',
        'sku': f'MONT-{key}'.upper().replace('_', '-'),
        'verkoop_incl': round(float(prijs)),
        'omschrijving': 'Montage door Sonty monteurs',
    })

# Accessoires
for key, v in d.get('accessoires', {}).items():
    prijs = v if isinstance(v, (int, float)) else v.get('prijs') or v.get('price') or 0
    if not prijs:
        continue
    cat('Accessoires').append({
        'naam': key.replace('_', ' ').capitalize(),
        'sku': f'ACC-{key}'.upper().replace('_', '-'),
        'verkoop_incl': round(float(prijs)),
        'omschrijving': '',
    })

# Bediening-meerprijzen per producttype
for ptype, opts in d.get('bedieningOptiesPerType', {}).items():
    if ptype.startswith('_'):
        continue
    c = CAT_MAP.get(ptype, 'Overig')
    for bed, meerprijs in opts.items():
        if not isinstance(meerprijs, (int, float)) or meerprijs == 0:
            continue
        cat(c).append({
            'naam': f'Meerprijs bediening — {bed.replace("_", " ")} ({ptype})',
            'sku': f'BED-{ptype}-{bed}'.upper().replace('_', '-'),
            'verkoop_incl': round(float(meerprijs)),
            'omschrijving': 'Meer-/minderprijs t.o.v. standaard motorbediening',
        })

# Kleur-meerprijzen
for key, v in d.get('kleurOpties', {}).items():
    adj = v.get('adjustment', 0)
    if not adj:
        continue
    cat('Accessoires').append({
        'naam': f'Meerprijs kleur — {v.get("name", key)}',
        'sku': f'KLEUR-{key}'.upper(),
        'verkoop_incl': round(float(adj)),
        'omschrijving': 'Meerprijs t.o.v. standaardkleur',
    })

json.dump(prijzen, open(OUT, 'w'), indent=1, ensure_ascii=False)
tellingen = {k: len(v) for k, v in prijzen['categorieen'].items()}
print('Geschreven:', OUT)
print(json.dumps(tellingen, indent=1, ensure_ascii=False))
print('Totaal artikelen:', sum(tellingen.values()))

# ──────────────────────────────────────────────────────────────────
# Toppoint raamdecoratie binnen (VERKOOPprijzen voor consumentenoffertes)
# Bron: bruto dealerprijzen excl. BTW → verkoop = bruto × 1.21 (incl. BTW)
# LET OP: dit zijn verkoopprijzen, géén inkoopprijzen (expliciete wens Daimy 2026-06-11)
# ──────────────────────────────────────────────────────────────────
TP_SRC = os.path.expanduser('~/zonweringdirect/data/toppoint-parsed-prices.json')
tp = json.load(open(TP_SRC))

TP_CAT = {
    'rolgordijnen': 'Raamdeco — Rolgordijnen',
    'duo-rolgordijnen': 'Raamdeco — Duo-rolgordijnen',
    'jaloezieen': 'Raamdeco — Jaloezieën',
    'jaloezieen-hout': 'Raamdeco — Jaloezieën hout',
    'plisse': 'Raamdeco — Plissé',
    'lamellen': 'Raamdeco — Lamellen',
    'vouwgordijnen': 'Raamdeco — Vouwgordijnen',
    'horren': 'Raamdeco — Horren',
    # outdoorscreen bewust overgeslagen: Daimy beslist nog waar die thuishoort
}
STOFGROEP = {'1': 'Basis collectie', '2': 'Comfort collectie', '3': 'Plus collectie',
             '4': 'Luxe collectie', '5': 'Premium collectie', 'A': 'Standaard model', 'B': 'Vrijhangend model'}
BTW = 1.21

def subsample(lst, n):
    if len(lst) <= n:
        return list(range(len(lst)))
    stap = (len(lst) - 1) / (n - 1)
    return sorted({round(i * stap) for i in range(n)})

for tp_cat, rp_cat in TP_CAT.items():
    for t in tp['categories'].get(tp_cat, []):
        grid = t['grids'][0]
        groep = STOFGROEP.get(str(grid.get('stofgroep')), f"collectie {grid.get('stofgroep')}")
        ws, hs, ps = grid['widths'], grid['heights'], grid['prices']
        for hi in subsample(hs, 3):
            for wi in subsample(ws, 4):
                try:
                    bruto = ps[hi][wi]
                except (IndexError, TypeError):
                    continue
                if not bruto:
                    continue
                verkoop = round(float(bruto) * BTW)
                maat = f'{ws[wi]}×{hs[hi]} cm'
                cat(rp_cat).append({
                    'naam': f'{t["name"]} {maat}',
                    'sku': f'TP-{t["id"]}-{ws[wi]}X{hs[hi]}'.upper(),
                    'verkoop_incl': verkoop,
                    'omschrijving': f'{t["name"]}, breedte×hoogte {maat}, {groep}, handbediend. Verkoopprijs incl. 21% BTW.',
                })
    prijzen['marge_per_categorie'].setdefault(rp_cat, 1.0)

# Elektrische bediening als meerprijs-artikelen
ELEKTRA = {
    'rolgordijnen': [('Motion accu (USB-C)', 100), ('Brel 230V', 150), ('Somfy io', 325)],
    'duo-rolgordijnen': [('Motion accu (USB-C)', 100), ('Brel 230V', 150)],
    'jaloezieen': [('Motion accu', 125), ('Somfy Tilt & Lift', 250)],
    'jaloezieen-hout': [('Motion accu', 150)],
    'plisse': [('Motion accu', 125)],
    'lamellen': [('Somfy RTS', 675)],
    'vouwgordijnen': [('Motion accu', 125)],
}
for tp_cat, opts in ELEKTRA.items():
    rp_cat = TP_CAT[tp_cat]
    for naam, meerprijs_ex in opts:
        cat(rp_cat).append({
            'naam': f'Meerprijs elektrisch — {naam} ({tp_cat})',
            'sku': f'TP-ELEK-{tp_cat}-{naam}'.upper().replace(' ', '-').replace('(', '').replace(')', '').replace('&', 'EN'),
            'verkoop_incl': round(meerprijs_ex * BTW),
            'omschrijving': 'Meerprijs elektrische bediening t.o.v. handbediend, incl. BTW',
        })

json.dump(prijzen, open(OUT, 'w'), indent=1, ensure_ascii=False)
tellingen = {k: len(v) for k, v in prijzen['categorieen'].items()}
print('\nMet Toppoint:')
print(json.dumps(tellingen, indent=1, ensure_ascii=False))
print('Totaal artikelen:', sum(tellingen.values()))

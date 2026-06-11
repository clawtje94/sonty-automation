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

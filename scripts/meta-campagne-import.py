#!/usr/bin/env python3
# Parse Meta Ads Manager campagne-CSV's (maandexports) uit data/ad-rapporten/meta/
# naar data/campagne-spend-meta.json + Meta-maandtotalen in data/ad-spend-handmatig.json.
import csv, glob, json, os
BASIS = os.path.join(os.path.dirname(__file__), '..', 'data')
tot = {}
for f in sorted(glob.glob(os.path.join(BASIS, 'ad-rapporten', 'meta', '*.csv'))):
    with open(f, encoding='utf-8-sig') as fh:
        for r in csv.DictReader(fh):
            m = (r.get('Start rapportage') or '')[:7]
            if not m: continue
            naam = r.get('Campagnenaam', '?')
            tot.setdefault(m, {})[naam] = {
                'spend': round(float(r.get('Besteed bedrag (EUR)') or 0), 2),
                'kliks': int(float(r.get('Klikken op links') or 0)),
            }
json.dump(tot, open(os.path.join(BASIS, 'campagne-spend-meta.json'), 'w'), indent=1, ensure_ascii=False)
# maandtotalen naar ad-spend-handmatig (Meta): CSV-bron wint van sheet-tab
hp = os.path.join(BASIS, 'ad-spend-handmatig.json')
h = json.load(open(hp)) if os.path.exists(hp) else {}
for m, cs in tot.items():
    h.setdefault(m, {})['Meta'] = round(sum(v['spend'] for v in cs.values()), 2)
json.dump(h, open(hp, 'w'), indent=1, ensure_ascii=False)
print('campagne-spend-meta.json:', ', '.join(f"{m} €{sum(v['spend'] for v in cs.values()):.0f}" for m, cs in sorted(tot.items())))

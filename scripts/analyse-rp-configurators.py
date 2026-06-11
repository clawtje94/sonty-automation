#!/usr/bin/env python3
"""Zet de gedumpte Sonty B.V. configurators om naar een leesbaar productstructuur-overzicht."""
import json, glob, os

OUT = []
for f in sorted(glob.glob(os.path.expanduser('~/sonty/data/rp-configurator-voorbeelden/sonty-bv-*.json'))):
    d = json.load(open(f))
    c = d['body'].get('configurator', d['body'])
    OUT.append(f"\n{'='*70}\n# {c.get('name')} (priceCalc={c.get('priceCalculationType')}, resultScore={'ja' if c.get('resultScore') else 'nee'})")
    steps = {s['id']: s for s in c.get('steps', [])}
    for s in c.get('steps', []):
        OUT.append(f"\n## [{s.get('type')}] {s.get('name')} (pos {s.get('position')})")
        for q in s.get('questions', []):
            md = q.get('metaData', {})
            naam = q.get('name') or md.get('label') or md.get('title') or ''
            if q['type'] == 'RADIO':
                answers = md.get('answers', [])
                opts = ', '.join(f"{a['text']}" + (f" [{a['metaData'].get('description')}]" if a.get('metaData', {}).get('description') else '') for a in answers)
                OUT.append(f"  - RADIO '{naam}': {opts}")
            elif q['type'] == 'NUMBER':
                OUT.append(f"  - NUMBER '{naam}': min={md.get('min')} max={md.get('max')} step={md.get('step')}")
            else:
                OUT.append(f"  - {q['type']} '{naam}'")
    rels = c.get('relations', [])
    conds = [r for r in rels if r.get('conditionType') != 'NO_CONDITION']
    OUT.append(f"\nRelaties: {len(rels)} ({len(conds)} conditioneel)")
    for r in conds:
        frm = steps.get(r['from'], {}).get('name', r['from'][:8])
        to = steps.get(r['to'], {}).get('name', r['to'][:8])
        cdesc = []
        for cond in (r.get('conditions') or []):
            mdc = cond.get('metaData', {})
            cdesc.append(f"{cond.get('type')}:{json.dumps(mdc, ensure_ascii=False)[:90]}")
        OUT.append(f"  {frm} -> {to} [{r.get('conditionType')}] {'; '.join(cdesc)}")

path = os.path.expanduser('~/sonty/data/rp-configurator-voorbeelden/STRUCTUUR.md')
open(path, 'w').write('\n'.join(OUT))
print(f"Geschreven: {path} ({len(OUT)} regels)")

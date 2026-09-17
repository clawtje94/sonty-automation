#!/usr/bin/env python3
"""Genereert de marktpositie-pagina (html) uit antwoorden/aanbieders-data.json. Gebruik: python3 scripts/prijsonderzoek-pagina.py"""
import json, statistics, html
from pathlib import Path

BASE = Path.home() / "sonty/data/prijsonderzoek/antwoorden"
D = json.loads((BASE / "aanbieders-data.json").read_text())
S = D["sonty"]["verkoop"]; L = D["sonty"]["lijst"]
A = sorted(D["aanbieders"], key=lambda a: a["totaal4"])

def eur(v):
    return "–" if v is None else "€ " + f"{v:,.0f}".replace(",", ".")

tot = [a["totaal4"] for a in A]
alle = sorted(tot + [S["totaal4"]])
mediaan = statistics.median(alle)
goedkoper = sum(1 for t in tot if t < S["totaal4"]); duurder = len(tot) - goedkoper
pct = round((S["totaal4"] / mediaan - 1) * 100)
kn = sorted([(a["knikarm"], a["naam"]) for a in A + D["deels"] if a.get("knikarm")] + [(S["knikarm"], "Sonty")])
kn_pos = [n for _, n in kn].index("Sonty") + 1
kn_goedkoper = kn_pos - 1
sunmaster = [a for a in A if "Sunmaster" in a["type"]]
sm_range = (min(a["totaal4"] for a in sunmaster), max(a["totaal4"] for a in sunmaster))
suneye = sorted(a["knikarm"] for a in A if a["knikarm"] and "SunEye" in a["knikarm_merk"])
maxv = max(alle + [L["totaal4"]])

def w(v): return f"{v / maxv * 100:.1f}%"
med_left = w(mediaan)

def goog(a):
    return 'nog niet opgezocht' if a.get('google_score') is None else f'<span class="num">{a["google_score"]:.1f}</span> · {a["google_reviews"]} reviews'

def pill(txt, kleur): return f'<span class="pill {kleur}">{html.escape(txt)}</span>'

CSS = (BASE / "marktpositie.css").read_text() if (BASE / "marktpositie.css").exists() else ""

rows = []
def row(lab, sub, val, cls=""):
    rows.append(f'<div class="row {cls}"><div class="lab">{lab}<span>{sub}</span></div><div class="track"><div class="bar" style="width:{w(val)}"></div><div class="median" style="left:{med_left}"></div></div><div class="val num">{eur(val)}</div></div>')
items = [(a["totaal4"], a) for a in A] + [(S["totaal4"], "SONTY"), (L["totaal4"], "LIJST")]
for v, a in sorted(items, key=lambda x: x[0]):
    if a == "SONTY": row("Sonty verkoopprijs", f"lijst min vaste 15% · Sunmaster Zip Square, Rolluik S-42 · Google {D['sonty']['google_score']:.1f} ({D['sonty']['google_reviews']})", v, "sonty")
    elif a == "LIJST": row("Sonty lijstprijs, ter info", "wordt nooit gerekend", v, "actie")
    else: row(html.escape(a["naam"]), html.escape(f'{a["plaats"]} · {a["type"]} · {a["screens"]} · Google ' + (f"{a['google_score']:.1f} ({a['google_reviews']})" if a.get('google_score') else '?')), v)

def prijsrij(a, cls=""):
    return (f'<tr class="{cls}"><td>{html.escape(a["naam"])} ({html.escape(a["plaats"])})</td>'
            f'<td class="n">{eur(a["screen_io"])}</td><td class="n">{eur(a["screen_solar"])}</td><td class="n">{eur(a.get("rolluik_io"))}</td><td class="n">{eur(a.get("rolluik_solar"))}</td>'
            f'<td class="n">{eur(a["knikarm"])}</td><td class="n">{eur(a.get("pergola"))}</td><td class="n"><strong>{eur(a.get("totaal4"))}</strong></td><td>{html.escape(a["montage"])}</td></tr>')
prijs = []
for a in A:
    if a["totaal4"] > S["totaal4"] and not any("sonty" in r for r in prijs):
        prijs.append('<tr class="sonty"><td>Sonty verkoopprijs (lijst -15%)</td>' + "".join(f'<td class="n">{eur(S[k])}</td>' for k in ["screen_io","screen_solar","rolluik_io","rolluik_solar","knikarm","pergola"]) + f'<td class="n"><strong>{eur(S["totaal4"])}</strong></td><td>incl. montage 195 / 175 / 275 / 650</td></tr>')
    prijs.append(prijsrij(a))
prijs.append('<tr class="lijst"><td>Sonty lijstprijs (ter info)</td>' + "".join(f'<td class="n">{eur(L[k])}</td>' for k in ["screen_io","screen_solar","rolluik_io","rolluik_solar","knikarm","pergola"]) + f'<td class="n">{eur(L["totaal4"])}</td><td>wordt nooit gerekend</td></tr>')
for a in D["deels"]:
    prijs.append(prijsrij({**a, "rolluik_io": None, "rolluik_solar": None, "totaal4": None}))

merk = []
for a in A + D["deels"]:
    merk.append(f'<tr><td>{html.escape(a["naam"])} ({html.escape(a["plaats"])})</td><td>{html.escape(a["screens"])}</td><td>{html.escape(a["rolluiken"])}</td><td>{html.escape(a["knikarm_merk"])}</td><td>{html.escape(a["motor"])}</td><td>{pill(a["garantie"], a["gar_kleur"])}</td><td>{html.escape(a["levertijd"])}</td><td>{goog(a)}</td></tr>')
merk.insert(0, '<tr class="sonty"><td>Sonty</td><td>Sunmaster Zip Square / Design</td><td>Sunmaster S-42 / S-37, Roma</td><td>Sunmaster SunEye / SunElite</td><td>Somfy RS100 io · Tahoma € 195</td>' + pill("3 jr montage, 5 jr product, 7 jr motor", "good") + f'<td>korter dan dealers</td><td><strong>{D["sonty"]["google_score"]:.1f} · {D["sonty"]["google_reviews"]} reviews</strong></td></tr>')

PROD=[("screen_io","Screen op stroom 237×228"),("screen_solar","Screen solar 176×214"),("rolluik_io","Rolluik op stroom 204×236"),("rolluik_solar","Rolluik solar 143×197"),("knikarm","Knikarm 450×300"),("pergola","Pergola 450×300")]
prod_html=[]
for key,titel in PROD:
    lst=[(a[key],a["naam"]) for a in A+D["deels"] if a.get(key)]
    lst.append((S[key],"Sonty"))
    lst.sort()
    vals=[v for v,_ in lst]; med=statistics.median(vals); mx=max(vals)
    pos=[n for _,n in lst].index("Sonty")+1
    dpct=round((S[key]/med-1)*100)
    bars="".join(f'<div class="prow{" sonty" if n=="Sonty" else ""}"><div class="plab">{html.escape(n)}</div><div class="ptrack"><div class="pbar" style="width:{v/mx*100:.1f}%"></div><div class="median" style="left:{med/mx*100:.1f}%"></div></div><div class="pval num">{eur(v)}</div></div>' for v,n in lst)
    prod_html.append(f'<div class="prod"><h3>{titel}</h3><p class="pmeta">Sonty {eur(S[key])} · plek {pos} van {len(lst)} · midden {eur(med)} ({dpct:+d}%)</p>{bars}</div>')
PROD_CSS=".prods{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.prod{background:var(--surface);border:1px solid var(--line);padding:14px 16px}.prod h3{font-family:'Barlow Condensed',Figtree,sans-serif;font-size:19px;font-weight:700}.pmeta{margin:2px 0 10px;color:var(--ink2);font-size:12.5px}.prow{display:grid;grid-template-columns:150px 1fr 62px;gap:8px;align-items:center;padding:2px 0}.plab{font-size:12px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ptrack{position:relative;height:10px}.pbar{height:10px;background:var(--bar);border-radius:0 3px 3px 0}.prow.sonty .pbar{background:var(--accent)}.prow.sonty .plab,.prow.sonty .pval{font-weight:700;color:var(--accent-ink)}.pval{text-align:right;font-size:12px;font-weight:600}@media (max-width:760px){.prods{grid-template-columns:1fr}}"

W=D.get("webshops",[]); SX=D["sonty"]["verkoop_excl_montage"]
def wtot(w):
    ks=["screen_io","screen_solar","rolluik_io","rolluik_solar"]
    return sum(w[k] for k in ks) if all(w.get(k) for k in ks) else None
web_rows=[]
for w in sorted(W, key=lambda w: (wtot(w) is None, wtot(w) or 0)):
    web_rows.append(f'<tr><td>{html.escape(w["naam"])}<br><span class="sub2">{html.escape(w["type"])}</span></td><td class="n">{eur(w["screen_io"])}</td><td class="n">{eur(w["screen_solar"])}</td><td class="n">{eur(w["rolluik_io"])}</td><td class="n">{eur(w["rolluik_solar"])}</td><td class="n"><strong>{eur(wtot(w))}</strong></td><td>{html.escape(w["montage"])}</td><td>{html.escape(w["motor"])}</td><td>{html.escape(w["bron"])}{(" · "+html.escape(w["noot"])) if w["noot"] else ""}</td></tr>')
web_rows.append('<tr class="sonty"><td>Sonty, product zonder montage (verkoopprijs)</td>'+"".join(f'<td class="n">{eur(SX[k])}</td>' for k in ["screen_io","screen_solar","rolluik_io","rolluik_solar"])+f'<td class="n"><strong>{eur(SX["totaal4"])}</strong></td><td>montage apart 195/175</td><td>Somfy RS100 io</td><td>rekentool, lijst -15%, zonder montagedeel</td></tr>')
webtots=[wtot(w) for w in W if wtot(w)]
WEB_CSS=".sub2{color:var(--muted);font-size:11.5px}"

# Wat-als: 5% onder zonwering-fabriek, bij 50% marge op de Sunmaster-lijstprijs
LP=D["sonty"]["lijst_product_excl_montage"]; M=D["sonty"]["marge_op_lijst"]
ZF=next(w for w in W if w["naam"]=="zonwering-fabriek.nl")
KEYS=[("screen_io","Screen stroom"),("screen_solar","Screen solar"),("rolluik_io","Rolluik stroom"),("rolluik_solar","Rolluik solar")]
wa_rows=[]; tot_zf=tot_doel=tot_kost=tot_nu=0
for k,lab in KEYS:
    zf=ZF[k]; doel=round(zf*0.95); kost=round(LP[k]*(1-M)); nu=SX[k]
    marge_nu=(nu-kost)/nu*100; marge_doel=(doel-kost)/doel*100
    tot_zf+=zf; tot_doel+=doel; tot_kost+=kost; tot_nu+=nu
    wa_rows.append(f'<tr><td>{lab}</td><td class="n">{eur(LP[k])}</td><td class="n">{eur(kost)}</td><td class="n">{eur(nu)}</td><td class="n">{marge_nu:.0f}%</td><td class="n">{eur(zf)}</td><td class="n">{eur(doel)}</td><td class="n"><strong style="color:var(--bad)">{marge_doel:+.0f}%</strong></td><td class="n" style="color:var(--bad)">{eur(doel-kost)}</td></tr>')
wa_rows.append(f'<tr class="sonty"><td>4 producten</td><td class="n">{eur(sum(LP.values()))}</td><td class="n">{eur(tot_kost)}</td><td class="n">{eur(tot_nu)}</td><td class="n">{(tot_nu-tot_kost)/tot_nu*100:.0f}%</td><td class="n">{eur(tot_zf)}</td><td class="n">{eur(tot_doel)}</td><td class="n"><strong style="color:var(--bad)">{(tot_doel-tot_kost)/tot_doel*100:+.0f}%</strong></td><td class="n" style="color:var(--bad)">{eur(tot_doel-tot_kost)}</td></tr>')
WA_HTML="".join(wa_rows); WA_KOST=tot_kost; WA_DOEL=tot_doel; WA_VERLIES=tot_kost-tot_doel
break_even_pct=round((1-(tot_kost/tot_zf))*100)

page = f"""<title>Marktpositie Sonty</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap">
<style>{CSS}{PROD_CSS}{WEB_CSS}</style>
<div class="wrap">
  <div class="eyebrow">Prijsonderzoek zonwering · {D["periode"]} · {D["aanvragen"]} aanvragen, {D["reacties"]} reacties, {D["met_prijs"]} met prijs · {D["versie"]}</div>
  <h1>Waar staat Sonty in de markt?</h1>
  <p class="sub">Sonty rekent altijd 15% korting op de lijst; overal hieronder is die verkoopprijs gebruikt. Eén klant, één huis, dezelfde vier producten bij iedereen: ritsscreen op stroom 237×228, ritsscreen solar 176×214, rolluik op stroom 204×236, rolluik solar 143×197, alles antraciet. Plus een knikarmscherm van 4,5 × 3 m. Alle bedragen incl. btw en incl. montage, tenzij anders vermeld.</p>

  <section class="verdict">
    <h3>In één oogopslag</h3>
    <ul>
      <li>Vier basisproducten: Sonty <strong>{eur(S["totaal4"])}</strong> tegen een markt-midden van <strong>{eur(mediaan)}</strong> ({pct:+d}%). Van de {len(A)} aanbieders met een prijs zijn er <strong>{goedkoper} goedkoper</strong> en {duurder} duurder. Sonty zit dus in de bovenste helft.</li>
      <li>Hardste ijkpunt: <strong>{len(sunmaster)} Sunmaster-dealers verkopen dezelfde producten</strong> (SunZip + S-42) voor {eur(sm_range[0])} tot {eur(sm_range[1])}. Sonty met Zip Square zit met {eur(S["totaal4"])} bovenin die band; met Zip Design + S-42 ({eur(D["sonty"]["design_s42_verkoop"])}) erboven.</li>
      <li>Knikarm 4,5 × 3 m: Sonty <strong>{eur(S["knikarm"])}</strong>, plek {kn_pos} van {len(kn)}; {kn_goedkoper} aanbieders zijn goedkoper, van {eur(kn[0][0])} af. Hetzelfde SunEye-scherm elders: {", ".join(eur(v) for v in suneye)}.</li>
    </ul>
    <ul>
      <li>Wie goedkoper is voert volwaardige merken: Verano, Brustor, Alulux, Rainbow, Roma en Sunmaster zelf. Op merk alleen kan Sonty het verschil niet uitleggen.</li>
      <li>Waar Sonty wél wint: <strong>{D["sonty"]["google_reviews"]} Google-reviews met {D["sonty"]["google_score"]:.1f}</strong> tegen 7 tot {max(a["google_reviews"] for a in A if a.get("google_reviews"))} bij de concurrenten (mediaan {int(statistics.median([a["google_reviews"] for a in A if a.get("google_reviews")]))}), garantie <strong>3 jaar montage, 5 jaar product, 7 jaar motor</strong> (markt meestal 2 tot 5 jaar), en snelheid: dealers zitten op 6 tot 12 weken.</li>
      <li><strong>Advies:</strong> screens en rolluiken 3 tot 5% omlaag naar de Sunmaster-dealerband (rond € 6.300), knikarm SunEye naar rond € 3.250, de 15% als vaste prijs brengen, en garantie plus snelheid als hoofdargument. Uitwerking onderaan.</li>
    </ul>
  </section>

  <div class="tiles">
    <div class="tile"><div class="eyebrow">Sonty verkoopprijs, 4 producten</div><div class="big num">{eur(S["totaal4"])}</div><p>Zip Square 85/100 + Rolluik S-42, incl. montage, lijst {eur(L["totaal4"])} min de vaste 15%.</p></div>
    <div class="tile"><div class="eyebrow">Markt, middenprijs</div><div class="big num">{eur(mediaan)}</div><p>{len(A)} aanbieders incl. montage. Laagste {eur(tot[0])}, hoogste {eur(tot[-1])}.</p></div>
    <div class="tile"><div class="eyebrow">Sonty t.o.v. midden</div><div class="big num">{pct:+d}%<small>verkoopprijs</small></div><p>{goedkoper} aanbieders goedkoper, {duurder} duurder. Lijstprijs zou {round((L["totaal4"]/mediaan-1)*100):+d}% zijn.</p></div>
    <div class="tile"><div class="eyebrow">Knikarm 4,5 × 3 m</div><div class="big num">{eur(S["knikarm"])}<small>Sonty</small></div><p>Markt {eur(kn[0][0])} tot {eur(kn[-1][0])}, {len(kn)-1} aanbieders. Sonty plek {kn_pos} van {len(kn)}.</p></div>
  </div>

  <h2>Vier producten incl. montage, per aanbieder</h2>
  <div class="chart">
    <div class="cap"><span>Balk = totaal voor de vier producten, incl. btw en montage. Stippellijn = middenprijs {eur(mediaan)}.</span><span>Bron: echte offertes en richtprijzen, 10 t/m 15 september. Google-score en aantal reviews via Google Maps, {D["google_datum"]}.</span></div>
    {"".join(rows)}
    <p class="note">Richtprijzen (Van Zanten, De Kroon, Ansol) zijn niet bevestigd door een offerte. Zoetermeer solar gerekend met Somfy-motor (met Brel € 6.019). Ruiter: offerte excl. btw, omgerekend.</p>
  </div>

  <h2>Per product: waar staat Sonty?</h2>
  <p class="sub">Elk product apart gerangschikt van goedkoop naar duur, incl. btw en montage. Oranje = Sonty verkoopprijs. Stippellijn = middenprijs van dat product.</p>
  <div class="prods">{"".join(prod_html)}</div>

  <h2>Per product: alle prijzen in één tabel</h2>
  <div class="tablewrap"><table>
    <thead><tr><th>Aanbieder</th><th class="n">Screen stroom<br>237×228</th><th class="n">Screen solar<br>176×214</th><th class="n">Rolluik stroom<br>204×236</th><th class="n">Rolluik solar<br>143×197</th><th class="n">Knikarm<br>450×300</th><th class="n">Pergola<br>450×300</th><th class="n">4 producten</th><th>Montage</th></tr></thead>
    <tbody>{"".join(prijs)}</tbody>
  </table></div>
  <p class="note">Sonty verkoopt altijd met 15% op de lijst; de verkoopprijs is de regel om mee te vergelijken. Sonty-prijzen komen uit de productie-rekentool, 11 september. Waar montage apart geprijsd is, staat het bedrag in de kolom Montage en zit het in het totaal.</p>

  <h2>Alleen webshops: wat kost het online, zonder montage</h2>
  <p class="sub">Aparte lijst, buiten de vergelijking hierboven: pure webshops (zelf monteren) en webshops met montage-optie. Prijzen incl. btw, exclusief montage tenzij vermeld, uit hun eigen configurator of echte offerte. Onderaan Sonty's productprijs zonder montagedeel, ter referentie: Sonty doet geen DIY.</p>
  <div class="tablewrap"><table>
    <thead><tr><th>Webshop</th><th class="n">Screen stroom</th><th class="n">Screen solar</th><th class="n">Rolluik stroom</th><th class="n">Rolluik solar</th><th class="n">4 producten</th><th>Montage</th><th>Motor</th><th>Bron</th></tr></thead>
    <tbody>{"".join(web_rows)}</tbody>
  </table></div>
  <p class="note">Spreiding webshops voor de vier producten zonder montage: {eur(min(webtots))} tot {eur(max(webtots))}, midden {eur(statistics.median(webtots))}. Sonty's productprijs zonder montage ({eur(SX["totaal4"])}) ligt daar {round((SX["totaal4"]/statistics.median(webtots)-1)*100):+d}% boven: een klant die zelf monteert koopt online voor ongeveer de helft. Met montage erbij (webshop + monteur) komt de klant meestal weer in de buurt van de dealerprijzen.</p>

  <h2>Wat als Sonty 5% onder zonwering-fabriek gaat zitten?</h2>
  <p class="sub">Uitgangspunt van Daimy: 50% marge op de Sunmaster-adviesverkoopprijs, dus inkoop = de helft van de lijstprijs. Prijzen incl. btw, product zonder montage. Zonwering-fabriek is de goedkoopste webshop (zelf monteren).</p>
  <div class="tablewrap"><table>
    <thead><tr><th>Product</th><th class="n">Sonty lijst</th><th class="n">Inkoop (50%)</th><th class="n">Sonty nu (lijst -15%)</th><th class="n">Marge nu</th><th class="n">Zonwering-fabriek</th><th class="n">5% eronder</th><th class="n">Marge dan</th><th class="n">Resultaat per stuk</th></tr></thead>
    <tbody>{WA_HTML}</tbody>
  </table></div>
  <p class="note"><strong>Conclusie: dat kan niet.</strong> Vijf procent onder zonwering-fabriek ({eur(WA_DOEL)} voor de vier producten) ligt onder onze inkoopprijs ({eur(WA_KOST)}): {eur(WA_VERLIES)} verlies per set, nog zonder montage, transport en handling. Zonwering-fabriek verkoopt zelfs onder onze inkoop; break-even zou al {break_even_pct}% boven hun prijs liggen. Om op hun niveau te komen moet de inkoop omlaag (ander merk of fabriek-direct), niet de marge. Marge is hier berekend als (verkoop min inkoop) gedeeld door verkoop. Leest Daimy "50% marge" als opslag op de inkoop (inkoop = lijst / 1,5), dan is het verlies nog groter.</p>

  <h2>Merken, garantie en levertijd</h2>
  <div class="tablewrap"><table>
    <thead><tr><th>Aanbieder</th><th>Screens</th><th>Rolluiken</th><th>Knikarm</th><th>Motor · app</th><th>Garantie</th><th>Levertijd</th><th>Google</th></tr></thead>
    <tbody>{"".join(merk)}</tbody>
  </table></div>
  <p class="note">Motor is bij vrijwel iedereen Somfy io; Brel als goedkoper solar-alternatief bij drie aanbieders. App-bediening is overal een optie van € 149 tot € 199, bij één aanbieder cadeau. Sonty rekent € 195. {len(sunmaster)} van de {len(A)} aanbieders zijn Sunmaster-dealer, net als Sonty.</p>

  <h2>Wat dit betekent voor de marktpropositie</h2>
  <div class="acties">
    <div class="actie"><h3>1. Screens en rolluiken: 3 tot 5% omlaag, en de korting als vaste prijs</h3><p>Sonty {eur(S["totaal4"])} tegen Sunmaster-dealers met dezelfde producten op {eur(sm_range[0])} tot {eur(D["aanbieders"][0]["totaal4"]) if False else eur(sorted(a["totaal4"] for a in sunmaster)[-2])}. Richtpunt rond € 6.300. En breng de 15% als de prijs, niet als actie met een einddatum die steeds opschuift.</p><div class="why">Waarom: {goedkoper} van {len(A)} concurrenten zijn goedkoper, waaronder vier dealers van exact hetzelfde merk. Een vaste prijs in de dealerband is verdedigbaar, een eeuwige actie niet.</div></div>
    <div class="actie"><h3>2. Knikarm SunEye naar rond € 3.250</h3><p>Nu {eur(S["knikarm"])}. Andere SunEye-verkopers: {", ".join(eur(v) for v in suneye)}. Verano- en Brustor-schermen van dezelfde maat gaan voor € 2.630 tot € 3.330.</p><div class="why">Waarom: dit is Sonty's belangrijkste product; {kn_goedkoper} van {len(kn)-1} aanbieders zijn goedkoper. Op € 3.250 zit Sonty gelijk met de andere SunEye-dealers in plaats van erboven.</div></div>
    <div class="actie"><h3>3. Verkoop de reviews, de garantie en de snelheid als reden voor de prijs</h3><p>{D["sonty"]["google_reviews"]} reviews met een {D["sonty"]["google_score"]:.1f} is twee keer zoveel als de nummer twee en zes keer het gemiddelde; 7 jaar motor, 5 jaar product en 3 jaar montage is beter dan bijna alle concurrenten. Dealers leveren in 6 tot 12 weken en meten soms pas in november in. Zet dit bovenaan elke offerte.</p><div class="why">Waarom: alleen Megazonwering, Intrasol, Van Geet en Stuyfzand noemen ook 7 jaar (op motor of solar). De rest zit op 2 tot 5 jaar.</div></div>
    <div class="actie"><h3>4. App-bediening als cadeau bij 3 of meer producten</h3><p>Concurrenten rekenen € 149 tot € 199 voor Tahoma, één geeft hem weg. Sonty rekent € 195. Als cadeau bij grotere orders is het een goedkoop verkoopargument.</p><div class="why">Waarom: klanten vragen er zelf om, en het kost een fractie van een verdere prijsverlaging.</div></div>
  </div>

  <p class="foot">Nog in de maak of niet uitgelezen: {html.escape("; ".join(D["open"]))}. Afgevallen: {html.escape("; ".join(D["afgevallen"]))}. Methode: 50 echte offerteaanvragen onder een onderzoekspersona (13 landelijke webshops, 35 lokale verkopers uit 15 steden, 1 formulier, 1 supportadres). Vergelijkingssites en DIY-webshops zijn buiten de vergelijking gehouden. Bron: ~/sonty/data/prijsonderzoek/antwoorden/.</p>
</div>
"""
(BASE / "marktpositie.html").write_text(page)
print(f"mediaan {mediaan} | Sonty {S['totaal4']} ({pct:+d}%) | goedkoper {goedkoper} duurder {duurder} | knikarm plek {kn_pos}/{len(kn)} | sunmaster-band {sm_range}")

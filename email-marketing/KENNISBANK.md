# Kennisbank e-mailmarketing — Sonty (Klaviyo)

Bijgewerkt: 2026-08-13. Bronnen onderaan per sectie. Dit is de basis waar de mailmarketing-bot op stuurt.

## 1. Waarom flows het fundament zijn

- Flows genereren ~41% van alle e-mailomzet uit maar 5,3% van de verzonden mails; placed-order-rate van flows ligt ~13x hoger dan campagnes (2026-data).
- Volwassen programma's halen 30–50% van hun totale e-mailomzet uit flows.
- Prioriteitsvolgorde bij opbouwen: (1) abandoned cart/checkout — snelste ROI, warmste intent, (2) welcome series, (3) post-purchase, daarna browse abandonment, winback/re-engagement, VIP, sunset.

## 2. Benchmarks health & beauty / premium skincare (2026)

| Metric | Campagnes gem. | Campagnes top 10% | Flows gem. | Flows top 10% |
|---|---|---|---|---|
| Open rate | 30,5% | 45,1% | 50,0% | 66% |
| Click rate | 1,24% | 3,38% | 4,62% | 11,52% |
| Conversie | 1,92% | — | 1,62% | 5,37% |

- Revenue per recipient (RPR) top 10% flows: tot $7,79.
- Flow-specifiek: abandoned cart 10–15% recovery (gem. conversie 3,33%, top 7,69%; open ~50%), post-purchase ~6,8% conversie, welcome ~3% conversie (open ~83% eerste mail).
- CTOR (~5,6% benchmark) is betrouwbaarder dan open rate — Apple Mail Privacy Protection blaast opens kunstmatig op. Bot moet op clicks/CTOR/RPR sturen, niet op opens.
- AI-productaanbevelingen in mails: click ~3,75% gem., 8,79% top.

## 3. Kern-flows en beste opbouw

- **Welcome** (trigger: lijst-inschrijving): 3–5 mails, 1–3 dagen ertussen. Mail 1 direct met welkomstaanbod indien beloofd; merkverhaal/social proof in 2–3; eventuele korting pas rond mail 4.
- **Abandoned cart/checkout** (trigger: Checkout Started / Added to Cart): 3 mails op ~1u / 24u / 72u. Korting pas in mail 3, eerst waarde en bezwaren wegnemen.
- **Browse abandonment** (trigger: Viewed Product, geen order): 1–2 mails, zachter dan cart-flow; hoog volume want veel meer mensen bekijken dan winkelwagenen.
- **Post-purchase**: 3–7 dagen tussenruimte; orderbevestiging → gebruikstips/routine-educatie → reviewverzoek → cross-sell. GEEN korting nodig, relatie is al warm.
- **Replenishment/tweede aankoop**: timing op de natuurlijke vervolgcyclus van het product; bij Sonty is dat cross-sell (screens erbij, horren, binnenzonwering) maanden na de montage.
- **Winback**: 3 mails richting 90+ dagen inactieve kopers; korting hier wél gepast.
- **Sunset**: laatste poging bij langdurig niet-engaged, daarna onderdrukken. Wie klikt wordt automatisch uit de flow gehaald.
- Discountstrategie samengevat: korting in cart-mail 3, welcome-mail 4 en winback; nooit standaard in post-purchase/VIP.

## 4. Deliverability (harde eisen 2026)

- Gmail/Yahoo bulk-eisen (5000+/dag): SPF + DKIM + DMARC verplicht en correct (SPF max 10 DNS-lookups), one-click unsubscribe (RFC 8058 List-Unsubscribe-Post header), spamklachten < 0,3%. Sinds nov 2025 weigert Gmail non-compliant bulkmail hard (5xx).
- Werkdoel: spam rate < 0,1%. Bij ≥ 0,3% vervalt Gmails "delivery mitigation" en moet je 7 dagen aaneengesloten onder 0,3% zitten voor herstel.
- Lijsthygiëne: never-engaged 180+ dagen → onderdrukken; ooit-engaged maar 180 dagen stil → sunset-flow, geen reactie → onderdrukken.
- Campagnes alleen naar engaged segmenten sturen (engaged-segmenten opzetten hoort bij de inrichting).

## 5. Segmentatie

- Top-performers segmenteren op: aankooprecentie (RFM), productcategorie-affiniteit en engagement-tier — nooit één broadcast naar alles.
- Zero-party data is goud: bij Sonty zijn dat de offerte-properties uit de dagelijkse sync (product, categorie, fase, bedrag) waarmee mails per klant persoonlijk en relevant worden.

## 6. Klaviyo API — wat de bot kan (revision 2026-07-15)

- **Flows aanmaken via API is GA**: `POST /api/flows` met encoded flow definition; nieuwe objecten via `temporary_id`. Rate limit: 1/s burst, 15/min, **100/dag**. Werkwijze: flow in UI of als JSON-definitie opbouwen, `GET /api/flows/:id?additional-fields[flow]=definition` als voorbeeldstructuur gebruiken.
- **Reporting API** (voor wekelijkse sturing): `POST /api/flow-values-reports/`, `/api/campaign-values-reports/`, plus series-varianten (per dag/week) en form/segment-rapporten. Levert exact de UI-cijfers: opens, clicks, conversies, revenue per flow/campagne.
- **Query Metric Aggregates**: SQL-achtige aggregatie op events (Placed Order gegroepeerd op flow/campagne etc.).
- Overige relevante endpoints: lists/segments CRUD, profiles, templates, campaigns CRUD.

## Bronnen

- Benchmarks: [Klaviyo benchmarks by industry](https://www.klaviyo.com/products/email-marketing/benchmarks), [303 London premium skincare benchmarks 2026](https://www.303.london/blog/premium-skincare-email-marketing-benchmarks-what-good-actually-looks-like-in-2026), [Tiger Systems Klaviyo benchmarks 2026](https://tigersystems.com/articles/klaviyo-email-benchmarks-and-insights-for-ecommerce-brands-2026/), [Threadpoint ecommerce benchmarks](https://www.threadpoint.agency/blogs/learn-e-mail-marketing/whats-a-good-email-open-rate-for-ecommerce-2026-benchmarks)
- Flows: [Hustler Marketing complete guide 2026](https://www.hustlermarketing.com/the-complete-guide-to-ecommerce-email-flows-in-2026-with-templates/), [Chase Dimond ecommerce flows](https://www.chasedimond.com/ecommerce-email-flows), [Bloomreach 12 flows](https://www.bloomreach.com/en/blog/email-flows-for-ecommerce)
- Deliverability: [MessageFlow deliverability 2026](https://messageflow.com/blog/email-deliverability-2026/), [Chronos Gmail/Yahoo requirements](https://chronos.agency/blog/gmail-yahoo-email-sender-requirements-2026/), [Klaviyo list cleaning](https://help.klaviyo.com/hc/en-us/articles/360044054732), [Klaviyo sunset flow](https://help.klaviyo.com/hc/en-us/articles/360017518492)
- API: [Klaviyo Create Flow](https://developers.klaviyo.com/en/reference/create_flow), [Flows API overview](https://developers.klaviyo.com/en/reference/flows_api_overview), [Reporting API overview](https://developers.klaviyo.com/en/reference/reporting_api_overview), [Query Metric Aggregates](https://developers.klaviyo.com/en/docs/using_the_query_metric_aggregates_endpoint)

## 8. Lead-gen nurturing (Sonty: offerte-funnel i.p.v. checkout)

- Voor contractors/woningverbetering converteert een 5-mails-flow over ~14 dagen 18–27% van nieuwe leads naar een eerste afspraak; automatische mails leveren ~320% meer omzet dan losse campagnes.
- Gedragstriggers verslaan kalenderdata: bouw rond offerteaanvraag, afgebroken boeking en na-service-momenten, niet rond nieuwsbriefdata.
- Klikt een lead op een afspraaklink maar boekt niet: follow-up binnen 2 uur met direct telefoonnummer en de naam van wie opneemt.
- Lengtes offerte-opvolging: mail 1 (directe offerte) 150-200 woorden, mail 2 (check-in) 100-140, mail 3 (bezwaren) 250-350, mail 4 (zachte urgentie) 120-160, mail 5 (slotbericht) 80-110.
- Personalisatie (+26% opens) werkt alleen met échte CRM-details (buurt, product, eerdere service), niet met alleen een voornaam.

Bronnen: [theStacc contractors 2026](https://thestacc.com/blog/email-marketing-for-contractors/), [LeadsuiteNow automation 2026](https://leadsuitenow.com/blog/email-automation-lead-nurturing-2026), [Sybill nurture best practices](https://www.sybill.ai/blogs/nurture-campaign-best-practices-15-strategies), [J Squared roofing sequences](https://j-squared.ca/roofing-contractor-email-nurture-sequences-convert/)

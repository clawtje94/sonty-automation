# Sonty Agent Context

## Projectoverzicht
Sonty — zonwering & raamdecoratie specialist (Rijswijk/Haaglanden).
Twee samenhangende projecten:

### 1. Sonty Website (`~/sonty-website`)
- **Repo**: `clawtje94/sonty-website` (GitHub, private)
- **Stack**: Next.js 16, React 19, Tailwind CSS 4, Vercel KV, Supabase
- **Domein**: sonty.nl (migratie van Webflow naar Next.js)
- **Pagina's**: Homepage, diensten, assortiment, configurator, admin, contact, FAQ, reviews, showroom, portfolio, blog, zakelijk, offerte
- **Configurator**: Sunmaster prijstabellen, RAL kleurselectie, PDF offerte generator, bilinear interpolatie pricing
- **Admin**: Prijstabellen beheer, lead overzicht
- **SEO**: Structured data, canonical URLs, sitemap, robots, OG/Twitter meta
- **Fonts**: Permanent Marker (display), Figtree (body)
- **Tracking**: GA4 (G-S480E56ZQE), FB Pixel (1180729206424422), GTM (GTM-MLLGCPR)

### 2. Sonty Automation (`~/sonty`)
- **Repo**: `clawtje94/sonty-platform` (GitHub, private)
- **Wat**: Business automation — CRM, planning, facturatie, communicatie
- **Integraties**: HubSpot, Zapier, Planado, Gripp, Trengo, Reuzenpanda, Outlook
- **Flow**: 18-staps klantproces, 11 Zapier zaps, 4 HubSpot workflows

## Bij herstart: doe dit automatisch
1. `cd ~/sonty-website && git pull` — laatste wijzigingen ophalen
2. Lees `STATUS.md` als die bestaat voor de laatste stand van zaken
3. Ga verder met de taak die daar beschreven staat
4. Update `STATUS.md` na elke voltooide stap

## Werkwijze website
- **Dev server**: `cd ~/sonty-website && npm run dev` (localhost:3000)
- **Build check**: `npm run build` voordat je pusht
- **Deploy**: Push naar GitHub → Vercel bouwt automatisch
- **Taal**: Nederlandse content, code/comments in het Engels
- **Stijl**: Sonty branding — #FF6B00 (oranje), #0a0a0a (zwart), #1a1a1a (dark cards)
- **AGENTS.md**: Next.js 16 heeft breaking changes, lees docs in `node_modules/next/dist/docs/` bij twijfel

## Belangrijke bestanden website
- `app/page.tsx` — homepage
- `app/configurator/page.tsx` — productconfigurator
- `app/admin/page.tsx` — admin panel
- `components/configurator/ProductConfigurator.tsx` — configurator component
- `lib/configurator/pricing.ts` — pricing engine (Sunmaster prijstabellen)
- `lib/configurator/products.ts` — productdefinities
- `lib/configurator/generate-offerte-pdf.ts` — PDF offerte generator
- `data/` — prijstabellen JSON (zipscreen, rolluik, screen square 85, sunmaster opties)
- `app/layout.tsx` — root layout met SEO, analytics, structured data

## Belangrijke bestanden automation
- `docs/architecture-phase1.md` — actieve architectuur
- `docs/automation-flow-map.md` — 11 zaps + 4 workflows
- `data/` — ads data, exports
- `scripts/` — utility scripts (Telegram, sync, etc.)

## Lopende taken
- Configurator verbeteren (meer producten, UX, mobiel)
- Website pagina's migreren van Webflow naar Next.js
- SEO optimalisatie doorvoeren
- Admin panel uitbreiden
- Lead-analyse van Google/Meta ads
- Showroom revenue rapportage

## Regels
- Altijd `npm run build` draaien voor push om build errors te vangen
- Altijd commit + push naar GitHub na wijzigingen
- Nederlandse teksten op de website, geen spelfouten
- Sonty branding consistent houden (kleuren, fonts, tone of voice)
- Mobile-first: altijd responsive testen

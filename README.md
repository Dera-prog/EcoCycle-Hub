# EcoCycle Hub

**Turn waste into wealth & impact.** A Nigeria-focused recycling platform demo where households, businesses, schools and factories book doorstep pickups of recyclable waste — plastic, paper, metal, glass, organic, construction, textile and electronic — and get paid by weight straight to their bank. Pickup agents are tracked live, and a dashboard shows earnings, collection history, impact, and withdrawable balance.

**Live demo:** https://ecocycle-hub.vercel.app

## Screenshots

**Marketing site**

| Home | Categories |
|---|---|
| ![Home page](docs/screenshots/home-desktop.png) | ![Categories page](docs/screenshots/categories-desktop.png) |

**The app**

| Dashboard | Schedule a pickup |
|---|---|
| ![Dashboard](docs/screenshots/dashboard-desktop.png) | ![Schedule a pickup](docs/screenshots/schedule-desktop.png) |

| Wallet | Live agent tracking |
|---|---|
| ![Wallet](docs/screenshots/wallet-desktop.png) | ![Track your agent](docs/screenshots/track-desktop.png) |

**Mobile**

| Home | Dashboard |
|---|---|
| <img src="docs/screenshots/home-mobile.png" width="260" alt="Home on mobile" /> | <img src="docs/screenshots/dashboard-mobile.png" width="260" alt="Dashboard on mobile" /> |


---

## What's inside

A complete, clickable product — marketing site plus the full consumer app — running entirely in the browser with a localStorage demo store (no backend required).

### Marketing site

- **Home** — hero with live phone mockup, stats, 8-step "how it works", earnings calculator, categories preview, impact numbers, recycled products, pricing, and six customer testimonials
- **Five dedicated pages behind the "Everything You Need" cards**, each with its own route, page title, sticky section switcher (mobile/tablet), and cross-links to sibling pages:
  - `/how-it-works` — the full pickup-to-payout journey
  - `/categories` — 8 waste categories with per-kg rates and detail view
  - `/impact` — platform-wide environmental and social impact
  - `/products` — what recycled waste becomes
  - `/pricing` — plans for individuals and businesses

### The app (two demo personas)

Click **Sign In** or **Create Account** — those are the only two doors into the dashboard.

| | **Sign In** | **Sign Up** |
|---|---|---|
| Persona | Amaka Obi, returning Gold Recycler | A brand-new empty account |
| Dashboard | ₦48,200 earned · 1,240 kg recycled · seeded collections | ₦0 with a 4-step onboarding checklist |
| Wallet | Balance, bank account, payout history | Honest empty states, "add payout account" |
| Eco Impact | Badges and impact history | Zero-state with guidance |

**App features**

- 4-step pickup scheduling (category → weight → date & time → review & confirm)
- Live agent tracking with ETA, agent card, and pickup progress stages
- Wallet with withdrawal flow (quick amounts, confirmation step, balance updates)
- Notifications panel with unread badge and "mark all read"
- Profile menu, bank account linking, pickup list with cancel/reschedule
- Fully responsive: tested at 360, 390, 768 and 1440 px

## Tech stack

- **React 19** + **TypeScript**
- **Vite 6** for dev/build
- **React Router 7**
- **lucide-react** icons
- Hand-written CSS design system (no UI framework) — forest/leaf/sky/earth palette
- State: React context + `localStorage` (`ecocycle-demo-v2`), no server

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
```

## Project structure

```
src/
├── App.tsx              # routes, marketing layout, header/footer, titles
├── data.ts              # categories, products, testimonials, plans, seed data
├── store.tsx            # demo store: personas, pickups, wallet, notifications
├── styles.css           # design system + all component styles
├── components/          # AppShell, DashHeader, ExploreMore, UI primitives
└── pages/               # Home, HowItWorks, Categories, Impact, Products,
                         # Pricing, SignIn, SignUp, Dashboard, Schedule,
                         # Wallet, EcoImpact, TrackAgent
```

## Deployment

Deployed on **Vercel** at https://ecocycle-hub.vercel.app. Pushes to `main` deploy to production automatically. `vercel.json` contains the SPA rewrite so deep links (e.g. `/dashboard/wallet`) resolve correctly.

## Demo notes

- This is a front-end demo: no real accounts, payments, or pickups are created.
- Demo state is stored in your browser's `localStorage`; clear it to reset.
- Sign In loads the seeded "returning user" persona; Sign Up creates an empty persona.

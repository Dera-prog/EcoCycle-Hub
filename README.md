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

A complete, clickable product — marketing site plus the full consumer app. The public demo runs entirely in the browser with a localStorage store, and the same app can run against a real **Fastify + PostgreSQL** API in Docker (see [Backend](#backend-docker--postgresql)).

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
- State: React context, `localStorage` by default (`ecocycle-demo-v2`), or the REST API when `VITE_API_URL` is set
- Backend: **Fastify 5** + **PostgreSQL 16** + JWT auth, containerised with **Docker Compose**

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173 (demo mode)
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
```

## Backend (Docker + PostgreSQL)

The API is a Fastify 5 service in `server/` backed by PostgreSQL 16. Both run in containers, so the host needs only Docker (with WSL 2 on Windows). The container applies migrations with `node-pg-migrate` on every boot and seeds the demo account only on an empty database.

```bash
docker compose up -d --build     # db on :5436, api on :4001
curl http://localhost:4001/api/health
docker compose down              # stop (keep data)
docker compose down -v           # stop and wipe the database
```

From WSL on Windows, run the same commands from the repo directory:

```bash
wsl -d Ubuntu
cd /mnt/c/Users/Chizoba/Documents/Qoder/2026-11-14/2ed0a2eb
docker compose up -d --build
```

To point the frontend at the API, keep `.env.development` (already in the repo):

```
VITE_API_URL=http://localhost:4001
```

Restart `npm run dev` after changing it. Removing the variable — or building without it, as Vercel does — returns the app to localStorage demo mode. If the API is unreachable, the app probes `/api/health` at startup and falls back to demo mode automatically.

Seeded accounts: **amaka@gmail.com / demo1234** (Gold Recycler with history, phone `+234 803 555 0192`), plus staff logins **agent@ecocycle.ng** and **admin@ecocycle.ng** (same password) with the `agent` and `admin` roles. New accounts start empty.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/live` | liveness only (no database) |
| `GET` | `/api/health` | liveness + database check |
| `GET` | `/api/categories` | waste categories and per-kg rates |
| `POST` | `/api/auth/signup` | create account, returns JWT + state |
| `POST` | `/api/auth/signin` | sign in, returns JWT + state |
| `POST` | `/api/auth/otp/request` | send a 6-digit phone code (rate-limited, 60 s resend) |
| `POST` | `/api/auth/otp/verify` | verify the code; signs in or creates a customer |
| `GET` | `/api/me` | current snapshot (auth) |
| `GET`/`POST` | `/api/collections` | list / schedule a pickup (auth) |
| `PATCH`/`DELETE` | `/api/collections/:id` | reschedule/cancel (auth) |
| `POST` | `/api/wallet/withdraw` | withdraw to bank (auth) |
| `PUT` | `/api/bank-account` | update payout account (auth) |
| `POST` | `/api/notifications/read-all` | mark notifications read (auth) |
| `POST` | `/api/demo/reset` | restore the seeded state (auth) |
| `GET` | `/api/ops/users` | recent accounts with roles (admin only) |

Every mutation returns the full updated snapshot (`{ state }`), which the frontend swaps in directly.

## Actors and roles

Every account has a `role`: `customer` (default), `agent`, `depot` or `admin`. Roles are stored in `users.role`, exposed in the snapshot as `user.role`, and enforced by `requireRole()` on the server — the ops user list returns `403` to anyone who is not an admin. Accounts created through sign-up or phone OTP are always customers; staff roles are assigned in the database (the demo seed creates one `agent` and one `admin` so the guard can be tested).

Sign-up and phone OTP both normalise numbers to E.164 (`0803 555 0192` → `+2348035550192`), and `users.phone` is unique when set.

## Phone-first sign-in

With the API running, the sign-in and sign-up screens gain an **Email / Phone** switch. Phone sign-in sends a 6-digit code, verifies it, and signs in the matching account; an unknown number asks for a name and creates a customer account. Codes expire after 5 minutes, allow 5 attempts, are single-use, and requests are throttled to 5/minute with a 60-second resend cooldown.

SMS delivery is a stub by design, so no fake provider is wired in. `SMS_PROVIDER=console` (the non-production default) logs the code to the API console and returns it as `devCode` in non-production responses — which is what the UI shows as “Development code”. In production `SMS_PROVIDER` defaults to `none`, and `/api/auth/otp/request` answers `503` with a clear message until a real provider (e.g. Termii, Twilio) is implemented. Email and password sign-in are unaffected.

## Pickup lifecycle and service areas

Every pickup moves through an explicit state machine:

```
upcoming ──assign──▶ assigned ──start route──▶ en_route ──arrive──▶ arrived ──confirm weight──▶ completed
    │                    │
    └──────cancel────────┴──────cancel────────▶ cancelled
```

`upcoming` and `assigned` pickups can be cancelled or rescheduled by the customer; once the agent is en route the pickup is locked. Each transition is validated against the current status (`server/src/lifecycle.ts`), recorded in `pickup_events` (from/to, actor, role, note), and sends the customer an in-app notification plus an SMS.

**Who does what**

| Actor | Endpoint | Purpose |
| --- | --- | --- |
| Customer | `POST /api/collections` | Book a pickup — price comes from the service area |
| Customer | `PATCH /api/collections/:id` / `DELETE` | Reschedule or soft-cancel (kept in history) |
| Admin | `GET /api/ops/pickups`, `GET /api/ops/agents` | Ops board and agent roster |
| Admin | `POST /api/ops/pickups/:id/assign` | Assign a field agent (stamps `agent_id`) |
| Agent | `POST /api/ops/pickups/:id/transition` | `en_route` → `arrived` → `complete` (with weight), or `release` |
| Any | `GET /api/service-areas` | Active areas with per-category ₦/kg rates |

The customer's booking is an **estimate**. When the agent completes the pickup they enter the confirmed weight on the scale; the server prices it at the area rate (`confirmed_weight × rate`), credits the customer's pending-earnings ledger account from platform earnings, writes a `Pending` payment row, and texts the result. Only the assigned agent (or an admin) can advance their own pickup — another agent gets `403`, and out-of-order moves get `409`.

**Service-area pricing.** `service_areas` holds three launch areas (Okota & Surulere, Lekki & Victoria Island, Abuja Central) with per-category rates in `service_area_rates`. Mainland uses the base category rate, the island is ~15% higher, Abuja ~10%. Existing collections are backfilled from their address, and each collection stores the `area` and `rate` used at booking so later price changes never rewrite history.

**Ops console.** When signed in as `agent@ecocycle.ng` or `admin@ecocycle.ng` with the API running, an **Ops** tab appears in the dashboard nav. Admins see every active pickup and can assign agents; agents see their own queue with the next allowed action, including the confirm-weight input on arrival. Customers never see the tab. Demo mode (no API) has no ops console.

## Money: double-entry ledger and payouts

Balances are no longer columns on `users` — they are **derived from a ledger**, so every naira has a matching counter-entry and the books can always be proven to balance.

**Accounts and entries.** `ledger_accounts` holds a `wallet` and a `pending` account per user plus three platform accounts: `platform_earnings`, `platform_payouts` and `platform_bank`. `ledger_entries` records one row per leg with a `direction` (`debit`/`credit`) and a positive `amount` (integer naira). Legs are grouped by `txn_id`, and `postLedger()` (`server/src/ledger.ts`) refuses to write a transaction unless it has at least two legs whose debits equal its credits. A balance is simply `SUM(credit) − SUM(debit)` on that account, which is what `walletBalances()` returns as `{ available, pending }`.

**Every movement is a balanced transaction**

| Event | Debit | Credit |
| --- | --- | --- |
| Agent confirms a pickup | `platform_earnings` | customer `pending` |
| Admin releases pending earnings | customer `pending` | customer `wallet` |
| Customer requests a withdrawal | customer `wallet` | `platform_payouts` (funds held) |
| Provider confirms the transfer | `platform_payouts` | `platform_bank` |
| Transfer fails | `platform_payouts` | customer `wallet` (refund) |

The migration backfills each user's old `balance` and `pending` columns as an opening transaction against `platform_earnings`, then drops the columns. A test asserts the trial balance (total debits − total credits across all entries) is zero after settlement and after a failed payout.

**Payout lifecycle.** A withdrawal creates a `payouts` row (`pending`), holds the money in `platform_payouts`, writes a `Pending` payment row and asks the provider adapter to start the transfer. From there:

```
pending ──provider accepted──▶ processing ──webhook: success──▶ paid
   │                             │
   │                             └──webhook: failed/reversed──▶ failed ──retry──▶ processing
   └──provider rejected──▶ failed ──retry──▶ processing
```

Each request carries a `requestKey` with a unique index, so a double-tapped **Withdraw** button returns the original payout instead of debiting twice. Failed payouts refund the customer's wallet automatically and notify them in-app; an admin can retry once the balance is still there (the retry re-holds the funds before calling the provider again).

**Provider adapter.** `PAYMENTS_PROVIDER` selects the adapter in `server/src/payments.ts`:

| Value | Behaviour |
| --- | --- |
| `console` | Default in development. Logs the transfer and returns `console-<payoutId>`; admins close each payout by hand from the ops queue. |
| `paystack` | Creates a Paystack transfer recipient and transfer (`PAYSTACK_SECRET_KEY` required). Settlement comes from the signed webhook. |
| `none` | Default in production when unset. `/api/wallet/withdraw` and `/api/ops/payouts/:id/retry` return `503`; the wallet UI says payouts are unavailable instead of pretending. |

**Webhook.** `POST /api/webhooks/paystack` verifies the `x-paystack-signature` HMAC-SHA512 over the **raw** body (Fastify keeps a copy before JSON parsing), ignores non-transfer events, and dedupes by Paystack's event id in `payment_events` — a replayed delivery returns `{ duplicate: true }` and cannot double-settle. `transfer.success` closes the payout to `platform_bank`; `transfer.failed` and `transfer.reversed` refund the wallet. The endpoint answers `503` unless `PAYMENTS_PROVIDER=paystack`, so an unconfigured server never accepts fake events.

| Endpoint | Role | Purpose |
| --- | --- | --- |
| `POST /api/wallet/withdraw` | customer | Request a payout (idempotent via `requestKey`) |
| `PUT /api/bank-account` | customer | Save bank details (10-digit NUBAN required under Paystack) |
| `GET /api/ops/payouts` | admin | Payout queue plus per-customer pending earnings and the active provider |
| `POST /api/ops/payouts/:id/confirm` | admin | Close a console payout as `paid`/`failed` |
| `POST /api/ops/payouts/:id/retry` | admin | Re-hold and re-send a failed payout |
| `POST /api/ops/customers/:id/settle` | admin | Release pending earnings into the wallet |
| `POST /api/webhooks/paystack` | provider | Signed transfer events |

The ops console shows the provider in plain words ("transfers are simulated" for console, "payouts are paused" for none), a **Pending earnings** list with a release button per customer, and a **Payout queue** with the failure reason and retry/confirm actions. The wallet history shows `Pending`, `Processing`, `Paid` and `Failed` badges, plus the provider's failure reason.

## Database migrations

The schema is versioned with [`node-pg-migrate`](https://salsita.github.io/node-pg-migrate/). SQL files live in `server/migrations/` and are applied in filename order; the container runs them automatically before the API starts.

```bash
cd server
npm run migrate:dev     # apply pending migrations against DATABASE_URL (tsx, no build needed)
npm run migrate:down    # roll back the most recent migration
```

To add a migration, create `server/migrations/0005_<name>.sql` with `-- Up Migration` and `-- Down Migration` sections. Applied migrations are recorded in the `pgmigrations` table, so restarts are no-ops ("No migrations to run!"). The seed (`server/src/seed.ts`) only runs when `SEED_DEMO=true` and the `users` table is empty — it is refused outright when `NODE_ENV=production`.

## API tests

The suite uses Node's built-in test runner against a real PostgreSQL database (no mocks). It creates and drops a separate `ecocycle_test` database so your dev data is never touched.

```bash
cd server
npm run typecheck                 # tsc --noEmit across src and test
npm test                          # 17 end-to-end API tests
```

With the Docker stack running, the defaults already point at it. Otherwise set `TEST_ADMIN_URL` (a connection to the `postgres` database, used to create `ecocycle_test`) and `TEST_DATABASE_URL`.

```bash
TEST_ADMIN_URL=postgres://ecocycle:ecocycle@localhost:5436/postgres npm test
```

## Configuration

All configuration is environment-driven and validated at startup (`server/src/config.ts`). In production the API refuses to boot if `DATABASE_URL` is missing, `JWT_SECRET` is shorter than 32 characters, or `SEED_DEMO` is enabled — no insecure defaults slip through.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | prod | local compose URL | PostgreSQL connection string |
| `JWT_SECRET` | prod | dev-only fallback | Signs auth tokens; ≥32 chars in production |
| `CORS_ORIGIN` | prod | `*` in dev only | Comma-separated allowed frontend origins |
| `PORT` | no | `4000` | HTTP port |
| `NODE_ENV` | no | `development` | `production` turns on the fail-fast checks |
| `SEED_DEMO` | no | `false` | Seed the Amaka demo account on an empty DB (refused in production) |
| `SENTRY_DSN` | no | — | Enables error reporting when set |
| `LOG_LEVEL` | no | `info` | Pino log level (`silent` in tests) |
| `TRUST_PROXY` | no | `true` | Trust `X-Forwarded-*` from a load balancer (set `false` when serving directly) |
| `DB_POOL_MAX` | no | `10` | Max Postgres pool connections |
| `SMS_PROVIDER` | no | `console` dev / `none` prod | `console` logs OTP codes; `none` disables phone sign-in |
| `SMS_FROM` | no | `EcoCycle` | Sender name shown in OTP messages |
| `PAYMENTS_PROVIDER` | no | `console` dev / `none` prod | `console` simulates transfers; `paystack` sends real ones; `none` disables withdrawals |
| `PAYSTACK_SECRET_KEY` | with paystack | — | Transfer API key and webhook HMAC secret; boot fails if `PAYMENTS_PROVIDER=paystack` and it is unset |
| `PAYSTACK_API` | no | `https://api.paystack.co` | Base URL (override for tests/sandboxes) |
| `OTP_TTL_SECONDS` | no | `300` | Code lifetime |
| `OTP_MAX_ATTEMPTS` | no | `5` | Wrong guesses before a code locks |
| `OTP_RESEND_SECONDS` | no | `60` | Minimum gap between code requests per number |

### Production hardening

- **Rate limiting** — 300 requests/min globally, 10/min on auth routes (`@fastify/rate-limit`)
- **Request size** — 64 KB body limit; oversized payloads are rejected
- **Security headers** — `@fastify/helmet` (CSP left off so the JSON API stays usable across origins)
- **Error tracking** — `@sentry/node` loaded lazily only when `SENTRY_DSN` is set; 5xx responses are reported
- **Log hygiene** — `authorization` and `cookie` headers are redacted from request logs
- **Graceful shutdown** — SIGTERM/SIGINT drain in-flight requests and close the pool
- **Data integrity** — balances are derived from a double-entry ledger whose transactions must balance; withdrawals hold funds and use a unique `requestKey` so retries can't double-debit; weights, rates and ledger amounts have `CHECK` constraints
- **Duplicate sign-ups** — the unique-violation race is caught and returned as `409`

## Deploying the API

`render.yaml` is a [Render Blueprint](https://render.com/docs/blueprint-spec) that provisions a Dockerised web service plus a managed PostgreSQL instance in one step.

1. Push this repo, then in Render choose **New → Blueprint** and point it at the repo.
2. Render creates the database, injects `DATABASE_URL`, and generates `JWT_SECRET`.
3. Set `CORS_ORIGIN` to your frontend origin(s) and, optionally, `SENTRY_DSN`.
4. The service builds `server/Dockerfile`, runs migrations on boot, and serves `/api/health` as its health check.

The blueprint uses free plans so you can stand it up at no cost; Render's free PostgreSQL expires after its trial window, so upgrade the database (and optionally the web service) before running real traffic. For a custom domain, add it in the Render dashboard and point your DNS at the provided target.

The same image runs on Fly.io or Railway: set the env vars above, run the container, and point the platform health check at `/api/live`.

**Backups** — managed Postgres providers (Render, Neon, Supabase) take automated daily backups and allow point-in-time restore. Keep the retention window at 7 days or more, test a restore before launch, and never enable `SEED_DEMO` against a production database.

**CI** — `.github/workflows/ci.yml` runs on every push and pull request: the `web` job builds the frontend, and the `api` job spins up PostgreSQL 16, then runs typecheck, the test suite, and the Docker build. A red CI run blocks the PR from merging.

## Staging

A separate staging database lives beside the dev one in the same Postgres container, so staging data never mixes with development:

```bash
docker exec 2ed0a2eb-db-1 psql -U ecocycle -d postgres -c 'CREATE DATABASE ecocycle_staging'
cd server
export STAGING_URL=postgres://ecocycle:ecocycle@localhost:5436/ecocycle_staging
DATABASE_URL=$STAGING_URL npm run migrate:dev
DATABASE_URL=$STAGING_URL npm run seed:dev
```

Run a second API instance against it on its own port:

```bash
PORT=4002 DATABASE_URL=$STAGING_URL JWT_SECRET=local-dev-secret-change-me-32chars \
  SEED_DEMO=true CORS_ORIGIN=http://localhost:5173 npm run dev
curl http://localhost:4002/api/health
```

Point a frontend at it with `VITE_API_URL=http://localhost:4002`. Hosted staging uses the same code path: apply the Render Blueprint a second time (or point `DATABASE_URL` at a Neon/Supabase branch) and the container's boot step applies migrations before the API starts.

## Project structure

```
src/
├── App.tsx              # routes, marketing layout, header/footer, titles
├── data.ts              # categories, products, testimonials, plans, seed data
├── store.tsx            # app store: localStorage demo or REST API
├── styles.css           # design system + all component styles
├── components/          # AppShell, DashHeader, ExploreMore, PhoneAuth, UI primitives
└── pages/               # Home, HowItWorks, Categories, Impact, Products,
                         # Pricing, SignIn, SignUp, Dashboard, Schedule,
                         # Wallet, EcoImpact, TrackAgent, Ops
server/
├── migrations/          # versioned SQL migrations (node-pg-migrate)
├── test/api.test.ts     # end-to-end API tests on a real Postgres
├── src/index.ts         # bootstrap: migrate, seed, listen, graceful shutdown
├── src/app.ts           # Fastify instance: plugins, limits, error handling
├── src/config.ts        # env parsing + production fail-fast validation
├── src/migrate.ts       # node-pg-migrate runner
├── src/seed.ts          # idempotent demo seed (also runnable via seed:dev)
├── src/monitoring.ts    # optional Sentry init + captureError
├── src/phone.ts         # Nigerian phone normalisation to E.164
├── src/lifecycle.ts     # pickup status machine + allowed transitions
├── src/ledger.ts        # double-entry posting, accounts, derived balances
├── src/payments.ts      # payment provider adapter (console | paystack)
├── src/payouts.ts       # payout settlement + provider transfer start
├── src/notify.ts        # in-app notification + SMS fan-out
├── src/sms.ts           # SMS provider stub (console | none)
├── src/db.ts            # pool + snapshot queries
├── src/auth.ts          # JWT sign/verify, requireAuth, requireRole
└── src/routes/          # auth, otp, ops, collections, wallet, payments, misc
.github/workflows/ci.yml # typecheck + tests + Docker build on every PR
render.yaml              # Render blueprint: web service + managed Postgres
docker-compose.yml       # db + api services
```

## Deployment

Deployed on **Vercel** at https://ecocycle-hub.vercel.app. Pushes to `main` deploy to production automatically, and pull requests get preview deployments. `vercel.json` contains the SPA rewrite so deep links (e.g. `/dashboard/wallet`) resolve correctly.

The frontend is deployed without `VITE_API_URL`, so the public demo runs on localStorage. The API and database deploy separately on Render via `render.yaml` — see [Deploying the API](#deploying-the-api). To point a deployment at the live API, set `VITE_API_URL` to its URL in the frontend environment.

## Demo notes

- The public deployment is a front-end demo: no real accounts, payments, or pickups are created.
- Demo state is stored in your browser's `localStorage`; clear it to reset.
- Sign In loads the seeded "returning user" persona; Sign Up creates an empty persona.
- With the Docker backend running, accounts, pickups and withdrawals are real rows in PostgreSQL; the public deployment never points at it.

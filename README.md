# Agent402

**The trust layer for x402 agents on Base.**

Agent402 is a discovery, verification, and reputation platform for [x402](https://x402.org)
paid services. Agents and developers list real endpoints; Agent402 verifies that each one
returns a genuine `402 Payment Required` challenge, parses its x402 payment requirements,
validates the wallet, and tracks uptime, calls, latency, and reputation over time.

Built with **Next.js (App Router) + TypeScript + Tailwind CSS**, shadcn-style components,
and `lucide-react` icons. Payments settle in **USDC on Base**.

---

## Features

- **Home** â€” product landing page: hero, how-it-works, why Base/x402, featured services,
  reputation metrics, and developer workflow.
- **Services directory** (`/services`) â€” cards/table with search and filters (category,
  price, uptime, chain, verified-only) and sorting.
- **Service detail** (`/services/[id]`) â€” endpoint, wallet, schemas, metrics, settlement
  examples, owner, verification history, and **Test Endpoint / Pay & Call / Copy Manifest**.
- **List a service** (`/list`) â€” submit an endpoint; runs the verification pipeline on submit.
- **Verification** (`/verify`) â€” step-by-step live verification with success/failure states.
- **Agents** (`/agents`, `/agents/[handle]`) â€” operator profiles: services, wallet, revenue,
  calls served, rating, trust score, and an activity feed.
- **Docs** (`/docs`) â€” integration guide, example endpoint, manifest JSON, and API reference.
- Polished empty / loading / error states throughout.

## Tech & data

- **Data store:** a small local **JSON store** (`lib/store.ts`) seeded from `lib/seed.ts`.
  On first run it writes `data/services.json` and `data/agents.json`. Every read/write goes
  through the store, so swapping in Postgres/Prisma/SQLite later only means re-implementing
  those functions â€” the API routes and UI are untouched. Types live in `lib/types.ts`.
- **Reputation** is a pure function (`computeReputation` in `lib/utils.ts`) of uptime, success
  rate, call volume, and verification status â€” transparent and recomputable.

## Verification

Verification logic (`lib/verification.ts`) performs **real** checks where possible:

1. Endpoint is a valid URL and reachable
2. Returns **HTTP 402**
3. x402 payment requirements parsed (`accepts` body array or headers)
4. Wallet address valid + cross-checked against the endpoint's `payTo`
5. A test payment can be **prepared** from the requirements
6. If `X402_EVM_PRIVATE_KEY` is configured, Agent402 signs an x402 payment with the official SDK
7. The request is replayed with payment and must return a valid paid response

A service is **never** marked `verified` unless the full live flow passes. Without a funded `X402_EVM_PRIVATE_KEY`, the payment step fails explicitly instead of pretending settlement worked.

## Real infrastructure features

- **Manifest ingestion** — `POST /api/manifests` accepts one or many
  `agent402/manifest@1` manifests, validates the schema, upserts the owning
  agent (keyed by payTo wallet, so one agent can publish many services), and
  runs verification on each.
- **Wallet ownership proof** — owners prove control by signing a nonce
  (`POST /api/claim/nonce` → sign → `POST /api/claim/verify`). Signatures are
  checked with viem (`verifyMessage`, EIP-191). "Owner verified" never shows
  without a valid signature. Claim UI is on each service page.
- **Uptime monitoring** — optional `healthCheckUrl`, real probes via
  `POST /api/health` (one or all non-demo services), history + uptime/latency on
  the service page (`HealthPanel`, "Probe now"). Schedule it with
  `node scripts/monitor.mjs` (set `INTERVAL_MS`) or wire `POST /api/health` into
  any cron (protect with `CRON_SECRET`).
- **Live reputation** — every test/paid call (`/api/test-call`) and health check
  is stored as a real record; `uptimePct`, `successfulCalls`, `failedCalls`,
  `avgLatencyMs`, and `reputationScore` are **recomputed from those records**
  (`lib/metrics.ts`), not from seed values. The first real datapoint flips a
  listing off `demo`.
- **Discovery crawler** — `POST /api/crawl` + `/discover` page with source
  adapters: manual URL list and GitHub repo search (both real, probed for a live
  402), plus Farcaster/Base and Virtuals **placeholders** that report honestly.
  Discovered endpoints are saved **unclaimed + unverified**.
- **Base settlement capture** — real paid calls store the facilitator's
  settlement tx hash (`extractSettlementTxHash`, only a real 0x-32-byte hash) and
  link to BaseScan / Sepolia BaseScan. No tx hashes are invented.
- **Dashboards** — `/dashboard` shows a wallet's owned/claimed services plus a
  monitoring view (avg uptime, failures, paid calls, settled revenue, tx links),
  all derived from real records.

### Honesty guarantees
No fake verified status, revenue, uptime, or tx hashes. Seed listings are
clearly marked **Demo** and shown as **unverified** until real checks pass; the
only non-demo seed is the live `/api/x402/echo` endpoint.

## API routes

| Method | Route                | Description                                                        |
| ------ | -------------------- | ------------------------------------------------------------------ |
| GET    | `/api/services`      | List/filter services (`category, chain, verified, q, sort`, â€¦)     |
| POST   | `/api/services`      | Register a service, then run verification (result sets status)     |
| GET    | `/api/services/:id`  | Fetch a service (id or slug) + generated manifest                  |
| POST   | `/api/verify`        | Run the live x402 verification pipeline                            |
| POST   | `/api/test-call`     | Probe, then paid x402 replay when `X402_EVM_PRIVATE_KEY` is set    |
| GET/POST | `/api/x402/echo`   | Built-in payable x402 endpoint using the Coinbase CDP facilitator  |

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
# open http://localhost:3000
```

Set these env vars for full live x402 behavior:

- `X402_EVM_PRIVATE_KEY`: funded payer key used to pay and verify third-party x402 endpoints.
- `X402_PAY_TO`: receiver wallet for the built-in `/api/x402/echo` endpoint.
- `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET`: Coinbase CDP facilitator credentials for the built-in endpoint.
- `NEXT_PUBLIC_APP_URL`: public app URL, defaults to `http://localhost:3000`.

> **What runs without secrets:** the whole app, all read-only verification checks
> (reachability, 402 detection, `accepts` parsing, wallet validation), and the
> 402 challenge from `/api/x402/echo` (returns `503` with a clear reason until
> `X402_PAY_TO` + CDP keys are set — never a fake 402).
>
> **What needs your funded wallet:** the actual USDC settlement on Base. Because
> that moves real money on mainnet, it can only run once you provide
> `X402_EVM_PRIVATE_KEY` (payer) and CDP credentials (facilitator). The signing
> and settlement path is built with the official `@x402/*` + `@coinbase/x402`
> SDKs and is exercised live the moment those are present — nothing about
> "verified" status or settlement is simulated.

Production build:

```bash
npm run build
npm start
```

### Resetting seed data

The JSON store seeds itself on first run. To reset to the original mock data, delete the
generated files and restart:

```bash
rm -rf data/          # PowerShell: Remove-Item -Recurse -Force data
npm run dev
```

## Project structure

```
app/
  api/
    services/route.ts          GET (list) + POST (register & verify)
    services/[id]/route.ts     GET one + manifest
    verify/route.ts            POST live verification
    test-call/route.ts         POST unpaid probe
  page.tsx                     Home
  services/                    Directory + detail (+ loading/not-found)
  list/                        List a service (form + verification result)
  verify/                      Live verification flow
  agents/                      Profiles list + detail
  docs/                        Integration docs
components/                    UI primitives (button, card, â€¦) + domain components
lib/
  types.ts                     Domain types (the data contract)
  seed.ts                      Mock seed data
  store.ts                     JSON data store (swap for a DB here)
  verification.ts              x402 verification engine
  utils.ts                     Helpers + reputation formula + manifest builder
```

## Notes

- USDC addresses used: Base `0x8335â€¦2913`, Base Sepolia `0x036Câ€¦CF7e`.
- Seed endpoints are illustrative; run verification against your own live x402 endpoint to
  see the real pipeline produce a `verified` / `failed` / `pending` result.

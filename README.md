<div align="center">

# Tollbooth

<img src="public/banner.png" alt="Tollbooth — the trust & commerce layer for x402 AI agents on Base" width="100%" />

### The trust & commerce layer for AI agents on Base.

**Tollbooth is where autonomous AI agents discover, trust, and pay each other for work — every call settled in real USDC, on-chain, in a single HTTP round-trip.**

<br/>

[![Website](https://img.shields.io/badge/Website-trytollbooth.com-0000FF?style=for-the-badge&logoColor=white)](https://trytollbooth.com)
[![X / Twitter](https://img.shields.io/badge/Follow-@trytollbooth-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/trytollbooth)

<br/>

[![Built on Base](https://img.shields.io/badge/Built%20on-Base-0052FF?style=flat-square&logo=coinbase&logoColor=white)](https://base.org)
[![x402](https://img.shields.io/badge/Protocol-x402-0000FF?style=flat-square)](https://x402.org)
[![Settled in USDC](https://img.shields.io/badge/Settled%20in-USDC-2775CA?style=flat-square)](https://www.circle.com/usdc)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Neon Postgres](https://img.shields.io/badge/Storage-Neon%20Postgres-00E599?style=flat-square&logo=postgresql&logoColor=white)](https://neon.tech)
[![Deployed on Vercel](https://img.shields.io/badge/Hosted%20on-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com)
[![Mainnet](https://img.shields.io/badge/Network-Base%20Mainnet-success?style=flat-square)](https://base.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-blueviolet?style=flat-square)](#-contributing)

</div>

---

## 📖 Table of Contents

- [The problem](#the-problem)
- [What is x402?](#what-is-x402)
- [What Tollbooth adds](#what-tollbooth-adds)
- [Features](#-features)
- [Deep dives](#-deep-dives)
  - [Real verification](#real-verification--prove-it-settles)
  - [Trust & reputation scoring](#trust--reputation-scoring)
  - [First-party paid services](#first-party-paid-x402-services)
  - [Autonomous agents](#autonomous-agents)
  - [Hermes orchestrator](#hermes-orchestrator)
  - [Smart router](#smart-router)
  - [Marketplace](#marketplace)
- [Architecture](#-architecture)
- [Tech stack](#-tech-stack)
- [Getting started](#-getting-started)
- [API reference](#-api-reference)
- [Project structure](#-project-structure)
- [Design principles](#-design-principles)
- [Contributing](#-contributing)

---

## The problem

The web was built for **humans**: you log in, type your card details, solve a captcha, and click "Buy." Every payment rail we have — Stripe, PayPal, app stores — assumes a person with an email inbox, a bank card, and a browser session.

**AI agents have none of that.** An autonomous agent has no inbox to confirm, no card to type, no checkout to click through. Yet agents are now the actors that need to *transact* — calling APIs, hiring other agents, buying compute and data — thousands of times an hour, autonomously, often for a fraction of a cent. Subscriptions and API keys don't fit a world where a model decides *at runtime* which tool it needs and wants to pay only for that one call.

There's a missing primitive: **a way for software to pay software, per request, without a human in the loop.**

## What is x402?

[**x402**](https://x402.org) is an open payment protocol from Coinbase that resurrects the long-dormant HTTP status code **`402 Payment Required`**. It lets any API charge for a request *inline*, and any caller pay for it *inside the same request* — no accounts, no API keys, no invoices.

The handshake is a single round-trip:

```
1.  Agent     ──── GET /api/x402/llm ──────────────────►  Server
2.  Agent     ◄─── 402 Payment Required ────────────────  accepts: [{ payTo, maxAmountRequired, asset: USDC, network: base }]
3.  Agent     ──── signs an EIP-3009 USDC authorization  (off-chain, gasless — just a signature)
4.  Agent     ──── retry with the X-PAYMENT header ─────►  Server
5.  Server    ──── verifies + settles via a facilitator ►  Base mainnet   ✅ on-chain tx
6.  Agent     ◄─── 200 OK + the result ─────────────────  (the work is delivered)
```

The agent never pre-funds a balance or holds an API key. **The payment _is_ the request.** Settlement happens in USDC on **Base** — a low-fee Ethereum L2 — so micropayments of a cent or less are economical.

## What Tollbooth adds

x402 solves *payment*. But a raw network of pay-per-call endpoints is **useless without trust and tooling**:

- Which endpoints are **real**, and which are dead links or scams?
- Does an endpoint *actually settle* on-chain, or just claim to?
- How does an agent **find** the right service, judge its **reputation**, and **pay** it safely?
- How do you let an agent do all of this **on its own**, within a budget?

**Tollbooth is the layer that makes x402 usable.** It's a live product on **Base mainnet** that wraps the protocol with discovery, *real* verification, reputation, automation, and a marketplace:

> **Discover** paid agent APIs → **verify** they truly settle on-chain → **track** their reputation & uptime → **pay** per call in USDC → **automate** it with self-driving agents → and **buy & sell** the whole thing in a marketplace.

Every figure on the site is derived from **real records** — real calls, real settlements, real tx hashes. Nothing is mocked or faked.

---

## ✨ Features

| | Feature | What it does |
|---|---|---|
| 🛰️ | **Service Directory** | Browse, search, and filter every x402 paid API on Base. Import live endpoints straight from the [Coinbase Bazaar](https://x402.org) or any x402 manifest. |
| ✅ | **Real Verification** | Tollbooth doesn't trust a listing's word — it *pays the endpoint a real cent* and confirms the on-chain settlement before marking it verified. |
| 📊 | **Reputation & Trust Scores** | Live scores computed from real uptime, success rate, and call volume — not vanity numbers. |
| 💸 | **Pay-Per-Call x402 Services** | First-party paid endpoints: AI **chat**, **summarize**, **translate**, **extract**, plus utility **hash** & **uuid** — each charged in USDC per request. |
| 🤖 | **Autonomous Agents** | Self-driving agents (budget + interval + goal) that find, pay for, and call services on their own — no human in the loop. Create as many as you want. |
| 🧠 | **Hermes Orchestrator** | Give it a goal in plain English. Hermes reasons, calls the paid x402 tools it needs — each a real settlement — and returns the answer with a full trace. |
| 🔀 | **Smart Router** | Routes a request to the best live service by reputation, price, and uptime — then pays and executes. |
| 🏪 | **Marketplace** | List services, agents, and automations for sale. Buyers pay via x402; funds settle **directly to the seller's wallet**; deliverables land on the buyer's dashboard. |
| 🔐 | **Claim & Ownership** | Prove you own a service's payout wallet via a signed nonce challenge — then manage it from your dashboard. |
| 📈 | **Uptime Monitoring** | Scheduled probes track endpoint health over time, feeding the trust score. |
| 🧾 | **Payments Ledger** | Every paid call, attempt, amount, and tx hash — a real, auditable settlement log. |
| 👛 | **Bring-Your-Own-Wallet** | Connect with [Privy](https://privy.io) and pay with **your own** USDC on Base. |

---

## 🔬 Deep dives

### Real verification — *prove it settles*

Anyone can *claim* their endpoint speaks x402. Tollbooth proves it. When a service is submitted or re-checked, it runs a **7-step pipeline** ([`lib/verification.ts`](lib/verification.ts)) against the live endpoint — and a service is only marked **`verified`** when *every* step passes, including a **real paid replay** that settles on Base:

| # | Step | What's checked |
|---|------|----------------|
| 1 | **Endpoint responds** | The URL is reachable within a 10s timeout; latency is recorded. |
| 2 | **Returns HTTP 402** | An unpaid `GET` must be challenged with `402 Payment Required` (the x402 contract). |
| 3 | **Payment requirements parsed** | The `accepts` array is parsed from the body **or** a base64 `payment-required` header; network must be **Base/Base-Sepolia** and asset must be **USDC**. |
| 4 | **Wallet valid** | The listing wallet is a valid address **and matches the endpoint's declared `payTo`** (mismatch = fail). |
| 5 | **Test payment prepared** | An "exact" payment intent is constructed locally from the requirements. |
| 6 | **Base settlement verified** | The official x402 SDK **signs and replays** the request, settling real USDC; the facilitator's payment response is captured. |
| 7 | **Valid response returned** | The paid replay returns a healthy `200` with a real body. |

Every run is stored with per-step evidence (status codes, latencies, the parsed requirement, the settlement response) so a service's verification history is fully auditable.

### Trust & reputation scoring

Reputation is **computed from real telemetry only** ([`lib/metrics.ts`](lib/metrics.ts), [`lib/utils.ts`](lib/utils.ts)) — demo seed numbers are discarded the moment a real check or call arrives. The score blends three signals:

```
reputation = round( ( uptime%·0.4 + successRate·0.4 + volume·0.2 ) · 100 · verifiedBonus )

  uptime%       = share of health probes that were "up"
  successRate   = ok calls / (ok + failed calls)
  volume        = min(1, log10(totalCalls + 1) / 5)   # confidence, saturates ~100k calls
  verifiedBonus = 1.0 if verified, else 0.4            # unverified services are capped hard
```

Scores roll up into tiers — **Elite (≥90) · Trusted (≥75) · Established (≥50) · Emerging (>0)** — and an **agent's** trust score is the mean reputation of its services that have live data, while its revenue and calls-served come only from real, settled `paid + ok` records.

### First-party paid x402 services

Tollbooth ships its own production x402 endpoints so the network has real, working services from day one ([`app/api/x402/*`](app/api)):

| Endpoint | Pays for |
|---|---|
| `llm` | An AI chat completion. |
| `summarize` · `translate` · `extract` | AI text utilities (summary, translation, structured extraction). |
| `hash` · `uuid` | Deterministic utility compute. |
| `echo` | A minimal reference endpoint for testing the x402 flow. |

The AI endpoints are fulfilled through a **pluggable model gateway** (225+ models, default `gemini-2.5-flash`) ([`lib/inference.ts`](lib/inference.ts)). Each call is gated by a real USDC payment before any work runs.

### Autonomous agents

An autonomous agent is a **self-driving spender** ([`lib/autonomous.ts`](lib/autonomous.ts)). You give it three things — a **goal**, a **budget** (USDC), and an **interval** — and it runs itself:

- On each tick it picks a service, **pays the real x402 price**, calls it, and records the result.
- A **budget** and optional **call cap** bound spend; it will not place a call that would exceed either.
- `spentUsdc` is tracked per agent; once exhausted it stops (and won't silently resurrect).
- `nextRunAt` schedules the following run; `tickDueAgents` runs everything that's due.

No human approves each call — that's the point. You set the rails, the agent operates within them.

### Hermes orchestrator

Hermes is a **goal-driven agent loop** ([`lib/hermes.ts`](lib/hermes.ts)) built on the **ReAct** pattern. You give it a goal and a budget; it treats the in-app x402 services as **paid tools** and reasons its way to an answer:

- Each turn it emits **one JSON action** — `{ "thought": "...", "action": "<tool>", "input": "..." }` — or finishes with `{ "action": "final", "answer": "..." }`.
- Every tool call is a **real x402 payment** settled in USDC on Base; the tool's output is fed back as the next observation.
- It's bounded by `maxSteps` (1–12, default 6) and the **budget** — when the budget is hit, it's told to return its best final answer.
- The full **trace** (thoughts, tool calls, costs, observations) is returned alongside the answer.

### Smart router

The router turns "I need *X*" into "pay *this* service" ([`lib/router.ts`](lib/router.ts)). It filters the directory to services that are genuinely usable — **recently up**, **actually speak x402** (have answered a `402`), and **within budget** — then scores the rest by how well they match the request's query/category, and picks the **best reputation within budget**. A free **dry-run** mode returns the selection and ranked candidates *without* paying, so agents can plan before they spend.

### Marketplace

The marketplace ([`lib/marketplace.ts`](lib/marketplace.ts)) lets anyone list **services, agents, or automations** for sale. Buyers pay through the same x402 flow, and funds settle **directly to the seller's wallet** — Tollbooth doesn't custody the money. Purchases are recorded and the deliverable lands on the buyer's dashboard. Listings can link directly to a seller's x402 service so the thing you buy is the thing you can immediately call.

---

## 🏗️ Architecture

```
                            ┌────────────────────────────────────────────┐
                            │              Tollbooth (Next.js)             │
   ┌─────────┐  HTTP 402    │                                              │
   │   AI    │ ───────────► │  ┌─────────┐  ┌─────────┐  ┌────────────┐    │
   │  Agent  │ ◄─────────── │  │ Router  │  │ Hermes  │  │ Autonomous │    │
   └─────────┘   pay + 200  │  └────┬────┘  └────┬────┘  │   Agents   │    │
        │                   │       │            │       └─────┬──────┘    │
        │ signs EIP-3009    │       └────────────┴─────────────┘           │
        │ USDC authorization│                    │                         │
        ▼                   │            ┌────────▼─────────┐               │
   ┌─────────┐              │            │   x402 Services   │              │
   │  Privy  │              │            │ llm · summarize · │              │
   │ Wallet  │              │            │ translate · hash  │              │
   └─────────┘              │            └────────┬──────────┘              │
                            │                     │                         │
                            │   ┌─────────────────▼───────────────────┐     │
                            │   │  Verification · Trust · Monitoring   │     │
                            │   └─────────────────┬───────────────────┘     │
                            │                     │                         │
                            │            ┌────────▼─────────┐               │
                            │            │  Neon Postgres   │  (JSONB KV)    │
                            │            └──────────────────┘               │
                            └─────────────────────┬────────────────────────┘
                                                  │ settle
                                    ┌─────────────▼──────────────┐
                                    │  Coinbase CDP Facilitator   │
                                    │        → Base Mainnet        │
                                    └─────────────────────────────┘
```

---

## 🧰 Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **Framework** | [Next.js 14](https://nextjs.org) (App Router, RSC, route handlers) | One codebase for UI + API; server components for fast reads; `force-dynamic` for live data. |
| **Language** | [TypeScript](https://www.typescriptlang.org) | End-to-end type safety across protocol, store, and UI. |
| **Payments** | [`@coinbase/x402`](https://x402.org), `@x402/core`, `@x402/evm`, `@x402/fetch` | The x402 protocol — requirements, payment signing, and settlement. |
| **Chain** | [Base](https://base.org) mainnet + [viem](https://viem.sh) | Low-fee L2; viem for EIP-3009 USDC authorizations. |
| **Settlement** | Coinbase **CDP** facilitator | Verifies the signed payment and settles USDC on-chain. |
| **Wallets** | [Privy](https://privy.io) | Lets any visitor connect and pay with their own USDC. |
| **AI** | Pluggable model gateway (225+ models) | Powers the paid `llm` / `summarize` / `translate` / `extract` services and Hermes. |
| **Storage** | [Neon](https://neon.tech) serverless Postgres (JSONB KV) | Durable, serverless-friendly persistence that survives Vercel's read-only FS. |
| **Styling** | [Tailwind CSS](https://tailwindcss.com) + custom Base theme | Official Base Blue `#0000FF`, dither textures, dark/blue/white rhythm. |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 18.17+**
- A **Neon** (or any Postgres) connection string
- A funded **Base mainnet** EVM key + a **Coinbase CDP** API key (to settle real payments)
- A **Privy** app ID (for wallet connect)

### Install & run

```bash
git clone https://github.com/ctrlshifthash/Tollbooth.git
cd Tollbooth
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

### Environment

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Wallet connect (Privy)
NEXT_PUBLIC_PRIVY_APP_ID=...
PRIVY_APP_SECRET=...

# x402 payer — funded Base mainnet key (server-side only; spends REAL USDC)
X402_EVM_PRIVATE_KEY=0x...
X402_PAY_TO=0x...            # receiver wallet for the built-in payable endpoints

# Coinbase CDP facilitator (settles on Base)
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...

# AI model gateway (powers the paid llm/summarize/translate/extract services + Hermes)
AI_GATEWAY_KEY=...

# Pricing
X402_LLM_PRICE=$0.02
X402_ECHO_PRICE=$0.01

# Durable storage (Neon / any Postgres)
DATABASE_URL=postgresql://...
```

> ⚠️ **Mainnet warning:** `X402_EVM_PRIVATE_KEY` spends **real USDC** on Base. Use a dedicated, low-balance wallet.

---

## 📡 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/x402/llm` | `GET` | **Paid** AI chat — pay USDC, get a completion. |
| `/api/x402/summarize` · `translate` · `extract` | `GET` | **Paid** AI utilities. |
| `/api/x402/hash` · `uuid` · `echo` | `GET` | **Paid** lightweight utilities. |
| `/api/services` · `/api/services/[id]` | `GET/POST` | List, register, and read services. |
| `/api/verify` | `POST` | Run a real verification pass (pays + confirms settlement). |
| `/api/manifests` | `POST` | Bulk-import services from x402 manifests. |
| `/api/bazaar/sync` | `POST` | Pull live endpoints from the Coinbase Bazaar. |
| `/api/crawl` · `/api/discovered` | `POST/GET` | Discover and stage candidate endpoints. |
| `/api/agents` · `/api/autonomous` | `GET/POST` | Operators & self-driving agents. |
| `/api/autonomous/[id]/run` · `/api/autonomous/tick` | `POST` | Run one agent / all due agents. |
| `/api/hermes` | `POST` | Goal → reason → pay tools → answer (+ trace). |
| `/api/router/run` | `POST` | Pick best service, pay, execute (or dry-run). |
| `/api/marketplace` · `/api/marketplace/buy/[id]` | `GET/POST` | List & purchase via x402. |
| `/api/claim/nonce` · `/api/claim/verify` | `POST` | Prove wallet ownership of a service. |
| `/api/payments` | `GET` | The real settlement ledger. |
| `/api/monitoring` · `/api/health` | `GET/POST` | Uptime probes & health. |

---

## 🗂️ Project Structure

```
app/
  api/x402/      → first-party paid endpoints (llm, summarize, hash, …)
  api/…          → services, agents, autonomous, hermes, router, marketplace,
                   claim, verify, manifests, bazaar, monitoring, payments
  (pages)        → home, services, agents, dashboard, marketplace, router,
                   monitoring, payments, docs, verify, claim, manifest
lib/
  x402-*.ts      → protocol config, server settlement, browser/agent payment
  verification.ts→ the 7-step pay-and-confirm verification pipeline
  metrics.ts     → live trust/reputation derivation from real records
  store.ts       → async Postgres-backed KV (services, agents, nonces)
  db.ts          → Neon KV layer (JSONB, one row per collection)
  router.ts      → candidate filtering, scoring & call recording
  hermes.ts      → ReAct orchestrator (reason → pay tools → answer)
  autonomous.ts  → self-driving agent runner & scheduler
  marketplace.ts → listings, purchases, seller-wallet settlement
  inference.ts   → AI model gateway client (225+ models)
  health.ts · claim.ts · bazaar.ts · crawler.ts · manifest.ts · seed.ts
```

---

## 🎯 Design Principles

- **No mocks.** Every score, settlement, and tx hash is derived from real data. Demo seed numbers are thrown away the instant real telemetry exists.
- **Trust is earned on-chain.** A service is only "verified" after a real USDC settlement on Base — not because it filled out a form.
- **Non-custodial.** Marketplace funds settle straight to the seller's wallet; Tollbooth never holds your money.
- **Agent-first.** Every capability is an API an agent can call, not just a button a human can click.

---

## 🤝 Contributing

PRs and issues welcome. Building x402 services? List them on Tollbooth and open a PR to add notable ones to the directory seed.

---

<div align="center">

**Tollbooth** — where AI agents do business.

[🌐 trytollbooth.com](https://trytollbooth.com) · [𝕏 @trytollbooth](https://x.com/trytollbooth) · Built on [Base](https://base.org) · Settled in USDC

</div>

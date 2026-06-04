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
[![Deployed on Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com)
[![Mainnet](https://img.shields.io/badge/Network-Base%20Mainnet-success?style=flat-square)](https://base.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-blueviolet?style=flat-square)](#-contributing)

</div>

---

## What is Tollbooth?

The web was built for humans who log in, type card details, and click "Buy." **AI agents can't do any of that.** They have no inbox to verify, no card to enter, no checkout to navigate. Yet agents are exactly the actors that now need to call APIs, hire other agents, and pay for compute — thousands of times, autonomously, for fractions of a cent.

[**x402**](https://x402.org) solves the *payment* half: it revives the dormant HTTP `402 Payment Required` status code so any API can demand a stablecoin payment inline, and any caller can pay it inside the same request — no keys, no accounts, no invoices. The agent calls an endpoint, gets a `402` with payment terms, signs a USDC authorization, retries, and gets its answer. One round-trip.

But an open network of pay-per-call endpoints is **useless without trust and tooling**. Which endpoints are real? Which actually work? How does an agent *find* them, judge them, and put them to use?

**Tollbooth is that layer.** It is a live product on **Base mainnet** that turns the raw x402 protocol into a usable economy:

> **Discover** paid agent APIs → **verify** they really settle on-chain → **track** their reputation & uptime → **pay** per call in USDC → **automate** it with self-driving agents → and **buy & sell** the whole thing in a marketplace.

Every number on the site is real. Every settlement is a real transaction on Base. Nothing is mocked.

---

## ✨ Features

| | Feature | What it does |
|---|---|---|
| 🛰️ | **Service Directory** | Browse, search, and filter every x402 paid API on Base. Import live endpoints straight from the [Coinbase Bazaar](https://x402.org). |
| ✅ | **Real Verification** | Tollbooth doesn't take a listing's word for it — it *pays the endpoint a real cent* and confirms the on-chain settlement before marking it verified. |
| 📊 | **Reputation & Trust Scores** | Live trust scores from real call history, settlement success rate, latency, and uptime — not vanity metrics. |
| 💸 | **Pay-Per-Call x402 Services** | First-party paid endpoints: AI **chat**, **summarize**, **translate**, **extract**, plus utility **hash** & **uuid** — each charged in USDC per request. |
| 🤖 | **Autonomous Agents** | Spin up self-driving agents (budget + interval + goal). They find, pay for, and call services on their own — no human in the loop. Create as many as you want. |
| 🧠 | **Hermes Orchestrator** | Give it a goal in plain English. Hermes reasons, calls the paid x402 tools it needs — each a real settlement — and returns the answer with a full trace. |
| 🔀 | **Smart Router** | Routes a request to the best candidate service by price, reputation, and latency, then pays and executes. |
| 🏪 | **Marketplace** | List services, agents, and automations for sale. Buyers pay via x402; funds settle **directly to the seller's wallet**; deliverables land on the buyer's dashboard. |
| 🔐 | **Claim & Ownership** | Prove you own a service's payout wallet via a signed nonce challenge — then manage it from your dashboard. |
| 📈 | **Uptime Monitoring** | Scheduled probes track endpoint health over time, feeding the trust score. |
| 🧾 | **Payments Ledger** | Every paid call, attempt, amount, and tx hash — a real, auditable settlement log. |
| 👛 | **Bring-Your-Own-Wallet** | Connect with [Privy](https://privy.io) and pay with **your own** USDC on Base. |

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

### The x402 payment flow (one request)

```
1.  Agent     ──── GET /api/x402/llm ──────────────────►  Tollbooth
2.  Agent     ◄─── 402 Payment Required ────────────────  { payTo, amount, asset: USDC, network: base }
3.  Agent     ──── sign EIP-3009 USDC authorization (off-chain, gasless)
4.  Agent     ──── retry with X-PAYMENT header ─────────►  Tollbooth
5.  Tollbooth ──── verify + settle via CDP facilitator ─►  Base mainnet   ✅ tx hash
6.  Agent     ◄─── 200 OK + result ─────────────────────  (the work is delivered)
```

No API keys. No accounts. No pre-funding a balance. **The payment _is_ the request.**

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
| **Storage** | [Neon](https://neon.tech) serverless Postgres (JSONB KV) | Durable, serverless-friendly persistence that survives Vercel's read-only FS. |
| **Styling** | [Tailwind CSS](https://tailwindcss.com) + custom Base theme | Official Base Blue `#0000FF`, dither textures, dark/blue/white rhythm. |
| **Deploy** | [Vercel](https://vercel.com) | Zero-config Next.js hosting + Neon integration. |

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

# AI gateway (powers the paid llm/summarize/translate/extract services)
AI_GATEWAY_KEY=...

# Pricing
X402_LLM_PRICE=$0.02
X402_ECHO_PRICE=$0.01

# Durable storage (Neon / any Postgres)
DATABASE_URL=postgresql://...
```

> ⚠️ **Mainnet warning:** `X402_EVM_PRIVATE_KEY` spends real USDC on Base. Use a dedicated, low-balance wallet.

---

## 📡 API Reference (selected)

| Endpoint | Method | Description |
|---|---|---|
| `/api/x402/llm` | `GET` | **Paid** AI chat — pay USDC, get a completion. |
| `/api/x402/summarize` · `translate` · `extract` | `GET` | **Paid** AI utilities. |
| `/api/x402/hash` · `uuid` · `echo` | `GET` | **Paid** lightweight utilities. |
| `/api/services` | `GET/POST` | List & register services. |
| `/api/verify` | `POST` | Run a real verification pass (pays + confirms settlement). |
| `/api/manifests` | `POST` | Bulk-import services from x402 manifests. |
| `/api/bazaar/sync` | `POST` | Pull live endpoints from the Coinbase Bazaar. |
| `/api/agents` · `/api/autonomous` | `GET/POST` | Operators & self-driving agents. |
| `/api/autonomous/tick` | `POST` | Run all due autonomous agents. |
| `/api/hermes` | `POST` | Goal → reason → pay tools → answer (+ trace). |
| `/api/router/run` | `POST` | Pick best service, pay, execute. |
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
  store.ts       → async Postgres-backed KV (services, agents, nonces)
  db.ts          → Neon KV layer (JSONB, one row per collection)
  verification.ts→ real pay-and-confirm verification pipeline
  router.ts      → candidate selection & call recording
  hermes.ts      → orchestrator (reason → pay tools → answer)
  autonomous.ts  → self-driving agent runner & scheduler
  marketplace.ts → listings, purchases, seller-wallet settlement
  metrics.ts · health.ts · claim.ts · bazaar.ts · crawler.ts · inference.ts
```

---

## 🌐 Deployment

Tollbooth runs on **Vercel** with **Neon Postgres** for persistence (Vercel's filesystem is read-only, so all state lives in Postgres).

1. Import the repo into Vercel.
2. Add the **Neon** integration (auto-provisions `DATABASE_URL`).
3. Set the environment variables above.
4. Deploy. The app seeds itself on first run.

---

## 🤝 Contributing

PRs and issues welcome. Building x402 services? List them on Tollbooth and open a PR to add notable ones to the directory seed.

---

<div align="center">

**Tollbooth** — where AI agents do business.

[🌐 trytollbooth.com](https://trytollbooth.com) · [𝕏 @trytollbooth](https://x.com/trytollbooth) · Built on [Base](https://base.org) · Settled in USDC

</div>

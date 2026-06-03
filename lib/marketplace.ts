import "server-only";
import { randomBytes } from "node:crypto";
import type { Deliverable, ListingType, MarketplaceListing, Purchase, ServiceCategory } from "./types";
import { isValidEthAddress } from "./utils";
import { kvGet, kvSet } from "./db";

// ---------------------------------------------------------------------------
// Marketplace storage (Postgres KV).
//
// Listings + purchases persisted via lib/db. Buys settle in USDC on Base via
// x402 directly to the seller's wallet (see /api/marketplace/buy/[id]).
// ---------------------------------------------------------------------------

// Seeded SAMPLE listings — social proof so the marketplace isn't empty. Marked
// demo + not purchasable. Never written to the DB.
const DEMO_LISTINGS: MarketplaceListing[] = [
  {
    id: "mkt_sample_ocr",
    type: "service",
    title: "Vision OCR API",
    description: "Extract text + tables from any image or PDF page. Pay-per-call x402, no key.",
    category: "media",
    priceUsdc: 0.02,
    sellerWallet: "0x3F8aB2c1D45e6789A0bC1d2E3f4A5b6C7d8E9f01",
    deliverable: { kind: "content", data: { content: "(sample)" }, note: "Sample listing." },
    sales: 47,
    revenueUsdc: 0.94,
    createdAt: "2026-06-03T09:10:00.000Z",
    active: true,
    demo: true,
  },
  {
    id: "mkt_sample_news",
    type: "automation",
    title: "Daily Crypto News Digest",
    description: "An autonomous agent that summarizes the day's crypto headlines and posts a digest.",
    category: "ai-inference",
    priceUsdc: 0.5,
    sellerWallet: "0x9c2D4e6F8a0B1c3D5e7F9a1B3c5D7e9F0a2B4c6D",
    deliverable: { kind: "content", data: { content: "(sample)" }, note: "Sample listing." },
    sales: 18,
    revenueUsdc: 9,
    createdAt: "2026-06-03T11:30:00.000Z",
    active: true,
    demo: true,
  },
  {
    id: "mkt_sample_price",
    type: "service",
    title: "Realtime Token Price Feed",
    description: "Live USD price for any Base/Ethereum token. Settles in USDC per request.",
    category: "finance",
    priceUsdc: 0.01,
    sellerWallet: "0x7A1b2C3d4E5f60718293A4b5C6d7E8f90A1b2C3d",
    deliverable: { kind: "content", data: { content: "(sample)" }, note: "Sample listing." },
    sales: 132,
    revenueUsdc: 1.32,
    createdAt: "2026-06-03T12:05:00.000Z",
    active: true,
    demo: true,
  },
  {
    id: "mkt_sample_whale",
    type: "service",
    title: "Whale Wallet Tracker",
    description: "Watch large on-chain moves and get structured alerts for a wallet or token.",
    category: "data",
    priceUsdc: 1,
    sellerWallet: "0x2E4f6A8b0C2d4E6f8A0b2C4d6E8f0A2b4C6d8E0f",
    deliverable: { kind: "content", data: { content: "(sample)" }, note: "Sample listing." },
    sales: 23,
    revenueUsdc: 23,
    createdAt: "2026-06-03T13:15:00.000Z",
    active: true,
    demo: true,
  },
  {
    id: "mkt_sample_agent",
    type: "agent",
    title: "Research Analyst Agent",
    description: "A cloneable agent that researches a topic across paid sources and writes a brief.",
    category: "tools",
    priceUsdc: 3,
    sellerWallet: "0x5b7D9f1A3c5E7090B2d4F6a8C0e2B4d6F8a0C2e4",
    deliverable: { kind: "content", data: { content: "(sample)" }, note: "Sample listing." },
    sales: 9,
    revenueUsdc: 27,
    createdAt: "2026-06-03T14:40:00.000Z",
    active: true,
    demo: true,
  },
];

const readListings = () => kvGet<MarketplaceListing[]>("marketplace", []);
const readPurchases = () => kvGet<Purchase[]>("purchases", []);

function applyFilters(list: MarketplaceListing[], filters?: { type?: string; category?: string; seller?: string }): MarketplaceListing[] {
  let out = list;
  if (filters?.type && filters.type !== "all") out = out.filter((l) => l.type === filters.type);
  if (filters?.category && filters.category !== "all") out = out.filter((l) => l.category === filters.category);
  if (filters?.seller) out = out.filter((l) => l.sellerWallet.toLowerCase() === filters.seller!.toLowerCase());
  return out;
}

export async function getListings(filters?: { type?: string; category?: string; seller?: string }): Promise<MarketplaceListing[]> {
  const real = (await readListings()).filter((l) => l.active);
  const samples = filters?.seller ? [] : DEMO_LISTINGS;
  const list = applyFilters([...real, ...samples], filters);
  return list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function getListing(id: string): Promise<MarketplaceListing | undefined> {
  return (await readListings()).find((l) => l.id === id) ?? DEMO_LISTINGS.find((l) => l.id === id);
}

export async function saveListing(listing: MarketplaceListing): Promise<MarketplaceListing> {
  const all = await readListings();
  const i = all.findIndex((l) => l.id === listing.id);
  if (i >= 0) all[i] = listing;
  else all.unshift(listing);
  await kvSet("marketplace", all);
  return listing;
}

export interface CreateListingInput {
  type: ListingType;
  title: string;
  description: string;
  category: ServiceCategory;
  priceUsdc: number;
  sellerWallet: string;
  sellerAgentId?: string;
  serviceId?: string;
  deliverable: Deliverable;
}

export async function createListing(input: CreateListingInput): Promise<{ ok: boolean; error?: string; listing?: MarketplaceListing }> {
  if (!input.title.trim()) return { ok: false, error: "Title is required" };
  if (!isValidEthAddress(input.sellerWallet)) return { ok: false, error: "A valid seller wallet is required" };
  if (!(input.priceUsdc > 0)) return { ok: false, error: "Price must be greater than 0" };

  const listing: MarketplaceListing = {
    id: `mkt_${randomBytes(5).toString("hex")}`,
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    priceUsdc: input.priceUsdc,
    sellerWallet: input.sellerWallet,
    sellerAgentId: input.sellerAgentId,
    serviceId: input.serviceId,
    deliverable: input.deliverable,
    sales: 0,
    revenueUsdc: 0,
    createdAt: new Date().toISOString(),
    active: true,
  };
  return { ok: true, listing: await saveListing(listing) };
}

// ---- Purchases ------------------------------------------------------------

export async function getPurchases(buyerWallet?: string): Promise<Purchase[]> {
  let all = await readPurchases();
  if (buyerWallet) all = all.filter((p) => p.buyerWallet.toLowerCase() === buyerWallet.toLowerCase());
  return all.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

export async function recordPurchase(p: Omit<Purchase, "id" | "timestamp">): Promise<Purchase> {
  const purchase: Purchase = { ...p, id: `buy_${randomBytes(5).toString("hex")}`, timestamp: new Date().toISOString() };
  const all = await readPurchases();
  all.unshift(purchase);
  await kvSet("purchases", all);

  const listing = await getListing(p.listingId);
  if (listing && !listing.demo) {
    listing.sales += 1;
    listing.revenueUsdc = Math.round((listing.revenueUsdc + p.amountUsdc) * 1e6) / 1e6;
    await saveListing(listing);
  }
  return purchase;
}

import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { Deliverable, ListingType, MarketplaceListing, Purchase, ServiceCategory } from "./types";
import { isValidEthAddress } from "./utils";

// ---------------------------------------------------------------------------
// Marketplace storage.
//
// Listings + purchases persisted to data/*.json. Buys settle in USDC on Base
// via x402 directly to the seller's wallet (see /api/marketplace/buy/[id]).
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");
const LISTINGS_FILE = path.join(DATA_DIR, "marketplace.json");
const PURCHASES_FILE = path.join(DATA_DIR, "purchases.json");

function ensure(file: string) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, "[]");
}
function readJson<T>(file: string): T {
  ensure(file);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}
function writeJson(file: string, data: unknown) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ---- Listings -------------------------------------------------------------

// Seeded SAMPLE listings — shown for social proof so the marketplace isn't
// empty. Marked demo + not purchasable. Never written to disk.
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

function applyFilters(list: MarketplaceListing[], filters?: { type?: string; category?: string; seller?: string }): MarketplaceListing[] {
  let out = list;
  if (filters?.type && filters.type !== "all") out = out.filter((l) => l.type === filters.type);
  if (filters?.category && filters.category !== "all") out = out.filter((l) => l.category === filters.category);
  if (filters?.seller) out = out.filter((l) => l.sellerWallet.toLowerCase() === filters.seller!.toLowerCase());
  return out;
}

export function getListings(filters?: { type?: string; category?: string; seller?: string }): MarketplaceListing[] {
  const real = readJson<MarketplaceListing[]>(LISTINGS_FILE).filter((l) => l.active);
  // Don't show samples when filtering by a specific seller wallet.
  const samples = filters?.seller ? [] : DEMO_LISTINGS;
  const list = applyFilters([...real, ...samples], filters);
  return list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function getListing(id: string): MarketplaceListing | undefined {
  return readJson<MarketplaceListing[]>(LISTINGS_FILE).find((l) => l.id === id) ?? DEMO_LISTINGS.find((l) => l.id === id);
}

export function saveListing(listing: MarketplaceListing): MarketplaceListing {
  const all = readJson<MarketplaceListing[]>(LISTINGS_FILE);
  const i = all.findIndex((l) => l.id === listing.id);
  if (i >= 0) all[i] = listing;
  else all.unshift(listing);
  writeJson(LISTINGS_FILE, all);
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

export function createListing(input: CreateListingInput): { ok: boolean; error?: string; listing?: MarketplaceListing } {
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
  return { ok: true, listing: saveListing(listing) };
}

// ---- Purchases ------------------------------------------------------------

export function getPurchases(buyerWallet?: string): Purchase[] {
  let all = readJson<Purchase[]>(PURCHASES_FILE);
  if (buyerWallet) all = all.filter((p) => p.buyerWallet.toLowerCase() === buyerWallet.toLowerCase());
  return all.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

export function recordPurchase(p: Omit<Purchase, "id" | "timestamp">): Purchase {
  const purchase: Purchase = { ...p, id: `buy_${randomBytes(5).toString("hex")}`, timestamp: new Date().toISOString() };
  const all = readJson<Purchase[]>(PURCHASES_FILE);
  all.unshift(purchase);
  writeJson(PURCHASES_FILE, all);

  // Roll the sale up onto the listing.
  const listing = getListing(p.listingId);
  if (listing) {
    listing.sales += 1;
    listing.revenueUsdc = Math.round((listing.revenueUsdc + p.amountUsdc) * 1e6) / 1e6;
    saveListing(listing);
  }
  return purchase;
}

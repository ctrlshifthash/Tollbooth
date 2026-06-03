/** @type {import('next').NextConfig} */

// Privy declares optional peer deps for chains we don't use (Solana, Abstract,
// Farcaster mini-apps). They aren't installed; alias them to empty so webpack
// doesn't fail trying to resolve them. We only use EVM / Base.
const OPTIONAL_PRIVY_DEPS = [
  "@farcaster/mini-app-solana",
  "@solana/kit",
  "@solana/web3.js",
  "@solana-program/memo",
  "@solana-program/token",
  "@solana-program/system",
  "@abstract-foundation/agw-client",
];

const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = { ...(config.resolve.alias || {}) };
    for (const dep of OPTIONAL_PRIVY_DEPS) {
      config.resolve.alias[dep] = false;
    }
    return config;
  },
};

export default nextConfig;

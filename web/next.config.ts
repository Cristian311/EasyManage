import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PGlite loads its WebAssembly build from node_modules at runtime, so the bundler must leave it alone
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default nextConfig;

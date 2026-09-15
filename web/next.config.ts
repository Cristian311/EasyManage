import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PGlite loads its WebAssembly build from node_modules at runtime, so the bundler must leave it alone
  serverExternalPackages: ['@electric-sql/pglite'],
  // this folder is the project: an unrelated package-lock.json higher up (C:\Users\<name>) must not be taken for the root
  outputFileTracingRoot: __dirname,
};

export default nextConfig;

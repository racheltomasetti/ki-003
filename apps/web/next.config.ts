import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Tell Next.js to compile the local monorepo packages rather than treating
  // them as pre-built node_modules. Required for pnpm workspace packages.
  transpilePackages: ['@ki/types', '@ki/services', '@ki/utils'],
}

export default nextConfig

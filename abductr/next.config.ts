import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Puppeteer requires these to be external
  serverExternalPackages: ['puppeteer', 'puppeteer-core', '@sparticuz/chromium-min'],

  // Turbopack configuration (Next.js 16 default)
  turbopack: {
    root: __dirname,
  },

  // Allow images from external sources if needed
  images: {
    domains: [],
  },
}

export default nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: process.env.NODE_ENV === 'production' ? '/jeopardy-lm' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/jeopardy-lm/' : '',
}

module.exports = nextConfig
/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  trailingSlash: true,
  images: { unoptimized: true },
  async headers() {
    return [{
      source: '/:path*',
      headers: [{ key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' }]
    }]
  }
}

export default nextConfig

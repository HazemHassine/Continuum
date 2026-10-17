/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Opt in on constrained machines without slowing normal/CI builds.
  ...(process.env.CONTINUUM_LOW_MEMORY_BUILD === "1"
    ? { experimental: { cpus: 1 } }
    : {}),
  async rewrites() {
    return [
      {
        source: "/api/py/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://127.0.0.1:8100/api/v1/:path*"
            : "/api/py/:path*",
      },
    ];
  },
};

export default nextConfig;

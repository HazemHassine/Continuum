/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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

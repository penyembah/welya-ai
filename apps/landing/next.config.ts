import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  images: { formats: ["image/avif", "image/webp"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      { source: "/screenshots/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ]
  },
};

export default nextConfig;

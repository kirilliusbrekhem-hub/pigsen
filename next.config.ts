import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The business-plan PDF reads Geist font files from node_modules at runtime; ship them with that route.
  outputFileTracingIncludes: { "/api/plan/[id]/pdf": ["./node_modules/geist/dist/fonts/geist-sans/**"] },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // public/ files have no content hash: cache them for a day and refresh in the background (sw.js is left alone).
      { source: "/:file(icon.png|pig.png)", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
      { source: "/landing/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    ];
  },
};

export default nextConfig;

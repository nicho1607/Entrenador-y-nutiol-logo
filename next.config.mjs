import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/**
 * Conservative security response headers applied to every route. These are
 * safe defaults that do not interfere with Next.js's inline runtime or
 * Recharts: we deliberately do NOT ship a restrictive `default-src`
 * Content-Security-Policy here (it would break Next's inline bootstrap and the
 * chart library). A full CSP can be layered on later once nonces/hashes are
 * wired for the framework's inline scripts.
 */
const securityHeaders = [
  // Block MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Disallow framing to mitigate clickjacking.
  { key: "X-Frame-Options", value: "DENY" },
  // Limit referrer leakage across origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable speculative DNS prefetching.
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // HSTS. Browsers only honor this over HTTPS; it is a no-op on plain HTTP
  // (e.g. local http://localhost), so it is safe to send everywhere.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the file-tracing root to this project so an unrelated lockfile in a
  // parent directory does not get picked as the workspace root.
  outputFileTracingRoot: projectRoot,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

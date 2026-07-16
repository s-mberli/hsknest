import type { NextConfig } from "next";

// Optional analytics script origin (Umami) — allowed in the CSP only when
// configured at build time. Empty/unset → no third-party origins at all.
const umamiOrigin = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_UMAMI_URL;
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
})();

// Baseline CSP: blocks external script injection, framing, plugin content,
// and form hijacking. `script-src` keeps 'unsafe-inline' because Next's
// bootstrap inline scripts require it without per-request nonces (which need
// dynamic rendering everywhere); external origins are still restricted.
// React needs eval() for dev-only debugging features; production never does.
const scriptEval =
  process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${scriptEval} ${umamiOrigin}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${umamiOrigin}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for the Docker image.
  output: "standalone",

  // Baseline security headers. HSTS is best set at the TLS-terminating
  // proxy (see docs/DEPLOYMENT.md).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

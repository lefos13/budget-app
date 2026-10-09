import type { NextConfig } from "next";
import { LANDING_SESSION_COOKIE, shouldRewriteRootToLanding } from "./src/lib/landing-routing";

const nextConfig: NextConfig = {
  // Self-contained server.js + traced node_modules, so production ships a small artifact
  // and never runs pnpm install on the droplet.
  output: "standalone",

  /*
   * The Greek landing is prerendered at `/el` but its public URL is `/` (`/en` stays as is).
   * Visitors without a session cookie (crawlers, link previews, logged-out users) get it at `/`;
   * signed-in users get the dashboard. A stale cookie still falls back to the client-side landing.
   */
  async redirects() {
    return [{ source: "/el", destination: "/", permanent: true }];
  },
  async rewrites() {
    if (!shouldRewriteRootToLanding(process.env)) return [];
    return {
      beforeFiles: [
        { source: "/", missing: [{ type: "cookie", key: LANDING_SESSION_COOKIE }], destination: "/el" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;

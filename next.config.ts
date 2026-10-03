import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server.js + traced node_modules, so production ships a small artifact
  // and never runs pnpm install on the droplet.
  output: "standalone",
};

export default nextConfig;

/*
PM2 definition for the production droplet. It lives inside each release and points at the
`current` symlink, so `pm2 startOrReload` after a symlink swap starts the new release.
Runtime config comes only from APP_ROOT/shared/.env.production (never from the release).
*/
const fs = require("node:fs");
const path = require("node:path");

const appRoot = process.env.APP_ROOT || "/root/budget-app";
const envFile = path.join(appRoot, "shared/.env.production");

const env = {};
for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!match) continue;
  env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
}

module.exports = {
  apps: [
    {
      name: "budget-app",
      cwd: path.join(appRoot, "current"),
      script: "server.js",
      exec_mode: "fork",
      instances: 1,
      node_args: "--max-old-space-size=256",
      max_memory_restart: "350M",
      env: { ...env, NODE_ENV: "production" },
    },
  ],
};

/*
PM2 definition for the production droplet. It lives inside each release and points at the
`current` symlink, so `pm2 startOrReload` after a symlink swap starts the new release.
Runtime config is never read from the release. It comes from two files, the later one winning:
  1. SHARED_ENV_FILE (default /root/shared/.env.production): droplet-wide mail settings
     (EMAIL_PROVIDER, GMAIL_*, EMAIL_FROM, EMAIL_REPLY_TO) shared by every app. Optional.
  2. APP_ROOT/shared/.env.production: this app's own values (AUTH_SECRET, DATABASE_URL, ...).
deploy-release.sh layers and validates the same two files before reloading.
The root PM2 daemon runs the app as the unprivileged `apps` user; it only needs to read the
release and write shared/data. The env files stay root-only because PM2 passes their values in.
*/
const fs = require("node:fs");
const path = require("node:path");

const appRoot = process.env.APP_ROOT || "/root/budget-app";
const sharedEnvFile = process.env.SHARED_ENV_FILE || "/root/shared/.env.production";
const envFile = path.join(appRoot, "shared/.env.production");

const env = {};
for (const file of [sharedEnvFile, envFile]) {
  if (file === sharedEnvFile && !fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
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
      uid: "apps",
      gid: "apps",
      env: { ...env, NODE_ENV: "production", HOME: "/home/apps" },
    },
  ],
};

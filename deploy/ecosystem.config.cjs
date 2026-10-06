// PM2 process for the VPS: `pm2 start deploy/ecosystem.config.cjs && pm2 save`.
// Listens on localhost only; nginx is the public entry point.
module.exports = {
  apps: [
    {
      name: "hibitat",
      cwd: "/var/www/hibitat",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3002",
      env: { NODE_ENV: "production" },
      max_memory_restart: "800M",
    },
  ],
};

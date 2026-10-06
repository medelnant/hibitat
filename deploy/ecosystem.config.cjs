// PM2 process for the VPS: `pm2 start deploy/ecosystem.config.cjs && pm2 save`.
// Listens on localhost only; nginx is the public entry point. Runs on the side-by-side
// Node 24 in /opt/node-24 (three.js deps need Node 22+; the system Node 20 serves the portfolio).
module.exports = {
  apps: [
    {
      name: "hibitat",
      cwd: "/var/www/hibitat",
      script: "node_modules/next/dist/bin/next",
      interpreter: "/opt/node-24/bin/node",
      args: "start -H 127.0.0.1 -p 3002",
      env: { NODE_ENV: "production", PATH: `/opt/node-24/bin:${process.env.PATH}` },
      max_memory_restart: "800M",
    },
  ],
};

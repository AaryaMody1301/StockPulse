const appDir = process.env.STOCKPULSE_APP_DIR || __dirname;

module.exports = {
  apps: [
    {
      name: "stockpulse-web",
      script: "server.js",
      cwd: appDir,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      error_file: "/var/log/pm2/stockpulse-web-error.log",
      out_file: "/var/log/pm2/stockpulse-web-out.log",
    },
    {
      name: "stockpulse-poller",
      script: "node_modules/.bin/tsx",
      args: "scripts/poll-quotes.ts",
      cwd: appDir,
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "256M",
      error_file: "/var/log/pm2/stockpulse-poller-error.log",
      out_file: "/var/log/pm2/stockpulse-poller-out.log",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};

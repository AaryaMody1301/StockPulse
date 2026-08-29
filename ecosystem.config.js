module.exports = {
  apps: [
    {
      name: "investsmart-web",
      script: "server.js",
      cwd: "/var/www/investsmart",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      error_file: "/var/log/pm2/investsmart-web-error.log",
      out_file: "/var/log/pm2/investsmart-web-out.log",
    },
    {
      name: "investsmart-poller",
      script: "node_modules/.bin/tsx",
      args: "scripts/poll-quotes.ts",
      cwd: "/var/www/investsmart",
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "256M",
      error_file: "/var/log/pm2/investsmart-poller-error.log",
      out_file: "/var/log/pm2/investsmart-poller-out.log",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};

module.exports = {
  apps: [
    {
      name: 'svara-pro-server',
      script: './server/dist/main.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/server-err.log',
      out_file: './logs/server-out.log',
      log_file: './logs/server-combined.log',
      time: true
    },
    {
      name: 'svara-pro-bot',
      script: './bot/dist/index.js',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/bot-err.log',
      out_file: './logs/bot-out.log',
      log_file: './logs/bot-combined.log',
      time: true
    }
  ]
};

module.exports = {
  apps: [
    {
      name: 'server',
      script: './server/dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
    },
    {
      name: 'bot',
      script: './bot/dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
    },
  ],
};

import { Telegraf, Context } from 'telegraf';
import rateLimit from 'telegraf-ratelimit';

// Расширяем тип Context для startPayload
interface MyContext extends Context {
  startPayload?: string;
}

const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL;

if (!BOT_TOKEN) throw new Error('BOT_TOKEN is required');
if (!APP_URL) throw new Error('APP_URL is required');

const bot = new Telegraf<MyContext>(BOT_TOKEN);

// Rate-limiting
bot.use(rateLimit({
  window: 3000,
  limit: 1,
  onLimitExceeded: (ctx) => ctx.reply('Too many requests')
}));

// Обработчик команды /start
bot.start(async (ctx) => {
  try {
    const user = ctx.from;
    if (!user) throw new Error('User data not available');

    // Формируем initData
    const initData = new URLSearchParams();
    initData.append('auth_date', Math.floor(Date.now() / 1000).toString());
    initData.append('user', JSON.stringify({
      id: user.id,
      first_name: user.first_name,
      username: user.username,
      language_code: user.language_code,
    }));
    initData.append('hash', 'mock_signature_for_development');

    // Формируем URL с учетом startPayload
    const webAppUrl = new URL(APP_URL);
    webAppUrl.searchParams.set('initData', initData.toString());
    
    // Добавляем startPayload если есть
    const payload = ctx.message?.text.split(' ')[1]; // Получаем payload из /start <payload>
    if (payload) {
      webAppUrl.searchParams.set('startPayload', payload);
    }

    await ctx.reply('Welcome!', {
      reply_markup: {
        inline_keyboard: [[{
          text: 'Launch App',
          web_app: { url: webAppUrl.toString() }
        }]]
      }
    });

  } catch (error) {
    console.error('Start command error:', error);
    await ctx.reply('Error occurred. Please try later.');
  }
});

// Graceful shutdown
const shutdown = (signal: NodeJS.Signals) => {
  console.log(`Shutting down (${signal})`);
  bot.stop(signal);
  process.exit(0);
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

// Запуск
bot.launch()
  .then(() => console.log('Bot started on @' + bot.botInfo?.username))
  .catch((err) => {
    console.error('Bot start failed:', err);
    process.exit(1);
  });

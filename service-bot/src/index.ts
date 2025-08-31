import { Telegraf } from 'telegraf';
import rateLimit from 'telegraf-ratelimit';
import dotenv from 'dotenv';
import { getMessage, type Locale } from './locales/index.js';
import { ServiceBotContext } from './types/index.js';
import { AdminService } from './services/admin.service.js';
import { UsersService } from './services/users.service.js';
import { StatsService } from './services/stats.service.js';
import { AdminHandlers } from './handlers/admin.handlers.js';

// Загружаем переменные окружения
dotenv.config();

// Конфигурация
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) throw new Error('BOT_TOKEN is required');

const bot = new Telegraf<ServiceBotContext>(BOT_TOKEN);

// Создаем сервисы
const adminService = new AdminService();
const usersService = new UsersService();
const statsService = new StatsService();
const adminHandlers = new AdminHandlers(adminService, usersService, statsService);

// Rate-limiting
bot.use(
  rateLimit({
    window: 3000,
    limit: 1,
    onLimitExceeded: (ctx: any) => ctx.reply(getMessage('ru', 'errors.tooManyRequests')),
  })
);

// Middleware для определения языка и проверки админа
bot.use(async (ctx, next) => {
  const user = ctx.from;
  if (user) {
    // Всегда используем русский язык
    ctx.locale = 'ru';
    
    // Проверяем авторизацию админа
    const telegramId = user.id.toString();
    ctx.isAdmin = adminHandlers.isAdminAuthenticated(telegramId);
  }
  await next();
});

// Базовые команды
bot.start(async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  const welcomeMessage = getMessage('ru', 'welcome', user.first_name, ctx.isAdmin);

  await ctx.reply(welcomeMessage);
});

bot.help(async (ctx) => {
  const helpText = getMessage('ru', 'help.title') + 
    getMessage('ru', 'help.common').join('\n');
  
  await ctx.reply(helpText);
});

// Админ команды
bot.command('admin_menu', (ctx) => adminHandlers.handleAdminMenuCommand(ctx));

// Обработка callback'ов
bot.action(/admin_(.+)/, async (ctx) => {
  const callbackData = ctx.match?.[1];
  
  if (!callbackData) {
    await ctx.answerCbQuery();
    return;
  }
  
  if (callbackData === 'menu') {
    await adminHandlers.showAdminMenu(ctx);
  } else if (callbackData === 'stats') {
    await adminHandlers.showStats(ctx);
  } else if (callbackData.startsWith('users_')) {
    const parts = callbackData.split('_');
    const pageStr = parts[1];
    if (pageStr) {
      const page = parseInt(pageStr);
      if (!isNaN(page)) {
        await adminHandlers.showUsers(ctx, page);
      }
    }
  } else if (callbackData.startsWith('user_')) {
    const parts = callbackData.split('_');
    const telegramId = parts[1];
    if (telegramId) {
      await adminHandlers.showUserInfo(ctx, telegramId);
    }
  } else if (callbackData === 'search') {
    // TODO: Реализовать поиск
    await ctx.reply('🔍 Функция поиска будет добавлена позже');
  } else if (callbackData.startsWith('add_balance_')) {
    const parts = callbackData.split('_');
    const telegramId = parts[2];
    if (telegramId) {
      await adminHandlers.handleAddBalance(ctx, telegramId);
    }
  } else if (callbackData.startsWith('remove_balance_')) {
    const parts = callbackData.split('_');
    const telegramId = parts[2];
    if (telegramId) {
      await adminHandlers.handleRemoveBalance(ctx, telegramId);
    }
  }
  
  await ctx.answerCbQuery();
});

// Обработка текстовых сообщений для паролей
bot.hears(/.*/, async (ctx) => {
  await adminHandlers.handlePasswordInput(ctx);
});

// Graceful shutdown
const shutdown = (signal: NodeJS.Signals) => {
  console.log(`Shutting down service bot (${signal})`);
  bot.stop(signal);
  process.exit(0);
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

// Запуск
bot
  .launch()
  .then(() => console.log('Service bot started on @' + bot.botInfo?.username))
  .catch((err) => {
    console.error('Service bot start failed:', err);
    process.exit(1);
  }); 
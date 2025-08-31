import { ServiceBotContext } from '../types/index.js';
import { AdminService } from '../services/admin.service.js';
import { UsersService, type User } from '../services/users.service.js';
import { StatsService, type StatsResponse } from '../services/stats.service.js';
import { getMessage } from '../locales/index.js';

export class AdminHandlers {
  constructor(
    private adminService: AdminService,
    private usersService: UsersService,
    private statsService: StatsService
  ) {}

  // Обработка команды /admin_menu
  async handleAdminMenuCommand(ctx: ServiceBotContext) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const locale = ctx.locale || 'ru';
    
    // Проверяем, есть ли пользователь в списке админов
    if (!this.adminService.isInAdminList(telegramId)) {
      await ctx.reply(getMessage(locale, 'admin.notInAdminList'));
      return;
    }

    // Проверяем, авторизован ли уже
    if (this.adminService.isAuthenticated(telegramId)) {
      await this.showAdminMenu(ctx);
      return;
    }

    // Проверяем, есть ли пароль
    const hasPassword = await this.adminService.hasPassword(telegramId);
    
    if (!hasPassword) {
      // Первый вход - создаем пароль
      this.adminService.setLoginState(telegramId, {
        telegramId,
        awaitingPassword: false,
        awaitingNewPassword: true
      });
      
      await ctx.reply(getMessage(locale, 'admin.firstTimeAdmin'));
    } else {
      // Есть пароль - вводим
      this.adminService.setLoginState(telegramId, {
        telegramId,
        awaitingPassword: true,
        awaitingNewPassword: false
      });
      
      await ctx.reply(getMessage(locale, 'admin.enterPassword'));
    }
  }

  // Обработка ввода пароля
  async handlePasswordInput(ctx: ServiceBotContext) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const locale = ctx.locale || 'ru';
    const loginState = this.adminService.getLoginState(telegramId);
    
    if (!loginState) return;

    if (!ctx.message || !('text' in ctx.message)) return;
    const password = ctx.message.text;
    if (!password) return;

    // Проверяем формат пароля
    if (!this.adminService.validatePassword(password)) {
      await ctx.reply(getMessage(locale, 'errors.invalidPassword'));
      return;
    }

    if (loginState.awaitingNewPassword) {
      // Создаем новый пароль
      const success = await this.adminService.createPassword(telegramId, password);
      
      if (success) {
        // Авторизуем сразу после создания пароля
        this.adminService.setSession(telegramId, {
          telegramId,
          isAuthenticated: true,
          loginAttempts: 0,
          lastAttemptTime: Date.now()
        });
        
        this.adminService.clearLoginState(telegramId);
        await ctx.reply(getMessage(locale, 'success.passwordCreated'));
        await this.showAdminMenu(ctx);
      } else {
        await ctx.reply(getMessage(locale, 'errors.serverError'));
        this.adminService.clearLoginState(telegramId);
      }
    } else if (loginState.awaitingPassword) {
      // Проверяем существующий пароль
      const isValid = await this.adminService.verifyPassword(telegramId, password);
      
      if (isValid) {
        // Успешная авторизация
        this.adminService.setSession(telegramId, {
          telegramId,
          isAuthenticated: true,
          loginAttempts: 0,
          lastAttemptTime: Date.now()
        });
        
        this.adminService.clearLoginState(telegramId);
        await ctx.reply(getMessage(locale, 'success.loginSuccess'));
        await this.showAdminMenu(ctx);
      } else {
        // Неверный пароль
        await ctx.reply(getMessage(locale, 'admin.wrongPassword'));
        this.adminService.clearLoginState(telegramId);
      }
    }
  }

  // Показать админ-меню
  async showAdminMenu(ctx: ServiceBotContext) {
    const locale = ctx.locale || 'ru';
    
    await ctx.reply(getMessage(locale, 'admin.menu'), {
      reply_markup: {
        inline_keyboard: [
          [
            { text: getMessage(locale, 'admin.users'), callback_data: 'admin_users_1' },
            { text: getMessage(locale, 'admin.stats'), callback_data: 'admin_stats' }
          ]
        ]
      }
    });
  }

  // Показать список пользователей
  async showUsers(ctx: ServiceBotContext, page: number = 1) {
    const locale = ctx.locale || 'ru';
    
    try {
      const response = await this.usersService.getUsers(page, 10);
      const { users, total, page: currentPage } = response;
      
      if (users.length === 0) {
        await ctx.reply(getMessage(locale, 'admin.noUsers'), {
          reply_markup: {
            inline_keyboard: [
              [{ text: getMessage(locale, 'admin.back'), callback_data: 'admin_menu' }]
            ]
          }
        });
        return;
      }

      const totalPages = Math.ceil(total / 10);
      const keyboard = [];
      
      // Кнопки пользователей
      for (const user of users) {
        const displayName = user.username ? this.escapeMarkdown(user.username) : user.telegramId;
        keyboard.push([{
          text: `${displayName} (${user.balance} USDT)`,
          callback_data: `admin_user_${user.telegramId}`
        }]);
      }
      
      // Навигация
      const navRow = [];
      if (currentPage > 1) {
        navRow.push({ text: getMessage(locale, 'admin.prev'), callback_data: `admin_users_${currentPage - 1}` });
      }
      if (currentPage < totalPages) {
        navRow.push({ text: getMessage(locale, 'admin.next'), callback_data: `admin_users_${currentPage + 1}` });
      }
      if (navRow.length > 0) {
        keyboard.push(navRow);
      }
      
      // Кнопки поиска и назад
      keyboard.push([
        { text: getMessage(locale, 'admin.search'), callback_data: 'admin_search' },
        { text: getMessage(locale, 'admin.back'), callback_data: 'admin_menu' }
      ]);

      const message = `${getMessage(locale, 'admin.totalUsers')} ${total}\n${getMessage(locale, 'admin.showingUsers')} ${(currentPage - 1) * 10 + 1}-${Math.min(currentPage * 10, total)}`;
      
      await ctx.reply(message, {
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (error) {
      console.error('Show users error:', error);
      await ctx.reply(getMessage(locale, 'errors.serverError'));
    }
  }

  // Функция для экранирования Markdown
  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  // Показать информацию о пользователе
  async showUserInfo(ctx: ServiceBotContext, telegramId: string) {
    const locale = ctx.locale || 'ru';
    
    try {
      const user = await this.usersService.getUserById(telegramId);
      
      const message = `👤 **Информация о пользователе**\n\n` +
        `🆔 ID: \`${user.telegramId}\`\n` +
        `📝 Username: ${user.username ? '@' + this.escapeMarkdown(user.username) : 'Не указан'}\n` +
        `💰 Баланс: ${user.balance} USDT\n` +
        `🎁 Реферальный баланс: ${user.refBalance} USDT\n` +
        `📊 Реферальный бонус: ${user.refBonus}%\n` +
        `💳 Общие депозиты: ${user.totalDeposit} USDT\n` +
        `🔗 Кошелек: ${user.walletAddress ? this.escapeMarkdown(user.walletAddress) : 'Не указан'}`;
      
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: getMessage(locale, 'admin.addBalance'), callback_data: `admin_add_balance_${telegramId}` },
              { text: getMessage(locale, 'admin.removeBalance'), callback_data: `admin_remove_balance_${telegramId}` }
            ],
            [{ text: getMessage(locale, 'admin.back'), callback_data: 'admin_users_1' }]
          ]
        }
      });
    } catch (error) {
      console.error('Show user info error:', error);
      await ctx.reply(getMessage(locale, 'admin.userNotFound'), {
        reply_markup: {
          inline_keyboard: [
            [{ text: getMessage(locale, 'admin.back'), callback_data: 'admin_users_1' }]
          ]
        }
      });
    }
  }

  // Показать статистику
  async showStats(ctx: ServiceBotContext) {
    const locale = ctx.locale || 'ru';
    
    try {
      const stats = await this.statsService.getStats();
      
      const message = `📊 **Статистика**\n\n` +
        `📅 **${getMessage(locale, 'admin.period.day')}**\n` +
        `💰 Вводы: ${stats.day.deposits} USDT\n` +
        `💸 Выводы: ${stats.day.withdrawals} USDT\n` +
        `📈 Прибыль: ${stats.day.profit} USDT\n` +
        `🎮 Игр: ${stats.day.gamesCount}\n\n` +
        `📅 **${getMessage(locale, 'admin.period.week')}**\n` +
        `💰 Вводы: ${stats.week.deposits} USDT\n` +
        `💸 Выводы: ${stats.week.withdrawals} USDT\n` +
        `📈 Прибыль: ${stats.week.profit} USDT\n` +
        `🎮 Игр: ${stats.week.gamesCount}\n\n` +
        `📅 **${getMessage(locale, 'admin.period.month')}**\n` +
        `💰 Вводы: ${stats.month.deposits} USDT\n` +
        `💸 Выводы: ${stats.month.withdrawals} USDT\n` +
        `📈 Прибыль: ${stats.month.profit} USDT\n` +
        `🎮 Игр: ${stats.month.gamesCount}\n\n` +
        `📅 **${getMessage(locale, 'admin.period.total')}**\n` +
        `💰 Вводы: ${stats.total.deposits} USDT\n` +
        `💸 Выводы: ${stats.total.withdrawals} USDT\n` +
        `📈 Прибыль: ${stats.total.profit} USDT\n` +
        `🎮 Игр: ${stats.total.gamesCount}`;
      
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: getMessage(locale, 'admin.back'), callback_data: 'admin_menu' }]
          ]
        }
      });
    } catch (error) {
      console.error('Show stats error:', error);
      await ctx.reply(getMessage(locale, 'errors.serverError'), {
        reply_markup: {
          inline_keyboard: [
            [{ text: getMessage(locale, 'admin.back'), callback_data: 'admin_menu' }]
          ]
        }
      });
    }
  }

  // Проверка авторизации админа
  isAdminAuthenticated(telegramId: string): boolean {
    return this.adminService.isAuthenticated(telegramId);
  }
}

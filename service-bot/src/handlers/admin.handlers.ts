import { Context } from "telegraf";
import { AdminService } from "../services/admin.service";
import { getMessage } from "../locales/index.js";
import { ServiceBotContext } from "../types/index.js";

export class AdminHandlers {
    constructor(private adminService: AdminService) {}

    async handleAdminLogin(ctx: Context & ServiceBotContext) {
        const telegramId = ctx.from?.id.toString()
        if (!telegramId) return;

        const locale = ctx.locale || 'ru';
        const isInAdminList = await this.adminService.isAdmin(telegramId);

        if (!isInAdminList) {
            ctx.reply(getMessage(locale, 'errors.accessDenied'));
            return;
        }

        const session = this.adminService.getSession(telegramId);
        if (session?.isAuthenticated) {
            ctx.reply(getMessage(locale, 'errors.alreadyLoggedIn'));
            return;
        }

        this.adminService.setLoginState(telegramId, {
            telegramId,
            awaitingPassword: true,
            awaitingNewPassword: false,
        });

        ctx.reply(getMessage(locale, 'admin.enterPassword'));
    }

    async handlePasswordInput(ctx: ServiceBotContext) {
        const telegramId = ctx.from?.id.toString();
        if (!telegramId) return;

        const locale = ctx.locale || 'ru';
        const loginState = this.adminService.getLoginState(telegramId);

        if(!loginState?.awaitingPassword) return;
        
        const password = ctx.message?.text;
        if (!password) return;

        const isValid = await this.adminService.verifyAdmin(telegramId, password);

        if (isValid) {
            this.adminService.setSession(telegramId, {
                telegramId,
                isAuthenticated: true,
                loginAttempts: 0,
                lastAttemptTime: Date.now()
            });

            this.adminService.clearLoginState(telegramId);
            await ctx.reply(getMessage(locale, 'admin.loginSuccess'));
        } else {
            await ctx.reply(getMessage(locale, 'admin.wrongPassword'));
            this.adminService.clearLoginState(telegramId);
        }
    }
    isAdminAuthenticated(telegramId: string): boolean {
        const session = this.adminService.getSession(telegramId);
        return session?.isAuthenticated || false;
    }
}

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class TelegramService {
  private readonly botToken: string;
  private readonly telegramApiUrl: string;

  constructor() {
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      throw new InternalServerErrorException('BOT_TOKEN is not defined in .env');
    }
    this.botToken = botToken;
    this.telegramApiUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    try {
      await axios.post(`${this.telegramApiUrl}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown', // Опционально: для форматирования
      });
    } catch (error) {
      console.error('Failed to send Telegram message:', error.response?.data || error.message);
      throw new InternalServerErrorException('Failed to send Telegram message');
    }
  }
}

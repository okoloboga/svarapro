import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: 'https://svarapro.com', // Указываем точный origin
  },
})
export class TransactionGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TransactionGateway.name);

  // Отправка уведомления о подтверждении транзакции
  notifyTransactionConfirmed(userId: string, balance: number, amount: number, currency: string) {
    this.logger.log(`Notifying user ${userId}: balance=${balance}, amount=${amount}, currency=${currency}`);
    this.server.to(userId).emit('transactionConfirmed', {
      balance: balance.toFixed(2),
      amount,
      currency,
      message: `+ ${amount} ${currency}`,
    });
  }

  // Подключение клиента
  @SubscribeMessage('join')
  handleJoin(client: any, userId: string) {
    client.join(userId); // Логируем только в debug-режиме
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`Client joined: userId=${userId}`);
    }
  }
}

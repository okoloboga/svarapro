import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // Замените на ваш фронтенд URL в продакшене, например, 'https://svarapro.com'
  },
})
export class TransactionGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TransactionGateway.name);

  // Отправка уведомления о подтверждении транзакции
  notifyTransactionConfirmed(userId: string, balance: number, amount: number, currency: string) {
    this.logger.log(`Notifying user ${userId} of transaction confirmation: balance=${balance}, amount=${amount}, currency=${currency}`);
    this.server.to(userId).emit('transactionConfirmed', {
      balance: balance.toFixed(2),
      amount,
      currency,
      message: `Transaction of ${amount} ${currency} confirmed successfully`,
    });
  }

  // Подключение клиента
  @SubscribeMessage('join')
  handleJoin(client: any, userId: string) {
    this.logger.log(`Client joined: userId=${userId}`);
    client.join(userId); // Присоединяем клиента к комнате с его userId
  }
}

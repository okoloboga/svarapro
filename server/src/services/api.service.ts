import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import axios from 'axios';
import { createHmac } from 'crypto';
import axiosRetry from 'axios-retry';

interface ExnodeCreateTransactionResponse {
  status: string;
  tracker_id: string;
  token_name?: string;
  refer?: string;
  alter_refer?: string;
  description?: string | null;
  dest_tag?: string | null;
  extra_info?: Record<string, any> | null;
}

interface ExnodeTransactionStatusResponse {
  status: string;
  transaction: {
    amount?: number;
    status: string;
    hash?: string;
    client_transaction_id?: string;
    token?: string;
    amount_usd?: number;
    invoice_amount_usd?: number;
    transaction_commission?: number;
    transaction_description?: string | null;
    type?: string;
    receiver?: string;
    callback_url?: string | null;
    dest_tag?: string | null;
    extra_info?: Record<string, any> | null;
    date_create?: string;
    date_update?: string;
    token_major_name?: string;
    course?: number;
  };
}

@Injectable()
export class ApiService {
  // Старый эквайринг Exnode (закомментирован для возможности восстановления)
  // private readonly baseUrl = 'https://my.exnode.io';
  // private readonly apiPublic = process.env.EXNODE_API_PUBLIC;
  
  // Новый эквайринг Alfabit
  private readonly baseUrl = process.env.ALFABIT_BASE_URL || 'https://pay.alfabit.org';
  private readonly apiKey = process.env.ALFABIT_API_KEY;
  private readonly callBackUrl =
    'https://svarapro.com/api/v1/finances/callback';
  private readonly supportedTokens = ['USDTTON', 'TON'];
  private readonly logger = new Logger(ApiService.name);

  constructor() {
    if (!this.apiKey) {
      throw new BadRequestException(
        'ALFABIT_API_KEY is not defined in environment variables',
      );
    }
    axiosRetry(axios, {
      retries: 3,
      retryDelay: (retryCount) => retryCount * 1000,
    });
  }

  private getApiKey(): string {
    if (!this.apiKey) {
      throw new BadRequestException('ALFABIT_API_KEY is not defined');
    }
    return this.apiKey;
  }

  async createDepositAddress(
    token: string,
    clientTransactionId: string,
  ): Promise<{ address: string; trackerId: string; destTag?: string | null }> {
    if (!this.supportedTokens.includes(token)) {
      this.logger.error(`Unsupported token: ${token}`);
      throw new BadRequestException(`Unsupported token: ${token}`);
    }
    if (
      !clientTransactionId.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
    ) {
      this.logger.error(`Invalid clientTransactionId: ${clientTransactionId}`);
      throw new BadRequestException(
        `Invalid clientTransactionId: ${clientTransactionId}`,
      );
    }

    // Старый эквайринг Exnode (закомментирован для возможности восстановления)
    /*
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      token,
      client_transaction_id: clientTransactionId,
      address_type: 'SINGLE',
      call_back_url: this.callBackUrl,
    });

    const signature = createHmac('sha512', this.getApiSecret())
      .update(timestamp + body)
      .digest('hex');

    this.logger.debug(
      `Creating deposit address: token=${token}, clientTransactionId=${clientTransactionId}`,
    );
    this.logger.debug(
      `Request headers: ApiPublic=${this.apiPublic}, Timestamp=${timestamp}, Signature=${signature}`,
    );
    this.logger.debug(`Request body: ${body}`);

    try {
      const response = await axios.post<ExnodeCreateTransactionResponse>(
        `${this.baseUrl}/api/transaction/create/in`,
        body,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ApiPublic: this.apiPublic!,
            Signature: signature,
            Timestamp: timestamp,
          },
          timeout: 10000,
        },
      );

      if (response.data.status !== 'ACCEPTED') {
        this.logger.error(
          `Failed to create deposit address: ${response.data.status}, response: ${JSON.stringify(response.data)}`,
        );
        throw new BadRequestException(
          `Failed to create deposit address: ${response.data.status}`,
        );
      }

      this.logger.log(
        `Deposit address created: ${response.data.refer}, trackerId: ${response.data.tracker_id}`,
      );
      return {
        address: response.data.refer!,
        trackerId: response.data.tracker_id,
        destTag: response.data.dest_tag || null,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Exnode API error (createDepositAddress): ${error.message}, response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new BadRequestException(`Exnode API error: ${error.message}`);
      } else {
        this.logger.error(
          `Exnode API error (createDepositAddress): ${String(error)}`,
        );
        throw new BadRequestException(`Exnode API error: ${String(error)}`);
      }
    }
    */

    // Новый эквайринг Alfabit
    const requestBody = {
      currencyInCode: token,
      invoiceAssetCode: 'USDT',
      comment: `Deposit for transaction ${clientTransactionId}`,
      publicComment: `Deposit ${clientTransactionId}`,
      callbackUrl: this.callBackUrl,
      isAwaitRequisites: true,
      expiryDurationMinutes: 60,
    };

    this.logger.debug(
      `Creating deposit invoice: token=${token}, clientTransactionId=${clientTransactionId}`,
    );
    this.logger.debug(`Request body: ${JSON.stringify(requestBody)}`);

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/integration/orders/invoice`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.getApiKey(),
          },
          timeout: 10000,
        },
      );

      if (response.data.message !== 'ok') {
        this.logger.error(
          `Failed to create deposit invoice: ${response.data.message}`,
        );
        throw new BadRequestException(
          `Failed to create deposit invoice: ${response.data.message}`,
        );
      }

      const invoiceData = response.data.data;
      this.logger.log(
        `Deposit invoice created: uid: ${invoiceData.uid}, requisites: ${invoiceData.requisites}`,
      );

      return {
        address: invoiceData.requisites,
        trackerId: invoiceData.uid,
        destTag: invoiceData.requisitesMemoTag || null,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Alfabit API error (createDepositAddress): ${error.message}, response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new BadRequestException(`Alfabit API error: ${error.message}`);
      } else {
        this.logger.error(
          `Alfabit API error (createDepositAddress): ${String(error)}`,
        );
        throw new BadRequestException(`Alfabit API error: ${String(error)}`);
      }
    }
  }

  async createWithdrawAddress(
    token: string,
    clientTransactionId: string,
    amount: number,
    receiver: string,
    destTag?: string,
  ): Promise<{ trackerId: string }> {
    if (!this.supportedTokens.includes(token)) {
      this.logger.error(`Unsupported token: ${token}`);
      throw new BadRequestException(`Unsupported token: ${token}`);
    }
    if (
      !clientTransactionId.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
    ) {
      this.logger.error(`Invalid clientTransactionId: ${clientTransactionId}`);
      throw new BadRequestException(
        `Invalid clientTransactionId: ${clientTransactionId}`,
      );
    }
    if (amount <= 0) {
      this.logger.error(`Amount must be greater than 0: ${amount}`);
      throw new BadRequestException(`Amount must be greater than 0: ${amount}`);
    }
    if (!receiver || typeof receiver !== 'string' || receiver.trim() === '') {
      this.logger.error(`Invalid receiver address: ${receiver}`);
      throw new BadRequestException(`Invalid receiver address: ${receiver}`);
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      token,
      client_transaction_id: clientTransactionId,
      amount,
      receiver,
      call_back_url: this.callBackUrl,
      ...(destTag && { dest_tag: destTag }),
      fiat_calculation: false,
    });

    const signature = createHmac('sha512', this.getApiSecret())
      .update(timestamp + body)
      .digest('hex');

    this.logger.debug(
      `Creating withdraw transaction: token=${token}, clientTransactionId=${clientTransactionId}, amount=${amount}, receiver=${receiver}`,
    );
    this.logger.debug(
      `Request headers: ApiPublic=${this.apiPublic}, Timestamp=${timestamp}, Signature=${signature}`,
    );
    this.logger.debug(`Request body: ${body}`);

    try {
      const response = await axios.post<ExnodeCreateTransactionResponse>(
        `${this.baseUrl}/api/transaction/create/out`,
        body,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ApiPublic: this.apiPublic!,
            Signature: signature,
            Timestamp: timestamp,
          },
          timeout: 10000,
        },
      );

      if (response.data.status !== 'ACCEPTED') {
        this.logger.error(
          `Failed to create withdraw transaction: ${response.data.status}, response: ${JSON.stringify(response.data)}`,
        );
        throw new BadRequestException(
          `Failed to create withdraw transaction: ${response.data.status}`,
        );
      }

      this.logger.log(
        `Withdraw transaction created: trackerId: ${response.data.tracker_id}`,
      );
      return {
        trackerId: response.data.tracker_id,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Exnode API error (createWithdrawAddress): ${error.message}, response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new BadRequestException(`Exnode API error: ${error.message}`);
      } else {
        this.logger.error(
          `Exnode API error (createWithdrawAddress): ${String(error)}`,
        );
        throw new BadRequestException(`Exnode API error: ${String(error)}`);
      }
    }
  }

  async getTransactionStatus(trackerId: string): Promise<{
    status: string;
    amount?: number;
    transactionHash?: string;
    clientTransactionId?: string;
    token?: string;
  }> {
    if (
      !trackerId ||
      typeof trackerId !== 'string' ||
      trackerId.trim() === ''
    ) {
      this.logger.error(`Invalid trackerId: ${trackerId}`);
      throw new BadRequestException(`Invalid trackerId: ${trackerId}`);
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ tracker_id: trackerId });
    const signature = createHmac('sha512', this.getApiSecret())
      .update(timestamp + body)
      .digest('hex');

    this.logger.debug(`Checking transaction status: trackerId=${trackerId}`);
    this.logger.debug(
      `Request headers: ApiPublic=${this.apiPublic}, Timestamp=${timestamp}, Signature=${signature}`,
    );
    this.logger.debug(`Request body: ${body}`);

    try {
      const response = await axios.post<ExnodeTransactionStatusResponse>(
        `${this.baseUrl}/api/transaction/get`,
        body,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ApiPublic: this.apiPublic!,
            Signature: signature,
            Timestamp: timestamp,
          },
          timeout: 10000,
        },
      );

      if (response.data.status !== 'ok') {
        this.logger.error(
          `Failed to get transaction status: ${response.data.status}, response: ${JSON.stringify(response.data)}`,
        );
        throw new BadRequestException(
          `Failed to get transaction status: ${response.data.status}`,
        );
      }

      // Добавляем логирование clientTransactionId
      this.logger.debug(
        `Transaction status response: clientTransactionId=${response.data.transaction.client_transaction_id}, status=${response.data.transaction.status}`,
      );

      this.logger.log(
        `Transaction status retrieved: trackerId: ${trackerId}, status: ${response.data.transaction.status}`,
      );
      return {
        status: response.data.transaction.status,
        amount: response.data.transaction.amount,
        transactionHash: response.data.transaction.hash,
        clientTransactionId: response.data.transaction.client_transaction_id,
        token: response.data.transaction.token,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Exnode API error (getTransactionStatus): ${error.message}, response: ${JSON.stringify(error.response?.data)}`,
        );
        throw new BadRequestException(`Exnode API error: ${error.message}`);
      } else {
        this.logger.error(
          `Exnode API error (getTransactionStatus): ${String(error)}`,
        );
        throw new BadRequestException(`Exnode API error: ${String(error)}`);
      }
    }
  }
}

import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { createHmac } from 'crypto';

interface ExnodeCreateDepositResponse {
  refer: string;
  tracker_id: string;
}

interface ExnodeTransactionStatusResponse {
  status: string;
  amount?: number;
  transaction_hash?: string;
}

@Injectable()
export class ApiService {
  private readonly baseUrl = 'https://my.exnode.io';
  private readonly apiPublic = process.env.EXNODE_API_PUBLIC;
  private readonly callBackUrl = 'https://svarapro.com/api/finances/callback';

  constructor() {
    if (!process.env.EXNODE_API_SECRET || !this.apiPublic) {
      throw new BadRequestException(
        'EXNODE_API_SECRET or EXNODE_API_PUBLIC is not defined in environment variables',
      );
    }
  }

  private getApiSecret(): string {
    const secret = process.env.EXNODE_API_SECRET;
    if (!secret) {
      throw new BadRequestException('EXNODE_API_SECRET is not defined');
    }
    return secret;
  }

  async createDepositAddress(
    token: string,
    clientTransactionId: string,
  ): Promise<{ address: string; trackerId: string }> {
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

    const response = await axios.post<ExnodeCreateDepositResponse>(
      `${this.baseUrl}/api/transaction/create/in`,
      body,
      {
        headers: {
          ApiPublic: this.apiPublic!,
          Signature: signature,
          Timestamp: timestamp,
        },
      },
    );

    return {
      address: response.data.refer,
      trackerId: response.data.tracker_id,
    };
  }

  async getTransactionStatus(trackerId: string): Promise<{
    status: string;
    amount?: number;
    transaction_hash?: string | undefined;
  }> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha512', this.getApiSecret())
      .update(timestamp + trackerId)
      .digest('hex');

    const response = await axios.get<ExnodeTransactionStatusResponse>(
      `${this.baseUrl}/transaction/get?tracker_id=${trackerId}`,
      {
        headers: {
          ApiPublic: this.apiPublic!,
          Signature: signature,
          Timestamp: timestamp,
        },
      },
    );

    return {
      status: response.data.status,
      amount: response.data.amount,
      transaction_hash: response.data.transaction_hash,
    };
  }
}

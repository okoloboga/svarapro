import { LaunchParams } from '@telegram-apps/sdk-react';

export interface TelegramUser {
  id: number;
  first_name?: string;
  username?: string;
  photo_url?: string;
  added_to_attachment_menu?: boolean;
  allows_write_to_pm?: boolean;
}

export interface TelegramInitData {
  auth_date: number;
  hash: string;
  user?: TelegramUser;
  query_id?: string;
  receiver?: TelegramUser;
  chat?: unknown;
  start_param?: string;
  can_send_after?: number;
}

export interface TelegramLaunchParams extends LaunchParams {
  initData?: TelegramInitData;
  initDataRaw?: string;
}

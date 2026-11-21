import { config } from './config.js';

export function smsConfigured(): boolean {
  return config.smsProvider !== 'none';
}

export async function sendSms(to: string, body: string): Promise<void> {
  if (config.smsProvider === 'console') {
    console.log(`[sms:${config.smsFrom}] to ${to}: ${body}`);
    return;
  }
  throw new Error('SMS delivery is not configured');
}

import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { sendSms, smsConfigured } from './sms.js';

interface CustomerUpdate {
  userId: string;
  phone: string;
  title: string;
  body: string;
  sms?: string;
}

export async function notifyCustomer(client: PoolClient, update: CustomerUpdate): Promise<void> {
  await client.query(
    `INSERT INTO notifications (id, user_id, kind, title, body, time_label)
     VALUES ($1, $2, 'pickup', $3, $4, 'Just now')`,
    [`n-${randomUUID()}`, update.userId, update.title, update.body],
  );

  if (!update.sms || !smsConfigured()) return;
  try {
    await sendSms(update.phone, update.sms);
  } catch (error) {
    console.error('SMS delivery failed', error);
  }
}

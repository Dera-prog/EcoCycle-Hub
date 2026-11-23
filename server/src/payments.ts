import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';

export interface TransferInput {
  payoutId: string;
  amount: number;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

export type TransferResult = { ok: true; reference: string } | { ok: false; error: string };

export function payoutsConfigured(): boolean {
  return config.paymentsProvider !== 'none';
}

export function paymentsProvider(): string {
  return config.paymentsProvider;
}

interface PaystackResponse {
  status?: boolean;
  message?: string;
  data?: { recipient_code?: string; reference?: string };
}

async function paystack(path: string, body: unknown): Promise<PaystackResponse> {
  const response = await fetch(`${config.paystackApi}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.paystackSecret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = (await response.json().catch(() => ({}))) as PaystackResponse;
  if (!response.ok || payload.status === false) {
    return { status: false, message: payload.message ?? `Paystack responded ${response.status}` };
  }
  return payload;
}

export async function createTransfer(input: TransferInput): Promise<TransferResult> {
  if (config.paymentsProvider === 'console') {
    const reference = `console-${input.payoutId}`;
    console.log(
      `[payouts:console] ${reference} ₦${input.amount.toLocaleString('en-NG')} to ${input.bankName} ···${input.accountNumber.slice(-4)}`,
    );
    return { ok: true, reference };
  }

  if (config.paymentsProvider !== 'paystack') {
    return { ok: false, error: 'Payouts are not configured on this server.' };
  }

  const recipient = await paystack('/transferrecipient', {
    type: 'nuban',
    name: input.accountName || input.bankName,
    account_number: input.accountNumber,
    bank_code: input.bankCode,
    currency: 'NGN',
  });
  const recipientCode = recipient.data?.recipient_code;
  if (!recipientCode) {
    return { ok: false, error: recipient.message ?? 'Could not create the payout recipient.' };
  }

  const transfer = await paystack('/transfer', {
    source: 'balance',
    amount: Math.round(input.amount * 100),
    recipient: recipientCode,
    reason: `EcoCycle payout ${input.payoutId}`,
    reference: input.payoutId,
  });
  if (!transfer.status) {
    return { ok: false, error: transfer.message ?? 'Paystack rejected the transfer.' };
  }
  return { ok: true, reference: transfer.data?.reference ?? input.payoutId };
}

export function verifyPaystackSignature(secret: string, raw: Buffer, signature: string): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac('sha512', secret).update(raw).digest('hex');
  const provided = Buffer.from(signature, 'utf8');
  const digest = Buffer.from(expected, 'utf8');
  return provided.length === digest.length && timingSafeEqual(provided, digest);
}

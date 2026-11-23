export type CategoryKey =
  | 'plastic'
  | 'paper'
  | 'glass'
  | 'metal'
  | 'organic'
  | 'construction'
  | 'textile'
  | 'electronic';

export interface Category {
  key: CategoryKey;
  name: string;
  rate: number;
  bag: string;
  bagColor: string;
  color: string;
  bg: string;
  items: string[];
  tip: string;
}

export type CollectionStatus =
  | 'upcoming'
  | 'assigned'
  | 'en_route'
  | 'arrived'
  | 'completed'
  | 'cancelled';

export interface Collection {
  id: string;
  category: CategoryKey;
  company: string;
  dateLabel: string;
  time: string;
  weight: number;
  address: string;
  status: CollectionStatus;
  earning?: number;
  pickupId?: string;
  rawDate?: string;
  area?: string;
  areaName?: string;
  rate?: number;
  confirmedWeight?: number;
  agent?: { name: string; phone: string };
}

export interface ServiceArea {
  key: string;
  name: string;
  city: string;
  rates: Partial<Record<CategoryKey, number>>;
}

export interface OpsPickup {
  id: string;
  pickupId: string | null;
  status: CollectionStatus;
  category: CategoryKey;
  weight: number;
  confirmedWeight: number | null;
  rate: number | null;
  dateLabel: string;
  time: string;
  address: string;
  area: string | null;
  areaName: string | null;
  earning: number | null;
  customer: { name: string; phone: string };
  agent: { id: string; name: string; phone: string } | null;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  kind: 'pickup' | 'payment' | 'tip' | 'badge';
}

export interface Payment {
  id: string;
  company: string;
  dateLabel: string;
  weight: number | null;
  amount: number;
  status: 'Pending' | 'Processing' | 'Paid' | 'Failed';
  failureReason?: string;
  createdAt?: string;
}

export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

export interface OpsPayout {
  id: string;
  amount: number;
  status: PayoutStatus;
  provider: string;
  providerRef: string | null;
  failureReason: string | null;
  bank: { name: string; last4: string };
  customer: { id: string; name: string; phone: string };
  createdAt: string;
}

export interface PendingEarning {
  userId: string;
  name: string;
  phone: string;
  amount: number;
}

export interface BankAccount {
  name: string;
  last4: string;
  accountNumber?: string;
  bankCode?: string;
  accountName?: string;
}

export interface PickupInput {
  category: CategoryKey;
  weight: number;
  dateLabel: string;
  time: string;
  address: string;
  earning: number;
  area?: string;
}

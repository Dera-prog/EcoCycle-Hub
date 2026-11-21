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

export type CollectionStatus = 'upcoming' | 'completed' | 'cancelled';

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
  status: 'Paid' | 'Pending';
}

export interface BankAccount {
  name: string;
  last4: string;
}

export interface PickupInput {
  category: CategoryKey;
  weight: number;
  dateLabel: string;
  time: string;
  address: string;
  earning: number;
}

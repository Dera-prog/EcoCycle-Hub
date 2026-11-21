import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { categoryMap, seedCollections, seedNotifications, seedPayments } from './data';
import type { BankAccount, Collection, Notification, Payment, PickupInput } from './types';

export type Persona = 'returning' | 'new';

export interface AppUser {
  name: string;
  email: string;
  tier: string;
}

interface AppState {
  persona: Persona;
  user: AppUser;
  balance: number;
  pending: number;
  totalEarned: number;
  totalRecycled: number;
  monthKg: number;
  collections: Collection[];
  notifications: Notification[];
  payments: Payment[];
  bank: BankAccount;
}

interface AppContextValue extends AppState {
  unreadCount: number;
  isFresh: boolean;
  addPickup: (input: PickupInput) => Collection;
  cancelCollection: (id: string) => void;
  rescheduleCollection: (id: string, dateLabel: string, time: string) => void;
  withdraw: (amount: number) => void;
  markAllRead: () => void;
  updateBank: (bank: BankAccount) => void;
  signInDemo: () => void;
  signUpDemo: (name: string, email: string) => void;
  resetDemo: () => void;
}

const returningState: AppState = {
  persona: 'returning',
  user: { name: 'Amaka Obi', email: 'amaka@gmail.com', tier: 'Gold Recycler' },
  balance: 48200,
  pending: 2640,
  totalEarned: 48200,
  totalRecycled: 1240,
  monthKg: 89,
  collections: seedCollections,
  notifications: seedNotifications,
  payments: seedPayments,
  bank: { name: 'First Bank Nigeria', last4: '4721' },
};

function emptyState(name: string, email: string): AppState {
  return {
    persona: 'new',
    user: { name: name.trim() || 'New Recycler', email, tier: 'New Recycler' },
    balance: 0,
    pending: 0,
    totalEarned: 0,
    totalRecycled: 0,
    monthKg: 0,
    collections: [],
    notifications: [],
    payments: [],
    bank: { name: 'No payout account', last4: '' },
  };
}

const STORAGE_KEY = 'ecocycle-demo-v2';

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return returningState;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const persona: Persona = parsed.persona === 'new' ? 'new' : 'returning';
    const base = persona === 'new' ? emptyState('New Recycler', 'new@ecocycle.ng') : returningState;
    return { ...base, ...parsed, user: { ...base.user, ...parsed.user } };
  } catch {
    return returningState;
  }
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage can be unavailable in private mode */
    }
  }, [state]);

  const addPickup = useCallback((input: PickupInput) => {
    const id = `pc-${Math.floor(1000 + Math.random() * 9000)}`;
    const collection: Collection = {
      id,
      category: input.category,
      company: 'GreenCycle Ltd',
      dateLabel: input.dateLabel,
      time: input.time,
      weight: input.weight,
      address: input.address,
      status: 'upcoming',
      earning: input.earning,
      pickupId: `#PC-${id.split('-')[1]}`,
    };
    setState((s) => ({
      ...s,
      collections: [collection, ...s.collections],
      monthKg: s.monthKg + input.weight,
      notifications: [
        {
          id: `n-${Date.now()}`,
          kind: 'pickup',
          title: 'Pickup confirmed!',
          body: `GreenCycle Ltd arrives ${input.dateLabel.toLowerCase()} at ${input.time}.`,
          time: 'Just now',
          read: false,
        },
        ...s.notifications,
      ],
    }));
    return collection;
  }, []);

  const cancelCollection = useCallback((id: string) => {
    setState((s) => ({ ...s, collections: s.collections.filter((c) => c.id !== id) }));
  }, []);

  const rescheduleCollection = useCallback((id: string, dateLabel: string, time: string) => {
    setState((s) => ({
      ...s,
      collections: s.collections.map((c) =>
        c.id === id
          ? { ...c, dateLabel, time, status: 'upcoming' as const }
          : c,
      ),
      notifications: [
        {
          id: `n-${Date.now()}`,
          kind: 'pickup',
          title: 'Pickup rescheduled',
          body: `Your ${categoryMap[s.collections.find((c) => c.id === id)?.category ?? 'plastic'].name.toLowerCase()} pickup moved to ${dateLabel} at ${time}.`,
          time: 'Just now',
          read: false,
        },
        ...s.notifications,
      ],
    }));
  }, []);

  const withdraw = useCallback((amount: number) => {
    setState((s) => ({
      ...s,
      balance: Math.max(0, s.balance - amount),
      payments: [
        {
          id: `pay-${Date.now()}`,
          company: 'Bank withdrawal',
          dateLabel: 'Today',
          weight: null,
          amount,
          status: 'Paid',
        },
        ...s.payments,
      ],
      notifications: [
        {
          id: `n-${Date.now()}`,
          kind: 'payment',
          title: 'Withdrawal sent',
          body: `₦${amount.toLocaleString('en-NG')} is on its way to your bank.`,
          time: 'Just now',
          read: false,
        },
        ...s.notifications,
      ],
    }));
  }, []);

  const markAllRead = useCallback(() => {
    setState((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
  }, []);

  const updateBank = useCallback((bank: BankAccount) => {
    setState((s) => ({ ...s, bank }));
  }, []);

  const signInDemo = useCallback(() => {
    setState(returningState);
  }, []);

  const signUpDemo = useCallback((name: string, email: string) => {
    setState(emptyState(name, email));
  }, []);

  const resetDemo = useCallback(() => {
    setState((s) => (s.persona === 'new' ? emptyState(s.user.name, s.user.email) : returningState));
  }, []);

  const unreadCount = useMemo(
    () => state.notifications.filter((n) => !n.read).length,
    [state.notifications],
  );

  const isFresh = state.collections.length === 0 && state.payments.length === 0 && state.totalEarned === 0;

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      unreadCount,
      isFresh,
      addPickup,
      cancelCollection,
      rescheduleCollection,
      withdraw,
      markAllRead,
      updateBank,
      signInDemo,
      signUpDemo,
      resetDemo,
    }),
    [state, unreadCount, isFresh, addPickup, cancelCollection, rescheduleCollection, withdraw, markAllRead, updateBank, signInDemo, signUpDemo, resetDemo],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

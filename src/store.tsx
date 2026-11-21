import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { categoryMap, seedCollections, seedNotifications, seedPayments } from './data';
import type { BankAccount, Collection, Notification, Payment, PickupInput } from './types';

export type Persona = 'returning' | 'new';

export interface AppUser {
  name: string;
  email: string;
  phone?: string;
  role?: string;
  tier: string;
}

export interface AppState {
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

export interface ActionResult {
  ok: boolean;
  error?: string;
  needsName?: boolean;
}

export interface OtpRequestResult {
  ok: boolean;
  error?: string;
  devCode?: string;
}

interface AppContextValue extends AppState {
  unreadCount: number;
  isFresh: boolean;
  apiMode: boolean;
  addPickup: (input: PickupInput) => Promise<Collection | null>;
  cancelCollection: (id: string) => void;
  rescheduleCollection: (id: string, dateLabel: string, time: string) => void;
  withdraw: (amount: number) => Promise<ActionResult>;
  markAllRead: () => void;
  updateBank: (bank: BankAccount) => Promise<ActionResult>;
  signInDemo: (email?: string, password?: string) => Promise<ActionResult>;
  signUpDemo: (name: string, email: string, phone?: string, password?: string) => Promise<ActionResult>;
  requestOtp: (phone: string) => Promise<OtpRequestResult>;
  verifyOtp: (phone: string, code: string, name?: string) => Promise<ActionResult>;
  signOut: () => void;
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
const TOKEN_KEY = 'ecocycle-token';
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '');

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

interface ApiResult {
  ok: boolean;
  status: number;
  data: {
    token?: string;
    state?: AppState;
    collection?: Collection;
    error?: string;
    devCode?: string;
    needsName?: boolean;
  } | null;
  error?: string;
}

async function api(
  path: string,
  options: { method?: string; body?: unknown; timeout?: number } = {},
): Promise<ApiResult> {
  if (!API_URL) return { ok: false, status: 0, data: null, error: 'API disabled' };
  const token = localStorage.getItem(TOKEN_KEY);
  try {
    const res = await fetch(API_URL + path, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(options.timeout ?? 8000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, status: res.status, data, error: data?.error ?? 'Request failed.' };
    }
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null, error: 'Could not reach the EcoCycle server.' };
  }
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() =>
    API_URL ? emptyState('New Recycler', '') : loadState(),
  );
  const [apiMode, setApiMode] = useState(false);
  const [probed, setProbed] = useState(!API_URL);

  useEffect(() => {
    if (!API_URL) return;
    let cancelled = false;
    (async () => {
      const health = await api('/api/health', { timeout: 2500 });
      if (cancelled) return;
      if (!health.ok) {
        setState(loadState());
        setProbed(true);
        return;
      }
      setApiMode(true);
      setProbed(true);
      if (!localStorage.getItem(TOKEN_KEY)) return;
      const me = await api('/api/me');
      if (cancelled) return;
      if (me.ok && me.data?.state) {
        setState(me.data.state);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!probed || apiMode) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage can be unavailable in private mode */
    }
  }, [state, apiMode, probed]);

  const applyState = (result: ApiResult) => {
    if (result.data?.state) setState(result.data.state);
  };

  const addPickup = useCallback(
    async (input: PickupInput): Promise<Collection | null> => {
      if (apiMode) {
        const res = await api('/api/collections', {
          method: 'POST',
          body: {
            category: input.category,
            weight: input.weight,
            dateLabel: input.dateLabel,
            time: input.time,
            address: input.address,
          },
        });
        if (!res.ok) return null;
        applyState(res);
        return res.data?.collection ?? null;
      }

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
    },
    [apiMode],
  );

  const cancelCollection = useCallback(
    (id: string) => {
      if (apiMode) {
        void api(`/api/collections/${id}`, { method: 'DELETE' }).then(applyState);
        return;
      }
      setState((s) => ({ ...s, collections: s.collections.filter((c) => c.id !== id) }));
    },
    [apiMode],
  );

  const rescheduleCollection = useCallback(
    (id: string, dateLabel: string, time: string) => {
      if (apiMode) {
        void api(`/api/collections/${id}`, {
          method: 'PATCH',
          body: { action: 'reschedule', dateLabel, time },
        }).then(applyState);
        return;
      }
      setState((s) => ({
        ...s,
        collections: s.collections.map((c) =>
          c.id === id ? { ...c, dateLabel, time, status: 'upcoming' as const } : c,
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
    },
    [apiMode],
  );

  const withdraw = useCallback(
    async (amount: number): Promise<ActionResult> => {
      if (apiMode) {
        const res = await api('/api/wallet/withdraw', { method: 'POST', body: { amount } });
        if (!res.ok) return { ok: false, error: res.error };
        applyState(res);
        return { ok: true };
      }
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
      return { ok: true };
    },
    [apiMode],
  );

  const markAllRead = useCallback(() => {
    if (apiMode) {
      void api('/api/notifications/read-all', { method: 'POST', body: {} }).then(applyState);
      return;
    }
    setState((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
  }, [apiMode]);

  const updateBank = useCallback(
    async (bank: BankAccount): Promise<ActionResult> => {
      if (apiMode) {
        const res = await api('/api/bank-account', {
          method: 'PUT',
          body: { bankName: bank.name, last4: bank.last4 },
        });
        if (!res.ok) return { ok: false, error: res.error };
        applyState(res);
        return { ok: true };
      }
      setState((s) => ({ ...s, bank }));
      return { ok: true };
    },
    [apiMode],
  );

  const signInDemo = useCallback(
    async (email?: string, password?: string): Promise<ActionResult> => {
      if (!apiMode) {
        setState(returningState);
        return { ok: true };
      }
      const res = await api('/api/auth/signin', {
        method: 'POST',
        body: { email: email ?? 'amaka@gmail.com', password: password ?? 'demo1234' },
      });
      if (!res.ok) return { ok: false, error: res.error };
      if (res.data?.token) localStorage.setItem(TOKEN_KEY, res.data.token);
      applyState(res);
      return { ok: true };
    },
    [apiMode],
  );

  const signUpDemo = useCallback(
    async (name: string, email: string, phone?: string, password?: string): Promise<ActionResult> => {
      if (!apiMode) {
        setState(emptyState(name, email));
        return { ok: true };
      }
      const res = await api('/api/auth/signup', {
        method: 'POST',
        body: { name, email, phone: phone ?? '', password: password ?? '' },
      });
      if (!res.ok) return { ok: false, error: res.error };
      if (res.data?.token) localStorage.setItem(TOKEN_KEY, res.data.token);
      applyState(res);
      return { ok: true };
    },
    [apiMode],
  );

  const signOut = useCallback(() => {
    if (!apiMode) return;
    localStorage.removeItem(TOKEN_KEY);
    setState(emptyState('New Recycler', ''));
  }, [apiMode]);

  const requestOtp = useCallback(async (phone: string): Promise<OtpRequestResult> => {
    const res = await api('/api/auth/otp/request', { method: 'POST', body: { phone } });
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, devCode: res.data?.devCode };
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string, name?: string): Promise<ActionResult> => {
    const res = await api('/api/auth/otp/verify', {
      method: 'POST',
      body: { phone, code, ...(name ? { name } : {}) },
    });
    if (!res.ok) return { ok: false, error: res.error, needsName: res.data?.needsName };
    if (res.data?.token) localStorage.setItem(TOKEN_KEY, res.data.token);
    applyState(res);
    return { ok: true };
  }, []);

  const resetDemo = useCallback(() => {
    if (apiMode) {
      void api('/api/demo/reset', { method: 'POST', body: {} }).then(applyState);
      return;
    }
    setState((s) => (s.persona === 'new' ? emptyState(s.user.name, s.user.email) : returningState));
  }, [apiMode]);

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
      apiMode,
      addPickup,
      cancelCollection,
      rescheduleCollection,
      withdraw,
      markAllRead,
      updateBank,
      signInDemo,
      signUpDemo,
      requestOtp,
      verifyOtp,
      signOut,
      resetDemo,
    }),
    [state, unreadCount, isFresh, apiMode, addPickup, cancelCollection, rescheduleCollection, withdraw, markAllRead, updateBank, signInDemo, signUpDemo, requestOtp, verifyOtp, signOut, resetDemo],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

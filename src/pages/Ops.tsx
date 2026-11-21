import { useCallback, useEffect, useState } from 'react';
import { Banknote, ClipboardList, MapPin, Phone, RefreshCw, RotateCcw, Truck } from 'lucide-react';
import { useToast } from '../components/ui';
import { categoryMap, formatNaira } from '../data';
import { useApp } from '../store';
import type { OpsPayout, OpsPickup, PendingEarning } from '../types';

const statusLabels: Record<string, string> = {
  upcoming: 'Awaiting agent',
  assigned: 'Assigned',
  en_route: 'En route',
  arrived: 'At pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const payoutLabels: Record<string, string> = {
  pending: 'Queued',
  processing: 'Processing',
  paid: 'Paid',
  failed: 'Failed',
};

export default function Ops() {
  const { apiMode, user, loadOps, assignPickup, movePickup, confirmPayout, retryPayout, settleEarnings } = useApp();
  const { show } = useToast();
  const [pickups, setPickups] = useState<OpsPickup[]>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [payouts, setPayouts] = useState<OpsPayout[]>([]);
  const [pendingEarnings, setPendingEarnings] = useState<PendingEarning[]>([]);
  const [provider, setProvider] = useState('');
  const [agentChoice, setAgentChoice] = useState<Record<string, string>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const isStaff = user.role === 'agent' || user.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    const result = await loadOps();
    setLoading(false);
    if (!result.ok || !result.board) {
      setError(result.error ?? 'Could not load the ops board.');
      return;
    }
    setError('');
    setPickups(result.board.pickups);
    setAgents(result.board.agents);
    setPayouts(result.board.payouts);
    setPendingEarnings(result.board.pendingEarnings);
    setProvider(result.board.provider);
  }, [loadOps]);

  useEffect(() => {
    if (apiMode && isStaff) void load();
    else setLoading(false);
  }, [apiMode, isStaff, load]);

  const run = async (id: string, action: string, weight?: number) => {
    setBusy(id);
    const result = await movePickup(id, action, weight);
    setBusy(null);
    if (!result.ok) {
      show(result.error ?? 'That action did not go through.');
      return;
    }
    show('Pickup updated.');
    setWeights((w) => ({ ...w, [id]: '' }));
    await load();
  };

  const assign = async (id: string) => {
    const agentId = agentChoice[id];
    if (!agentId) {
      show('Choose an agent first.');
      return;
    }
    setBusy(id);
    const result = await assignPickup(id, agentId);
    setBusy(null);
    if (!result.ok) {
      show(result.error ?? 'Could not assign the pickup.');
      return;
    }
    show('Agent assigned.');
    await load();
  };

  const settle = async (userId: string, name: string) => {
    setBusy(userId);
    const result = await settleEarnings(userId);
    setBusy(null);
    if (!result.ok) {
      show(result.error ?? 'Could not release the earnings.');
      return;
    }
    show(`Earnings released to ${name}.`);
    await load();
  };

  const closePayout = async (id: string, outcome: 'paid' | 'failed') => {
    setBusy(id);
    const result = await confirmPayout(id, outcome);
    setBusy(null);
    if (!result.ok) {
      show(result.error ?? 'Could not close the payout.');
      return;
    }
    show(outcome === 'paid' ? 'Payout marked paid.' : 'Payout marked failed and refunded.');
    await load();
  };

  const retry = async (id: string) => {
    setBusy(id);
    const result = await retryPayout(id);
    setBusy(null);
    if (!result.ok) {
      show(result.error ?? 'Could not retry the payout.');
      return;
    }
    show('Payout retried.');
    await load();
  };

  if (!apiMode) {
    return (
      <div className="container dash">
        <header className="dash-greet">
          <h1>Ops console</h1>
          <p>The ops console is part of the live API — this build is running in demo mode.</p>
        </header>
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="container dash">
        <header className="dash-greet">
          <h1>Ops console</h1>
          <p>This area is for EcoCycle field agents and admins only.</p>
        </header>
      </div>
    );
  }

  const active = pickups.filter((p) => ['upcoming', 'assigned', 'en_route', 'arrived'].includes(p.status));
  const closed = pickups.filter((p) => ['completed', 'cancelled'].includes(p.status)).slice(0, 8);

  const card = (pickup: OpsPickup) => {
    const cat = categoryMap[pickup.category];
    return (
      <article className="card ops-card" key={pickup.id}>
        <header className="ops-card-head">
          <div>
            <strong>
              {cat.name} · {pickup.weight} kg
            </strong>
            <span>
              {pickup.pickupId ?? pickup.id.slice(0, 8)} · {pickup.dateLabel} at {pickup.time}
            </span>
          </div>
          <span className={`ops-status is-${pickup.status}`}>{statusLabels[pickup.status]}</span>
        </header>

        <div className="ops-meta">
          <span>
            <MapPin size={14} /> {pickup.address}
            {pickup.areaName ? ` · ${pickup.areaName}` : ''}
          </span>
          <span>
            <Phone size={14} /> {pickup.customer.name} · {pickup.customer.phone}
          </span>
          <span>
            <Truck size={14} /> {pickup.agent ? pickup.agent.name : 'No agent yet'}
          </span>
        </div>

        {pickup.status === 'upcoming' && user.role === 'admin' && (
          <div className="ops-actions">
            <select
              aria-label="Assign agent"
              value={agentChoice[pickup.id] ?? ''}
              onChange={(e) => setAgentChoice((c) => ({ ...c, [pickup.id]: e.target.value }))}
            >
              <option value="">Choose an agent</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.phone}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy === pickup.id}
              onClick={() => void assign(pickup.id)}
            >
              Assign
            </button>
          </div>
        )}

        {['assigned', 'en_route', 'arrived'].includes(pickup.status) && (
          <div className="ops-actions">
            {pickup.status === 'assigned' && (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy === pickup.id}
                  onClick={() => void run(pickup.id, 'en_route')}
                >
                  Start route
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={busy === pickup.id}
                  onClick={() => void run(pickup.id, 'release')}
                >
                  Release
                </button>
              </>
            )}
            {pickup.status === 'en_route' && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy === pickup.id}
                onClick={() => void run(pickup.id, 'arrived')}
              >
                Mark arrived
              </button>
            )}
            {pickup.status === 'arrived' && (
              <>
                <input
                  aria-label="Confirmed weight in kilograms"
                  inputMode="decimal"
                  placeholder={`${pickup.weight} kg`}
                  value={weights[pickup.id] ?? ''}
                  onChange={(e) => setWeights((w) => ({ ...w, [pickup.id]: e.target.value.replace(/[^\d.]/g, '') }))}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy === pickup.id}
                  onClick={() => void run(pickup.id, 'complete', Number(weights[pickup.id] || pickup.weight))}
                >
                  Confirm weight &amp; complete
                </button>
              </>
            )}
          </div>
        )}

        {pickup.status === 'completed' && pickup.earning !== null && (
          <p className="ops-earn">
            {pickup.confirmedWeight ?? pickup.weight} kg
            {pickup.confirmedWeight === null ? ' recorded' : ' confirmed'} · {formatNaira(pickup.earning)}{' '}
            pending payout
            {pickup.rate ? ` (${pickup.rate}/kg)` : ''}
          </p>
        )}
      </article>
    );
  };

  return (
    <div className="container dash">
      <header className="dash-greet ops-head">
        <div>
          <h1>Ops console</h1>
          <p>
            {user.role === 'admin' ? 'Assign pickups and audit the lifecycle.' : 'Your assigned pickups and next steps.'}
          </p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </header>

      {error && <p className="form-error">{error}</p>}

      <section className="ops-section">
        <h2>
          <ClipboardList size={17} /> Active pickups
        </h2>
        {active.length === 0 ? (
          <p className="muted">No active pickups right now.</p>
        ) : (
          <div className="ops-list">{active.map(card)}</div>
        )}
      </section>

      <section className="ops-section">
        <h2>Recently closed</h2>
        {closed.length === 0 ? (
          <p className="muted">Nothing completed yet.</p>
        ) : (
          <div className="ops-list">{closed.map(card)}</div>
        )}
      </section>

      {user.role === 'admin' && (
        <>
          {provider === 'console' && (
            <p className="ops-note">
              Console payout provider: transfers are simulated. Close each payout by hand, or set
              PAYMENTS_PROVIDER=paystack to send real transfers.
            </p>
          )}
          {provider === 'none' && (
            <p className="ops-note">Payouts are paused — no payment provider is connected to this server.</p>
          )}

          <section className="ops-section">
            <h2>
              <Banknote size={17} /> Pending earnings
            </h2>
            {pendingEarnings.length === 0 ? (
              <p className="muted">Nothing waiting to be released.</p>
            ) : (
              <div className="ops-list">
                {pendingEarnings.map((earning) => (
                  <article className="card ops-card" key={earning.userId}>
                    <header className="ops-card-head">
                      <div>
                        <strong>{earning.name}</strong>
                        <span>{earning.phone}</span>
                      </div>
                      <span className="ops-status is-pending">{formatNaira(earning.amount)} pending</span>
                    </header>
                    <div className="ops-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy === earning.userId}
                        onClick={() => void settle(earning.userId, earning.name)}
                      >
                        Release {formatNaira(earning.amount)}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="ops-section">
            <h2>Payout queue</h2>
            {payouts.length === 0 ? (
              <p className="muted">No withdrawals requested yet.</p>
            ) : (
              <div className="ops-list">
                {payouts.map((payout) => (
                  <article className="card ops-card" key={payout.id}>
                    <header className="ops-card-head">
                      <div>
                        <strong>{formatNaira(payout.amount)}</strong>
                        <span>
                          {payout.bank.name} ···· {payout.bank.last4} · {payout.customer.name}
                        </span>
                      </div>
                      <span className={`ops-status is-${payout.status}`}>{payoutLabels[payout.status]}</span>
                    </header>
                    <div className="ops-meta">
                      <span>
                        <Phone size={14} /> {payout.customer.phone}
                      </span>
                      {payout.failureReason && <span>Reason: {payout.failureReason}</span>}
                    </div>
                    <div className="ops-actions">
                      {provider === 'console' && ['pending', 'processing'].includes(payout.status) && (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busy === payout.id}
                            onClick={() => void closePayout(payout.id, 'paid')}
                          >
                            Confirm paid
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            disabled={busy === payout.id}
                            onClick={() => void closePayout(payout.id, 'failed')}
                          >
                            Mark failed
                          </button>
                        </>
                      )}
                      {payout.status === 'failed' && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={busy === payout.id}
                          onClick={() => void retry(payout.id)}
                        >
                          <RotateCcw size={14} /> Retry payout
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

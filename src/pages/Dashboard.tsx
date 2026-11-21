import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  Landmark,
  MapPin,
  Plus,
  Recycle,
  Scale,
  Sparkles,
  Wallet,
} from 'lucide-react';
import DashHeader from '../components/DashHeader';
import { Donut, LineChart } from '../components/charts';
import { CategoryIcon, EmptyState, Modal, useToast } from '../components/ui';
import { useApp } from '../store';
import { categories, categoryMap, formatNaira, monthlyEarnings, months } from '../data';
import type { Collection } from '../types';

const filters = ['All', 'Upcoming', 'Completed'] as const;
type Filter = (typeof filters)[number];

const timeSlots = ['8:00 AM', '10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '6:00 PM'];

const donutSegments = [
  { label: 'Plastic', value: 42, color: '#1565C0' },
  { label: 'Metal', value: 28, color: '#F5A623' },
  { label: 'Paper', value: 18, color: '#616161' },
  { label: 'Other', value: 12, color: '#66BB6A' },
];

function shortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const { collections, cancelCollection, rescheduleCollection, persona, user, isFresh } = useApp();
  const [filter, setFilter] = useState<Filter>('All');
  const [reschedule, setReschedule] = useState<Collection | null>(null);
  const [cancel, setCancel] = useState<Collection | null>(null);
  const [receipt, setReceipt] = useState<Collection | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('2:00 PM');
  const { show } = useToast();

  const filtered = useMemo(() => {
    if (filter === 'All') return collections;
    return collections.filter((c) =>
      filter === 'Upcoming' ? c.status === 'upcoming' : c.status === 'completed',
    );
  }, [collections, filter]);

  useEffect(() => {
    if (!reschedule) return;
    const t = new Date();
    t.setDate(t.getDate() + 1);
    setNewDate(t.toISOString().slice(0, 10));
    setNewTime(reschedule.time);
  }, [reschedule]);

  const openReceipt = (c: Collection) => setReceipt(c);

  const firstName = user.name.split(' ')[0];
  const starterRates = categories.filter((c) =>
    ['plastic', 'metal', 'electronic', 'paper'].includes(c.key),
  );

  if (isFresh) {
    return (
      <DashHeader>
        <section className="welcome-card">
          <div className="welcome-copy">
            <span className="welcome-pill">
              <Sparkles size={14} /> Welcome to EcoCycle Hub
            </span>
            <h2>
              Let’s turn your first bag into naira, {firstName} 🎉
            </h2>
            <p>
              Your account is ready. Book one free pickup and we handle the sorting, weighing and
              payment — straight to your bank within 24 hours.
            </p>
            <div className="welcome-actions">
              <Link to="/dashboard/schedule" className="btn btn-white">
                <Plus size={17} /> Schedule first pickup
              </Link>
              <Link to="/categories" className="btn btn-outline-light">
                <Recycle size={16} /> See what we collect
              </Link>
            </div>
            <div className="welcome-stats">
              <div>
                <strong>₦0</strong>
                <span>Earned so far</span>
              </div>
              <div>
                <strong>0 kg</strong>
                <span>Recycled</span>
              </div>
              <div>
                <strong>8</strong>
                <span>Ways to earn</span>
              </div>
            </div>
          </div>
          <div className="welcome-visual" aria-hidden="true">
            <span className="welcome-ring">
              <Recycle size={54} />
            </span>
            <span className="welcome-chip chip-a">
              ₦80/kg <em>Plastic</em>
            </span>
            <span className="welcome-chip chip-b">
              ₦200/kg <em>Electronic</em>
            </span>
            <span className="welcome-chip chip-c">
              Free <em>Doorstep pickup</em>
            </span>
          </div>
        </section>

        <section className="card setup-card" aria-label="Account setup">
          <header className="setup-head">
            <div>
              <h2>Set up your account</h2>
              <p>1 of 4 complete — about 3 minutes left</p>
            </div>
            <strong>25%</strong>
          </header>
          <div className="setup-bar" aria-hidden="true">
            <span style={{ width: '25%' }} />
          </div>
          <ol className="setup-list">
            <li className="is-done">
              <span className="setup-icon">
                <CheckCircle2 size={17} />
              </span>
              <div>
                <strong>Create your account</strong>
                <span>Email verified — you’re in</span>
              </div>
              <em>Done</em>
            </li>
            <li>
              <span className="setup-icon">
                <CalendarDays size={17} />
              </span>
              <div>
                <strong>Schedule your first pickup</strong>
                <span>Plastic, paper, metal and more</span>
              </div>
              <Link to="/dashboard/schedule" className="setup-cta">
                Start <ArrowRight size={14} />
              </Link>
            </li>
            <li>
              <span className="setup-icon">
                <Landmark size={17} />
              </span>
              <div>
                <strong>Link a payout account</strong>
                <span>Get paid within 24 hours of pickup</span>
              </div>
              <Link to="/dashboard/wallet" className="setup-cta">
                Add <ArrowRight size={14} />
              </Link>
            </li>
            <li className="is-locked">
              <span className="setup-icon">
                <Wallet size={17} />
              </span>
              <div>
                <strong>Get paid for your first bag</strong>
                <span>Unlocks once your pickup is verified</span>
              </div>
              <em>Locked</em>
            </li>
          </ol>
        </section>

        <section className="card starter-rates" aria-label="Today's rates">
          <header>
            <h2>What you can earn today</h2>
            <Link to="/categories">
              All 8 categories <ArrowRight size={14} />
            </Link>
          </header>
          <div className="starter-rate-grid">
            {starterRates.map((c) => (
              <article key={c.key}>
                <span className="starter-rate-dot" style={{ background: c.color }} />
                <div>
                  <strong>{c.name}</strong>
                  <span>{formatNaira(c.rate)}/kg</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="card collections-card" aria-label="My collections">
          <header className="collections-head">
            <h2>My Collections</h2>
            <Link to="/dashboard/schedule" className="btn btn-primary btn-sm">
              <Plus size={16} /> New Pickup
            </Link>
          </header>
          <div className="collection-empty">
            <span className="collection-empty-art">
              <Recycle size={30} />
            </span>
            <h3>No pickups yet — let’s fix that</h3>
            <p>
              Your first collection will appear here the moment you book it. Doorstep pickup is
              always free, with no minimum weight.
            </p>
            <Link to="/dashboard/schedule" className="btn btn-primary">
              <Plus size={16} /> Schedule a pickup
            </Link>
          </div>
        </section>
      </DashHeader>
    );
  }

  const nextPickup = collections.find((c) => c.status === 'upcoming');
  const upcomingCount = collections.filter((c) => c.status === 'upcoming').length;

  return (
    <DashHeader>
      {persona === 'returning' ? (
        <div className="overview-grid">
        <section className="card chart-card" aria-label="Monthly earnings">
          <div className="card-head">
            <h2>Monthly Earnings</h2>
            <strong className="chart-total">{formatNaira(48200)}</strong>
          </div>
          <LineChart
            values={monthlyEarnings}
            labels={months}
            max={2000}
            ticks={[0, 500, 1000, 1500, 2000]}
            formatTick={(v) => `₦${v.toLocaleString('en-NG')}`}
            height={220}
          />
        </section>

        <section className="card donut-card" aria-label="Waste breakdown">
          <h2>Breakdown</h2>
          <Donut segments={donutSegments} size={172} thickness={24} />
          <ul className="donut-legend">
            {donutSegments.map((s) => (
              <li key={s.label}>
                <span>
                  <i style={{ background: s.color }} /> {s.label}
                </span>
                <strong>{s.value}%</strong>
              </li>
            ))}
          </ul>
        </section>
        </div>
      ) : (
        <div className="overview-grid">
          <section className="card journey-card" aria-label="Your first pickup">
            <div className="card-head">
              <h2>Your First Pickup</h2>
              {nextPickup && (
                <span className="badge badge-upcoming">
                  {nextPickup.dateLabel} · {nextPickup.time}
                </span>
              )}
            </div>
            {nextPickup ? (
              <div className="journey-next">
                <CategoryIcon category={nextPickup.category} size={48} radius={15} />
                <div>
                  <strong>{categoryMap[nextPickup.category].name} Waste</strong>
                  <span>
                    {nextPickup.weight} kg · est. {formatNaira(nextPickup.earning ?? 0)}
                  </span>
                </div>
                <Link to="/track-agent" className="btn btn-soft btn-sm">
                  <MapPin size={15} /> Track agent
                </Link>
              </div>
            ) : (
              <p className="journey-empty">No upcoming pickup — book one to get started.</p>
            )}
            <ol className="journey-steps">
              <li className="is-done">
                <span>
                  <CheckCircle2 size={15} />
                </span>
                Pickup scheduled
              </li>
              <li>
                <span>2</span>
                Agent collects &amp; weighs
              </li>
              <li>
                <span>3</span>
                Earnings hit your wallet
              </li>
            </ol>
            <p className="journey-note">
              <Sparkles size={14} /> {upcomingCount} upcoming{' '}
              {upcomingCount === 1 ? 'pickup' : 'pickups'} · payouts release 24 hours after
              verification.
            </p>
            <Link to="/dashboard/schedule" className="btn btn-primary btn-sm journey-cta">
              <Plus size={15} /> Book another pickup
            </Link>
          </section>

          <section className="card mix-card" aria-label="Your waste mix">
            <h2>Your Waste Mix</h2>
            {collections.length === 0 ? (
              <p className="journey-empty">Nothing scheduled yet.</p>
            ) : (
              <ul className="mix-list">
                {[...new Set(collections.map((c) => c.category))].map((key) => {
                  const cat = categoryMap[key];
                  const items = collections.filter((c) => c.category === key);
                  const kg = items.reduce((sum, c) => sum + c.weight, 0);
                  const earn = items.reduce((sum, c) => sum + (c.earning ?? 0), 0);
                  return (
                    <li key={key}>
                      <span className="mix-dot" style={{ background: cat.color }} />
                      <div>
                        <strong>{cat.name}</strong>
                        <span>
                          {kg} kg · {items.length} {items.length === 1 ? 'pickup' : 'pickups'}
                        </span>
                      </div>
                      <em>{formatNaira(earn)}</em>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mix-total">
              <span>Estimated value</span>
              <strong>
                {formatNaira(collections.reduce((sum, c) => sum + (c.earning ?? 0), 0))}
              </strong>
            </div>
            <Link to="/dashboard/impact" className="link-btn mix-link">
              See your eco impact <ArrowRight size={14} />
            </Link>
          </section>
        </div>
      )}

      <section className="card collections-card" aria-label="My collections">
        <header className="collections-head">
          <h2>My Collections</h2>
          <div className="collections-tools">
            <div className="seg" role="group" aria-label="Filter collections">
              {filters.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={filter === f ? 'is-active' : ''}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <Link to="/dashboard/schedule" className="btn btn-primary btn-sm">
              <Plus size={16} /> New Pickup
            </Link>
          </div>
        </header>

        <div className="collection-list">
          {filtered.map((c) => {
            const cat = categoryMap[c.category];
            const upcoming = c.status === 'upcoming';
            return (
              <article className={`collection-card ${upcoming ? 'is-upcoming' : ''}`} key={c.id}>
                <div className="collection-top">
                  <CategoryIcon category={c.category} size={46} radius={14} />
                  <div className="collection-title">
                    <strong>{cat.name} Waste</strong>
                    <span>{c.company}</span>
                  </div>
                  {upcoming ? (
                    <span className="badge badge-upcoming">Upcoming</span>
                  ) : (
                    <strong className="collection-amount">{formatNaira(c.earning ?? 0)}</strong>
                  )}
                </div>

                <div className="collection-meta">
                  <span>
                    <Calendar size={14} /> {c.dateLabel} at {c.time}
                  </span>
                  <span>
                    <Scale size={14} /> {c.weight} kg
                  </span>
                  <span>
                    <MapPin size={14} /> {c.address}
                  </span>
                </div>

                {upcoming ? (
                  <div className="collection-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setReschedule(c)}>
                      Reschedule
                    </button>
                    <Link to="/track-agent" className="btn btn-soft btn-sm">
                      <MapPin size={15} /> Track Agent
                    </Link>
                    <button type="button" className="btn btn-danger-soft btn-sm" onClick={() => setCancel(c)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="collection-foot">
                    <span className="paid">
                      <CheckCircle2 size={15} /> Verified &amp; paid
                    </span>
                    <button type="button" className="link-btn" onClick={() => openReceipt(c)}>
                      View receipt
                    </button>
                  </div>
                )}
              </article>
            );
          })}

          {filtered.length === 0 && (
            <EmptyState>
              No {filter.toLowerCase()} collections yet.{' '}
              <Link to="/dashboard/schedule">Schedule a pickup</Link> to get started.
            </EmptyState>
          )}
        </div>
      </section>

      <Modal
        open={!!reschedule}
        onClose={() => setReschedule(null)}
        title="Reschedule pickup"
        subtitle={reschedule ? `${categoryMap[reschedule.category].name} waste · ${reschedule.company}` : ''}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setReschedule(null)}>
              Keep current
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!reschedule || !newDate) return;
                rescheduleCollection(reschedule.id, shortDate(newDate), newTime);
                setReschedule(null);
                show('Pickup rescheduled successfully.');
              }}
            >
              Save new slot
            </button>
          </>
        }
      >
        <div className="modal-form">
          <label className="field">
            <span>New date</span>
            <div className="input-wrap">
              <Calendar size={17} />
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
          </label>
          <div className="field">
            <span>Time slot</span>
            <div className="slot-grid">
              {timeSlots.map((t) => (
                <button
                  type="button"
                  key={t}
                  className={`slot ${newTime === t ? 'is-active' : ''}`}
                  aria-pressed={newTime === t}
                  onClick={() => setNewTime(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!cancel}
        onClose={() => setCancel(null)}
        title="Cancel this pickup?"
        subtitle={cancel ? `${categoryMap[cancel.category].name} waste on ${cancel.dateLabel} at ${cancel.time}` : ''}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setCancel(null)}>
              Keep pickup
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (!cancel) return;
                cancelCollection(cancel.id);
                setCancel(null);
                show('Pickup cancelled. You can schedule another anytime.');
              }}
            >
              Yes, cancel
            </button>
          </>
        }
      >
        <p className="modal-copy">
          The agent will be notified and this slot will be released. Cancelling more than 2 hours
          before pickup is always free.
        </p>
      </Modal>

      <Modal
        open={!!receipt}
        onClose={() => setReceipt(null)}
        title="Collection receipt"
        subtitle={receipt?.pickupId ?? 'Verified collection'}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setReceipt(null)}>
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setReceipt(null);
                show('Receipt sent to amaka@gmail.com.');
              }}
            >
              <Download size={16} /> Email receipt
            </button>
          </>
        }
      >
        {receipt && (
          <div className="receipt">
            <div className="receipt-hero">
              <span>Amount paid</span>
              <strong>{formatNaira(receipt.earning ?? 0)}</strong>
              <em>
                <CheckCircle2 size={14} /> Verified &amp; paid
              </em>
            </div>
            <dl className="receipt-rows">
              <div>
                <dt>Waste type</dt>
                <dd>{categoryMap[receipt.category].name}</dd>
              </div>
              <div>
                <dt>Company</dt>
                <dd>{receipt.company}</dd>
              </div>
              <div>
                <dt>Weight</dt>
                <dd>{receipt.weight} kg</dd>
              </div>
              <div>
                <dt>Rate</dt>
                <dd>{formatNaira(categoryMap[receipt.category].rate)}/kg</dd>
              </div>
              <div>
                <dt>Collected</dt>
                <dd>
                  {receipt.dateLabel} at {receipt.time}
                </dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{receipt.address}</dd>
              </div>
            </dl>
            <button type="button" className="link-btn receipt-view" onClick={() => openReceipt(receipt)}>
              <Eye size={14} /> View pickup details
            </button>
          </div>
        )}
      </Modal>
    </DashHeader>
  );
}

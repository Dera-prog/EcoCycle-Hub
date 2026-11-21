import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Bluetooth,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  MapPin,
  QrCode,
  ScanLine,
  Scale,
  Sparkles,
} from 'lucide-react';
import DashHeader from '../components/DashHeader';
import { CategoryIcon, useToast } from '../components/ui';
import { useApp } from '../store';
import { categories, categoryMap, formatNaira } from '../data';
import type { CategoryKey, Collection } from '../types';

const slots = ['8:00 AM', '10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '6:00 PM'];
const stepLabels = ['Category', 'Weight', 'Date & Time', 'Confirm'];

const addresses = ['12 Okota Road, Lagos', '4 Bode Thomas, Surulere', '18 Admiralty Way, Lekki'];

function nextDays() {
  const out: { iso: string; day: string; num: number; today: boolean }[] = [];
  const base = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push({
      iso: d.toISOString().slice(0, 10),
      day: d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase(),
      num: d.getDate(),
      today: i === 0,
    });
  }
  return out;
}

export default function Schedule() {
  const [params] = useSearchParams();
  const paramCategory = params.get('category') as CategoryKey | null;
  const initial = paramCategory && categoryMap[paramCategory] ? paramCategory : null;

  const { addPickup } = useApp();
  const { show } = useToast();
  const days = useMemo(nextDays, []);
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<CategoryKey | null>(initial);
  const [weight, setWeight] = useState('');
  const [dateISO, setDateISO] = useState(days[0].iso);
  const [time, setTime] = useState('');
  const [address, setAddress] = useState(addresses[0]);
  const [success, setSuccess] = useState<Collection | null>(null);

  const active = category ? categoryMap[category] : null;
  const numWeight = Number(weight) || 0;
  const earning = active ? Math.round(numWeight * active.rate) : 0;

  const selectedDay = days.find((d) => d.iso === dateISO);
  const dateShort = selectedDay
    ? selectedDay.today
      ? 'Today'
      : `${selectedDay.day.charAt(0)}${selectedDay.day.slice(1).toLowerCase()} ${selectedDay.num}`
    : '';
  const dateLong = new Date(`${dateISO}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const canContinue =
    (step === 1 && !!category) ||
    (step === 2 && numWeight > 0) ||
    (step === 3 && !!dateISO && !!time) ||
    step === 4;

  const reset = () => {
    setStep(1);
    setCategory(initial);
    setWeight('');
    setDateISO(days[0].iso);
    setTime('');
    setAddress(addresses[0]);
    setSuccess(null);
  };

  const confirm = () => {
    if (!category) return;
    const created = addPickup({
      category,
      weight: numWeight,
      dateLabel: dateShort,
      time,
      address,
      earning,
    });
    setSuccess(created);
    setStep(5);
    show('Pickup confirmed — your agent is assigned.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (success && active) {
    return (
      <DashHeader>
        <section className="card success-card">
          <span className="success-mark">
            <Check size={34} strokeWidth={3} />
          </span>
          <h2>Pickup scheduled!</h2>
          <p>
            {active.name} waste · {numWeight} kg — a GreenCycle Ltd agent will collect on{' '}
            <b>{dateShort}</b> at <b>{time}</b>.
          </p>

          <div className="success-summary">
            <div className="success-earn">
              <span>Estimated earnings</span>
              <strong>{formatNaira(earning)}</strong>
              <em>
                {numWeight} kg × {formatNaira(active.rate)}/kg
              </em>
            </div>
            <dl>
              <div>
                <dt>Pickup ID</dt>
                <dd>{success.pickupId}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{address}</dd>
              </div>
              <div>
                <dt>Assigned to</dt>
                <dd>GreenCycle Ltd</dd>
              </div>
            </dl>
          </div>

          <div className="success-actions">
            <Link to="/dashboard" className="btn btn-primary">
              Back to dashboard
            </Link>
            <button type="button" className="btn btn-outline" onClick={reset}>
              Schedule another
            </button>
            <Link to="/track-agent" className="btn btn-soft">
              <MapPin size={16} /> Track agent
            </Link>
          </div>
        </section>
      </DashHeader>
    );
  }

  return (
    <DashHeader>
      <section className="card wizard">
        <header className="wizard-head">
          <div>
            <h2>Schedule a Pickup</h2>
            <p>
              {stepLabels[step - 1]} — step {step} of 4
            </p>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={reset}>
            Start over
          </button>
        </header>

        <div className="wizard-progress" aria-label={`Step ${step} of 4`}>
          {stepLabels.map((label, i) => (
            <div className={`prog ${i < step ? 'is-done' : ''}`} key={label}>
              <span className="prog-bar" />
              <span className="prog-label">{label}</span>
            </div>
          ))}
        </div>

        <div className="wizard-body">
          {step === 1 && (
            <>
              <h3>Select Waste Category</h3>
              <p className="muted">Choose what you want to recycle today</p>
              <div className="cat-select-grid">
                {categories.map((c) => (
                  <button
                    type="button"
                    key={c.key}
                    className={`cat-select ${category === c.key ? 'is-selected' : ''}`}
                    aria-pressed={category === c.key}
                    onClick={() => setCategory(c.key)}
                  >
                    <CategoryIcon category={c.key} size={46} radius={14} />
                    <strong>{c.name}</strong>
                    <span style={{ color: c.color }}>{formatNaira(c.rate)}/kg</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && active && (
            <>
              <div className="weight-head">
                <CategoryIcon category={active.key} size={46} radius={14} />
                <div>
                  <h3>{active.name} — Enter Weight</h3>
                  <p className="muted">How many kilograms do you have?</p>
                </div>
              </div>

              <label className="weight-input">
                <span className="sr-only">Weight in kilograms</span>
                <input
                  value={weight}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d.]/g, '');
                    if (/^\d*\.?\d{0,2}$/.test(v)) setWeight(v);
                  }}
                  inputMode="decimal"
                  placeholder="0.0"
                  aria-label="Weight in kilograms"
                />
                <span className="weight-unit">kg</span>
              </label>

              <div className="quick-weight">
                <span>Quick select</span>
                <div>
                  {[1, 2, 5, 10, 20, 50].map((w) => (
                    <button
                      type="button"
                      key={w}
                      className={`chip ${weight === String(w) ? 'is-active' : ''}`}
                      onClick={() => setWeight(String(w))}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              <div className="weight-grid">
                <div className="earn-box">
                  <span>Estimated earnings</span>
                  <strong className={numWeight > 0 ? '' : 'is-empty'}>
                    {numWeight > 0 ? formatNaira(earning) : '₦ —'}
                  </strong>
                  <em>
                    {numWeight > 0
                      ? `${numWeight} kg × ${formatNaira(active.rate)}/kg`
                      : 'Enter a weight to see your estimate'}
                  </em>
                </div>

                <div className="scan-box">
                  <h4>
                    <ScanLine size={16} /> Scan instead
                  </h4>
                  <div className="scan-options">
                    <button type="button" className="scan-option" onClick={() => show('QR bag scanning arrives with our smart bags — coming soon.')}>
                      <QrCode size={17} />
                      <span>QR-coded bag</span>
                      <em>Soon</em>
                    </button>
                    <button type="button" className="scan-option" onClick={() => show('Smart weighing bags are coming soon.')}>
                      <Scale size={17} />
                      <span>Smart bag</span>
                      <em>Soon</em>
                    </button>
                    <button type="button" className="scan-option" onClick={() => show('Bluetooth scale pairing is coming soon.')}>
                      <Bluetooth size={17} />
                      <span>Bluetooth scale</span>
                      <em>Soon</em>
                    </button>
                  </div>
                </div>
              </div>
              <p className="weight-note">
                <Sparkles size={14} /> Final weight is confirmed by the agent on a certified scale
                at pickup.
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <h3>Choose Date &amp; Time</h3>
              <p className="muted">Select when you'd like the agent to collect</p>

              <div className="field-label">Collection date</div>
              <div className="day-strip" role="group" aria-label="Collection date">
                {days.map((d) => (
                  <button
                    type="button"
                    key={d.iso}
                    className={`day ${dateISO === d.iso ? 'is-active' : ''}`}
                    aria-pressed={dateISO === d.iso}
                    onClick={() => setDateISO(d.iso)}
                  >
                    <span>{d.day}</span>
                    <strong>{d.num}</strong>
                    <em>{d.today ? 'Today' : ''}</em>
                  </button>
                ))}
              </div>

              <div className="field-label">Time slot</div>
              <div className="slot-grid" role="group" aria-label="Time slot">
                {slots.map((s) => (
                  <button
                    type="button"
                    key={s}
                    className={`slot ${time === s ? 'is-active' : ''}`}
                    aria-pressed={time === s}
                    onClick={() => setTime(s)}
                  >
                    <span className="dot" /> {s}
                  </button>
                ))}
              </div>

              <label className="field address-field">
                <span>Pickup address</span>
                <div className="input-wrap">
                  <MapPin size={17} />
                  <select value={address} onChange={(e) => setAddress(e.target.value)}>
                    {addresses.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </label>
            </>
          )}

          {step === 4 && active && (
            <>
              <h3>Confirm Pickup</h3>
              <p className="muted">Booking summary</p>

              <div className="review-earn">
                <span>Estimated earnings</span>
                <strong>{formatNaira(earning)}</strong>
                <em>
                  {numWeight} kg × {formatNaira(active.rate)}/kg
                </em>
              </div>

              <dl className="review-rows">
                <div>
                  <dt>
                    <CategoryIcon category={active.key} size={34} radius={10} />
                    Waste type
                  </dt>
                  <dd>{active.name}</dd>
                </div>
                <div>
                  <dt>
                    <span className="row-icon"><Scale size={15} /></span>
                    Weight
                  </dt>
                  <dd>{numWeight} kg</dd>
                </div>
                <div>
                  <dt>
                    <span className="row-icon"><CalendarDays size={15} /></span>
                    Date
                  </dt>
                  <dd>{dateLong}</dd>
                </div>
                <div>
                  <dt>
                    <span className="row-icon"><Sparkles size={15} /></span>
                    Time
                  </dt>
                  <dd>{time}</dd>
                </div>
                <div>
                  <dt>
                    <span className="row-icon"><MapPin size={15} /></span>
                    Pickup address
                  </dt>
                  <dd>{address}</dd>
                </div>
                <div>
                  <dt>
                    <span className="row-icon"><CheckCircle2 size={15} /></span>
                    Assigned to
                  </dt>
                  <dd>GreenCycle Ltd</dd>
                </div>
              </dl>

              <p className="agree-note">
                <Check size={15} /> By confirming you agree to be available at the pickup address at
                the selected time.
              </p>
            </>
          )}
        </div>

        <footer className="wizard-foot">
          {step > 1 ? (
            <button type="button" className="btn btn-outline" onClick={() => setStep(step - 1)}>
              <ChevronLeft size={16} /> Back
            </button>
          ) : (
            <Link to="/dashboard" className="btn btn-outline">
              <ChevronLeft size={16} /> Exit
            </Link>
          )}

          {step < 4 ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canContinue}
              onClick={() => {
                setStep(step + 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              {step === 1 ? 'Continue to Weight' : step === 2 ? 'Continue' : 'Review'} →
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={confirm} disabled={!numWeight || !time}>
              <Check size={17} /> Confirm Pickup
            </button>
          )}
        </footer>
      </section>
    </DashHeader>
  );
}

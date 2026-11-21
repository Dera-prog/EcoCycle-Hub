import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Mail,
  MapPin,
  Phone,
  Star,
  Truck,
} from 'lucide-react';
import { useToast } from '../components/ui';
import { useApp } from '../store';

const stages = [
  { title: 'Assigned', text: 'Agent assigned to your pickup' },
  { title: 'En Route', text: 'Agent travelling to your location' },
  { title: 'Arriving', text: 'Agent is 5 minutes away' },
  { title: 'Verifying', text: 'Weight verification in progress' },
  { title: 'Completed', text: 'Pickup complete. Payment pending' },
];

export default function TrackAgent() {
  const [stage, setStage] = useState(2);
  const { show } = useToast();
  const navigate = useNavigate();
  const { collections } = useApp();
  const active = collections.find((c) => c.status === 'upcoming');
  const done = stage === 4;

  if (!active) {
    return (
      <div className="container agent-page">
        <header className="agent-header">
          <button
            type="button"
            className="agent-back"
            aria-label="Back to dashboard"
            onClick={() => navigate('/dashboard')}
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1>Track Your Agent</h1>
            <p>No active pickup right now</p>
          </div>
        </header>

        <div className="agent-empty card">
          <span className="agent-empty-art">
            <Truck size={34} />
          </span>
          <h2>Nothing to track yet</h2>
          <p>
            Once you book a pickup, your agent’s live route, ETA and contact details appear here on
            pickup day.
          </p>
          <Link to="/dashboard/schedule" className="btn btn-primary">
            Schedule a pickup
          </Link>
          <Link to="/dashboard" className="btn btn-outline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container agent-page">
      <header className="agent-header">
        <button
          type="button"
          className="agent-back"
          aria-label="Back to dashboard"
          onClick={() => navigate('/dashboard')}
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1>Track Your Agent</h1>
          <p>GreenCycle Ltd · Chukwuma O.</p>
        </div>
        <button
          type="button"
          className="agent-call"
          aria-label="Call agent"
          onClick={() => show('Calling Chukwuma on +234 803 555 0112…')}
        >
          <Phone size={18} />
        </button>
      </header>

      <section className="map-card" aria-label="Agent route map">
        <div className="map-grid" aria-hidden="true" />
        <svg viewBox="0 0 600 300" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M92 224 C 168 208, 178 138, 262 150 S 402 96, 486 118"
            fill="none"
            stroke="#2E7D32"
            strokeWidth="4"
            strokeDasharray="10 10"
            strokeLinecap="round"
          />
          <circle cx="92" cy="224" r="17" fill="#fff" stroke="#2E7D32" strokeWidth="4" />
          <circle cx="92" cy="224" r="5" fill="#2E7D32" />
        </svg>
        <span className="map-label">
          <MapPin size={13} /> Your location
        </span>
        <span className="map-marker">
          <Truck size={19} />
        </span>
        <span className="eta-chip">
          <span>ETA</span>
          <strong>{done ? 'Now' : `${stage === 2 ? 5 : 8} min`}</strong>
        </span>
      </section>

      <section className="card agent-card">
        <div className="agent-top">
          <span className="agent-avatar">C</span>
          <div className="agent-copy">
            <strong>Chukwuma Okafor</strong>
            <span>
              GreenCycle Ltd · <Star size={13} fill="#F5A623" stroke="#F5A623" /> 4.9 (312 pickups)
            </span>
            <em>
              <i className={`status-dot ${done ? 'done' : ''}`} />{' '}
              {done ? 'Collection complete' : stage >= 2 ? 'En route to you' : 'Preparing your pickup'}
            </em>
          </div>
          <div className="agent-actions">
            <button type="button" aria-label="Call" onClick={() => show('Calling Chukwuma…')}>
              <Phone size={17} />
            </button>
            <button type="button" aria-label="Message" onClick={() => show('Message thread opened.')}>
              <Mail size={17} />
            </button>
          </div>
        </div>

        <div className="agent-details">
          {[
            ['Waste Type', 'Plastic'],
            ['Weight', '4.5 kg'],
            ['Est. Earn', '₦360'],
            ['Time Slot', '2:00 PM'],
            ['Address', '12 Okota Rd'],
            ['Pickup ID', '#PC-8821'],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card progress-card">
        <header>
          <h2>Pickup Progress</h2>
          <span>Step {stage + 1} of 5</span>
        </header>
        <ol className="timeline">
          {stages.map((s, i) => {
            const state = i < stage ? 'done' : i === stage ? 'current' : 'todo';
            return (
              <li className={state} key={s.title}>
                <span className="tl-dot">
                  {state === 'done' ? <Check size={14} strokeWidth={3} /> : i === 4 ? <Check size={13} /> : <i />}
                </span>
                <div className="tl-copy">
                  <strong>{s.title}</strong>
                  <span>{s.text}</span>
                  {state === 'current' && !done && <em>In progress…</em>}
                  {state === 'current' && done && <em>Completed</em>}
                </div>
                {state === 'done' && <span className="tl-badge">Done</span>}
              </li>
            );
          })}
        </ol>
        <div className="agent-foot">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setStage((s) => Math.max(0, s - 1))}
            disabled={stage === 0}
          >
            <ChevronLeft size={16} /> Previous Stage
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setStage((s) => Math.min(4, s + 1));
              if (stage === 3) show('Pickup verified — payment will be processed.');
            }}
            disabled={done}
          >
            Next Stage <ChevronRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}

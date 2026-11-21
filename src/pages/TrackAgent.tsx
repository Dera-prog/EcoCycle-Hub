import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Star,
  Truck,
} from 'lucide-react';
import { useToast } from '../components/ui';
import { useApp } from '../store';
import { categoryMap, formatNaira } from '../data';
import type { Collection } from '../types';

const stages = [
  { title: 'Assigned', text: 'Agent assigned to your pickup' },
  { title: 'En Route', text: 'Agent travelling to your location' },
  { title: 'Arriving', text: 'Agent is 5 minutes away' },
  { title: 'Verifying', text: 'Weight verification in progress' },
  { title: 'Completed', text: 'Pickup complete. Payment pending' },
];

const stageByStatus: Record<Collection['status'], number> = {
  upcoming: 0,
  assigned: 0,
  en_route: 1,
  arrived: 3,
  completed: 4,
  cancelled: 0,
};

const activeStatuses: Collection['status'][] = ['upcoming', 'assigned', 'en_route', 'arrived'];

export default function TrackAgent() {
  const [demoStage, setDemoStage] = useState(2);
  const { show } = useToast();
  const navigate = useNavigate();
  const { collections, apiMode, refreshState } = useApp();
  const active = collections.find((c) => activeStatuses.includes(c.status));
  const stage = apiMode && active ? stageByStatus[active.status] : demoStage;
  const done = stage === 4;
  const agentName = active?.agent?.name ?? (apiMode ? 'Assigning your agent…' : 'Chukwuma Okafor');
  const agentPhone = active?.agent?.phone ?? '';
  const categoryName = active ? categoryMap[active.category].name : 'Plastic';
  const kg = active ? active.confirmedWeight ?? active.weight : 4.5;
  const earn = active ? active.earning ?? 0 : 360;
  const statusText = done
    ? 'Collection complete'
    : stage >= 2
      ? 'En route to you'
      : active?.status === 'upcoming'
        ? 'Waiting for an agent'
        : 'Preparing your pickup';

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
          <p>
            {active.company} · {agentName}
          </p>
        </div>
        <button
          type="button"
          className="agent-call"
          aria-label="Call agent"
          onClick={() =>
            show(agentPhone ? `Calling ${agentName} on ${agentPhone}…` : 'Your agent will be assigned shortly.')
          }
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
          <strong>
            {active.status === 'upcoming' ? '—' : done ? 'Now' : `${stage === 2 ? 5 : 8} min`}
          </strong>
        </span>
      </section>

      <section className="card agent-card">
        <div className="agent-top">
          <span className="agent-avatar">{agentName.charAt(0)}</span>
          <div className="agent-copy">
            <strong>{agentName}</strong>
            <span>
              {active.company}
              {active.agent && (
                <>
                  {' '}
                  · <Star size={13} fill="#F5A623" stroke="#F5A623" /> 4.9 (312 pickups)
                </>
              )}
            </span>
            <em>
              <i className={`status-dot ${done ? 'done' : ''}`} /> {statusText}
            </em>
          </div>
          <div className="agent-actions">
            <button type="button" aria-label="Call" onClick={() => show(agentPhone ? `Calling ${agentName}…` : 'No agent number yet.')}>
              <Phone size={17} />
            </button>
            <button type="button" aria-label="Message" onClick={() => show('Message thread opened.')}>
              <Mail size={17} />
            </button>
          </div>
        </div>

        <div className="agent-details">
          {[
            ['Waste Type', categoryName],
            ['Weight', `${kg} kg${active.confirmedWeight ? ' confirmed' : ' est.'}`],
            ['Est. Earn', formatNaira(earn)],
            ['Time Slot', active.time],
            ['Address', active.address],
            ['Pickup ID', active.pickupId ?? '—'],
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
                  <strong>{i === 0 && active.status === 'upcoming' ? 'Matching agent' : s.title}</strong>
                  <span>
                    {i === 0 && active.status === 'upcoming'
                      ? 'We are matching you with a nearby agent'
                      : s.text}
                  </span>
                  {state === 'current' && !done && <em>In progress…</em>}
                  {state === 'current' && done && <em>Completed</em>}
                </div>
                {state === 'done' && <span className="tl-badge">Done</span>}
              </li>
            );
          })}
        </ol>
        <div className="agent-foot">
          {apiMode ? (
            <button type="button" className="btn btn-outline" onClick={() => void refreshState()}>
              <RefreshCw size={16} /> Refresh status
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setDemoStage((s) => Math.max(0, s - 1))}
                disabled={demoStage === 0}
              >
                <ChevronLeft size={16} /> Previous Stage
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setDemoStage((s) => Math.min(4, s + 1));
                  if (demoStage === 3) show('Pickup verified — payment will be processed.');
                }}
                disabled={done}
              >
                Next Stage <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

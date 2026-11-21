import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Leaf,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Logo } from './ui';
import { categories, testimonials } from '../data';

const proofPoints = [
  { icon: Leaf, text: '8 recyclable categories paid by the kilo' },
  { icon: TrendingUp, text: 'Free doorstep pickups in Lagos, Abuja & PH' },
  { icon: Wallet, text: 'Withdraw to any Nigerian bank, zero fees' },
];

export default function AuthLayout({
  mode,
  title,
  subtitle,
  icon,
  plan,
  children,
}: {
  mode: 'signin' | 'signup';
  title: string;
  subtitle: string;
  icon: ReactNode;
  plan?: string | null;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const quote = testimonials[0];
  const rates = categories.filter((c) => ['plastic', 'metal', 'electronic', 'paper'].includes(c.key));

  return (
    <div className={`auth-page auth-${mode}`}>
      <aside className="auth-aside" aria-label="Why recycle with EcoCycle Hub">
        <div className="auth-orb auth-orb-a" aria-hidden="true" />
        <div className="auth-orb auth-orb-b" aria-hidden="true" />
        <div className="auth-aside-inner">
          <Link to="/" className="auth-aside-brand" aria-label="EcoCycle Hub home">
            <Logo light />
          </Link>

          <div className="auth-aside-copy">
            <span className="auth-kicker">
              <Sparkles size={14} />
              {mode === 'signup' ? 'Start earning in minutes' : 'Welcome back, recycler'}
            </span>
            <h2>
              {mode === 'signup' ? (
                <>
                  Your waste is worth <em>more than you think.</em>
                </>
              ) : (
                <>
                  Your recyclables are <em>waiting to pay you.</em>
                </>
              )}
            </h2>
            <p>
              {mode === 'signup'
                ? 'Join 84,000+ Nigerians turning everyday plastic, paper and metal into real money — collected free, weighed fairly, paid instantly.'
                : 'Sign in to track today’s pickup, watch your balance grow, and keep your eco impact climbing.'}
            </p>

            <ul className="auth-points">
              {proofPoints.map(({ icon: Icon, text }) => (
                <li key={text}>
                  <span>
                    <Check size={13} strokeWidth={3} />
                  </span>
                  {text}
                </li>
              ))}
            </ul>

            <figure className="auth-quote">
              <div className="auth-quote-stars" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} size={13} fill="currentColor" />
                ))}
              </div>
              <blockquote>“{quote.quote}”</blockquote>
              <figcaption>
                <span className="auth-quote-avatar">{quote.initial}</span>
                <span>
                  <strong>{quote.name}</strong>
                  <em>{quote.role}</em>
                </span>
                <span className="auth-quote-kg">{quote.kg.toLocaleString('en-NG')} kg</span>
              </figcaption>
            </figure>
          </div>

          <div className="auth-rates" aria-label="Today's recycling rates">
            <span className="auth-rates-label">Today’s rates</span>
            <div className="auth-rates-grid">
              {rates.map((c) => (
                <div key={c.key}>
                  <i style={{ background: c.color }} aria-hidden="true" />
                  <span>{c.name}</span>
                  <strong>₦{c.rate}/kg</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <main className="auth-panel">
        <header className="auth-top">
          <button
            type="button"
            className="icon-btn auth-back"
            aria-label="Go back"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={20} />
          </button>
          <Link to="/" className="auth-brand auth-brand-light" aria-label="EcoCycle Hub home">
            <Logo light compact />
          </Link>
          <Link to="/" className="auth-brand auth-brand-dark" aria-label="EcoCycle Hub home">
            <Logo compact />
          </Link>
        </header>

        <div className="auth-card">
          <div className="auth-card-head">
            <span className="auth-mark">{icon}</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
            {plan && <span className="auth-plan">Business plan selected · 30-day free trial</span>}
          </div>
          {children}
        </div>

        <p className="auth-foot">
          <ShieldCheck size={13} /> Bank-grade security · Free to join · Cancel anytime
        </p>
      </main>
    </div>
  );
}

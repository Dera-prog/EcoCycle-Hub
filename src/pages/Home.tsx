import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  Check,
  Gift,
  Leaf,
  Package,
  Play,
  Recycle,
  Scale,
  Tag,
} from 'lucide-react';
import { Stars } from '../components/ui';
import { categories, categoryMap, formatNaira, testimonials } from '../data';
import type { CategoryKey } from '../types';
import { ExploreCards } from '../components/ExploreMore';

const steps = [
  {
    icon: CalendarDays,
    title: 'Book in 60 seconds',
    text: 'Pick a category, weight and time slot. Doorstep pickup is free, with no minimum weight.',
  },
  {
    icon: Scale,
    title: 'We weigh it with you',
    text: 'Your agent verifies the weight on a digital scale, right in front of you — no guesswork.',
  },
  {
    icon: Banknote,
    title: 'Get paid instantly',
    text: 'Earnings land in your wallet and are ready to withdraw to any Nigerian bank within 24 hours.',
  },
];

const quickWeights = [5, 10, 20, 50];

export default function Home() {
  const [calcKey, setCalcKey] = useState<CategoryKey>('plastic');
  const [weight, setWeight] = useState(10);
  const calc = categoryMap[calcKey];
  const earning = weight * calc.rate;

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="hero-pill">
              <Leaf size={14} /> Nigeria's #1 Recycling Platform
            </span>
            <h1>
              Turn Waste Into
              <br />
              <span>Wealth &amp; Impact</span>
            </h1>
            <p>
              Sort recyclables, schedule a free pickup, and earn money while saving the planet.
              Join 84,000+ Nigerians on EcoCycle Hub.
            </p>
            <div className="hero-actions">
              <Link to="/sign-up" className="btn btn-white">
                Start Recycling Free <ArrowRight size={18} />
              </Link>
              <Link to="/how-it-works" className="btn btn-outline-light">
                <Play size={16} /> How It Works
              </Link>
            </div>
            <div className="hero-proof">
              <span className="hero-avatars" aria-hidden="true">
                <i>A</i>
                <i>C</i>
                <i>M</i>
                <i>+</i>
              </span>
              <div>
                <span className="hero-proof-stars">
                  <Stars size={12} /> <strong>4.9/5</strong>
                </span>
                <span>from 12,400+ verified recyclers</span>
              </div>
            </div>
            <dl className="hero-stats">
              <div>
                <dt>2.4M+</dt>
                <dd>Kg Recycled</dd>
              </div>
              <div>
                <dt>84K+</dt>
                <dd>Active Users</dd>
              </div>
              <div>
                <dt>120+</dt>
                <dd>Partners</dd>
              </div>
              <div>
                <dt>₦380M+</dt>
                <dd>Paid Out</dd>
              </div>
            </dl>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="phone">
              <div className="phone-screen">
                <div className="phone-status">
                  <span>9:41</span>
                  <span className="phone-dots">●●●</span>
                </div>
                <div className="phone-greet">
                  <span>Good morning,</span>
                  <strong>Amaka 👋</strong>
                </div>
                <div className="phone-earn">
                  <span>Total Earnings</span>
                  <strong>₦48,200</strong>
                  <em>+₦3,400 this month</em>
                </div>
                <div className="phone-pickup">
                  <span className="phone-pickup-icon">
                    <Recycle size={15} />
                  </span>
                  <div>
                    <strong>Plastic Collection</strong>
                    <span>Today 2:00 PM · 4.5 kg</span>
                  </div>
                  <em>Soon</em>
                </div>
                <div className="phone-actions">
                  <span className="pa green"><Recycle size={17} />Recycle</span>
                  <span className="pa blue"><Tag size={17} />Schedule</span>
                  <span className="pa purple"><Gift size={17} />Rewards</span>
                </div>
              </div>
            </div>
            <div className="float-card float-eco">
              <span className="float-icon green"><Leaf size={16} /></span>
              <strong>18 Trees</strong>
              <span>Saved by your recycling</span>
            </div>
            <div className="float-card float-badge">
              <span className="float-icon gold">🥇</span>
              <strong>Gold Recycler</strong>
              <span>1,240 kg total</span>
            </div>
            <div className="float-card float-paid">
              <span className="float-icon paid">
                <Check size={15} />
              </span>
              <strong>₦360 paid</strong>
              <span>Plastic · 4.5 kg</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rate-strip" aria-label="Today's recycling rates">
        <div className="container rate-strip-head">
          <span className="live-tag">
            <i aria-hidden="true" /> Live rates · Lagos
          </span>
          <Link to="/categories">
            Compare all 8 categories <ArrowRight size={14} />
          </Link>
        </div>
        <div className="ticker-viewport">
          <ul className="ticker-track">
            {[...categories, ...categories].map((c, i) => (
              <li key={`${c.key}-${i}`} aria-hidden={i >= categories.length}>
                <i style={{ background: c.color }} />
                <span>{c.name}</span>
                <strong>{formatNaira(c.rate)}/kg</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="trust-strip">
        <div className="container">
          <span>As featured in</span>
          <strong>TechCabal</strong>
          <strong>BusinessDay</strong>
          <strong>Nairametrics</strong>
          <strong>Pulse</strong>
          <strong>Lagos Recycles</strong>
        </div>
      </div>

      <section className="section section-features">
        <div className="container">
          <header className="section-head">
            <span className="eyebrow">Explore the platform</span>
            <h2>Everything You Need</h2>
            <p>Explore what EcoCycle Hub has to offer</p>
          </header>
          <ExploreCards />
        </div>
      </section>

      <section className="section section-calculator" id="calculator">
        <div className="container calc-grid">
          <div className="calc-copy">
            <span className="eyebrow">Know your worth</span>
            <h2>Every kilogram has a price.</h2>
            <p>
              Pick a category and slide the weight — see exactly what today’s pickup is worth.
              Transparent rates, no hidden deductions, ever.
            </p>
            <ul className="calc-points">
              <li>
                <Check size={14} /> Paid per kilo, weighed in front of you
              </li>
              <li>
                <Check size={14} /> Free doorstep pickup, no minimum weight
              </li>
              <li>
                <Check size={14} /> Withdraw to any Nigerian bank within 24 hours
              </li>
            </ul>
            <Link to="/sign-up" className="btn btn-primary">
              Start earning today <ArrowRight size={17} />
            </Link>
          </div>

          <div className="calc-card">
            <div className="calc-accent" style={{ background: calc.color }} aria-hidden="true" />
            <header>
              <span>Earnings calculator</span>
              <span className="calc-live">
                <i /> Live rates
              </span>
            </header>

            <div className="calc-cats" role="group" aria-label="Waste category">
              {categories.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={calcKey === c.key ? 'is-active' : ''}
                  aria-pressed={calcKey === c.key}
                  onClick={() => setCalcKey(c.key)}
                >
                  <i style={{ background: c.color }} /> {c.name}
                </button>
              ))}
            </div>

            <label className="calc-slider">
              <span>
                Weight <strong>{weight} kg</strong>
              </span>
              <input
                type="range"
                min={1}
                max={100}
                value={weight}
                aria-label="Weight in kilograms"
                onChange={(e) => setWeight(Number(e.target.value))}
                style={{ accentColor: calc.color }}
              />
              <span className="calc-scale">
                <span>1 kg</span>
                <span>100 kg</span>
              </span>
            </label>

            <div className="calc-chips" role="group" aria-label="Quick weights">
              {quickWeights.map((w) => (
                <button
                  key={w}
                  type="button"
                  className={weight === w ? 'is-active' : ''}
                  aria-pressed={weight === w}
                  onClick={() => setWeight(w)}
                >
                  {w} kg
                </button>
              ))}
            </div>

            <div className="calc-result" style={{ background: calc.bg }}>
              <span>You could earn</span>
              <strong>{formatNaira(earning)}</strong>
              <em>
                {formatNaira(calc.rate)} per kg · {calc.name.toLowerCase()} waste
              </em>
            </div>
            <p className="calc-tip">{calc.tip}</p>
          </div>
        </div>
      </section>

      <section className="section section-steps">
        <div className="container">
          <header className="section-head">
            <span className="eyebrow">Simple by design</span>
            <h2>From bag to bank in three steps</h2>
            <p>No sorting skills, no minimum weight, no hidden fees.</p>
          </header>
          <div className="flow-grid">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <article className="flow-card" key={title}>
                <span className="flow-num">0{i + 1}</span>
                <span className="flow-icon">
                  <Icon size={22} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <div className="steps-cta">
            <Link to="/how-it-works" className="btn btn-outline">
              Full walkthrough
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-testimonials">
        <div className="container">
          <header className="section-head">
            <span className="eyebrow">Success stories</span>
            <h2>Recyclers Love EcoCycle Hub</h2>
          </header>
          <div className="testimonial-grid">
            {testimonials.map((t) => (
              <article className="testimonial-card" key={t.name}>
                <Stars />
                <blockquote>"{t.quote}"</blockquote>
                <footer>
                  <span className="avatar-sm">{t.initial}</span>
                  <div>
                    <strong>{t.name}</strong>
                    <span>{t.role}</span>
                  </div>
                  <div className="testimonial-kg">
                    <strong>{t.kg.toLocaleString('en-NG')} kg</strong>
                    <span>recycled</span>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="container">
          <h2>Start Recycling and Earning Today</h2>
          <p>Join 84,000+ Nigerians turning waste into wealth. Free to join, always.</p>
          <div className="cta-actions">
            <Link to="/how-it-works" className="btn btn-outline-light">
              <Play size={16} /> See How It Works
            </Link>
          </div>
          <div className="cta-trust">
            <span><Check size={13} /> No hidden fees</span>
            <span><Check size={13} /> Free doorstep pickups</span>
            <span><Check size={13} /> Payouts in 24 hours</span>
          </div>
        </div>
      </section>
    </>
  );
}

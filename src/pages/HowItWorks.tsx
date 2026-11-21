import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Recycle,
  Scale,
  ShieldCheck,
  Truck,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { faqs, steps } from '../data';
const stepIcons = {
  user: UserRound,
  book: BookOpen,
  users: Users,
  scale: Scale,
  calendar: CalendarDays,
  shield: ShieldCheck,
  truck: Truck,
  wallet: Wallet,
};

export default function HowItWorks() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <>
      <section className="page-hero">
        <span className="hero-pill">
          Simple • Fast • Rewarding
        </span>
        <h1>From Waste to Wallet in 8 Steps</h1>
        <p>
          Our guided process makes recycling effortless. Follow these steps to start earning money
          from your waste today.
        </p>
        <Link to="/sign-up" className="btn btn-white">
          Schedule My First Pickup <ArrowRight size={18} />
        </Link>
      </section>

      <section className="section steps-section">
        <div className="container steps-container">
          {steps.map((step, i) => {
            const Icon = stepIcons[step.icon as keyof typeof stepIcons];
            return (
              <article className="step-card" key={step.n}>
                <span className="step-rail" aria-hidden="true">
                  <span className="step-icon" style={{ background: step.bg, color: step.color }}>
                    <Icon size={22} />
                  </span>
                  {i < steps.length - 1 && <span className="rail-line" />}
                </span>
                <div className="step-body">
                  <span className="step-label">Step {step.n}</span>
                  <h2>{step.title}</h2>
                  <p>{step.text}</p>
                  <div className="step-tip">
                    <strong>Pro tip:</strong> {step.tip}
                  </div>
                </div>
              </article>
            );
          })}

          <div className="journey-band">
            <h2>Your Waste Journey</h2>
            <div className="journey-flow">
              {['Collection', 'Sorting', 'Processing', 'Transformation', 'Eco Product'].map((label, i) => (
                <span className="journey-item" key={label}>
                  <span>{label}</span>
                  {i < 4 && <ArrowRight size={16} aria-hidden="true" />}
                </span>
              ))}
            </div>
          </div>

          <div className="faq-block">
            <h2>Frequently Asked Questions</h2>
            <div className="faq-list">
              {faqs.map((faq, i) => (
                <div className={`faq-item ${open === i ? 'is-open' : ''}`} key={faq.q}>
                  <button
                    type="button"
                    className="faq-q"
                    aria-expanded={open === i}
                    onClick={() => setOpen(open === i ? null : i)}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown size={18} className="faq-chev" />
                  </button>
                  {open === i && <p className="faq-a">{faq.a}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="steps-cta">
            <Link to="/sign-up" className="btn btn-primary btn-lg">
              <Recycle size={18} /> Start Recycling Now
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

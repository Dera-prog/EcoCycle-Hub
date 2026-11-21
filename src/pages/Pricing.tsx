import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Minus } from 'lucide-react';
import { plans } from '../data';

const companyFeatures = [
  'Driver & route management portal',
  'Collection request inbox & dispatch',
  'Weight verification & photo upload',
  'Processing plant & inventory tracker',
  'Automated payout rate management',
  'Analytics & performance reports',
  'API integration for logistics systems',
  'Dedicated onboarding & support',
];

const pricingFaqs = [
  {
    q: 'Do you charge users a fee per collection?',
    a: 'No. Scheduling pickups is completely free for users. You earn 100% of your recycling revenue — EcoCycle Hub takes nothing from your earnings.',
  },
  {
    q: 'Who pays the platform commission?',
    a: 'Recycling companies pay a 2–5% commission per verified collection, depending on volume. This funds platform operations, driver app support, and reporting.',
  },
  {
    q: 'Can I downgrade my plan?',
    a: 'Yes, you can change or cancel your plan at any time. Annual subscribers can downgrade at renewal.',
  },
  {
    q: 'Is there a free trial for business plans?',
    a: 'Yes — business and enterprise plans include a 30-day free trial with no credit card required.',
  },
];

export default function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <>
      <section className="page-hero pricing-hero">
        <h1>Simple, Transparent Pricing</h1>
        <p>
          EcoCycle Hub is free for individuals. Business plans unlock advanced features. You always
          keep 100% of your recycling earnings.
        </p>
        <div className="billing-toggle" role="group" aria-label="Billing period">
          <button
            type="button"
            className={!annual ? 'is-active' : ''}
            aria-pressed={!annual}
            onClick={() => setAnnual(false)}
          >
            Monthly
          </button>
          <button
            type="button"
            className={annual ? 'is-active' : ''}
            aria-pressed={annual}
            onClick={() => setAnnual(true)}
          >
            Annual · −20%
          </button>
        </div>
      </section>

      <section className="section pricing-section">
        <div className="container pricing-container">
          <div className="plan-grid">
            {plans.map((plan) => {
              const numeric = plan.price.startsWith('₦')
                ? Number(plan.price.replace(/[₦,]/g, ''))
                : null;
              const display = numeric
                ? `₦${Math.round(numeric * (annual ? 0.8 : 1)).toLocaleString('en-NG')}`
                : plan.price;
              return (
                <article className={`plan-card ${plan.featured ? 'is-featured' : ''}`} key={plan.name}>
                  {plan.featured && <span className="plan-badge">Most Popular</span>}
                  <header>
                    <span className="plan-name">{plan.name}</span>
                    <div className="plan-price">
                      <strong>{display}</strong>
                      {numeric && <span>/month</span>}
                    </div>
                    {numeric && annual && (
                      <span className="plan-annual">
                        Billed ₦{(Math.round(numeric * 0.8) * 12).toLocaleString('en-NG')} yearly
                      </span>
                    )}
                    <p>{plan.note}</p>
                  </header>
                  <ul className="plan-features">
                    {plan.features.map((f) => (
                      <li key={f}>
                        <Check size={15} /> {f}
                      </li>
                    ))}
                    {plan.missing.map((f) => (
                      <li key={f} className="is-muted">
                        <Minus size={15} /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={plan.name === 'Individual' ? '/sign-up' : `/sign-up?plan=${plan.name.toLowerCase()}`}
                    className={`btn ${plan.featured ? 'btn-primary' : 'btn-outline'} plan-cta`}
                  >
                    {plan.cta}
                  </Link>
                </article>
              );
            })}
          </div>

          <div className="card company-plan" id="company">
            <div className="company-plan-head">
              <div>
                <h2>Recycling Company Plan</h2>
                <p>For companies that collect, process, and transform waste</p>
              </div>
              <div className="commission">
                <strong>2–5%</strong>
                <span>commission per verified collection</span>
              </div>
            </div>
            <ul className="company-features">
              {companyFeatures.map((f) => (
                <li key={f}>
                  <Check size={15} /> {f}
                </li>
              ))}
            </ul>
            <a href="mailto:partners@ecocycle.ng" className="btn btn-primary">
              Apply as Recycling Partner
            </a>
          </div>

          <div className="pricing-faq">
            <h2>Pricing Questions</h2>
            <div className="pricing-faq-grid">
              {pricingFaqs.map((f) => (
                <div className="card pricing-faq-item" key={f.q}>
                  <h3>{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

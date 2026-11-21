import { Link } from 'react-router-dom';
import { Droplets, Sprout, Wind, Zap } from 'lucide-react';
import { ComparisonChart } from '../components/charts';
import { CategoryIcon } from '../components/ui';
import { categoryImpact, categoryMap, impactCards, impactStats, months } from '../data';

const cardIcons = { trees: Sprout, wind: Wind, droplet: Droplets, zap: Zap };

const trees = [120, 180, 160, 240, 290, 320, 380, 410, 450, 470, 520, 560];
const co2 = [80, 110, 140, 180, 210, 240, 280, 310, 340, 360, 400, 430];

export default function Impact() {
  return (
    <>
      <section className="page-hero impact-hero">
        <span className="impact-globe" aria-hidden="true">🌍</span>
        <h1>Real Impact, Real Numbers</h1>
        <p>
          Together, EcoCycle Hub users have made a measurable difference to our planet. Here is what
          recycling through our platform has achieved.
        </p>
        <div className="impact-stat-grid">
          {impactStats.map((s) => (
            <div className="impact-stat" key={s.label}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section impact-section">
        <div className="container impact-container">
          <div className="card chart-panel">
            <h2>Trees Saved &amp; CO₂ Reduced (2024)</h2>
            <p className="muted">Monthly platform-wide environmental impact</p>
            <ComparisonChart labels={months} a={trees} b={co2} />
            <div className="chart-legend">
              <span><i style={{ background: '#2E7D32' }} /> Trees Saved</span>
              <span><i style={{ background: '#42A5F5' }} /> CO₂ Reduced (Tonnes)</span>
            </div>
          </div>

          <div className="impact-card-grid">
            {impactCards.map((card) => {
              const Icon = cardIcons[card.icon as keyof typeof cardIcons];
              return (
                <article className="impact-card card" key={card.title}>
                  <span className="impact-icon" style={{ background: card.bg, color: card.color }}>
                    <Icon size={22} />
                  </span>
                  <div>
                    <h3>{card.title}</h3>
                    <strong>{card.subtitle}</strong>
                    <p>{card.text}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="card category-impact">
            <h2>Impact by Waste Category</h2>
            <ul>
              {categoryImpact.map((item) => (
                <li key={item.key}>
                  <CategoryIcon category={item.key} size={38} radius={12} />
                  <div className="ci-body">
                    <div className="ci-top">
                      <strong>{categoryMap[item.key].name}</strong>
                      <span>{item.amount}</span>
                    </div>
                    <div className="bar" aria-hidden="true">
                      <span
                        style={{ width: `${item.pct}%`, background: categoryMap[item.key].color }}
                      />
                    </div>
                    <p>{item.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="impact-cta">
            <h2>Every kilogram counts</h2>
            <p>
              Join the movement. Every piece of waste you recycle saves energy, water, trees — and
              puts money in your pocket.
            </p>
            <Link to="/sign-up" className="btn btn-white">
              Start Making an Impact
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

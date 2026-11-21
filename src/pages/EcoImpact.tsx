import { Check, Droplets, Leaf, Sprout, Trophy, Wind, Zap } from 'lucide-react';
import DashHeader from '../components/DashHeader';
import { useApp } from '../store';
import { milestones } from '../data';

const madeFromWaste = [
  { name: 'Plastic Lumber', kg: 5, image: '/images/plastic-lumber.jpg' },
  { name: 'Building Bricks', kg: 8, image: '/images/building-bricks.jpg' },
  { name: 'School Desks', kg: 12, image: '/images/school-desks.jpg' },
  { name: 'Flower Pots', kg: 2, image: '/images/flower-pots.jpg' },
];

export default function EcoImpact() {
  const { totalRecycled, persona } = useApp();
  const isNew = persona === 'new' && totalRecycled === 0;

  const impacts = [
    { icon: Sprout, value: isNew ? '0 Trees' : '18 Trees', label: 'Saved', color: '#A5D6A7' },
    { icon: Wind, value: isNew ? '0 T' : '1.2T', label: 'CO₂ Reduced', color: '#90CAF9' },
    { icon: Droplets, value: isNew ? '0 L' : '6,200 L', label: 'Water Saved', color: '#81D4FA' },
    { icon: Zap, value: isNew ? '0 kWh' : '4,800 kWh', label: 'Energy Saved', color: '#FFE082' },
  ];

  return (
    <DashHeader>
      <section className="impact-hero-card">
        <header>
          <span className="impact-hero-icon">
            <Leaf size={22} />
          </span>
          <div>
            <h2>Your Environmental Impact</h2>
            <p>
              {isNew
                ? 'Your impact begins with your first pickup'
                : `Based on ${totalRecycled.toLocaleString('en-NG')} kg recycled`}
            </p>
          </div>
        </header>
        <div className="impact-tiles">
          {impacts.map(({ icon: Icon, value, label, color }) => (
            <div key={label}>
              <Icon size={18} color={color} />
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card milestones-card">
        <header>
          <h2>Recycling Milestones</h2>
          <Trophy size={18} />
        </header>
        <ul>
          {milestones.map((m, i) => {
            const pct =
              persona === 'returning'
                ? m.pct
                : Math.min(100, Math.round((totalRecycled / m.kg) * 100));
            return (
              <li key={m.name}>
                <span className={`medal medal-${m.tone}`} aria-hidden="true">
                  {i === 3 ? '🏆' : ['🥉', '🥈', '🥇'][i]}
                </span>
                <div className="milestone-body">
                  <div className="milestone-top">
                    <strong>{m.name}</strong>
                    <span>{m.kg.toLocaleString('en-NG')} kg</span>
                    {pct >= 100 && <Check size={15} className="milestone-check" />}
                  </div>
                  <div className="bar">
                    <span className={`bar-${m.tone}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {isNew && (
          <p className="milestone-empty">
            Recycle 100 kg to unlock Bronze — that’s about 12 bags of plastic.
          </p>
        )}
      </section>

      <section className="card waste-products">
        <h2>{totalRecycled > 0 ? 'Products From Your Waste' : 'What Your Waste Can Become'}</h2>
        {totalRecycled === 0 && (
          <p className="waste-products-sub">
            Every pickup is sorted, weighed and reborn as something new.
          </p>
        )}
        <div className="waste-product-grid">
          {madeFromWaste.map((p) => (
            <article key={p.name}>
              <img src={p.image} alt={p.name} loading="lazy" />
              <div>
                <strong>{p.name}</strong>
                <span>{p.kg} kg saved</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </DashHeader>
  );
}

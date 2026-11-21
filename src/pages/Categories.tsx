import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Search, Sparkles } from 'lucide-react';
import { CategoryIcon } from '../components/ui';
import { categories, categoryMap, formatNaira } from '../data';
import type { CategoryKey } from '../types';

export default function Categories() {
  const [selected, setSelected] = useState<CategoryKey>('plastic');
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () =>
      categories.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.items.some((item) => item.toLowerCase().includes(query.toLowerCase())),
      ),
    [query],
  );

  const active = categoryMap[selected];

  return (
    <>
      <section className="page-hero page-hero-left">
        <div className="container">
          <h1>8 Categories, One Platform</h1>
          <p>
            We accept all major recyclable waste types. Each category has a dedicated collection bag
            colour for easy sorting.
          </p>
          <label className="search-field">
            <Search size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories or items…"
              aria-label="Search categories or items"
            />
          </label>
        </div>
      </section>

      <section className="section categories-section">
        <div className="container categories-layout">
          <div>
            <div className="category-grid">
              {filtered.map((cat) => (
                <button
                  type="button"
                  key={cat.key}
                  className={`category-tile ${selected === cat.key ? 'is-selected' : ''}`}
                  onClick={() => setSelected(cat.key)}
                  aria-pressed={selected === cat.key}
                >
                  {selected === cat.key && (
                    <span className="tile-check">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                  <CategoryIcon category={cat.key} size={44} radius={14} />
                  <strong>{cat.name}</strong>
                  <span className="tile-price">{formatNaira(cat.rate)}/kg</span>
                  <span className="tile-bag">
                    <i style={{ background: cat.color }} /> {cat.bag}
                  </span>
                </button>
              ))}
            </div>
            {filtered.length === 0 && (
              <div className="empty-state">
                No categories match "{query}". Try "plastic", "metal" or "bottles".
              </div>
            )}

            <div className="card colour-ref">
              <h2>Colour-Coding Reference</h2>
              <div className="colour-grid">
                {categories.map((cat) => (
                  <div className="colour-item" key={cat.key} style={{ background: cat.bg }}>
                    <i style={{ background: cat.color }} />
                    <div>
                      <strong>{cat.name}</strong>
                      <span>{cat.bag}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="category-detail card">
            <div className="detail-head" style={{ background: active.bg }}>
              <CategoryIcon category={active.key} size={58} radius={16} />
              <div>
                <h2>{active.name} Waste</h2>
                <p>
                  Bag colour: <b style={{ color: active.color }}>{active.bagColor}</b>
                </p>
              </div>
            </div>
            <div className="detail-rate">
              <strong style={{ color: active.color }}>{formatNaira(active.rate)}/kg</strong>
              <span>per kilogram</span>
            </div>

            <div className="detail-section">
              <h3>Accepted items</h3>
              <ul className="accepted-list">
                {active.items.map((item) => (
                  <li key={item}>
                    <Check size={13} strokeWidth={3} /> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="detail-section">
              <h3>Sorting tip</h3>
              <p className="sorting-tip">
                <Sparkles size={15} /> {active.tip}
              </p>
            </div>

            <div className="detail-section">
              <h3>Estimated earnings</h3>
              <ul className="earn-list">
                {[5, 10, 20, 50].map((kg) => (
                  <li key={kg}>
                    <span>{kg} kg</span>
                    <strong style={{ color: active.color }}>{formatNaira(kg * active.rate)}</strong>
                  </li>
                ))}
              </ul>
            </div>

            <Link to="/sign-up" className="btn btn-primary detail-cta">
              Schedule {active.name} Pickup
            </Link>
          </aside>
        </div>
      </section>
    </>
  );
}

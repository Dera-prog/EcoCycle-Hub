import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Leaf, Recycle } from 'lucide-react';
import { formatNaira, products } from '../data';

const filters = ['All', 'Plastic', 'Metal', 'Mixed'] as const;

const process = [
  { n: 1, title: 'You Recycle', text: 'Sort waste and schedule a pickup' },
  { n: 2, title: 'We Collect', text: 'Verified agent picks up your waste' },
  { n: 3, title: 'Factory Processes', text: 'Waste sorted, cleaned, and shredded' },
  { n: 4, title: 'Product Created', text: 'New eco-friendly product manufactured' },
  { n: 5, title: 'Sold & Delivered', text: 'Products sold on our marketplace' },
];

export default function Products() {
  const [filter, setFilter] = useState<(typeof filters)[number]>('All');
  const visible = products.filter((p) => filter === 'All' || p.filter === filter);

  return (
    <>
      <section className="page-hero products-hero">
        <h1>From Waste to Useful Products</h1>
        <p>
          See what recycling companies make from materials you contribute. Every product closes the
          loop on a circular economy.
        </p>
        <div className="filter-row" role="group" aria-label="Filter products">
          {filters.map((f) => (
            <button
              type="button"
              key={f}
              className={`filter-chip ${filter === f ? 'is-active' : ''}`}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </section>

      <section className="section products-section">
        <div className="container">
          <div className="product-grid">
            {visible.map((p) => (
              <article className="product-card" key={p.name}>
                <div className="product-media">
                  <img src={p.image} alt={p.name} loading="lazy" width="1200" height="900" />
                  <span className="product-badge">{p.badge}</span>
                  <span className="product-price">{formatNaira(p.price)}</span>
                </div>
                <div className="product-body">
                  <h2>{p.name}</h2>
                  <div className="product-meta">
                    <span>
                      <Leaf size={14} /> {p.kg} kg saved
                    </span>
                    <span>{p.units} units made</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="card process-card">
            <h2>How Your Waste Becomes a Product</h2>
            <ol className="process-grid">
              {process.map((step, i) => (
                <li key={step.n}>
                  <span className="process-num">{step.n}</span>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                  {i < process.length - 1 && <span className="process-arrow" aria-hidden="true">›</span>}
                </li>
              ))}
            </ol>
          </div>

          <div className="products-cta">
            <Link to="/sign-up" className="btn btn-primary btn-lg">
              <Recycle size={18} /> Start Recycling to Contribute
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

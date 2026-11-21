import { Link } from 'react-router-dom';
import { ArrowRight, Leaf, Package, Play, Recycle, Tag } from 'lucide-react';

export const exploreLinks = [
  {
    to: '/how-it-works',
    icon: Play,
    title: 'How It Works',
    text: 'Step-by-step guide',
    color: '#2E7D32',
    bg: '#E8F5E9',
  },
  {
    to: '/categories',
    icon: Recycle,
    title: 'Categories',
    text: '8 waste types',
    color: '#1565C0',
    bg: '#E3F2FD',
  },
  {
    to: '/impact',
    icon: Leaf,
    title: 'Eco Impact',
    text: 'Your planet contribution',
    color: '#2E7D32',
    bg: '#E8F5E9',
  },
  {
    to: '/products',
    icon: Package,
    title: 'Products',
    text: 'Recycled goods',
    color: '#7B1FA2',
    bg: '#F3E5F5',
  },
  {
    to: '/pricing',
    icon: Tag,
    title: 'Pricing',
    text: 'Free for users',
    color: '#E08A00',
    bg: '#FFF8E1',
  },
];

export function ExploreCards() {
  return (
    <div className="feature-grid">
      {exploreLinks.map(({ to, icon: Icon, title, text, color, bg }) => (
        <Link to={to} className="feature-card" key={to}>
          <span className="feature-icon" style={{ background: bg, color }}>
            <Icon size={21} />
          </span>
          <strong>{title}</strong>
          <span>{text}</span>
          <ArrowRight size={16} className="feature-arrow" />
        </Link>
      ))}
    </div>
  );
}

export default function ExploreMore({ current }: { current: string }) {
  const rest = exploreLinks.filter((link) => link.to !== current);

  return (
    <section className="section explore-more">
      <div className="container">
        <div className="explore-more-head">
          <div>
            <span className="eyebrow">Keep exploring</span>
            <h2>More of what we do</h2>
          </div>
          <Link to="/" className="link-btn strong">
            Back to home <ArrowRight size={15} />
          </Link>
        </div>
        <div className="feature-grid">
          {rest.map(({ to, icon: Icon, title, text, color, bg }) => (
            <Link to={to} className="feature-card" key={to}>
              <span className="feature-icon" style={{ background: bg, color }}>
                <Icon size={21} />
              </span>
              <strong>{title}</strong>
              <span>{text}</span>
              <ArrowRight size={16} className="feature-arrow" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

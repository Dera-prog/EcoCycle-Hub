import type { ReactNode } from 'react';
import { Recycle, RotateCcw, TrendingUp, Wallet } from 'lucide-react';
import { useApp } from '../store';
import { formatNaira } from '../data';

export default function DashHeader({ children }: { children: ReactNode }) {
  const { totalEarned, totalRecycled, monthKg, collections, pending, persona, user } = useApp();
  const isNew = persona === 'new' && totalRecycled === 0;
  const monthCount =
    persona === 'returning'
      ? collections.filter((c) => c.status === 'upcoming').length + 2
      : collections.length;
  const firstName = user.name.split(' ')[0];

  const stats = [
    {
      label: 'Total Earned',
      value: formatNaira(totalEarned),
      sub: isNew ? 'Earn on your first pickup' : '+₦3,400 this month',
      icon: Wallet,
      bg: '#E8F5E9',
      color: '#2E7D32',
    },
    {
      label: 'Total Recycled',
      value: `${totalRecycled.toLocaleString('en-NG')} kg`,
      sub: isNew ? 'Bronze tier at 100 kg' : 'Gold Recycler tier',
      icon: Recycle,
      bg: '#FFF3E0',
      color: '#E08A00',
    },
    {
      label: 'This Month',
      value: `${monthKg} kg`,
      sub: `${monthCount} ${monthCount === 1 ? 'collection' : 'collections'}`,
      icon: TrendingUp,
      bg: '#E3F2FD',
      color: '#1976D2',
    },
    {
      label: 'Pending',
      value: formatNaira(pending),
      sub: isNew ? 'Nothing pending yet' : 'Processing',
      icon: RotateCcw,
      bg: '#EFEBE9',
      color: '#795548',
    },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="container dash">
      <header className="dash-greet">
        <h1>
          {greeting}, {firstName} 👋
        </h1>
        <p>
          {isNew
            ? 'Welcome to EcoCycle Hub — one pickup is all it takes 🌱'
            : 'Your recycling dashboard — Gold Recycler 🥇'}
        </p>
      </header>

      <div className="stat-grid">
        {stats.map(({ label, value, sub, icon: Icon, bg, color }) => (
          <article className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <span className="stat-icon" style={{ background: bg, color }}>
                <Icon size={17} />
              </span>
            </div>
            <strong>{value}</strong>
            <em>{sub}</em>
          </article>
        ))}
      </div>

      {children}
    </div>
  );
}

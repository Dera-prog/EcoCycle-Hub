import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Bell,
  BellOff,
  CalendarDays,
  LayoutDashboard,
  Leaf,
  LifeBuoy,
  LogOut,
  MapPin,
  Settings,
  Wallet as WalletIcon,
  X,
} from 'lucide-react';
import { Logo, useToast } from './ui';
import { useApp } from '../store';

const appNav = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/dashboard/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/dashboard/wallet', label: 'Wallet', icon: WalletIcon },
  { to: '/dashboard/impact', label: 'Eco Impact', icon: Leaf },
];

export default function AppShell() {
  const { unreadCount, notifications, markAllRead, user, persona, signOut } = useApp();
  const [panel, setPanel] = useState<'notifications' | 'profile' | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { show } = useToast();
  const initial = user.name.trim().charAt(0).toUpperCase() || 'E';

  useEffect(() => {
    setPanel(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPanel(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panel]);

  return (
    <div className="app-shell">
      <header className="app-bar">
        <div className="app-bar-inner">
          <Link to="/" className="app-exit" aria-label="Back to home">
            <X size={18} />
          </Link>
          <Link to="/dashboard" className="app-brand" aria-label="EcoCycle Hub dashboard">
            <Logo light compact />
          </Link>

          <nav className="app-nav" aria-label="Dashboard">
            {appNav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/dashboard'}
                className={({ isActive }) => `app-nav-link ${isActive ? 'is-active' : ''}`}
              >
                <Icon size={17} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="app-bar-actions">
            <button
              type="button"
              className="app-icon-btn"
              aria-label={`Notifications (${unreadCount} unread)`}
              aria-expanded={panel === 'notifications'}
              onClick={() => setPanel(panel === 'notifications' ? null : 'notifications')}
            >
              <Bell size={19} />
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </button>
            <button
              type="button"
              className="avatar-btn"
              aria-label="Profile"
              aria-expanded={panel === 'profile'}
              onClick={() => setPanel(panel === 'profile' ? null : 'profile')}
            >
              {initial}
            </button>
          </div>
        </div>
      </header>

      {panel && <div className="pop-backdrop" onClick={() => setPanel(null)} />}

      {panel === 'notifications' && (
        <section className="popover notif-pop" aria-label="Notifications">
          <header className="pop-head">
            <div>
              <h2>Notifications</h2>
              <p>{unreadCount > 0 ? `${unreadCount} unread updates` : 'You are all caught up'}</p>
            </div>
            <button type="button" className="link-btn" onClick={markAllRead} disabled={unreadCount === 0}>
              Mark all read
            </button>
          </header>
          <div className="notif-list">
            {notifications.length === 0 && (
              <div className="notif-empty">
                <span>
                  <BellOff size={20} />
                </span>
                <strong>No notifications yet</strong>
                <p>We’ll let you know the moment your first pickup is confirmed.</p>
              </div>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`notif-item ${n.read ? '' : 'is-unread'}`}
                onClick={() => setPanel(null)}
              >
                <span className={`notif-dot ${n.kind}`} aria-hidden="true" />
                <span className="notif-copy">
                  <strong>{n.title}</strong>
                  <span>{n.body}</span>
                  <em>{n.time}</em>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {panel === 'profile' && (
        <section className="popover profile-pop" aria-label="Profile menu">
          <div className="profile-head">
            <span className="avatar-lg">{initial}</span>
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
              <em>{persona === 'returning' ? '🥇 Gold Recycler' : '🌱 New Recycler'}</em>
            </div>
          </div>
          <nav className="profile-links">
            <button type="button" onClick={() => { setPanel(null); navigate('/dashboard'); }}>
              <BadgeCheck size={17} /> My Profile
            </button>
            <button type="button" onClick={() => { setPanel(null); navigate('/dashboard/wallet'); }}>
              <WalletIcon size={17} /> Wallet
            </button>
            <button type="button" onClick={() => { setPanel(null); navigate('/dashboard/impact'); }}>
              <Leaf size={17} /> My Badges
            </button>
            <button type="button" onClick={() => { setPanel(null); navigate('/track-agent'); }}>
              <MapPin size={17} /> Track Agent
            </button>
            <button type="button" onClick={() => { setPanel(null); show('Settings are available in the mobile app in this demo.'); }}>
              <Settings size={17} /> Settings
            </button>
            <button type="button" onClick={() => { setPanel(null); show('Support is online 8am – 6pm WAT.'); }}>
              <LifeBuoy size={17} /> Help
            </button>
          </nav>
          <button
            type="button"
            className="signout-btn"
            onClick={() => {
              setPanel(null);
              signOut();
              navigate('/sign-in');
            }}
          >
            <LogOut size={17} /> Sign Out
          </button>
        </section>
      )}

      <main className="app-main">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Bottom navigation">
        {appNav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) => `bottom-link ${isActive ? 'is-active' : ''}`}
          >
            <span className="bottom-icon">
              <Icon size={20} />
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

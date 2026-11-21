import { useEffect } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Logo } from './components/ui';
import ExploreMore from './components/ExploreMore';
import Home from './pages/Home';
import HowItWorks from './pages/HowItWorks';
import Categories from './pages/Categories';
import Impact from './pages/Impact';
import Products from './pages/Products';
import Pricing from './pages/Pricing';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import Wallet from './pages/Wallet';
import EcoImpact from './pages/EcoImpact';
import TrackAgent from './pages/TrackAgent';
import Ops from './pages/Ops';
import AppShell from './components/AppShell';

const marketingLinks = [
  { to: '/', label: 'Home' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/categories', label: 'Categories' },
  { to: '/impact', label: 'Impact' },
  { to: '/products', label: 'Products' },
  { to: '/pricing', label: 'Pricing' },
];

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

const routeTitles: Record<string, string> = {
  '/': 'EcoCycle Hub — Turn Waste Into Wealth & Impact',
  '/how-it-works': 'How It Works — EcoCycle Hub',
  '/categories': 'Categories — EcoCycle Hub',
  '/impact': 'Impact — EcoCycle Hub',
  '/products': 'Products — EcoCycle Hub',
  '/pricing': 'Pricing — EcoCycle Hub',
  '/sign-in': 'Sign In — EcoCycle Hub',
  '/sign-up': 'Sign Up — EcoCycle Hub',
  '/dashboard': 'Dashboard — EcoCycle Hub',
  '/dashboard/schedule': 'Schedule a Pickup — EcoCycle Hub',
  '/dashboard/wallet': 'Wallet — EcoCycle Hub',
  '/dashboard/impact': 'Eco Impact — EcoCycle Hub',
  '/track-agent': 'Track Agent — EcoCycle Hub',
  '/ops': 'Ops Console — EcoCycle Hub',
};

function RouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = routeTitles[pathname] ?? 'Page not found — EcoCycle Hub';
  }, [pathname]);
  return null;
}

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { hash } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname, hash]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <header className="marketing-header">
        <div className="container header-inner">
          <Link to="/" className="brand-link" aria-label="EcoCycle Hub home">
            <Logo />
          </Link>

          <nav className="desktop-nav" aria-label="Primary">
            {marketingLinks.slice(1).map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`nav-link ${pathname === link.to ? 'is-active' : ''}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="header-actions">
            <Link to="/sign-in" className="btn btn-ghost btn-sm">
              Sign In
            </Link>
            <Link to="/sign-up" className="btn btn-primary btn-sm header-cta">
              Get Started
            </Link>
            <button
              type="button"
              className="icon-btn menu-toggle"
              aria-label={open ? 'Close menu' : 'Toggle menu'}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="mobile-menu">
          <nav aria-label="Mobile">
            {marketingLinks.map((link) => (
              <Link key={link.to} to={link.to} className={pathname === link.to ? 'is-active' : ''}>
                {link.label}
              </Link>
            ))}
            <Link to="/sign-in">Sign In</Link>
            <Link to="/sign-up" className="btn btn-primary">
              Get Started Free
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}

export function MarketingSubNav() {
  const { pathname } = useLocation();
  return (
    <div className="subnav-bar">
      <div className="container subnav-inner">
        <Link to="/" className="subnav-back" aria-label="Back to home">
          <ArrowLeft size={15} />
          <span>Home</span>
        </Link>
        <nav className="subnav-links" aria-label="EcoCycle Hub sections">
          {marketingLinks.slice(1).map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`subnav-link ${pathname === link.to ? 'is-active' : ''}`}
              aria-current={pathname === link.to ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function MarketingLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <div className="marketing-shell">
      <MarketingHeader />
      {!isHome && <MarketingSubNav />}
      <main>
        <Outlet />
      </main>
      {!isHome && <ExploreMore current={pathname} />}
      <SiteFooter />
    </div>
  );
}

export function SiteFooter() {
  const navigate = useNavigate();
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Logo light />
          <p>
            Nigeria's leading recycling ecosystem connecting households, businesses, and recycling
            companies.
          </p>
        </div>
        <div className="footer-col">
          <h3>Platform</h3>
          <Link to="/how-it-works">How It Works</Link>
          <Link to="/categories">Categories</Link>
          <Link to="/impact">Eco Impact</Link>
          <Link to="/products">Products</Link>
          <Link to="/pricing">Pricing</Link>
        </div>
        <div className="footer-col">
          <h3>Account</h3>
          <Link to="/sign-in">Sign In</Link>
          <Link to="/sign-up">Create Account</Link>
          <button type="button" className="footer-link" onClick={() => navigate('/pricing#company')}>
            Partner with us
          </button>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© 2024 EcoCycle Hub Ltd. All rights reserved.</span>
        <span>Built for a circular Nigeria · Lagos · Abuja · Port Harcourt</span>
      </div>
    </footer>
  );
}

function NotFound() {
  return (
    <div className="not-found container">
      <h1>Page not found</h1>
      <p>The page you are looking for has been recycled into something better.</p>
      <Link to="/" className="btn btn-primary">
        Back to home
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <RouteTitle />
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/impact" element={<Impact />} />
          <Route path="/products" element={<Products />} />
          <Route path="/pricing" element={<Pricing />} />
        </Route>

        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />

        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/schedule" element={<Schedule />} />
          <Route path="/dashboard/wallet" element={<Wallet />} />
          <Route path="/dashboard/impact" element={<EcoImpact />} />
          <Route path="/track-agent" element={<TrackAgent />} />
          <Route path="/ops" element={<Ops />} />
        </Route>

        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

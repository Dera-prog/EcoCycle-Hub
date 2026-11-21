import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, LogIn, Mail, Phone } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import { useToast } from '../components/ui';
import { useApp } from '../store';

export default function SignIn() {
  const [params] = useSearchParams();
  const plan = params.get('plan');
  const [email, setEmail] = useState('amaka@gmail.com');
  const [password, setPassword] = useState('demo1234');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { show } = useToast();
  const { signInDemo, apiMode } = useApp();

  const enter = async (message: string) => {
    setBusy(true);
    const res = await signInDemo(email, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not sign in. Please try again.');
      return;
    }
    show(message);
    navigate('/dashboard');
  };

  const social = (provider: string) => {
    if (apiMode) {
      show(`${provider} sign-in isn’t connected yet — use your email and password.`);
      return;
    }
    setError('');
    void enter(`Signed in with ${provider}.`);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    void enter('Welcome back!');
  };

  return (
    <AuthLayout
      mode="signin"
      title="Welcome back"
      subtitle="Sign in to your EcoCycle account"
      icon={<LogIn size={25} />}
      plan={plan}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <label className="field">
          <span>Email address</span>
          <div className="input-wrap">
            <Mail size={17} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="amaka@gmail.com"
              autoComplete="email"
            />
          </div>
        </label>

        <label className="field">
          <span className="field-row">
            Password
            <button
              type="button"
              className="link-btn"
              onClick={() => show('Password reset link sent to ' + email)}
            >
              Forgot password?
            </button>
          </span>
          <div className="input-wrap">
            <Lock size={17} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="input-action"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>

        <label className="check-row">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>Keep me signed in on this device</span>
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign In'}
        </button>

        <p className="demo-hint">
          {apiMode
            ? 'Connected to the EcoCycle API — the seeded demo account is pre-filled.'
            : 'Demo account is pre-filled — press Sign In to explore with activity already on it.'}
        </p>

        <div className="auth-divider">
          <span>or continue with</span>
        </div>

        <div className="auth-socials">
          <button type="button" className="social-btn" onClick={() => social('Google')}>
            <span className="g-mark">G</span> Google
          </button>
          <button type="button" className="social-btn" onClick={() => social('Apple')}>
            <span aria-hidden="true">🍎</span> Apple
          </button>
          <button type="button" className="social-btn" onClick={() => social('Phone')}>
            <Phone size={16} /> Phone
          </button>
        </div>

        <p className="auth-switch">
          New to EcoCycle Hub?{' '}
          <Link to="/sign-up" className="link-btn strong">
            Create a free account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

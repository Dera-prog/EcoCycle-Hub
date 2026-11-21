import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, Phone, UserPlus, UserRound } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import PhoneAuth from '../components/PhoneAuth';
import { useToast } from '../components/ui';
import { useApp } from '../store';

const nextSteps = ['Schedule a free pickup', 'We collect & weigh it', 'Get paid to your bank'];

export default function SignUp() {
  const [params] = useSearchParams();
  const plan = params.get('plan');
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [name, setName] = useState('Chidi Okonkwo');
  const [email, setEmail] = useState('chidi@gmail.com');
  const [phone, setPhone] = useState('0803 555 0193');
  const [password, setPassword] = useState('demo1234');
  const [terms, setTerms] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { show } = useToast();
  const { signUpDemo, apiMode } = useApp();

  const create = async (firstName: string) => {
    setBusy(true);
    const res = await signUpDemo(name.trim(), email.trim(), phone, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not create your account. Please try again.');
      return;
    }
    show(`Account created — welcome, ${firstName}!`);
    navigate('/dashboard');
  };

  const social = (provider: string) => {
    if (provider === 'Phone' && apiMode) {
      setMethod('phone');
      return;
    }
    if (apiMode) {
      show(`${provider} sign-up isn’t connected yet — fill the form and create a free account.`);
      return;
    }
    setError('');
    void create(name.trim().split(' ')[0] || 'there');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setNotice('');
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Enter a valid Nigerian phone number.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!terms) {
      setError('Please accept the Terms of Service to continue.');
      return;
    }
    void create(cleanName.split(' ')[0]);
  };

  return (
    <AuthLayout
      mode="signup"
      title="Create your account"
      subtitle="Free to join — start earning from today’s pickup"
      icon={<UserPlus size={25} />}
      plan={plan}
    >
      {apiMode && (
        <div className="auth-tabs" role="tablist" aria-label="Sign-up method">
          <button
            type="button"
            role="tab"
            aria-selected={method === 'email'}
            className={`auth-tab ${method === 'email' ? 'is-active' : ''}`}
            onClick={() => setMethod('email')}
          >
            Email
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={method === 'phone'}
            className={`auth-tab ${method === 'phone' ? 'is-active' : ''}`}
            onClick={() => setMethod('phone')}
          >
            Phone
          </button>
        </div>
      )}

      {method === 'phone' && apiMode ? (
        <>
          <PhoneAuth
            mode="signup"
            onDone={() => {
              show('Account created with phone.');
              navigate('/dashboard');
            }}
          />
          <p className="auth-switch">
            Already recycling with us?{' '}
            <Link to="/sign-in" className="link-btn strong">
              Sign in
            </Link>
          </p>
        </>
      ) : (
        <form className="auth-form" onSubmit={submit} noValidate>
          <label className="field">
            <span>Full name</span>
            <div className="input-wrap">
              <UserRound size={17} />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Chidi Okonkwo"
                autoComplete="name"
              />
            </div>
          </label>

          <div className="auth-field-pair">
            <label className="field">
              <span>Email address</span>
              <div className="input-wrap">
                <Mail size={17} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="chidi@gmail.com"
                  autoComplete="email"
                />
              </div>
            </label>
            <label className="field">
              <span>Phone number</span>
              <div className="input-wrap">
                <Phone size={17} />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0803 555 0193"
                  autoComplete="tel"
                />
              </div>
            </label>
          </div>

          <label className="field">
            <span>Create password</span>
            <div className="input-wrap">
              <Lock size={17} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
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
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span>
              I agree to the{' '}
              <button type="button" className="link-btn" onClick={() => setNotice('Terms of Service are not included in this demo.')}>
                Terms of Service
              </button>{' '}
              and{' '}
              <button type="button" className="link-btn" onClick={() => setNotice('The Privacy Policy is not included in this demo.')}>
                Privacy Policy
              </button>
              .
            </span>
          </label>

          {notice && (
            <p className="form-info" role="status">
              {notice}
            </p>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Creating account…' : 'Create Free Account'}
          </button>

          <p className="demo-hint">
            {apiMode
              ? 'Connected to the EcoCycle API — this creates a real account in the local database.'
              : 'Demo mode — your details are pre-filled, no real account is created.'}
          </p>

          <ol className="auth-next" aria-label="What happens next">
            {nextSteps.map((step, i) => (
              <li key={step}>
                <span>{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>

          <div className="auth-divider">
            <span>or sign up with</span>
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
            Already recycling with us?{' '}
            <Link to="/sign-in" className="link-btn strong">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}

import { useState } from 'react';
import { ArrowLeft, KeyRound, Phone, UserRound } from 'lucide-react';
import { useApp } from '../store';

export default function PhoneAuth({ mode, onDone }: { mode: 'signin' | 'signup'; onDone: () => void }) {
  const { requestOtp, verifyOtp } = useApp();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState(mode === 'signup' ? '0803 555 0193' : '0803 555 0192');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [needsName, setNeedsName] = useState(mode === 'signup');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Enter a valid Nigerian phone number.');
      return;
    }
    setBusy(true);
    const res = await requestOtp(phone);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not send the code.');
      return;
    }
    setDevCode(res.devCode ?? '');
    setCode('');
    setStep('code');
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code.');
      return;
    }
    if (needsName && name.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    setBusy(true);
    const res = await verifyOtp(phone, code.trim(), needsName ? name.trim() : undefined);
    setBusy(false);
    if (!res.ok) {
      if (res.needsName) setNeedsName(true);
      setError(res.error ?? 'Could not verify the code.');
      return;
    }
    onDone();
  };

  return (
    <form className="auth-form" onSubmit={step === 'phone' ? send : verify} noValidate>
      {step === 'phone' ? (
        <>
          <label className="field">
            <span>Phone number</span>
            <div className="input-wrap">
              <Phone size={17} />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0803 555 0192"
                autoComplete="tel"
              />
            </div>
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Sending code…' : 'Send code'}
          </button>
          <p className="otp-hint">We’ll text a 6-digit code to this number.</p>
        </>
      ) : (
        <>
          <div className="otp-phone-row">
            <span>Code sent to {phone}</span>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setStep('phone');
                setError('');
                setDevCode('');
              }}
            >
              <ArrowLeft size={14} /> Change
            </button>
          </div>

          {needsName && (
            <label className="field">
              <span>Full name</span>
              <div className="input-wrap">
                <UserRound size={17} />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                />
              </div>
            </label>
          )}

          <label className="field otp-code">
            <span>Verification code</span>
            <div className="input-wrap">
              <KeyRound size={17} />
              <input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                autoComplete="one-time-code"
              />
            </div>
          </label>

          {devCode && (
            <p className="form-info" role="status">
              Development code: <strong>{devCode}</strong>
            </p>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Verifying…' : needsName ? 'Verify & create account' : 'Verify & sign in'}
          </button>
          <p className="otp-hint">Didn’t get it? Wait a minute, then tap Change to resend.</p>
        </>
      )}
    </form>
  );
}

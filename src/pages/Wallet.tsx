import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownToLine,
  Check,
  Landmark,
  Plus,
  Receipt,
  Share2,
  Wallet as WalletIcon,
} from 'lucide-react';
import DashHeader from '../components/DashHeader';
import { EmptyState, Modal, useToast } from '../components/ui';
import { useApp } from '../store';
import { formatNaira } from '../data';
import type { Payment } from '../types';

type Period = string;
const quickAmounts = [5000, 10000, 20000];
const badgeClass: Record<Payment['status'], string> = {
  Paid: 'badge-paid',
  Pending: 'badge-pending',
  Processing: 'badge-processing',
  Failed: 'badge-failed',
};

// Paystack transfer codes for the major Nigerian banks.
const NIGERIAN_BANKS = [
  { name: 'Access Bank', code: '044' },
  { name: 'Ecobank', code: '050' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'First City Monument Bank', code: '214' },
  { name: 'Guaranty Trust Bank', code: '058' },
  { name: 'Kuda Bank', code: '50211' },
  { name: 'Moniepoint MFB', code: '50515' },
  { name: 'OPay', code: '999992' },
  { name: 'PalmPay', code: '999991' },
  { name: 'Polaris Bank', code: '076' },
  { name: 'Providus Bank', code: '101' },
  { name: 'Stanbic IBTC Bank', code: '221' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'Union Bank of Nigeria', code: '032' },
  { name: 'United Bank for Africa', code: '033' },
  { name: 'Wema Bank', code: '035' },
  { name: 'Zenith Bank', code: '057' },
];

function paymentYear(p: Payment): number | null {
  if (p.createdAt) {
    const d = new Date(p.createdAt);
    if (!Number.isNaN(d.getTime())) return d.getFullYear();
  }
  const match = p.dateLabel.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

export default function Wallet() {
  const { balance, pending, payments, bank, withdraw, updateBank, totalEarned, persona, apiMode } = useApp();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [amount, setAmount] = useState('');
  const [bankOpen, setBankOpen] = useState(false);
  const [bankName, setBankName] = useState(bank.name);
  const [last4, setLast4] = useState(bank.last4);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [period, setPeriod] = useState<Period>('All time');
  const [submitting, setSubmitting] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [bankError, setBankError] = useState('');

  const linked = bank.last4.length === 4;
  const value = Number(amount) || 0;
  const valid = value > 0 && value <= balance;

  const years = useMemo(() => {
    const found = new Set<number>();
    payments.forEach((p) => {
      const year = paymentYear(p);
      if (year) found.add(year);
    });
    return Array.from(found).sort((a, b) => b - a);
  }, [payments]);

  const history = useMemo(() => {
    if (period === 'All time') return payments;
    const year = Number(period);
    return payments.filter((p) => {
      const found = paymentYear(p);
      return found === null || found === year;
    });
  }, [payments, period]);

  // The marketing persona keeps its designed demo figures; live accounts show
  // figures derived from their own payment rows.
  const stats = useMemo(() => {
    if (!apiMode && persona === 'returning') return { quarter: 25300, avg: 4017 };
    const now = new Date();
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    let quarter = 0;
    const months = new Set<string>();
    for (const p of payments) {
      if (p.company === 'Bank withdrawal' || !p.createdAt) continue;
      const d = new Date(p.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      if (d >= quarterStart) quarter += p.amount;
      months.add(`${d.getFullYear()}-${d.getMonth()}`);
    }
    return { quarter, avg: months.size > 0 ? Math.round(totalEarned / months.size) : 0 };
  }, [apiMode, persona, payments, totalEarned]);

  const openBank = () => {
    setBankName(linked ? bank.name : '');
    setLast4(linked ? bank.last4 : '');
    setBankCode(NIGERIAN_BANKS.find((b) => b.name === bank.name)?.code ?? '');
    setAccountNumber('');
    setAccountName('');
    setBankError('');
    setBankOpen(true);
  };

  const resetWithdraw = () => {
    setOpen(false);
    setStage(1);
    setAmount('');
    setWithdrawError('');
    setSubmitting(false);
  };

  const confirmWithdraw = async () => {
    if (submitting) return;
    setSubmitting(true);
    setWithdrawError('');
    const res = await withdraw(value);
    setSubmitting(false);
    if (!res.ok) {
      setWithdrawError(res.error ?? 'Withdrawal failed. Please try again.');
      return;
    }
    setStage(3);
    show(`${formatNaira(value)} withdrawal initiated.`);
  };

  const saveBank = async () => {
    setBankError('');
    if (apiMode) {
      const digits = accountNumber.replace(/\D/g, '');
      if (!bankName || !bankCode) {
        setBankError('Choose your bank.');
        return;
      }
      if (digits.length !== 10) {
        setBankError('Enter the 10-digit account number.');
        return;
      }
      const res = await updateBank({
        name: bankName,
        last4: digits.slice(-4),
        accountNumber: digits,
        bankCode,
        accountName: accountName.trim(),
      });
      if (!res.ok) {
        setBankError(res.error ?? 'Could not update your payout account.');
        return;
      }
    } else {
      const res = await updateBank({
        name: bankName || bank.name,
        last4: last4.replace(/\D/g, '').slice(-4) || bank.last4,
      });
      if (!res.ok) {
        setBankError(res.error ?? 'Could not update your payout account.');
        return;
      }
    }
    setBankOpen(false);
    show('Payout account updated.');
  };

  const share = async () => {
    const text = 'I recycle with EcoCycle Hub and earn from my waste. Join me!';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'EcoCycle Hub', text, url: window.location.origin });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
      show('Invite link copied to clipboard.');
    } catch {
      show('Share cancelled.');
    }
  };

  return (
    <DashHeader>
      <section className="balance-card">
        <div className="balance-top">
          <div>
            <span>Available Balance</span>
            <strong>{formatNaira(balance)}</strong>
            <em>Pending: {formatNaira(pending)}</em>
          </div>
          <span className="balance-period">{persona === 'returning' ? 'Dec 2024' : 'New account'}</span>
        </div>
        <div className="balance-actions">
          <button
            type="button"
            className="balance-btn primary"
            onClick={() => {
              if (balance <= 0) {
                show('No balance to withdraw yet — schedule a pickup to start earning.');
                return;
              }
              setOpen(true);
            }}
          >
            <ArrowDownToLine size={17} /> Withdraw
          </button>
          <Link to="/dashboard/schedule" className="balance-btn">
            <Plus size={17} /> New Pickup
          </Link>
          <button type="button" className="balance-btn" onClick={share}>
            <Share2 size={17} /> Share
          </button>
        </div>
      </section>

      <div className="wallet-stats">
        <article>
          <span>Total Earned</span>
          <strong className="green">{formatNaira(totalEarned)}</strong>
        </article>
        <article>
          <span>This Quarter</span>
          <strong className="blue">{formatNaira(stats.quarter)}</strong>
        </article>
        <article>
          <span>Avg/Month</span>
          <strong className="amber">{formatNaira(stats.avg)}</strong>
        </article>
      </div>

      <section className="card bank-card">
        <header>
          <h2>Linked Bank Account</h2>
          {linked && (
            <button type="button" className="link-btn" onClick={openBank}>
              Change
            </button>
          )}
        </header>
        <div className={`bank-row ${linked ? '' : 'is-unlinked'}`}>
          <span className="bank-icon">
            <Landmark size={19} />
          </span>
          <div>
            <strong>{linked ? bank.name : 'No payout account yet'}</strong>
            <span>{linked ? `•••• •••• ${bank.last4}` : 'Add a bank to withdraw your earnings'}</span>
          </div>
          {linked ? (
            <span className="bank-default">Default</span>
          ) : (
            <button type="button" className="link-btn" onClick={openBank}>
              Add
            </button>
          )}
        </div>
      </section>

      <section className="card payment-card">
        <header>
          <h2>Payment History</h2>
          <label className="select-mini">
            <span className="sr-only">Filter payment history</span>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              {['All time', ...years.map(String)].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        </header>

        <div className="payment-list">
          {history.map((p) => (
            <article className="payment-item" key={p.id}>
              <span className={`pay-icon ${p.status === 'Pending' ? 'is-pending' : ''}`}>
                <Receipt size={17} />
              </span>
              <div className="pay-copy">
                <strong>{p.company}</strong>
                <span>
                  {p.dateLabel}
                  {p.weight ? ` · ${p.weight} kg` : ''}
                </span>
                {p.failureReason && <span className="pay-reason">{p.failureReason}</span>}
              </div>
              <div className="pay-right">
                <strong>{formatNaira(p.amount)}</strong>
                <span className={`badge ${badgeClass[p.status]}`}>{p.status}</span>
              </div>
            </article>
          ))}
          {history.length === 0 &&
            (payments.length === 0 ? (
              <EmptyState>
                No payments yet. <Link to="/dashboard/schedule">Schedule your first pickup</Link> and
                your payout will appear here.
              </EmptyState>
            ) : (
              <EmptyState>No payments recorded for {period}. Try “All time”.</EmptyState>
            ))}
        </div>
      </section>

      <Modal
        open={open}
        onClose={resetWithdraw}
        title={stage === 3 ? (apiMode ? 'Withdrawal requested' : 'Withdrawal sent') : 'Withdraw Funds'}
        subtitle={stage === 1 ? 'Step 1 of 2' : stage === 2 ? 'Step 2 of 2' : undefined}
        footer={
          stage === 1 ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!valid}
              onClick={() => setStage(2)}
            >
              Continue →
            </button>
          ) : stage === 2 ? (
            <>
              <button type="button" className="btn btn-outline" onClick={() => setStage(1)}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void confirmWithdraw()}
                disabled={submitting}
              >
                {submitting ? 'Sending…' : 'Confirm Withdraw'}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={resetWithdraw}>
              Done
            </button>
          )
        }
      >
        {stage === 1 && (
          <div className="modal-form">
            <div className="withdraw-available">
              <span>Available Balance</span>
              <strong>{formatNaira(balance)}</strong>
            </div>
            <label className="field">
              <span>Amount to withdraw</span>
              <div className="input-wrap amount-wrap">
                <span className="naira-prefix">₦</span>
                <input
                  value={amount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, '');
                    setAmount(v);
                  }}
                  inputMode="numeric"
                  placeholder="0"
                  aria-label="Amount to withdraw"
                />
              </div>
            </label>
            <div className="quick-weight">
              <span>Quick amounts</span>
              <div>
                {quickAmounts.map((q) => (
                  <button type="button" key={q} className="chip" onClick={() => setAmount(String(q))}>
                    {formatNaira(q)}
                  </button>
                ))}
                <button type="button" className="chip" onClick={() => setAmount(String(balance))}>
                  {formatNaira(balance)}
                </button>
              </div>
            </div>
            {value > balance && <p className="form-error">Amount exceeds your available balance.</p>}
            <div className="bank-row compact">
              <span className="bank-icon">
                <Landmark size={17} />
              </span>
              <div>
                <strong>{bank.name}</strong>
                <span>•••• •••• {bank.last4}</span>
              </div>
              <button type="button" className="link-btn" onClick={openBank}>
                Change
              </button>
            </div>
          </div>
        )}

        {stage === 2 && (
          <div className="withdraw-review">
            <span className="withdraw-icon">
              <WalletIcon size={26} />
            </span>
            <span>You are withdrawing</span>
            <strong>{formatNaira(value)}</strong>
            <dl>
              <div>
                <dt>Fee</dt>
                <dd>₦0 (free)</dd>
              </div>
              <div>
                <dt>Destination</dt>
                <dd>
                  {bank.name} ···{bank.last4}
                </dd>
              </div>
              <div>
                <dt>Arrival</dt>
                <dd>{apiMode ? 'When your bank confirms' : 'Within 24 hours'}</dd>
              </div>
            </dl>
            {withdrawError && (
              <p className="form-error" role="alert">
                {withdrawError}
              </p>
            )}
          </div>
        )}

        {stage === 3 && (
          <div className="withdraw-success">
            <span className="success-mark">
              <Check size={30} strokeWidth={3} />
            </span>
            <h3>{formatNaira(value)} on its way</h3>
            <p>
              {apiMode
                ? `Your withdrawal to ${bank.name} •••• ${bank.last4} is queued. We'll notify you when your bank confirms the payment.`
                : `Your withdrawal to ${bank.name} •••• ${bank.last4} has been initiated and should arrive within 24 hours.`}
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={bankOpen}
        onClose={() => setBankOpen(false)}
        title="Update bank account"
        subtitle="Payouts are sent to this account"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setBankOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void saveBank()}>
              Save account
            </button>
          </>
        }
      >
        <div className="modal-form">
          {apiMode ? (
            <>
              <label className="field">
                <span>Bank</span>
                <div className="input-wrap">
                  <Landmark size={17} />
                  <select
                    value={bankCode}
                    onChange={(e) => {
                      const choice = NIGERIAN_BANKS.find((b) => b.code === e.target.value);
                      setBankCode(e.target.value);
                      setBankName(choice?.name ?? '');
                    }}
                    aria-label="Bank"
                  >
                    <option value="">Choose your bank</option>
                    {NIGERIAN_BANKS.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              <label className="field">
                <span>Account number</span>
                <div className="input-wrap">
                  <input
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="0123456789"
                    aria-label="Account number"
                  />
                </div>
              </label>
              <label className="field">
                <span>Account name</span>
                <div className="input-wrap">
                  <input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="As it appears on your bank account"
                    aria-label="Account name"
                  />
                </div>
              </label>
              <p className="modal-copy">
                Payouts are sent to this account. Only the last 4 digits are shown after it is saved.
              </p>
            </>
          ) : (
            <>
              <label className="field">
                <span>Bank name</span>
                <div className="input-wrap">
                  <Landmark size={17} />
                  <input value={bankName} onChange={(e) => setBankName(e.target.value)} />
                </div>
              </label>
              <label className="field">
                <span>Account number (last 4 shown)</span>
                <div className="input-wrap">
                  <input
                    value={last4}
                    onChange={(e) => setLast4(e.target.value)}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="4721"
                  />
                </div>
              </label>
              <p className="modal-copy">
                For your security, the full account number is never displayed after it is saved.
              </p>
            </>
          )}
          {bankError && (
            <p className="form-error" role="alert">
              {bankError}
            </p>
          )}
        </div>
      </Modal>
    </DashHeader>
  );
}

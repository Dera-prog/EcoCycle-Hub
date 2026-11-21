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

type Period = 'All time' | '2024' | '2023';
const quickAmounts = [5000, 10000, 20000];

export default function Wallet() {
  const { balance, pending, payments, bank, withdraw, updateBank, totalEarned, persona } = useApp();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [amount, setAmount] = useState('');
  const [bankOpen, setBankOpen] = useState(false);
  const [bankName, setBankName] = useState(bank.name);
  const [last4, setLast4] = useState(bank.last4);
  const [period, setPeriod] = useState<Period>('All time');

  const linked = bank.last4.length === 4;
  const value = Number(amount) || 0;
  const valid = value > 0 && value <= balance;

  const history = useMemo(() => {
    if (period === 'All time') return payments;
    if (period === '2023') return [];
    return payments.filter((p) => p.dateLabel.includes('2024') || p.status === 'Pending');
  }, [payments, period]);

  const resetWithdraw = () => {
    setOpen(false);
    setStage(1);
    setAmount('');
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
          <strong className="blue">{formatNaira(persona === 'returning' ? 25300 : totalEarned)}</strong>
        </article>
        <article>
          <span>Avg/Month</span>
          <strong className="amber">{formatNaira(persona === 'returning' ? 4017 : 0)}</strong>
        </article>
      </div>

      <section className="card bank-card">
        <header>
          <h2>Linked Bank Account</h2>
          {linked && (
            <button type="button" className="link-btn" onClick={() => setBankOpen(true)}>
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
            <button type="button" className="link-btn" onClick={() => setBankOpen(true)}>
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
            <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
              {(['All time', '2024', '2023'] as Period[]).map((p) => (
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
              </div>
              <div className="pay-right">
                <strong>{formatNaira(p.amount)}</strong>
                <span className={`badge ${p.status === 'Paid' ? 'badge-paid' : 'badge-pending'}`}>
                  {p.status}
                </span>
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
        title={stage === 3 ? 'Withdrawal sent' : 'Withdraw Funds'}
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
                onClick={() => {
                  withdraw(value);
                  setStage(3);
                  show(`${formatNaira(value)} withdrawal initiated.`);
                }}
              >
                Confirm Withdraw
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
              <button type="button" className="link-btn" onClick={() => setBankOpen(true)}>
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
                <dd>Within 24 hours</dd>
              </div>
            </dl>
          </div>
        )}

        {stage === 3 && (
          <div className="withdraw-success">
            <span className="success-mark">
              <Check size={30} strokeWidth={3} />
            </span>
            <h3>{formatNaira(value)} on its way</h3>
            <p>
              Your withdrawal to {bank.name} •••• {bank.last4} has been initiated and should arrive
              within 24 hours.
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
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                updateBank({ name: bankName || bank.name, last4: last4.replace(/\D/g, '').slice(-4) || bank.last4 });
                setBankOpen(false);
                show('Payout account updated.');
              }}
            >
              Save account
            </button>
          </>
        }
      >
        <div className="modal-form">
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
        </div>
      </Modal>
    </DashHeader>
  );
}

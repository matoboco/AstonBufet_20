import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { AccountBalance, AccountEntry } from '../types';
import { BalanceCard } from '../components/BalanceCard';
import { TransactionList } from '../components/TransactionList';
import { Logo } from '../components/Logo';

export const Dashboard = () => {
  const [balance, setBalance] = useState<AccountBalance | null>(null);
  const [transactions, setTransactions] = useState<AccountEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(false);
        const [balanceData, historyData] = await Promise.all([
          api<AccountBalance>('/account/my-balance'),
          api<AccountEntry[]>('/account/my-history'),
        ]);
        setBalance(balanceData);
        setTransactions(historyData);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4 pt-safe">
        <Logo className="h-7" />
      </header>

      {/* Content */}
      <main className="p-4 space-y-6">
        {/* Balance Card */}
        <BalanceCard balance={balance} loading={loading} error={error} />

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Link
            to="/products"
            className="card flex flex-col items-center py-6 hover:shadow-md transition-shadow"
          >
            <svg
              className="w-10 h-10 text-primary-500 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <span className="font-medium">Nákup</span>
          </Link>

          <Link
            to="/products?scan=true"
            className="card flex flex-col items-center py-6 hover:shadow-md transition-shadow"
          >
            <svg
              className="w-10 h-10 text-primary-500 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              />
            </svg>
            <span className="font-medium">Skenovať</span>
          </Link>
        </div>

        {/* Recent Transactions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Posledné transakcie</h2>
            <Link to="/history" className="text-primary-600 text-sm font-medium">
              Zobraziť všetky
            </Link>
          </div>
          <TransactionList
            transactions={transactions}
            loading={loading}
            limit={5}
          />
        </div>
      </main>
    </div>
  );
};

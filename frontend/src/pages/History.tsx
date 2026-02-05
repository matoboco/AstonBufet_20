import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { AccountEntry } from '../types';
import { TransactionList } from '../components/TransactionList';

export const History = () => {
  const [transactions, setTransactions] = useState<AccountEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await api<AccountEntry[]>('/account/my-history');
        setTransactions(data);
      } catch (error) {
        console.error('Failed to fetch history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4 pt-safe">
        <h1 className="text-xl font-bold">História transakcií</h1>
      </header>

      {/* Transactions */}
      <main className="p-4">
        <TransactionList transactions={transactions} loading={loading} />
      </main>
    </div>
  );
};

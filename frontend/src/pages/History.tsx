import { useEffect, useState, useCallback } from 'react';
import { api } from '../utils/api';
import { AccountEntry } from '../types'
import { TransactionList } from '../components/TransactionList';

const checkForUpdates = async (): Promise<{ hasUpdate: boolean; serverVersion?: string }> => {
  try {
    // Add cache-busting query param to bypass service worker cache
    const response = await fetch(`/version.json?t=${Date.now()}`);
    if (response.ok) {
      const data = await response.json();
      const serverBuildTime = data.buildTime;
      if (serverBuildTime && serverBuildTime !== __BUILD_TIME__) {
        return { hasUpdate: true, serverVersion: data.version };
      }
    }
  } catch {
    // Ignore errors
  }
  return { hasUpdate: false };
};

export const History = () => {
  const [transactions, setTransactions] = useState<AccountEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);

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

  // Check for updates on mount
  useEffect(() => {
    checkForUpdates().then(({ hasUpdate }) => setHasUpdate(hasUpdate));
  }, []);

  const handleUpdate = useCallback(async () => {
    setUpdating(true);
    try {
      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }
      // Clear caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      // Reload page
      window.location.reload();
    } catch (error) {
      console.error('Update failed:', error);
      setUpdating(false);
    }
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

      {/* Version info */}
      <footer className="p-4 text-center text-xs text-gray-400">
        <p>
          v{__APP_VERSION__}{__GIT_COMMIT__ && ` (${__GIT_COMMIT__})`}
        </p>
        <p>
          Build: {new Date(__BUILD_TIME__).toLocaleString('sk-SK', { timeZone: 'UTC' })} UTC
        </p>
        <button
          onClick={handleUpdate}
          disabled={updating}
          className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
            hasUpdate
              ? 'bg-primary-500 text-white'
              : 'bg-gray-200 text-gray-600'
          }`}
        >
          <svg
            className={`w-4 h-4 ${updating ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {updating ? 'Aktualizujem...' : hasUpdate ? 'Načítať novú verziu' : 'Skontrolovať aktualizácie'}
        </button>
      </footer>
    </div>
  );
};

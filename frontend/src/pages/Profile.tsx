import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import { AccountEntry } from '../types';

const checkForUpdates = async (): Promise<{ hasUpdate: boolean; serverVersion?: string }> => {
  try {
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

export const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AccountEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchHistory();
    checkForUpdates().then(({ hasUpdate }) => setHasUpdate(hasUpdate));
  }, []);

  const fetchHistory = async () => {
    try {
      const data = await api<AccountEntry[]>('/account/my-history');
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await updateProfile(name);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa uložiť');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = useCallback(async () => {
    setUpdating(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      window.location.reload();
    } catch (error) {
      console.error('Update failed:', error);
      setUpdating(false);
    }
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('sk-SK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 p-4 pt-safe">
        <h1 className="text-xl font-bold">Profil</h1>
      </header>

      <main className="p-4 space-y-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Osobné údaje</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="text"
              className="input bg-gray-100"
              value={user?.email || ''}
              disabled
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meno
            </label>
            <input
              type="text"
              className="input"
              placeholder="Tvoje meno"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Použije sa v emailových pripomienkach
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {saved && (
            <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm">
              Meno bolo uložené
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary w-full"
          >
            {saving ? 'Ukladám...' : 'Uložiť'}
          </button>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">História nákupov</h2>

          {loadingHistory ? (
            <div className="animate-pulse space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Žiadna história</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {entry.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(entry.created_at)}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      entry.amount_cents >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {entry.amount_cents >= 0 ? '+' : ''}
                    {(entry.amount_cents / 100).toFixed(2)} €
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card bg-gray-50 text-center">
          <p className="text-xs text-gray-500">
            v{__APP_VERSION__}{__GIT_COMMIT__ && ` (${__GIT_COMMIT__})`}
          </p>
          <p className="text-xs text-gray-400">
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
        </div>
      </main>
    </div>
  );
};

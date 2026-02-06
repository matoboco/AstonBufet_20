import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import { AccountEntry } from '../types';

const APP_VERSION = '1.0.0';

export const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AccountEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetchHistory();
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
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profil</h1>

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
            placeholder="Vaše meno"
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
          <div className="space-y-2 max-h-80 overflow-y-auto">
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

      <div className="card bg-gray-50">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Verzia aplikácie</span>
          <span className="text-sm font-mono text-gray-900">{APP_VERSION}</span>
        </div>
      </div>
    </div>
  );
};

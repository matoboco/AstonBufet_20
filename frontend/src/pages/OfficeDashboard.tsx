import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { AccountBalance, StockBatch, Product } from '../types';
import { BarcodeScanner } from '../components/BarcodeScanner';

export const OfficeDashboard = () => {
  const [activeTab, setActiveTab] = useState<'debtors' | 'stock'>('debtors');
  const [debtors, setDebtors] = useState<AccountBalance[]>([]);
  const [stock, setStock] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Deposit modal
  const [depositModal, setDepositModal] = useState<AccountBalance | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositNote, setDepositNote] = useState('');
  const [depositing, setDepositing] = useState(false);

  // Add stock modal
  const [showAddStock, setShowAddStock] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [stockForm, setStockForm] = useState({
    ean: '',
    name: '',
    quantity: '',
    price_cents: '',
  });
  const [addingStock, setAddingStock] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [debtorsData, stockData] = await Promise.all([
        api<AccountBalance[]>('/admin/debtors'),
        api<StockBatch[]>('/stock'),
      ]);
      setDebtors(debtorsData);
      setStock(stockData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSendReminders = async () => {
    try {
      const result = await api<{ message: string }>('/admin/reminder', {
        method: 'POST',
      });
      setMessage({ type: 'success', text: result.message });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Nepodarilo sa odoslať pripomienky',
      });
    }
  };

  const handleDeposit = async () => {
    if (!depositModal) return;

    setDepositing(true);
    try {
      await api('/account/deposit', {
        method: 'POST',
        body: {
          user_id: depositModal.id,
          amount_cents: Math.round(parseFloat(depositAmount) * 100),
          note: depositNote || undefined,
        },
      });
      setMessage({ type: 'success', text: `Vklad ${depositAmount} € pre ${depositModal.email} úspešný` });
      setDepositModal(null);
      setDepositAmount('');
      setDepositNote('');
      await fetchData();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Vklad sa nepodaril',
      });
    } finally {
      setDepositing(false);
    }
  };

  const handleScan = async (ean: string) => {
    setShowScanner(false);
    setStockForm((f) => ({ ...f, ean }));

    // Try to find existing product
    try {
      const product = await api<Product>(`/products/by-ean/${ean}`, { auth: false });
      setStockForm((f) => ({
        ...f,
        name: product.name,
        price_cents: (product.price_cents / 100).toString(),
      }));
    } catch {
      // Product not found, user needs to enter name
    }
  };

  const handleAddStock = async () => {
    setAddingStock(true);
    try {
      await api('/stock/add-batch', {
        method: 'POST',
        body: {
          ean: stockForm.ean,
          name: stockForm.name || undefined,
          quantity: parseInt(stockForm.quantity),
          price_cents: Math.round(parseFloat(stockForm.price_cents) * 100),
        },
      });
      setMessage({ type: 'success', text: 'Sklad bol aktualizovaný' });
      setShowAddStock(false);
      setStockForm({ ean: '', name: '', quantity: '', price_cents: '' });
      await fetchData();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Nepodarilo sa pridať na sklad',
      });
    } finally {
      setAddingStock(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-primary-500 text-white p-4 pt-safe">
        <h1 className="text-xl font-bold">Office Dashboard</h1>
      </header>

      {/* Message */}
      {message && (
        <div
          className={`mx-4 mt-4 p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {message.text}
          <button
            className="float-right font-bold"
            onClick={() => setMessage(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4">
        <div className="flex">
          <button
            className={`py-3 px-4 font-medium border-b-2 ${
              activeTab === 'debtors'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500'
            }`}
            onClick={() => setActiveTab('debtors')}
          >
            Dlžníci
          </button>
          <button
            className={`py-3 px-4 font-medium border-b-2 ${
              activeTab === 'stock'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500'
            }`}
            onClick={() => setActiveTab('stock')}
          >
            Sklad
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="p-4">
        {activeTab === 'debtors' && (
          <div className="space-y-4">
            <button
              className="btn btn-primary w-full"
              onClick={handleSendReminders}
            >
              Odoslať pripomienky (dlh &gt; 5€)
            </button>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-6 bg-gray-200 rounded w-20"></div>
                  </div>
                ))}
              </div>
            ) : debtors.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Žiadni dlžníci
              </div>
            ) : (
              <div className="space-y-2">
                {debtors.map((debtor) => (
                  <div
                    key={debtor.id}
                    className="card flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{debtor.email}</p>
                      <p className="text-xl font-bold text-red-500">
                        {Number(debtor.balance_eur).toFixed(2)} €
                      </p>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => setDepositModal(debtor)}
                    >
                      Vklad
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stock' && (
          <div className="space-y-4">
            <button
              className="btn btn-primary w-full"
              onClick={() => setShowAddStock(true)}
            >
              Pridať na sklad
            </button>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : stock.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Sklad je prázdny
              </div>
            ) : (
              <div className="space-y-2">
                {stock.map((batch) => (
                  <div key={batch.id} className="card">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{batch.product_name}</p>
                        <p className="text-sm text-gray-500">
                          {batch.product_ean}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary-600">
                          {batch.quantity} ks
                        </p>
                        <p className="text-sm text-gray-500">
                          {(Number(batch.price_cents) / 100).toFixed(2)} €/ks
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Pridané:{' '}
                      {new Date(batch.created_at).toLocaleDateString('sk-SK')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Deposit Modal */}
      {depositModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-4">Vklad</h2>
            <p className="text-gray-600 mb-4">{depositModal.email}</p>
            <p className="text-red-500 font-bold mb-4">
              Aktuálny zostatok: {Number(depositModal.balance_eur).toFixed(2)} €
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Suma (€)
              </label>
              <input
                type="number"
                className="input"
                placeholder="0.00"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                step="0.01"
                min="0"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Poznámka (voliteľné)
              </label>
              <input
                type="text"
                className="input"
                placeholder="Vyrovnanie dlhu"
                value={depositNote}
                onChange={(e) => setDepositNote(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button
                className="btn btn-secondary flex-1"
                onClick={() => {
                  setDepositModal(null);
                  setDepositAmount('');
                  setDepositNote('');
                }}
                disabled={depositing}
              >
                Zrušiť
              </button>
              <button
                className="btn btn-primary flex-1"
                onClick={handleDeposit}
                disabled={depositing || !depositAmount}
              >
                {depositing ? 'Spracúvam...' : 'Potvrdiť'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {showAddStock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-4">Pridať na sklad</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                EAN kód
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="1234567890123"
                  value={stockForm.ean}
                  onChange={(e) =>
                    setStockForm((f) => ({ ...f, ean: e.target.value }))
                  }
                />
                <button
                  className="btn btn-secondary p-3"
                  onClick={() => setShowScanner(true)}
                >
                  <svg
                    className="w-6 h-6"
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
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Názov produktu (pre nový produkt)
              </label>
              <input
                type="text"
                className="input"
                placeholder="Napr. Káva"
                value={stockForm.name}
                onChange={(e) =>
                  setStockForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Množstvo (ks)
                </label>
                <input
                  type="number"
                  className="input"
                  placeholder="10"
                  value={stockForm.quantity}
                  onChange={(e) =>
                    setStockForm((f) => ({ ...f, quantity: e.target.value }))
                  }
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cena (€/ks)
                </label>
                <input
                  type="number"
                  className="input"
                  placeholder="1.20"
                  value={stockForm.price_cents}
                  onChange={(e) =>
                    setStockForm((f) => ({ ...f, price_cents: e.target.value }))
                  }
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                className="btn btn-secondary flex-1"
                onClick={() => {
                  setShowAddStock(false);
                  setStockForm({ ean: '', name: '', quantity: '', price_cents: '' });
                }}
                disabled={addingStock}
              >
                Zrušiť
              </button>
              <button
                className="btn btn-primary flex-1"
                onClick={handleAddStock}
                disabled={
                  addingStock ||
                  !stockForm.ean ||
                  !stockForm.quantity ||
                  !stockForm.price_cents
                }
              >
                {addingStock ? 'Pridávam...' : 'Pridať'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner */}
      {showScanner && (
        <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
};

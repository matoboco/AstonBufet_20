import { ShortageWarning } from '../types';

interface ShortageWarningModalProps {
  warning: ShortageWarning;
  onAcknowledge: () => void;
  loading?: boolean;
}

export const ShortageWarningModal = ({ warning, onAcknowledge, loading }: ShortageWarningModalProps) => {
  if (!warning.has_warning) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Upozornenie - Manko</h2>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-center text-red-700">
            Pri poslednej inventúre bolo zistené manko v celkovej výške:
          </p>
          <div className="text-center my-2">
            <p className="text-3xl font-bold text-red-600">
              {warning.total_shortage} ks
            </p>
            {warning.total_value_eur !== undefined && warning.total_value_eur > 0 && (
              <p className="text-xl font-semibold text-red-500">
                ({warning.total_value_eur.toFixed(2)} EUR)
              </p>
            )}
          </div>
          {warning.shortage_since && (
            <p className="text-center text-sm text-red-600">
              od {new Date(warning.shortage_since).toLocaleDateString('sk-SK')}
            </p>
          )}
        </div>

        {warning.adjustments && warning.adjustments.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Detail manka:</p>
            <div className="bg-gray-50 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
              {warning.adjustments.map((adj, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-600">{adj.product_name}</span>
                  <span className="text-red-600 font-medium">
                    {Math.abs(adj.difference)} ks ({adj.value_eur.toFixed(2)} EUR)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            <strong>Pripomienka:</strong> Nezabudnite si pri odbere tovaru z bufetu
            vždy zaznamenať nákup v aplikácii. Pomáhate tak udržiavať presný prehľad o stave skladu.
          </p>
        </div>

        <button
          className="btn btn-primary w-full"
          onClick={onAcknowledge}
          disabled={loading}
        >
          {loading ? 'Spracúvam...' : 'Beriem na vedomie'}
        </button>
      </div>
    </div>
  );
};

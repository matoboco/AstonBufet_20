import { AccountBalance } from '../types';

interface BalanceCardProps {
  balance: AccountBalance | null;
  loading?: boolean;
  error?: boolean;
}

export const BalanceCard = ({ balance, loading, error }: BalanceCardProps) => {
  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
        <div className="h-8 bg-gray-200 rounded w-32"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-red-50 border border-red-200">
        <p className="text-sm text-red-600 mb-1">Chyba pripojenia</p>
        <p className="text-red-700 font-medium">
          Backend nie je dostupný
        </p>
        <p className="text-xs text-red-500 mt-1">
          Nie je možné zistiť aktuálny stav účtu
        </p>
      </div>
    );
  }

  const balanceValue = Number(balance?.balance_eur) || 0;
  const isNegative = balanceValue < 0;
  const isPositive = balanceValue > 0;

  return (
    <div className="card">
      <p className="text-sm text-gray-500 mb-1">Aktuálny zostatok</p>
      <p
        className={`text-3xl font-bold ${
          isNegative
            ? 'text-red-500'
            : isPositive
            ? 'text-green-500'
            : 'text-gray-700'
        }`}
      >
        {balanceValue.toFixed(2)} €
      </p>
      {isNegative && (
        <p className="text-xs text-red-400 mt-1">
          Prosím, vyrovnajte svoj dlh
        </p>
      )}
    </div>
  );
};

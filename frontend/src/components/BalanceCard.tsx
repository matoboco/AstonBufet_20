import { AccountBalance } from '../types';

interface BalanceCardProps {
  balance: AccountBalance | null;
  loading?: boolean;
}

export const BalanceCard = ({ balance, loading }: BalanceCardProps) => {
  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
        <div className="h-8 bg-gray-200 rounded w-32"></div>
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

import { AccountEntry } from '../types';

interface TransactionListProps {
  transactions: AccountEntry[];
  loading?: boolean;
  limit?: number;
}

export const TransactionList = ({
  transactions,
  loading,
  limit,
}: TransactionListProps) => {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  const displayTransactions = limit
    ? transactions.slice(0, limit)
    : transactions;

  if (displayTransactions.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        Zatiaľ žiadne transakcie
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayTransactions.map((tx) => {
        const amountCents = Number(tx.amount_cents);
        const isNegative = amountCents < 0;
        const amountEur = Math.abs(amountCents) / 100;
        const runningBalance = Number(tx.running_balance_eur) || 0;
        const date = new Date(tx.created_at);

        return (
          <div key={tx.id} className="card flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{tx.description}</p>
              <p className="text-xs text-gray-500">
                {date.toLocaleDateString('sk-SK')}{' '}
                {date.toLocaleTimeString('sk-SK', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div className="text-right ml-4">
              <p
                className={`font-semibold ${
                  isNegative ? 'text-red-500' : 'text-green-500'
                }`}
              >
                {isNegative ? '-' : '+'}
                {amountEur.toFixed(2)} €
              </p>
              <p className="text-xs text-gray-500">
                {runningBalance.toFixed(2)} €
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

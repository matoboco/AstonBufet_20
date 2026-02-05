import { useState } from 'react';
import { Product } from '../types';

interface PurchaseModalProps {
  product: Product;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const PurchaseModal = ({
  product,
  onConfirm,
  onCancel,
  loading,
}: PurchaseModalProps) => {
  const [quantity, setQuantity] = useState(1);
  const priceCents = Number(product.price_cents) || 0;
  const stockQty = Number(product.stock_quantity) || 0;
  const priceEur = priceCents / 100;
  const total = priceEur * quantity;

  const maxQuantity = Math.min(stockQty, 10);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Potvrdiť nákup</h2>

          <div className="mb-4">
            <p className="font-semibold text-lg">{product.name}</p>
            <p className="text-sm text-gray-500">{product.ean}</p>
            <p className="text-primary-600 font-bold mt-1">
              {priceEur.toFixed(2)} € / ks
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Množstvo
            </label>
            <div className="flex items-center gap-4">
              <button
                className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-xl"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                -
              </button>
              <span className="text-2xl font-bold w-12 text-center">
                {quantity}
              </span>
              <button
                className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-xl"
                onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                disabled={quantity >= maxQuantity}
              >
                +
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Na sklade: {stockQty} ks
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Celkom:</span>
              <span className="text-2xl font-bold text-primary-600">
                {total.toFixed(2)} €
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              className="btn btn-secondary flex-1"
              onClick={onCancel}
              disabled={loading}
            >
              Zrušiť
            </button>
            <button
              className="btn btn-primary flex-1"
              onClick={() => onConfirm(quantity)}
              disabled={loading}
            >
              {loading ? 'Spracúvam...' : 'Kúpiť'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

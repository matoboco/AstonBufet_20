import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onPurchase: (product: Product) => void;
}

export const ProductCard = ({ product, onPurchase }: ProductCardProps) => {
  const priceEur = Number(product.price_cents) / 100;
  const stockQty = Number(product.stock_quantity) || 0;
  const inStock = stockQty > 0;

  return (
    <div className="card flex flex-col">
      <div className="flex-1">
        <h3 className="font-semibold text-lg">{product.name}</h3>
        <p className="text-sm text-gray-500">{product.ean}</p>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div>
          <p className="text-xl font-bold text-primary-600">
            {priceEur.toFixed(2)} €
          </p>
          <p
            className={`text-xs ${
              inStock ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {inStock ? `Na sklade: ${stockQty}` : 'Vypredané'}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => onPurchase(product)}
          disabled={!inStock}
        >
          Kúpiť
        </button>
      </div>
    </div>
  );
};

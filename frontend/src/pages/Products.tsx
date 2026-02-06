import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import { Product, PurchaseResponse } from '../types';
import { ProductCard } from '../components/ProductCard';
import { PurchaseModal } from '../components/PurchaseModal';
import { BarcodeScanner } from '../components/BarcodeScanner';

export const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [showScanner, setShowScanner] = useState(searchParams.get('scan') === 'true');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchProducts = async () => {
    try {
      const data = await api<Product[]>('/products');
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Auto-dismiss error messages after 5 seconds
  useEffect(() => {
    if (message?.type === 'error') {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (searchParams.get('scan') === 'true') {
      setShowScanner(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const handleScan = async (ean: string) => {
    setShowScanner(false);
    const product = products.find((p) => p.ean === ean);
    if (product) {
      setSelectedProduct(product);
    } else {
      try {
        const scannedProduct = await api<Product>(`/products/by-ean/${ean}`, { auth: false });
        setSelectedProduct(scannedProduct);
      } catch {
        setMessage({ type: 'error', text: `Produkt s EAN ${ean} nebol nájdený` });
      }
    }
  };

  const handlePurchase = async (quantity: number) => {
    if (!selectedProduct) return;

    setPurchasing(true);
    try {
      const result = await api<PurchaseResponse>('/purchases', {
        method: 'POST',
        body: {
          product_id: selectedProduct.id,
          quantity,
        },
      });

      setMessage({
        type: 'success',
        text: `Nákup úspešný: ${quantity}x ${selectedProduct.name} za ${Number(result.purchase.total_eur).toFixed(2)} €`,
      });

      // Close modal immediately after successful purchase
      setPurchasing(false);
      setSelectedProduct(null);

      // Refresh products in background to update stock
      fetchProducts();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Nákup sa nepodaril',
      });
      setPurchasing(false);
      setSelectedProduct(null);
    }
  };

  // Remove diacritics for search (e.g., "čokoláda" -> "cokolada")
  const removeDiacritics = (str: string): string => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  };

  // Filter products: only show in-stock items, apply search
  const filteredProducts = products.filter((p) => {
    // Hide sold out products
    const stockQty = Number(p.stock_quantity) || 0;
    if (stockQty <= 0) return false;

    // Apply search filter
    const searchNorm = removeDiacritics(search);
    const nameNorm = removeDiacritics(p.name);
    return nameNorm.includes(searchNorm) || p.ean.includes(search);
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4 pt-safe sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              className="input pl-10"
              placeholder="Hľadať produkt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <svg
              className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <button
            className="btn btn-primary p-3"
            onClick={() => {
              setMessage(null);
              setShowScanner(true);
            }}
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
                d="M4 6h2v12H4zM8 6h1v12H8zM11 6h2v12h-2zM15 6h1v12h-1zM18 6h2v12h-2z"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Message */}
      {message && (
        <div
          className={`mx-4 mt-4 p-3 rounded-lg flex items-start justify-between gap-2 ${
            message.type === 'success'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          <span className="flex-1">{message.text}</span>
          <button
            className="w-8 h-8 flex items-center justify-center font-bold text-xl shrink-0 -mr-1 -mt-1 hover:bg-black/10 rounded"
            onClick={() => setMessage(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Products */}
      <main className="p-4">
        {loading ? (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="flex justify-between">
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                  <div className="h-10 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {search
              ? 'Žiadne produkty zodpovedajúce vyhľadávaniu'
              : products.length > 0
              ? 'Všetky produkty sú vypredané'
              : 'Zatiaľ žiadne produkty'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onPurchase={() => setSelectedProduct(product)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Purchase Modal */}
      {selectedProduct && (
        <PurchaseModal
          product={selectedProduct}
          onConfirm={handlePurchase}
          onCancel={() => setSelectedProduct(null)}
          loading={purchasing}
        />
      )}

      {/* Barcode Scanner */}
      {showScanner && (
        <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
};

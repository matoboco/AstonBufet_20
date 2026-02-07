import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

interface LoginProps {
  onSuccess: () => void;
}

export const Login = ({ onSuccess }: LoginProps) => {
  const { requestCode, verifyCode } = useAuth();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Normalize email to lowercase
    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);

    // Validate @aston.sk emails - must use short format without dots
    if (normalizedEmail.endsWith('@aston.sk')) {
      const localPart = normalizedEmail.split('@')[0];
      if (localPart.includes('.')) {
        setError('Prosím, použi krátku emailovú adresu v tvare mpriezvisko@aston.sk (bez bodky)');
        return;
      }
    }

    setLoading(true);

    try {
      await requestCode(normalizedEmail);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa odoslať kód');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await verifyCode(email, code, name || undefined);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neplatný kód');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-400 to-primary-600 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Aston Bufet 2.0</h1>
            <p className="text-gray-500 mt-2">
              {step === 'email'
                ? 'Prihlás sa pomocou firemného emailu'
                : 'Zadaj kód z emailu'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleRequestCode}>
              <div className="mb-4">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  className="input"
                  placeholder="vas.email@firma.sk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading}
              >
                {loading ? 'Odosielam...' : 'Poslať kód'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode}>
              <div className="mb-4">
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Meno (voliteľné)
                </label>
                <input
                  type="text"
                  id="name"
                  className="input"
                  placeholder="Vaše meno"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Použije sa v emailových pripomienkach
                </p>
              </div>
              <div className="mb-4">
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Overovací kód
                </label>
                <input
                  type="text"
                  id="code"
                  className="input text-center text-2xl tracking-widest"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  maxLength={6}
                  inputMode="numeric"
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Kód bol odoslaný na {email}
                </p>
              </div>
              <button
                type="submit"
                className="btn btn-primary w-full mb-3"
                disabled={loading || code.length !== 6}
              >
                {loading ? 'Overujem...' : 'Prihlásiť sa'}
              </button>
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setName('');
                  setError(null);
                }}
              >
                Späť
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

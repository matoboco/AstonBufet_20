import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Navigation } from './components/Navigation';
import { ShortageWarningModal } from './components/ShortageWarningModal';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { OfficeDashboard } from './pages/OfficeDashboard';
import { Profile } from './pages/Profile';
import { api } from './utils/api';
import { ShortageWarning } from './types';

function App() {
  const { loading, isAuthenticated, isOfficeAssistant } = useAuth();
  const [shortageWarning, setShortageWarning] = useState<ShortageWarning | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);

  // Check for shortage warning on app load
  useEffect(() => {
    if (isAuthenticated && !isOfficeAssistant) {
      api<ShortageWarning>('/account/shortage-warning')
        .then(setShortageWarning)
        .catch(console.error);
    }
  }, [isAuthenticated, isOfficeAssistant]);

  const handleAcknowledgeShortage = async () => {
    setAcknowledging(true);
    try {
      await api('/account/acknowledge-shortage', { method: 'POST' });
      setShortageWarning(null);
    } catch (error) {
      console.error('Failed to acknowledge shortage:', error);
    } finally {
      setAcknowledging(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onSuccess={() => window.location.reload()} />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/profile" element={<Profile />} />
          {isOfficeAssistant && (
            <Route path="/office" element={<OfficeDashboard />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Navigation isOfficeAssistant={isOfficeAssistant} />

        {/* Shortage Warning Modal */}
        {shortageWarning?.has_warning && (
          <ShortageWarningModal
            warning={shortageWarning}
            onAcknowledge={handleAcknowledgeShortage}
            loading={acknowledging}
          />
        )}
      </div>
    </BrowserRouter>
  );
}

export default App;

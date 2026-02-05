import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Navigation } from './components/Navigation';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { History } from './pages/History';
import { OfficeDashboard } from './pages/OfficeDashboard';

function App() {
  const { loading, isAuthenticated, isOfficeAssistant, logout } = useAuth();

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
          <Route path="/" element={<Dashboard onLogout={logout} />} />
          <Route path="/products" element={<Products />} />
          <Route path="/history" element={<History />} />
          {isOfficeAssistant && (
            <Route path="/office" element={<OfficeDashboard />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Navigation isOfficeAssistant={isOfficeAssistant} />
      </div>
    </BrowserRouter>
  );
}

export default App;

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Movements from './components/Movements';
import Services from './components/Services';
import Reports from './components/Reports';
import Orders from './components/Orders';
import Equipment from './components/Equipment';
import Employees from './components/Employees';
import Confirmations from './components/Confirmations';
import Projects from './components/Projects';
import Login from './components/Login';
import { AuthProvider, useAuth } from './lib/AuthContext';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-neutral-900 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/estoque" element={<Inventory />} />
        <Route path="/movimentacao" element={<Movements />} />
        <Route path="/pedidos" element={<Orders />} />
        <Route path="/equipamentos" element={<Equipment />} />
        <Route path="/confirmacoes" element={<Confirmations />} />
        <Route path="/servicos" element={<Services />} />
        <Route path="/funcionarios" element={<Employees />} />
        <Route path="/empreendimentos" element={<Projects />} />
        <Route path="/relatorios" element={<Reports />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" richColors />
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

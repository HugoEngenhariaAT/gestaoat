import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, ArrowLeftRight, HardHat, FileBarChart, ShoppingCart, Menu, X, Wrench, DollarSign, LogOut, User as UserIcon, Key, CheckCircle2, Building2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/AuthContext';
import { getSupabase } from '../lib/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const { profile, signOut } = useAuth();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = async () => {
    if (!profile) return;
    try {
      const supabase = getSupabase();
      
      // Fetch relevant orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('status, requested_by_id, pickup_by_id')
        .in('status', ['AWAITING_PICKUP', 'PICKED_UP', 'DELIVERED'])
        .or(`requested_by_id.eq.${profile.id},pickup_by_id.eq.${profile.id}`);
      
      if (ordersError) throw ordersError;

      const pendingOrders = (orders || []).filter(order => {
        if (profile.role === 'ADMIN' || profile.role === 'DEV') return true;
        if (order.status === 'AWAITING_PICKUP' && order.pickup_by_id === profile.id) return true;
        if (order.status === 'PICKED_UP' && order.pickup_by_id === profile.id) return true;
        if (order.status === 'DELIVERED' && order.requested_by_id === profile.id) return true;
        return false;
      });

      // Fetch pending equipment movements
      const { data: moves, error: movesError } = await supabase
        .from('equipment_movements')
        .select('id')
        .eq('to_responsible_id', profile.id)
        .eq('status', 'PENDING');

      if (movesError) throw movesError;

      setPendingCount(pendingOrders.length + (moves?.length || 0));
    } catch (err) {
      console.error('Error fetching pending count:', err);
    }
  };

  React.useEffect(() => {
    fetchPendingCount();
    // Refresh every minute
    const interval = setInterval(fetchPendingCount, 60000);
    return () => clearInterval(interval);
  }, [profile]);

  const handleUpdatePassword = async () => {
    if (!profile || !newPassword) return;
    
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setIsUpdating(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.rpc('admin_update_user_password', {
        target_user_id: profile.id,
        new_password: newPassword
      });

      if (error) throw error;

      toast.success('Sua senha foi alterada com sucesso!');
      setIsPasswordModalOpen(false);
      setNewPassword('');
    } catch (err) {
      console.error('Erro ao alterar senha:', err);
      toast.error('Erro ao alterar senha: ' + (err as Error).message);
    } finally {
      setIsUpdating(false);
    }
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Estoque', path: '/estoque', icon: Package },
    { name: 'Movimentação', path: '/movimentacao', icon: ArrowLeftRight },
    { name: 'Pedidos', path: '/pedidos', icon: ShoppingCart },
    { name: 'Equipamentos', path: '/equipamentos', icon: Wrench },
    { name: 'Confirmações', path: '/confirmacoes', icon: CheckCircle2 },
    { name: 'Serviços', path: '/servicos', icon: HardHat },
    { name: 'Empreendimentos', path: '/empreendimentos', icon: Building2, roles: ['DEV', 'ADMIN'] },
    { name: 'Funcionários', path: '/funcionarios', icon: UserIcon, roles: ['DEV', 'ADMIN'] },
    { name: 'Relatórios', path: '/relatorios', icon: FileBarChart, roles: ['DEV', 'ADMIN'] },
  ];

  const filteredNavItems = navItems.filter(item => 
    !item.roles || (profile && item.roles.includes(profile.role))
  );

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-neutral-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 flex shrink-0">
            <div className="w-1/2 h-full bg-brand-light rounded-l-sm"></div>
            <div className="w-1/2 h-full bg-brand-dark rounded-r-sm"></div>
          </div>
          <h1 className="text-xl font-black text-brand-dark tracking-tighter">HUGO <span className="font-light text-neutral-900">ENGENHARIA</span></h1>
        </div>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-neutral-600">
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <nav className={cn(
        "fixed inset-0 z-40 bg-white border-r border-neutral-200 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 md:w-64",
        isMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 hidden md:block">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 flex shrink-0 shadow-sm">
              <div className="w-1/2 h-full bg-brand-light rounded-l-md"></div>
              <div className="w-1/2 h-full bg-brand-dark rounded-r-md"></div>
            </div>
            <div>
              <h1 className="text-xl font-black text-brand-dark tracking-tighter leading-none">HUGO</h1>
              <h1 className="text-base font-light text-neutral-900 tracking-[0.2em] leading-none mt-1 uppercase">Engenharia</h1>
            </div>
          </div>
          <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-[0.3em]">Gestão de Obras</p>
        </div>

        <div className="flex-1 px-4 py-4 overflow-y-auto">
          <div className="space-y-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative",
                    isActive 
                      ? "bg-brand-dark text-white shadow-lg shadow-brand-dark/20" 
                      : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  <Icon size={20} />
                  <span className="font-medium flex-1">{item.name}</span>
                  {item.path === '/confirmacoes' && pendingCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-neutral-100 space-y-4 mb-24 md:mb-0">
            <div className="flex items-center gap-3 px-4 py-2">
              <div className="w-8 h-8 rounded-full bg-brand-dark text-white flex items-center justify-center text-xs font-bold ring-2 ring-brand-light/20">
                {profile?.email?.substring(0, 2).toUpperCase() || '??'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-neutral-900 truncate">{profile?.email}</p>
                <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">
                  {profile?.role === 'DEV' ? 'Nível 0 - Desenvolvedor' : 
                   profile?.role === 'ADMIN' ? 'Nível 1 - Administrador' :
                   profile?.role === 'FOREMAN' ? 'Nível 2 - Encarregado' :
                   'Nível 3 - Funcionário'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsPasswordModalOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 rounded-xl transition-colors"
            >
              <Key size={18} />
              <span className="font-medium">Alterar Senha</span>
            </button>
            <button 
              onClick={signOut}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut size={18} />
              <span className="font-medium">Sair</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-2 py-2 flex items-center justify-around z-50 safe-area-bottom">
        {[
          { name: 'Home', path: '/', icon: LayoutDashboard },
          { name: 'Pedidos', path: '/pedidos', icon: ShoppingCart },
          { name: 'Equip.', path: '/equipamentos', icon: Wrench },
          { name: 'Conf.', path: '/confirmacoes', icon: CheckCircle2, badge: pendingCount },
          { name: 'Logs', path: '/servicos', icon: HardHat },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all relative",
                isActive ? "text-brand-dark" : "text-neutral-400"
              )}
            >
              <div className={cn(
                "p-1 rounded-lg transition-all",
                isActive ? "bg-brand-light/10" : ""
              )}>
                <Icon size={20} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tighter">{item.name}</span>
              {item.badge && item.badge > 0 && (
                <span className="absolute top-0 right-2 bg-red-500 text-white text-[8px] font-bold px-1 rounded-full min-w-[14px] text-center">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Password Change Modal */}
      <AnimatePresence>
        {isPasswordModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900 italic serif">Alterar Minha Senha</h3>
                <button 
                  onClick={() => {
                    setIsPasswordModalOpen(false);
                    setNewPassword('');
                  }} 
                  className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Nova Senha</label>
                  <input 
                    type="text" 
                    placeholder="Digite sua nova senha"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <p className="mt-1 text-[10px] text-neutral-400 italic">Mínimo de 6 caracteres.</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setIsPasswordModalOpen(false);
                      setNewPassword('');
                    }}
                    className="flex-1 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpdatePassword}
                    disabled={isUpdating || !newPassword || newPassword.length < 6}
                    className="flex-1 py-3 bg-brand-dark text-white rounded-xl font-bold hover:bg-brand-dark/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-dark/20"
                  >
                    {isUpdating ? 'Atualizando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

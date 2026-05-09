import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Plus, 
  Search, 
  Phone, 
  Briefcase, 
  Mail, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  X,
  Shield,
  UserPlus
} from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { Profile, Order, UserRole } from '../types';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';
import { differenceInDays, parseISO } from 'date-fns';

export default function Employees() {
  const { profile: currentProfile } = useAuth();
  const isAdmin = currentProfile?.role === 'ADMIN' || currentProfile?.role === 'DEV';
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [newEmployee, setNewEmployee] = useState({
    username: '',
    password: '',
    full_name: '',
    position: '',
    phone: '',
    role: 'USER' as UserRole,
    is_active: true,
    password_record: ''
  });

  const [editingEmployee, setEditingEmployee] = useState<Profile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Profile | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabase();
      const [profilesRes, ordersRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').not('requested_by_id', 'is', null)
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (ordersRes.error) throw ordersRes.error;

      setEmployees(profilesRes.data || []);
      setOrders(ordersRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const supabase = getSupabase();
      
      toast.info('Iniciando cadastro de funcionário...');

      const internalEmail = newEmployee.username ? (newEmployee.username.includes('@') ? newEmployee.username : `${newEmployee.username.toLowerCase().replace(/\s+/g, '').trim()}@hugo.com`) : `${newEmployee.full_name.toLowerCase().replace(/\s+/g, '').trim()}@hugo.com`;

      // Use RPC to create user and profile in one go without logging out the admin
      const { data: newUserId, error: createError } = await supabase.rpc('admin_create_user', {
        user_email: internalEmail,
        user_password: newEmployee.password,
        user_full_name: newEmployee.full_name,
        user_role: newEmployee.role,
        user_position: newEmployee.position,
        user_phone: newEmployee.phone
      });

      if (createError) throw createError;

      if (newUserId) {
        toast.success('Funcionário cadastrado com sucesso!');
        setIsModalOpen(false);
        fetchData();
        setNewEmployee({
          username: '',
          password: '',
          full_name: '',
          position: '',
          phone: '',
          role: 'USER',
          is_active: true,
          password_record: ''
        });
      } else {
        throw new Error('Não foi possível criar o usuário.');
      }
    } catch (err) {
      console.error('Erro no cadastro:', err);
      toast.error('Erro ao cadastrar: ' + (err as Error).message);
    }
  };

  const handleToggleActive = async (employee: Profile) => {
    if (!isAdmin) return;
    
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !employee.is_active })
        .eq('id', employee.id);

      if (error) throw error;
      
      toast.success(`Funcionário ${employee.is_active ? 'desativado' : 'ativado'} com sucesso!`);
      fetchData();
    } catch (err) {
      toast.error('Erro ao alterar status: ' + (err as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!employeeToDelete || currentProfile?.role !== 'DEV') return;

    try {
      const supabase = getSupabase();
      
      const { error } = await supabase.rpc('admin_delete_user', {
        user_id: employeeToDelete.id
      });

      if (error) throw error;
      
      toast.success('Funcionário excluído permanentemente!');
      setIsDeleteModalOpen(false);
      setEmployeeToDelete(null);
      fetchData();
    } catch (err) {
      console.error('Erro ao excluir:', err);
      toast.error('Erro ao excluir: ' + (err as Error).message);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editingEmployee.full_name,
          position: editingEmployee.position,
          phone: editingEmployee.phone,
          role: editingEmployee.role,
          is_active: editingEmployee.is_active,
          password_record: editingEmployee.password_record
        })
        .eq('id', editingEmployee.id);

      if (error) throw error;

      toast.success('Dados atualizados com sucesso!');
      setIsEditModalOpen(false);
      setIsChangingPassword(false);
      setNewPassword('');
      fetchData();
    } catch (err) {
      toast.error('Erro ao atualizar: ' + (err as Error).message);
    }
  };

  const handleUpdatePassword = async () => {
    if (!editingEmployee || currentProfile?.role !== 'DEV' || !newPassword) return;
    
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    try {
      const supabase = getSupabase();
      const { error } = await supabase.rpc('admin_update_user_password', {
        target_user_id: editingEmployee.id,
        new_password: newPassword
      });

      if (error) throw error;

      toast.success('Senha alterada com sucesso!');
      setEditingEmployee({ ...editingEmployee, password_record: newPassword });
      setIsChangingPassword(false);
      setNewPassword('');
      fetchData();
    } catch (err) {
      console.error('Erro ao alterar senha:', err);
      toast.error('Erro ao alterar senha: ' + (err as Error).message);
    }
  };

  const calculateLeadTime = (employeeId: string) => {
    const employeeOrders = orders.filter(o => o.requested_by_id === employeeId && o.created_at && o.use_date);
    if (employeeOrders.length === 0) return null;

    const totalDays = employeeOrders.reduce((sum, order) => {
      const created = new Date(order.created_at);
      const use = parseISO(order.use_date);
      return sum + differenceInDays(use, created);
    }, 0);

    return totalDays / employeeOrders.length;
  };

  const filteredEmployees = employees.filter(emp => 
    emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.position?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-neutral-900 italic serif">Funcionários</h2>
          <p className="text-neutral-500">Gestão de equipe e indicadores de antecedência</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200"
          >
            <UserPlus size={20} />
            Novo Funcionário
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
        <input 
          type="text"
          placeholder="Buscar por nome, cargo ou e-mail..."
          className="w-full pl-12 pr-4 py-4 bg-white border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-neutral-900 shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
          </div>
        ) : (
          <>
            {filteredEmployees.map((emp) => {
              const avgLeadTime = calculateLeadTime(emp.id);
              const isAlert = avgLeadTime !== null && avgLeadTime < 3;
              
              return (
                <motion.div 
                  key={emp.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center text-neutral-600">
                        <User size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-neutral-900">{emp.full_name || 'Sem Nome'}</h4>
                        <p className="text-xs text-neutral-500 flex items-center gap-1">
                          <Briefcase size={12} /> {emp.position || 'Cargo não informado'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {emp.role === 'DEV' && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-lg flex items-center gap-1">
                          <Shield size={10} /> DEV
                        </span>
                      )}
                      {emp.role === 'ADMIN' && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-lg flex items-center gap-1">
                          <Shield size={10} /> ADMIN
                        </span>
                      )}
                      {emp.role === 'FOREMAN' && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-lg flex items-center gap-1">
                          <Shield size={10} /> ENCARREGADO
                        </span>
                      )}
                      {emp.role === 'USER' && (
                        <span className="px-2 py-1 bg-neutral-100 text-neutral-600 text-[10px] font-bold rounded-lg flex items-center gap-1">
                          <User size={10} /> FUNCIONÁRIO
                        </span>
                      )}
                      {!emp.is_active && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-lg flex items-center gap-1">
                          INATIVO
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-neutral-50">
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <Mail size={14} className="text-neutral-400" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <Phone size={14} className="text-neutral-400" />
                      <span>{emp.phone || 'N/A'}</span>
                    </div>
                    {isAdmin && emp.is_active && emp.password_record && (
                      <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono bg-neutral-50 p-1 rounded">
                        <span>Senha: {emp.password_record}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    {isAdmin && (
                      <>
                        <button 
                          onClick={() => {
                            setEditingEmployee(emp);
                            setIsEditModalOpen(true);
                          }}
                          className="flex-1 py-2 bg-neutral-100 text-neutral-600 rounded-xl text-xs font-bold hover:bg-neutral-200 transition-all"
                        >
                          Editar
                        </button>
                        <button 
                          onClick={() => handleToggleActive(emp)}
                          className={cn(
                            "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                            emp.is_active 
                              ? "bg-red-50 text-red-600 hover:bg-red-100" 
                              : "bg-green-50 text-green-600 hover:bg-green-100"
                          )}
                        >
                          {emp.is_active ? 'Desativar' : 'Ativar'}
                        </button>
                      </>
                    )}
                      {currentProfile?.role === 'DEV' && (
                        <button 
                          onClick={() => {
                            setEmployeeToDelete(emp);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-2 text-neutral-400 hover:text-red-600 transition-colors"
                          title="Excluir Permanentemente"
                        >
                          <X size={16} />
                        </button>
                      )}
                  </div>

                  <div className="mt-6 p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Antecedência Média</span>
                      {avgLeadTime !== null && (
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          isAlert ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                        )}>
                          {isAlert ? 'ALERTA' : 'OK'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={16} className={cn(isAlert ? "text-red-500" : "text-neutral-400")} />
                      <span className="text-xl font-bold text-neutral-900">
                        {avgLeadTime !== null ? `${avgLeadTime.toFixed(1)} dias` : 'Sem dados'}
                      </span>
                    </div>
                    {isAlert && (
                      <p className="mt-2 text-[10px] text-red-600 flex items-center gap-1">
                        <AlertTriangle size={10} /> Abaixo do mínimo de 3 dias
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
            {filteredEmployees.length === 0 && (
              <div className="col-span-full p-12 text-center text-neutral-500 bg-white rounded-3xl border border-dashed border-neutral-200">
                Nenhum funcionário encontrado.
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {isEditModalOpen && editingEmployee && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900 italic serif">Editar Funcionário</h3>
                <button 
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setIsChangingPassword(false);
                    setNewPassword('');
                  }} 
                  className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleUpdate} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Nome Completo</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={editingEmployee.full_name || ''}
                    onChange={(e) => setEditingEmployee({...editingEmployee, full_name: e.target.value.toUpperCase()})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Cargo</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={editingEmployee.position || ''}
                      onChange={(e) => setEditingEmployee({...editingEmployee, position: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Telefone</label>
                    <input 
                      required
                      type="tel" 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={editingEmployee.phone || ''}
                      onChange={(e) => setEditingEmployee({...editingEmployee, phone: e.target.value.toUpperCase()})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Nível de Acesso</label>
                  <select 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={editingEmployee.role}
                    onChange={(e) => setEditingEmployee({...editingEmployee, role: e.target.value as UserRole})}
                  >
                    <option value="USER">Funcionário</option>
                    <option value="FOREMAN">Encarregado</option>
                    <option value="ADMIN">Administrador</option>
                    {currentProfile?.role === 'DEV' && <option value="DEV">Desenvolvedor</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Senha Registrada (Visualização)</label>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        readOnly
                        className="flex-1 px-4 py-3 bg-neutral-100 border border-neutral-200 rounded-xl focus:outline-none text-neutral-500"
                        value={editingEmployee.password_record || ''}
                      />
                      {currentProfile?.role === 'DEV' && !isChangingPassword && (
                        <button
                          type="button"
                          onClick={() => setIsChangingPassword(true)}
                          className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold hover:bg-neutral-800 transition-all"
                        >
                          Alterar Senha
                        </button>
                      )}
                    </div>

                    {isChangingPassword && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-3"
                      >
                        <input 
                          type="text" 
                          placeholder="Nova senha (mín. 6 caracteres)"
                          className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleUpdatePassword}
                            className="flex-1 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-all"
                          >
                            Confirmar Nova Senha
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsChangingPassword(false);
                              setNewPassword('');
                            }}
                            className="px-3 py-2 bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold hover:bg-neutral-300 transition-all"
                          >
                            Cancelar
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-neutral-400 italic">Apenas desenvolvedores podem alterar a senha de acesso.</p>
                </div>

                <div className="flex items-center gap-2 py-2">
                  <input 
                    type="checkbox" 
                    id="is_active_edit"
                    className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                    checked={editingEmployee.is_active}
                    onChange={(e) => setEditingEmployee({...editingEmployee, is_active: e.target.checked})}
                  />
                  <label htmlFor="is_active_edit" className="text-sm font-bold text-neutral-700">Usuário Ativo</label>
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200">
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900 italic serif">Novo Funcionário</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Nome Completo</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    placeholder="Ex: João Silva"
                    value={newEmployee.full_name}
                    onChange={(e) => setNewEmployee({...newEmployee, full_name: e.target.value.toUpperCase()})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Cargo</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      placeholder="Ex: Encarregado"
                      value={newEmployee.position}
                      onChange={(e) => setNewEmployee({...newEmployee, position: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Telefone</label>
                    <input 
                      required
                      type="tel" 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      placeholder="(00) 00000-0000"
                      value={newEmployee.phone}
                      onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value.toUpperCase()})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Nome de Usuário (Acesso)</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    placeholder="Ex: joao.silva"
                    value={newEmployee.username}
                    onChange={(e) => setNewEmployee({...newEmployee, username: e.target.value.toLowerCase().replace(/\s+/g, '')})}
                  />
                  <p className="mt-1 text-[10px] text-neutral-400 italic">Este nome será usado para entrar no sistema.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Senha Inicial</label>
                  <input 
                    required
                    type="password" 
                    minLength={6}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    placeholder="Mínimo 6 caracteres"
                    value={newEmployee.password}
                    onChange={(e) => setNewEmployee({...newEmployee, password: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Nível de Acesso</label>
                  <select 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee({...newEmployee, role: e.target.value as UserRole})}
                  >
                    <option value="USER">Nível 3 - Funcionário (Padrão)</option>
                    <option value="FOREMAN">Nível 2 - Encarregado</option>
                    <option value="ADMIN">Nível 1 - Administrador</option>
                    {currentProfile?.role === 'DEV' && <option value="DEV">Nível 0 - Desenvolvedor</option>}
                  </select>
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200">
                    Cadastrar Funcionário
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isDeleteModalOpen && employeeToDelete && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2 italic serif">Confirmar Exclusão</h3>
              <p className="text-neutral-500 text-sm mb-8">
                Tem certeza que deseja excluir permanentemente o funcionário <span className="font-bold text-neutral-900">{employeeToDelete.full_name}</span>? 
                Esta ação não pode ser desfeita.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleDelete}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                >
                  Sim, Excluir Permanentemente
                </button>
                <button 
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setEmployeeToDelete(null);
                  }}
                  className="w-full py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-200 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

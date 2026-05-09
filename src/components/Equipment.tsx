import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Filter, 
  Wrench, 
  User, 
  Building2, 
  History, 
  ArrowRightLeft,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  MoreVertical,
  Lock
} from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { Equipment, EquipmentMovement, Profile } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';

const StatusBadge = ({ status }: { status: Equipment['status'] }) => {
  const statusConfig = {
    AVAILABLE: { label: 'Disponível', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    IN_USE: { label: 'Em Uso', color: 'bg-blue-100 text-blue-700', icon: Clock },
    MAINTENANCE: { label: 'Manutenção', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
    LOST: { label: 'Extraviado', color: 'bg-red-100 text-red-700', icon: X },
  };
  const config = statusConfig[status];
  return (
    <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 w-fit", config.color)}>
      <config.icon size={12} />
      {config.label}
    </span>
  );
};

export default function EquipmentManager() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'DEV';
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [movements, setMovements] = useState<EquipmentMovement[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [view, setView] = useState<'list' | 'history'>('list');
  const [displayMode, setDisplayMode] = useState<'grid' | 'table'>('table');

  const [newEquipment, setNewEquipment] = useState({
    name: '',
    code: '',
    category: '',
    status: 'AVAILABLE' as Equipment['status'],
    current_responsible: null as string | null,
    current_project: null as string | null,
    last_revision: null as string | null,
  });

  const [revisionData, setRevisionData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    responsible: profile?.full_name || profile?.email || '',
  });

  const [newMovement, setNewMovement] = useState({
    to_responsible: '',
    to_responsible_id: '',
    to_project: '',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabase();
      const [equipRes, moveRes, profilesRes] = await Promise.all([
        supabase.from('equipment').select('*').order('name'),
        supabase.from('equipment_movements').select('*, equipment:equipment(*)').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('full_name', { ascending: true })
      ]);

      if (equipRes.error) toast.error('Erro ao buscar equipamentos: ' + equipRes.error.message);
      else setEquipment(equipRes.data || []);

      if (moveRes.error) toast.error('Erro ao buscar histórico: ' + moveRes.error.message);
      else setMovements(moveRes.data || []);

      if (profilesRes.error) console.error('Error fetching profiles:', profilesRes.error);
      else setEmployees(profilesRes.data || []);
    } catch (err) {
      console.error('Error fetching equipment data:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Apenas administradores podem cadastrar equipamentos.');
      return;
    }

    try {
      const supabase = getSupabase();
      const { error } = await supabase.from('equipment').insert([newEquipment]);

      if (error) throw error;
      
      toast.success('Equipamento cadastrado com sucesso!');
      setIsModalOpen(false);
      fetchData();
      setNewEquipment({
        name: '',
        code: '',
        category: '',
        status: 'AVAILABLE',
        current_responsible: null,
        current_project: null,
        last_revision: null,
      });
    } catch (err) {
      toast.error('Erro ao cadastrar equipamento: ' + (err as Error).message);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment || !isAdmin) return;

    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('equipment')
        .update({
          name: newEquipment.name,
          code: newEquipment.code,
          category: newEquipment.category,
          status: newEquipment.status,
        })
        .eq('id', selectedEquipment.id);

      if (error) throw error;
      
      toast.success('Equipamento atualizado com sucesso!');
      setIsEditModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error('Erro ao atualizar equipamento: ' + (err as Error).message);
    }
  };

  const handleAddRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment || !isAdmin) return;

    try {
      const supabase = getSupabase();
      const currentRevisions = selectedEquipment.revisions || [];
      const updatedRevisions = [revisionData, ...currentRevisions];

      const { error } = await supabase
        .from('equipment')
        .update({
          revisions: updatedRevisions,
          last_revision: revisionData.date
        })
        .eq('id', selectedEquipment.id);

      if (error) throw error;
      
      toast.success('Revisão registrada com sucesso!');
      setIsRevisionModalOpen(false);
      setRevisionData({
        date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        responsible: profile?.full_name || profile?.email || '',
      });
      fetchData();
    } catch (err) {
      toast.error('Erro ao registrar revisão: ' + (err as Error).message);
    }
  };

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment) return;

    try {
      const supabase = getSupabase();
      
      // 1. Create movement record
      const { error: moveError } = await supabase.from('equipment_movements').insert([{
        equipment_id: selectedEquipment.id,
        from_responsible: selectedEquipment.current_responsible,
        to_responsible: newMovement.to_responsible,
        to_responsible_id: newMovement.to_responsible_id || null,
        from_project: selectedEquipment.current_project,
        to_project: newMovement.to_project,
        notes: newMovement.notes,
        status: 'PENDING'
      }]);

      if (moveError) throw moveError;

      toast.success('Movimentação solicitada! O destinatário precisa confirmar o recebimento.');
      setIsMoveModalOpen(false);
      fetchData();
      setNewMovement({ to_responsible: '', to_responsible_id: '', to_project: '', notes: '' });
    } catch (err) {
      toast.error('Erro ao movimentar equipamento: ' + (err as Error).message);
    }
  };

  const handleConfirmMove = async (movementId: string) => {
    try {
      const supabase = getSupabase();
      const movement = movements.find(m => m.id === movementId);
      if (!movement) return;

      // 1. Update movement status
      const { error: moveError } = await supabase
        .from('equipment_movements')
        .update({ status: 'CONFIRMED' })
        .eq('id', movementId);

      if (moveError) throw moveError;

      // 2. Update equipment current state
      const { error: equipError } = await supabase
        .from('equipment')
        .update({
          current_responsible: movement.to_responsible,
          current_project: movement.to_project,
          status: 'IN_USE'
        })
        .eq('id', movement.equipment_id);

      if (equipError) throw equipError;

      toast.success('Recebimento confirmado com sucesso!');
      fetchData();
    } catch (err) {
      toast.error('Erro ao confirmar recebimento: ' + (err as Error).message);
    }
  };

  const filteredEquipment = equipment.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 italic serif">Equipamentos e Ferramentas</h2>
          <p className="text-sm text-neutral-500">Controle de localização, responsabilidade e manutenção</p>
        </div>
        <div className="flex overflow-x-auto pb-2 md:pb-0 gap-2 no-scrollbar shrink-0">
          <button 
            onClick={() => setDisplayMode(displayMode === 'grid' ? 'table' : 'grid')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-medium hover:bg-neutral-50 transition-colors whitespace-nowrap"
          >
            {displayMode === 'grid' ? <MoreVertical size={16} /> : <Filter size={16} />}
            {displayMode === 'grid' ? 'Tabela' : 'Grade'}
          </button>
          <button 
            onClick={() => setView(view === 'list' ? 'history' : 'list')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-medium hover:bg-neutral-50 transition-colors whitespace-nowrap"
          >
            {view === 'list' ? <History size={16} /> : <Wrench size={16} />}
            {view === 'list' ? 'Histórico' : 'Equipamentos'}
          </button>
          {isAdmin && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="hidden md:flex items-center gap-2 px-6 py-2 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all whitespace-nowrap"
            >
              <Plus size={20} />
              Novo
            </button>
          )}
        </div>
      </div>

      {/* Mobile Floating Action Button */}
      {isAdmin && (
        <button 
          onClick={() => setIsModalOpen(true)}
          className="md:hidden fixed bottom-20 right-6 z-40 w-14 h-14 bg-neutral-900 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all"
        >
          <Plus size={28} />
        </button>
      )}

      {view === 'list' ? (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome, código ou categoria..." 
              className="w-full pl-12 pr-4 py-3 bg-white border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
            />
          </div>

          {/* Grid/Table */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900"></div>
            </div>
          ) : displayMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEquipment.map((item) => (
                <EquipmentCard 
                  key={item.id} 
                  item={item} 
                  isAdmin={isAdmin}
                  profileId={profile?.id}
                  movements={movements}
                  onMove={() => {
                    setSelectedEquipment(item);
                    setIsMoveModalOpen(true);
                  }}
                  onEdit={() => {
                    setSelectedEquipment(item);
                    setNewEquipment({
                      name: item.name,
                      code: item.code,
                      category: item.category,
                      status: item.status,
                      current_responsible: item.current_responsible || null,
                      current_project: item.current_project || null,
                      last_revision: item.last_revision || null,
                    });
                    setIsEditModalOpen(true);
                  }}
                  onRevision={() => {
                    setSelectedEquipment(item);
                    setIsRevisionModalOpen(true);
                  }}
                  onConfirm={handleConfirmMove}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-neutral-50">
                      <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Equipamento</th>
                      <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Responsável</th>
                      <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Local</th>
                      <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Última Revisão</th>
                      <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredEquipment.map((item) => {
                      const pendingMove = movements.find(m => m.equipment_id === item.id && m.status === 'PENDING');
                      return (
                        <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-neutral-900">{item.name}</div>
                            <div className="text-xs text-neutral-400">{item.code} • {item.category}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <StatusBadge status={item.status} />
                              {pendingMove && (
                                <div className="flex flex-col gap-1">
                                  <div className="text-[10px] text-orange-600 font-bold animate-pulse">
                                    Aguardando confirmação: {pendingMove.to_responsible}
                                  </div>
                                  {profile?.id === pendingMove.to_responsible_id && (
                                    <button 
                                      onClick={() => handleConfirmMove(pendingMove.id)}
                                      className="text-[10px] bg-orange-600 text-white px-2 py-0.5 rounded-lg hover:bg-orange-700 transition-colors font-bold uppercase tracking-wider w-fit"
                                    >
                                      Confirmar Recebimento
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-600">
                            {item.current_responsible || 'Estoque Central'}
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-600">
                            {item.current_project || 'Almoxarifado'}
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-600">
                            {item.last_revision ? format(new Date(item.last_revision), "dd/MM/yy", { locale: ptBR }) : '-'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => {
                                  setSelectedEquipment(item);
                                  setIsMoveModalOpen(true);
                                }}
                                className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                title="Movimentar"
                              >
                                <ArrowRightLeft size={18} />
                              </button>
                              {isAdmin && (
                                <>
                                  <button 
                                    onClick={() => {
                                      setSelectedEquipment(item);
                                      setIsRevisionModalOpen(true);
                                    }}
                                    className="p-2 hover:bg-orange-50 text-orange-600 rounded-lg transition-colors"
                                    title="Registrar Revisão"
                                  >
                                    <Wrench size={18} />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setSelectedEquipment(item);
                                      setNewEquipment({
                                        name: item.name,
                                        code: item.code,
                                        category: item.category,
                                        status: item.status,
                                        current_responsible: item.current_responsible || null,
                                        current_project: item.current_project || null,
                                        last_revision: item.last_revision || null,
                                      });
                                      setIsEditModalOpen(true);
                                    }}
                                    className="p-2 hover:bg-neutral-100 text-neutral-600 rounded-lg transition-colors"
                                    title="Editar"
                                  >
                                    <MoreVertical size={18} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* History View */
        <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-neutral-50">
                  <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Data</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Equipamento</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Origem</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Destino</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {movements.map((move) => (
                  <tr key={move.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-neutral-600">
                      {format(new Date(move.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-neutral-900">{move.equipment?.name}</div>
                      <div className="text-xs text-neutral-400">{move.equipment?.code}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="text-neutral-600">{move.from_responsible || 'Estoque'}</div>
                      <div className="text-xs text-neutral-400">{move.from_project || '-'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-neutral-900">{move.to_responsible}</div>
                      <div className="text-xs text-neutral-400">{move.to_project}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                        move.status === 'CONFIRMED' ? "bg-green-100 text-green-700" : 
                        move.status === 'PENDING' ? "bg-neutral-100 text-neutral-600" : 
                        "bg-red-100 text-red-700"
                      )}>
                        {move.status === 'CONFIRMED' ? 'Confirmado' : move.status === 'PENDING' ? 'Pendente' : 'Cancelado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-500 italic max-w-xs truncate">
                      {move.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center md:p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full h-full md:h-auto md:max-w-md md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-neutral-900 italic serif">Novo Equipamento</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Nome</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={newEquipment.name}
                    onChange={(e) => setNewEquipment({...newEquipment, name: e.target.value.toUpperCase()})}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Código/Patrimônio</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={newEquipment.code}
                      onChange={(e) => setNewEquipment({...newEquipment, code: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Categoria</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={newEquipment.category}
                      onChange={(e) => setNewEquipment({...newEquipment, category: e.target.value.toUpperCase()})}
                    />
                  </div>
                </div>
                <div className="pt-4 shrink-0 pb-10 md:pb-0">
                  <button type="submit" className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200">
                    Cadastrar Equipamento
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Move Modal */}
      <AnimatePresence>
        {isMoveModalOpen && selectedEquipment && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center md:p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full h-full md:h-auto md:max-w-md md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-neutral-900 italic serif">Movimentar</h3>
                <button onClick={() => setIsMoveModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 bg-neutral-50 border-b border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl border border-neutral-200">
                    <Wrench size={20} className="text-neutral-600" />
                  </div>
                  <div>
                    <div className="font-bold text-neutral-900">{selectedEquipment.name}</div>
                    <div className="text-xs text-neutral-500">{selectedEquipment.code}</div>
                  </div>
                </div>
              </div>
              <form onSubmit={handleMove} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Encarregado de Destino</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl"
                    value={newMovement.to_responsible_id}
                    onChange={(e) => {
                      const emp = employees.find(emp => emp.id === e.target.value);
                      setNewMovement({
                        ...newMovement, 
                        to_responsible_id: e.target.value,
                        to_responsible: emp ? (emp.full_name || emp.email) : ''
                      });
                    }}
                  >
                    <option value="">Selecione um funcionário...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.full_name || emp.email}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Empreendimento de Destino</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl"
                    value={newMovement.to_project}
                    onChange={(e) => setNewMovement({...newMovement, to_project: e.target.value.toUpperCase()})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Observações</label>
                  <textarea 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl h-24 resize-none"
                    value={newMovement.notes}
                    onChange={(e) => setNewMovement({...newMovement, notes: e.target.value.toUpperCase()})}
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all">
                  Confirmar Transferência
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && selectedEquipment && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900 italic serif">Editar Equipamento</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleUpdate} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Nome</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl"
                    value={newEquipment.name}
                    onChange={(e) => setNewEquipment({...newEquipment, name: e.target.value.toUpperCase()})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Código</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl"
                      value={newEquipment.code}
                      onChange={(e) => setNewEquipment({...newEquipment, code: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Categoria</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl"
                      value={newEquipment.category}
                      onChange={(e) => setNewEquipment({...newEquipment, category: e.target.value.toUpperCase()})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Status</label>
                  <select 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl"
                    value={newEquipment.status}
                    onChange={(e) => setNewEquipment({...newEquipment, status: e.target.value as Equipment['status']})}
                  >
                    <option value="AVAILABLE">Disponível</option>
                    <option value="IN_USE">Em Uso</option>
                    <option value="MAINTENANCE">Manutenção</option>
                    <option value="LOST">Extraviado</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all">
                  Salvar Alterações
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Revision Modal */}
      <AnimatePresence>
        {isRevisionModalOpen && selectedEquipment && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900 italic serif">Histórico de Revisões</h3>
                <button onClick={() => setIsRevisionModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
                {/* Add New Revision */}
                <form onSubmit={handleAddRevision} className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 space-y-4">
                  <h4 className="font-bold text-neutral-900 text-sm">Registrar Nova Revisão</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Data</label>
                      <input 
                        required
                        type="date" 
                        className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm"
                        value={revisionData.date}
                        onChange={(e) => setRevisionData({...revisionData, date: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Responsável</label>
                      <input 
                        required
                        type="text" 
                        className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm"
                        value={revisionData.responsible}
                        onChange={(e) => setRevisionData({...revisionData, responsible: e.target.value.toUpperCase()})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Descrição</label>
                    <textarea 
                      required
                      className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm h-20 resize-none"
                      placeholder="O que foi feito na revisão?"
                      value={revisionData.description}
                      onChange={(e) => setRevisionData({...revisionData, description: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <button type="submit" className="w-full py-2 bg-neutral-900 text-white rounded-xl text-sm font-bold hover:bg-neutral-800 transition-all">
                    Salvar Revisão
                  </button>
                </form>

                {/* Revision List */}
                <div className="space-y-4">
                  <h4 className="font-bold text-neutral-900 text-sm">Revisões Anteriores</h4>
                  {selectedEquipment.revisions && selectedEquipment.revisions.length > 0 ? (
                    <div className="space-y-3">
                      {selectedEquipment.revisions.map((rev, idx) => (
                        <div key={idx} className="p-4 bg-white border border-neutral-100 rounded-xl shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-neutral-900">{format(new Date(rev.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                            <span className="text-[10px] text-neutral-400 uppercase font-bold">{rev.responsible}</span>
                          </div>
                          <p className="text-sm text-neutral-600 italic">{rev.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-neutral-400 text-sm italic">Nenhuma revisão registrada.</p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface EquipmentCardProps {
  item: Equipment;
  onMove: () => void;
  onEdit: () => void;
  onRevision: () => void;
  onConfirm: (movementId: string) => void;
  isAdmin: boolean;
  profileId?: string;
  movements: EquipmentMovement[];
}

const EquipmentCard: React.FC<EquipmentCardProps> = ({ item, onMove, onEdit, onRevision, onConfirm, isAdmin, profileId, movements }) => {
  const pendingMove = movements.find(m => m.equipment_id === item.id && m.status === 'PENDING');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-4 md:p-6 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-md transition-all flex flex-col"
    >
      <div className="flex justify-between items-start mb-3 md:mb-4">
        <div className="p-2 md:p-3 bg-neutral-100 rounded-2xl text-neutral-600">
          <Wrench size={20} className="md:w-6 md:h-6" />
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={item.status} />
          {pendingMove && (
            <div className="flex flex-col items-end gap-1">
              <div className="text-[9px] md:text-[10px] text-orange-600 font-bold animate-pulse">
                Pendente: {pendingMove.to_responsible}
              </div>
              {profileId === pendingMove.to_responsible_id && (
                <button 
                  onClick={() => onConfirm(pendingMove.id)}
                  className="text-[9px] md:text-[10px] bg-orange-600 text-white px-2 py-0.5 rounded-lg hover:bg-orange-700 transition-colors font-bold uppercase tracking-wider"
                >
                  Confirmar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 md:mb-6">
        <div className="flex justify-between items-start">
          <div className="min-w-0">
            <h4 className="text-base md:text-lg font-bold text-neutral-900 mb-0.5 truncate">{item.name}</h4>
            <p className="text-[10px] md:text-xs text-neutral-500 uppercase tracking-widest font-semibold truncate">{item.category} • {item.code}</p>
          </div>
          {isAdmin && (
            <button 
              onClick={onEdit}
              className="p-1.5 md:p-2 hover:bg-neutral-100 rounded-full text-neutral-400 hover:text-neutral-600 transition-colors shrink-0"
            >
              <MoreVertical size={18} className="md:w-5 md:h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 md:space-y-3 mb-4 md:mb-6 flex-grow">
        <div className="flex items-center gap-2 text-xs md:text-sm">
          <User size={14} className="text-neutral-400 shrink-0" />
          <span className="text-neutral-500 hidden sm:inline">Responsável:</span>
          <span className="font-medium text-neutral-900 truncate">{item.current_responsible || 'Estoque Central'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs md:text-sm">
          <Building2 size={14} className="text-neutral-400 shrink-0" />
          <span className="text-neutral-500 hidden sm:inline">Local:</span>
          <span className="font-medium text-neutral-900 truncate">{item.current_project || 'Almoxarifado'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs md:text-sm">
          <Clock size={14} className="text-neutral-400 shrink-0" />
          <span className="text-neutral-500 hidden sm:inline">Última Revisão:</span>
          <span className="font-medium text-neutral-900">
            {item.last_revision ? format(new Date(item.last_revision), "dd/MM/yy", { locale: ptBR }) : 'Nenhuma'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button 
          onClick={onMove}
          className="py-2.5 md:py-3 bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-xl text-xs md:text-sm font-bold hover:bg-neutral-100 transition-all flex items-center justify-center gap-2"
        >
          <ArrowRightLeft size={14} className="md:w-4 md:h-4" />
          Movimentar
        </button>
        {isAdmin && (
          <button 
            onClick={onRevision}
            className="py-2.5 md:py-3 bg-orange-50 border border-orange-100 text-orange-600 rounded-xl text-xs md:text-sm font-bold hover:bg-orange-100 transition-all flex items-center justify-center gap-2"
          >
            <Wrench size={14} className="md:w-4 md:h-4" />
            Revisão
          </button>
        )}
      </div>
    </motion.div>
  );
};

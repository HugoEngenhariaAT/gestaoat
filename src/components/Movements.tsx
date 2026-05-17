import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import SearchableMaterialSelect from './SearchableMaterialSelect';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Calendar, 
  User, 
  HardHat,
  X,
  CheckCircle2,
  Building2,
  FileSpreadsheet
} from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { Material, Movement } from '../types';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '../lib/AuthContext';
import * as XLSX from 'xlsx';

const AREAS = ['Civil', 'Acabamento', 'Elétrica', 'Hidráulica', 'Impermeabilização'];
// Note: AREAS is kept for reference but no longer used in the main form as per user request to remove 'area' field.

export default function Movements() {
  const { profile } = useAuth();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [newMovement, setNewMovement] = useState({
    material_id: '',
    quantity: 0,
    type: 'OUT' as 'IN' | 'OUT',
    project: '',
    apartment: '',
    service_description: '',
    responsible: profile?.name || profile?.email || '',
  });

  useEffect(() => {
    if (profile) {
      setNewMovement(prev => ({
        ...prev,
        responsible: profile.name || profile.email || '',
      }));
    }
  }, [profile]);

  const safeFormatDate = (dateStr: string | null | undefined, formatStr: string = "dd MMM, HH:mm") => {
    if (!dateStr) return '---';
    try {
      const date = parseISO(dateStr);
      if (isNaN(date.getTime())) return '---';
      return format(date, formatStr, { locale: ptBR });
    } catch (e) {
      return '---';
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [movementsRes, materialsRes] = await Promise.all([
        getSupabase().from('movements').select('*, material:materials(*)').order('created_at', { ascending: false }),
        getSupabase().from('materials').select('*').order('name', { ascending: true })
      ]);

      if (movementsRes.error) {
        console.error('Error fetching movements:', movementsRes.error);
        toast.error('Erro ao buscar movimentações: ' + movementsRes.error.message);
      } else {
        setMovements(movementsRes.data || []);
      }

      if (materialsRes.error) {
        console.error('Error fetching materials:', materialsRes.error);
        toast.error('Erro ao buscar materiais: ' + materialsRes.error.message);
      } else {
        setMaterials(materialsRes.data || []);
      }
    } catch (err) {
      console.error('Supabase initialization error:', err);
      toast.error('Erro ao conectar ao banco de dados.');
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
      // 1. Insert movement
      const { error: moveError } = await supabase
        .from('movements')
        .insert([{
          material_id: newMovement.material_id,
          quantity: newMovement.quantity,
          type: newMovement.type,
          project: newMovement.project,
          apartment: newMovement.apartment,
          service_description: newMovement.service_description,
          responsible: newMovement.responsible,
        }]);

      if (moveError) {
        if (moveError.message.includes('Insufficient stock')) {
          toast.error('Erro: Estoque insuficiente para esta saída.');
        } else {
          toast.error('Erro ao registrar movimentação: ' + moveError.message);
        }
        return;
      }

      toast.success('Movimentação registrada com sucesso!');
      setIsModalOpen(false);
      fetchData();
      setNewMovement({
        material_id: '',
        quantity: 0,
        type: 'OUT',
        project: '',
        apartment: '',
        service_description: '',
        responsible: profile?.name || profile?.email || '',
      });
    } catch (err) {
      toast.error('Erro de configuração: ' + (err as Error).message);
    }
  };

  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const wsData = movements.map(m => ({
        'Data': format(parseISO(m.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        'Tipo': m.type === 'IN' ? 'Entrada' : 'Saída',
        'Material': m.material?.name || '---',
        'Quantidade': m.quantity,
        'Unidade': m.material?.unit || '---',
        'Projeto': m.project || 'Geral',
        'Apartamento': m.apartment || '---',
        'Responsável': m.responsible || '---',
        'Descrição': m.service_description || '---'
      }));
      const ws = XLSX.utils.json_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Movimentações");
      XLSX.writeFile(wb, `Relatorio_Movimentacoes_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
      toast.success('Relatório de movimentações exportado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      toast.error('Erro ao exportar relatório.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-neutral-900 italic serif">Movimentação</h2>
          <p className="text-neutral-500">Registro rápido de entradas e saídas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={exportToExcel}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-neutral-200 text-neutral-900 rounded-2xl font-bold hover:bg-neutral-50 transition-all shadow-sm"
          >
            <FileSpreadsheet size={20} />
            Exportar Geral
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200"
          >
            <Plus size={20} />
            Registrar Uso
          </button>
        </div>
      </div>

      {/* Quick Actions Mobile */}
      <div className="grid grid-cols-2 gap-4 md:hidden">
        <button 
          onClick={() => {
            setNewMovement({...newMovement, type: 'IN'});
            setIsModalOpen(true);
          }}
          className="flex flex-col items-center justify-center p-6 bg-green-50 border border-green-100 rounded-3xl text-green-700"
        >
          <ArrowDownLeft size={32} className="mb-2" />
          <span className="font-bold">Entrada</span>
        </button>
        <button 
          onClick={() => {
            setNewMovement({...newMovement, type: 'OUT'});
            setIsModalOpen(true);
          }}
          className="flex flex-col items-center justify-center p-6 bg-orange-50 border border-orange-100 rounded-3xl text-orange-700"
        >
          <ArrowUpRight size={32} className="mb-2" />
          <span className="font-bold">Saída</span>
        </button>
      </div>

      {/* Movement List */}
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-neutral-900 italic serif">Histórico Recente</h3>
          <button className="text-sm text-neutral-500 hover:text-neutral-900 font-medium transition-colors">Ver tudo</button>
        </div>
        
        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
          </div>
        ) : (
          <div className="divide-y divide-neutral-50">
            {movements.map((move) => (
              <div 
                key={move.id} 
                className="p-6 flex items-center gap-4 hover:bg-neutral-50 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedMovement(move);
                  setIsDetailModalOpen(true);
                }}
              >
                <div className={cn(
                  "p-3 rounded-2xl shrink-0",
                  move.type === 'IN' ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
                )}>
                  {move.type === 'IN' ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-base font-bold text-neutral-900 truncate">{move.material?.name || 'Material Removido'}</h4>
                    <span className={cn(
                      "text-base font-bold",
                      move.type === 'IN' ? "text-green-600" : "text-orange-600"
                    )}>
                      {move.type === 'IN' ? '+' : '-'}{move.quantity} <span className="text-xs font-normal text-neutral-400">{move.material?.unit}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                    <span className="flex items-center gap-1 font-bold text-neutral-700"><Building2 size={12} /> {move.project || 'Geral'}</span>
                    <span className="flex items-center gap-1"><User size={12} /> {move.responsible}</span>
                    <span className="flex items-center gap-1"><Calendar size={12} /> {safeFormatDate(move.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
            {movements.length === 0 && (
              <div className="p-12 text-center text-neutral-500">Nenhuma movimentação registrada.</div>
            )}
          </div>
        )}
      </div>

      {/* Movement Detail Modal */}
      <AnimatePresence>
        {isDetailModalOpen && selectedMovement && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 italic serif">Detalhes da Movimentação</h3>
                  <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest mt-1">Informações completas do registro</p>
                </div>
                <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Material</p>
                    <p className="font-bold text-neutral-900">{selectedMovement.material?.name || 'Material Removido'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Tipo</p>
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
                      selectedMovement.type === 'IN' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {selectedMovement.type === 'IN' ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                      {selectedMovement.type === 'IN' ? 'Entrada' : 'Saída'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Quantidade</p>
                    <p className="font-bold text-neutral-900">{selectedMovement.quantity} {selectedMovement.material?.unit}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Data/Hora</p>
                    <p className="text-sm text-neutral-600">
                      {safeFormatDate(selectedMovement.created_at, "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Empreendimento</p>
                    <p className="text-sm text-neutral-900 font-medium">{selectedMovement.project || 'Geral'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Apartamento</p>
                    <p className="text-sm text-neutral-900 font-medium">{selectedMovement.apartment || '---'}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Responsável</p>
                  <p className="text-sm text-neutral-900 font-medium">{selectedMovement.responsible}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Descrição do Serviço</p>
                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 italic text-neutral-600 text-sm">
                    {selectedMovement.service_description || 'Sem descrição.'}
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={() => setIsDetailModalOpen(false)}
                    className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200"
                  >
                    Fechar Detalhes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900 italic serif">Registrar Movimentação</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div className="flex p-1 bg-neutral-100 rounded-2xl">
                  <button 
                    type="button"
                    onClick={() => setNewMovement({...newMovement, type: 'OUT'})}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                      newMovement.type === 'OUT' ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500"
                    )}
                  >
                    Saída (Uso)
                  </button>
                  <button 
                    type="button"
                    onClick={() => setNewMovement({...newMovement, type: 'IN'})}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                      newMovement.type === 'IN' ? "bg-white text-green-600 shadow-sm" : "text-neutral-500"
                    )}
                  >
                    Entrada (Reposição)
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Material</label>
                    <SearchableMaterialSelect
                      required
                      materials={materials.filter(m => newMovement.type === 'IN' || m.stock_quantity > 0)}
                      value={newMovement.material_id}
                      onChange={(id) => setNewMovement({...newMovement, material_id: id})}
                      placeholder="Selecione o material..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Quantidade</label>
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={newMovement.quantity}
                        onChange={(e) => setNewMovement({...newMovement, quantity: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Empreendimento</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Nome da obra/projeto"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={newMovement.project}
                        onChange={(e) => setNewMovement({...newMovement, project: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Apartamento</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Nº Apto/Local"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={newMovement.apartment || ''}
                        onChange={(e) => setNewMovement({...newMovement, apartment: e.target.value.toUpperCase()})}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Descrição</label>
                    <textarea 
                      required
                      rows={2}
                      placeholder="Detalhes do serviço"
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
                      value={newMovement.service_description || ''}
                      onChange={(e) => setNewMovement({...newMovement, service_description: e.target.value.toUpperCase()})}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Responsável</label>
                    <input 
                      readOnly
                      type="text" 
                      className="w-full px-4 py-3 bg-neutral-100 border border-neutral-200 rounded-xl focus:outline-none text-neutral-500 cursor-not-allowed font-medium"
                      value={newMovement.responsible}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200 flex items-center justify-center gap-2">
                    <CheckCircle2 size={20} />
                    Confirmar Registro
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

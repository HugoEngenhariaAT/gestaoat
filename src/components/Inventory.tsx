import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import SearchableMaterialSelect from './SearchableMaterialSelect';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  AlertCircle, 
  Package, 
  Trash2, 
  Edit2,
  X,
  Lock,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  FileSpreadsheet,
  Table
} from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { Material, Movement } from '../types';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export default function Inventory() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'DEV';
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'in_stock' | 'low_stock'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedMaterialHistory, setSelectedMaterialHistory] = useState<Movement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [movementType, setMovementType] = useState<'IN' | 'OUT'>('OUT');
  
  const [newMaterial, setNewMaterial] = useState({
    name: '',
    category: '',
    unit: '',
    provider: '',
    stock_quantity: 0,
    min_stock: 0,
  });

  const [movementData, setMovementData] = useState({
    quantity: 0,
    responsible: '',
    project: '',
    apartment: '',
    service_description: '',
  });

  useEffect(() => {
    if (isMovementModalOpen && profile) {
      setMovementData(prev => ({
        ...prev,
        responsible: profile.name || profile.email || '',
      }));
    }
  }, [isMovementModalOpen, profile]);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const { data, error } = await getSupabase()
        .from('materials')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        toast.error('Erro ao buscar materiais: ' + error.message);
      } else {
        setMaterials(data || []);
      }
    } catch (err) {
      console.error('Supabase initialization error:', err);
    }
    setLoading(false);
  };

  const fetchMaterialHistory = async (materialId: string) => {
    setLoadingHistory(true);
    try {
      const { data, error } = await getSupabase()
        .from('movements')
        .select('*')
        .eq('material_id', materialId)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Erro ao buscar histórico: ' + error.message);
      } else {
        setSelectedMaterialHistory(data || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Apenas administradores podem cadastrar materiais.');
      return;
    }

    try {
      const { error } = await getSupabase()
        .from('materials')
        .insert([newMaterial]);

      if (error) {
        toast.error('Erro ao cadastrar material: ' + error.message);
      } else {
        toast.success('Material cadastrado com sucesso!');
        setIsModalOpen(false);
        fetchMaterials();
        setNewMaterial({
          name: '',
          category: '',
          unit: '',
          provider: '',
          stock_quantity: 0,
          min_stock: 0,
        });
      }
    } catch (err) {
      toast.error('Erro de configuração: ' + (err as Error).message);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial || !isAdmin) return;

    try {
      const { error } = await getSupabase()
        .from('materials')
        .update({
          name: editingMaterial.name,
          category: editingMaterial.category,
          unit: editingMaterial.unit,
          provider: editingMaterial.provider,
          stock_quantity: editingMaterial.stock_quantity,
          min_stock: editingMaterial.min_stock,
        })
        .eq('id', editingMaterial.id);

      if (error) {
        toast.error('Erro ao atualizar material: ' + error.message);
      } else {
        toast.success('Material atualizado com sucesso!');
        setIsEditModalOpen(false);
        setEditingMaterial(null);
        fetchMaterials();
      }
    } catch (err) {
      toast.error('Erro de configuração: ' + (err as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!materialToDelete) return;
    if (!isAdmin) {
      toast.error('Apenas administradores podem excluir materiais.');
      return;
    }

    try {
      const { error } = await getSupabase()
        .from('materials')
        .delete()
        .eq('id', materialToDelete);

      if (error) {
        toast.error('Erro ao excluir material: ' + error.message);
      } else {
        toast.success('Material excluído com sucesso!');
        setIsDeleteModalOpen(false);
        setMaterialToDelete(null);
        fetchMaterials();
      }
    } catch (err) {
      toast.error('Erro de configuração: ' + (err as Error).message);
    }
  };

  const handleMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;

    if (movementType === 'OUT' && movementData.quantity > selectedMaterial.stock_quantity) {
      toast.error('Quantidade insuficiente em estoque.');
      return;
    }

    try {
      const supabase = getSupabase();
      
      // 1. Create movement record
      const { error: moveError } = await supabase
        .from('movements')
        .insert([{
          material_id: selectedMaterial.id,
          quantity: movementData.quantity,
          type: movementType,
          responsible: movementData.responsible,
          project: movementData.project,
          apartment: movementData.apartment,
          service_description: movementData.service_description,
        }]);

      if (moveError) throw moveError;

      // 2. Update material stock
      const newStock = movementType === 'IN' 
        ? selectedMaterial.stock_quantity + movementData.quantity
        : selectedMaterial.stock_quantity - movementData.quantity;

      const { error: updateError } = await supabase
        .from('materials')
        .update({ stock_quantity: newStock })
        .eq('id', selectedMaterial.id);

      if (updateError) throw updateError;

      toast.success(`${movementType === 'IN' ? 'Devolução' : 'Retirada'} realizada com sucesso!`);
      setIsMovementModalOpen(false);
      fetchMaterials();
      setMovementData({
        quantity: 0,
        responsible: profile?.name || profile?.email || '',
        project: '',
        apartment: '',
        service_description: '',
      });
    } catch (err) {
      toast.error('Erro ao processar movimentação: ' + (err as Error).message);
    }
  };

  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const wsData = materials.map(m => ({
        'Material': m.name,
        'Categoria': m.category,
        'Unidade': m.unit,
        'Fornecedor': m.provider || '---',
        'Estoque Atual': m.stock_quantity,
        'Estoque Mínimo': m.min_stock,
        'Status': m.stock_quantity <= m.min_stock ? 'Estoque Baixo' : 'Normal'
      }));
      const ws = XLSX.utils.json_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Estoque");
      XLSX.writeFile(wb, `Relatorio_Estoque_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
      toast.success('Relatório de estoque exportado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      toast.error('Erro ao exportar relatório.');
    }
  };

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         m.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filterType === 'in_stock') return m.stock_quantity > 0;
    if (filterType === 'low_stock') return m.stock_quantity <= m.min_stock;
    
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 italic serif">Estoque de Materiais</h2>
          <p className="text-sm text-neutral-500">Controle total de insumos e ferramentas</p>
        </div>
        <div className="flex overflow-x-auto pb-2 md:pb-0 gap-2 no-scrollbar shrink-0">
          {isAdmin && (
            <button 
              onClick={exportToExcel}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-neutral-200 text-neutral-900 rounded-xl text-xs font-bold hover:bg-neutral-50 transition-all shadow-sm whitespace-nowrap"
            >
              <FileSpreadsheet size={18} />
              Exportar
            </button>
          )}
          <button 
            onClick={() => {
              setSelectedMaterial(null);
              setMovementType('OUT');
              setIsMovementModalOpen(true);
            }}
            className="hidden md:flex items-center justify-center gap-2 px-6 py-2 bg-neutral-100 text-neutral-900 rounded-xl font-bold hover:bg-neutral-200 transition-all shadow-sm whitespace-nowrap"
          >
            <Plus size={20} />
            Registrar Uso
          </button>
          {isAdmin && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="hidden md:flex items-center justify-center gap-2 px-6 py-2 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200 whitespace-nowrap"
            >
              <Plus size={20} />
              Novo Material
            </button>
          )}
        </div>
      </div>

      {/* Mobile Floating Action Button */}
      <button 
        onClick={() => {
          setSelectedMaterial(null);
          setMovementType('OUT');
          setIsMovementModalOpen(true);
        }}
        className="md:hidden fixed bottom-20 right-6 z-40 w-14 h-14 bg-neutral-900 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all"
      >
        <Plus size={28} />
      </button>

      {/* Search and Filter */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar material ou categoria..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-x-auto pb-2 md:pb-0 gap-1 no-scrollbar bg-white p-1 border border-neutral-200 rounded-2xl shrink-0">
            <button 
              onClick={() => setFilterType('all')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                filterType === 'all' ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"
              )}
            >
              Todos
            </button>
            <button 
              onClick={() => setFilterType('in_stock')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                filterType === 'in_stock' ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"
              )}
            >
              Em Estoque
            </button>
            <button 
              onClick={() => setFilterType('low_stock')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                filterType === 'low_stock' ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"
              )}
            >
              Estoque Baixo
            </button>
          </div>
          
          <div className="hidden md:flex bg-white p-1 border border-neutral-200 rounded-2xl shrink-0">
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-xl transition-all",
                viewMode === 'list' ? "bg-neutral-900 text-white" : "text-neutral-400 hover:bg-neutral-50"
              )}
            >
              <Table size={18} />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 rounded-xl transition-all",
                viewMode === 'grid' ? "bg-neutral-900 text-white" : "text-neutral-400 hover:bg-neutral-50"
              )}
            >
              <Package size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Material List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900"></div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMaterials.map((material) => {
            const isLowStock = material.stock_quantity <= material.min_stock;
            const isCritical = material.stock_quantity <= material.min_stock * 0.5;
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={material.id} 
                onClick={() => {
                  setSelectedMaterial(material);
                  setMovementType('OUT');
                  setIsMovementModalOpen(true);
                }}
                className="bg-white p-5 rounded-3xl border border-neutral-200 hover:border-neutral-900 transition-all group cursor-pointer shadow-sm flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-neutral-100 rounded-2xl text-neutral-600 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                    <Package size={20} />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {isLowStock ? (
                      <span className={cn(
                        "flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                        isCritical ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                      )}>
                        <AlertCircle size={12} />
                        {isCritical ? 'Crítico' : 'Baixo'}
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-widest">
                        Normal
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="text-lg font-bold text-neutral-900 mb-0.5 truncate">{material.name}</h4>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">{material.category}</p>
                </div>

                <div className="flex items-end justify-between mt-auto">
                  <div>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-1">Estoque</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      isCritical ? "text-red-600" : isLowStock ? "text-orange-600" : "text-neutral-900"
                    )}>
                      {material.stock_quantity} <span className="text-xs font-normal text-neutral-400">{material.unit}</span>
                    </p>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => {
                        setSelectedMaterial(material);
                        fetchMaterialHistory(material.id);
                        setIsHistoryModalOpen(true);
                      }}
                      className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors"
                    >
                      <History size={18} />
                    </button>
                    {isAdmin && (
                      <>
                        <button 
                          onClick={() => {
                            setEditingMaterial(material);
                            setIsEditModalOpen(true);
                          }}
                          className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setMaterialToDelete(material.id);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-2 text-neutral-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          {filteredMaterials.length === 0 && (
            <div className="col-span-full py-12 text-center text-neutral-500 bg-neutral-50 rounded-3xl border-2 border-dashed border-neutral-200">
              Nenhum material encontrado.
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Material</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Categoria</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-center">Estoque Atual</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredMaterials.map((material) => {
                  const isLowStock = material.stock_quantity <= material.min_stock;
                  const isCritical = material.stock_quantity <= material.min_stock * 0.5;
                  
                  return (
                    <tr 
                      key={material.id} 
                      className="hover:bg-neutral-50 transition-colors group cursor-pointer"
                      onClick={() => {
                        setSelectedMaterial(material);
                        setMovementType('OUT');
                        setIsMovementModalOpen(true);
                      }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-neutral-100 rounded-lg text-neutral-500 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                            <Package size={18} />
                          </div>
                          <span className="font-bold text-neutral-900">{material.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{material.category}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "text-lg font-bold",
                          isCritical ? "text-red-600" : isLowStock ? "text-orange-600" : "text-neutral-900"
                        )}>
                          {material.stock_quantity} <span className="text-xs font-normal text-neutral-400">{material.unit}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          {isLowStock ? (
                            <span className={cn(
                              "flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                              isCritical ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                            )}>
                              <AlertCircle size={12} />
                              {isCritical ? 'Crítico' : 'Baixo'}
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-widest">
                              Normal
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => {
                              setSelectedMaterial(material);
                              fetchMaterialHistory(material.id);
                              setIsHistoryModalOpen(true);
                            }}
                            className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors"
                            title="Ver Histórico"
                          >
                            <History size={18} />
                          </button>
                          {isAdmin && (
                            <>
                              <button 
                                onClick={() => {
                                  setEditingMaterial(material);
                                  setIsEditModalOpen(true);
                                }}
                                className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button 
                                onClick={() => {
                                  setMaterialToDelete(material.id);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="p-2 text-neutral-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 size={18} />
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
            {filteredMaterials.length === 0 && (
              <div className="py-12 text-center text-neutral-500">
                Nenhum material encontrado.
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && selectedMaterial && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 italic serif">Histórico Individual</h3>
                  <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest mt-1">{selectedMaterial.name}</p>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {loadingHistory ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
                  </div>
                ) : selectedMaterialHistory.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-6 gap-4 px-4 py-2 bg-neutral-50 rounded-xl text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                      <div className="col-span-1">Data</div>
                      <div className="col-span-1">Tipo</div>
                      <div className="col-span-1 text-center">Qtd</div>
                      <div className="col-span-1">Responsável</div>
                      <div className="col-span-1">Projeto/Apto</div>
                      <div className="col-span-1">Descrição</div>
                    </div>
                    <div className="divide-y divide-neutral-100">
                      {selectedMaterialHistory.map((item) => (
                        <div key={item.id} className="grid grid-cols-6 gap-4 px-4 py-4 items-center hover:bg-neutral-50 transition-colors rounded-xl">
                          <div className="col-span-1 text-xs text-neutral-600">
                            {new Date(item.created_at).toLocaleDateString('pt-BR')}
                            <br />
                            <span className="text-[10px] text-neutral-400">{new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="col-span-1">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
                              item.type === 'IN' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                            )}>
                              {item.type === 'IN' ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                              {item.type === 'IN' ? 'Entrada' : 'Saída'}
                            </span>
                          </div>
                          <div className="col-span-1 text-center font-bold text-neutral-900">
                            {item.quantity}
                          </div>
                          <div className="col-span-1 text-xs text-neutral-600 truncate" title={item.responsible}>
                            {item.responsible}
                          </div>
                          <div className="col-span-1 text-xs text-neutral-600">
                            <span className="font-bold">{item.project}</span>
                            {item.apartment && <><br /><span className="text-neutral-400">Apto: {item.apartment}</span></>}
                          </div>
                          <div className="col-span-1 text-[10px] text-neutral-500 italic line-clamp-2" title={item.service_description}>
                            {item.service_description}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-neutral-500">
                    Nenhuma movimentação encontrada para este material.
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-neutral-100 shrink-0">
                <button 
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200"
                >
                  Fechar Histórico
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Material Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 italic serif">Cadastrar Novo Material</h3>
                  <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest mt-1">Adicione um novo item ao inventário</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Nome do Material</label>
                      <input 
                        required
                        type="text" 
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={newMaterial.name}
                        onChange={(e) => setNewMaterial({...newMaterial, name: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Categoria</label>
                      <input 
                        required
                        type="text" 
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={newMaterial.category}
                        onChange={(e) => setNewMaterial({...newMaterial, category: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Unidade de Medida</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: Un, Kg, M, L"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={newMaterial.unit}
                        onChange={(e) => setNewMaterial({...newMaterial, unit: e.target.value.toUpperCase()})}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Fornecedor</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={newMaterial.provider}
                        onChange={(e) => setNewMaterial({...newMaterial, provider: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Qtd. Inicial</label>
                        <input 
                          required
                          type="number" 
                          step="0.01"
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                          value={newMaterial.stock_quantity}
                          onChange={(e) => setNewMaterial({...newMaterial, stock_quantity: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Estoque Mín.</label>
                        <input 
                          required
                          type="number" 
                          step="0.01"
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                          value={newMaterial.min_stock}
                          onChange={(e) => setNewMaterial({...newMaterial, min_stock: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-4">
                  <button 
                    type="submit" 
                    className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200"
                  >
                    Cadastrar Material
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Material Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingMaterial && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 italic serif">Editar Material</h3>
                  <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest mt-1">Atualize as informações do item</p>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleUpdate} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Nome do Material</label>
                      <input 
                        required
                        type="text" 
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={editingMaterial.name}
                        onChange={(e) => setEditingMaterial({...editingMaterial, name: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Categoria</label>
                      <input 
                        required
                        type="text" 
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={editingMaterial.category}
                        onChange={(e) => setEditingMaterial({...editingMaterial, category: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Unidade de Medida</label>
                      <input 
                        required
                        type="text" 
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={editingMaterial.unit}
                        onChange={(e) => setEditingMaterial({...editingMaterial, unit: e.target.value.toUpperCase()})}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Fornecedor</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={editingMaterial.provider || ''}
                        onChange={(e) => setEditingMaterial({...editingMaterial, provider: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Estoque Atual</label>
                        <input 
                          required
                          type="number" 
                          step="0.01"
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                          value={editingMaterial.stock_quantity}
                          onChange={(e) => setEditingMaterial({...editingMaterial, stock_quantity: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Estoque Mín.</label>
                        <input 
                          required
                          type="number" 
                          step="0.01"
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                          value={editingMaterial.min_stock}
                          onChange={(e) => setEditingMaterial({...editingMaterial, min_stock: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-4">
                  <button 
                    type="submit" 
                    className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Movement Modal */}
      <AnimatePresence>
        {isMovementModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 italic serif">
                    {movementType === 'IN' ? 'Entrada de Material' : 'Saída de Material'}
                  </h3>
                  <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest mt-1">
                    {selectedMaterial ? selectedMaterial.name : 'Selecione um material'}
                  </p>
                </div>
                <button onClick={() => setIsMovementModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleMovement} className="p-6 space-y-4">
                <div className="flex p-1 bg-neutral-100 rounded-2xl">
                  <button 
                    type="button"
                    onClick={() => setMovementType('OUT')}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                      movementType === 'OUT' ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500"
                    )}
                  >
                    Saída
                  </button>
                  <button 
                    type="button"
                    onClick={() => setMovementType('IN')}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                      movementType === 'IN' ? "bg-white text-green-600 shadow-sm" : "text-neutral-500"
                    )}
                  >
                    Entrada
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Material</label>
                  <SearchableMaterialSelect
                    required
                    materials={materials.filter(m => movementType === 'IN' || m.stock_quantity > 0)}
                    value={selectedMaterial?.id || ''}
                    onChange={(id) => {
                      const mat = materials.find(m => m.id === id);
                      setSelectedMaterial(mat || null);
                    }}
                    placeholder="Selecione o material..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Quantidade {selectedMaterial ? `(${selectedMaterial.unit})` : ''}</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={movementData.quantity}
                    onChange={(e) => setMovementData({...movementData, quantity: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                  />
                  {movementType === 'OUT' && selectedMaterial && (
                    <p className="text-[10px] text-neutral-400 mt-1">Disponível: {selectedMaterial.stock_quantity} {selectedMaterial.unit}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Responsável</label>
                  <input 
                    readOnly
                    type="text" 
                    className="w-full px-4 py-3 bg-neutral-100 border border-neutral-200 rounded-xl focus:outline-none text-neutral-500 cursor-not-allowed font-medium"
                    value={movementData.responsible}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Empreendimento</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={movementData.project}
                      onChange={(e) => setMovementData({...movementData, project: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Apartamento</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={movementData.apartment}
                      onChange={(e) => setMovementData({...movementData, apartment: e.target.value.toUpperCase()})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Descrição</label>
                  <textarea 
                    required
                    rows={2}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
                    value={movementData.service_description}
                    onChange={(e) => setMovementData({...movementData, service_description: e.target.value.toUpperCase()})}
                  />
                </div>
                <div className="pt-4">
                  <button 
                    type="submit" 
                    className={cn(
                      "w-full py-4 text-white rounded-2xl font-bold transition-all shadow-lg",
                      movementType === 'IN' ? "bg-green-600 hover:bg-green-700 shadow-green-100" : "bg-neutral-900 hover:bg-neutral-800 shadow-neutral-200"
                    )}
                  >
                    Confirmar {movementType === 'IN' ? 'Entrada' : 'Saída'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden p-6 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Excluir Material?</h3>
              <p className="text-neutral-500 mb-6">Esta ação não pode ser desfeita. Todos os registros vinculados serão afetados.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 bg-neutral-100 text-neutral-900 rounded-xl font-bold hover:bg-neutral-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

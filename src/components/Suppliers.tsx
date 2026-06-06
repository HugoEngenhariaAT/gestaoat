import React, { useEffect, useState } from 'react';
import { Plus, X, Pencil, Trash2, Search, Building2, User, MapPin, Truck, Clock, ShoppingCart, Info, CheckCircle2, FileText, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getSupabase } from '../lib/supabase';
import { Supplier, Order } from '../types';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Suppliers() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'DEV';
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierHistory, setSupplierHistory] = useState<Order[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    salesperson: '',
    contact: '',
    supplier_type: '',
  });

  const fetchData = async () => {
    try {
      const { data, error } = await getSupabase()
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setSuppliers(data || []);
    } catch (err) {
      toast.error('Erro ao buscar fornecedores: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchHistory = async (supplierName: string) => {
    setHistoryLoading(true);
    try {
      const { data, error } = await getSupabase()
        .from('orders')
        .select('*, material:materials(*)')
        .eq('supplier', supplierName)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSupplierHistory(data || []);
    } catch (err) {
      toast.error('Erro ao buscar histórico: ' + (err as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        address: supplier.address || '',
        salesperson: supplier.salesperson || '',
        contact: supplier.contact || '',
        supplier_type: supplier.supplier_type || '',
      });
    } else {
      setEditingSupplier(null);
      setFormData({ name: '', address: '', salesperson: '', contact: '', supplier_type: '' });
    }
    setIsModalOpen(true);
  };

  const handleOpenHistory = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsHistoryModalOpen(true);
    fetchHistory(supplier.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      if (editingSupplier) {
        const { error } = await getSupabase()
          .from('suppliers')
          .update(formData)
          .eq('id', editingSupplier.id);
        if (error) throw error;
        toast.success('Fornecedor atualizado com sucesso!');
      } else {
        const { error } = await getSupabase()
          .from('suppliers')
          .insert([formData]);
        if (error) throw error;
        toast.success('Fornecedor cadastrado com sucesso!');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error('Erro ao salvar fornecedor: ' + (err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin || !window.confirm('Tem certeza que deseja excluir este fornecedor?')) return;
    try {
      const { error } = await getSupabase()
        .from('suppliers')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Fornecedor excluído com sucesso!');
      fetchData();
    } catch (err) {
      toast.error('Erro ao excluir fornecedor: ' + (err as Error).message);
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.supplier_type && s.supplier_type.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.salesperson && s.salesperson.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const safeFormatDate = (dateStr: string | null | undefined, formatStr: string = "dd/MM/yy") => {
    if (!dateStr) return '---';
    try {
      const date = parseISO(dateStr);
      if (isNaN(date.getTime())) return '---';
      return format(date, formatStr, { locale: ptBR });
    } catch (e) {
      return '---';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 italic serif">Fornecedores</h2>
          <p className="text-sm text-neutral-500">Gestão e histórico de compras por fornecedor</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200"
          >
            <Plus size={20} />
            Novo Fornecedor
          </button>
        )}
      </div>

      <div className="bg-white p-2 rounded-2xl border border-neutral-200 flex items-center gap-2 shadow-sm max-w-md">
        <Search className="text-neutral-400 ml-2" size={20} />
        <input 
          type="text" 
          placeholder="Buscar fornecedores..." 
          className="flex-1 bg-transparent border-none focus:outline-none text-sm px-2 py-1"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="col-span-full p-12 text-center text-neutral-500 bg-white rounded-3xl border border-dashed border-neutral-200">
            Nenhum fornecedor encontrado.
          </div>
        ) : (
          filteredSuppliers.map(supplier => (
            <div key={supplier.id} className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center text-neutral-600 shrink-0">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-900 uppercase tracking-wide leading-tight">{supplier.name}</h3>
                    {supplier.supplier_type && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold tracking-widest uppercase">
                        {supplier.supplier_type}
                      </span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 shrink-0">
                    <button 
                      onClick={() => handleOpenModal(supplier)}
                      className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    >
                      <Pencil size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(supplier.id)}
                      className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3 mt-4 flex-1">
                <div className="flex items-start gap-3">
                  <MapPin size={16} className="text-neutral-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Endereço</p>
                    <p className="text-sm font-medium text-neutral-700 line-clamp-2">{supplier.address || 'Não informado'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User size={16} className="text-neutral-400 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Vendedor</p>
                    <p className="text-sm font-medium text-neutral-700">{supplier.salesperson || 'Não informado'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-neutral-400 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Contato / Telefone</p>
                    <p className="text-sm font-medium text-neutral-700">{supplier.contact || 'Não informado'}</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => handleOpenHistory(supplier)}
                className="mt-6 w-full py-3 bg-neutral-50 hover:bg-neutral-100 text-neutral-900 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors border border-neutral-200"
              >
                <FileText size={18} />
                Histórico de Compras
              </button>
            </div>
          ))
        )}
      </div>

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
                <h3 className="text-xl font-bold text-neutral-900 italic serif">
                  {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Nome do Fornecedor</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 uppercase"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value.toUpperCase()})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Endereço (Opcional)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 uppercase"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value.toUpperCase()})}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Vendedor (Opcional)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 uppercase"
                      value={formData.salesperson}
                      onChange={(e) => setFormData({...formData, salesperson: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Contato / Telefone (Opcional)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 uppercase"
                      value={formData.contact}
                      onChange={(e) => setFormData({...formData, contact: e.target.value.toUpperCase()})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Tipo de Fornecedor (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="Ex: MATERIAIS ELÉTRICOS"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 uppercase"
                    value={formData.supplier_type}
                    onChange={(e) => setFormData({...formData, supplier_type: e.target.value.toUpperCase()})}
                  />
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200">
                    Salvar Fornecedor
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isHistoryModalOpen && selectedSupplier && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center md:p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full h-full md:h-[80vh] md:max-w-4xl md:rounded-3xl shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 italic serif">Histórico de Compras</h3>
                  <p className="text-sm text-neutral-500 uppercase font-bold tracking-wider mt-1">{selectedSupplier.name}</p>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto bg-neutral-50/50">
                {historyLoading ? (
                  <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
                  </div>
                ) : supplierHistory.length === 0 ? (
                  <div className="text-center p-12 bg-white rounded-3xl border border-dashed border-neutral-200 text-neutral-500">
                    Nenhuma compra registrada para este fornecedor.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {supplierHistory.map(order => (
                      <div key={order.id} className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded-lg text-[10px] font-bold tracking-widest uppercase">
                              {safeFormatDate(order.created_at, 'dd/MM/yyyy')}
                            </span>
                            {order.purchase_order && (
                              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-bold tracking-widest uppercase">
                                OC: {order.purchase_order}
                              </span>
                            )}
                            {order.invoice_number && (
                              <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold tracking-widest uppercase">
                                NF: {order.invoice_number}
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-neutral-900">{order.material?.name || 'Material Excluído'}</h4>
                          <p className="text-sm text-neutral-500 mt-1">
                            Qtd: <span className="font-bold text-neutral-900">{order.quantity} {order.material?.unit}</span> • Obra: {order.project || 'Estoque'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${
                            order.status === 'PENDING' ? 'bg-orange-50 text-orange-700' :
                            order.status === 'APPROVED' ? 'bg-blue-50 text-blue-700' :
                            order.status === 'AWAITING_PICKUP' ? 'bg-purple-50 text-purple-700' :
                            order.status === 'PICKED_UP' ? 'bg-indigo-50 text-indigo-700' :
                            order.status === 'DELIVERED' ? 'bg-teal-50 text-teal-700' :
                            order.status === 'RECEIVED' ? 'bg-emerald-50 text-emerald-700' :
                            'bg-red-50 text-red-700'
                          }`}>
                            {order.status === 'PENDING' ? 'Pendente' :
                             order.status === 'APPROVED' ? 'Comprado' :
                             order.status === 'AWAITING_PICKUP' ? 'Aguardando Retirada' :
                             order.status === 'PICKED_UP' ? 'Em Trânsito' :
                             order.status === 'DELIVERED' ? 'Entregue' :
                             order.status === 'RECEIVED' ? 'Recebido' : 'Cancelado'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Search, 
  CheckCircle2, 
  Clock, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Package, 
  HardHat, 
  TrendingUp, 
  Building2,
  Calendar,
  DollarSign
} from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface InvoiceConfirmation {
  invoice_number: string;
  status: 'PENDENTE' | 'ENTREGUE';
  confirmed_at?: string;
  confirmed_by?: string;
}

interface InvoiceGroup {
  invoice_number: string;
  orders: any[];
  service_records: any[];
  status: 'PENDENTE' | 'ENTREGUE';
  confirmed_at?: string;
  confirmed_by?: string;
}

export default function Invoices() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'DEV';

  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceGroup[]>([]);
  const [confirmations, setConfirmations] = useState<Record<string, InvoiceConfirmation>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDENTE' | 'ENTREGUE'>('ALL');
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [updatingInvoice, setUpdatingInvoice] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabase();

      // 1. Fetch material orders with linked invoices
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          quantity,
          requested_by,
          project,
          status,
          invoice_number,
          purchase_order,
          order_value,
          material:materials (
            name,
            unit
          )
        `)
        .not('invoice_number', 'is', null);

      if (ordersError) throw ordersError;

      // 2. Fetch service records with linked invoices
      const { data: servicesData, error: servicesError } = await supabase
        .from('service_records')
        .select(`
          id,
          date,
          quantity,
          service_value,
          area,
          project,
          invoice_number,
          provider:providers (
            name
          )
        `)
        .not('invoice_number', 'is', null);

      if (servicesError) throw servicesError;

      // 3. Fetch invoice confirmations
      let confirmationsMap: Record<string, InvoiceConfirmation> = {};
      try {
        const { data: confsData, error: confsError } = await supabase
          .from('invoice_confirmations')
          .select('*');
        
        if (!confsError && confsData) {
          confsData.forEach((c: any) => {
            confirmationsMap[c.invoice_number] = {
              invoice_number: c.invoice_number,
              status: c.status,
              confirmed_at: c.confirmed_at,
              confirmed_by: c.confirmed_by
            };
          });
        }
      } catch (err) {
        console.warn('Tabela invoice_confirmations pode não existir ainda ou RLS travou.', err);
      }

      setConfirmations(confirmationsMap);

      // Group by invoice number
      const grouped: Record<string, InvoiceGroup> = {};

      const addGroup = (invNum: string) => {
        const cleanNum = invNum.trim().toUpperCase();
        if (!cleanNum) return null;
        if (!grouped[cleanNum]) {
          const conf = confirmationsMap[cleanNum];
          grouped[cleanNum] = {
            invoice_number: cleanNum,
            orders: [],
            service_records: [],
            status: conf?.status || 'PENDENTE',
            confirmed_at: conf?.confirmed_at,
            confirmed_by: conf?.confirmed_by
          };
        }
        return grouped[cleanNum];
      };

      ordersData?.forEach((o: any) => {
        if (o.invoice_number) {
          const g = addGroup(o.invoice_number);
          if (g) g.orders.push(o);
        }
      });

      servicesData?.forEach((s: any) => {
        if (s.invoice_number) {
          const g = addGroup(s.invoice_number);
          if (g) g.service_records.push(s);
        }
      });

      setInvoices(Object.values(grouped));
    } catch (err) {
      console.error('Erro ao buscar dados das notas:', err);
      toast.error('Erro ao carregar notas fiscais.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleStatus = async (invoiceNumber: string, currentStatus: 'PENDENTE' | 'ENTREGUE') => {
    if (!isAdmin) {
      toast.error('Apenas administradores podem confirmar a entrega de notas.');
      return;
    }

    setUpdatingInvoice(invoiceNumber);
    const nextStatus = currentStatus === 'PENDENTE' ? 'ENTREGUE' : 'PENDENTE';

    try {
      const supabase = getSupabase();
      
      const { error } = await supabase
        .from('invoice_confirmations')
        .upsert({
          invoice_number: invoiceNumber,
          status: nextStatus,
          confirmed_at: nextStatus === 'ENTREGUE' ? new Date().toISOString() : null,
          confirmed_by: profile?.full_name || profile?.email || 'Admin'
        }, { onConflict: 'invoice_number' });

      if (error) {
        throw new Error(
          'Certifique-se de executar o script SQL no Supabase para criar a tabela de confirmações: ' + error.message
        );
      }

      toast.success(
        nextStatus === 'ENTREGUE' 
          ? `Nota Fiscal ${invoiceNumber} confirmada como entregue!` 
          : `Nota Fiscal ${invoiceNumber} redefinida para pendente!`
      );
      
      fetchData();
    } catch (err) {
      console.error('Erro ao atualizar confirmação:', err);
      toast.error((err as Error).message);
    } finally {
      setUpdatingInvoice(null);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate summary metrics
  const totalInvoices = invoices.length;
  const deliveredCount = invoices.filter(i => i.status === 'ENTREGUE').length;
  const pendingCount = invoices.filter(i => i.status === 'PENDENTE').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
            <FileText className="text-neutral-900" size={28} />
            Controle de Notas Fiscais
          </h2>
          <p className="text-sm text-neutral-500">
            Gerencie todas as Notas Fiscais (NF) vinculadas a pedidos ou serviços e confirme suas entregas.
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Total Vinculadas</p>
            <h3 className="text-3xl font-black text-neutral-900 tracking-tight mt-1">{totalInvoices}</h3>
          </div>
          <div className="p-3 bg-neutral-100 rounded-2xl text-neutral-600">
            <FileText size={24} />
          </div>
        </div>

        <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-bold text-emerald-600/70 uppercase tracking-widest">Entregues / Recebidas</p>
            <h3 className="text-3xl font-black text-emerald-700 tracking-tight mt-1">{deliveredCount}</h3>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
            <CheckCircle2 size={24} />
          </div>
        </div>

        <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-bold text-amber-600/70 uppercase tracking-widest">Pendentes de Entrega</p>
            <h3 className="text-3xl font-black text-amber-700 tracking-tight mt-1">{pendingCount}</h3>
          </div>
          <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl">
            <Clock size={24} />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-3xl border border-neutral-200 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por número de Nota Fiscal (NF)..."
            className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm transition-all placeholder:text-neutral-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {(['ALL', 'PENDENTE', 'ENTREGUE'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "flex-1 md:flex-initial px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all",
                statusFilter === status 
                  ? "bg-neutral-900 text-white shadow-lg shadow-neutral-950/10" 
                  : "bg-neutral-50 text-neutral-500 hover:bg-neutral-100 border border-neutral-200"
              )}
            >
              {status === 'ALL' ? 'Todas' : status === 'ENTREGUE' ? 'Entregues' : 'Pendentes'}
            </button>
          ))}
        </div>
      </div>

      {/* Main List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-3xl border border-neutral-200 p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="bg-white rounded-3xl border border-neutral-200 p-12 text-center text-neutral-400">
            Nenhuma Nota Fiscal (NF) vinculada encontrada com estes filtros.
          </div>
        ) : (
          filteredInvoices.map((inv) => {
            const isExpanded = expandedInvoice === inv.invoice_number;
            const hasOrders = inv.orders.length > 0;
            const hasServices = inv.service_records.length > 0;

            return (
              <motion.div 
                layout
                key={inv.invoice_number}
                className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden"
              >
                {/* Invoice Main Bar */}
                <div 
                  onClick={() => setExpandedInvoice(isExpanded ? null : inv.invoice_number)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-neutral-50/50 transition-all select-none"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-3 rounded-2xl flex items-center justify-center transition-colors",
                      inv.status === 'ENTREGUE' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                    )}>
                      <FileText size={22} />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                        {inv.invoice_number}
                        {inv.status === 'ENTREGUE' ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-extrabold uppercase rounded-md tracking-wider">
                            Entregue
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-extrabold uppercase rounded-md tracking-wider">
                            Pendente
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider mt-0.5">
                        {(() => {
                          const parts = [];
                          if (inv.orders.length > 0) {
                            parts.push(inv.orders.length === 1 ? '1 Material' : `${inv.orders.length} Materiais`);
                          }
                          if (inv.service_records.length > 0) {
                            parts.push(inv.service_records.length === 1 ? '1 Serviço / Diária' : `${inv.service_records.length} Serviços / Diárias`);
                          }
                          return parts.join(' • ');
                        })()}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Expanded status */}
                  <div className="flex items-center justify-between md:justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                    {inv.status === 'ENTREGUE' && inv.confirmed_at && (
                      <div className="text-right hidden lg:block mr-2">
                        <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Confirmado por</p>
                        <p className="text-xs font-bold text-neutral-600">{inv.confirmed_by}</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">
                          {format(parseISO(inv.confirmed_at), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => handleToggleStatus(inv.invoice_number, inv.status)}
                      disabled={updatingInvoice === inv.invoice_number}
                      className={cn(
                        "px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm",
                        inv.status === 'ENTREGUE'
                          ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                          : "bg-emerald-900 text-white hover:bg-emerald-800"
                      )}
                    >
                      {updatingInvoice === inv.invoice_number ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      ) : inv.status === 'ENTREGUE' ? (
                        <>Marcar Pendente</>
                      ) : (
                        <>
                          <CheckCircle2 size={14} />
                          Confirmar Entrega
                        </>
                      )}
                    </button>

                    <button 
                      onClick={() => setExpandedInvoice(isExpanded ? null : inv.invoice_number)}
                      className="p-2 hover:bg-neutral-100 rounded-xl text-neutral-400 transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>

                {/* Collapsible Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="border-t border-neutral-100 bg-neutral-50/40 overflow-hidden"
                    >
                      <div className="p-6 space-y-6">
                        {/* Material Orders Block */}
                        {hasOrders && (
                          <div className="space-y-3">
                            <h5 className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                              <Package size={14} />
                              Pedidos de Material Associados
                            </h5>
                            <div className="grid gap-3">
                              {inv.orders.map((order: any) => (
                                <div 
                                  key={order.id}
                                  className="bg-white p-4 rounded-2xl border border-neutral-150 flex flex-col md:flex-row md:items-center justify-between gap-4"
                                >
                                  <div>
                                    <p className="text-sm font-bold text-neutral-900">
                                      {order.material?.name}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                                        {order.quantity} {order.material?.unit}
                                      </span>
                                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-200" />
                                      <span className="text-xs text-neutral-500 font-medium">
                                        Obra: <strong className="text-neutral-700">{order.project}</strong>
                                      </span>
                                      {order.purchase_order && (
                                        <>
                                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-200" />
                                          <span className="text-xs text-neutral-500 font-medium">
                                            Pedido: <strong className="text-neutral-700">{order.purchase_order}</strong>
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between md:justify-end gap-4">
                                    <div className="text-right">
                                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Solicitado por</p>
                                      <p className="text-xs font-bold text-neutral-700">{order.requested_by}</p>
                                    </div>
                                    {order.order_value !== undefined && order.order_value !== null && order.order_value > 0 && (
                                      <div className="text-right pl-4 border-l border-neutral-100">
                                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Valor</p>
                                        <p className="text-xs font-black text-neutral-900">
                                          R$ {Number(order.order_value).toFixed(2)}
                                        </p>
                                      </div>
                                    )}
                                    <span className={cn(
                                      "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                                      order.status === 'RECEIVED' ? "bg-green-50 text-green-700" :
                                      order.status === 'DELIVERED' ? "bg-orange-50 text-orange-700" : "bg-neutral-100 text-neutral-600"
                                    )}>
                                      {order.status === 'RECEIVED' ? 'Recebido' :
                                       order.status === 'DELIVERED' ? 'Entregue' : order.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Service Records Block */}
                        {hasServices && (
                          <div className="space-y-3">
                            <h5 className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                              <HardHat size={14} />
                              Serviços e Diárias Associadas
                            </h5>
                            <div className="grid gap-3">
                              {inv.service_records.map((sr: any) => (
                                <div 
                                  key={sr.id}
                                  className="bg-white p-4 rounded-2xl border border-neutral-150 flex flex-col md:flex-row md:items-center justify-between gap-4"
                                >
                                  <div>
                                    <p className="text-sm font-bold text-neutral-900">
                                      {sr.provider?.name || 'Prestador de Serviço'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
                                        {sr.quantity === 0 ? 'Serviço Único' : `${sr.quantity} Diária(s)`}
                                      </span>
                                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-200" />
                                      <span className="text-xs text-neutral-500 font-medium">
                                        Área: <strong className="text-neutral-700">{sr.area}</strong>
                                      </span>
                                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-200" />
                                      <span className="text-xs text-neutral-500 font-medium">
                                        Obra: <strong className="text-neutral-700">{sr.project || 'Geral'}</strong>
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between md:justify-end gap-4">
                                    <div className="text-right">
                                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Data do Lançamento</p>
                                      <p className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                                        <Calendar size={12} className="text-neutral-400" />
                                        {format(parseISO(sr.date), 'dd/MM/yyyy')}
                                      </p>
                                    </div>
                                    {sr.service_value !== undefined && sr.service_value > 0 && (
                                      <div className="text-right pl-4 border-l border-neutral-100">
                                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Valor do Serviço</p>
                                        <p className="text-sm font-black text-neutral-900 flex items-center gap-0.5 justify-end">
                                          R$ {sr.service_value.toFixed(2)}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

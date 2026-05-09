import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  Clock, 
  PackageCheck, 
  Wrench, 
  ArrowRightLeft,
  AlertCircle,
  Calendar,
  User,
  Building2,
  Info,
  X
} from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { Order, EquipmentMovement } from '../types';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

export default function Confirmations() {
  const { profile } = useAuth();
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [pendingMovements, setPendingMovements] = useState<EquipmentMovement[]>([]);
  const [loading, setLoading] = useState(true);

  const [isPickupDeliveryModalOpen, setIsPickupDeliveryModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [pickupDeliveryData, setPickupDeliveryData] = useState({ delivered_to_name: '' });

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const supabase = getSupabase();
      
      // Fetch pending orders for the user
      const { data: rawOrdersData, error: ordersError } = await supabase
        .from('orders')
        .select('*, material:materials(*)')
        .in('status', ['AWAITING_PICKUP', 'PICKED_UP', 'DELIVERED'])
        .or(`requested_by_id.eq.${profile.id},pickup_by_id.eq.${profile.id}`);

      if (ordersError) throw ordersError;
      
      const ordersData = (rawOrdersData || []).filter(order => {
        // Almoxarife/Responsável pela retirada vê 'AWAITING_PICKUP'
        if (order.status === 'AWAITING_PICKUP' && order.pickup_by_id === profile.id) return true;
        // Transportador vê 'PICKED_UP' para confirmar entrega
        if (order.status === 'PICKED_UP' && order.pickup_by_id === profile.id) return true;
        // Solicitante vê 'DELIVERED' para confirmar recebimento
        if (order.status === 'DELIVERED' && order.requested_by_id === profile.id) return true;
        // Admin vê tudo
        if (profile.role === 'ADMIN' || profile.role === 'DEV') return true;
        return false;
      });
      setPendingOrders(ordersData);

      // Fetch pending equipment movements for the user
      const { data: movesData, error: movesError } = await supabase
        .from('equipment_movements')
        .select('*, equipment:equipment(*)')
        .eq('to_responsible_id', profile.id)
        .eq('status', 'PENDING');

      if (movesError) throw movesError;
      setPendingMovements(movesData || []);

    } catch (err) {
      console.error('Error fetching confirmations:', err);
      toast.error('Erro ao buscar itens pendentes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile]);

  const confirmPickup = async (orderId: string) => {
    try {
      const supabase = getSupabase();
      
      // 1. Obter detalhes do pedido
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('*, material:materials(*)')
        .eq('id', orderId)
        .single();
        
      if (fetchError) throw fetchError;

      // 2. Atualizar status do pedido para PICKED_UP
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: 'PICKED_UP'
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      toast.success('Retirada confirmada!');
      fetchData();
    } catch (err) {
      console.error('Erro ao confirmar retirada:', err);
      toast.error('Erro ao confirmar retirada.');
    }
  };

  const confirmDelivery = async (orderId: string, deliveredTo: string) => {
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'DELIVERED',
          delivered_to_name: deliveredTo
        })
        .eq('id', orderId);

      if (error) throw error;
      toast.success('Entrega confirmada!');
      setIsPickupDeliveryModalOpen(false);
      setPickupDeliveryData({ delivered_to_name: '' });
      fetchData();
    } catch (err) {
      console.error('Erro ao confirmar entrega:', err);
      toast.error('Erro ao confirmar entrega.');
    }
  };

  const confirmOrderReceipt = async (orderId: string) => {
    try {
      const supabase = getSupabase();

      // 1. Atualizar status do pedido para RECEIVED
      // O gatilho no banco de dados cuidará da atualização do estoque e log de movimentação
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: 'RECEIVED',
          received_by: profile?.full_name || profile?.email || ''
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      toast.success('Recebimento confirmado e estoque atualizado!');
      fetchData();
    } catch (err) {
      console.error('Erro ao confirmar recebimento:', err);
      toast.error('Erro ao confirmar recebimento.');
    }
  };

  const confirmMovement = async (movementId: string) => {
    try {
      const supabase = getSupabase();
      
      // Get movement details first
      const { data: move, error: fetchError } = await supabase
        .from('equipment_movements')
        .select('*')
        .eq('id', movementId)
        .single();

      if (fetchError) throw fetchError;

      // Update movement status
      const { error: moveError } = await supabase
        .from('equipment_movements')
        .update({ 
          status: 'CONFIRMED',
          confirmed_at: new Date().toISOString()
        })
        .eq('id', movementId);

      if (moveError) throw moveError;

      // Update equipment current responsible and project
      const { error: equipError } = await supabase
        .from('equipment')
        .update({
          current_responsible_id: move.to_responsible_id,
          current_responsible: profile?.full_name || profile?.email || '',
          current_project: move.to_project,
          status: 'IN_USE'
        })
        .eq('id', move.equipment_id);

      if (equipError) throw equipError;

      toast.success('Recebimento de equipamento confirmado!');
      fetchData();
    } catch (err) {
      console.error('Error confirming movement:', err);
      toast.error('Erro ao confirmar recebimento de equipamento.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900"></div>
      </div>
    );
  }

  const totalPending = pendingOrders.length + pendingMovements.length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-neutral-900 italic serif">Minhas Confirmações</h2>
        <p className="text-neutral-500">Itens que aguardam sua confirmação de recebimento</p>
      </div>

      {totalPending === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-neutral-200 text-center">
          <div className="w-16 h-16 bg-neutral-50 text-neutral-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="text-lg font-bold text-neutral-900 mb-1">Tudo em dia!</h3>
          <p className="text-neutral-500">Você não possui itens pendentes de confirmação no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Orders Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <PackageCheck className="text-neutral-900" size={20} />
              <h3 className="text-xl font-bold text-neutral-900 italic serif">Materiais a Receber ({pendingOrders.length})</h3>
            </div>
            <div className="space-y-4">
              {pendingOrders.map((order) => (
                <motion.div 
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-neutral-900">{order.material?.name}</h4>
                      <p className="text-sm text-neutral-500">{order.quantity} {order.material?.unit}</p>
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                      order.status === 'AWAITING_PICKUP' ? "bg-purple-100 text-purple-700" : 
                      order.status === 'PICKED_UP' ? "bg-blue-100 text-blue-700" :
                      order.status === 'DELIVERED' ? "bg-yellow-100 text-yellow-700" :
                      order.status === 'RECEIVED' ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-700"
                    )}>
                      {order.status === 'AWAITING_PICKUP' ? 'Aguardando Retirada' : 
                       order.status === 'PICKED_UP' ? 'Retirado (Em Trânsito)' :
                       order.status === 'DELIVERED' ? 'Entregue (Aguardando Recebimento)' :
                       order.status === 'RECEIVED' ? 'Recebido' : order.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div className="flex items-center gap-2 text-neutral-600">
                      <Building2 size={14} />
                      <span>{order.project} - {order.apartment}</span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-600">
                      <Calendar size={14} />
                      <span>{format(new Date(order.created_at), "dd/MM/yy", { locale: ptBR })}</span>
                    </div>
                    {order.pickup_by_name && (
                      <div className="flex items-center gap-2 text-neutral-600 col-span-2">
                        <User size={14} />
                        <span>Responsável: {order.pickup_by_name}</span>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => {
                      if (order.status === 'AWAITING_PICKUP') {
                        confirmPickup(order.id);
                      } else if (order.status === 'PICKED_UP') {
                        setSelectedOrder(order);
                        setIsPickupDeliveryModalOpen(true);
                      } else if (order.status === 'DELIVERED') {
                        confirmOrderReceipt(order.id);
                      }
                    }}
                    className={cn(
                      "w-full py-3 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2",
                      order.status === 'AWAITING_PICKUP' ? "bg-purple-600 hover:bg-purple-700" : 
                      order.status === 'PICKED_UP' ? "bg-blue-600 hover:bg-blue-700" :
                      order.status === 'DELIVERED' ? "bg-green-600 hover:bg-green-700" : "bg-neutral-400 cursor-not-allowed"
                    )}
                    disabled={order.status === 'RECEIVED'}
                  >
                    <CheckCircle2 size={18} />
                    {order.status === 'AWAITING_PICKUP' ? 'Confirmar Retirada' : 
                     order.status === 'PICKED_UP' ? 'Confirmar Entrega' :
                     order.status === 'DELIVERED' ? 'Confirmar Recebimento' : 'Concluído'}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Equipment Movements Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="text-neutral-900" size={20} />
              <h3 className="text-xl font-bold text-neutral-900 italic serif">Equipamentos a Receber ({pendingMovements.length})</h3>
            </div>
            <div className="space-y-4">
              {pendingMovements.map((move) => (
                <motion.div 
                  key={move.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-neutral-900">{move.equipment?.name}</h4>
                      <p className="text-sm text-neutral-500">Patrimônio: {move.equipment?.code}</p>
                    </div>
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-[10px] font-bold uppercase tracking-widest">
                      Em Trânsito
                    </span>
                  </div>
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <ArrowRightLeft size={14} />
                      <span>Origem: {move.from_responsible || 'Estoque'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <Building2 size={14} />
                      <span>Destino: {move.to_project}</span>
                    </div>
                    {move.notes && (
                      <div className="flex items-start gap-2 text-sm text-neutral-500 italic bg-neutral-50 p-2 rounded-lg">
                        <Info size={14} className="mt-0.5 shrink-0" />
                        <span>{move.notes}</span>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => confirmMovement(move.id)}
                    className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    Confirmar Recebimento
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pickup Delivery Confirmation Modal */}
      <AnimatePresence>
        {isPickupDeliveryModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900 italic serif">Confirmar Entrega</h3>
                <button 
                  onClick={() => setIsPickupDeliveryModalOpen(false)} 
                  className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                  <p className="text-sm text-blue-800 font-medium">
                    Você está confirmando a entrega de:
                  </p>
                  <p className="text-lg font-bold text-blue-900">
                    {selectedOrder.material?.name} ({selectedOrder.quantity} {selectedOrder.material?.unit})
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">
                    Para quem ou onde foi colocado o material?
                  </label>
                  <textarea 
                    autoFocus
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 min-h-[100px]"
                    placeholder="Ex: Entregue para o encarregado João no 4º andar..."
                    value={pickupDeliveryData.delivered_to_name}
                    onChange={(e) => setPickupDeliveryData({ delivered_to_name: e.target.value })}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setIsPickupDeliveryModalOpen(false)}
                    className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => confirmDelivery(selectedOrder.id, pickupDeliveryData.delivered_to_name)}
                    disabled={!pickupDeliveryData.delivered_to_name.trim()}
                    className="flex-1 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    Confirmar
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

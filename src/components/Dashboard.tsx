import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  AlertTriangle, 
  Package, 
  HardHat,
  ArrowUpRight,
  ArrowDownRight,
  Database,
  Wrench,
  ShoppingCart,
  Clock,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getSupabase } from '../lib/supabase';
import { seedExampleData } from '../lib/seed';
import { toast } from 'sonner';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalMaterials: 0,
    lowStockCount: 0,
    activeEquipment: 0,
    pendingOrders: 0,
    avgLeadTime: 0
  });

  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [pendingOrdersList, setPendingOrdersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabase();
      
      const [materialsRes, equipmentRes, ordersRes, movementsRes, allOrdersRes] = await Promise.all([
        supabase.from('materials').select('*'),
        supabase.from('equipment').select('*').eq('status', 'IN_USE'),
        supabase.from('orders').select('*, material:materials(*)').eq('status', 'PENDING'),
        supabase.from('movements').select('*, material:materials(*)').order('created_at', { ascending: false }).limit(5),
        supabase.from('orders').select('*')
      ]);

      if (materialsRes.error) console.error('Error fetching materials:', materialsRes.error);
      if (equipmentRes.error) console.error('Error fetching equipment:', equipmentRes.error);
      if (ordersRes.error) console.error('Error fetching orders:', ordersRes.error);
      if (movementsRes.error) console.error('Error fetching movements:', movementsRes.error);

      const materials = materialsRes.data || [];
      const lowStock = materials.filter(m => m.stock_quantity <= m.min_stock).length;
      const allOrders = allOrdersRes.data || [];

      // Calculate average lead time
      const leadTimes = allOrders
        .filter(o => o.use_date && o.created_at)
        .map(o => differenceInDays(parseISO(o.use_date), parseISO(o.created_at)));
      
      const avgLeadTime = leadTimes.length > 0 
        ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length 
        : 0;

      setStats({
        totalMaterials: materials.length,
        lowStockCount: lowStock,
        activeEquipment: equipmentRes.data?.length || 0,
        pendingOrders: ordersRes.data?.length || 0,
        avgLeadTime: Math.round(avgLeadTime * 10) / 10
      });

      setRecentMovements(movementsRes.data || []);
      setPendingOrdersList(ordersRes.data || []);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 italic serif">Visão Geral</h2>
          <p className="text-sm text-neutral-500">Status operacional e alertas da obra</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard 
          title="Estoque" 
          value={stats.totalMaterials.toString()} 
          trend="Total" 
          trendUp={true}
          icon={Package}
        />
        <StatCard 
          title="Crítico" 
          value={stats.lowStockCount.toString()} 
          trend="Atenção" 
          trendUp={false}
          icon={AlertTriangle}
          critical={stats.lowStockCount > 0}
        />
        <StatCard 
          title="Em Uso" 
          value={stats.activeEquipment.toString()} 
          trend="Ativos" 
          trendUp={true}
          icon={Wrench}
        />
        <StatCard 
          title="Antecedência" 
          value={`${stats.avgLeadTime}d`} 
          trend={stats.avgLeadTime < 3 ? "ALERTA" : "OK"} 
          trendUp={stats.avgLeadTime >= 3}
          icon={Calendar}
          critical={stats.avgLeadTime < 3}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Recent Movements */}
        <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 md:p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
            <h3 className="text-base md:text-lg font-bold text-neutral-900 italic serif">Últimas Movimentações</h3>
            <button className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest hover:text-neutral-900 transition-colors">Ver Todas</button>
          </div>
          <div className="divide-y divide-neutral-100 overflow-y-auto max-h-[400px] no-scrollbar">
            {recentMovements.map((m) => (
              <div key={m.id} className="p-3 md:p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-xl transition-transform group-hover:scale-110",
                    m.type === 'IN' ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"
                  )}>
                    {m.type === 'IN' ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-neutral-900 text-sm truncate">{m.material?.name}</p>
                    <p className="text-[10px] text-neutral-500 truncate">{m.project || 'Geral'} • {m.responsible}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn(
                    "font-bold text-sm",
                    m.type === 'IN' ? "text-green-600" : "text-orange-600"
                  )}>
                    {m.type === 'IN' ? '+' : '-'}{m.quantity} {m.material?.unit}
                  </p>
                  <p className="text-[9px] text-neutral-400 uppercase font-bold">
                    {safeFormatDate(m.created_at, "HH:mm")}
                  </p>
                </div>
              </div>
            ))}
            {recentMovements.length === 0 && (
              <div className="p-8 text-center text-neutral-400 text-sm">Nenhuma movimentação recente</div>
            )}
          </div>
        </div>

        {/* Pending Orders */}
        <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 md:p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
            <h3 className="text-base md:text-lg font-bold text-neutral-900 italic serif">Pedidos Pendentes</h3>
            <button className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest hover:text-neutral-900 transition-colors">Gerenciar</button>
          </div>
          <div className="divide-y divide-neutral-100 overflow-y-auto max-h-[400px] no-scrollbar">
            {pendingOrdersList.map((o) => (
              <div key={o.id} className="p-3 md:p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl transition-transform group-hover:scale-110">
                    <Clock size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-neutral-900 text-sm truncate">{o.material?.name}</p>
                    <p className="text-[10px] text-neutral-500 truncate">Solicitado por {o.requested_by}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-neutral-900 text-sm">{o.quantity} {o.material?.unit}</p>
                  <p className="text-[9px] text-neutral-400 uppercase font-bold">
                    Prev: {safeFormatDate(o.expected_delivery, "dd/MM")}
                  </p>
                </div>
              </div>
            ))}
            {pendingOrdersList.length === 0 && (
              <div className="p-8 text-center text-neutral-400 text-sm">Nenhum pedido pendente</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, trendUp, icon: Icon, critical }: { title: string, value: string, trend: string, trendUp: boolean, icon: any, critical?: boolean }) {
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className={cn(
        "bg-white p-4 md:p-6 rounded-3xl border border-neutral-200 shadow-sm flex flex-col justify-between",
        critical && "border-orange-200 bg-orange-50"
      )}
    >
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className={cn(
          "p-1.5 md:p-2 rounded-xl",
          critical ? "bg-orange-100 text-orange-600" : "bg-neutral-100 text-neutral-600"
        )}>
          <Icon size={18} className="md:w-5 md:h-5" />
        </div>
        <div className={cn(
          "flex items-center gap-1 text-[9px] md:text-xs font-bold px-2 py-0.5 md:py-1 rounded-full",
          trendUp ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-700"
        )}>
          {trendUp ? <ArrowUpRight size={10} className="md:w-3 md:h-3" /> : <ArrowDownRight size={10} className="md:w-3 md:h-3" />}
          {trend}
        </div>
      </div>
      <div>
        <p className="text-[9px] md:text-xs font-bold text-neutral-400 uppercase tracking-widest mb-0.5 md:mb-1">{title}</p>
        <p className="text-xl md:text-2xl font-bold text-neutral-900">{value}</p>
      </div>
    </motion.div>
  );
}

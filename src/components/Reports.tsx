import React, { useEffect, useState } from 'react';
import { 
  BarChart as BarChartIcon, 
  PieChart as PieChartIcon, 
  Download, 
  FileText, 
  Table,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  HardHat,
  Calendar,
  Building2,
  ArrowRightLeft,
  Lock,
  Clock,
  FileSpreadsheet
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { getSupabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = ['#141414', '#5A5A40', '#F27D26', '#8E9299', '#E4E3E0'];

export default function Reports() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'DEV';
  const [loading, setLoading] = useState(true);
  const [materialUsage, setMaterialUsage] = useState<any[]>([]);
  const [employeeLeadTimes, setEmployeeLeadTimes] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [period, setPeriod] = useState<'7d' | '30d' | 'month' | 'all'>('30d');
  const [isExporting, setIsExporting] = useState(false);

  const exportToExcel = () => {
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Resumo
      const summaryData = [
        ['Total de Movimentações', summary.totalMovements],
        ['Empreendimento Mais Ativo', summary.topProject],
        ['Material Mais Consumido', summary.topMaterial],
        ['Materiais no Sistema', summary.activeMaterials],
        ['Antecedência Média (dias)', summary.avgLeadTime]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet([['Métrica', 'Valor'], ...summaryData]);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

      // Consumo de Materiais
      const wsMaterials = XLSX.utils.json_to_sheet(materialUsage.map(m => ({
        'Material': m.name,
        'Quantidade': m.qty
      })));
      XLSX.utils.book_append_sheet(wb, wsMaterials, "Consumo");

      // Antecedência por Funcionário
      const wsLeadTime = XLSX.utils.json_to_sheet(employeeLeadTimes.map(e => ({
        'Funcionário': e.name,
        'Antecedência Média (dias)': e.avg
      })));
      XLSX.utils.book_append_sheet(wb, wsLeadTime, "Antecedência");

      // Movimentações
      const wsMovements = XLSX.utils.json_to_sheet(movements.map(m => ({
        'Data': format(parseISO(m.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        'Tipo': m.type === 'IN' ? 'Entrada' : 'Saída',
        'Material': m.material?.name || '---',
        'Quantidade': m.quantity,
        'Projeto': m.project || '---',
        'Responsável': m.responsible || '---'
      })));
      XLSX.utils.book_append_sheet(wb, wsMovements, "Movimentações");

      XLSX.writeFile(wb, `Relatorio_Geral_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      
      // Título
      doc.setFontSize(20);
      doc.text("Relatório Executivo", 14, 22);
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
      doc.text(`Período analisado: ${period === '7d' ? 'Últimos 7 dias' : period === '30d' ? 'Últimos 30 dias' : period === 'month' ? 'Este Mês' : 'Todo o período'}`, 14, 36);

      // Resumo Executivo
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text("Resumo Executivo", 14, 50);

      autoTable(doc, {
        startY: 55,
        head: [['Métrica', 'Valor']],
        body: [
          ['Total de Movimentações', summary.totalMovements.toString()],
          ['Empreendimento Mais Ativo', summary.topProject],
          ['Material Mais Consumido', summary.topMaterial],
          ['Materiais no Sistema', summary.activeMaterials.toString()],
          ['Antecedência Média (dias)', summary.avgLeadTime.toString()]
        ],
        theme: 'grid',
        headStyles: { fillColor: [20, 20, 20] }
      });

      // Top 5 Materiais
      doc.text("Top 5 Materiais Consumidos", 14, (doc as any).lastAutoTable.finalY + 15);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Material', 'Quantidade']],
        body: materialUsage.slice(0, 5).map(m => [m.name, m.qty.toString()]),
        theme: 'grid',
        headStyles: { fillColor: [20, 20, 20] }
      });

      // Antecedência por Funcionário
      doc.text("Antecedência Média por Funcionário", 14, (doc as any).lastAutoTable.finalY + 15);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Funcionário', 'Antecedência Média (dias)']],
        body: employeeLeadTimes.map(e => [e.name, e.avg.toString()]),
        theme: 'grid',
        headStyles: { fillColor: [20, 20, 20] }
      });

      // Últimas Movimentações
      doc.addPage();
      doc.text("Últimas Movimentações", 14, 20);
      autoTable(doc, {
        startY: 25,
        head: [['Data', 'Tipo', 'Material', 'Qtd', 'Projeto', 'Responsável']],
        body: movements.slice(0, 50).map(m => [
          format(parseISO(m.created_at), 'dd/MM/yy HH:mm'),
          m.type === 'IN' ? 'Entrada' : 'Saída',
          m.material?.name || '---',
          m.quantity.toString(),
          m.project || '---',
          m.responsible || '---'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [20, 20, 20] },
        styles: { fontSize: 8 }
      });

      doc.save(`Relatorio_Executivo_${format(new Date(), 'dd_MM_yyyy')}.pdf`);
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };
  
  const [summary, setSummary] = useState({
    topProject: '---',
    topMaterial: '---',
    totalMovements: 0,
    activeMaterials: 0,
    avgLeadTime: 0
  });

  const fetchReportData = async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      
      const [movementsRes, materialsRes, ordersRes, profilesRes] = await Promise.all([
        supabase.from('movements').select('*, material:materials(*)'),
        supabase.from('materials').select('*'),
        supabase.from('orders').select('*'),
        supabase.from('profiles').select('*')
      ]);

      let allMovements = movementsRes.data || [];
      const allMaterials = materialsRes.data || [];
      const allOrders = ordersRes.data || [];
      const allProfiles = profilesRes.data || [];

      // Filter by period
      const now = new Date();
      let startDate: Date | null = null;
      if (period === '7d') startDate = subDays(now, 7);
      else if (period === '30d') startDate = subDays(now, 30);
      else if (period === 'month') startDate = startOfMonth(now);

      if (startDate) {
        allMovements = allMovements.filter(m => new Date(m.created_at) >= startDate!);
      }

      const usageByMaterial: Record<string, number> = {};
      const movementsByProject: Record<string, number> = {};

      allMovements.forEach(m => {
        if (m.type === 'OUT' && m.material) {
          usageByMaterial[m.material.name] = (usageByMaterial[m.material.name] || 0) + m.quantity;
          const project = m.project || 'Geral';
          movementsByProject[project] = (movementsByProject[project] || 0) + 1;
        }
      });

      // Calculate average lead time (antecedência)
      const leadTimes = allOrders
        .filter(o => o.use_date && o.created_at)
        .map(o => differenceInDays(parseISO(o.use_date), parseISO(o.created_at)));
      
      const avgLeadTime = leadTimes.length > 0 
        ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length 
        : 0;

      // Calculate lead time per employee
      const leadTimeByEmployee: Record<string, { total: number, count: number, name: string }> = {};
      allOrders.forEach(o => {
        if (o.use_date && o.created_at && o.requested_by_id) {
          const days = differenceInDays(parseISO(o.use_date), parseISO(o.created_at));
          const profile = allProfiles.find(p => p.id === o.requested_by_id);
          const name = profile?.full_name || o.requested_by || 'Desconhecido';
          
          if (!leadTimeByEmployee[o.requested_by_id]) {
            leadTimeByEmployee[o.requested_by_id] = { total: 0, count: 0, name };
          }
          leadTimeByEmployee[o.requested_by_id].total += days;
          leadTimeByEmployee[o.requested_by_id].count += 1;
        }
      });

      const employeeLeadTimeData = Object.values(leadTimeByEmployee)
        .map(item => ({
          name: item.name,
          avg: Math.round((item.total / item.count) * 10) / 10
        }))
        .sort((a, b) => b.avg - a.avg);

      const sortedMaterials = Object.entries(usageByMaterial)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty);

      const sortedProjects = Object.entries(movementsByProject)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      setMaterialUsage(sortedMaterials.slice(0, 5));
      setEmployeeLeadTimes(employeeLeadTimeData);
      setMovements(allMovements.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      
      setSummary({
        topProject: sortedProjects[0]?.name || 'Nenhum',
        topMaterial: sortedMaterials[0]?.name || 'Nenhum',
        totalMovements: allMovements.length,
        activeMaterials: allMaterials.length,
        avgLeadTime: Math.round(avgLeadTime * 10) / 10
      });

    } catch (err) {
      console.error('Error fetching report data:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReportData();
  }, [period, isAdmin]);

  const exportMovementsOnly = () => {
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      const wsMovements = XLSX.utils.json_to_sheet(movements.map(m => ({
        'Data': format(parseISO(m.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        'Tipo': m.type === 'IN' ? 'Entrada' : 'Saída',
        'Material': m.material?.name || '---',
        'Quantidade': m.quantity,
        'Unidade': m.material?.unit || '---',
        'Projeto': m.project || 'Geral',
        'Apartamento': m.apartment || '---',
        'Responsável': m.responsible || '---',
        'Descrição': m.service_description || '---'
      })));
      XLSX.utils.book_append_sheet(wb, wsMovements, "Movimentações");
      XLSX.writeFile(wb, `Relatorio_Movimentacoes_Materiais_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
      toast.success('Relatório de movimentações exportado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      toast.error('Erro ao exportar relatório.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="p-6 bg-neutral-100 rounded-full text-neutral-400">
          <Lock size={48} />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 italic serif">Acesso Restrito</h2>
        <p className="text-neutral-500 max-w-md">
          Apenas administradores têm acesso aos relatórios estratégicos e análises de desempenho da obra.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 italic serif">Relatórios Estratégicos</h2>
          <p className="text-sm text-neutral-500">Análise de custos, consumo e projetos</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white border border-neutral-200 rounded-xl p-1 shadow-sm">
            {(['7d', '30d', 'month', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap",
                  period === p ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-500 hover:bg-neutral-50"
                )}
              >
                {p === '7d' ? '7 Dias' : p === '30d' ? '30 Dias' : p === 'month' ? 'Este Mês' : 'Tudo'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={exportToExcel}
              disabled={isExporting}
              className="p-2 bg-white border border-neutral-200 text-neutral-700 rounded-xl hover:bg-neutral-50 transition-colors disabled:opacity-50 shadow-sm"
              title="Excel Geral"
            >
              <FileSpreadsheet size={18} />
            </button>
            <button 
              onClick={exportToPDF}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold hover:bg-neutral-800 transition-colors disabled:opacity-50 shadow-lg shadow-neutral-200"
            >
              <FileText size={16} />
              PDF Executivo
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <div className="bg-neutral-900 text-white p-4 md:p-6 rounded-3xl shadow-xl relative overflow-hidden">
          <ArrowRightLeft className="absolute -right-4 -bottom-4 text-white/10" size={80} />
          <p className="text-neutral-400 text-[9px] md:text-[10px] uppercase tracking-widest font-bold mb-1">Movimentações</p>
          <h3 className="text-xl md:text-2xl font-bold italic serif">{summary.totalMovements}</h3>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-neutral-400 text-[9px] md:text-[10px] uppercase tracking-widest font-bold mb-1">Top Projeto</p>
          <h3 className="text-lg md:text-xl font-bold text-neutral-900 italic serif truncate">{summary.topProject}</h3>
          <div className="flex items-center gap-1.5 text-neutral-500 text-[10px] mt-1">
            <Building2 size={12} />
            <span>Mais ativo</span>
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-neutral-400 text-[9px] md:text-[10px] uppercase tracking-widest font-bold mb-1">Itens</p>
          <h3 className="text-lg md:text-xl font-bold text-neutral-900 italic serif truncate">{summary.activeMaterials}</h3>
          <div className="flex items-center gap-1.5 text-neutral-500 text-[10px] mt-1">
            <Package size={12} />
            <span>Cadastrados</span>
          </div>
        </div>

        <div className={cn(
          "p-4 md:p-6 rounded-3xl border shadow-sm transition-colors",
          summary.avgLeadTime < 3 ? "bg-orange-50 border-orange-200" : "bg-white border-neutral-200"
        )}>
          <p className="text-neutral-400 text-[9px] md:text-[10px] uppercase tracking-widest font-bold mb-1">Antecedência</p>
          <h3 className={cn(
            "text-lg md:text-xl font-bold italic serif truncate",
            summary.avgLeadTime < 3 ? "text-orange-600" : "text-neutral-900"
          )}>
            {summary.avgLeadTime} dias
          </h3>
          <div className="flex items-center gap-1.5 text-neutral-500 text-[10px] mt-1">
            <Calendar size={12} />
            <span>{summary.avgLeadTime < 3 ? 'Atenção' : 'Planejamento OK'}</span>
          </div>
        </div>
      </div>

      {/* Detailed Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Material Consumption */}
        <div className="bg-white p-5 md:p-8 rounded-3xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg md:text-xl font-bold text-neutral-900 italic serif">Consumo (Top 5)</h3>
            <BarChartIcon size={18} className="text-neutral-400" />
          </div>
          <div className="h-[280px] md:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={materialUsage}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#141414' }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8E9299' }} />
                <Tooltip 
                  cursor={{ fill: '#F5F5F5' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="qty" fill="#141414" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Time per Employee */}
        <div className="bg-white p-5 md:p-8 rounded-3xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg md:text-xl font-bold text-neutral-900 italic serif">Antecedência p/ Func.</h3>
            <Clock size={18} className="text-neutral-400" />
          </div>
          <div className="h-[280px] md:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employeeLeadTimes} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F0F0F0" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8E9299' }} />
                <YAxis 
                  dataKey="name" 
                  type="category"
                  axisLine={false} 
                  tickLine={false}
                  width={80}
                  tick={{ fontSize: 9, fontWeight: 600, fill: '#141414' }}
                />
                <Tooltip 
                  cursor={{ fill: '#F5F5F5' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="avg" radius={[0, 6, 6, 0]} barSize={24}>
                  {employeeLeadTimes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.avg < 3 ? '#EF4444' : '#141414'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Movement History */}
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-neutral-900 italic serif">Histórico de Movimentações Geral</h3>
          <ArrowRightLeft size={20} className="text-neutral-400" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50">
                <th className="px-8 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Data</th>
                <th className="px-8 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Material</th>
                <th className="px-8 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Tipo</th>
                <th className="px-8 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Qtd</th>
                <th className="px-8 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Empreendimento</th>
                <th className="px-8 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {movements.map((move) => (
                <tr key={move.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-8 py-4 text-sm text-neutral-600">
                    {format(new Date(move.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </td>
                  <td className="px-8 py-4 font-bold text-neutral-900">{move.material?.name}</td>
                  <td className="px-8 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                      move.type === 'IN' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {move.type === 'IN' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td className="px-8 py-4 font-bold text-neutral-900">{move.quantity} {move.material?.unit}</td>
                  <td className="px-8 py-4 text-neutral-600">{move.project || '-'}</td>
                  <td className="px-8 py-4 text-neutral-600">{move.responsible}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-neutral-500 italic">
                    Nenhuma movimentação registrada no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

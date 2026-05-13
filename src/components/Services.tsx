import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  HardHat, 
  Calendar, 
  DollarSign, 
  Search, 
  User, 
  X, 
  CheckCircle2,
  Briefcase,
  Building2,
  Lock,
  Edit2,
  Trash2
} from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { Provider, ServiceRecord, Area, Project } from '../types';
import { cn } from '../lib/utils';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filter, Download, ChevronDown, FileText } from 'lucide-react';

const AREAS: Area[] = ['Civil', 'Acabamento', 'Elétrica', 'Hidráulica', 'Impermeabilização'];

export default function Services() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'DEV';
  const isForeman = profile?.role === 'FOREMAN';
  const [providers, setProviders] = useState<Provider[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [isEditProviderModalOpen, setIsEditProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<ServiceRecord | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [filterProvider, setFilterProvider] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [newRecord, setNewRecord] = useState({
    provider_id: '',
    area: 'Civil' as Area,
    date: format(new Date(), 'yyyy-MM-dd'),
    quantity: 1.0,
    project: '',
    descriptions: [''],
    service_value: 0,
  });

  const [newProvider, setNewProvider] = useState({
    name: '',
    service_type: '',
    area: 'Civil' as Area,
    daily_rate: 0,
    active: true,
  });

  const [activeTab, setActiveTab] = useState<'records' | 'providers'>('records');

  const [searchTerm, setSearchTerm] = useState('');

  const filteredProviders = providers.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.service_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRecords = records.filter(r => {
    const matchesSearch = 
      r.provider?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.project?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.descriptions?.some(d => d.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesProvider = !filterProvider || r.provider_id === filterProvider;
    const matchesProject = !filterProject || r.project === filterProject;
    
    let matchesDate = true;
    if (startDate || endDate) {
      const recordDate = parseISO(r.date);
      const start = startDate ? startOfDay(parseISO(startDate)) : null;
      const end = endDate ? endOfDay(parseISO(endDate)) : null;
      
      if (start && end) {
        matchesDate = isWithinInterval(recordDate, { start, end });
      } else if (start) {
        matchesDate = recordDate >= start;
      } else if (end) {
        matchesDate = recordDate <= end;
      }
    }

    return matchesSearch && matchesProvider && matchesProject && matchesDate;
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [providersRes, recordsRes, projectsRes] = await Promise.all([
        getSupabase().from('providers').select('*').order('name', { ascending: true }),
        getSupabase().from('service_records').select('*, provider:providers(*), creator:profiles(full_name)').order('date', { ascending: false }),
        getSupabase().from('projects').select('*').eq('status', 'ACTIVE').order('name', { ascending: true })
      ]);

      if (providersRes.error) toast.error('Erro ao buscar prestadores: ' + providersRes.error.message);
      else setProviders(providersRes.data || []);

      if (recordsRes.error) toast.error('Erro ao buscar diárias: ' + recordsRes.error.message);
      else setRecords(recordsRes.data || []);

      if (projectsRes.error) toast.error('Erro ao buscar empreendimentos: ' + projectsRes.error.message);
      else setProjects(projectsRes.data || []);
    } catch (err) {
      console.error('Supabase initialization error:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await getSupabase()
        .from('service_records')
        .insert([{
          provider_id: newRecord.provider_id,
          area: newRecord.area,
          date: newRecord.date,
          quantity: newRecord.quantity,
          project: newRecord.project,
          description: newRecord.descriptions[0] || '',
          descriptions: newRecord.descriptions,
          service_value: newRecord.quantity === 0 ? newRecord.service_value : 0,
          created_by_id: profile?.id
        }]);

      if (error) {
        // If created_by_id is still missing, try without it
        if (error.message.includes('created_by_id')) {
          const { error: retryError } = await getSupabase()
            .from('service_records')
            .insert([{
              provider_id: newRecord.provider_id,
              area: newRecord.area,
              date: newRecord.date,
              quantity: newRecord.quantity,
              project: newRecord.project,
              description: newRecord.descriptions[0] || '',
              descriptions: newRecord.descriptions,
              service_value: newRecord.quantity === 0 ? newRecord.service_value : 0,
            }]);
          
          if (retryError) {
            toast.error('Erro ao registrar serviço: ' + retryError.message);
            return;
          }
        } else {
          toast.error('Erro ao registrar serviço: ' + error.message);
          return;
        }
      }
      
      toast.success('Diária lançada com sucesso!');
      setIsModalOpen(false);
      fetchData();
      setNewRecord({
        provider_id: '',
        area: 'Civil',
        date: format(new Date(), 'yyyy-MM-dd'),
        quantity: 1.0,
        project: '',
        descriptions: [''],
        service_value: 0,
      });
    } catch (err) {
      toast.error('Erro de configuração: ' + (err as Error).message);
    }
  };

  const handleCreateProvider = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await getSupabase()
        .from('providers')
        .insert([newProvider]);

      if (error) {
        toast.error('Erro ao cadastrar prestador: ' + error.message);
      } else {
        toast.success('Prestador cadastrado com sucesso!');
        setIsProviderModalOpen(false);
        fetchData();
        setNewProvider({
          name: '',
          service_type: '',
          area: 'Civil',
          daily_rate: 0,
          active: true,
        });
      }
    } catch (err) {
      toast.error('Erro de configuração: ' + (err as Error).message);
    }
  };

  const handleUpdateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider) return;

    try {
      const { error } = await getSupabase()
        .from('providers')
        .update({
          name: editingProvider.name,
          service_type: editingProvider.service_type,
          area: editingProvider.area,
          daily_rate: editingProvider.daily_rate,
          active: editingProvider.active,
        })
        .eq('id', editingProvider.id);

      if (error) {
        toast.error('Erro ao atualizar prestador: ' + error.message);
      } else {
        toast.success('Prestador atualizado com sucesso!');
        setIsEditProviderModalOpen(false);
        setEditingProvider(null);
        fetchData();
      }
    } catch (err) {
      toast.error('Erro de configuração: ' + (err as Error).message);
    }
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    try {
      const updateData: any = {
        provider_id: selectedRecord.provider_id,
        area: selectedRecord.area,
        date: selectedRecord.date,
        quantity: selectedRecord.quantity,
        project: selectedRecord.project,
        description: selectedRecord.descriptions?.[0] || selectedRecord.description || '',
        descriptions: selectedRecord.descriptions || [selectedRecord.description || ''],
        service_value: selectedRecord.quantity === 0 ? selectedRecord.service_value : 0,
      };

      const { error } = await getSupabase()
        .from('service_records')
        .update(updateData)
        .eq('id', selectedRecord.id);

      if (error) {
        toast.error('Erro ao atualizar serviço: ' + error.message);
      } else {
        toast.success('Diária atualizada com sucesso!');
        setIsEditModalOpen(false);
        setSelectedRecord(null);
        fetchData();
      }
    } catch (err) {
      toast.error('Erro de configuração: ' + (err as Error).message);
    }
  };

  const exportToExcel = () => {
    if (filteredRecords.length === 0) {
      toast.error('Nenhum registro para exportar.');
      return;
    }

    const data = filteredRecords.map(r => {
      const row: any = {
        'Data': format(parseISO(r.date), 'dd/MM/yyyy'),
        'Prestador': r.provider?.name || 'N/A',
        'Lançado Por': r.creator?.full_name || 'Desconhecido',
        'Área': r.area,
        'Empreendimento': r.project || 'Geral',
        'Quantidade': r.quantity === 0 ? 'Serviço' : r.quantity,
        'Valor Diária (R$)': !isForeman ? (r.provider?.daily_rate || 0) : 0,
        'Descrições': r.descriptions?.join('; ') || r.description || ''
      };

      if (isAdmin) {
        row['Valor Serviço (R$)'] = r.quantity === 0 ? r.service_value || 0 : 0;
        row['Valor Total (R$)'] = r.quantity === 0 ? (r.service_value || 0) : (r.quantity * (r.provider?.daily_rate || 0));
      }

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório de Serviços');
    XLSX.writeFile(wb, `Relatorio_Servicos_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
    toast.success('Excel gerado com sucesso!');
  };

  const exportToPDF = () => {
    if (filteredRecords.length === 0) {
      toast.error('Nenhum registro para exportar.');
      return;
    }

    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Relatório Executivo de Serviços', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 14, 30);
    
    if (startDate || endDate) {
      const period = `Período: ${startDate ? format(parseISO(startDate), 'dd/MM/yyyy') : 'Início'} até ${endDate ? format(parseISO(endDate), 'dd/MM/yyyy') : 'Hoje'}`;
      doc.text(period, 14, 36);
    }

    // Resumo
    const totalDiarias = filteredRecords.reduce((sum, r) => sum + r.quantity, 0);
    const totalServicos = filteredRecords.filter(r => r.quantity === 0).length;
    
    const summaryHead = ['Total de Diárias', 'Qtd Serviços', 'Prestadores Únicos', 'Lançamentos'];
    const summaryBody = [
      totalDiarias.toFixed(1),
      totalServicos.toString(),
      new Set(filteredRecords.map(r => r.provider_id)).size.toString(),
      filteredRecords.length.toString()
    ];

    if (isAdmin) {
      const valorTotal = filteredRecords.reduce((sum, r) => {
        if (r.quantity === 0) return sum + (r.service_value || 0);
        return sum + (r.quantity * (r.provider?.daily_rate || 0));
      }, 0);
      summaryHead.splice(2, 0, 'Valor Total (R$)');
      summaryBody.splice(2, 0, `R$ ${valorTotal.toFixed(2)}`);
    }
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Resumo', 14, 50);
    
    autoTable(doc, {
      startY: 55,
      head: [summaryHead],
      body: [summaryBody],
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Allocation per project (Admin only)
    if (isAdmin) {
      const allocationByProject = filteredRecords.reduce((acc, r) => {
        const project = r.project || 'Geral';
        const value = r.quantity === 0 ? (r.service_value || 0) : (r.quantity * (r.provider?.daily_rate || 0));
        acc[project] = (acc[project] || 0) + value;
        return acc;
      }, {} as Record<string, number>);

      const allocationData = Object.entries(allocationByProject).map(([project, value]: [string, number]) => [
        project,
        `R$ ${value.toFixed(2)}`
      ]);

      doc.setFontSize(14);
      doc.text('Alocação por Empreendimento', 14, (doc as any).lastAutoTable.finalY + 15);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Empreendimento', 'Valor Total (R$)']],
        body: allocationData,
        theme: 'grid',
        headStyles: { fillColor: [46, 204, 113] },
      });

      // Alocação por Prestador
      const allocationByProvider = filteredRecords.reduce((acc, r) => {
        const prestador = r.provider?.name || 'Diversos/Outros';
        const value = r.quantity === 0 ? (r.service_value || 0) : (r.quantity * (r.provider?.daily_rate || 0));
        acc[prestador] = (acc[prestador] || 0) + value;
        return acc;
      }, {} as Record<string, number>);

      const providerData = Object.entries(allocationByProvider)
        .sort((a, b) => (b[1] as number) - (a[1] as number)) // highest first
        .map(([prestador, value]: [string, number]) => [
          prestador,
          `R$ ${value.toFixed(2)}`
        ]);

      doc.setFontSize(14);
      doc.text('Resumo por Prestador', 14, (doc as any).lastAutoTable.finalY + 15);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Prestador', 'Valor Total (R$)']],
        body: providerData,
        theme: 'grid',
        headStyles: { fillColor: [230, 126, 34] },
      });
    }

    // Sort records by Project then Date for Detalhamento
    const sortedRecords = [...filteredRecords].sort((a, b) => {
      const projA = a.project || 'Geral';
      const projB = b.project || 'Geral';
      if (projA !== projB) return projA.localeCompare(projB);
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Detalhamento
    doc.setFontSize(14);
    doc.text('Detalhamento de Serviços', 14, (doc as any).lastAutoTable.finalY + 15);

    const detailHead = ['Data', 'Prestador', 'Lançador', 'Área', 'Empreendimento', 'Qtd'];
    if (!isForeman) detailHead.push('Diária(R$)');
    if (isAdmin) detailHead.push('Valor(R$)');
    detailHead.push('Descrição');

    const tableData = sortedRecords.map(r => {
      const row = [
        format(parseISO(r.date), 'dd/MM/yyyy'),
        r.provider?.name || 'N/A',
        (r.creator?.full_name || '...').split(' ')[0], // only first name to save space
        r.area,
        r.project || 'Geral',
        r.quantity === 0 ? 'Serviço' : r.quantity.toString(),
      ];
      if (!isForeman) row.push(`R$ ${(r.provider?.daily_rate || 0).toFixed(2)}`);
      if (isAdmin) {
        const valor = r.quantity === 0 ? (r.service_value || 0) : (r.quantity * (r.provider?.daily_rate || 0));
        row.push(`R$ ${valor.toFixed(2)}`);
      }
      row.push(r.descriptions?.join('; ') || r.description || '');
      return row;
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [detailHead],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [52, 73, 94] },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        [detailHead.length - 1]: { cellWidth: 40 } // Descrição mais larga
      }
    });

    doc.save(`Relatorio_Servicos_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    toast.success('PDF gerado com sucesso!');
  };

  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este lançamento?')) return;

    try {
      const { error } = await getSupabase()
        .from('service_records')
        .delete()
        .eq('id', id);

      if (error) toast.error('Erro ao excluir: ' + error.message);
      else {
        toast.success('Lançamento excluído!');
        fetchData();
      }
    } catch (err) {
      toast.error('Erro ao excluir: ' + (err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 italic serif">Diárias e Serviços</h2>
          <p className="text-sm text-neutral-500">Gestão de mão de obra e custos operacionais</p>
        </div>
        <div className="flex overflow-x-auto pb-2 md:pb-0 gap-2 no-scrollbar shrink-0">
          {isAdmin && activeTab === 'records' && (
            <>
              <button 
                onClick={exportToExcel}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-neutral-200 text-neutral-900 rounded-xl font-bold hover:bg-neutral-50 transition-all shadow-sm whitespace-nowrap"
              >
                <Download size={18} />
                <span className="text-xs">Excel</span>
              </button>
              <button 
                onClick={exportToPDF}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all shadow-sm whitespace-nowrap"
              >
                <FileText size={18} />
                <span className="text-xs">PDF</span>
              </button>
            </>
          )}
          <button 
            onClick={() => activeTab === 'records' ? setIsModalOpen(true) : setIsProviderModalOpen(true)}
            className="hidden md:flex items-center justify-center gap-2 px-6 py-2 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200 whitespace-nowrap"
          >
            <Plus size={20} />
            {activeTab === 'records' ? 'Lançar Diária' : 'Novo Prestador'}
          </button>
        </div>
      </div>

      {/* Mobile Floating Action Button */}
      <button 
        onClick={() => activeTab === 'records' ? setIsModalOpen(true) : setIsProviderModalOpen(true)}
        className="md:hidden fixed bottom-20 right-6 z-40 w-14 h-14 bg-neutral-900 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all"
      >
        <Plus size={28} />
      </button>

      {/* Filters for Admin/Dev */}
      {isAdmin && activeTab === 'records' && (
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-widest flex items-center gap-2">
              <Filter size={16} /> Filtros Avançados
            </h3>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="text-xs font-bold text-neutral-500 hover:text-neutral-900 flex items-center gap-1"
            >
              {showFilters ? 'Recolher' : 'Expandir'}
              <ChevronDown size={14} className={cn("transition-transform", showFilters && "rotate-180")} />
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Prestador</label>
                    <select 
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={filterProvider}
                      onChange={(e) => setFilterProvider(e.target.value)}
                    >
                      <option value="">Todos os Prestadores</option>
                      {providers.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Empreendimento</label>
                    <select 
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={filterProject}
                      onChange={(e) => setFilterProject(e.target.value)}
                    >
                      <option value="">Todos os Empreendimentos</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Data Início</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Data Fim</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button 
                    onClick={() => {
                      setFilterProvider('');
                      setFilterProject('');
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="text-xs font-bold text-red-600 hover:underline"
                  >
                    Limpar Filtros
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Tabs and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200">
        <div className="flex gap-8">
          <button 
            onClick={() => setActiveTab('records')}
            className={cn(
              "pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all relative",
              activeTab === 'records' ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-600"
            )}
          >
            Diárias
            {activeTab === 'records' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900" />}
          </button>
          <button 
            onClick={() => setActiveTab('providers')}
            className={cn(
              "pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all relative",
              activeTab === 'providers' ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-600"
            )}
          >
            Prestadores
            {activeTab === 'providers' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900" />}
          </button>
        </div>
        
        <div className="pb-3 md:pb-4 w-full md:w-64">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input 
              type="text"
              placeholder="Buscar..."
              className="w-full pl-10 pr-4 py-2 bg-neutral-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
            />
          </div>
        </div>
      </div>

      {/* Content List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="bg-white rounded-3xl border border-neutral-200 p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
          </div>
        ) : (
          <div className={cn(
            "grid gap-4",
            activeTab === 'records' ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          )}>
            {activeTab === 'records' ? (
              <>
                {filteredRecords.map((record) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={record.id} 
                    className="bg-white p-5 rounded-3xl border border-neutral-200 hover:border-neutral-900 transition-all group"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-neutral-100 rounded-xl text-neutral-600 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                            <Briefcase size={18} />
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-neutral-900">
                              {record.provider?.name || 'Prestador Removido'}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                                {format(parseISO(record.date), "dd 'de' MMMM", { locale: ptBR })}
                              </span>
                              <span className="w-1 h-1 rounded-full bg-neutral-300" />
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                                {record.area}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg uppercase tracking-widest flex items-center gap-1">
                            <Building2 size={10} /> {record.project || 'Geral'}
                          </span>
                          <span className={cn(
                            "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest",
                            record.quantity === 1 ? "bg-green-50 text-green-700" : 
                            record.quantity === 0 ? "bg-purple-50 text-purple-700" : "bg-orange-50 text-orange-700"
                          )}>
                            {record.quantity === 0 ? 'Serviço' : `${record.quantity} Diária(s)`}
                          </span>
                          {isAdmin && record.quantity === 0 && record.service_value !== undefined && record.service_value > 0 && (
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg uppercase tracking-widest">
                              R$ {record.service_value.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* Descrição em destaque */}
                        <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-100">
                          <p className="text-sm text-neutral-600 leading-relaxed">
                            {record.descriptions && record.descriptions.length > 0 
                              ? record.descriptions.join(' • ') 
                              : record.description || 'Sem descrição detalhada'}
                          </p>
                        </div>
                      </div>

                      {(isAdmin || record.created_by_id === profile?.id) && (
                        <div className="flex gap-2 md:self-start">
                          <button 
                            onClick={() => {
                              setSelectedRecord(record);
                              setIsEditModalOpen(true);
                            }}
                            className="flex items-center gap-1 px-3 py-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all"
                          >
                            <Edit2 size={14} />
                            <span className="text-[10px] font-bold uppercase">Editar</span>
                          </button>
                          <button 
                            onClick={() => handleDeleteRecord(record.id)}
                            className="flex items-center gap-1 px-3 py-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 size={14} />
                            <span className="text-[10px] font-bold uppercase">Excluir</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {filteredRecords.length === 0 && (
                  <div className="col-span-full bg-neutral-50 rounded-3xl border-2 border-dashed border-neutral-200 p-12 text-center">
                    <p className="text-neutral-500 font-medium">Nenhuma diária encontrada.</p>
                    {isAdmin && (
                      <button 
                        onClick={() => setIsModalOpen(true)}
                        className="mt-4 text-sm font-bold text-neutral-900 hover:underline"
                      >
                        Lançar primeira diária
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Quick Add Card for Providers */}
                {!searchTerm && (
                  <button 
                    onClick={() => setIsProviderModalOpen(true)}
                    className="bg-neutral-50 p-6 rounded-3xl border-2 border-dashed border-neutral-200 hover:border-neutral-400 transition-all flex flex-col items-center justify-center text-center group"
                  >
                    <div className="p-4 bg-white rounded-full text-neutral-400 group-hover:text-neutral-900 transition-colors mb-3">
                      <Plus size={32} />
                    </div>
                    <p className="font-bold text-neutral-900">Novo Prestador</p>
                    <p className="text-xs text-neutral-500 mt-1">Cadastre uma nova empresa ou profissional</p>
                  </button>
                )}

                {filteredProviders.map((provider) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={provider.id} 
                    className={cn(
                      "bg-white p-6 rounded-3xl border transition-all group relative",
                      provider.active === false ? "border-red-200 opacity-75" : "border-neutral-200 hover:border-neutral-900"
                    )}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={cn(
                        "p-3 rounded-2xl transition-colors",
                        provider.active === false ? "bg-red-50 text-red-600" : "bg-neutral-100 text-neutral-600 group-hover:bg-neutral-900 group-hover:text-white"
                      )}>
                        <User size={20} />
                      </div>
                      <span className="px-2 py-1 bg-neutral-100 text-neutral-600 text-[9px] font-bold rounded-lg uppercase tracking-widest">
                        {provider.area}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-neutral-900 mb-1 truncate">{provider.name}</h4>
                    <div className="flex items-center gap-2 text-xs text-neutral-500 mb-2">
                      <Briefcase size={12} />
                      <span>{provider.service_type}</span>
                    </div>
                    {isAdmin && provider.daily_rate !== undefined && provider.daily_rate > 0 && (
                      <div className="flex items-center gap-2 text-xs font-bold text-green-600 mb-2">
                        <span>Diária: R$ {provider.daily_rate.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="mt-6 pt-4 border-t border-neutral-50 flex justify-between items-center">
                      <span className={cn(
                        "text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded-lg",
                        provider.active === false ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                      )}>
                        {provider.active === false ? 'Inativo' : 'Ativo'}
                      </span>
                      {isAdmin && (
                        <button 
                          onClick={() => {
                            setEditingProvider(provider);
                            setIsEditProviderModalOpen(true);
                          }}
                          className="text-xs font-bold text-neutral-900 hover:underline flex items-center gap-1"
                        >
                          <Edit2 size={12} /> Editar
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
                {filteredProviders.length === 0 && (
                  <div className="col-span-full bg-neutral-50 rounded-3xl border-2 border-dashed border-neutral-200 p-12 text-center">
                    <p className="text-neutral-500 font-medium">Nenhum prestador encontrado.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Record Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center md:p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full h-full md:h-auto md:max-w-lg md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-neutral-900 italic serif">Lançar Diária</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleCreateRecord} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1 flex items-center justify-between">
                    <span>Prestador</span>
                    <button 
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setIsProviderModalOpen(true);
                      }}
                      className="text-[10px] text-neutral-900 hover:underline"
                    >
                      + Novo Prestador
                    </button>
                  </label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={newRecord.provider_id}
                    onChange={(e) => setNewRecord({...newRecord, provider_id: e.target.value})}
                  >
                    <option value="">Selecione o prestador...</option>
                    {providers.filter(p => p.active !== false).map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.service_type})</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Data</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={newRecord.date}
                      onChange={(e) => setNewRecord({...newRecord, date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Tipo de Lançamento</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewRecord({...newRecord, quantity: 0.5})}
                        className={cn(
                          "py-3 text-[10px] md:text-xs font-bold rounded-xl border transition-all",
                          newRecord.quantity === 0.5 
                            ? "bg-neutral-900 text-white border-neutral-900" 
                            : "bg-neutral-50 text-neutral-500 border-neutral-200 hover:border-neutral-400"
                        )}
                      >
                        0.5 Diária
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewRecord({...newRecord, quantity: 1.0})}
                        className={cn(
                          "py-3 text-[10px] md:text-xs font-bold rounded-xl border transition-all",
                          newRecord.quantity === 1.0 
                            ? "bg-neutral-900 text-white border-neutral-900" 
                            : "bg-neutral-50 text-neutral-500 border-neutral-200 hover:border-neutral-400"
                        )}
                      >
                        1.0 Diária
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewRecord({...newRecord, quantity: 0})}
                        className={cn(
                          "py-3 text-[10px] md:text-xs font-bold rounded-xl border transition-all",
                          newRecord.quantity === 0 
                            ? "bg-neutral-900 text-white border-neutral-900" 
                            : "bg-neutral-50 text-neutral-500 border-neutral-200 hover:border-neutral-400"
                        )}
                      >
                        Serviço
                      </button>
                    </div>
                  </div>
                </div>

                {isAdmin && newRecord.quantity === 0 && (
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Valor do Serviço (R$)</label>
                    <input 
                      type="number" 
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={newRecord.service_value || ''}
                      onChange={(e) => setNewRecord({...newRecord, service_value: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Área</label>
                    <select 
                      required
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={newRecord.area}
                      onChange={(e) => setNewRecord({...newRecord, area: e.target.value as Area})}
                    >
                      {AREAS.map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Empreendimento</label>
                    <select 
                      required
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={newRecord.project}
                      onChange={(e) => setNewRecord({...newRecord, project: e.target.value.toUpperCase()})}
                    >
                      <option value="">Selecione o empreendimento...</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest">O que foi feito?</label>
                    <button 
                      type="button"
                      onClick={() => setNewRecord({
                        ...newRecord, 
                        descriptions: [...newRecord.descriptions, '']
                      })}
                      className="text-[10px] font-bold text-neutral-900 flex items-center gap-1 hover:underline"
                    >
                      <Plus size={14} /> Adicionar Descrição
                    </button>
                  </div>

                  {newRecord.descriptions.map((desc, index) => (
                    <div key={index} className="relative">
                      <textarea 
                        required
                        rows={2}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        placeholder="Descrição do serviço..."
                        value={desc}
                        onChange={(e) => {
                          const newDescriptions = [...newRecord.descriptions];
                          newDescriptions[index] = e.target.value;
                          setNewRecord({...newRecord, descriptions: newDescriptions});
                        }}
                      />
                      {newRecord.descriptions.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => {
                            const newDescriptions = newRecord.descriptions.filter((_, i) => i !== index);
                            setNewRecord({...newRecord, descriptions: newDescriptions});
                          }}
                          className="absolute top-2 right-2 p-1 text-neutral-400 hover:text-red-600 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-4 shrink-0 pb-10 md:pb-0">
                  <button type="submit" className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200 flex items-center justify-center gap-2">
                    <CheckCircle2 size={20} />
                    Confirmar Lançamento
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Record Modal */}
      <AnimatePresence>
        {isEditModalOpen && selectedRecord && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900 italic serif">Editar Diária</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleUpdateRecord} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Prestador</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={selectedRecord.provider_id}
                    onChange={(e) => setSelectedRecord({...selectedRecord, provider_id: e.target.value})}
                  >
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.service_type})</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Data</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={selectedRecord.date}
                      onChange={(e) => setSelectedRecord({...selectedRecord, date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Tipo de Lançamento</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRecord({...selectedRecord, quantity: 0.5})}
                        className={cn(
                          "py-3 text-xs font-bold rounded-xl border transition-all",
                          selectedRecord.quantity === 0.5 
                            ? "bg-neutral-900 text-white border-neutral-900" 
                            : "bg-neutral-50 text-neutral-500 border-neutral-200 hover:border-neutral-400"
                        )}
                      >
                        0.5 Diária
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRecord({...selectedRecord, quantity: 1.0})}
                        className={cn(
                          "py-3 text-xs font-bold rounded-xl border transition-all",
                          selectedRecord.quantity === 1.0 
                            ? "bg-neutral-900 text-white border-neutral-900" 
                            : "bg-neutral-50 text-neutral-500 border-neutral-200 hover:border-neutral-400"
                        )}
                      >
                        1.0 Diária
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRecord({...selectedRecord, quantity: 0})}
                        className={cn(
                          "py-3 text-xs font-bold rounded-xl border transition-all",
                          selectedRecord.quantity === 0 
                            ? "bg-neutral-900 text-white border-neutral-900" 
                            : "bg-neutral-50 text-neutral-500 border-neutral-200 hover:border-neutral-400"
                        )}
                      >
                        Serviço
                      </button>
                    </div>
                  </div>
                </div>

                {isAdmin && selectedRecord.quantity === 0 && (
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Valor do Serviço (R$)</label>
                    <input 
                      type="number" 
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={selectedRecord.service_value || ''}
                      onChange={(e) => setSelectedRecord({...selectedRecord, service_value: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Área</label>
                    <select 
                      required
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={selectedRecord.area}
                      onChange={(e) => setSelectedRecord({...selectedRecord, area: e.target.value as Area})}
                    >
                      {AREAS.map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Empreendimento</label>
                    <select 
                      required
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={selectedRecord.project || ''}
                      onChange={(e) => setSelectedRecord({...selectedRecord, project: e.target.value.toUpperCase()})}
                    >
                      <option value="">Selecione o empreendimento...</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest">O que foi feito?</label>
                    <button 
                      type="button"
                      onClick={() => setSelectedRecord({
                        ...selectedRecord, 
                        descriptions: [...(selectedRecord.descriptions || [selectedRecord.description || '']), '']
                      })}
                      className="text-[10px] font-bold text-neutral-900 flex items-center gap-1 hover:underline"
                    >
                      <Plus size={14} /> Adicionar Descrição
                    </button>
                  </div>

                  {(selectedRecord.descriptions || [selectedRecord.description || '']).map((desc, index) => (
                    <div key={index} className="relative">
                      <textarea 
                        required
                        rows={2}
                        className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={desc}
                        onChange={(e) => {
                          const newDescriptions = [...(selectedRecord.descriptions || [selectedRecord.description || ''])];
                          newDescriptions[index] = e.target.value;
                          setSelectedRecord({...selectedRecord, descriptions: newDescriptions});
                        }}
                      />
                      {(selectedRecord.descriptions?.length || 1) > 1 && (
                        <button 
                          type="button"
                          onClick={() => {
                            const newDescriptions = (selectedRecord.descriptions || [selectedRecord.description || '']).filter((_, i) => i !== index);
                            setSelectedRecord({...selectedRecord, descriptions: newDescriptions});
                          }}
                          className="absolute top-2 right-2 p-1 text-neutral-400 hover:text-red-600 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200 flex items-center justify-center gap-2">
                    <CheckCircle2 size={20} />
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isProviderModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900 italic serif">Novo Prestador</h3>
                <button onClick={() => setIsProviderModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleCreateProvider} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Nome Completo / Empresa</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={newProvider.name}
                    onChange={(e) => setNewProvider({...newProvider, name: e.target.value.toUpperCase()})}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Tipo de Serviço</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Ex: Pedreiro, Eletricista, Pintor"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={newProvider.service_type}
                    onChange={(e) => setNewProvider({...newProvider, service_type: e.target.value.toUpperCase()})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Área Principal</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={newProvider.area}
                    onChange={(e) => setNewProvider({...newProvider, area: e.target.value as Area})}
                  >
                    {AREAS.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                {isAdmin && (
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Valor da Diária (R$)</label>
                    <input 
                      type="number" 
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={newProvider.daily_rate}
                      onChange={(e) => setNewProvider({...newProvider, daily_rate: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                )}

                <div className="pt-4">
                  <button type="submit" className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200">
                    Cadastrar Prestador
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isEditProviderModalOpen && editingProvider && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900 italic serif">Editar Prestador</h3>
                <button onClick={() => setIsEditProviderModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleUpdateProvider} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Nome Completo / Empresa</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={editingProvider.name}
                    onChange={(e) => setEditingProvider({...editingProvider, name: e.target.value.toUpperCase()})}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Tipo de Serviço</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Ex: Pedreiro, Eletricista, Pintor"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={editingProvider.service_type}
                    onChange={(e) => setEditingProvider({...editingProvider, service_type: e.target.value.toUpperCase()})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Área Principal</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={editingProvider.area}
                    onChange={(e) => setEditingProvider({...editingProvider, area: e.target.value as Area})}
                  >
                    {AREAS.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                {isAdmin && (
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Valor da Diária (R$)</label>
                    <input 
                      type="number" 
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={editingProvider.daily_rate || 0}
                      onChange={(e) => setEditingProvider({...editingProvider, daily_rate: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <input 
                    type="checkbox" 
                    id="active-provider"
                    className="w-5 h-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                    checked={editingProvider.active !== false}
                    onChange={(e) => setEditingProvider({...editingProvider, active: e.target.checked})}
                  />
                  <label htmlFor="active-provider" className="text-sm font-bold text-neutral-700">
                    Prestador Ativo
                  </label>
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
      </AnimatePresence>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  ShoppingCart, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Truck,
  X,
  User,
  Calendar,
  Lock,
  MapPin,
  FileText,
  Building2,
  Home,
  Info,
  PackageCheck,
  AlertTriangle,
  Package,
  FileSpreadsheet,
  Link,
  Pencil
} from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { Material, Order, Profile, Supplier, Project } from '../types';
import { cn } from '../lib/utils';
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SearchableMaterialSelect from './SearchableMaterialSelect';


export default function Orders() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'DEV';
  const [orders, setOrders] = useState<Order[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
  const [cancelJustification, setCancelJustification] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [editOrderData, setEditOrderData] = useState({
    id: '',
    material_id: '',
    quantity: 0,
    project: '',
    edit_justification: ''
  });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkPurchaseOrder, setBulkPurchaseOrder] = useState('');
  const [bulkInvoiceNumber, setBulkInvoiceNumber] = useState('');
  const [bulkOrderValue, setBulkOrderValue] = useState('');
  const [bulkDocumentType, setBulkDocumentType] = useState('PEDIDO');
  const [bulkDocumentNumber, setBulkDocumentNumber] = useState('');
  const [bulkPaymentMethod, setBulkPaymentMethod] = useState('');

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [purchaseOrderFilter, setPurchaseOrderFilter] = useState('');
  const [invoiceNumberFilter, setInvoiceNumberFilter] = useState('');

  const [newOrder, setNewOrder] = useState({
    items: [{ material_id: '', quantity: 0 }],
    requested_by: profile?.full_name || profile?.email || '',
    requested_by_id: profile?.id || '',
    use_date: '',
    service_description: '',
    project: '',
    apartment: '',
    observation: '',
    for_stock: false,
    purchase_order: '',
    invoice_number: '',
    order_value: '',
  });

  const [purchaseData, setPurchaseData] = useState({
    quantity: 0,
    quantity_justification: '',
    delivery_type: 'DELIVERY' as 'DELIVERY' | 'PICKUP',
    pickup_info: '',
    supplier: '',
    expected_delivery: '',
    pickup_employee_id: '',
    purchase_order: '',
    invoice_number: '',
    order_value: '',
    document_type: 'PEDIDO',
    document_number: '',
    payment_method: '',
  });

  const [receiveData, setReceiveData] = useState({
    received_by: profile?.name || profile?.email || '',
    purchase_order: '',
    invoice_number: '',
    order_value: '',
    document_type: 'PEDIDO',
    document_number: '',
    payment_method: '',
  });

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
      let ordersQuery = supabase.from('orders').select('*, material:materials(*)').order('created_at', { ascending: false });
      
      if (!isAdmin && profile) {
        ordersQuery = ordersQuery.eq('requested_by_id', profile.id);
      }

      const [ordersRes, materialsRes, profilesRes, suppliersRes, projectsRes] = await Promise.all([
        ordersQuery,
        supabase.from('materials').select('*').order('name', { ascending: true }),
        supabase.from('profiles').select('*').order('full_name', { ascending: true }),
        supabase.from('suppliers').select('*').order('name', { ascending: true }),
        supabase.from('projects').select('*').order('name', { ascending: true })
      ]);

      if (ordersRes.error) {
        console.error('Error fetching orders:', ordersRes.error);
        toast.error('Erro ao buscar pedidos: ' + ordersRes.error.message);
      } else {
        setOrders(ordersRes.data || []);
      }

      if (materialsRes.error) {
        console.error('Error fetching materials:', materialsRes.error);
        toast.error('Erro ao buscar materiais: ' + materialsRes.error.message);
      } else {
        setMaterials(materialsRes.data || []);
      }

      if (profilesRes.error) {
        console.error('Error fetching profiles:', profilesRes.error);
      } else {
        setEmployees(profilesRes.data || []);
      }

      if (suppliersRes.error) {
        console.error('Error fetching suppliers:', suppliersRes.error);
        toast.error('Erro ao buscar fornecedores.');
      } else {
        setSuppliers(suppliersRes.data || []);
      }

      if (projectsRes.error) {
        console.error('Error fetching projects:', projectsRes.error);
        toast.error('Erro ao buscar empreendimentos.');
      } else {
        setProjects(projectsRes.data || []);
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

  useEffect(() => {
    if (profile) {
      setNewOrder(prev => ({ 
        ...prev, 
        requested_by: profile.full_name || profile.email || '',
        requested_by_id: profile.id === 'mock-id' ? '' : profile.id
      }));
      setReceiveData(prev => ({ ...prev, received_by: profile.full_name || profile.email || '' }));
    }
  }, [profile]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validItems = newOrder.items.filter(item => item.material_id && item.quantity > 0);
    
    if (validItems.length === 0) {
      toast.error('Adicione pelo menos um material com quantidade válida.');
      return;
    }

    try {
      console.log('Inserting orders:', validItems.map(item => ({
        material_id: item.material_id,
        quantity: item.quantity,
        requested_by: newOrder.requested_by,
        requested_by_id: (newOrder.requested_by_id === 'mock-id' || newOrder.requested_by_id === '') ? null : newOrder.requested_by_id,
        use_date: newOrder.use_date,
        service_description: newOrder.service_description,
        project: newOrder.for_stock ? null : newOrder.project,
        apartment: newOrder.for_stock ? null : newOrder.apartment,
        observation: newOrder.observation,
        for_stock: newOrder.for_stock,
        purchase_order: isAdmin ? (newOrder.purchase_order || null) : null,
        invoice_number: isAdmin ? (newOrder.invoice_number || null) : null,
        status: 'PENDING'
      })));
      const ordersToInsert = validItems.map(item => ({
        material_id: item.material_id,
        quantity: item.quantity,
        requested_by: newOrder.requested_by,
        requested_by_id: (newOrder.requested_by_id === 'mock-id' || newOrder.requested_by_id === '') ? null : newOrder.requested_by_id,
        use_date: newOrder.use_date,
        service_description: newOrder.service_description,
        project: newOrder.for_stock ? null : newOrder.project,
        apartment: newOrder.for_stock ? null : newOrder.apartment,
        observation: newOrder.observation,
        for_stock: newOrder.for_stock,
        purchase_order: isAdmin ? (newOrder.purchase_order || null) : null,
        invoice_number: isAdmin ? (newOrder.invoice_number || null) : null,
        status: 'PENDING'
      }));

      const { error } = await getSupabase()
        .from('orders')
        .insert(ordersToInsert);

      if (error) {
        toast.error('Erro ao realizar pedido: ' + error.message);
      } else {
        toast.success(`${validItems.length} pedido(s) realizado(s) com sucesso!`);
        setIsModalOpen(false);
        fetchData();
        setNewOrder({
          items: [{ material_id: '', quantity: 0 }],
          requested_by: profile?.full_name || profile?.email || '',
          requested_by_id: profile?.id || '',
          use_date: '',
          service_description: '',
          project: '',
          apartment: '',
          observation: '',
          for_stock: false,
          purchase_order: '',
          invoice_number: '',
        });
      }
    } catch (err) {
      toast.error('Erro de configuração: ' + (err as Error).message);
    }
  };

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const quantityChanged = purchaseData.quantity !== selectedOrder.quantity;
    if (quantityChanged && !purchaseData.quantity_justification) {
      toast.error('Justificativa obrigatória para alteração de quantidade.');
      return;
    }

    try {
      const employee = employees.find(e => e.id === purchaseData.pickup_employee_id);

      const docType = purchaseData.document_type || 'PEDIDO';
      const docNum = purchaseData.document_number ? purchaseData.document_number.toUpperCase().trim() : '';

      const updateData: any = {
        status: purchaseData.delivery_type === 'PICKUP' ? 'AWAITING_PICKUP' : 'APPROVED',
        quantity: purchaseData.quantity,
        original_quantity: selectedOrder.quantity,
        quantity_justification: purchaseData.quantity_justification,
        delivery_type: purchaseData.delivery_type,
        pickup_info: purchaseData.delivery_type === 'PICKUP' ? purchaseData.pickup_info : null,
        pickup_by_id: purchaseData.delivery_type === 'PICKUP' ? purchaseData.pickup_employee_id : null,
        pickup_by_name: purchaseData.delivery_type === 'PICKUP' ? employee?.full_name || null : null,
        supplier: purchaseData.supplier || null,
        expected_delivery: purchaseData.expected_delivery || null,
        order_value: purchaseData.order_value ? parseFloat(purchaseData.order_value) : (selectedOrder.order_value || null),
        document_type: docType,
        document_number: docNum || selectedOrder.document_number || null,
        payment_method: purchaseData.payment_method || selectedOrder.payment_method || null,
      };

      if (docNum) {
        if (docType === 'PEDIDO') {
          updateData.purchase_order = docNum;
        } else {
          updateData.invoice_number = docNum;
        }
      } else {
        updateData.purchase_order = selectedOrder.purchase_order || null;
        updateData.invoice_number = selectedOrder.invoice_number || null;
      }

      const { error } = await getSupabase()
        .from('orders')
        .update(updateData)
        .eq('id', selectedOrder.id);

      if (error) {
        toast.error('Erro ao processar compra: ' + error.message);
      } else {
        toast.success('Compra processada com sucesso!');
        setIsPurchaseModalOpen(false);
        fetchData();

        if (purchaseData.delivery_type === 'PICKUP' && employee) {
          if (employee.phone) {
            let phoneStr = employee.phone.replace(/\D/g, '');
            if (phoneStr) {
              if (!phoneStr.startsWith('55') && phoneStr.length <= 11) {
                phoneStr = '55' + phoneStr;
              }
              const dataRetiradaText = purchaseData.expected_delivery ? `\nData de retirada: ${safeFormatDate(purchaseData.expected_delivery, 'dd/MM/yyyy')}` : '';
              const message = `Olá, *${employee.full_name || 'Equipe'}*,\n\nUma nova retirada de material foi agendada. Seguem os detalhes:\n\nMaterial: ${purchaseData.quantity} ${selectedOrder.material?.unit} de ${selectedOrder.material?.name}\nLocal de retirada: ${purchaseData.pickup_info}${dataRetiradaText}\nLocal de entrega: Obra ${selectedOrder.project}\nSolicitante: ${selectedOrder.requested_by}`;
              const whatsappUrl = `https://wa.me/${phoneStr}?text=${encodeURIComponent(message)}`;
              window.open(whatsappUrl, '_blank');
            } else {
              toast.warning('Funcionário não possui um número de telefone válido para WhatsApp.');
            }
          } else {
            toast.warning('Funcionário não possui telefone cadastrado.');
          }
        }
      }
    } catch (err) {
      toast.error('Erro de configuração: ' + (err as Error).message);
    }
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      const supabase = getSupabase();

      // 1. Update status
      // O gatilho no banco de dados (trg_handle_order_stock_update) cuidará 
      // da atualização do estoque e log de movimentação apenas quando o status for RECEIVED.
      const updatePayload: any = {
        status: 'RECEIVED',
        received_by: receiveData.received_by
      };

      if (isAdmin) {
        const docType = receiveData.document_type || 'PEDIDO';
        const docNum = receiveData.document_number ? receiveData.document_number.toUpperCase().trim() : '';

        updatePayload.order_value = receiveData.order_value ? parseFloat(receiveData.order_value) : (selectedOrder.order_value || null);
        updatePayload.document_type = docType;
        updatePayload.document_number = docNum || selectedOrder.document_number || null;
        updatePayload.payment_method = receiveData.payment_method || selectedOrder.payment_method || null;

        if (docNum) {
          if (docType === 'PEDIDO') {
            updatePayload.purchase_order = docNum;
          } else {
            updatePayload.invoice_number = docNum;
          }
        } else {
          updatePayload.purchase_order = selectedOrder.purchase_order || null;
          updatePayload.invoice_number = selectedOrder.invoice_number || null;
        }
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', selectedOrder.id);

      if (updateError) throw updateError;

      toast.success('Recebimento confirmado e estoque atualizado!');
      setIsReceiveModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error('Erro ao confirmar recebimento: ' + (err as Error).message);
    }
  };

  const cancelOrder = async () => {
    if (!orderToCancel || !isAdmin) return;
    if (!cancelJustification.trim()) {
      toast.error('Informe o motivo do cancelamento.');
      return;
    }

    try {
      const { error } = await getSupabase()
        .from('orders')
        .update({ status: 'CANCELLED', cancel_justification: cancelJustification.trim().toUpperCase() })
        .eq('id', orderToCancel);

      if (error) {
        toast.error('Erro ao cancelar pedido: ' + error.message);
      } else {
        toast.success('Pedido cancelado com sucesso!');
        setIsCancelModalOpen(false);
        setOrderToCancel(null);
        setCancelJustification('');
        fetchData();
      }
    } catch (err) {
      toast.error('Erro de configuração: ' + (err as Error).message);
    }
  };

  const handleEditOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editOrderData.id) return;
    if (!editOrderData.edit_justification.trim()) {
      toast.error('Informe a justificativa da edição.');
      return;
    }

    try {
      const updatePayload: Record<string, unknown> = {
        edit_justification: editOrderData.edit_justification.trim().toUpperCase(),
      };
      if (editOrderData.material_id) updatePayload.material_id = editOrderData.material_id;
      if (editOrderData.quantity > 0) updatePayload.quantity = editOrderData.quantity;
      if (editOrderData.project) updatePayload.project = editOrderData.project.toUpperCase();

      const { error } = await getSupabase()
        .from('orders')
        .update(updatePayload)
        .eq('id', editOrderData.id);

      if (error) throw error;
      toast.success('Pedido atualizado com sucesso!');
      setIsEditModalOpen(false);
      setEditOrderData({ id: '', material_id: '', quantity: 0, project: '', edit_justification: '' });
      fetchData();
    } catch (err) {
      toast.error('Erro ao editar pedido: ' + (err as Error).message);
    }
  };

  const toggleOrderSelect = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkUpdateOrders = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrderIds.length === 0) return;

    try {
      const updates: any = {};
      const docType = bulkDocumentType || 'PEDIDO';
      const docNum = bulkDocumentNumber ? bulkDocumentNumber.toUpperCase().trim() : '';

      if (docNum) {
        updates.document_type = docType;
        updates.document_number = docNum;
        if (docType === 'PEDIDO') {
          updates.purchase_order = docNum;
        } else {
          updates.invoice_number = docNum;
        }
      }

      if (bulkPaymentMethod) {
        updates.payment_method = bulkPaymentMethod;
      }

      if (bulkOrderValue) {
        updates.order_value = parseFloat(bulkOrderValue);
      }

      if (Object.keys(updates).length === 0) {
        toast.error('Preencha pelo menos um campo para vincular.');
        return;
      }

      const { error } = await getSupabase()
        .from('orders')
        .update(updates)
        .in('id', selectedOrderIds);

      if (error) {
        toast.error('Erro ao vincular pedidos em massa: ' + error.message);
      } else {
        toast.success(`Vinculados ${selectedOrderIds.length} pedidos com sucesso!`);
        setIsBulkModalOpen(false);
        setSelectedOrderIds([]);
        fetchData();
      }
    } catch (err) {
      toast.error('Erro ao vincular pedidos: ' + (err as Error).message);
    }
  };

  const exportToExcel = () => {
    try {
      const filteredOrders = orders.filter(order => {
        const orderDate = parseISO(order.created_at);
        const isWithinDate = isWithinInterval(orderDate, {
          start: parseISO(startDate),
          end: parseISO(endDate + 'T23:59:59')
        });
        const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
        const matchesProject = projectFilter === 'ALL' || order.project === projectFilter;
        
        const currentSupplier = order.delivery_type === 'PICKUP' ? order.pickup_info : order.supplier;
        const matchesSupplier = supplierFilter === 'ALL' || currentSupplier === supplierFilter;

        const matchesPurchaseOrder = !purchaseOrderFilter || 
          order.purchase_order?.toLowerCase().includes(purchaseOrderFilter.toLowerCase());
        const matchesInvoiceNumber = !invoiceNumberFilter || 
          order.invoice_number?.toLowerCase().includes(invoiceNumberFilter.toLowerCase());

        return isWithinDate && matchesStatus && matchesProject && matchesSupplier && matchesPurchaseOrder && matchesInvoiceNumber;
      });

      if (filteredOrders.length === 0) {
        toast.error('Nenhum pedido encontrado com os filtros selecionados.');
        return;
      }

      const wb = XLSX.utils.book_new();
      const wsData = filteredOrders.map(o => ({
        'Data Solicitação': safeFormatDate(o.created_at, "dd/MM/yyyy HH:mm"),
        'Material': o.material?.name || '---',
        'Quantidade': o.quantity,
        'Unidade': o.material?.unit || '---',
        'Fornecedor / Local Retirada': o.delivery_type === 'PICKUP' ? (o.supplier || o.pickup_info || '---') : (o.supplier || '---'),
        'Status': o.status === 'PENDING' ? 'Pendente' :
                  o.status === 'APPROVED' ? 'Comprado' :
                  o.status === 'AWAITING_PICKUP' ? 'Aguardando Retirada' :
                  o.status === 'PICKED_UP' ? 'Em Trânsito' :
                  o.status === 'DELIVERED' ? 'Entregue' :
                  o.status === 'RECEIVED' ? 'Recebido' : 'Cancelado',
        'Solicitante': o.requested_by,
        'Empreendimento': o.project || 'Estoque',
        'Apartamento': o.apartment || '---',
        'Descrição': o.service_description || '---',
        'Observações': o.observation || '---',
        'Pedido de Compra': o.purchase_order || '---',
        'Nota Fiscal (NF)': o.invoice_number || '---',
        'Previsão Entrega': safeFormatDate(o.expected_delivery, 'dd/MM/yyyy'),
        'Recebido Por': o.received_by || '---'
      }));

      const ws = XLSX.utils.json_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
      XLSX.writeFile(wb, `Relatorio_Pedidos_${startDate}_a_${endDate}.xlsx`);
      toast.success('Relatório de pedidos exportado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      toast.error('Erro ao exportar relatório.');
    }
  };

  const exportToPDF = () => {
    try {
      const filteredOrders = orders.filter(order => {
        const orderDate = parseISO(order.created_at);
        const isWithinDate = isWithinInterval(orderDate, {
          start: parseISO(startDate),
          end: parseISO(endDate + 'T23:59:59')
        });
        const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
        const matchesProject = projectFilter === 'ALL' || order.project === projectFilter;
        
        const currentSupplier = order.delivery_type === 'PICKUP' ? order.pickup_info : order.supplier;
        const matchesSupplier = supplierFilter === 'ALL' || currentSupplier === supplierFilter;

        const matchesPurchaseOrder = !purchaseOrderFilter || 
          order.purchase_order?.toLowerCase().includes(purchaseOrderFilter.toLowerCase());
        const matchesInvoiceNumber = !invoiceNumberFilter || 
          order.invoice_number?.toLowerCase().includes(invoiceNumberFilter.toLowerCase());

        return isWithinDate && matchesStatus && matchesProject && matchesSupplier && matchesPurchaseOrder && matchesInvoiceNumber;
      });

      if (filteredOrders.length === 0) {
        toast.error('Nenhum pedido encontrado com os filtros selecionados.');
        return;
      }

      const doc = new jsPDF('l', 'mm', 'a4');
      
      // Título
      doc.setFontSize(22);
      doc.setTextColor(20, 20, 20);
      doc.text("Relatório Executivo de Pedidos", 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
      doc.text(`Período: ${format(parseISO(startDate), 'dd/MM/yyyy')} até ${format(parseISO(endDate), 'dd/MM/yyyy')}`, 14, 35);

      const tableBody = filteredOrders.map(o => [
        safeFormatDate(o.created_at, 'dd/MM/yy'),
        o.material?.name || '---',
        `${o.quantity} ${o.material?.unit || ''}`,
        o.delivery_type === 'PICKUP' ? (o.supplier || o.pickup_info || '---') : (o.supplier || '---'),
        o.purchase_order || '---',
        o.invoice_number || '---',
        o.status === 'PENDING' ? 'Pendente' :
        o.status === 'APPROVED' ? 'Comprado' :
        o.status === 'AWAITING_PICKUP' ? 'Aguardando Retirada' :
        o.status === 'PICKED_UP' ? 'Em Trânsito' :
        o.status === 'DELIVERED' ? 'Entregue' :
        o.status === 'RECEIVED' ? 'Recebido' : 'Cancelado',
        o.project || 'Estoque',
        o.service_description || '---',
        o.requested_by
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['Data', 'Material', 'Qtd', 'Fornecedor', 'Pedido', 'NF', 'Status', 'Obra', 'Descrição/Justificativa', 'Solicitante']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [20, 20, 20], fontSize: 9, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          3: { cellWidth: 30 }, // Fornecedor
          4: { cellWidth: 20 }, // Pedido
          5: { cellWidth: 20 }, // NF
          8: { cellWidth: 45 }, // Descrição
        },
        alternateRowStyles: { fillColor: [245, 245, 245] }
      });

      doc.save(`Relatorio_Executivo_Pedidos_${startDate}_a_${endDate}.pdf`);
      toast.success('Relatório executivo PDF gerado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      toast.error('Erro ao gerar PDF.');
    }
  };

  const uniquePurchaseOrders = Array.from(new Set(orders.map(o => o.purchase_order).filter(Boolean))).sort();
  const uniqueInvoiceNumbers = Array.from(new Set(orders.map(o => o.invoice_number).filter(Boolean))).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 italic serif">Pedidos de Compra</h2>
          <p className="text-sm text-neutral-500">Solicitação e acompanhamento de novos materiais</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <button 
                onClick={exportToExcel}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-neutral-200 text-neutral-900 rounded-2xl font-bold hover:bg-neutral-50 transition-all shadow-sm"
                title="Excel Simples"
              >
                <FileSpreadsheet size={20} />
                Excel
              </button>
              <button 
                onClick={exportToPDF}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-100 text-neutral-900 border border-neutral-200 rounded-2xl font-bold hover:bg-neutral-200 transition-all shadow-sm"
                title="PDF Executivo"
              >
                <FileText size={20} />
                PDF Executivo
              </button>
            </>
          )}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="hidden md:flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200"
          >
            <Plus size={20} />
            Novo Pedido
          </button>
        </div>
      </div>

      {/* Date Filters */}
      <div className="bg-white p-4 rounded-3xl border border-neutral-200 shadow-sm flex flex-col md:flex-row items-end gap-4">
        <div className="flex-1 w-full">
          <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 ml-1">Início do Período</label>
          <input 
            type="date" 
            className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 ml-1">Fim do Período</label>
          <input 
            type="date" 
            className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 ml-1">Obra</label>
          <select 
            className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="ALL">Todas</option>
            {Array.from(new Set(orders.map(o => o.project).filter(Boolean))).sort().map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 w-full">
          <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 ml-1">Fornecedor</label>
          <select 
            className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <option value="ALL">Todos</option>
            {Array.from(new Set(orders.map(o => o.delivery_type === 'PICKUP' ? o.pickup_info : o.supplier).filter(Boolean))).sort().map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <>
            <div className="flex-1 w-full hidden md:block">
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 ml-1">Filtro Pedido</label>
              <select 
                className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm"
                value={purchaseOrderFilter}
                onChange={(e) => setPurchaseOrderFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {uniquePurchaseOrders.map(po => (
                  <option key={po} value={po}>{po}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 w-full hidden md:block">
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 ml-1">Filtro Nota (NF)</label>
              <select 
                className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm"
                value={invoiceNumberFilter}
                onChange={(e) => setInvoiceNumberFilter(e.target.value)}
              >
                <option value="">Todas</option>
                {uniqueInvoiceNumbers.map(inf => (
                  <option key={inf} value={inf}>{inf}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Mobile Floating Action Button */}
      <button 
        onClick={() => setIsModalOpen(true)}
        className="md:hidden fixed bottom-20 right-6 z-40 w-14 h-14 bg-neutral-900 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all"
      >
        <Plus size={28} />
      </button>

      {/* Filters */}
      <div className="flex overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap gap-2 no-scrollbar">
        {[
          { id: 'ALL', label: 'Todos', icon: ShoppingCart },
          { id: 'PENDING', label: 'Pendentes', icon: Clock },
          { id: 'APPROVED', label: 'Comprados', icon: Truck },
          { id: 'PICKED_UP', label: 'Em Trânsito', icon: Truck },
          { id: 'DELIVERED', label: 'Entregues', icon: PackageCheck },
          { id: 'RECEIVED', label: 'Recebidos', icon: CheckCircle2 },
          { id: 'CANCELLED', label: 'Cancelados', icon: XCircle },
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => setStatusFilter(filter.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap",
              statusFilter === filter.id
                ? "bg-neutral-900 text-white border-neutral-900 shadow-md"
                : "bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50"
            )}
          >
            <filter.icon size={14} />
            {filter.label}
          </button>
        ))}
      </div>

      {/* Order List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
          </div>
        ) : (
          <>
            {orders
              .filter(order => {
                const orderDate = parseISO(order.created_at);
                const isWithinDate = isWithinInterval(orderDate, {
                  start: parseISO(startDate),
                  end: parseISO(endDate + 'T23:59:59')
                });
                const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
                const matchesProject = projectFilter === 'ALL' || order.project === projectFilter;
                
                const currentSupplier = order.delivery_type === 'PICKUP' ? order.pickup_info : order.supplier;
                const matchesSupplier = supplierFilter === 'ALL' || currentSupplier === supplierFilter;

                const matchesPurchaseOrder = !purchaseOrderFilter || 
                  order.purchase_order?.toLowerCase().includes(purchaseOrderFilter.toLowerCase());
                const matchesInvoiceNumber = !invoiceNumberFilter || 
                  order.invoice_number?.toLowerCase().includes(invoiceNumberFilter.toLowerCase());

                return isWithinDate && matchesStatus && matchesProject && matchesSupplier && matchesPurchaseOrder && matchesInvoiceNumber;
              })
              .map((order) => (
              <OrderCard 
                key={order.id} 
                order={order} 
                safeFormatDate={safeFormatDate}
                onCancel={() => {
                  setOrderToCancel(order.id);
                  setCancelJustification('');
                  setIsCancelModalOpen(true);
                }}
                onEdit={() => {
                  setEditOrderData({
                    id: order.id,
                    material_id: order.material_id || '',
                    quantity: order.quantity,
                    project: order.project || '',
                    edit_justification: ''
                  });
                  setIsEditModalOpen(true);
                }}
                onPurchase={() => {
                  setSelectedOrder(order);
                  const existingDocType = order.document_type || (order.purchase_order ? 'PEDIDO' : order.invoice_number ? 'NOTA_FISCAL' : 'PEDIDO');
                  const existingDocNumber = order.document_number || order.purchase_order || order.invoice_number || '';
                  
                  setPurchaseData({
                    quantity: order.quantity,
                    quantity_justification: '',
                    delivery_type: 'DELIVERY',
                    pickup_info: '',
                    supplier: '',
                    expected_delivery: '',
                    pickup_employee_id: '',
                    purchase_order: order.purchase_order || '',
                    invoice_number: order.invoice_number || '',
                    order_value: order.order_value ? String(order.order_value) : '',
                    document_type: existingDocType,
                    document_number: existingDocNumber,
                    payment_method: order.payment_method || '',
                  });
                  setIsPurchaseModalOpen(true);
                }}
                onReceive={() => {
                  setSelectedOrder(order);
                  const existingDocType = order.document_type || (order.purchase_order ? 'PEDIDO' : order.invoice_number ? 'NOTA_FISCAL' : 'PEDIDO');
                  const existingDocNumber = order.document_number || order.purchase_order || order.invoice_number || '';

                  setReceiveData({
                    received_by: profile?.full_name || profile?.email || '',
                    purchase_order: order.purchase_order || '',
                    invoice_number: order.invoice_number || '',
                    order_value: order.order_value ? String(order.order_value) : '',
                    document_type: existingDocType,
                    document_number: existingDocNumber,
                    payment_method: order.payment_method || '',
                  });
                  setIsReceiveModalOpen(true);
                }}
                onViewDetails={() => {
                  setSelectedOrder(order);
                  setIsDetailsModalOpen(true);
                }}
                isAdmin={isAdmin} 
                selected={selectedOrderIds.includes(order.id)}
                onToggleSelect={() => toggleOrderSelect(order.id)}
              />
            ))}
            {orders.length === 0 && (
              <div className="p-12 text-center text-neutral-500 bg-white rounded-3xl border border-dashed border-neutral-200">
                Nenhum pedido realizado ainda.
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center md:p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full h-full md:h-auto md:max-w-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-neutral-900 italic serif">Novo Pedido</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest">Materiais Solicitados</label>
                    <button 
                      type="button"
                      onClick={() => setNewOrder({
                        ...newOrder, 
                        items: [...newOrder.items, { material_id: '', quantity: 0 }]
                      })}
                      className="text-xs font-bold text-neutral-900 flex items-center gap-1 hover:underline"
                    >
                      <Plus size={14} /> Adicionar Material
                    </button>
                  </div>
                  
                  {newOrder.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                      <div className="md:col-span-7">
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Material</label>
                        <SearchableMaterialSelect
                          required
                          materials={materials}
                          value={item.material_id}
                          onChange={(id) => {
                            const newItems = [...newOrder.items];
                            newItems[index].material_id = id;
                            setNewOrder({...newOrder, items: newItems});
                          }}
                        />
                      </div>
                      <div className="md:col-span-4">
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Quantidade</label>
                        <input 
                          required
                          type="number" 
                          step="0.01"
                          className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                          value={item.quantity || ''}
                          onChange={(e) => {
                            const newItems = [...newOrder.items];
                            newItems[index].quantity = parseFloat(e.target.value);
                            setNewOrder({...newOrder, items: newItems});
                          }}
                        />
                      </div>
                      <div className="md:col-span-1 flex justify-end">
                        {newOrder.items.length > 1 && (
                          <button 
                            type="button"
                            onClick={() => {
                              const newItems = newOrder.items.filter((_, i) => i !== index);
                              setNewOrder({...newOrder, items: newItems});
                            }}
                            className="p-2 text-neutral-400 hover:text-red-600 transition-colors"
                          >
                            <X size={20} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Previsão de Uso</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={newOrder.use_date}
                      onChange={(e) => setNewOrder({...newOrder, use_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Solicitado Por</label>
                    {isAdmin ? (
                      <select
                        required
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={newOrder.requested_by_id}
                        onChange={(e) => {
                          const selectedEmp = employees.find(emp => emp.id === e.target.value);
                          setNewOrder({
                            ...newOrder, 
                            requested_by_id: e.target.value,
                            requested_by: selectedEmp ? (selectedEmp.full_name || selectedEmp.email) : newOrder.requested_by
                          });
                        }}
                      >
                        <option value="">Selecione um funcionário...</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.full_name || emp.email}</option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        readOnly
                        type="text" 
                        className="w-full px-4 py-3 bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-500 cursor-not-allowed"
                        value={newOrder.requested_by}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Descrição do Serviço</label>
                  <textarea 
                    required
                    rows={2}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={newOrder.service_description}
                    onChange={(e) => setNewOrder({...newOrder, service_description: e.target.value.toUpperCase()})}
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                      checked={newOrder.for_stock}
                      onChange={(e) => setNewOrder({...newOrder, for_stock: e.target.checked})}
                    />
                    <span className="text-xs font-bold text-neutral-900 uppercase tracking-widest">Pedido para Estoque</span>
                  </label>
                </div>

                {!newOrder.for_stock && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Empreendimento</label>
                      <select 
                        required
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 uppercase"
                        value={newOrder.project}
                        onChange={(e) => setNewOrder({...newOrder, project: e.target.value})}
                      >
                        <option value="">Selecione um empreendimento...</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Apartamento / Local</label>
                      <input 
                        required
                        type="text" 
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={newOrder.apartment}
                        onChange={(e) => setNewOrder({...newOrder, apartment: e.target.value.toUpperCase()})}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Observações (Marca, Modelo, Cor...)</label>
                  <textarea 
                    rows={2}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={newOrder.observation}
                    onChange={(e) => setNewOrder({...newOrder, observation: e.target.value.toUpperCase()})}
                  />
                </div>

                {isAdmin && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Pedido de Compra (Opcional)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: OC 12345"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={newOrder.purchase_order}
                        onChange={(e) => setNewOrder({...newOrder, purchase_order: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Nota Fiscal - NF (Opcional)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: NF 98765"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={newOrder.invoice_number}
                        onChange={(e) => setNewOrder({...newOrder, invoice_number: e.target.value.toUpperCase()})}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 shrink-0 pb-10 md:pb-0">
                  <button type="submit" className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200">
                    Realizar Pedido
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Purchase Modal */}
      <AnimatePresence>
        {isPurchaseModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900 italic serif">Processar Compra</h3>
                <button onClick={() => setIsPurchaseModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handlePurchase} className="p-6 space-y-4">
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-4">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-1">Pedido Original</p>
                  <p className="text-sm text-blue-900">{selectedOrder.material?.name}: {selectedOrder.quantity} {selectedOrder.material?.unit}</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Quantidade Final</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={purchaseData.quantity || ''}
                    onChange={(e) => setPurchaseData({...purchaseData, quantity: parseFloat(e.target.value)})}
                  />
                </div>

                {purchaseData.quantity !== selectedOrder.quantity && (
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Justificativa da Alteração</label>
                    <textarea 
                      required
                      rows={2}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={purchaseData.quantity_justification}
                      onChange={(e) => setPurchaseData({...purchaseData, quantity_justification: e.target.value.toUpperCase()})}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Tipo de Retirada/Entrega</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => setPurchaseData({...purchaseData, delivery_type: 'DELIVERY'})}
                      className={cn(
                        "py-3 rounded-xl font-bold text-sm transition-all border",
                        purchaseData.delivery_type === 'DELIVERY' 
                          ? "bg-neutral-900 text-white border-neutral-900" 
                          : "bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50"
                      )}
                    >
                      Entrega
                    </button>
                    <button 
                      type="button"
                      onClick={() => setPurchaseData({...purchaseData, delivery_type: 'PICKUP'})}
                      className={cn(
                        "py-3 rounded-xl font-bold text-sm transition-all border",
                        purchaseData.delivery_type === 'PICKUP' 
                          ? "bg-neutral-900 text-white border-neutral-900" 
                          : "bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50"
                      )}
                    >
                      Retirada
                    </button>
                  </div>
                </div>

                {purchaseData.delivery_type === 'DELIVERY' ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Fornecedora</label>
                      <select 
                        required
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 uppercase"
                        value={purchaseData.supplier}
                        onChange={(e) => setPurchaseData({...purchaseData, supplier: e.target.value})}
                      >
                        <option value="">Selecione um fornecedor...</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Previsão de Entrega</label>
                      <input 
                        required
                        type="date" 
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={purchaseData.expected_delivery}
                        onChange={(e) => setPurchaseData({...purchaseData, expected_delivery: e.target.value.toUpperCase()})}
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Fornecedor</label>
                      <select 
                        required
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 uppercase"
                        value={purchaseData.supplier}
                        onChange={(e) => {
                          const val = e.target.value;
                          const sup = suppliers.find(s => s.name === val);
                          setPurchaseData(prev => ({
                            ...prev, 
                            supplier: val,
                            pickup_info: sup?.address && !prev.pickup_info ? sup.address.toUpperCase() : prev.pickup_info
                          }));
                        }}
                      >
                        <option value="">Selecione um fornecedor...</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Data de Retirada (Opcional)</label>
                      <input 
                        type="date" 
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={purchaseData.expected_delivery}
                        onChange={(e) => setPurchaseData({...purchaseData, expected_delivery: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Endereço e Fornecedor (Opcional)</label>
                      <textarea 
                        rows={2}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={purchaseData.pickup_info}
                        onChange={(e) => setPurchaseData({...purchaseData, pickup_info: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Funcionário para Retirada</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={purchaseData.pickup_employee_id}
                        onChange={(e) => setPurchaseData({...purchaseData, pickup_employee_id: e.target.value})}
                      >
                        <option value="">Selecione um funcionário...</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.full_name || emp.email}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Tipo de Documento</label>
                    <select
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm"
                      value={purchaseData.document_type}
                      onChange={(e) => {
                        const newType = e.target.value;
                        let newNum = '';
                        if (selectedOrder) {
                          if (newType === 'PEDIDO') {
                            newNum = selectedOrder.purchase_order || '';
                          } else if (newType === 'NOTA_FISCAL') {
                            newNum = selectedOrder.invoice_number || '';
                          } else if (newType === selectedOrder.document_type) {
                            newNum = selectedOrder.document_number || '';
                          }
                        }
                        setPurchaseData({
                          ...purchaseData,
                          document_type: newType,
                          document_number: newNum
                        });
                      }}
                    >
                      <option value="PEDIDO">Pedido de Compra</option>
                      <option value="NOTA_FISCAL">Nota Fiscal (NF)</option>
                      <option value="REEMBOLSO">Reembolso</option>
                      <option value="RECIBO">Recibo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Número do Documento</label>
                    <input 
                      type="text" 
                      placeholder={
                        purchaseData.document_type === 'PEDIDO' ? 'Ex: OC 12345' :
                        purchaseData.document_type === 'NOTA_FISCAL' ? 'Ex: NF 98765' :
                        purchaseData.document_type === 'REEMBOLSO' ? 'Ex: REEMB 001' : 'Ex: REC 001'
                      }
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={purchaseData.document_number}
                      onChange={(e) => setPurchaseData({...purchaseData, document_number: e.target.value.toUpperCase()})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Forma de Pagamento</label>
                    <select
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm"
                      value={purchaseData.payment_method}
                      onChange={(e) => setPurchaseData({...purchaseData, payment_method: e.target.value})}
                    >
                      <option value="">Selecione...</option>
                      <option value="BOLETO">Boleto</option>
                      <option value="DEPOSITO">Depósito</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Valor do Pedido / Material</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      placeholder="Ex: 150.00"
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={purchaseData.order_value}
                      onChange={(e) => setPurchaseData({...purchaseData, order_value: e.target.value})}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200">
                    Confirmar Compra e Liberar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Receive Modal */}
      <AnimatePresence>
        {isReceiveModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900 italic serif">Confirmar Recebimento</h3>
                <button onClick={() => setIsReceiveModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleReceive} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Nome do Responsável que Recebeu</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={receiveData.received_by}
                    onChange={(e) => setReceiveData({...receiveData, received_by: e.target.value.toUpperCase()})}
                  />
                </div>

                {isAdmin && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Tipo de Documento</label>
                        <select
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm"
                          value={receiveData.document_type}
                          onChange={(e) => {
                            const newType = e.target.value;
                            let newNum = '';
                            if (selectedOrder) {
                              if (newType === 'PEDIDO') {
                                newNum = selectedOrder.purchase_order || '';
                              } else if (newType === 'NOTA_FISCAL') {
                                newNum = selectedOrder.invoice_number || '';
                              } else if (newType === selectedOrder.document_type) {
                                newNum = selectedOrder.document_number || '';
                              }
                            }
                            setReceiveData({
                              ...receiveData,
                              document_type: newType,
                              document_number: newNum
                            });
                          }}
                        >
                          <option value="PEDIDO">Pedido de Compra</option>
                          <option value="NOTA_FISCAL">Nota Fiscal (NF)</option>
                          <option value="REEMBOLSO">Reembolso</option>
                          <option value="RECIBO">Recibo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Número do Documento</label>
                        <input 
                          type="text" 
                          placeholder={
                            receiveData.document_type === 'PEDIDO' ? 'Ex: OC 12345' :
                            receiveData.document_type === 'NOTA_FISCAL' ? 'Ex: NF 98765' :
                            receiveData.document_type === 'REEMBOLSO' ? 'Ex: REEMB 001' : 'Ex: REC 001'
                          }
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                          value={receiveData.document_number}
                          onChange={(e) => setReceiveData({...receiveData, document_number: e.target.value.toUpperCase()})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Forma de Pagamento</label>
                        <select
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm"
                          value={receiveData.payment_method}
                          onChange={(e) => setReceiveData({...receiveData, payment_method: e.target.value})}
                        >
                          <option value="">Selecione...</option>
                          <option value="BOLETO">Boleto</option>
                          <option value="DEPOSITO">Depósito</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Valor do Pedido / Material</label>
                        <input 
                          type="number" 
                          step="0.01"
                          min="0"
                          placeholder="Ex: 150.00"
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                          value={receiveData.order_value}
                          onChange={(e) => setReceiveData({...receiveData, order_value: e.target.value})}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="pt-4">
                  <button type="submit" className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-100">
                    Confirmar Recebimento
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isCancelModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 italic serif">Cancelar Pedido</h3>
                  <p className="text-xs text-neutral-500">Esta ação não pode ser desfeita.</p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Motivo do Cancelamento <span className="text-red-500">*</span></label>
                  <textarea
                    rows={3}
                    placeholder="Descreva o motivo do cancelamento..."
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 uppercase resize-none"
                    value={cancelJustification}
                    onChange={(e) => setCancelJustification(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={cancelOrder}
                    disabled={!cancelJustification.trim()}
                    className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-100"
                  >
                    Confirmar Cancelamento
                  </button>
                  <button 
                    onClick={() => {
                      setIsCancelModalOpen(false);
                      setOrderToCancel(null);
                      setCancelJustification('');
                    }}
                    className="w-full py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-200 transition-all"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isEditModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                    <Pencil size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900 italic serif">Editar Pedido</h3>
                    <p className="text-xs text-neutral-500">Correção de dados — justificativa obrigatória</p>
                  </div>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={22} />
                </button>
              </div>
              <form onSubmit={handleEditOrder} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Material</label>
                  <select
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={editOrderData.material_id}
                    onChange={(e) => setEditOrderData({...editOrderData, material_id: e.target.value})}
                  >
                    <option value="">Manter material atual</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Empreendimento</label>
                    <select
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={editOrderData.project}
                      onChange={(e) => setEditOrderData({...editOrderData, project: e.target.value})}
                    >
                      <option value="">Manter atual</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Quantidade</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={editOrderData.quantity || ''}
                      onChange={(e) => setEditOrderData({...editOrderData, quantity: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Justificativa da Edição <span className="text-red-500">*</span></label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Descreva o motivo da correção..."
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 uppercase resize-none"
                    value={editOrderData.edit_justification}
                    onChange={(e) => setEditOrderData({...editOrderData, edit_justification: e.target.value.toUpperCase()})}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-3 bg-neutral-100 text-neutral-700 rounded-2xl font-bold hover:bg-neutral-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!editOrderData.edit_justification.trim()}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-100"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {isDetailsModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 md:p-8 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neutral-900 text-white rounded-xl flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-neutral-900 italic serif">Detalhes do Pedido</h2>
                    <p className="text-sm text-neutral-500">Informações completas da solicitação</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar space-y-8">
                {/* Status & Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest",
                        selectedOrder.status === 'PENDING' ? 'bg-neutral-200 text-neutral-700' :
                        selectedOrder.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                        selectedOrder.status === 'AWAITING_PICKUP' ? 'bg-purple-100 text-purple-700' :
                        selectedOrder.status === 'PICKED_UP' ? 'bg-blue-100 text-blue-700' :
                        selectedOrder.status === 'DELIVERED' ? 'bg-orange-100 text-orange-700' :
                        selectedOrder.status === 'RECEIVED' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      )}>
                        {selectedOrder.status === 'PENDING' ? 'Pendente' :
                         selectedOrder.status === 'APPROVED' ? 'Comprado' :
                         selectedOrder.status === 'AWAITING_PICKUP' ? 'Aguardando Retirada' :
                         selectedOrder.status === 'PICKED_UP' ? 'Em Trânsito (Retirado)' :
                         selectedOrder.status === 'DELIVERED' ? 'Entregue na Obra' :
                         selectedOrder.status === 'RECEIVED' ? 'Recebido' : 'Cancelado'}
                      </span>
                    </div>
                  </div>
                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">Data da Solicitação</p>
                    <p className="font-medium text-neutral-900 flex items-center gap-2">
                      <Calendar size={16} className="text-neutral-400" />
                      {safeFormatDate(selectedOrder.created_at, "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                  </div>
                </div>

                {/* Material Details */}
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Package size={16} /> Material Solicitado
                  </h3>
                  <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">Item</p>
                        <p className="font-bold text-neutral-900">{selectedOrder.material?.name || '---'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">Quantidade Solicitada</p>
                        <p className="font-bold text-neutral-900">{selectedOrder.original_quantity || selectedOrder.quantity} {selectedOrder.material?.unit}</p>
                      </div>
                    </div>
                    
                    {selectedOrder.original_quantity && selectedOrder.original_quantity !== selectedOrder.quantity && (
                      <div className="pt-4 border-t border-neutral-100 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-neutral-500 mb-1">Quantidade Aprovada</p>
                          <p className="font-bold text-blue-600">{selectedOrder.quantity} {selectedOrder.material?.unit}</p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-500 mb-1">Justificativa da Alteração</p>
                          <p className="text-sm text-neutral-700 italic">{selectedOrder.quantity_justification || '---'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Logistics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Building2 size={16} /> Destino
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">Empreendimento</p>
                        <p className="font-medium text-neutral-900">{selectedOrder.project}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">Torre/Apartamento</p>
                        <p className="font-medium text-neutral-900">{selectedOrder.apartment}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">Data de Uso Prevista</p>
                        <p className="font-medium text-neutral-900">{safeFormatDate(selectedOrder.use_date)}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Truck size={16} /> Logística
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">Tipo de Entrega</p>
                        <p className="font-medium text-neutral-900">
                          {selectedOrder.delivery_type === 'DELIVERY' ? 'Entrega na Obra' : 
                           selectedOrder.delivery_type === 'PICKUP' ? 'Retirada' : '---'}
                        </p>
                      </div>
                      {selectedOrder.delivery_type === 'DELIVERY' && (
                        <>
                          <div>
                            <p className="text-xs text-neutral-500 mb-1">Fornecedor</p>
                            <p className="font-medium text-neutral-900">{selectedOrder.supplier || '---'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-neutral-500 mb-1">Previsão de Entrega</p>
                            <p className="font-medium text-neutral-900">{safeFormatDate(selectedOrder.expected_delivery)}</p>
                          </div>
                        </>
                      )}
                      {selectedOrder.delivery_type === 'PICKUP' && (
                        <>
                          <div>
                            <p className="text-xs text-neutral-500 mb-1">Local de Retirada</p>
                            <p className="font-medium text-neutral-900">{selectedOrder.pickup_info || '---'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-neutral-500 mb-1">Responsável pela Retirada</p>
                            <p className="font-medium text-neutral-900">{selectedOrder.pickup_by_name || '---'}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Info size={16} /> Informações Adicionais
                  </h3>
                  <div className="space-y-4 bg-neutral-50 p-5 rounded-2xl border border-neutral-100">
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Solicitante</p>
                      <p className="font-medium text-neutral-900">{selectedOrder.requested_by}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Descrição do Serviço</p>
                      <p className="text-sm text-neutral-700">{selectedOrder.service_description}</p>
                    </div>
                    {selectedOrder.observation && (
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">Observações</p>
                        <p className="text-sm text-neutral-700 italic">{selectedOrder.observation}</p>
                      </div>
                    )}
                    {(selectedOrder.status === 'DELIVERED' || selectedOrder.status === 'RECEIVED') && selectedOrder.delivered_to_name && (
                      <div className="pt-4 border-t border-neutral-200">
                        <p className="text-xs text-neutral-500 mb-1">Entregue para</p>
                        <p className="font-medium text-orange-700 flex items-center gap-2">
                          <Truck size={16} /> {selectedOrder.delivered_to_name}
                        </p>
                      </div>
                    )}
                    {selectedOrder.status === 'RECEIVED' && (
                      <div className="pt-4 border-t border-neutral-200">
                        <p className="text-xs text-neutral-500 mb-1">Recebido por</p>
                        <p className="font-medium text-green-700 flex items-center gap-2">
                          <CheckCircle2 size={16} /> {selectedOrder.received_by}
                        </p>
                      </div>
                    )}
                    {isAdmin && (selectedOrder.purchase_order || selectedOrder.invoice_number || selectedOrder.order_value || selectedOrder.document_type || selectedOrder.payment_method) && (
                      <div className="pt-4 border-t border-neutral-200 grid grid-cols-2 gap-4">
                        {selectedOrder.document_type ? (
                          <div>
                            <p className="text-xs text-neutral-500 mb-1">
                              {selectedOrder.document_type === 'PEDIDO' ? 'Pedido de Compra' :
                               selectedOrder.document_type === 'NOTA_FISCAL' ? 'Nota Fiscal (NF)' :
                               selectedOrder.document_type === 'REEMBOLSO' ? 'Reembolso' : 'Recibo'}
                            </p>
                            <p className="font-bold text-neutral-900">{selectedOrder.document_number || 'Sem número'}</p>
                          </div>
                        ) : (
                          <>
                            {selectedOrder.purchase_order && (
                              <div>
                                <p className="text-xs text-neutral-500 mb-1">Pedido de Compra</p>
                                <p className="font-bold text-neutral-900">{selectedOrder.purchase_order}</p>
                              </div>
                            )}
                            {selectedOrder.invoice_number && (
                              <div>
                                <p className="text-xs text-neutral-500 mb-1">Nota Fiscal (NF)</p>
                                <p className="font-bold text-neutral-900">{selectedOrder.invoice_number}</p>
                              </div>
                            )}
                          </>
                        )}
                        {selectedOrder.payment_method && (
                          <div>
                            <p className="text-xs text-neutral-500 mb-1">Forma de Pagamento</p>
                            <span className="px-2.5 py-1 bg-neutral-100 text-neutral-800 text-[10px] font-black uppercase rounded-lg tracking-wider">
                              {selectedOrder.payment_method}
                            </span>
                          </div>
                        )}
                        {selectedOrder.order_value !== undefined && selectedOrder.order_value !== null && (
                          <div className="col-span-2 mt-2">
                            <p className="text-xs text-neutral-500 mb-1">Valor do Pedido / Material</p>
                            <p className="font-extrabold text-neutral-900 flex items-center gap-0.5">
                              R$ {Number(selectedOrder.order_value).toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8 border-t border-neutral-100 bg-neutral-50">
                <button 
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200"
                >
                  Fechar Detalhes
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Bulk Link Modal */}
        {isBulkModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 italic serif">Vincular em Massa</h3>
                  <p className="text-xs text-neutral-500">{selectedOrderIds.length} pedidos selecionados</p>
                </div>
                <button 
                  onClick={() => setIsBulkModalOpen(false)} 
                  className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleBulkUpdateOrders} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Tipo de Documento</label>
                    <select
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm"
                      value={bulkDocumentType}
                      onChange={(e) => setBulkDocumentType(e.target.value)}
                    >
                      <option value="PEDIDO">Pedido de Compra</option>
                      <option value="NOTA_FISCAL">Nota Fiscal (NF)</option>
                      <option value="REEMBOLSO">Reembolso</option>
                      <option value="RECIBO">Recibo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Número do Documento</label>
                    <input 
                      type="text" 
                      placeholder={
                        bulkDocumentType === 'PEDIDO' ? 'Ex: OC 12345' :
                        bulkDocumentType === 'NOTA_FISCAL' ? 'Ex: NF 98765' :
                        bulkDocumentType === 'REEMBOLSO' ? 'Ex: REEMB 001' : 'Ex: REC 001'
                      }
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={bulkDocumentNumber}
                      onChange={(e) => setBulkDocumentNumber(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Forma de Pagamento</label>
                    <select
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm"
                      value={bulkPaymentMethod}
                      onChange={(e) => setBulkPaymentMethod(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      <option value="BOLETO">Boleto</option>
                      <option value="DEPOSITO">Depósito</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Valor do Pedido / Material</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      placeholder="Ex: 150.00"
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      value={bulkOrderValue}
                      onChange={(e) => setBulkOrderValue(e.target.value)}
                    />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsBulkModalOpen(false)}
                    className="flex-1 py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={20} />
                    Confirmar Vínculo
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Floating Bottom Action Bar */}
        {selectedOrderIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[50] w-[calc(100%-2rem)] max-w-xl">
            <motion.div 
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              className="bg-black/95 backdrop-blur-md text-white px-6 py-4 rounded-[2rem] shadow-2xl flex items-center justify-between border border-neutral-800"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-neutral-800 flex items-center justify-center font-bold text-sm">
                  {selectedOrderIds.length}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Selecionados</p>
                  <p className="text-[10px] text-neutral-500">Pronto para vincular em massa</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSelectedOrderIds([])}
                  className="px-4 py-2 hover:bg-neutral-800 rounded-xl text-xs font-bold transition-all text-neutral-400 hover:text-white"
                >
                  Limpar
                </button>
                <button 
                  onClick={() => setIsBulkModalOpen(true)}
                  className="px-5 py-2.5 bg-white text-black hover:bg-neutral-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Link size={14} />
                  Vincular
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface OrderCardProps {
  order: Order;
  onCancel: () => void;
  onEdit: () => void;
  onPurchase: () => void;
  onReceive: () => void;
  onViewDetails: () => void;
  isAdmin: boolean;
  safeFormatDate: (dateStr: string | null | undefined) => string;
  selected?: boolean;
  onToggleSelect?: () => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ 
  order, 
  onCancel, 
  onEdit,
  onPurchase, 
  onReceive, 
  onViewDetails, 
  isAdmin, 
  safeFormatDate,
  selected,
  onToggleSelect
}) => {
  const statusConfig = {
    PENDING: { label: 'Pendente', color: 'bg-neutral-100 text-neutral-600', icon: Clock },
    APPROVED: { label: 'Comprado', color: 'bg-blue-100 text-blue-600', icon: Truck },
    AWAITING_PICKUP: { label: 'Aguardando Retirada', color: 'bg-purple-100 text-purple-600', icon: PackageCheck },
    PICKED_UP: { label: 'Em Trânsito', color: 'bg-blue-100 text-blue-600', icon: Truck },
    DELIVERED: { label: 'Entregue na Obra', color: 'bg-orange-100 text-orange-600', icon: Truck },
    RECEIVED: { label: 'Recebido', color: 'bg-green-100 text-green-600', icon: CheckCircle2 },
    CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-600', icon: XCircle },
  };

  const config = statusConfig[order.status] || statusConfig.PENDING;
  const StatusIcon = config.icon;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onViewDetails}
      className="bg-white p-4 md:p-6 rounded-3xl border border-neutral-200 shadow-sm flex flex-col gap-4 md:gap-6 cursor-pointer hover:border-neutral-300 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 md:gap-4">
          {isAdmin && onToggleSelect && (
            <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center mr-1">
              <input 
                type="checkbox"
                checked={selected || false}
                onChange={onToggleSelect}
                className="w-5 h-5 rounded-lg border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer"
              />
            </div>
          )}
          <div className={cn("p-3 md:p-4 rounded-2xl shrink-0", config.color)}>
            <StatusIcon size={24} className="md:w-8 md:h-8" />
          </div>
          <div className="min-w-0">
            <h4 className="text-base md:text-lg font-bold text-neutral-900 truncate">
              {order.material?.name || 'Material Removido'}
            </h4>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1">
              <span className={cn("px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-widest", config.color)}>
                {config.label}
              </span>
              <span className="text-[10px] md:text-xs text-neutral-500 flex items-center gap-1">
                <Calendar size={12} /> {safeFormatDate(order.created_at)}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {isAdmin && order.status !== 'CANCELLED' && order.status !== 'RECEIVED' && (
            <button 
              onClick={onEdit}
              title="Editar pedido"
              className="p-1.5 md:p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
            >
              <Pencil size={16} />
            </button>
          )}
          {isAdmin && order.status !== 'CANCELLED' && order.status !== 'RECEIVED' && (
            <button 
              onClick={onCancel}
              title="Cancelar pedido"
              className="p-1.5 md:p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
            >
              <XCircle size={16} />
            </button>
          )}
          {order.status === 'PENDING' && isAdmin && (
            <button 
              onClick={onPurchase}
              className="px-3 py-1.5 md:px-4 md:py-2 bg-neutral-900 text-white rounded-xl text-[10px] md:text-xs font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-100"
            >
              Comprar
            </button>
          )}
          {(order.status === 'APPROVED' || order.status === 'DELIVERED' || order.status === 'AWAITING_PICKUP' || order.status === 'PICKED_UP') && (
            <button 
              onClick={onReceive}
              className="px-3 py-1.5 md:px-4 md:py-2 bg-green-600 text-white rounded-xl text-[10px] md:text-xs font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-100"
            >
              {order.status === 'AWAITING_PICKUP' ? 'Retirar' : 'Receber'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="space-y-4">
          <div>
            <p className="text-[9px] md:text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Solicitação</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs md:text-sm">
                <User size={14} className="text-neutral-400" />
                <span className="text-neutral-500 hidden md:inline">Solicitante:</span>
                <span className="font-bold text-neutral-900 truncate">{order.requested_by}</span>
              </div>
              <div className="flex items-center gap-2 text-xs md:text-sm">
                <ShoppingCart size={14} className="text-neutral-400" />
                <span className="text-neutral-500 hidden md:inline">Quantidade:</span>
                <span className="font-bold text-neutral-900">{order.quantity} {order.material?.unit}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 hidden md:block">
          <div>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Local e Serviço</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Building2 size={14} className="text-neutral-400" />
                <span className="text-neutral-500">Obra:</span>
                <span className="font-bold text-neutral-900">{order.project}</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <FileText size={14} className="text-neutral-400 mt-1 shrink-0" />
                <span className="text-neutral-500 shrink-0">Serviço:</span>
                <span className="font-bold text-neutral-900 leading-tight line-clamp-2">{order.service_description}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {order.status !== 'PENDING' && order.status !== 'CANCELLED' && (
            <div>
              <p className="text-[9px] md:text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Logística</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs md:text-sm">
                  <Truck size={14} className="text-neutral-400" />
                  <span className={cn(
                    "font-bold",
                    order.delivery_type === 'PICKUP' ? "text-orange-600" : "text-blue-600"
                  )}>
                    {order.delivery_type === 'PICKUP' ? 'Retirada' : 'Entrega'}
                  </span>
                  {order.delivery_type === 'DELIVERY' && order.expected_delivery && (
                    <span className="text-neutral-500 text-[10px]">({safeFormatDate(order.expected_delivery)})</span>
                  )}
                </div>
                {isAdmin && (order.purchase_order || order.invoice_number) && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {order.purchase_order && (
                      <span className="px-1.5 py-0.5 bg-neutral-50 text-[9px] font-bold border border-neutral-200 rounded text-neutral-600">
                        PED: {order.purchase_order}
                      </span>
                    )}
                    {order.invoice_number && (
                      <span className="px-1.5 py-0.5 bg-neutral-50 text-[9px] font-bold border border-neutral-200 rounded text-neutral-600">
                        NF: {order.invoice_number}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Observations & Justifications */}
      {(order.observation || order.quantity_justification) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-neutral-100">
          {order.observation && (
            <div className="flex items-start gap-2 text-xs">
              <Info size={14} className="text-neutral-400 shrink-0 mt-0.5" />
              <p className="text-neutral-500 italic">"{order.observation}"</p>
            </div>
          )}
          {order.quantity_justification && (
            <div className="flex items-start gap-2 text-xs">
              <AlertTriangle size={14} className="text-orange-400 shrink-0 mt-0.5" />
              <p className="text-neutral-500 italic">"{order.quantity_justification}"</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

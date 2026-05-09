import { getSupabase } from './supabase';

export async function seedExampleData() {
  const supabase = getSupabase();

  // 1. Create Materials
  const { data: materials, error: matError } = await supabase.from('materials').insert([
    { 
      name: 'Cimento CP II', 
      category: 'Básico', 
      unit: 'Saco 50kg', 
      cost: 35.50, 
      provider: 'Votorantim', 
      stock_quantity: 100, 
      min_stock: 20 
    },
    { 
      name: 'Areia Lavada', 
      category: 'Básico', 
      unit: 'm³', 
      cost: 120.00, 
      provider: 'Areial Santa Luzia', 
      stock_quantity: 15, 
      min_stock: 5 
    },
    { 
      name: 'Piso Porcelanato 60x60', 
      category: 'Acabamento', 
      unit: 'm²', 
      cost: 85.00, 
      provider: 'Portobello', 
      stock_quantity: 200, 
      min_stock: 50 
    }
  ]).select();

  if (matError) console.error('Error seeding materials:', matError);

  // 2. Create Providers
  const { data: providers, error: provError } = await supabase.from('providers').insert([
    { name: 'João Silva (Pedreiro)', service_type: 'Mão de Obra', area: 'Civil' },
    { name: 'Maria Santos (Eletricista)', service_type: 'Instalações', area: 'Elétrica' }
  ]).select();

  if (provError) console.error('Error seeding providers:', provError);

  // 3. Create Equipment
  const { data: equipment, error: eqpError } = await supabase.from('equipment').insert([
    { 
      name: 'Betoneira 400L', 
      code: 'EQP-001', 
      category: 'Máquinas Pesadas', 
      status: 'IN_USE', 
      current_responsible: 'Mestre Carlos', 
      current_project: 'Residencial Alpha' 
    },
    { 
      name: 'Furadeira de Impacto', 
      code: 'EQP-002', 
      category: 'Ferramentas Elétricas', 
      status: 'AVAILABLE', 
      current_responsible: 'Almoxarifado', 
      current_project: 'Estoque Central' 
    }
  ]).select();

  if (eqpError) console.error('Error seeding equipment:', eqpError);

  // 4. Create Movements (Transactions)
  if (materials && materials.length > 0) {
    const { error: movError } = await supabase.from('movements').insert([
      { 
        material_id: materials[0].id, 
        quantity: 10, 
        type: 'OUT', 
        area: 'Civil', 
        project: 'Residencial Alpha', 
        responsible: 'Mestre Carlos' 
      },
      { 
        material_id: materials[1].id, 
        quantity: 5, 
        type: 'OUT', 
        area: 'Civil', 
        project: 'Residencial Alpha', 
        responsible: 'Mestre Carlos' 
      }
    ]);
    if (movError) console.error('Error seeding movements:', movError);
  }

  // 5. Create Service Records
  if (providers && providers.length > 0) {
    const { error: srvError } = await supabase.from('service_records').insert([
      { 
        provider_id: providers[0].id, 
        area: 'Civil', 
        project: 'Residencial Alpha', 
        date: new Date().toISOString().split('T')[0], 
        daily_rate: 180.00, 
        description: 'Alvenaria de vedação no 2º pavimento' 
      }
    ]);
    if (srvError) console.error('Error seeding service records:', srvError);
  }

  // 6. Create Equipment Movements
  if (equipment && equipment.length > 0) {
    const { error: eqpMovError } = await supabase.from('equipment_movements').insert([
      { 
        equipment_id: equipment[0].id, 
        from_responsible: 'Almoxarifado', 
        to_responsible: 'Mestre Carlos', 
        from_project: 'Estoque Central', 
        to_project: 'Residencial Alpha', 
        notes: 'Início da fase de fundação' 
      }
    ]);
    if (eqpMovError) console.error('Error seeding equipment movements:', eqpMovError);
  }

  // 7. Create Orders
  if (materials && materials.length > 0) {
    const { error: orderError } = await supabase.from('orders').insert([
      {
        material_id: materials[2].id,
        quantity: 50,
        status: 'PENDING',
        requested_by: 'Eng. Roberto',
        expected_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
    ]);
    if (orderError) console.error('Error seeding orders:', orderError);
  }

  return true;
}

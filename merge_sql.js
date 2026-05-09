import fs from 'fs';

const files = [
  'supabase_schema.sql',
  'fix_orders_schema.sql',
  'fix_orders_stock.sql',
  'fix_schema_and_rls.sql',
  'fix_service_records_schema.sql',
  'update_equipment_schema.sql',
  'update_flow_schema.sql'
];

let result = '-- ==========================================\n';
result += '-- FINAL SUPABASE SCHEMA (CONSOLIDATED)\n';
result += '-- ==========================================\n\n';

for (const f of files) {
  try {
    const content = fs.readFileSync(f, 'utf-8');
    result += `\n\n-- === SOURCE: ${f} ===\n\n`;
    result += content;
  } catch (e) {
    console.warn(`Could not read ${f}: ${e.message}`);
  }
}

fs.writeFileSync('full_supabase_schema.sql', result);
console.log('SQL merged successfully into full_supabase_schema.sql');

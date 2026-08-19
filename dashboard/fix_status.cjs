require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const lines = fs.readFileSync('pedidos.md', 'utf8').split('\n').filter(l => l.trim() !== '');

const parsedLines = lines.map(line => {
  const parts = line.split('\t');
  return {
    customer: parts[0]?.trim(),
    model: parts[1]?.trim(),
    variant: parts[2]?.trim(),
    quantity: parseInt(parts[3]?.trim(), 10),
    status: parts[4]?.trim()
  };
});

supabase.from('order_lines').select('*').is('completed_at', null).then(async ({data, error}) => {
  if (error) {
    console.error(error);
    return;
  }
  let updated = 0;
  for (const row of data) {
    const match = parsedLines.find(p => 
      p.customer.toLowerCase() === row.customer.toLowerCase() &&
      p.model.toLowerCase() === row.model.toLowerCase() &&
      p.quantity === row.quantity
    );
    if (match) {
      if (row.status !== match.status) {
        await supabase.from('order_lines').update({status: match.status}).eq('line_id', row.line_id);
        updated++;
      }
    }
  }
  console.log('Filas actualizadas a En producción o Pendiente según pedidos.md:', updated);
});

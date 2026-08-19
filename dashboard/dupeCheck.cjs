require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

supabase.from('order_lines').select('*').then(({data}) => {
  const groups = {};
  data.forEach(row => {
    const key = [row.order_id || 'no-id', row.customer, row.model, row.variant, row.quantity].join('|');
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });
  
  const duplicates = Object.values(groups).filter(g => g.length > 1);
  let pendingDupes = 0;
  let exactDupes = 0;

  duplicates.forEach(g => {
    const hasCompletado = g.some(r => r.status === 'Completado');
    const hasPendiente = g.some(r => r.status === 'Pendiente' || r.status === 'En producción');
    if (hasCompletado && hasPendiente) pendingDupes++;
    
    // Check if they are all identical status
    if (g.every(r => r.status === g[0].status) && g.length > 1) {
      exactDupes++;
    }
  });

  console.log('Grupos duplicados encontrados:', duplicates.length);
  console.log('Duplicados donde la MISMA linea esta como Completado y como Pendiente (importacion doble):', pendingDupes);
  console.log('Duplicados exactos del mismo estado:', exactDupes);
});

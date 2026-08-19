import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(rootDir, ".env.local") });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan variables de entorno SUPABASE_URL o SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Consultando settings en Supabase...");
  const { data: settings, error: sErr } = await supabase.from('settings').select('generated_at').eq('id', 1).single();
  if (sErr) {
    console.error("Error al consultar settings:", sErr);
  }
  const genDate = settings?.generated_at || '2026-08-18T05:16:55.245Z';
  console.log("Fecha a usar como backfill:", genDate);

  const { data: nullCountBefore, error: countErr1 } = await supabase
    .from('order_lines')
    .select('line_id')
    .is('created_at', null);

  console.log(`Registros con created_at null antes del backfill: ${nullCountBefore?.length ?? '?'}`);

  const { data: updateData, error: uErr } = await supabase
    .from('order_lines')
    .update({ created_at: genDate })
    .is('created_at', null)
    .select();

  if (uErr) {
    console.error("Error en update:", uErr);
    process.exit(1);
  }

  console.log(`Registros actualizados: ${updateData?.length ?? 0}`);

  const { data: nullCountAfter, error: countErr2 } = await supabase
    .from('order_lines')
    .select('line_id')
    .is('created_at', null);

  console.log(`Registros con created_at null después del backfill: ${nullCountAfter?.length ?? 0}`);
  if (nullCountAfter && nullCountAfter.length === 0) {
    console.log("✅ Backfill completado exitosamente sin registros nulos.");
  } else {
    console.warn("⚠️ Aún quedan registros con created_at nulo.");
  }
}

run().catch(console.error);

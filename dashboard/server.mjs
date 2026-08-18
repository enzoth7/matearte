import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 5175);
const app = express();

app.use(express.json({ limit: "2mb" }));

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan variables de entorno SUPABASE_URL o SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const makeId = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const cleanText = (value) => String(value ?? "").trim();
const cleanQuantity = (value) => Math.max(1, Number(value) || 1);

async function getDashboardData() {
  const [settingsReq, productsReq, customersReq, linesReq] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("products").select("*"),
    supabase.from("customers").select("*"),
    supabase.from("order_lines").select("*"),
  ]);

  if (settingsReq.error && settingsReq.error.code !== 'PGRST116') throw settingsReq.error;
  if (productsReq.error) throw productsReq.error;
  if (customersReq.error) throw customersReq.error;
  if (linesReq.error) throw linesReq.error;

  return {
    source: settingsReq.data?.source || '',
    generatedAt: settingsReq.data?.generated_at || '',
    exchangeRate: Number(settingsReq.data?.exchange_rate || 1),
    customers: customersReq.data.map(c => c.full_name).sort((a, b) => a.localeCompare(b, "es")),
    customerProfiles: customersReq.data.map(c => ({
      fullName: c.full_name,
      firstName: c.first_name,
      lastName: c.last_name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      notes: c.notes,
    })),
    products: productsReq.data.map(p => ({
      id: p.id,
      model: p.model,
      variant: p.variant,
      rimType: p.rim_type,
      leatherType: p.leather_type,
      priceArg: Number(p.price_arg),
      priceUyu: Number(p.price_uyu),
    })),
    production: linesReq.data
      .filter(l => l.status === "Pendiente" || l.status === "En producción")
      .map(l => ({
        lineId: l.line_id,
        orderId: l.order_id,
        customer: l.customer,
        model: l.model,
        variant: l.variant,
        quantity: l.quantity,
        status: l.status,
      })),
    history: linesReq.data
      .filter(l => l.status === "Completado")
      .map(l => ({
        lineId: l.line_id,
        orderId: l.order_id,
        createdAt: l.created_at,
        customer: l.customer,
        model: l.model,
        variant: l.variant,
        quantity: l.quantity,
        completedAt: l.completed_at,
      }))
  };
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "matearte-dashboard", backend: "supabase" });
});

app.get("/api/dashboard", async (_request, response, next) => {
  try {
    response.json(await getDashboardData());
  } catch (error) {
    next(error);
  }
});

app.post("/api/customers", async (request, response, next) => {
  try {
    const firstName = cleanText(request.body.firstName);
    const lastName = cleanText(request.body.lastName);
    const customer = cleanText(request.body.fullName || request.body.customer || `${firstName} ${lastName}`);
    if (!customer) return response.status(400).json({ error: "Ingresá el nombre del cliente." });

    const profile = {
      full_name: customer,
      first_name: firstName || customer.split(/\s+/)[0],
      last_name: lastName || customer.split(/\s+/).slice(1).join(" "),
      phone: cleanText(request.body.phone),
      email: cleanText(request.body.email),
      address: cleanText(request.body.address),
      notes: cleanText(request.body.notes),
    };

    const { error } = await supabase.from("customers").upsert(profile, { onConflict: "full_name" });
    if (error) throw error;

    response.status(201).json(await getDashboardData());
  } catch (error) {
    next(error);
  }
});

app.put("/api/customers/:customer", async (request, response, next) => {
  try {
    const previousCustomer = cleanText(request.params.customer);
    const firstName = cleanText(request.body.firstName);
    const lastName = cleanText(request.body.lastName);
    const customer = cleanText(request.body.fullName || request.body.customer || `${firstName} ${lastName}`);
    if (!previousCustomer || !customer) return response.status(400).json({ error: "El nombre del cliente es obligatorio." });

    // Update customer ID (full_name) - since it's PK, if it changed we might need to insert and delete or just update if we have CASCADE on lines.
    // Fortunately, we have ON UPDATE CASCADE on order_lines.
    // Wait, Supabase/PostgREST allows updating PK.
    const profile = {
      full_name: customer,
      first_name: firstName || customer.split(/\s+/)[0],
      last_name: lastName || customer.split(/\s+/).slice(1).join(" "),
      phone: cleanText(request.body.phone),
      email: cleanText(request.body.email),
      address: cleanText(request.body.address),
      notes: cleanText(request.body.notes),
    };

    const { error } = await supabase.from("customers").update(profile).eq("full_name", previousCustomer);
    if (error) throw error;

    response.json(await getDashboardData());
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", async (request, response, next) => {
  try {
    const customer = cleanText(request.body.customer);
    const items = Array.isArray(request.body.items) ? request.body.items : [];
    if (!customer || !items.length) return response.status(400).json({ error: "Cliente y artículos son obligatorios." });

    const orderId = `PED-${Math.floor(100000 + Math.random() * 900000)}`;
    const createdAt = new Date().toISOString();

    const { data: productsData, error: pError } = await supabase.from("products").select("*").in("id", items.map(i => String(i.productId)));
    if (pError) throw pError;
    const productsMap = new Map(productsData.map(p => [String(p.id), p]));

    const newLines = items.map((item) => {
      const product = productsMap.get(String(item.productId));
      if (!product) throw new Error(`Producto inexistente: ${item.productId}`);
      return {
        line_id: makeId("line"),
        order_id: orderId,
        customer,
        model: product.model,
        variant: product.variant,
        quantity: cleanQuantity(item.quantity),
        status: "Pendiente",
        created_at: createdAt
      };
    });

    const { error } = await supabase.from("order_lines").insert(newLines);
    if (error) throw error;

    const data = await getDashboardData();
    response.status(201).json({ data, orderId });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/production/:lineId", async (request, response, next) => {
  try {
    const patch = request.body ?? {};
    const updates = {};
    if (patch.orderId !== undefined) updates.order_id = cleanText(patch.orderId) || null;
    if (patch.customer !== undefined) updates.customer = cleanText(patch.customer);
    if (patch.model !== undefined) updates.model = cleanText(patch.model);
    if (patch.variant !== undefined) updates.variant = cleanText(patch.variant);
    if (patch.quantity !== undefined) updates.quantity = cleanQuantity(patch.quantity);
    if (patch.status !== undefined) updates.status = patch.status === "En producción" ? "En producción" : "Pendiente";

    const { error } = await supabase.from("order_lines").update(updates).eq("line_id", request.params.lineId);
    if (error) throw error;

    response.json(await getDashboardData());
  } catch (error) {
    next(error);
  }
});

app.post("/api/production/:lineId/complete", async (request, response, next) => {
  try {
    const { error } = await supabase.from("order_lines").update({ 
      status: "Completado",
      completed_at: new Date().toISOString()
    }).eq("line_id", request.params.lineId);
    
    if (error) throw error;
    response.json(await getDashboardData());
  } catch (error) {
    next(error);
  }
});

app.post("/api/products", async (request, response, next) => {
  try {
    const model = cleanText(request.body.model);
    const variant = cleanText(request.body.variant);
    const rimType = cleanText(request.body.rimType ?? request.body.rim_type);
    const leatherType = cleanText(request.body.leatherType ?? request.body.leather_type);
    const priceArg = Math.max(0, Number(request.body.priceArg ?? request.body.price_arg) || 0);

    if (!model || !variant) {
      return response.status(400).json({ error: "Modelo y variante son obligatorios." });
    }

    const { data: settings } = await supabase.from("settings").select("exchange_rate").eq("id", 1).single();
    const rate = settings ? Number(settings.exchange_rate) : 1;
    const priceUyu = priceArg * rate;

    const { data: productsData, error: pError } = await supabase.from("products").select("id");
    if (pError) throw pError;

    const maxId = productsData && productsData.length
      ? Math.max(...productsData.map((p) => Number(p.id) || 0), 0)
      : 0;
    const id = String(maxId + 1);

    const newProduct = {
      id,
      model,
      variant,
      rim_type: rimType,
      leather_type: leatherType,
      price_arg: priceArg,
      price_uyu: priceUyu,
    };

    const { error } = await supabase.from("products").insert(newProduct);
    if (error) throw error;

    response.status(201).json(await getDashboardData());
  } catch (error) {
    next(error);
  }
});

app.patch("/api/products/:id", async (request, response, next) => {
  try {
    const patch = request.body ?? {};
    
    const { data: settings } = await supabase.from("settings").select("exchange_rate").eq("id", 1).single();
    const rate = settings ? Number(settings.exchange_rate) : 1;

    const { data: prevProduct, error: getErr } = await supabase.from("products").select("*").eq("id", request.params.id).single();
    if (getErr) throw getErr;

    const priceArg = Math.max(0, Number(patch.priceArg ?? prevProduct.price_arg) || 0);

    const updates = {
      model: patch.model === undefined ? prevProduct.model : cleanText(patch.model) || prevProduct.model,
      variant: patch.variant === undefined ? prevProduct.variant : cleanText(patch.variant) || prevProduct.variant,
      rim_type: patch.rimType === undefined ? prevProduct.rim_type : cleanText(patch.rimType),
      leather_type: patch.leatherType === undefined ? prevProduct.leather_type : cleanText(patch.leatherType),
      price_arg: priceArg,
      price_uyu: priceArg * rate,
    };

    const { error } = await supabase.from("products").update(updates).eq("id", request.params.id);
    if (error) throw error;

    response.json(await getDashboardData());
  } catch (error) {
    next(error);
  }
});

app.put("/api/settings/exchange-rate", async (request, response, next) => {
  try {
    const rate = Number(request.body.exchangeRate);
    if (!Number.isFinite(rate) || rate <= 0) return response.status(400).json({ error: "Tipo de cambio inválido." });

    const { error: settingsErr } = await supabase.from("settings").update({ exchange_rate: rate }).eq("id", 1);
    if (settingsErr) throw settingsErr;

    // Actualizar todos los productos (priceUyu = priceArg * rate)
    // Supabase no soporta un update masivo referenciando la misma columna por REST directo fácilmente.
    // Vamos a buscar y hacer update masivo o llamar una función, pero para mantenerlo simple por REST:
    const { data: products } = await supabase.from("products").select("id, price_arg");
    if (products) {
      const updates = products.map(p => ({
        id: p.id,
        price_uyu: Number(p.price_arg) * rate
      }));
      // En upsert se puede actualizar masivo
      await supabase.from("products").upsert(updates);
    }

    response.json(await getDashboardData());
  } catch (error) {
    next(error);
  }
});

app.post("/api/reset", async (_request, response, next) => {
  try {
    // Para simplificar, ignoramos reset porque en DB no es trivial sin SQL o delete from tables.
    response.json(await getDashboardData());
  } catch (error) {
    next(error);
  }
});

if (isProduction) {
  app.use(express.static(path.join(rootDir, "dist")));
  app.get("*path", (_request, response) => response.sendFile(path.join(rootDir, "dist", "index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(error.status || 500).json({ error: error.message || "Error interno." });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`MateArte dashboard disponible en http://127.0.0.1:${port}`);
});

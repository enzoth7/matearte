import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(rootDir, "data");
const dataFile = path.join(dataDir, "dashboard.json");
const seedFile = path.join(rootDir, "src", "data", "seed.json");
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 5175);
const app = express();

app.use(express.json({ limit: "2mb" }));

let mutationQueue = Promise.resolve();

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.copyFile(seedFile, dataFile);
  }
}

function normalizeData(data) {
  const customers = [
    ...(Array.isArray(data.customers) ? data.customers : []),
    ...(Array.isArray(data.production) ? data.production.map((item) => item.customer) : []),
    ...(Array.isArray(data.history) ? data.history.map((item) => item.customer) : []),
  ];
  const uniqueCustomers = new Map();
  for (const value of customers) {
    const customer = cleanText(value);
    if (!customer) continue;
    const key = customer.toLocaleLowerCase("es");
    if (!uniqueCustomers.has(key)) uniqueCustomers.set(key, customer);
  }
  data.customers = [...uniqueCustomers.values()].sort((a, b) => a.localeCompare(b, "es"));
  const profiles = new Map();
  for (const profile of Array.isArray(data.customerProfiles) ? data.customerProfiles : []) {
    const fullName = cleanText(profile.fullName || `${cleanText(profile.firstName)} ${cleanText(profile.lastName)}`);
    if (fullName) profiles.set(fullName.toLocaleLowerCase("es"), profile);
  }
  data.customerProfiles = data.customers.map((fullName) => {
    const previous = profiles.get(fullName.toLocaleLowerCase("es")) ?? {};
    const [fallbackFirstName = fullName, ...fallbackLastName] = fullName.split(/\s+/);
    return {
      fullName,
      firstName: cleanText(previous.firstName) || fallbackFirstName,
      lastName: cleanText(previous.lastName) || fallbackLastName.join(" "),
      phone: cleanText(previous.phone),
      email: cleanText(previous.email),
      address: cleanText(previous.address),
      notes: cleanText(previous.notes),
    };
  });
  return data;
}

async function readData() {
  await ensureDataFile();
  return normalizeData(JSON.parse(await fs.readFile(dataFile, "utf8")));
}

async function writeData(data) {
  const temporaryFile = `${dataFile}.tmp`;
  await fs.writeFile(temporaryFile, `${JSON.stringify(normalizeData(data), null, 2)}\n`, "utf8");
  await fs.rename(temporaryFile, dataFile);
  return data;
}

function mutateData(mutator) {
  const transaction = mutationQueue.then(async () => {
    const data = await readData();
    const result = await mutator(data);
    await writeData(data);
    return result ?? data;
  });
  mutationQueue = transaction.then(() => undefined, () => undefined);
  return transaction;
}

const makeId = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const cleanText = (value) => String(value ?? "").trim();
const cleanQuantity = (value) => Math.max(1, Number(value) || 1);

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "matearte-dashboard" });
});

app.get("/api/dashboard", async (_request, response, next) => {
  try {
    response.json(await readData());
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
    const data = await mutateData((current) => {
      const exists = current.customers.some((item) => item.localeCompare(customer, "es", { sensitivity: "base" }) === 0);
      if (!exists) current.customers.push(customer);
      const profileIndex = current.customerProfiles.findIndex((profile) => profile.fullName.localeCompare(customer, "es", { sensitivity: "base" }) === 0);
      const profile = {
        fullName: customer,
        firstName: firstName || customer.split(/\s+/)[0],
        lastName: lastName || customer.split(/\s+/).slice(1).join(" "),
        phone: cleanText(request.body.phone),
        email: cleanText(request.body.email),
        address: cleanText(request.body.address),
        notes: cleanText(request.body.notes),
      };
      if (profileIndex >= 0) current.customerProfiles[profileIndex] = { ...current.customerProfiles[profileIndex], ...profile };
      else current.customerProfiles.push(profile);
    });
    response.status(201).json(data);
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
    const data = await mutateData((current) => {
      const matches = (value) => cleanText(value).localeCompare(previousCustomer, "es", { sensitivity: "base" }) === 0;
      if (!current.customers.some(matches)) throw Object.assign(new Error("Cliente no encontrado."), { status: 404 });
      current.customers = current.customers.map((value) => matches(value) ? customer : value);
      current.production = current.production.map((item) => matches(item.customer) ? { ...item, customer } : item);
      current.history = current.history.map((item) => matches(item.customer) ? { ...item, customer } : item);
      const profileIndex = current.customerProfiles.findIndex((profile) => matches(profile.fullName));
      const previousProfile = profileIndex >= 0 ? current.customerProfiles[profileIndex] : {};
      const profile = {
        ...previousProfile,
        fullName: customer,
        firstName: firstName || customer.split(/\s+/)[0],
        lastName: lastName || customer.split(/\s+/).slice(1).join(" "),
        phone: cleanText(request.body.phone),
        email: cleanText(request.body.email),
        address: cleanText(request.body.address),
        notes: cleanText(request.body.notes),
      };
      if (profileIndex >= 0) current.customerProfiles[profileIndex] = profile;
      else current.customerProfiles.push(profile);
    });
    response.json(data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", async (request, response, next) => {
  try {
    const customer = cleanText(request.body.customer);
    const items = Array.isArray(request.body.items) ? request.body.items : [];
    if (!customer || !items.length) return response.status(400).json({ error: "Cliente y artículos son obligatorios." });

    const result = await mutateData((data) => {
      const orderId = `PED-${Math.floor(100000 + Math.random() * 900000)}`;
      const createdAt = new Date().toISOString();
      const products = new Map(data.products.map((product) => [String(product.id), product]));
      const newLines = items.map((item) => {
        const product = products.get(String(item.productId));
        if (!product) throw new Error(`Producto inexistente: ${item.productId}`);
        return {
          lineId: makeId("line"),
          orderId,
          customer,
          model: product.model,
          variant: product.variant,
          quantity: cleanQuantity(item.quantity),
          status: "Pendiente",
        };
      });
      data.production.push(...newLines);
      data.history.push(...newLines.map((line) => ({ ...line, status: undefined, createdAt, completedAt: null })));
      return { data, orderId };
    });
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/production/:lineId", async (request, response, next) => {
  try {
    const data = await mutateData((current) => {
      const index = current.production.findIndex((item) => item.lineId === request.params.lineId);
      if (index < 0) throw Object.assign(new Error("Línea no encontrada."), { status: 404 });
      const previous = current.production[index];
      const patch = request.body ?? {};
      current.production[index] = {
        ...previous,
        orderId: patch.orderId === undefined ? previous.orderId : cleanText(patch.orderId) || null,
        customer: patch.customer === undefined ? previous.customer : cleanText(patch.customer) || previous.customer,
        model: patch.model === undefined ? previous.model : cleanText(patch.model) || previous.model,
        variant: patch.variant === undefined ? previous.variant : cleanText(patch.variant) || previous.variant,
        quantity: cleanQuantity(patch.quantity ?? previous.quantity),
        status: patch.status === undefined ? previous.status : patch.status === "En producción" ? "En producción" : "Pendiente",
      };
      const historyIndex = current.history.findIndex((item) => item.lineId === request.params.lineId);
      if (historyIndex >= 0) {
        current.history[historyIndex] = {
          ...current.history[historyIndex],
          orderId: current.production[index].orderId,
          customer: current.production[index].customer,
          model: current.production[index].model,
          variant: current.production[index].variant,
          quantity: current.production[index].quantity,
        };
      }
    });
    response.json(data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/production/:lineId/complete", async (request, response, next) => {
  try {
    const data = await mutateData((current) => {
      const index = current.production.findIndex((item) => item.lineId === request.params.lineId);
      if (index < 0) throw Object.assign(new Error("Línea no encontrada."), { status: 404 });
      current.production.splice(index, 1);
      const historyIndex = current.history.findIndex((item) => item.lineId === request.params.lineId);
      if (historyIndex >= 0) current.history[historyIndex].completedAt = new Date().toISOString();
    });
    response.json(data);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/products/:id", async (request, response, next) => {
  try {
    const data = await mutateData((current) => {
      const index = current.products.findIndex((item) => String(item.id) === request.params.id);
      if (index < 0) throw Object.assign(new Error("Producto no encontrado."), { status: 404 });
      const previous = current.products[index];
      const patch = request.body ?? {};
      const priceArg = Math.max(0, Number(patch.priceArg ?? previous.priceArg) || 0);
      current.products[index] = {
        ...previous,
        model: patch.model === undefined ? previous.model : cleanText(patch.model) || previous.model,
        variant: patch.variant === undefined ? previous.variant : cleanText(patch.variant) || previous.variant,
        rimType: patch.rimType === undefined ? previous.rimType : cleanText(patch.rimType),
        leatherType: patch.leatherType === undefined ? previous.leatherType : cleanText(patch.leatherType),
        priceArg,
        priceUyu: priceArg * current.exchangeRate,
      };
    });
    response.json(data);
  } catch (error) {
    next(error);
  }
});

app.put("/api/settings/exchange-rate", async (request, response, next) => {
  try {
    const rate = Number(request.body.exchangeRate);
    if (!Number.isFinite(rate) || rate <= 0) return response.status(400).json({ error: "Tipo de cambio inválido." });
    const data = await mutateData((current) => {
      current.exchangeRate = rate;
      current.products = current.products.map((product) => ({ ...product, priceUyu: product.priceArg * rate }));
    });
    response.json(data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/reset", async (_request, response, next) => {
  try {
    const seed = normalizeData(JSON.parse(await fs.readFile(seedFile, "utf8")));
    await writeData(seed);
    response.json(seed);
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

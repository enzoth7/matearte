import seed from "../data/seed.json";
import type {
  CustomerProfile,
  DashboardData,
  DraftOrderItem,
  Product,
  ProductionItem,
} from "../types";

const STORAGE_KEY = "matearte-dashboard-demo-v1";

const cleanText = (value: unknown) => String(value ?? "").trim();
const cleanQuantity = (value: unknown) => Math.max(1, Number(value) || 1);
const cloneSeed = () => JSON.parse(JSON.stringify(seed)) as DashboardData;

function makeId(prefix: string) {
  const value = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${value}`;
}

function normalizeData(data: DashboardData): DashboardData {
  const customers = [
    ...(data.customers ?? []),
    ...data.production.map((item) => item.customer),
    ...data.history.map((item) => item.customer),
  ];
  const uniqueCustomers = new Map<string, string>();

  for (const value of customers) {
    const customer = cleanText(value);
    if (!customer) continue;
    const key = customer.toLocaleLowerCase("es");
    if (!uniqueCustomers.has(key)) uniqueCustomers.set(key, customer);
  }

  data.customers = [...uniqueCustomers.values()].sort((a, b) => a.localeCompare(b, "es"));
  const profiles = new Map(
    (data.customerProfiles ?? []).map((profile) => [profile.fullName.toLocaleLowerCase("es"), profile]),
  );
  data.customerProfiles = data.customers.map((fullName) => {
    const previous = profiles.get(fullName.toLocaleLowerCase("es"));
    const [fallbackFirstName = fullName, ...fallbackLastName] = fullName.split(/\s+/);
    return {
      fullName,
      firstName: cleanText(previous?.firstName) || fallbackFirstName,
      lastName: cleanText(previous?.lastName) || fallbackLastName.join(" "),
      phone: cleanText(previous?.phone),
      email: cleanText(previous?.email),
      address: cleanText(previous?.address),
      notes: cleanText(previous?.notes),
    };
  });
  return data;
}

function readDemoData() {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return normalizeData(stored ? JSON.parse(stored) as DashboardData : cloneSeed());
  } catch {
    return normalizeData(cloneSeed());
  }
}

function persistDemoData(data: DashboardData) {
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalizeData(data)));
  return data;
}

function parseBody<T>(options?: RequestInit): T {
  if (typeof options?.body !== "string") return {} as T;
  return JSON.parse(options.body) as T;
}

function customerProfile(value: Partial<CustomerProfile>): CustomerProfile {
  const firstName = cleanText(value.firstName);
  const lastName = cleanText(value.lastName);
  const fullName = cleanText(value.fullName || `${firstName} ${lastName}`);
  if (!fullName) throw new Error("El nombre del cliente es obligatorio.");
  const [fallbackFirstName = fullName, ...fallbackLastName] = fullName.split(/\s+/);
  return {
    fullName,
    firstName: firstName || fallbackFirstName,
    lastName: lastName || fallbackLastName.join(" "),
    phone: cleanText(value.phone),
    email: cleanText(value.email),
    address: cleanText(value.address),
    notes: cleanText(value.notes),
  };
}

export async function demoRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const path = new URL(url, "https://matearte.demo").pathname;
  const method = options?.method?.toUpperCase() ?? "GET";

  if (path === "/api/reset" && method === "POST") {
    const reset = normalizeData(cloneSeed());
    globalThis.localStorage?.removeItem(STORAGE_KEY);
    return reset as T;
  }

  const data = readDemoData();
  if (path === "/api/dashboard" && method === "GET") return data as T;

  if (path === "/api/customers" && method === "POST") {
    const profile = customerProfile(parseBody<Partial<CustomerProfile>>(options));
    const index = (data.customerProfiles ?? []).findIndex((item) => item.fullName.localeCompare(profile.fullName, "es", { sensitivity: "base" }) === 0);
    if (index >= 0) data.customerProfiles![index] = { ...data.customerProfiles![index], ...profile };
    else data.customerProfiles = [...(data.customerProfiles ?? []), profile];
    data.customers = [...(data.customers ?? []), profile.fullName];
    return persistDemoData(data) as T;
  }

  const customerMatch = path.match(/^\/api\/customers\/([^/]+)$/);
  if (customerMatch && method === "PUT") {
    const previousCustomer = decodeURIComponent(customerMatch[1]);
    const profile = customerProfile(parseBody<Partial<CustomerProfile>>(options));
    const isPrev = (value: string) => value.localeCompare(previousCustomer, "es", { sensitivity: "base" }) === 0;
    const isTarget = (value: string) => value.localeCompare(profile.fullName, "es", { sensitivity: "base" }) === 0;

    if (!(data.customers ?? []).some(isPrev)) throw new Error("Cliente no encontrado.");

    const isSame = previousCustomer.localeCompare(profile.fullName, "es", { sensitivity: "base" }) === 0;

    if (isSame) {
      const profileIndex = (data.customerProfiles ?? []).findIndex((item) => isPrev(item.fullName));
      if (profileIndex >= 0) data.customerProfiles![profileIndex] = profile;
      else data.customerProfiles = [...(data.customerProfiles ?? []), profile];
    } else {
      const targetExists = (data.customers ?? []).some((c) => isTarget(c) && !isPrev(c));
      if (targetExists) {
        // Merge: reassign order lines
        data.production = data.production.map((item) => isPrev(item.customer) ? { ...item, customer: profile.fullName } : item);
        data.history = data.history.map((item) => isPrev(item.customer) ? { ...item, customer: profile.fullName } : item);

        // Merge contact info and notes
        const targetIndex = (data.customerProfiles ?? []).findIndex((item) => isTarget(item.fullName));
        const prevIndex = (data.customerProfiles ?? []).findIndex((item) => isPrev(item.fullName));
        const existingTarget = targetIndex >= 0 ? data.customerProfiles![targetIndex] : undefined;
        const prevProfile = prevIndex >= 0 ? data.customerProfiles![prevIndex] : undefined;

        const combinedNotes = [existingTarget?.notes, prevProfile?.notes, profile.notes]
          .map(cleanText)
          .filter(Boolean)
          .filter((n, i, arr) => arr.indexOf(n) === i)
          .join("\n");

        const mergedProfile: CustomerProfile = {
          fullName: existingTarget?.fullName || profile.fullName,
          firstName: existingTarget?.firstName || profile.firstName,
          lastName: existingTarget?.lastName || profile.lastName,
          phone: profile.phone || existingTarget?.phone || prevProfile?.phone || "",
          email: profile.email || existingTarget?.email || prevProfile?.email || "",
          address: profile.address || existingTarget?.address || prevProfile?.address || "",
          notes: combinedNotes,
        };

        if (targetIndex >= 0) {
          data.customerProfiles![targetIndex] = mergedProfile;
        }

        // Remove previous customer
        data.customerProfiles = (data.customerProfiles ?? []).filter((item) => !isPrev(item.fullName));
        data.customers = (data.customers ?? []).filter((item) => !isPrev(item));
      } else {
        data.customers = (data.customers ?? []).map((value) => isPrev(value) ? profile.fullName : value);
        data.production = data.production.map((item) => isPrev(item.customer) ? { ...item, customer: profile.fullName } : item);
        data.history = data.history.map((item) => isPrev(item.customer) ? { ...item, customer: profile.fullName } : item);
        const profileIndex = (data.customerProfiles ?? []).findIndex((item) => isPrev(item.fullName));
        if (profileIndex >= 0) data.customerProfiles![profileIndex] = profile;
        else data.customerProfiles = [...(data.customerProfiles ?? []), profile];
      }
    }

    return persistDemoData(data) as T;
  }

  if (path === "/api/orders" && method === "POST") {
    const body = parseBody<{ customer?: string; items?: DraftOrderItem[] }>(options);
    const customer = cleanText(body.customer);
    const items = Array.isArray(body.items) ? body.items : [];
    if (!customer || !items.length) throw new Error("Cliente y artículos son obligatorios.");
    const orderId = `PED-${Math.floor(100000 + Math.random() * 900000)}`;
    const createdAt = new Date().toISOString();
    const products = new Map(data.products.map((product) => [String(product.id), product]));
    const newLines = items.map((item) => {
      const product = products.get(String(item.productId));
      if (!product) throw new Error(`Producto inexistente: ${item.productId}`);
      const quantity = cleanQuantity(item.quantity);
      const unitPriceArg = product.priceArg;
      const unitPriceUyu = product.priceUyu;
      const exchangeRate = data.exchangeRate;
      const totalArg = unitPriceArg * quantity;
      const totalUyu = unitPriceUyu * quantity;
      return {
        lineId: makeId("line"),
        orderId,
        customer,
        model: product.model,
        variant: product.variant,
        quantity,
        status: "Pendiente" as const,
        createdAt,
        unitPriceArg,
        unitPriceUyu,
        exchangeRate,
        totalArg,
        totalUyu,
      };
    });
    data.production.push(...newLines);
    data.history.push(...newLines.map(({ status: _status, ...line }) => ({ ...line, createdAt, completedAt: null })));
    persistDemoData(data);
    return { data, orderId } as T;
  }

  const completeMatch = path.match(/^\/api\/production\/([^/]+)\/complete$/);
  if (completeMatch && method === "POST") {
    const lineId = decodeURIComponent(completeMatch[1]);
    const index = data.production.findIndex((item) => item.lineId === lineId);
    if (index < 0) throw new Error("Línea no encontrada.");
    data.production.splice(index, 1);
    const historyIndex = data.history.findIndex((item) => item.lineId === lineId);
    if (historyIndex >= 0) data.history[historyIndex].completedAt = new Date().toISOString();
    return persistDemoData(data) as T;
  }

  const productionMatch = path.match(/^\/api\/production\/([^/]+)$/);
  if (productionMatch && method === "PATCH") {
    const lineId = decodeURIComponent(productionMatch[1]);
    const patch = parseBody<ProductionItem>(options);
    const index = data.production.findIndex((item) => item.lineId === lineId);
    if (index < 0) throw new Error("Línea no encontrada.");
    data.production[index] = { ...data.production[index], ...patch, lineId };
    const historyIndex = data.history.findIndex((item) => item.lineId === lineId);
    if (historyIndex >= 0) {
      const current = data.production[index];
      data.history[historyIndex] = { ...data.history[historyIndex], orderId: current.orderId, customer: current.customer, model: current.model, variant: current.variant, quantity: current.quantity };
    }
    return persistDemoData(data) as T;
  }

  if (path === "/api/products" && method === "POST") {
    const body = parseBody<{
      model?: string;
      variant?: string;
      rimType?: string;
      leatherType?: string;
      priceArg?: number;
    }>(options);
    const model = cleanText(body.model);
    const variant = cleanText(body.variant);
    if (!model || !variant) throw new Error("Modelo y variante son obligatorios.");
    const maxId = data.products.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0);
    const id = String(maxId + 1);
    const priceArg = Math.max(0, Number(body.priceArg) || 0);
    const priceUyu = priceArg * data.exchangeRate;
    const newProduct: Product = {
      id,
      model,
      variant,
      rimType: cleanText(body.rimType),
      leatherType: cleanText(body.leatherType),
      priceArg,
      priceUyu,
    };
    data.products.push(newProduct);
    return persistDemoData(data) as T;
  }

  const productMatch = path.match(/^\/api\/products\/([^/]+)$/);
  if (productMatch && method === "PATCH") {
    const productId = decodeURIComponent(productMatch[1]);
    const patch = parseBody<Product>(options);
    const index = data.products.findIndex((item) => String(item.id) === productId);
    if (index < 0) throw new Error("Producto no encontrado.");
    const priceArg = Math.max(0, Number(patch.priceArg) || 0);
    data.products[index] = { ...data.products[index], ...patch, id: data.products[index].id, priceArg, priceUyu: priceArg * data.exchangeRate };
    return persistDemoData(data) as T;
  }

  if (path === "/api/settings/exchange-rate" && method === "PUT") {
    const { exchangeRate } = parseBody<{ exchangeRate?: number }>(options);
    const rate = Number(exchangeRate);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("Tipo de cambio inválido.");
    data.exchangeRate = rate;
    data.products = data.products.map((product) => ({ ...product, priceUyu: product.priceArg * rate }));
    return persistDemoData(data) as T;
  }

  throw new Error(`Operación de demo no disponible: ${method} ${path}`);
}

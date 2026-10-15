import { type State, type Product, type Customer, type Order, type Expense, orgEmployees, total } from "../data";
import { defaultAccess } from "../access";
const today = "2026-10-12";
export function seedFixture(): State {
  const products: Product[] = [
    ["Imperial clásico", "Imperial", "Alpaca", "Vaqueta", 1850, 3290, 34],
    [
      "Camionero cincelado",
      "Camionero",
      "Alpaca",
      "Cuero crudo",
      1250,
      2490,
      18,
    ],
    ["Torpedo premium", "Torpedo", "Plata", "Vaqueta", 2150, 3890, 8],
    ["Criollo natural", "Criollo", "Acero", "Cuero crudo", 850, 1790, 25],
    ["Bombilla de alpaca", "Bombilla", "Alpaca", "Sin cuero", 420, 890, 6],
    ["Matera de cuero", "Accesorio", "Sin virola", "Vaqueta", 1450, 2890, 12],
  ].map((v, i) => ({
    id: `p${i + 1}`,
    name: String(v[0]),
    sku: `MAT-${String(i + 1).padStart(3, "0")}`,
    family: String(v[1]),
    rim: String(v[2]),
    leather: String(v[3]),
    variant: i % 2 ? "Natural" : "Marrón",
    cost: Number(v[4]),
    prices: {
      Local: Number(v[5]),
      Web: Number(v[5]),
      Mayorista: Math.round(Number(v[5]) * 0.7),
    },
    stock: Number(v[6]),
    min: 10,
    published: i !== 5,
  }));
  const customers: Customer[] = [
    ["Lucía Fernández", "Montevideo", "Minorista", "Uruguay"],
    ["Casa del Mate", "Buenos Aires", "Mayorista", "Argentina"],
    ["Martín Acosta", "Maldonado", "Minorista", "Uruguay"],
    ["Sur Concept Store", "Madrid", "Mayorista", "España"],
    ["Ana Rodríguez", "Colonia", "Minorista", "Uruguay"],
    ["Estancia La Clara", "Rocha", "Empresas", "Uruguay"],
  ].map((v, i) => ({
    id: `c${i + 1}`,
    name: v[0],
    city: v[1],
    country: v[3],
    segment: v[2],
    email: `cliente${i + 1}@example.com`,
    phone: `099 100 00${i}`,
  }));
  const orders: Order[] = Array.from({ length: 12 }, (_, i) => ({
    id: `MA-${1041 + i}`,
    customerId: `c${(i % 6) + 1}`,
    productId: `p${(i % 6) + 1}`,
    quantity: i % 3 === 1 ? 12 : i % 3 === 2 ? 2 : 1,
    unitPrice:
      products[i % 6].prices[
        i % 3 === 1 ? "Mayorista" : i % 3 === 2 ? "Local" : "Web"
      ],
    channel: i % 3 === 1 ? "Mayorista" : i % 3 === 2 ? "Local" : "Web",
    date: `2026-10-${String(i + 1).padStart(2, "0")}`,
    due: `2026-10-${14 + (i % 7)}`,
    production: i < 4 ? "Terminado" : i < 8 ? "En producción" : "Pendiente",
    delivery: i < 3 ? "Entregado" : i === 3 ? "Enviado" : "Pendiente",
    method: i % 3 === 2 ? "Retiro" : "Envío",
    design: i % 2 === 0,
    approved: i < 8,
  }));
  const historicalQuantities = [24, 26, 25, 28, 27, 30, 31, 29, 33, 34, 32, 37];
  const historicalOrders: Order[] = historicalQuantities.map((quantity, index) => {
    const month = new Date(Date.UTC(2025, 9 + index, 1)).toISOString().slice(0, 7);
    return {
      id: `H-${month}`,
      customerId: "c2",
      productId: "p1",
      quantity,
      unitPrice: products[0].prices.Mayorista,
      channel: "Mayorista",
      date: `${month}-15`,
      due: `${month}-20`,
      production: "Terminado",
      delivery: "Entregado",
      method: "Envío",
      design: false,
      approved: true,
    };
  });
  const historicalExpenseAmounts = [58000, 63000, 59000, 66000, 62000, 70000, 64000, 68000, 72000, 65000, 74000, 69000];
  const historicalExpenses: Expense[] = historicalExpenseAmounts.map((amount, index) => {
    const month = new Date(Date.UTC(2025, 9 + index, 1)).toISOString().slice(0, 7);
    return {
      id: `HE-${month}`,
      name: `Operación ${month}`,
      amount,
      date: `${month}-18`,
      paid: true,
      category: "Operación",
    };
  });
  const draft = {
    "Camionero · Base": 1800,
    "Imperial · Base": 2600,
    "Torpedo · Base": 2900,
    "Criollo · Base": 1400,
    "Cuero crudo": 180,
    Vaqueta: 250,
    Alpaca: 450,
    Plata: 1200,
    Láser: 300,
    "Aplique de bronce": 550,
    "Aplique de alpaca": 650,
    "Comisión (%)": 8,
  };
  return {
    version: 1,
    orgSeeded: true,
    accessSeeded: true,
    accessPolicyVersion: 2,
    historySeeded: true,
    expenseHistorySeeded: true,
    user: "Richard Ortiz",
    activeUserId: "t1",
    access: defaultAccess(),
    products,
    customers,
    orders: [...historicalOrders, ...orders],
    payments: [...historicalOrders.map((o) => ({
      id: `pay-${o.id}`,
      orderId: o.id,
      amount: total(o),
      date: o.date,
      method: "Transferencia",
    })), ...orders.slice(0, 9).map((o, i) => ({
      id: `pay${i}`,
      orderId: o.id,
      amount: total(o) * (i < 6 ? 1 : 0.5),
      date: o.date,
      method: i % 2 ? "Transferencia" : "Efectivo",
    }))],
    expenses: [...historicalExpenses,
      {
        id: "e1",
        name: "Compra de cuero · Curtiembre Sur",
        amount: 14500,
        date: "2026-10-08",
        paid: true,
        category: "Insumos",
      },
      {
        id: "e2",
        name: "Alquiler del taller",
        amount: 22000,
        date: "2026-10-15",
        paid: false,
        category: "Servicios",
      },
      {
        id: "e3",
        name: "Haberes octubre",
        amount: 46000,
        date: "2026-10-30",
        paid: false,
        category: "Personal",
      },
    ],
    employees: orgEmployees.map((employee) => ({ ...employee })),
    hours: [
      {
        id: "h1",
        persona: "Nicolás",
        fecha: today,
        horas: 7.5,
        tarea: "Coordinación de producción",
      },
      {
        id: "h2",
        persona: "Florencia Costa",
        fecha: today,
        horas: 6,
        tarea: "Atención del local",
      },
    ],
    records: {},
    draft,
    published: { ...draft },
    activity: [
      {
        id: "a1",
        fecha: today,
        usuario: "Richard",
        accion: "Espacio creado",
      },
    ],
  };
}

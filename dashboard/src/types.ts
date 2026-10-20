export type ProductionStatus = "Pendiente" | "En producción";
export type OrderType = "normal" | "no_cost";
export type SaleChannel = "Local" | "Web" | "WhatsApp" | "Instagram" | "Facebook" | "Feria";
export type PanelMode = "wholesale" | "retail";

export type ViewId = "resumen" | "nuevo" | "clientes" | "produccion" | "historico" | "productos";

export interface Product {
  id: string;
  model: string;
  variant: string;
  rimType: string;
  leatherType: string;
  priceArg: number;
  priceUyu: number;
  availableWholesale?: boolean;
  imageUrl?: string;
  imageCrop?: { x: number; y: number; zoom: number };
}

export interface ProductionItem {
  lineId: string;
  orderId: string | null;
  createdAt?: string | null;
  customer: string;
  model: string;
  variant: string;
  quantity: number;
  status: ProductionStatus;
  orderType?: OrderType;
  saleChannel?: SaleChannel;
  unitPriceArg?: number;
  unitPriceUyu?: number;
  exchangeRate?: number;
  totalArg?: number;
  totalUyu?: number;
}

export interface HistoryItem {
  lineId: string;
  orderId: string | null;
  createdAt: string | null;
  customer: string;
  model: string;
  variant: string;
  quantity: number;
  completedAt: string | null;
  orderType?: OrderType;
  saleChannel?: SaleChannel;
  unitPriceArg?: number;
  unitPriceUyu?: number;
  exchangeRate?: number;
  totalArg?: number;
  totalUyu?: number;
}

export interface CustomerProfile {
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export interface DashboardData {
  source?: string;
  generatedAt?: string;
  customers?: string[];
  customerProfiles?: CustomerProfile[];
  exchangeRate: number;
  products: Product[];
  production: ProductionItem[];
  history: HistoryItem[];
}

export interface DraftOrderItem {
  key: string;
  productId: string;
  quantity: number;
  orderType: OrderType;
}

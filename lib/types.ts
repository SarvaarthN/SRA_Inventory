// Category is now a plain string — codes like "TOOL", "SENS", or any user-defined code
export type Category = string;

export interface CategoryDef extends Record<string, unknown> {
  code: string;
  label: string;
  color: string;
  isDefault: string; // stored as "true"/"false" in Redis hash
  createdAt: string;
}

export const COLOR_OPTIONS = [
  { label: "Amber",  value: "bg-amber-100 text-amber-800 border-amber-200",  dot: "bg-amber-400"  },
  { label: "Blue",   value: "bg-blue-100 text-blue-800 border-blue-200",    dot: "bg-blue-400"   },
  { label: "Purple", value: "bg-purple-100 text-purple-800 border-purple-200", dot: "bg-purple-400" },
  { label: "Green",  value: "bg-green-100 text-green-800 border-green-200",  dot: "bg-green-400"  },
  { label: "Gray",   value: "bg-gray-100 text-gray-800 border-gray-200",    dot: "bg-gray-400"   },
  { label: "Orange", value: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-400" },
  { label: "Red",    value: "bg-red-100 text-red-800 border-red-200",       dot: "bg-red-400"    },
  { label: "Teal",   value: "bg-teal-100 text-teal-800 border-teal-200",    dot: "bg-teal-400"   },
  { label: "Pink",   value: "bg-pink-100 text-pink-800 border-pink-200",    dot: "bg-pink-400"   },
  { label: "Indigo", value: "bg-indigo-100 text-indigo-800 border-indigo-200", dot: "bg-indigo-400" },
  { label: "Cyan",   value: "bg-cyan-100 text-cyan-800 border-cyan-200",    dot: "bg-cyan-400"   },
  { label: "Lime",   value: "bg-lime-100 text-lime-800 border-lime-200",    dot: "bg-lime-400"   },
];

export const DEFAULT_CATEGORIES: { code: string; label: string; color: string }[] = [
  { code: "TOOL", label: "Tools",         color: COLOR_OPTIONS[0].value },
  { code: "SENS", label: "Sensors",       color: COLOR_OPTIONS[1].value },
  { code: "MOTR", label: "Motors",        color: COLOR_OPTIONS[2].value },
  { code: "DEVB", label: "Dev Boards",    color: COLOR_OPTIONS[3].value },
  { code: "CABL", label: "Cables",        color: COLOR_OPTIONS[4].value },
  { code: "MECH", label: "Mechanical",    color: COLOR_OPTIONS[5].value },
  { code: "POWR", label: "Power",         color: COLOR_OPTIONS[6].value },
  { code: "MISC", label: "Miscellaneous", color: COLOR_OPTIONS[7].value },
];

// Fallback lookup maps for components created before dynamic categories existed
export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.code, c.label])
);
export const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.code, c.color])
);

export interface Component extends Record<string, unknown> {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  categoryColor: string;
  year: number;
  uniqueNum: number;
  quantity: number;
  description: string;
  boxId: string;
  boxName: string;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type BoxType = "GENERAL" | "EKLAVYA";

export interface Box extends Record<string, unknown> {
  id: string;
  name: string;
  location: string;
  createdBy: string;
  createdAt: string;
  boxType: string; // "GENERAL" | "EKLAVYA"
  componentCount?: number;
}

export type UserYear = "SY" | "TY" | "LY";

export interface User extends Record<string, unknown> {
  internalId: string;   // "USR-001"
  name: string;
  userId: string;       // login username
  passwordHash: string;
  year: string;         // "SY" | "TY" | "LY"
  isAdmin: string;      // "true" | "false" (Redis hash values are strings)
  createdAt: string;
}

export type TransactionType =
  | "STOCK_IN"
  | "STOCK_OUT"
  | "CREATED"
  | "DELETED"
  | "ORDER_RECEIVED";

export interface Transaction extends Record<string, unknown> {
  id: string;
  componentId: string;
  componentName: string;
  type: TransactionType;
  quantityChange: number;
  quantityAfter: number;
  performedBy: string;
  notes: string;
  timestamp: string;
}

export type OrderStatus = "ORDERED" | "RECEIVED" | "CANCELLED";

// One line of a vendor order. `componentId` is set when the order tops up a part
// that already exists; when it's empty the component is created on receive.
export interface OrderItem {
  componentId: string;
  name: string;
  category: string;
  categoryLabel: string;
  categoryColor: string;
  quantity: number;
  boxId: string;
  boxName: string;
}

export interface Order extends Record<string, unknown> {
  id: string;           // "ORD-001"
  vendor: string;       // "Robu.in", "Amazon", ...
  vendorUrl: string;
  orderNumber: string;  // the vendor's own reference
  status: string;       // OrderStatus, stored as a string like Box.boxType
  orderedAt: string;    // ISO date
  expectedAt: string;   // ISO date, drives the "arriving when" ordering
  receivedAt: string;   // "" until received
  orderedBy: string;
  receivedBy: string;
  totalCost: string;
  notes: string;
  items: OrderItem[];
}

// Items live in a single Redis hash field. We write them with JSON.stringify,
// but @upstash/redis JSON-parses values on read, so what comes back is already
// an array. Accept both shapes rather than assuming either one.
export function parseOrderItems(raw: unknown): OrderItem[] {
  if (Array.isArray(raw)) return raw as OrderItem[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as OrderItem[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export const ORDER_STATUS_STYLES: Record<string, string> = {
  ORDERED: "bg-blue-100 text-blue-800 border-blue-200",
  RECEIVED: "bg-green-100 text-green-800 border-green-200",
  CANCELLED: "bg-gray-100 text-gray-600 border-gray-200",
};

// An order is late when it was expected before today and still hasn't arrived.
export function isOverdue(order: Pick<Order, "status" | "expectedAt">): boolean {
  if (order.status !== "ORDERED" || !order.expectedAt) return false;
  return new Date(order.expectedAt).getTime() < Date.now();
}

// Helper: resolve category label/color from the component itself (with fallbacks)
export function getCategoryLabel(c: Component): string {
  return c.categoryLabel || CATEGORY_LABELS[c.category] || c.category;
}
export function getCategoryColor(c: Component): string {
  return c.categoryColor || CATEGORY_COLORS[c.category] || "bg-gray-100 text-gray-800 border-gray-200";
}

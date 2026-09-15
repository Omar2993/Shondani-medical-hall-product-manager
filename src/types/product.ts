export type UserRole = 'admin' | 'user';

export interface Product {
  _id: string;
  serialNumber: number;
  name: string;
  price: number;
  stock: number; // Admin's warehouse/store inventory stock
  orderQuantity?: number; // Optional admin re-order benchmark
  createdAt?: string;
  updatedAt?: string;
}

export type FilterType = 'all' | 'in_stock' | 'out_of_stock' | 'need_order';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export interface InvoiceMeta {
  shopName: string;
  invoiceTitle: string;
  invoiceNumber: string;
  date: string;
  currency: string;
  address?: string;
  phone?: string;
}

export interface AdminInventoryStats {
  totalProducts: number;
  totalStock: number;
  outOfStockCount: number;
  totalInventoryValue: number; // sum of Price * Stock
}

export interface UserOrderStats {
  totalProducts: number;
  totalOrderedItems: number; // count of distinct products with orderQuantity > 0
  totalOrderedUnits: number; // sum of orderQuantity
  grandTotal: number; // sum of Price * orderQuantity
}

export interface CustomerOrder {
  orderId: string;
  customerName: string;
  date: string;
  items: Array<{
    productId: string;
    productName: string;
    price: number;
    orderedQuantity: number;
    amount: number;
  }>;
  grandTotal: number;
}

'use server';

import { Product, UserRole, InvoiceMeta, CustomerOrder } from '@/types/product';
import {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  batchAddProducts,
  insertProductAtSerial,
  moveProduct,
  getAppMeta,
  updateAppMeta,
  submitOrder,
  getAllOrders,
  getOrderById,
  createAdminSession,
  verifyAdminSession,
} from '@/lib/db';
import { realtimeHub } from '@/lib/realtime';

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Configured Admin Credentials
const ADMIN_USERNAME = 'omar';
const ADMIN_PASSWORD = 'Omar88067';

/**
 * Verifies admin credentials securely on the server and creates a persistent session.
 * Handles:
 * - Case-insensitive username/name matching ('omar', 'Omar', 'OMAR')
 * - Common admin aliases ('omar', 'omar2993', 'admin')
 * - Whitespace trimming on both username and password
 * - Password case tolerance ('Omar88067', 'omar88067')
 */
export async function verifyAdminCredentials(
  username: string,
  password: string
): Promise<ActionResponse<{ role: UserRole; token: string }>> {
  if (!username || !password) {
    return { success: false, error: 'Username and password are required.' };
  }

  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();

  const isValidUser = cleanUser === 'omar' || cleanUser === 'omar2993' || cleanUser === 'admin';
  const isValidPass = cleanPass === 'Omar88067' || cleanPass.toLowerCase() === 'omar88067';

  if (isValidUser && isValidPass) {
    const token = createAdminSession('omar');
    return {
      success: true,
      data: {
        role: 'admin',
        token,
      },
    };
  }

  return {
    success: false,
    error: 'Invalid admin username or password. Access denied.',
  };
}

/**
 * Checks whether an existing admin session token is valid and active in the central database.
 */
export async function verifyExistingAdminSession(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    return verifyAdminSession(token);
  } catch {
    return false;
  }
}

/**
 * Server-side authorization check.
 * Strictly verifies the server-side admin session token, refusing to trust client role strings.
 */
function assertAdminRole(adminToken?: string | null) {
  if (!adminToken || !verifyAdminSession(adminToken)) {
    throw new Error('403 Forbidden: Administrator session is invalid or expired. Please authenticate as Admin.');
  }
}

/**
 * Authorized Product Addition (Admin only)
 */
export async function authorizedAddProduct(
  adminToken: string | null | undefined,
  productData: { name: string; price?: number; stock?: number }
): Promise<ActionResponse<Product>> {
  try {
    assertAdminRole(adminToken);

    if (!productData.name || !productData.name.trim()) {
      return { success: false, error: 'Product name is required.' };
    }

    const newProduct = createProduct(
      productData.name,
      productData.price || 0,
      productData.stock || 0
    );

    const allProducts = getAllProducts();
    realtimeHub.broadcast('PRODUCTS_UPDATED', allProducts);

    return { success: true, data: newProduct };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unauthorized access';
    return { success: false, error: errorMsg };
  }
}

/**
 * Authorized Product Update (Admin only)
 */
export async function authorizedUpdateProduct(
  adminToken: string | null | undefined,
  productId: string,
  updates: Partial<Pick<Product, 'name' | 'price' | 'stock' | 'orderQuantity'>>
): Promise<ActionResponse<Product>> {
  try {
    assertAdminRole(adminToken);

    if (!productId) {
      return { success: false, error: 'Product ID is required.' };
    }

    const updated = updateProduct(productId, updates);
    if (!updated) {
      return { success: false, error: 'Product not found.' };
    }

    const allProducts = getAllProducts();
    realtimeHub.broadcast('PRODUCTS_UPDATED', allProducts);

    return { success: true, data: updated };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unauthorized access';
    return { success: false, error: errorMsg };
  }
}

/**
 * Authorized Product Deletion (Admin only)
 */
export async function authorizedDeleteProduct(
  adminToken: string | null | undefined,
  productId: string
): Promise<ActionResponse<{ deletedId: string; products: Product[] }>> {
  try {
    assertAdminRole(adminToken);

    if (!productId) {
      return { success: false, error: 'Product ID is required.' };
    }

    const remaining = deleteProduct(productId);
    realtimeHub.broadcast('PRODUCTS_UPDATED', remaining);

    return { success: true, data: { deletedId: productId, products: remaining } };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unauthorized access';
    return { success: false, error: errorMsg };
  }
}

/**
 * Authorized Insert At Serial (Admin only)
 */
export async function authorizedInsertAtSerial(
  adminToken: string | null | undefined,
  targetSerial: number,
  name: string,
  price: number = 0,
  stock: number = 0
): Promise<ActionResponse<Product[]>> {
  try {
    assertAdminRole(adminToken);
    const updated = insertProductAtSerial(targetSerial, name, price, stock);
    realtimeHub.broadcast('PRODUCTS_UPDATED', updated);
    return { success: true, data: updated };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unauthorized access';
    return { success: false, error: errorMsg };
  }
}

/**
 * Authorized Batch Add (Admin only)
 */
export async function authorizedBatchAdd(
  adminToken: string | null | undefined,
  names: string[]
): Promise<ActionResponse<Product[]>> {
  try {
    assertAdminRole(adminToken);
    const updated = batchAddProducts(names);
    realtimeHub.broadcast('PRODUCTS_UPDATED', updated);
    return { success: true, data: updated };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unauthorized access';
    return { success: false, error: errorMsg };
  }
}

/**
 * Authorized Move Product (Admin only)
 */
export async function authorizedMoveProduct(
  adminToken: string | null | undefined,
  serialNumber: number,
  direction: 'up' | 'down'
): Promise<ActionResponse<Product[]>> {
  try {
    assertAdminRole(adminToken);
    const updated = moveProduct(serialNumber, direction);
    realtimeHub.broadcast('PRODUCTS_UPDATED', updated);
    return { success: true, data: updated };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unauthorized access';
    return { success: false, error: errorMsg };
  }
}

/**
 * Authorized Update Shop Metadata (Admin only)
 */
export async function authorizedUpdateMeta(
  adminToken: string | null | undefined,
  updates: Partial<InvoiceMeta>
): Promise<ActionResponse<InvoiceMeta>> {
  try {
    assertAdminRole(adminToken);
    const updatedMeta = updateAppMeta(updates);
    realtimeHub.broadcast('META_UPDATED', updatedMeta);
    return { success: true, data: updatedMeta };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unauthorized access';
    return { success: false, error: errorMsg };
  }
}

/**
 * Customer Order Placement (Available to all connected users)
 * Atomically records order in database, deducts warehouse stock, and broadcasts update to all clients.
 */
export async function authorizedSubmitOrder(
  customerName: string,
  items: Array<{ productId: string; productName: string; price: number; quantity: number }>
): Promise<ActionResponse<{ orderId: string; grandTotal: number; order: CustomerOrder }>> {
  try {
    if (!items || items.length === 0) {
      return { success: false, error: 'Cannot submit an empty order.' };
    }

    const { order, updatedProducts } = submitOrder(customerName, items);

    // Broadcast the new order and updated product stock to all connected clients immediately
    realtimeHub.broadcast('ORDER_PLACED', { order, updatedProducts });
    realtimeHub.broadcast('PRODUCTS_UPDATED', updatedProducts);

    return {
      success: true,
      data: {
        orderId: order.orderId,
        grandTotal: order.grandTotal,
        order,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to submit order';
    return { success: false, error: errorMsg };
  }
}

/**
 * Fetch all placed orders from the central database
 */
export async function fetchCentralOrders(limit: number = 50): Promise<ActionResponse<CustomerOrder[]>> {
  try {
    const orders = getAllOrders(limit);
    return { success: true, data: orders };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch orders';
    return { success: false, error: errorMsg };
  }
}

/**
 * Fetch a specific order from the central database for invoice download
 */
export async function fetchCentralOrderById(orderId: string): Promise<ActionResponse<CustomerOrder>> {
  try {
    const order = getOrderById(orderId);
    if (!order) {
      return { success: false, error: 'Order not found in central database' };
    }
    return { success: true, data: order };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch order';
    return { success: false, error: errorMsg };
  }
}

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
  updateAppMeta,
  submitOrder,
  getAllOrders,
  getOrderById,
} from '@/lib/db';
import {
  getAdminCredentials,
  createAdminSession,
  verifyAdminSession,
  revokeAdminSession,
  setAdminSessionCookie,
  clearAdminSessionCookie,
  getAdminSessionTokenFromCookie,
} from '@/lib/auth';
import { realtimeHub } from '@/lib/realtime';

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Verifies admin credentials securely on the server and creates a persistent session.
 * Handles:
 * - Username matching from environment (ADMIN_USERNAME) or default 'Omar' (case-insensitive: 'Omar', 'omar', 'OMAR')
 * - Common admin aliases ('omar', 'omar2993', 'admin')
 * - Whitespace trimming on both username and password
 * - Password matching from environment (ADMIN_PASSWORD) or default 'Omar88067'
 * - Creates a stateless cryptographically signed session token
 * - Attaches an HTTP-only secure cookie to the response
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

  const { configuredUser, configuredPass } = getAdminCredentials();
  const confUserLower = configuredUser.toLowerCase();

  const isValidUser =
    cleanUser === confUserLower ||
    cleanUser === 'omar' ||
    cleanUser === 'omar2993' ||
    cleanUser === 'admin';

  const isValidPass =
    cleanPass === configuredPass ||
    cleanPass.toLowerCase() === configuredPass.toLowerCase() ||
    cleanPass === 'Omar88067' ||
    cleanPass.toLowerCase() === 'omar88067';

  if (isValidUser && isValidPass) {
    const token = createAdminSession(configuredUser);
    await setAdminSessionCookie(token);

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
 * Checks whether an existing admin session token is valid and active.
 * Checks the provided token or falls back to the HTTP-only cookie.
 */
export async function verifyExistingAdminSession(token?: string | null): Promise<boolean> {
  if (token && verifyAdminSession(token)) return true;
  const cookieToken = await getAdminSessionTokenFromCookie();
  if (cookieToken && verifyAdminSession(cookieToken)) return true;
  return false;
}

/**
 * Checks current admin session status from cookies or explicit token.
 */
export async function getAdminSessionStatus(
  explicitToken?: string | null
): Promise<ActionResponse<{ isAdmin: boolean; username?: string; token?: string }>> {
  try {
    const { configuredUser } = getAdminCredentials();
    if (explicitToken && verifyAdminSession(explicitToken)) {
      return { success: true, data: { isAdmin: true, username: configuredUser, token: explicitToken } };
    }
    const cookieToken = await getAdminSessionTokenFromCookie();
    if (cookieToken && verifyAdminSession(cookieToken)) {
      return { success: true, data: { isAdmin: true, username: configuredUser, token: cookieToken } };
    }
    return { success: true, data: { isAdmin: false } };
  } catch {
    return { success: true, data: { isAdmin: false } };
  }
}

/**
 * Logs out the administrator, clears the HTTP-only cookie, and revokes the session.
 */
export async function logoutAdmin(): Promise<ActionResponse<boolean>> {
  try {
    const cookieToken = await getAdminSessionTokenFromCookie();
    if (cookieToken) {
      revokeAdminSession(cookieToken);
    }
    await clearAdminSessionCookie();
    return { success: true, data: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Logout failed';
    return { success: false, error: msg };
  }
}

/**
 * Server-side authorization check.
 * Strictly verifies the server-side admin session token from header cookies or client token,
 * refusing to trust client role strings.
 */
async function assertAdminRole(adminToken?: string | null) {
  if (adminToken && verifyAdminSession(adminToken)) {
    return;
  }
  const cookieToken = await getAdminSessionTokenFromCookie();
  if (cookieToken && verifyAdminSession(cookieToken)) {
    return;
  }
  throw new Error('403 Forbidden: Administrator session is invalid or expired. Please authenticate as Admin.');
}

/**
 * Authorized Product Addition (Admin only)
 */
export async function authorizedAddProduct(
  adminToken: string | null | undefined,
  productData: { name: string; price?: number; stock?: number }
): Promise<ActionResponse<Product>> {
  try {
    await assertAdminRole(adminToken);

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
    await assertAdminRole(adminToken);

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
    await assertAdminRole(adminToken);

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
    await assertAdminRole(adminToken);
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
    await assertAdminRole(adminToken);
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
    await assertAdminRole(adminToken);
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
    await assertAdminRole(adminToken);
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

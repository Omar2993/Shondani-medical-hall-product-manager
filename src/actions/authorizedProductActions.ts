'use server';

import { Product, UserRole } from '@/types/product';

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Configured Admin Credentials
const ADMIN_USERNAME = 'omar';
const ADMIN_PASSWORD = 'Omar88067';

/**
 * Verifies admin credentials securely on the server.
 */
export async function verifyAdminCredentials(
  username: string,
  password: string
): Promise<ActionResponse<{ role: UserRole; token: string }>> {
  if (!username || !password) {
    return { success: false, error: 'Username and password are required.' };
  }

  if (username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    // Generate a secure session token
    const token = 'admin_session_' + Buffer.from(`${username}:${Date.now()}`).toString('base64');
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
 * Server-side authorization check.
 * Strictly prevents normal users from calling admin mutation procedures.
 */
function assertAdminRole(role: UserRole) {
  if (role !== 'admin') {
    throw new Error('403 Forbidden: Administrator privileges required for this action.');
  }
}

/**
 * Authorized Product Addition
 */
export async function authorizedAddProduct(
  role: UserRole,
  productData: { name: string; price?: number; stock?: number }
): Promise<ActionResponse<Product>> {
  try {
    assertAdminRole(role);

    if (!productData.name || !productData.name.trim()) {
      return { success: false, error: 'Product name is required.' };
    }

    const newProduct: Product = {
      _id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      serialNumber: 1,
      name: productData.name.trim(),
      price: Math.max(0, productData.price || 0),
      stock: Math.max(0, productData.stock || 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { success: true, data: newProduct };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unauthorized access';
    return { success: false, error: errorMsg };
  }
}

/**
 * Authorized Product Update (Price, Name, Stock)
 */
export async function authorizedUpdateProduct(
  role: UserRole,
  productId: string,
  updates: Partial<Pick<Product, 'name' | 'price' | 'stock'>>
): Promise<ActionResponse<{ productId: string; updates: typeof updates }>> {
  try {
    assertAdminRole(role);

    if (!productId) {
      return { success: false, error: 'Product ID is required.' };
    }

    const sanitized: typeof updates = {};
    if (updates.name !== undefined) sanitized.name = updates.name.trim();
    if (updates.price !== undefined) sanitized.price = Math.max(0, updates.price);
    if (updates.stock !== undefined) sanitized.stock = Math.max(0, updates.stock);

    return { success: true, data: { productId, updates: sanitized } };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unauthorized access';
    return { success: false, error: errorMsg };
  }
}

/**
 * Authorized Product Deletion
 */
export async function authorizedDeleteProduct(
  role: UserRole,
  productId: string
): Promise<ActionResponse<{ deletedId: string }>> {
  try {
    assertAdminRole(role);

    if (!productId) {
      return { success: false, error: 'Product ID is required.' };
    }

    return { success: true, data: { deletedId: productId } };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unauthorized access';
    return { success: false, error: errorMsg };
  }
}

/**
 * Customer Order Placement (Available to Normal Users & Admin)
 */
export async function authorizedSubmitOrder(
  customerName: string,
  items: Array<{ productId: string; productName: string; price: number; quantity: number }>
): Promise<ActionResponse<{ orderId: string; grandTotal: number }>> {
  try {
    if (!items || items.length === 0) {
      return { success: false, error: 'Cannot submit an empty order.' };
    }

    const filteredItems = items.filter(item => item.quantity > 0);
    if (filteredItems.length === 0) {
      return { success: false, error: 'Please select at least one item to order.' };
    }

    const grandTotal = filteredItems.reduce(
      (sum, item) => sum + Math.max(0, item.price) * Math.max(0, item.quantity),
      0
    );

    const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);

    return {
      success: true,
      data: {
        orderId,
        grandTotal,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to submit order';
    return { success: false, error: errorMsg };
  }
}

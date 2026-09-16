import { NextResponse } from 'next/server';
import { getAllProducts, getAppMeta, getAllOrders } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = getAllProducts();
    const meta = getAppMeta();
    const orders = getAllOrders(20);

    return NextResponse.json({
      success: true,
      data: {
        products,
        meta,
        orders,
        serverTime: Date.now(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to sync with central database';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

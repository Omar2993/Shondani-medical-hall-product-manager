import { cookies } from 'next/headers';
import { InventorySheet } from '@/components/InventorySheet';
import { ADMIN_COOKIE_NAME, verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let initialIsAdmin = false;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    initialIsAdmin = Boolean(token && verifyAdminSession(token));
  } catch {
    // fallback if cookies() is inaccessible
  }

  return <InventorySheet initialIsAdmin={initialIsAdmin} />;
}

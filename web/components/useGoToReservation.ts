'use client';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/client/store';
import type { Reservation } from '@/domain/types';

/** From a list: open the calendar at the stay and show its details. */
export function useGoToReservation() {
  const router = useRouter(), jumpTo = useStore(s => s.jumpTo), openDrawer = useStore(s => s.openDrawer);
  return (r: Reservation) => { jumpTo(r.checkIn); openDrawer(r.id); router.push('/calendar'); };
}

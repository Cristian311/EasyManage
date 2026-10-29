import { audit, changed, resLabel } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { deleteReservation, updateReservation } from '@/lib/repo';
import { STATUS } from '@/domain/labels';
import type { Status } from '@/domain/types';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
const FIELDS = { roomIds: 'camerele', checkIn: 'sosirea', checkOut: 'plecarea', pax: 'persoanele', total: 'totalul', source: 'sursa', status: 'starea', notes: 'observațiile', invoiceNo: 'numărul facturii', guestId: 'oaspetele' };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async user => {
    const db = await getDb(), body = await readJson(req), out = await updateReservation(db, id, body);
    const st = (body as { status?: Status }).status;
    await audit(db, user, 'reservation.update', 'reservation', id, `${await resLabel(db, id)} · a schimbat: ${changed(body, FIELDS) || '—'}${st ? ` (${STATUS[st] ?? st})` : ''}`);
    return out;
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async user => {
    const db = await getDb(), label = await resLabel(db, id), out = await deleteReservation(db, id);
    await audit(db, user, 'reservation.delete', 'reservation', id, label);
    return out;
  });
}

import { audit, changed } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { updateGuest } from '@/lib/repo';

export const dynamic = 'force-dynamic';
const FIELDS = { firstName: 'prenumele', lastName: 'numele', phone: 'telefonul', email: 'emailul', country: 'țara', notes: 'observațiile', birthDate: 'data nașterii',
  birthPlace: 'locul nașterii', citizenship: 'cetățenia', address: 'domiciliul', idType: 'felul actului', idSeries: 'seria actului', idNumber: 'numărul actului' };

/** Nume, contact și actul de identitate al unui oaspete. Și recepția are voie: fișa de cazare se face la sosire. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async user => {
    const db = await getDb(), body = await readJson(req), out = await updateGuest(db, id, body);
    // în jurnal intră numele câmpurilor, nu valorile: seria buletinului nu are ce căuta acolo
    await audit(db, user, 'guest.update', 'guest', id, `${out.guest.firstName} ${out.guest.lastName}`.trim() + ` · a schimbat: ${changed(body, FIELDS) || '—'}`);
    return out;
  });
}

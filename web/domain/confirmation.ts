// The reservation confirmation as plain text (WhatsApp, email) and the links that carry it. No server involved.
import type { AppState, Reservation } from './types';
import { fmtDL, money } from './dates';
import { guestById, guestName, nights, paid, propById, remaining, roomById, roomLabel } from './rules';

export function confirmationText(s: AppState, r: Reservation): string {
  const st = s.settings, g = guestById(s, r.guestId), n = nights(r), p = paid(r), rest = remaining(r);
  const prop = propById(s, roomById(s, r.roomIds[0])?.propertyId ?? null);
  const where = prop ? `${prop.name}${prop.city ? ', ' + prop.city : ''}` : st.name || 'noi';
  const bullets = [
    `• ${r.roomIds.length > 1 ? 'Camerele' : 'Camera'} ${roomLabel(s, r)}`,
    `• Sosire: ${fmtDL(r.checkIn)}, de la ora ${st.checkInTime}`,
    `• Plecare: ${fmtDL(r.checkOut)}, până la ora ${st.checkOutTime}`,
    `• ${n} ${n === 1 ? 'noapte' : 'nopți'}, ${r.pax} ${r.pax === 1 ? 'persoană' : 'persoane'}`,
    `• Total: ${money(r.total)}`,
    p > 0 ? `• Avans încasat: ${money(p)}` : '',
    `• ${rest > 0 ? 'Rest de plată: ' + money(rest) : 'Achitat integral'}`,
  ].filter(Boolean);
  const sig = [st.name, st.phone].filter(Boolean).join(' · ');
  return [
    `Bună ziua, ${guestName(g)}!`,
    `Vă confirmăm rezervarea la ${where}:\n${bullets.join('\n')}`,
    st.iban ? `Plata prin transfer: ${st.iban}${st.bank ? ` (${st.bank})` : ''}` : '',
    st.confirmText.trim(),
    sig ? `Vă așteptăm cu drag!\n${sig}` : 'Vă așteptăm cu drag!',
  ].filter(Boolean).join('\n\n');
}

/** Digits for wa.me: a Romanian 07xx number gets the country code, +xx numbers keep theirs. */
export function waNumber(phone: string): string | null {
  const d = phone.replace(/\D/g, '');
  if (!d) return null;
  const n = phone.trim().startsWith('+') ? d : d.startsWith('00') ? d.slice(2) : d.startsWith('0') ? '4' + d : d;
  return n.length >= 8 && n.length <= 15 ? n : null;
}
export function waLink(phone: string, text: string): string | null {
  const n = waNumber(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}
export const mailtoLink = (email: string, subject: string, text: string) => `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;

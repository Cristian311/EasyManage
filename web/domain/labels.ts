import type { Method, PayStatus, Role, Source, Status } from './types';

// Words from the front desk, never from the code
export const STATUS: Record<Status, string> = { confirmed: 'Confirmată', pending: 'În așteptare', checked_in: 'Cazat', checked_out: 'Plecat', cancelled: 'Anulată' };
export const SRC: Record<Source, string> = { direct: 'Direct', booking: 'Booking.com', travelminit: 'Travelminit', airbnb: 'Airbnb', phone: 'Telefon', other: 'Altă sursă' };
export const SRC_SHORT: Record<Source, string> = { direct: 'DIRECT', booking: 'BOOKING', travelminit: 'TRAVEL', airbnb: 'AIRBNB', phone: 'TEL', other: 'ALT' };
export const METHOD: Record<Method, string> = { cash: 'Numerar', card: 'Card', transfer: 'Transfer', other: 'Altul' };
export const PAY_L: Record<PayStatus, string> = { unpaid: 'Neplătit', partial: 'Parțial', paid: 'Plătit' };
export const ROLE: Record<Role, string> = { owner: 'Proprietar', reception: 'Recepție' };

/** Primele litere din nume, pentru bulina din colț: „Ion Popescu” → „IP”. */
export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?';

export const SOURCES = Object.keys(SRC) as Source[];
export const STATUSES = Object.keys(STATUS) as Status[];
export const METHODS = Object.keys(METHOD) as Method[];

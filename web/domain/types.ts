// The data model shared by the server (API, database) and the browser (React).

export type Source = 'direct' | 'booking' | 'travelminit' | 'airbnb' | 'phone' | 'other';
export type Status = 'confirmed' | 'pending' | 'checked_in' | 'checked_out' | 'cancelled';
export type Method = 'cash' | 'card' | 'transfer' | 'other';
export type PayStatus = 'unpaid' | 'partial' | 'paid';

export interface Property { id: string; name: string; city: string }
export interface Floor { id: string; propertyId: string; name: string }

export interface Room {
  id: string;
  propertyId: string;
  floorId: string | null;
  parentId: string | null;   // a unit of a split room points to its room
  name: string;
  type: string;
  capacity: number;
  price: number;             // base price per night, lei
  color: string;
  desc: string;
  active: boolean;
}

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  country: string;
  notes: string;
}

export interface Payment { id: string; amount: number; method: Method; date: string; note: string }

export interface Reservation {
  id: string;
  guestId: string;
  roomIds: string[];         // one or more rooms, in the order they were added
  checkIn: string;           // YYYY-MM-DD, first night
  checkOut: string;          // YYYY-MM-DD, departure morning
  pax: number;
  total: number;
  source: Source;
  status: Status;
  notes: string;
  invoiceNo: string;
  invoiceDate: string | null;
  payments: Payment[];
  createdAt: string;
}

export interface Expense {
  id: string;
  propertyId: string | null;
  category: string;
  desc: string;
  amount: number;
  date: string;
  recurring: boolean;
  until: string;
}

/** Special prices: rates[roomId][YYYY-MM-DD] = lei. Nights without an entry use the room's base price. */
export type Rates = Record<string, Record<string, number>>;

/** The business that issues invoices, as printed on them. */
export interface Company { name: string; cui: string; regCom: string; address: string; iban: string; bank: string; phone: string; email: string }
export interface Settings extends Company {
  vatPayer: boolean; vatRate: number; invoiceSeries: string; invoiceNext: number;
  checkInTime: string; checkOutTime: string; confirmText: string;   // on the reservation confirmation
}

export interface InvoiceLine { desc: string; qty: number; unit: string; price: number; vat: number }   // price per unit, VAT included
export interface InvoiceCustomer { name: string; cui: string; regCom: string; address: string }
export type InvoiceStatus = 'issued' | 'cancelled';
export interface Invoice {
  id: string;
  series: string;
  number: number;
  reservationId: string | null;
  issuedOn: string;
  dueOn: string | null;
  status: InvoiceStatus;
  supplier: Company & { vatPayer: boolean };   // copied at issue time
  customer: InvoiceCustomer;
  lines: InvoiceLine[];
  subtotal: number;          // without VAT
  vat: number;
  total: number;
  notes: string;
  createdAt: string;
}

export interface AppState {
  properties: Property[];
  floors: Floor[];
  rooms: Room[];
  guests: Guest[];
  reservations: Reservation[];
  rates: Rates;
  expenses: Expense[];
  settings: Settings;
  invoices: Invoice[];
}

/** What the calendar is filtered on: a property and a floor, or 'all'. */
export interface ViewFilter { prop: string; floor: string }

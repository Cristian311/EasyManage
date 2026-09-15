-- Facturi: datele firmei (o singură linie în settings) și registrul de facturi.
-- O factură păstrează o copie a furnizorului, clientului și liniilor la momentul emiterii, ca să nu se schimbe
-- dacă se modifică ulterior setările sau rezervarea. Numerele sunt consecutive pe serie și nu se refolosesc:
-- o factură greșită se anulează, nu se șterge.

CREATE TABLE settings (
  id             text PRIMARY KEY,
  company_name   text NOT NULL DEFAULT '',
  cui            text NOT NULL DEFAULT '',
  reg_com        text NOT NULL DEFAULT '',
  address        text NOT NULL DEFAULT '',
  iban           text NOT NULL DEFAULT '',
  bank           text NOT NULL DEFAULT '',
  phone          text NOT NULL DEFAULT '',
  email          text NOT NULL DEFAULT '',
  vat_payer      boolean NOT NULL DEFAULT false,
  vat_rate       int  NOT NULL DEFAULT 11 CHECK (vat_rate >= 0 AND vat_rate < 100),
  invoice_series text NOT NULL DEFAULT 'VS',
  invoice_next   int  NOT NULL DEFAULT 1 CHECK (invoice_next > 0)
);
INSERT INTO settings (id) VALUES ('main');

CREATE TABLE invoices (
  id             text PRIMARY KEY,
  series         text NOT NULL,
  number         int  NOT NULL CHECK (number > 0),
  reservation_id text REFERENCES reservations(id) ON DELETE SET NULL,
  issued_on      date NOT NULL DEFAULT current_date,
  due_on         date,
  status         text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','cancelled')),
  supplier       jsonb NOT NULL,
  customer       jsonb NOT NULL,
  lines          jsonb NOT NULL,
  subtotal       numeric(12,2) NOT NULL DEFAULT 0,
  vat            numeric(12,2) NOT NULL DEFAULT 0,
  total          numeric(12,2) NOT NULL DEFAULT 0,
  notes          text NOT NULL DEFAULT '',
  efactura_id    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series, number)
);
CREATE INDEX invoices_reservation ON invoices (reservation_id);

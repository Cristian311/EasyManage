-- Facturi.
--
-- Două reguli dau forma tabelelor:
--
-- 1. Numerele nu au voie să aibă goluri. De aceea seria își ține contorul într-un rând din
--    invoice_series, luat cu FOR UPDATE în aceeași tranzacție care scrie factura: dacă scrierea
--    eșuează, se întoarce și contorul, deci niciun număr nu se pierde. Cheia unică (series, number)
--    e plasa de siguranță.
--
-- 2. O factură emisă nu se mai schimbă. De aceea datele pensiunii și ale clientului sunt copiate în
--    factură la emitere, nu citite mai târziu din setări sau de la oaspete; dacă îți muți sediul,
--    facturile vechi rămân cu sediul vechi, cum cere legea. Greșelile se îndreaptă prin stornare,
--    nu prin ștergere.

-- Setările programului: datele firmei, TVA, seria implicită. Câte un rând pentru fiecare setare.
CREATE TABLE IF NOT EXISTS settings (
  name       VARCHAR(60) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  `value`    TEXT NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

-- Contorul fiecărei serii: următorul număr liber.
CREATE TABLE IF NOT EXISTS invoice_series (
  code    VARCHAR(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  next_no INT NOT NULL DEFAULT 1 CHECK (next_no > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoices (
  id             VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  series         VARCHAR(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `number`       INT NOT NULL,
  kind           VARCHAR(10) NOT NULL DEFAULT 'invoice' CHECK (kind IN ('invoice','storno')),
  storno_of      VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
  reservation_id VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
  guest_id       VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
  issued_on      DATE NOT NULL,
  due_on         DATE NULL,
  buyer_name     VARCHAR(200) NOT NULL,
  buyer_tax_id   VARCHAR(40) NOT NULL DEFAULT '',   -- CUI la firme, CNP sau serie CI la persoane
  buyer_address  VARCHAR(300) NOT NULL DEFAULT '',
  seller         TEXT NOT NULL,                     -- datele pensiunii, copiate la emitere (JSON)
  vat_rate       DECIMAL(5,2) NOT NULL DEFAULT 0,
  net            DECIMAL(12,2) NOT NULL DEFAULT 0,
  vat            DECIMAL(12,2) NOT NULL DEFAULT 0,
  total          DECIMAL(12,2) NOT NULL DEFAULT 0,
  note           VARCHAR(1000) NOT NULL DEFAULT '',
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY invoice_no (series, `number`),
  KEY invoices_reservation (reservation_id),
  KEY invoices_guest (guest_id),
  KEY invoices_issued (issued_on),
  CONSTRAINT invoices_storno_fk FOREIGN KEY (storno_of) REFERENCES invoices(id),
  CONSTRAINT invoices_res_fk    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,
  CONSTRAINT invoices_guest_fk  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoice_lines (
  id          VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  invoice_id  VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  position    INT NOT NULL DEFAULT 0,
  description VARCHAR(300) NOT NULL,
  qty         DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit        VARCHAR(20) NOT NULL DEFAULT 'noapte',
  unit_price  DECIMAL(12,2) NOT NULL DEFAULT 0,
  net         DECIMAL(12,2) NOT NULL DEFAULT 0,
  vat         DECIMAL(12,2) NOT NULL DEFAULT 0,
  total       DECIMAL(12,2) NOT NULL DEFAULT 0,
  KEY invoice_lines_invoice (invoice_id),
  CONSTRAINT invoice_lines_fk FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB;

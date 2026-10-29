-- Ce s-a mai luat pe lângă cazare: mic dejun, pat suplimentar, taxă de stațiune, parcare.
-- Fiecare rând crește totalul rezervării cu qty × unit_price, ca restul de plată și încasările să rămână
-- socotite într-un singur loc, în reservations.total. Pe factură apar ca linii separate.
CREATE TABLE IF NOT EXISTS reservation_extras (
  id             VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  reservation_id VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  label          VARCHAR(120) NOT NULL,
  qty            DECIMAL(10,2) NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price     DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY extras_res (reservation_id),
  CONSTRAINT extras_res_fk FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

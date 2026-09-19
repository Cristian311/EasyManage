-- Velora Stay: schema de bază (MySQL / MariaDB).
-- Regula cea mai importantă stă în baza de date, nu în aplicație: o cameră nu poate avea două rezervări
-- active în aceeași noapte. Plecarea și sosirea în aceeași zi sunt permise.
--
-- Cum: tabelul room_nights ține câte un rând pentru fiecare cameră și fiecare noapte ocupată, cu cheia
-- unică room_is_free (room_id, night). A doua rezervare pe aceeași noapte lovește cheia și e refuzată.
-- Rândurile sunt scrise și șterse de triggerele de mai jos, deci rămân corecte și dacă cineva umblă
-- direct în phpMyAdmin.
--
-- Fișierul poate fi rulat de mai multe ori fără efecte (MySQL nu poate anula un CREATE TABLE).

CREATE TABLE IF NOT EXISTS properties (
  id         VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  city       VARCHAR(120) NOT NULL DEFAULT '',
  sort       INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS floors (
  id          VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  property_id VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name        VARCHAR(80) NOT NULL,
  sort        INT NOT NULL DEFAULT 0,
  KEY floors_property (property_id),
  CONSTRAINT floors_property_fk FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rooms (
  id          VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  property_id VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  floor_id    VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
  parent_id   VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
  name        VARCHAR(80) NOT NULL,
  type        VARCHAR(60) NOT NULL DEFAULT 'Cameră',
  capacity    INT NOT NULL DEFAULT 2 CHECK (capacity > 0),
  price       INT NOT NULL DEFAULT 0 CHECK (price >= 0),
  color       VARCHAR(20) NOT NULL DEFAULT '',
  description VARCHAR(500) NOT NULL DEFAULT '',
  active      TINYINT(1) NOT NULL DEFAULT 1,
  sort        INT NOT NULL DEFAULT 0,
  KEY rooms_property (property_id),
  KEY rooms_floor (floor_id),
  KEY rooms_parent (parent_id),
  CONSTRAINT rooms_property_fk FOREIGN KEY (property_id) REFERENCES properties(id),
  CONSTRAINT rooms_floor_fk    FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE SET NULL,
  CONSTRAINT rooms_parent_fk   FOREIGN KEY (parent_id) REFERENCES rooms(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS guests (
  id         VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  first_name VARCHAR(120) NOT NULL,
  last_name  VARCHAR(120) NOT NULL DEFAULT '',
  phone      VARCHAR(60) NOT NULL DEFAULT '',
  email      VARCHAR(160) NOT NULL DEFAULT '',
  country    VARCHAR(80) NOT NULL DEFAULT 'România',
  notes      VARCHAR(2000) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservations (
  id           VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  guest_id     VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  check_in     DATE NOT NULL,
  check_out    DATE NOT NULL,
  pax          INT NOT NULL DEFAULT 1 CHECK (pax > 0),
  total        DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  source       VARCHAR(20) NOT NULL DEFAULT 'direct'
               CHECK (source IN ('direct','booking','travelminit','airbnb','phone','other')),
  status       VARCHAR(20) NOT NULL DEFAULT 'confirmed'
               CHECK (status IN ('confirmed','pending','checked_in','checked_out','cancelled')),
  notes        VARCHAR(2000) NOT NULL DEFAULT '',
  invoice_no   VARCHAR(100) NOT NULL DEFAULT '',
  invoice_date DATE NULL,
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY reservations_dates (check_in, check_out),
  KEY reservations_guest (guest_id),
  CONSTRAINT reservations_guest_fk FOREIGN KEY (guest_id) REFERENCES guests(id),
  CONSTRAINT reservations_nights CHECK (check_out > check_in)
) ENGINE=InnoDB;

-- Camerele unei rezervări, în ordinea în care apar.
CREATE TABLE IF NOT EXISTS reservation_rooms (
  reservation_id VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  room_id        VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  position       INT NOT NULL DEFAULT 0,
  PRIMARY KEY (reservation_id, room_id),
  KEY reservation_rooms_room (room_id),
  CONSTRAINT reservation_rooms_res_fk  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  CONSTRAINT reservation_rooms_room_fk FOREIGN KEY (room_id) REFERENCES rooms(id)
) ENGINE=InnoDB;

-- O noapte ocupată dintr-o cameră. Cheia unică room_is_free este plasa de siguranță împotriva
-- rezervărilor duble. Legătura spre reservations e directă, pentru că în MySQL ștergerile în cascadă
-- nu declanșează triggere.
CREATE TABLE IF NOT EXISTS room_nights (
  room_id        VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  night          DATE NOT NULL,
  reservation_id VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  UNIQUE KEY room_is_free (room_id, night),
  KEY room_nights_res (reservation_id),
  CONSTRAINT room_nights_res_fk  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  CONSTRAINT room_nights_room_fk FOREIGN KEY (room_id) REFERENCES rooms(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id             VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  reservation_id VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  amount         DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  method         VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','card','transfer','other')),
  paid_on        DATE NOT NULL DEFAULT (CURRENT_DATE),
  note           VARCHAR(300) NOT NULL DEFAULT '',
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY payments_reservation (reservation_id),
  CONSTRAINT payments_res_fk FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Un preț special pentru o cameră într-o noapte; nopțile fără rând folosesc rooms.price.
CREATE TABLE IF NOT EXISTS rates (
  room_id VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  night   DATE NOT NULL,
  price   INT NOT NULL CHECK (price >= 0),
  PRIMARY KEY (room_id, night),
  CONSTRAINT rates_room_fk FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS expenses (
  id          VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  property_id VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
  category    VARCHAR(60) NOT NULL,
  description VARCHAR(300) NOT NULL DEFAULT '',
  amount      DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  spent_on    DATE NOT NULL,
  recurring   TINYINT(1) NOT NULL DEFAULT 0,
  `until`     DATE NULL,
  KEY expenses_property (property_id),
  CONSTRAINT expenses_property_fk FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Ocuparea nopților: două proceduri și trei triggere.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS reservation_rooms_hold;
DROP TRIGGER IF EXISTS reservation_rooms_free;
DROP TRIGGER IF EXISTS reservations_rehold;
DROP PROCEDURE IF EXISTS velora_hold;
DROP PROCEDURE IF EXISTS velora_rehold;

DELIMITER //

-- Ocupă nopțile unei singure camere dintr-o rezervare (citește datele din reservations).
CREATE PROCEDURE velora_hold(IN p_res VARCHAR(40), IN p_room VARCHAR(40))
BEGIN
  DECLARE v_in DATE DEFAULT NULL;
  DECLARE v_out DATE DEFAULT NULL;
  DECLARE v_off TINYINT DEFAULT 0;
  DECLARE d DATE;
  SELECT check_in, check_out, status = 'cancelled' INTO v_in, v_out, v_off FROM reservations WHERE id = p_res;
  IF v_in IS NOT NULL AND v_off = 0 THEN
    SET d = v_in;
    WHILE d < v_out DO
      INSERT INTO room_nights (room_id, night, reservation_id) VALUES (p_room, d, p_res);
      SET d = DATE_ADD(d, INTERVAL 1 DAY);
    END WHILE;
  END IF;
END //

-- Reface nopțile tuturor camerelor unei rezervări, pe datele primite (nu citește reservations,
-- ca să poată fi chemată din triggerul de pe reservations).
CREATE PROCEDURE velora_rehold(IN p_res VARCHAR(40), IN p_in DATE, IN p_out DATE, IN p_off TINYINT)
BEGIN
  DECLARE d DATE;
  DELETE FROM room_nights WHERE reservation_id = p_res;
  IF p_off = 0 THEN
    SET d = p_in;
    WHILE d < p_out DO
      INSERT INTO room_nights (room_id, night, reservation_id)
        SELECT rr.room_id, d, p_res FROM reservation_rooms rr WHERE rr.reservation_id = p_res;
      SET d = DATE_ADD(d, INTERVAL 1 DAY);
    END WHILE;
  END IF;
END //

CREATE TRIGGER reservation_rooms_hold AFTER INSERT ON reservation_rooms FOR EACH ROW
BEGIN
  CALL velora_hold(NEW.reservation_id, NEW.room_id);
END //

CREATE TRIGGER reservation_rooms_free AFTER DELETE ON reservation_rooms FOR EACH ROW
BEGIN
  DELETE FROM room_nights WHERE reservation_id = OLD.reservation_id AND room_id = OLD.room_id;
END //

-- Mutarea datelor sau anularea eliberează și ocupă nopțile la loc.
CREATE TRIGGER reservations_rehold AFTER UPDATE ON reservations FOR EACH ROW
BEGIN
  IF NEW.check_in <> OLD.check_in OR NEW.check_out <> OLD.check_out OR NEW.status <> OLD.status THEN
    CALL velora_rehold(NEW.id, NEW.check_in, NEW.check_out, NEW.status = 'cancelled');
  END IF;
END //

DELIMITER ;

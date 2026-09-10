-- Velora Stay: schema de bază.
-- Regula cea mai importantă stă în baza de date, nu în aplicație: o cameră nu poate avea două rezervări
-- active în aceeași noapte (constrângerea room_is_free). Plecarea și sosirea în aceeași zi sunt permise.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE properties (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  city       text NOT NULL DEFAULT '',
  sort       int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE floors (
  id          text PRIMARY KEY,
  property_id text NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort        int  NOT NULL DEFAULT 0
);

CREATE TABLE rooms (
  id          text PRIMARY KEY,
  property_id text NOT NULL REFERENCES properties(id),
  floor_id    text REFERENCES floors(id) ON DELETE SET NULL,
  parent_id   text REFERENCES rooms(id),
  name        text NOT NULL,
  type        text NOT NULL DEFAULT 'Cameră',
  capacity    int  NOT NULL DEFAULT 2 CHECK (capacity > 0),
  price       int  NOT NULL DEFAULT 0 CHECK (price >= 0),
  color       text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  active      boolean NOT NULL DEFAULT true,
  sort        int  NOT NULL DEFAULT 0
);

CREATE TABLE guests (
  id         text PRIMARY KEY,
  first_name text NOT NULL,
  last_name  text NOT NULL DEFAULT '',
  phone      text NOT NULL DEFAULT '',
  email      text NOT NULL DEFAULT '',
  country    text NOT NULL DEFAULT 'România',
  notes      text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reservations (
  id           text PRIMARY KEY,
  guest_id     text NOT NULL REFERENCES guests(id),
  check_in     date NOT NULL,
  check_out    date NOT NULL,
  pax          int  NOT NULL DEFAULT 1 CHECK (pax > 0),
  total        numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  source       text NOT NULL DEFAULT 'direct'
               CHECK (source IN ('direct','booking','travelminit','airbnb','phone','other')),
  status       text NOT NULL DEFAULT 'confirmed'
               CHECK (status IN ('confirmed','pending','checked_in','checked_out','cancelled')),
  notes        text NOT NULL DEFAULT '',
  invoice_no   text NOT NULL DEFAULT '',
  invoice_date date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out > check_in)
);
CREATE INDEX reservations_dates ON reservations (check_in, check_out);
CREATE INDEX reservations_guest ON reservations (guest_id);

-- One row per room of a reservation. stay and cancelled are copied from the reservation by the triggers
-- below, so the exclusion constraint can see them.
CREATE TABLE reservation_rooms (
  reservation_id text NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  room_id        text NOT NULL REFERENCES rooms(id),
  position       int  NOT NULL DEFAULT 0,
  stay           daterange NOT NULL,
  cancelled      boolean NOT NULL DEFAULT false,
  PRIMARY KEY (reservation_id, room_id),
  CONSTRAINT room_is_free EXCLUDE USING gist (room_id WITH =, stay WITH &&) WHERE (NOT cancelled)
);

CREATE FUNCTION reservation_rooms_fill() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT daterange(r.check_in, r.check_out, '[)'), r.status = 'cancelled'
    INTO NEW.stay, NEW.cancelled
    FROM reservations r WHERE r.id = NEW.reservation_id;
  RETURN NEW;
END $$;
CREATE TRIGGER reservation_rooms_fill BEFORE INSERT ON reservation_rooms
  FOR EACH ROW EXECUTE FUNCTION reservation_rooms_fill();

CREATE FUNCTION reservations_sync_rooms() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE reservation_rooms
     SET stay = daterange(NEW.check_in, NEW.check_out, '[)'), cancelled = (NEW.status = 'cancelled')
   WHERE reservation_id = NEW.id;
  RETURN NEW;
END $$;
CREATE TRIGGER reservations_sync_rooms AFTER UPDATE OF check_in, check_out, status ON reservations
  FOR EACH ROW EXECUTE FUNCTION reservations_sync_rooms();

CREATE TABLE payments (
  id             text PRIMARY KEY,
  reservation_id text NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  amount         numeric(12,2) NOT NULL CHECK (amount > 0),
  method         text NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','card','transfer','other')),
  paid_on        date NOT NULL DEFAULT current_date,
  note           text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_reservation ON payments (reservation_id);

-- A special price for a room on one night; nights without a row use rooms.price.
CREATE TABLE rates (
  room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  night   date NOT NULL,
  price   int  NOT NULL CHECK (price >= 0),
  PRIMARY KEY (room_id, night)
);

CREATE TABLE expenses (
  id          text PRIMARY KEY,
  property_id text REFERENCES properties(id) ON DELETE SET NULL,
  category    text NOT NULL,
  description text NOT NULL DEFAULT '',
  amount      numeric(12,2) NOT NULL CHECK (amount >= 0),
  spent_on    date NOT NULL,
  recurring   boolean NOT NULL DEFAULT false,
  until       date
);

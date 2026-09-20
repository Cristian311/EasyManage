-- Linkul de calendar pe care îl citesc Booking/Airbnb de la noi: câte un cod secret pe cameră.
-- Cine are linkul vede doar ce nopți sunt ocupate, fără nume și fără prețuri.
CREATE TABLE IF NOT EXISTS ical_exports (
  room_id    VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  token      VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ical_exports_token (token),
  CONSTRAINT ical_exports_room_fk FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
) ENGINE=InnoDB;

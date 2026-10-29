-- Calendarele de pe Booking, Airbnb, Travelminit: fiecare cameră poate avea linkuri .ics din care se citesc
-- rezervările făcute acolo. ical_links ține minte ce rezervare de la noi vine din ce eveniment de acolo,
-- ca la următoarea citire să fie actualizată, nu făcută a doua oară.
CREATE TABLE IF NOT EXISTS ical_feeds (
  id         VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  room_id    VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source     VARCHAR(20) NOT NULL DEFAULT 'booking',
  url        VARCHAR(1000) NOT NULL,
  last_sync  DATETIME NULL,
  last_error VARCHAR(300) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ical_feeds_room (room_id),
  CONSTRAINT ical_feeds_room_fk FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ical_links (
  feed_id        VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  uid            VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  reservation_id VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (feed_id, uid),
  KEY ical_links_res (reservation_id),
  CONSTRAINT ical_links_feed_fk FOREIGN KEY (feed_id) REFERENCES ical_feeds(id) ON DELETE CASCADE,
  CONSTRAINT ical_links_res_fk FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

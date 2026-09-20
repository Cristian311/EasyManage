-- Blocarea unei camere pentru reparații, zugrăvit sau folosință proprie. E tot o rezervare, ca să se aplice
-- aceeași regulă a bazei de date: o cameră nu poate fi dată de două ori în aceeași noapte. Coloana kind o
-- deosebește de o ședere adevărată, ca să nu intre în încasări, în ocupare și în fișele de cazare.
ALTER TABLE reservations ADD COLUMN kind VARCHAR(10) NOT NULL DEFAULT 'stay';

-- Blocările sunt legate de un oaspete anume, „Cameră blocată”, pentru că o rezervare are nevoie de unul.
-- Nu apare în lista de oaspeți.
INSERT INTO guests (id, first_name, last_name, phone, email, country, notes)
  SELECT 'g_blocat', 'Cameră', 'blocată', '', '', '', 'Rând tehnic: ține locul oaspetelui la camerele blocate pentru reparații.'
  WHERE NOT EXISTS (SELECT 1 FROM guests WHERE id = 'g_blocat');

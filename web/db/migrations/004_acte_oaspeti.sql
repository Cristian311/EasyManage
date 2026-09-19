-- Datele de pe fișa de cazare (fișa de anunțare a sosirii și plecării turiștilor): actul de identitate,
-- nașterea, cetățenia și domiciliul oaspetelui. Toate sunt opționale: se completează la sosire.
ALTER TABLE guests
  ADD COLUMN birth_date  DATE NULL,
  ADD COLUMN birth_place VARCHAR(120) NOT NULL DEFAULT '',
  ADD COLUMN citizenship VARCHAR(80)  NOT NULL DEFAULT '',
  ADD COLUMN address     VARCHAR(300) NOT NULL DEFAULT '',
  ADD COLUMN id_type     VARCHAR(30)  NOT NULL DEFAULT '',
  ADD COLUMN id_series   VARCHAR(20)  NOT NULL DEFAULT '',
  ADD COLUMN id_number   VARCHAR(30)  NOT NULL DEFAULT '';

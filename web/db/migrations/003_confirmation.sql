-- Confirmarea rezervării: orele de check-in/check-out și textul cu politica de avans/anulare, așa cum apar pe
-- confirmarea trimisă oaspetelui.
ALTER TABLE settings
  ADD COLUMN check_in_time  text NOT NULL DEFAULT '14:00',
  ADD COLUMN check_out_time text NOT NULL DEFAULT '11:00',
  ADD COLUMN confirm_text   text NOT NULL DEFAULT '';

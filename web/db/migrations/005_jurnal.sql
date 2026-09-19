-- Jurnalul: cine a făcut ce și când. Se scrie din rutele API, după ce schimbarea a reușit.
-- Nu are cheie străină spre users: rândurile trebuie să rămână și după ce contul e șters, de aceea
-- numele omului e copiat în rând.
CREATE TABLE IF NOT EXISTS audit_log (
  id        BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  user_id   VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
  user_name VARCHAR(120) NOT NULL DEFAULT '',
  action    VARCHAR(40) NOT NULL,
  entity    VARCHAR(30) NOT NULL DEFAULT '',
  entity_id VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
  summary   VARCHAR(500) NOT NULL DEFAULT '',
  KEY audit_at (at),
  KEY audit_entity (entity, entity_id)
) ENGINE=InnoDB;

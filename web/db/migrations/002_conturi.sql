-- Conturi și sesiuni.
--
-- Fiecare om care intră în program are un cont. Rolul spune ce poate vedea:
--   owner     — proprietarul: tot, inclusiv Financiar și Setări
--   reception — recepția: calendarul, rezervările, oaspeții, camerele și tarifele
--
-- Parola nu se ține niciodată în clar: în password_hash stă rezultatul funcției scrypt,
-- împreună cu sarea ei (vezi lib/auth.ts).
--
-- În sessions nu stă nici cookie-ul: stă amprenta lui (sha256). Cine citește tabelul nu se
-- poate da drept altcineva.

CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  email         VARCHAR(160) NOT NULL,
  name          VARCHAR(120) NOT NULL DEFAULT '',
  password_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'reception' CHECK (role IN ('owner','reception')),
  active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  id         VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  user_id    VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  KEY sessions_user (user_id),
  KEY sessions_expires (expires_at),
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

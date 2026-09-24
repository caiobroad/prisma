export const SCHEMA = `
CREATE TABLE IF NOT EXISTS games (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT    NOT NULL,
  platform      TEXT    NOT NULL CHECK (platform IN ('steam','epic','gog','xbox','manual')),
  platform_id   TEXT    NOT NULL,
  install_dir   TEXT,
  exe_path      TEXT,
  launch_uri    TEXT,
  cover_url     TEXT,
  icon_data     TEXT,
  favorite      INTEGER NOT NULL DEFAULT 0,
  hidden        INTEGER NOT NULL DEFAULT 0,
  installed     INTEGER NOT NULL DEFAULT 1,
  added_at      INTEGER NOT NULL,
  last_played   INTEGER,
  playtime_sec  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (platform, platform_id)
);

CREATE INDEX IF NOT EXISTS idx_games_last_played ON games (last_played DESC);
CREATE INDEX IF NOT EXISTS idx_games_title ON games (title COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id      INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  started_at   INTEGER NOT NULL,
  ended_at     INTEGER,
  duration_sec INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sessions_game ON sessions (game_id, started_at DESC);

CREATE TABLE IF NOT EXISTS sources (
  platform   TEXT PRIMARY KEY,
  last_scan  INTEGER,
  count      INTEGER NOT NULL DEFAULT 0,
  detail     TEXT NOT NULL DEFAULT '',
  ok         INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS achievements (
  game_id     INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  api_name    TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  description TEXT,
  icon        TEXT,
  unlocked_at INTEGER,
  PRIMARY KEY (game_id, api_name)
);

CREATE INDEX IF NOT EXISTS idx_achievements_unlocked ON achievements (unlocked_at);

CREATE TABLE IF NOT EXISTS profiles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname     TEXT    NOT NULL,
  avatar       TEXT,
  banner       TEXT,
  steam_linked INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  last_used    INTEGER
);

-- Tags da loja por appid (inclusive de jogos que não estão nesta biblioteca, para o DNA de amigos).
CREATE TABLE IF NOT EXISTS app_tags (
  appid      TEXT PRIMARY KEY,
  tags       TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

/** Índice de busca. Opcional: só é criado se o SQLite embutido tiver FTS5. */
export const SCHEMA_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS games_fts USING fts5(
  title, platform, content='games', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS games_ai AFTER INSERT ON games BEGIN
  INSERT INTO games_fts(rowid, title, platform) VALUES (new.id, new.title, new.platform);
END;
CREATE TRIGGER IF NOT EXISTS games_ad AFTER DELETE ON games BEGIN
  INSERT INTO games_fts(games_fts, rowid, title, platform) VALUES ('delete', old.id, old.title, old.platform);
END;
CREATE TRIGGER IF NOT EXISTS games_au AFTER UPDATE OF title, platform ON games BEGIN
  INSERT INTO games_fts(games_fts, rowid, title, platform) VALUES ('delete', old.id, old.title, old.platform);
  INSERT INTO games_fts(rowid, title, platform) VALUES (new.id, new.title, new.platform);
END;
`

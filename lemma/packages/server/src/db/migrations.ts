/**
 * Schema migrations, applied in order inside a transaction. Never edit a migration that
 * has shipped — add a new one. The schema is deliberately plain SQL: open the database
 * with `sqlite3` and everything is readable.
 *
 * Design: `problems` (with `attempts`) and `events` are the log of what happened.
 * `skill_state` is a cache derived from that log and can be rebuilt at any time.
 */
export interface Migration {
  id: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'initial schema',
    sql: `
CREATE TABLE auth (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT    NOT NULL,
  created_at    INTEGER NOT NULL,
  changed_at    INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash   TEXT    PRIMARY KEY,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  user_agent   TEXT
);

CREATE TABLE settings (
  key        TEXT    PRIMARY KEY,
  value      TEXT    NOT NULL,
  updated_at INTEGER NOT NULL
);

-- A practice run: a queue of skills worked through in one context.
CREATE TABLE runs (
  id          TEXT    PRIMARY KEY,
  context     TEXT    NOT NULL,
  day         TEXT    NOT NULL,
  plan_block  TEXT,
  title       TEXT,
  queue       TEXT    NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  params      TEXT    NOT NULL DEFAULT '{}',
  started_at  INTEGER NOT NULL,
  finished_at INTEGER
);
CREATE INDEX runs_day ON runs (day);

-- Every problem ever issued, with a snapshot of exactly what was shown, and — once
-- resolved — how it went. This is the attempt log the learner model is rebuilt from.
CREATE TABLE problems (
  id              TEXT    PRIMARY KEY,
  run_id          TEXT,
  exam_id         TEXT,
  skill           TEXT    NOT NULL,
  source          TEXT    NOT NULL,
  source_kind     TEXT    NOT NULL CHECK (source_kind IN ('generator', 'static')),
  seed            INTEGER NOT NULL,
  level           INTEGER NOT NULL,
  kind            TEXT    NOT NULL,
  context         TEXT    NOT NULL,
  snapshot        TEXT    NOT NULL,
  est_seconds     INTEGER NOT NULL,
  issued_at       INTEGER NOT NULL,
  day             TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'solved', 'failed', 'skipped')),
  hints_used      INTEGER NOT NULL DEFAULT 0,
  tutor_used      INTEGER NOT NULL DEFAULT 0,
  wrong_attempts  INTEGER NOT NULL DEFAULT 0,
  first_try       INTEGER,
  self_assessed   INTEGER NOT NULL DEFAULT 0,
  resolved_at     INTEGER,
  seconds         REAL,
  confidence      TEXT,
  predicted       REAL,
  credit          REAL,
  points          INTEGER NOT NULL DEFAULT 0,
  review_passed   INTEGER NOT NULL DEFAULT 0,
  error_inferred  TEXT,
  error_basis     TEXT,
  error_note      TEXT,
  error_skill     TEXT,
  error_confirmed TEXT,
  level_before    INTEGER,
  level_after     INTEGER,
  replay_of       TEXT
);
CREATE INDEX problems_skill ON problems (skill, resolved_at);
CREATE INDEX problems_resolved ON problems (resolved_at);
CREATE INDEX problems_run ON problems (run_id);
CREATE INDEX problems_exam ON problems (exam_id);

CREATE TABLE attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id TEXT    NOT NULL REFERENCES problems (id) ON DELETE CASCADE,
  at         INTEGER NOT NULL,
  input      TEXT    NOT NULL,
  verdict    TEXT    NOT NULL,
  diagnosis  TEXT
);
CREATE INDEX attempts_problem ON attempts (problem_id);

-- Append-only activity log: what the heatmap and the streak are computed from.
CREATE TABLE events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  at      INTEGER NOT NULL,
  day     TEXT    NOT NULL,
  type    TEXT    NOT NULL,
  points  INTEGER NOT NULL DEFAULT 0,
  skill   TEXT,
  level   INTEGER,
  tool    TEXT,
  ref     TEXT,
  payload TEXT
);
CREATE INDEX events_day ON events (day);
CREATE INDEX events_type ON events (type, at);

-- Derived: one row per concept. Rebuilt by the recompute job.
CREATE TABLE skill_state (
  skill      TEXT    PRIMARY KEY,
  state      TEXT    NOT NULL,
  level      INTEGER NOT NULL,
  theta      REAL    NOT NULL,
  due_at     INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE lesson_progress (
  concept     TEXT    PRIMARY KEY,
  step        INTEGER NOT NULL DEFAULT 0,
  done        INTEGER NOT NULL DEFAULT 0,
  started_at  INTEGER NOT NULL,
  finished_at INTEGER
);

CREATE TABLE plans (
  day        TEXT    PRIMARY KEY,
  minutes    INTEGER NOT NULL,
  plan       TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE exams (
  id          TEXT    PRIMARY KEY,
  blueprint   TEXT    NOT NULL,
  title       TEXT    NOT NULL,
  minutes     INTEGER NOT NULL,
  started_at  INTEGER NOT NULL,
  deadline_at INTEGER NOT NULL,
  finished_at INTEGER,
  items       TEXT    NOT NULL,
  report      TEXT
);

CREATE TABLE milestones (
  id          TEXT    NOT NULL,
  ref         TEXT    NOT NULL DEFAULT '',
  achieved_at INTEGER NOT NULL,
  day         TEXT    NOT NULL,
  PRIMARY KEY (id, ref)
);

CREATE TABLE mission_progress (
  mission     TEXT    PRIMARY KEY,
  status      TEXT    NOT NULL DEFAULT 'idle',
  milestones  TEXT    NOT NULL DEFAULT '[]',
  notes       TEXT    NOT NULL DEFAULT '',
  repo_url    TEXT    NOT NULL DEFAULT '',
  started_at  INTEGER,
  finished_at INTEGER,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE tutor_threads (
  id         TEXT    PRIMARY KEY,
  mode       TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  concept    TEXT,
  problem_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE tutor_messages (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT    NOT NULL REFERENCES tutor_threads (id) ON DELETE CASCADE,
  role      TEXT    NOT NULL CHECK (role IN ('user', 'assistant')),
  content   TEXT    NOT NULL,
  at        INTEGER NOT NULL
);
CREATE INDEX tutor_messages_thread ON tutor_messages (thread_id, id);

-- Cached responses from GitHub / Forgejo, so the app never depends on them being up.
CREATE TABLE forge_cache (
  source     TEXT    PRIMARY KEY,
  etag       TEXT,
  fetched_at INTEGER NOT NULL,
  ok         INTEGER NOT NULL,
  data       TEXT    NOT NULL,
  error      TEXT
);
`,
  },
  {
    id: 2,
    name: 'accounts',
    // Every learner has a database of their own with this same schema, so these tables
    // exist in each of them — but only the main database, the administrator's, uses them:
    // it is the directory of the other learners, and it holds everybody's sessions.
    // A session without a username is the administrator's, as all of them were before.
    sql: `
CREATE TABLE users (
  username   TEXT    PRIMARY KEY CHECK (username = lower(username)),
  tutor      INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

ALTER TABLE sessions ADD COLUMN username TEXT REFERENCES users (username) ON DELETE CASCADE;
CREATE INDEX sessions_username ON sessions (username);
`,
  },
];

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
  {
    id: 3,
    name: 'goals, selection, teaching',
    // As before, every database gets every table and uses the ones that are its business:
    //   the main database   teaching (who may see whose work)
    //   each learner's      assignments, focus, diagnostics, and the new columns of problems
    //   a teacher's own     student_notes, teach_sessions — a teacher's notes live with the
    //                       teacher, so that no request made by a student can reach them
    sql: `
-- How likely a right answer was by guessing (1/5 for five options, 0 for a typed answer).
-- NULL on rows written before this column existed; filled from the snapshot on the next
-- rebuild of the learner model.
ALTER TABLE problems ADD COLUMN chance REAL;
-- Why the problem was asked, where a selection was made: the purpose, and the reason as JSON.
ALTER TABLE problems ADD COLUMN purpose TEXT;
ALTER TABLE problems ADD COLUMN reason TEXT;

-- 'admin' is the administrator, who is not in users.
CREATE TABLE teaching (
  teacher    TEXT    NOT NULL,
  student    TEXT    NOT NULL REFERENCES users (username) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (teacher, student)
);
CREATE INDEX teaching_student ON teaching (student);

-- Work set by a teacher, kept with the learner it is for: the plan reads it from here.
CREATE TABLE assignments (
  id         TEXT    PRIMARY KEY,
  kind       TEXT    NOT NULL CHECK (kind IN ('practice', 'review', 'remediation', 'lesson', 'test')),
  skills     TEXT    NOT NULL DEFAULT '[]',
  note       TEXT    NOT NULL DEFAULT '',
  minutes    INTEGER NOT NULL DEFAULT 10,
  count      INTEGER,
  due_day    TEXT,
  created_by TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  done_at    INTEGER,
  run_id     TEXT,
  exam_id    TEXT
);
CREATE INDEX assignments_status ON assignments (status, created_at);

-- What a teacher noted about a skill in a session. It steers what is selected for a
-- while and never changes a mastery level: that takes the learner's own work.
CREATE TABLE focus (
  skill      TEXT    PRIMARY KEY,
  kind       TEXT    NOT NULL CHECK (kind IN ('difficulty', 'covered')),
  set_by     TEXT    NOT NULL,
  set_at     INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- A placement test. Its problems are ordinary rows of the log (context 'diagnostic');
-- this records which run it was and what it concluded.
CREATE TABLE diagnostics (
  id          TEXT    PRIMARY KEY,
  goal        TEXT    NOT NULL,
  run_id      TEXT    NOT NULL,
  started_at  INTEGER NOT NULL,
  finished_at INTEGER,
  report      TEXT
);

CREATE TABLE student_notes (
  id         TEXT    PRIMARY KEY,
  student    TEXT    NOT NULL,
  skill      TEXT,
  body       TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX student_notes_student ON student_notes (student, created_at);

CREATE TABLE teach_sessions (
  id          TEXT    PRIMARY KEY,
  student     TEXT    NOT NULL,
  started_at  INTEGER NOT NULL,
  finished_at INTEGER,
  brief       TEXT    NOT NULL DEFAULT '{}',
  items       TEXT    NOT NULL DEFAULT '[]',
  wrap        TEXT
);
CREATE INDEX teach_sessions_student ON teach_sessions (student, started_at);
`,
  },
];

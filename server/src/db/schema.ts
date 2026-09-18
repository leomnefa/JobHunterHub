/**
 * Esquema completo de la base (SQLite via node:sqlite).
 * Cada sentencia es idempotente: el arranque puede repetirse sin romper datos.
 */
export const SCHEMA_STATEMENTS: string[] = [
  `PRAGMA journal_mode = WAL`,
  `PRAGMA foreign_keys = ON`,

  /* ------------------------------ Usuarios ------------------------------ */
  `CREATE TABLE IF NOT EXISTS users (
     id            TEXT PRIMARY KEY,
     email         TEXT NOT NULL UNIQUE,
     name          TEXT NOT NULL,
     role          TEXT NOT NULL CHECK (role IN ('ADMIN','USER')),
     password_hash TEXT NOT NULL,
     active        INTEGER NOT NULL DEFAULT 1,
     must_change_password INTEGER NOT NULL DEFAULT 0,
     created_at    TEXT NOT NULL,
     updated_at    TEXT NOT NULL,
     last_login_at TEXT
   )`,

  /* --------------------------- Perfil candidato -------------------------- */
  `CREATE TABLE IF NOT EXISTS candidate_profiles (
     id            TEXT PRIMARY KEY,
     user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     name          TEXT NOT NULL DEFAULT 'Perfil principal',
     is_primary    INTEGER NOT NULL DEFAULT 1,
     markdown      TEXT NOT NULL DEFAULT '',
     parsed_json   TEXT NOT NULL DEFAULT '{}',
     source_filename TEXT,
     created_at    TEXT NOT NULL,
     updated_at    TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_profiles_user ON candidate_profiles(user_id)`,

  `CREATE TABLE IF NOT EXISTS candidate_preferences (
     user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     desired_roles      TEXT NOT NULL DEFAULT '[]',
     employment_types   TEXT NOT NULL DEFAULT '[]',
     remote_preference  TEXT NOT NULL DEFAULT 'remote',
     countries_allowed  TEXT NOT NULL DEFAULT '[]',
     timezones          TEXT NOT NULL DEFAULT '[]',
     salary_min         INTEGER,
     salary_currency    TEXT DEFAULT 'USD',
     availability       TEXT,
     excluded_keywords  TEXT NOT NULL DEFAULT '[]',
     min_match_alert    INTEGER NOT NULL DEFAULT 80,
     updated_at         TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS candidate_resumes (
     id           TEXT PRIMARY KEY,
     user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     job_id       TEXT,
     label        TEXT NOT NULL,
     kind         TEXT NOT NULL CHECK (kind IN ('base','tailored','cover_letter')),
     format       TEXT NOT NULL DEFAULT 'markdown',
     content      TEXT NOT NULL,
     generated_by TEXT NOT NULL DEFAULT 'manual',
     created_at   TEXT NOT NULL,
     updated_at   TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_resumes_user ON candidate_resumes(user_id, kind)`,

  `CREATE TABLE IF NOT EXISTS candidate_answers (
     id         TEXT PRIMARY KEY,
     user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     question   TEXT NOT NULL,
     answer     TEXT NOT NULL,
     tags       TEXT NOT NULL DEFAULT '[]',
     verified   INTEGER NOT NULL DEFAULT 1,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_answers_user ON candidate_answers(user_id)`,

  /* ------------------------------- Fuentes ------------------------------- */
  `CREATE TABLE IF NOT EXISTS job_sources (
     id            TEXT PRIMARY KEY,
     name          TEXT NOT NULL,
     category      TEXT NOT NULL,
     mode          TEXT NOT NULL,
     enabled       INTEGER NOT NULL DEFAULT 1,
     settings_json TEXT NOT NULL DEFAULT '{}',
     sync_interval_minutes INTEGER NOT NULL DEFAULT 60,
     last_sync_at  TEXT,
     last_status   TEXT,
     last_message  TEXT,
     created_at    TEXT NOT NULL,
     updated_at    TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS connector_credentials (
     id          TEXT PRIMARY KEY,
     source_id   TEXT NOT NULL REFERENCES job_sources(id) ON DELETE CASCADE,
     key         TEXT NOT NULL,
     value_enc   TEXT NOT NULL,
     updated_at  TEXT NOT NULL,
     UNIQUE (source_id, key)
   )`,

  `CREATE TABLE IF NOT EXISTS connector_executions (
     id              TEXT PRIMARY KEY,
     source_id       TEXT NOT NULL,
     started_at      TEXT NOT NULL,
     finished_at     TEXT,
     duration_ms     INTEGER,
     status_code     INTEGER,
     status          TEXT NOT NULL,
     jobs_received   INTEGER NOT NULL DEFAULT 0,
     jobs_inserted   INTEGER NOT NULL DEFAULT 0,
     jobs_updated    INTEGER NOT NULL DEFAULT 0,
     jobs_duplicated INTEGER NOT NULL DEFAULT 0,
     jobs_rejected   INTEGER NOT NULL DEFAULT 0,
     rate_limit_hits INTEGER NOT NULL DEFAULT 0,
     error_message   TEXT,
     triggered_by    TEXT NOT NULL DEFAULT 'manual'
   )`,
  `CREATE INDEX IF NOT EXISTS idx_exec_source ON connector_executions(source_id, started_at DESC)`,

  /* ------------------------------ Empresas ------------------------------- */
  `CREATE TABLE IF NOT EXISTS companies (
     id              TEXT PRIMARY KEY,
     name            TEXT NOT NULL,
     normalized_name TEXT NOT NULL,
     website         TEXT,
     logo_url        TEXT,
     ats_detected    TEXT,
     created_at      TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_companies_norm ON companies(normalized_name)`,

  /* ------------------------------- Ofertas ------------------------------- */
  `CREATE TABLE IF NOT EXISTS jobs (
     id                 TEXT PRIMARY KEY,
     source             TEXT NOT NULL,
     source_job_id      TEXT NOT NULL,
     source_url         TEXT NOT NULL,
     title              TEXT NOT NULL,
     company_id         TEXT REFERENCES companies(id),
     company_name       TEXT NOT NULL,
     description        TEXT NOT NULL DEFAULT '',
     location           TEXT,
     country            TEXT,
     remote_type        TEXT NOT NULL DEFAULT 'unknown',
     worldwide          INTEGER NOT NULL DEFAULT 0,
     employment_type    TEXT NOT NULL DEFAULT 'unknown',
     seniority          TEXT NOT NULL DEFAULT 'unknown',
     salary_min         REAL,
     salary_max         REAL,
     salary_currency    TEXT,
     salary_period      TEXT,
     salary_annualized  REAL,
     skills_json        TEXT NOT NULL DEFAULT '[]',
     categories_json    TEXT NOT NULL DEFAULT '[]',
     published_at       TEXT,
     expires_at         TEXT,
     retrieved_at       TEXT NOT NULL,
     application_url    TEXT,
     application_method TEXT NOT NULL DEFAULT 'unknown',
     capabilities_json  TEXT NOT NULL DEFAULT '{}',
     raw_json           TEXT,
     duplicate_of       TEXT,
     duplicate_candidate INTEGER NOT NULL DEFAULT 0,
     duplicate_confidence REAL,
     created_at         TEXT NOT NULL,
     updated_at         TEXT NOT NULL,
     UNIQUE (source, source_job_id)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_published ON jobs(published_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_name)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_dup ON jobs(duplicate_of)`,

  /* -------------------------------- Match -------------------------------- */
  `CREATE TABLE IF NOT EXISTS job_matches (
     id                 TEXT PRIMARY KEY,
     user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     job_id             TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
     compatibility_score REAL NOT NULL,
     skills_match       REAL NOT NULL DEFAULT 0,
     experience_match   REAL NOT NULL DEFAULT 0,
     location_match     REAL NOT NULL DEFAULT 0,
     salary_match       REAL NOT NULL DEFAULT 0,
     seniority_match    REAL NOT NULL DEFAULT 0,
     contract_match     REAL NOT NULL DEFAULT 0,
     language_match     REAL NOT NULL DEFAULT 0,
     ai_analysis        TEXT NOT NULL DEFAULT '',
     matched_skills     TEXT NOT NULL DEFAULT '[]',
     missing_skills     TEXT NOT NULL DEFAULT '[]',
     risks              TEXT NOT NULL DEFAULT '[]',
     recommendation     TEXT NOT NULL DEFAULT 'review',
     analyzed_by        TEXT NOT NULL DEFAULT 'heuristic',
     created_at         TEXT NOT NULL,
     updated_at         TEXT NOT NULL,
     UNIQUE (user_id, job_id)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_matches_user ON job_matches(user_id, compatibility_score DESC)`,

  /* ----------------------------- Postulaciones --------------------------- */
  `CREATE TABLE IF NOT EXISTS applications (
     id                      TEXT PRIMARY KEY,
     user_id                 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     job_id                  TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
     source                  TEXT NOT NULL,
     external_application_id TEXT,
     status                  TEXT NOT NULL,
     automation_level        INTEGER NOT NULL DEFAULT 2,
     resume_id               TEXT REFERENCES candidate_resumes(id),
     cover_letter_id         TEXT REFERENCES candidate_resumes(id),
     match_score             REAL,
     notes                   TEXT,
     error_message           TEXT,
     metadata_json           TEXT NOT NULL DEFAULT '{}',
     submitted_at            TEXT,
     last_status_update      TEXT,
     created_at              TEXT NOT NULL,
     updated_at              TEXT NOT NULL,
     UNIQUE (user_id, job_id)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_apps_user ON applications(user_id, status)`,

  `CREATE TABLE IF NOT EXISTS application_questions (
     id             TEXT PRIMARY KEY,
     application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
     field_id       TEXT NOT NULL,
     label          TEXT NOT NULL,
     type           TEXT NOT NULL,
     required       INTEGER NOT NULL DEFAULT 0,
     options_json   TEXT NOT NULL DEFAULT '[]',
     position       INTEGER NOT NULL DEFAULT 0
   )`,

  `CREATE TABLE IF NOT EXISTS application_answers (
     id             TEXT PRIMARY KEY,
     application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
     field_id       TEXT NOT NULL,
     answer         TEXT NOT NULL DEFAULT '',
     source         TEXT NOT NULL DEFAULT 'profile',
     confidence     REAL NOT NULL DEFAULT 1,
     needs_review   INTEGER NOT NULL DEFAULT 0,
     updated_at     TEXT NOT NULL,
     UNIQUE (application_id, field_id)
   )`,

  `CREATE TABLE IF NOT EXISTS application_documents (
     id             TEXT PRIMARY KEY,
     application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
     kind           TEXT NOT NULL,
     filename       TEXT NOT NULL,
     content_type   TEXT NOT NULL,
     content        TEXT NOT NULL,
     created_at     TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS application_events (
     id             TEXT PRIMARY KEY,
     application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
     status         TEXT NOT NULL,
     message        TEXT,
     data_json      TEXT NOT NULL DEFAULT '{}',
     created_at     TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_events_app ON application_events(application_id, created_at DESC)`,

  /* -------------------------- Busquedas y alertas ------------------------ */
  `CREATE TABLE IF NOT EXISTS search_queries (
     id          TEXT PRIMARY KEY,
     user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     params_json TEXT NOT NULL,
     sources     TEXT NOT NULL DEFAULT '[]',
     results     INTEGER NOT NULL DEFAULT 0,
     duration_ms INTEGER NOT NULL DEFAULT 0,
     created_at  TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_queries_user ON search_queries(user_id, created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS saved_searches (
     id           TEXT PRIMARY KEY,
     user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     name         TEXT NOT NULL,
     params_json  TEXT NOT NULL,
     alerts_enabled INTEGER NOT NULL DEFAULT 1,
     last_run_at  TEXT,
     created_at   TEXT NOT NULL,
     updated_at   TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS alerts (
     id          TEXT PRIMARY KEY,
     user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     job_id      TEXT REFERENCES jobs(id) ON DELETE CASCADE,
     saved_search_id TEXT,
     title       TEXT NOT NULL,
     body        TEXT NOT NULL,
     score       REAL,
     read        INTEGER NOT NULL DEFAULT 0,
     created_at  TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id, read, created_at DESC)`,

  /* --------------------------- Auditoria / sistema ----------------------- */
  `CREATE TABLE IF NOT EXISTS audit_log (
     id         TEXT PRIMARY KEY,
     user_id    TEXT,
     user_email TEXT,
     action     TEXT NOT NULL,
     entity     TEXT,
     entity_id  TEXT,
     source     TEXT,
     result     TEXT NOT NULL DEFAULT 'SUCCESS',
     detail     TEXT,
     ip         TEXT,
     created_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS system_settings (
     key        TEXT PRIMARY KEY,
     value      TEXT NOT NULL,
     is_secret  INTEGER NOT NULL DEFAULT 0,
     updated_at TEXT NOT NULL
   )`,
];

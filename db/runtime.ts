import { env } from "cloudflare:workers";

export function getD1() {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

export async function ensureCoreSchema() {
  const db = getD1();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'instructor',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS instructor_profiles (
      user_email TEXT PRIMARY KEY NOT NULL,
      grade TEXT NOT NULL DEFAULT '연습강사',
      contract_status TEXT NOT NULL DEFAULT '계약 완료',
      settlement_rate INTEGER NOT NULL DEFAULT 50,
      specialty TEXT NOT NULL DEFAULT '전문 분야 등록 전',
      manager_name TEXT NOT NULL DEFAULT '매니저',
      manager_email TEXT NOT NULL DEFAULT '',
      registered_by_admin INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_email) REFERENCES users(email)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS onboarding_tasks (
      id TEXT PRIMARY KEY NOT NULL,
      user_email TEXT NOT NULL,
      stage INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      due_date TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_email) REFERENCES users(email)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS lesson_plans (
      user_email TEXT PRIMARY KEY NOT NULL,
      content TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'draft',
      version INTEGER NOT NULL DEFAULT 1,
      reviewer_comment TEXT,
      review_checklist TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_email) REFERENCES users(email)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS student_issues (
      id TEXT PRIMARY KEY NOT NULL,
      user_email TEXT NOT NULL,
      severity INTEGER NOT NULL,
      category TEXT NOT NULL,
      course_name TEXT NOT NULL,
      detail TEXT NOT NULL,
      immediate_action TEXT NOT NULL DEFAULT '',
      evidence_url TEXT,
      status TEXT NOT NULL DEFAULT 'reported',
      admin_action TEXT,
      admin_reply TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_email) REFERENCES users(email)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS instructor_resources (
      id TEXT PRIMARY KEY NOT NULL,
      target_email TEXT NOT NULL,
      title TEXT NOT NULL,
      resource_type TEXT NOT NULL DEFAULT '전자책',
      request_note TEXT NOT NULL DEFAULT '',
      delivery_type TEXT NOT NULL,
      placement TEXT NOT NULL DEFAULT 'library',
      stage INTEGER,
      external_url TEXT,
      object_key TEXT,
      file_name TEXT,
      mime_type TEXT,
      size_bytes INTEGER,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (target_email) REFERENCES users(email),
      FOREIGN KEY (created_by) REFERENCES users(email)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS admin_login_attempts (
      id TEXT PRIMARY KEY NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      window_started_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS instructor_credentials (
      user_email TEXT PRIMARY KEY NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_email) REFERENCES users(email)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS task_progress_updates (
      id TEXT PRIMARY KEY NOT NULL,
      user_email TEXT NOT NULL,
      task_id TEXT NOT NULL,
      progress_note TEXT NOT NULL,
      question TEXT NOT NULL DEFAULT '',
      admin_reply TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      replied_at TEXT,
      FOREIGN KEY (user_email) REFERENCES users(email),
      FOREIGN KEY (task_id) REFERENCES onboarding_tasks(id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS course_runs (
      id TEXT PRIMARY KEY NOT NULL,
      user_email TEXT NOT NULL,
      course_title TEXT NOT NULL,
      free_lecture_date TEXT NOT NULL,
      curriculum_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_email) REFERENCES users(email)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS support_requests (
      id TEXT PRIMARY KEY NOT NULL,
      user_email TEXT NOT NULL,
      request_type TEXT NOT NULL,
      message TEXT NOT NULL,
      admin_reply TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      replied_at TEXT,
      FOREIGN KEY (user_email) REFERENCES users(email)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS onboarding_tasks_user_idx ON onboarding_tasks (user_email, sort_order)"),
    db.prepare("CREATE INDEX IF NOT EXISTS student_issues_user_idx ON student_issues (user_email, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS instructor_resources_target_idx ON instructor_resources (target_email, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS task_progress_user_idx ON task_progress_updates (user_email, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS course_runs_user_idx ON course_runs (user_email, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS support_requests_user_idx ON support_requests (user_email, created_at)")
  ]);
  const columnMigrations = [
    "ALTER TABLE instructor_profiles ADD COLUMN registered_by_admin INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE lesson_plans ADD COLUMN review_checklist TEXT NOT NULL DEFAULT '{}'",
    "ALTER TABLE student_issues ADD COLUMN admin_action TEXT",
    "ALTER TABLE student_issues ADD COLUMN admin_reply TEXT",
    "ALTER TABLE student_issues ADD COLUMN updated_at TEXT",
    "ALTER TABLE instructor_resources ADD COLUMN placement TEXT NOT NULL DEFAULT 'library'",
    "ALTER TABLE instructor_resources ADD COLUMN stage INTEGER",
  ];
  for (const statement of columnMigrations) {
    try {
      await db.prepare(statement).run();
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (!message.includes("duplicate column")) throw error;
    }
  }
  await db.prepare("UPDATE instructor_profiles SET manager_name = '매니저' WHERE manager_name = '이수민 매니저'").run();
  return db;
}

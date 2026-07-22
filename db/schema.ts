import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["instructor", "admin", "superadmin"] }).notNull().default("instructor"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const instructorProfiles = sqliteTable("instructor_profiles", {
  userEmail: text("user_email").primaryKey().references(() => users.email),
  grade: text("grade").notNull().default("연습강사"),
  contractStatus: text("contract_status").notNull().default("계약 완료"),
  settlementRate: integer("settlement_rate").notNull().default(50),
  specialty: text("specialty").notNull().default("전문 분야 등록 전"),
  profileBio: text("profile_bio").notNull().default(""),
  managerName: text("manager_name").notNull().default("이수민 매니저"),
  managerEmail: text("manager_email").notNull().default("support@ubii.co.kr"),
  registeredByAdmin: integer("registered_by_admin", { mode: "boolean" }).notNull().default(false),
});

export const onboardingTasks = sqliteTable("onboarding_tasks", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull().references(() => users.email),
  stage: integer("stage").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  status: text("status", { enum: ["not_started", "in_progress", "review", "revision", "done"] }).notNull().default("not_started"),
  dueDate: text("due_date"),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("onboarding_tasks_user_idx").on(table.userEmail, table.sortOrder)]);

export const lessonPlans = sqliteTable("lesson_plans", {
  userEmail: text("user_email").primaryKey().references(() => users.email),
  content: text("content").notNull().default("{}"),
  status: text("status", { enum: ["draft", "review", "revision", "approved"] }).notNull().default("draft"),
  version: integer("version").notNull().default(1),
  reviewerComment: text("reviewer_comment"),
  reviewChecklist: text("review_checklist").notNull().default("{}"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const studentIssues = sqliteTable("student_issues", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull().references(() => users.email),
  severity: integer("severity").notNull(),
  category: text("category").notNull(),
  courseName: text("course_name").notNull(),
  detail: text("detail").notNull(),
  immediateAction: text("immediate_action").notNull().default(""),
  evidenceUrl: text("evidence_url"),
  status: text("status", { enum: ["reported", "reviewing", "resolved"] }).notNull().default("reported"),
  adminAction: text("admin_action"),
  adminReply: text("admin_reply"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("student_issues_user_idx").on(table.userEmail, table.createdAt)]);

export const instructorResources = sqliteTable("instructor_resources", {
  id: text("id").primaryKey(),
  targetEmail: text("target_email").notNull().references(() => users.email),
  title: text("title").notNull(),
  resourceType: text("resource_type").notNull().default("전자책"),
  requestNote: text("request_note").notNull().default(""),
  deliveryType: text("delivery_type", { enum: ["text", "link", "file"] }).notNull(),
  placement: text("placement", { enum: ["roadmap", "library", "contract"] }).notNull().default("library"),
  stage: integer("stage"),
  externalUrl: text("external_url"),
  objectKey: text("object_key"),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  createdBy: text("created_by").notNull().references(() => users.email),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("instructor_resources_target_idx").on(table.targetEmail, table.createdAt)]);

export const resourceMessages = sqliteTable("resource_messages", {
  id: text("id").primaryKey(),
  resourceId: text("resource_id").notNull().references(() => instructorResources.id),
  userEmail: text("user_email").notNull().references(() => users.email),
  authorRole: text("author_role", { enum: ["instructor", "admin"] }).notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("resource_messages_resource_idx").on(table.resourceId, table.createdAt)]);

export const adminLoginAttempts = sqliteTable("admin_login_attempts", {
  id: text("id").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  windowStartedAt: integer("window_started_at").notNull(),
});

export const instructorCredentials = sqliteTable("instructor_credentials", {
  userEmail: text("user_email").primaryKey().references(() => users.email),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const taskProgressUpdates = sqliteTable("task_progress_updates", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull().references(() => users.email),
  taskId: text("task_id").notNull().references(() => onboardingTasks.id),
  progressNote: text("progress_note").notNull(),
  question: text("question").notNull().default(""),
  adminReply: text("admin_reply"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  repliedAt: text("replied_at"),
}, (table) => [index("task_progress_user_idx").on(table.userEmail, table.createdAt)]);

export const courseRuns = sqliteTable("course_runs", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull().references(() => users.email),
  courseTitle: text("course_title").notNull(),
  freeLectureDate: text("free_lecture_date").notNull(),
  curriculumDate: text("curriculum_date").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("course_runs_user_idx").on(table.userEmail, table.createdAt)]);

export const supportRequests = sqliteTable("support_requests", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull().references(() => users.email),
  requestType: text("request_type").notNull(),
  message: text("message").notNull(),
  adminReply: text("admin_reply"),
  status: text("status", { enum: ["open", "answered"] }).notNull().default("open"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  repliedAt: text("replied_at"),
}, (table) => [index("support_requests_user_idx").on(table.userEmail, table.createdAt)]);

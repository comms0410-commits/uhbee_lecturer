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
  managerName: text("manager_name").notNull().default("이수민 매니저"),
  managerEmail: text("manager_email").notNull().default("support@ubii.co.kr"),
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
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("student_issues_user_idx").on(table.userEmail, table.createdAt)]);

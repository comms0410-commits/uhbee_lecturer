import { ensureCoreSchema } from "@/db/runtime";
import { siteDisplayName } from "@/app/display-name";
import { hasAdminSession } from "./admin-auth";

export type Role = "instructor" | "admin" | "superadmin";

export const DEFAULT_TASKS = [
  ["profile", 1, "강사 프로필과 전문 분야 등록", "기본 정보", "not_started", null],
  ["channel", 2, "채널 진단 결과 제출", "채널·콘텐츠", "not_started", null],
  ["skills", 3, "강의 스킬 기본교육 이수", "강사 역량", "not_started", null],
  ["plan", 4, "무료강의 기획안 작성", "강의 설계", "not_started", null],
  ["rehearsal", 5, "Zoom 리허설 참여", "운영 검증", "not_started", null],
  ["coach", 6, "코치방 개설 및 링크 제출", "수강생 성공", "not_started", null],
  ["safety", 7, "위기대응 교육 확인", "위험 관리", "not_started", null],
] as const;

export function requestIdentity(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email");
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  if (email) {
    let displayName = email;
    if (encodedName && encoding === "percent-encoded-utf-8") {
      try { displayName = decodeURIComponent(encodedName); } catch { displayName = email; }
    }
    return { email: email.trim().toLowerCase(), displayName: siteDisplayName(displayName) };
  }

  const host = new URL(request.url).hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return { email: "demo@localhost", displayName: "김어비" };
  }
  return null;
}

export async function seedInstructor(
  db: D1Database,
  input: {
    email: string;
    displayName: string;
    grade?: string;
    specialty?: string;
    settlementRate?: number;
    managerName?: string;
    managerEmail?: string;
    role?: Role;
  },
) {
  const email = input.email.trim().toLowerCase();
  const statements = [
    db.prepare("INSERT INTO users (email, display_name, role) VALUES (?, ?, ?)")
      .bind(email, input.displayName.trim(), input.role ?? "instructor"),
    db.prepare("INSERT INTO instructor_profiles (user_email, grade, contract_status, settlement_rate, specialty, manager_name, manager_email) VALUES (?, ?, '계약 완료', ?, ?, ?, ?)")
      .bind(email, input.grade ?? "연습강사", input.settlementRate ?? 50, input.specialty ?? "전문 분야 등록 전", input.managerName ?? "이수민 매니저", input.managerEmail ?? "support@ubii.co.kr"),
    db.prepare("INSERT INTO lesson_plans (user_email, content, status, version) VALUES (?, '{}', 'draft', 1)").bind(email),
    ...DEFAULT_TASKS.map(([id, stage, title, category, status, dueDate], index) =>
      db.prepare("INSERT INTO onboarding_tasks (id, user_email, stage, title, category, status, due_date, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(`${email}:${id}`, email, stage, title, category, status, dueDate, index)
    ),
  ];
  await db.batch(statements);
}

export async function ensureUser(request: Request) {
  const identity = requestIdentity(request);
  if (!identity) return null;
  const db = await ensureCoreSchema();
  const existing = await db.prepare("SELECT email, display_name, role FROM users WHERE email = ?")
    .bind(identity.email)
    .first<{ email: string; display_name: string; role: Role }>();

  if (!existing) {
    const count = await db.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
    const role: Role = Number(count?.count ?? 0) === 0 ? "superadmin" : "instructor";
    await seedInstructor(db, { email: identity.email, displayName: identity.displayName, role });
    return { db, user: { email: identity.email, display_name: identity.displayName, role } };
  }

  if (existing.display_name !== identity.displayName) {
    await db.prepare("UPDATE users SET display_name = ? WHERE email = ?").bind(identity.displayName, identity.email).run();
  }
  return { db, user: { ...existing, display_name: identity.displayName } };
}

export async function requireAdmin(request: Request) {
  if (await hasAdminSession(request)) {
    const db = await ensureCoreSchema();
    const adminUser = { email: "admin@uhb.local", display_name: "UhB 관리자", role: "admin" as const };
    await db.prepare(`INSERT INTO users (email, display_name, role) VALUES (?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, role = excluded.role`)
      .bind(adminUser.email, adminUser.display_name, adminUser.role).run();
    return { session: { db, user: adminUser } } as const;
  }
  return { error: Response.json({ error: "관리자 로그인이 필요합니다." }, { status: 403 }) } as const;
}

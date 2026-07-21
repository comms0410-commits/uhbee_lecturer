import { ensureCoreSchema } from "@/db/runtime";

export const dynamic = "force-dynamic";

type Role = "instructor" | "admin" | "superadmin";

const DEFAULT_TASKS = [
  ["profile", 1, "강사 프로필과 전문 분야 등록", "기본 정보", "done", "7월 18일"],
  ["channel", 2, "채널 진단 결과 제출", "채널·콘텐츠", "done", "7월 19일"],
  ["skills", 3, "강의 스킬 기본교육 이수", "강사 역량", "done", "7월 20일"],
  ["plan", 4, "무료강의 기획안 보완", "강의 설계", "revision", "오늘"],
  ["rehearsal", 5, "Zoom 리허설 참여", "운영 검증", "in_progress", "7월 23일"],
  ["coach", 6, "코치방 개설 및 링크 제출", "수강생 성공", "not_started", "7월 25일"],
  ["safety", 7, "위기대응 교육 확인", "위험 관리", "not_started", "7월 26일"],
] as const;

function requestIdentity(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email");
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  if (email) {
    let displayName = email;
    if (encodedName && encoding === "percent-encoded-utf-8") {
      try { displayName = decodeURIComponent(encodedName); } catch { displayName = email; }
    }
    return { email, displayName };
  }

  const host = new URL(request.url).hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return { email: "demo@localhost", displayName: "김어비" };
  }
  return null;
}

async function ensureUser(request: Request) {
  const identity = requestIdentity(request);
  if (!identity) return null;
  const db = await ensureCoreSchema();
  const existing = await db.prepare("SELECT email, display_name, role FROM users WHERE email = ?").bind(identity.email).first<{ email: string; display_name: string; role: Role }>();

  if (!existing) {
    const count = await db.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
    const role: Role = Number(count?.count ?? 0) === 0 ? "superadmin" : "instructor";
    await db.batch([
      db.prepare("INSERT INTO users (email, display_name, role) VALUES (?, ?, ?)").bind(identity.email, identity.displayName, role),
      db.prepare("INSERT INTO instructor_profiles (user_email, grade, contract_status, settlement_rate, specialty, manager_name, manager_email) VALUES (?, '연습강사', '계약 완료', 50, 'AI 업무자동화', '이수민 매니저', 'support@ubii.co.kr')").bind(identity.email),
      db.prepare("INSERT INTO lesson_plans (user_email, content, status, version) VALUES (?, '{}', 'draft', 1)").bind(identity.email),
    ]);
    await db.batch(DEFAULT_TASKS.map(([id, stage, title, category, status, dueDate], index) =>
      db.prepare("INSERT INTO onboarding_tasks (id, user_email, stage, title, category, status, due_date, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(`${identity.email}:${id}`, identity.email, stage, title, category, status, dueDate, index)
    ));
    return { db, user: { email: identity.email, display_name: identity.displayName, role } };
  }

  if (existing.display_name !== identity.displayName) {
    await db.prepare("UPDATE users SET display_name = ? WHERE email = ?").bind(identity.displayName, identity.email).run();
  }
  return { db, user: { ...existing, display_name: identity.displayName } };
}

export async function GET(request: Request) {
  try {
    const session = await ensureUser(request);
    if (!session) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { db, user } = session;

    const [profile, tasks, plan, issues] = await Promise.all([
      db.prepare("SELECT grade, contract_status, settlement_rate, specialty, manager_name, manager_email FROM instructor_profiles WHERE user_email = ?").bind(user.email).first(),
      db.prepare("SELECT id, stage, title, category, status, due_date, sort_order FROM onboarding_tasks WHERE user_email = ? ORDER BY sort_order ASC").bind(user.email).all(),
      db.prepare("SELECT content, status, version, reviewer_comment, updated_at FROM lesson_plans WHERE user_email = ?").bind(user.email).first<{ content: string; status: string; version: number; reviewer_comment: string | null; updated_at: string }>(),
      db.prepare("SELECT id, severity, category, course_name, detail, immediate_action, evidence_url, status, created_at FROM student_issues WHERE user_email = ? ORDER BY created_at DESC LIMIT 10").bind(user.email).all(),
    ]);

    let planContent: Record<string, string> = {};
    try { planContent = JSON.parse(plan?.content ?? "{}"); } catch { planContent = {}; }

    return Response.json({
      user: { email: user.email, displayName: user.display_name, role: user.role },
      profile,
      tasks: tasks.results,
      plan: { content: planContent, status: plan?.status ?? "draft", version: plan?.version ?? 1, reviewerComment: plan?.reviewer_comment ?? null, updatedAt: plan?.updated_at ?? null },
      issues: issues.results,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "데이터를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await ensureUser(request);
    if (!session) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { db, user } = session;
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "toggleTask") {
      const id = String(body.id ?? "");
      const status = String(body.status ?? "");
      if (!id || !["not_started", "in_progress", "review", "revision", "done"].includes(status)) {
        return Response.json({ error: "유효하지 않은 체크 상태입니다." }, { status: 400 });
      }
      await db.prepare("UPDATE onboarding_tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_email = ?").bind(status, id, user.email).run();
      return Response.json({ ok: true });
    }

    if (action === "savePlan" || action === "submitPlan") {
      const content = body.content && typeof body.content === "object" ? body.content : {};
      const status = action === "submitPlan" ? "review" : "draft";
      await db.prepare("UPDATE lesson_plans SET content = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_email = ?")
        .bind(JSON.stringify(content), status, user.email).run();
      return Response.json({ ok: true, status });
    }

    if (action === "reportIssue") {
      const severity = Number(body.severity ?? 1);
      const category = String(body.category ?? "일반 문의").trim();
      const courseName = String(body.courseName ?? "").trim();
      const detail = String(body.detail ?? "").trim();
      const immediateAction = String(body.immediateAction ?? "").trim();
      const evidenceUrl = String(body.evidenceUrl ?? "").trim();
      if (![1, 2, 3].includes(severity) || !courseName || detail.length < 10) {
        return Response.json({ error: "강의명과 10자 이상의 상황 설명을 입력해 주세요." }, { status: 400 });
      }
      const id = crypto.randomUUID();
      await db.prepare("INSERT INTO student_issues (id, user_email, severity, category, course_name, detail, immediate_action, evidence_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'reported')")
        .bind(id, user.email, severity, category, courseName, detail, immediateAction, evidenceUrl || null).run();
      return Response.json({ ok: true, id });
    }

    if (action === "setRole") {
      if (user.role !== "superadmin") return Response.json({ error: "최고관리자 권한이 필요합니다." }, { status: 403 });
      const targetEmail = String(body.email ?? "");
      const role = String(body.role ?? "");
      if (!targetEmail || !["instructor", "admin", "superadmin"].includes(role)) return Response.json({ error: "역할 정보가 올바르지 않습니다." }, { status: 400 });
      await db.prepare("UPDATE users SET role = ? WHERE email = ?").bind(role, targetEmail).run();
      return Response.json({ ok: true });
    }

    return Response.json({ error: "지원하지 않는 요청입니다." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "요청을 처리하지 못했습니다." }, { status: 500 });
  }
}

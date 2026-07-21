import { ensureUser } from "../session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await ensureUser(request);
    if (!session) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { db, user } = session;

    const [profile, tasks, plan, issues, resources] = await Promise.all([
      db.prepare("SELECT grade, contract_status, settlement_rate, specialty, manager_name, manager_email FROM instructor_profiles WHERE user_email = ?").bind(user.email).first(),
      db.prepare("SELECT id, stage, title, category, status, due_date, sort_order FROM onboarding_tasks WHERE user_email = ? ORDER BY sort_order ASC").bind(user.email).all(),
      db.prepare("SELECT content, status, version, reviewer_comment, updated_at FROM lesson_plans WHERE user_email = ?").bind(user.email).first<{ content: string; status: string; version: number; reviewer_comment: string | null; updated_at: string }>(),
      db.prepare("SELECT id, severity, category, course_name, detail, immediate_action, evidence_url, status, created_at FROM student_issues WHERE user_email = ? ORDER BY created_at DESC LIMIT 10").bind(user.email).all(),
      db.prepare("SELECT id, title, resource_type, request_note, delivery_type, external_url, file_name, mime_type, size_bytes, created_at FROM instructor_resources WHERE target_email = ? ORDER BY created_at DESC").bind(user.email).all(),
    ]);

    let planContent: Record<string, string> = {};
    try { planContent = JSON.parse(plan?.content ?? "{}"); } catch { planContent = {}; }

    return Response.json({
      user: { email: user.email, displayName: user.display_name, role: user.role },
      profile,
      tasks: tasks.results,
      plan: { content: planContent, status: plan?.status ?? "draft", version: plan?.version ?? 1, reviewerComment: plan?.reviewer_comment ?? null, updatedAt: plan?.updated_at ?? null },
      issues: issues.results,
      resources: resources.results,
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

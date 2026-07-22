import { ensureUser } from "../session";

export const dynamic = "force-dynamic";

function parseRecord(value: string | null | undefined) {
  try { return JSON.parse(value ?? "{}") as Record<string, string | boolean>; } catch { return {}; }
}

export async function GET(request: Request) {
  try {
    const session = await ensureUser(request);
    if (!session) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { db, user } = session;

    const [profile, tasks, plan, issues, resources, progressUpdates, courseRuns, supportRequests] = await Promise.all([
      db.prepare("SELECT grade, contract_status, settlement_rate, specialty, manager_name FROM instructor_profiles WHERE user_email = ?").bind(user.email).first(),
      db.prepare("SELECT id, stage, title, category, status, due_date, sort_order FROM onboarding_tasks WHERE user_email = ? ORDER BY sort_order ASC").bind(user.email).all(),
      db.prepare("SELECT content, status, version, reviewer_comment, review_checklist, updated_at FROM lesson_plans WHERE user_email = ?").bind(user.email).first<{ content: string; status: string; version: number; reviewer_comment: string | null; review_checklist: string; updated_at: string }>(),
      db.prepare("SELECT id, severity, category, course_name, detail, immediate_action, evidence_url, status, admin_action, admin_reply, created_at, updated_at FROM student_issues WHERE user_email = ? ORDER BY created_at DESC LIMIT 20").bind(user.email).all(),
      db.prepare("SELECT id, title, resource_type, request_note, delivery_type, placement, stage, external_url, file_name, mime_type, size_bytes, created_at FROM instructor_resources WHERE target_email = ? ORDER BY created_at DESC").bind(user.email).all(),
      db.prepare("SELECT id, task_id, progress_note, question, admin_reply, created_at, replied_at FROM task_progress_updates WHERE user_email = ? ORDER BY created_at DESC").bind(user.email).all(),
      db.prepare("SELECT id, course_title, free_lecture_date, curriculum_date, created_at FROM course_runs WHERE user_email = ? ORDER BY free_lecture_date DESC, created_at DESC").bind(user.email).all(),
      db.prepare("SELECT id, request_type, message, admin_reply, status, created_at, replied_at FROM support_requests WHERE user_email = ? ORDER BY created_at DESC").bind(user.email).all(),
    ]);

    return Response.json({
      user: { email: user.email, displayName: user.display_name, role: user.role },
      profile: profile ?? { grade: "연습강사", contract_status: "계약 완료", settlement_rate: 50, specialty: "전문 분야 등록 전", manager_name: "매니저" },
      tasks: tasks.results,
      plan: {
        content: parseRecord(plan?.content) as Record<string, string>,
        status: plan?.status ?? "draft",
        version: plan?.version ?? 1,
        reviewerComment: plan?.reviewer_comment ?? null,
        reviewChecklist: parseRecord(plan?.review_checklist) as Record<string, boolean>,
        updatedAt: plan?.updated_at ?? null,
      },
      issues: issues.results,
      resources: resources.results,
      progressUpdates: progressUpdates.results,
      courseRuns: courseRuns.results,
      supportRequests: supportRequests.results,
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
        return Response.json({ error: "유효하지 않은 진행 상태입니다." }, { status: 400 });
      }
      await db.prepare("UPDATE onboarding_tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_email = ?").bind(status, id, user.email).run();
      return Response.json({ ok: true });
    }

    if (action === "shareProgress") {
      const taskId = String(body.taskId ?? "").trim();
      const progressNote = String(body.progressNote ?? "").trim();
      const question = String(body.question ?? "").trim();
      const ownedTask = await db.prepare("SELECT id FROM onboarding_tasks WHERE id = ? AND user_email = ?").bind(taskId, user.email).first();
      if (!ownedTask || progressNote.length < 2) return Response.json({ error: "진행 내용은 2자 이상 입력해 주세요." }, { status: 400 });
      const id = crypto.randomUUID();
      await db.prepare("INSERT INTO task_progress_updates (id, user_email, task_id, progress_note, question) VALUES (?, ?, ?, ?, ?)")
        .bind(id, user.email, taskId, progressNote, question).run();
      await db.prepare("UPDATE onboarding_tasks SET status = 'review', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_email = ?").bind(taskId, user.email).run();
      return Response.json({ ok: true, id, status: "review" });
    }

    if (action === "savePlan" || action === "submitPlan") {
      const content = body.content && typeof body.content === "object" ? body.content : {};
      const status = action === "submitPlan" ? "review" : "draft";
      await db.prepare("UPDATE lesson_plans SET content = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_email = ?")
        .bind(JSON.stringify(content), status, user.email).run();
      return Response.json({ ok: true, status });
    }

    if (action === "createCourseRun") {
      const courseTitle = String(body.courseTitle ?? "").trim();
      const freeLectureDate = String(body.freeLectureDate ?? "").trim();
      const curriculumDate = String(body.curriculumDate ?? "").trim();
      if (!courseTitle || !/^\d{4}-\d{2}-\d{2}$/.test(freeLectureDate) || !/^\d{4}-\d{2}-\d{2}$/.test(curriculumDate)) {
        return Response.json({ error: "강의명과 무료강의·커리큘럼 날짜를 모두 입력해 주세요." }, { status: 400 });
      }
      const id = crypto.randomUUID();
      await db.prepare("INSERT INTO course_runs (id, user_email, course_title, free_lecture_date, curriculum_date) VALUES (?, ?, ?, ?, ?)")
        .bind(id, user.email, courseTitle, freeLectureDate, curriculumDate).run();
      return Response.json({ ok: true, id });
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

    if (action === "createSupportRequest") {
      const requestType = String(body.requestType ?? "").trim();
      const message = String(body.message ?? "").trim();
      const allowedTypes = ["기획안·검토", "강의 일정", "Zoom·기술", "계약·정산", "기타"];
      if (!allowedTypes.includes(requestType) || message.length < 2) return Response.json({ error: "문의 유형과 내용을 입력해 주세요." }, { status: 400 });
      const id = crypto.randomUUID();
      await db.prepare("INSERT INTO support_requests (id, user_email, request_type, message) VALUES (?, ?, ?, ?)").bind(id, user.email, requestType, message).run();
      return Response.json({ ok: true, id });
    }

    return Response.json({ error: "지원하지 않는 요청입니다." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "요청을 처리하지 못했습니다." }, { status: 500 });
  }
}

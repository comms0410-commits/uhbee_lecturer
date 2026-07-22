import { env } from "cloudflare:workers";
import { siteDisplayName } from "@/app/display-name";
import { requireAdmin, seedInstructor } from "../session";
import { hashInstructorPassword } from "../instructor-auth";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9._-]{4,30}$/;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function textValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function validWebUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch { return false; }
}

async function isRegisteredInstructor(db: D1Database, email: string) {
  return db.prepare(`SELECT u.email FROM users u
    JOIN instructor_profiles p ON p.user_email = u.email
    WHERE u.email = ? AND u.role = 'instructor' AND p.registered_by_admin = 1`).bind(email).first();
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if ("error" in auth) return auth.error;
    const { db, user } = auth.session;

    const [instructors, resources, tasks, progressUpdates, plans, issues, courseRuns, supportRequests] = await Promise.all([
      db.prepare(`SELECT
        u.email, u.display_name, u.role, u.created_at,
        p.grade, p.contract_status, p.settlement_rate, p.specialty, p.manager_name, c.username,
        COUNT(t.id) AS task_count,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done_count
      FROM users u
      JOIN instructor_profiles p ON p.user_email = u.email
      LEFT JOIN instructor_credentials c ON c.user_email = u.email
      LEFT JOIN onboarding_tasks t ON t.user_email = u.email
      WHERE u.role = 'instructor' AND p.registered_by_admin = 1
      GROUP BY u.email, u.display_name, u.role, u.created_at, p.grade, p.contract_status, p.settlement_rate, p.specialty, p.manager_name, c.username
      ORDER BY u.created_at DESC`).all(),
      db.prepare(`SELECT r.*, u.display_name AS target_name
        FROM instructor_resources r
        JOIN users u ON u.email = r.target_email
        JOIN instructor_profiles p ON p.user_email = u.email AND p.registered_by_admin = 1
        ORDER BY r.created_at DESC`).all(),
      db.prepare(`SELECT t.* FROM onboarding_tasks t
        JOIN instructor_profiles p ON p.user_email = t.user_email AND p.registered_by_admin = 1
        ORDER BY t.user_email, t.sort_order`).all(),
      db.prepare(`SELECT x.*, u.display_name AS instructor_name, t.stage, t.title AS task_title
        FROM task_progress_updates x
        JOIN users u ON u.email = x.user_email
        JOIN instructor_profiles p ON p.user_email = u.email AND p.registered_by_admin = 1
        JOIN onboarding_tasks t ON t.id = x.task_id
        ORDER BY x.created_at DESC`).all(),
      db.prepare(`SELECT l.user_email, l.content, l.status, l.version, l.reviewer_comment, l.review_checklist, l.updated_at, u.display_name
        FROM lesson_plans l
        JOIN users u ON u.email = l.user_email
        JOIN instructor_profiles p ON p.user_email = u.email AND p.registered_by_admin = 1
        ORDER BY l.updated_at DESC`).all(),
      db.prepare(`SELECT i.*, u.display_name AS instructor_name FROM student_issues i
        JOIN users u ON u.email = i.user_email
        JOIN instructor_profiles p ON p.user_email = u.email AND p.registered_by_admin = 1
        ORDER BY i.created_at DESC`).all(),
      db.prepare(`SELECT c.*, u.display_name AS instructor_name FROM course_runs c
        JOIN users u ON u.email = c.user_email
        JOIN instructor_profiles p ON p.user_email = u.email AND p.registered_by_admin = 1
        ORDER BY c.free_lecture_date DESC`).all(),
      db.prepare(`SELECT s.*, u.display_name AS instructor_name FROM support_requests s
        JOIN users u ON u.email = s.user_email
        JOIN instructor_profiles p ON p.user_email = u.email AND p.registered_by_admin = 1
        ORDER BY s.created_at DESC`).all(),
    ]);

    return Response.json({
      user: { email: user.email, displayName: user.display_name, role: user.role },
      instructors: instructors.results.map((item) => ({ ...item, display_name: siteDisplayName(String(item.display_name ?? "")) })),
      resources: resources.results.map((item) => ({ ...item, target_name: siteDisplayName(String(item.target_name ?? "")) })),
      tasks: tasks.results,
      progressUpdates: progressUpdates.results,
      plans: plans.results,
      issues: issues.results,
      courseRuns: courseRuns.results,
      supportRequests: supportRequests.results,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "관리자 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if ("error" in auth) return auth.error;
    const { db, user } = auth.session;
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = await request.json() as Record<string, unknown>;
      const action = String(body.action ?? "");

      if (action === "registerInstructor") {
        const displayName = siteDisplayName(String(body.displayName ?? "").trim());
        const email = String(body.email ?? "").trim().toLowerCase();
        const username = String(body.username ?? "").trim().toLowerCase();
        const password = String(body.password ?? "");
        const specialty = String(body.specialty ?? "").trim() || "전문 분야 등록 전";
        const grade = String(body.grade ?? "").trim() || "연습강사";
        const managerName = "매니저";
        const managerEmail = "";
        const settlementRate = Number(body.settlementRate ?? 50);
        if (!displayName || !EMAIL_PATTERN.test(email)) return Response.json({ error: "강사 이름과 올바른 이메일을 입력해 주세요." }, { status: 400 });
        if (!USERNAME_PATTERN.test(username)) return Response.json({ error: "아이디는 영문 소문자, 숫자, 점, 밑줄, 하이픈으로 4~30자 입력해 주세요." }, { status: 400 });
        if (password.length < 8 || password.length > 64) return Response.json({ error: "비밀번호는 8~64자로 입력해 주세요." }, { status: 400 });
        if (!Number.isInteger(settlementRate) || settlementRate < 0 || settlementRate > 100) return Response.json({ error: "정산율은 0~100 사이의 정수로 입력해 주세요." }, { status: 400 });

        const usernameOwner = await db.prepare("SELECT user_email FROM instructor_credentials WHERE username = ?").bind(username).first<{ user_email: string }>();
        if (usernameOwner && usernameOwner.user_email !== email) return Response.json({ error: "이미 사용 중인 강사 아이디입니다." }, { status: 409 });
        const passwordCredential = await hashInstructorPassword(password);

        const existing = await db.prepare(`SELECT u.email, u.role, p.registered_by_admin FROM users u
          LEFT JOIN instructor_profiles p ON p.user_email = u.email WHERE u.email = ?`).bind(email).first<{ email: string; role: string; registered_by_admin: number | null }>();
        if (existing) {
          if (existing.role !== "instructor" || Number(existing.registered_by_admin) === 1) return Response.json({ error: "이미 등록된 이메일입니다." }, { status: 409 });
          await db.batch([
            db.prepare("UPDATE users SET display_name = ? WHERE email = ?").bind(displayName, email),
            db.prepare(`UPDATE instructor_profiles SET grade = ?, settlement_rate = ?, specialty = ?, manager_name = ?, manager_email = ?, registered_by_admin = 1 WHERE user_email = ?`)
              .bind(grade, settlementRate, specialty, managerName, managerEmail, email),
            db.prepare(`INSERT INTO instructor_credentials (user_email, username, password_hash, password_salt, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(user_email) DO UPDATE SET username = excluded.username, password_hash = excluded.password_hash, password_salt = excluded.password_salt, updated_at = CURRENT_TIMESTAMP`)
              .bind(email, username, passwordCredential.hash, passwordCredential.salt),
          ]);
        } else {
          await seedInstructor(db, { email, displayName, specialty, grade, settlementRate, managerName, managerEmail, registeredByAdmin: true });
          await db.prepare("INSERT INTO instructor_credentials (user_email, username, password_hash, password_salt) VALUES (?, ?, ?, ?)")
            .bind(email, username, passwordCredential.hash, passwordCredential.salt).run();
        }
        return Response.json({ ok: true, email, username }, { status: 201 });
      }

      if (action === "replyProgress") {
        const id = String(body.id ?? "").trim();
        const reply = String(body.reply ?? "").trim();
        const status = String(body.status ?? "in_progress");
        if (!id || reply.length < 2 || !["in_progress", "revision", "done"].includes(status)) return Response.json({ error: "답변과 진행 상태를 확인해 주세요." }, { status: 400 });
        const row = await db.prepare("SELECT user_email, task_id FROM task_progress_updates WHERE id = ?").bind(id).first<{ user_email: string; task_id: string }>();
        if (!row || !(await isRegisteredInstructor(db, row.user_email))) return Response.json({ error: "진행 공유 내역을 찾을 수 없습니다." }, { status: 404 });
        await db.batch([
          db.prepare("UPDATE task_progress_updates SET admin_reply = ?, replied_at = CURRENT_TIMESTAMP WHERE id = ?").bind(reply, id),
          db.prepare("UPDATE onboarding_tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_email = ?").bind(status, row.task_id, row.user_email),
        ]);
        return Response.json({ ok: true });
      }

      if (action === "reviewPlan") {
        const targetEmail = String(body.targetEmail ?? "").trim().toLowerCase();
        const reviewerComment = String(body.reviewerComment ?? "").trim();
        const status = String(body.status ?? "revision");
        const checklist = body.checklist && typeof body.checklist === "object" ? body.checklist : {};
        if (!(await isRegisteredInstructor(db, targetEmail)) || !reviewerComment || !["revision", "approved"].includes(status)) return Response.json({ error: "강사, 검토 상태, 코멘트를 확인해 주세요." }, { status: 400 });
        await db.prepare("UPDATE lesson_plans SET reviewer_comment = ?, review_checklist = ?, status = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE user_email = ?")
          .bind(reviewerComment, JSON.stringify(checklist), status, targetEmail).run();
        return Response.json({ ok: true });
      }

      if (action === "reviewIssue") {
        const id = String(body.id ?? "").trim();
        const status = String(body.status ?? "reviewing");
        const adminAction = String(body.adminAction ?? "").trim();
        const adminReply = String(body.adminReply ?? "").trim();
        const row = await db.prepare("SELECT user_email FROM student_issues WHERE id = ?").bind(id).first<{ user_email: string }>();
        if (!row || !(await isRegisteredInstructor(db, row.user_email)) || !["reviewing", "resolved"].includes(status) || !adminAction) return Response.json({ error: "조치 내용과 상태를 확인해 주세요." }, { status: 400 });
        await db.prepare("UPDATE student_issues SET status = ?, admin_action = ?, admin_reply = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(status, adminAction, adminReply, id).run();
        return Response.json({ ok: true });
      }

      if (action === "replySupport") {
        const id = String(body.id ?? "").trim();
        const reply = String(body.reply ?? "").trim();
        const row = await db.prepare("SELECT user_email FROM support_requests WHERE id = ?").bind(id).first<{ user_email: string }>();
        if (!row || !(await isRegisteredInstructor(db, row.user_email)) || reply.length < 2) return Response.json({ error: "문의 답변을 입력해 주세요." }, { status: 400 });
        await db.prepare("UPDATE support_requests SET admin_reply = ?, status = 'answered', replied_at = CURRENT_TIMESTAMP WHERE id = ?").bind(reply, id).run();
        return Response.json({ ok: true });
      }

      return Response.json({ error: "지원하지 않는 요청입니다." }, { status: 400 });
    }

    const form = await request.formData();
    if (textValue(form, "action") !== "createResource") return Response.json({ error: "지원하지 않는 요청입니다." }, { status: 400 });

    const targetEmail = textValue(form, "targetEmail").toLowerCase();
    const title = textValue(form, "title");
    const resourceType = textValue(form, "resourceType") || "강의자료";
    const requestNote = textValue(form, "requestNote");
    const deliveryType = textValue(form, "deliveryType");
    const placement = textValue(form, "placement") || "library";
    const stage = Number(textValue(form, "stage") || 0);
    const externalUrl = textValue(form, "externalUrl");
    const fileValue = form.get("file");

    if (!targetEmail || !title || !["text", "link", "file"].includes(deliveryType) || !["roadmap", "library"].includes(placement)) return Response.json({ error: "대상 강사, 자료명, 전달 위치와 방식을 확인해 주세요." }, { status: 400 });
    if (!(await isRegisteredInstructor(db, targetEmail))) return Response.json({ error: "등록된 강사를 선택해 주세요." }, { status: 400 });
    if (placement === "roadmap" && (!Number.isInteger(stage) || stage < 1 || stage > 7)) return Response.json({ error: "로드맵 단계를 선택해 주세요." }, { status: 400 });
    if (deliveryType === "text" && requestNote.length < 2) return Response.json({ error: "강사가 확인할 내용을 입력해 주세요." }, { status: 400 });
    if (deliveryType === "link" && !validWebUrl(externalUrl)) return Response.json({ error: "http:// 또는 https://로 시작하는 올바른 링크를 입력해 주세요." }, { status: 400 });
    if (deliveryType === "file" && (!(fileValue instanceof File) || fileValue.size === 0)) return Response.json({ error: "전달할 파일을 선택해 주세요." }, { status: 400 });
    if (fileValue instanceof File && fileValue.size > MAX_FILE_BYTES) return Response.json({ error: "파일은 25MB 이하만 업로드할 수 있습니다." }, { status: 413 });

    const id = crypto.randomUUID();
    let objectKey: string | null = null;
    let fileName: string | null = null;
    let mimeType: string | null = null;
    let sizeBytes: number | null = null;
    if (deliveryType === "file" && fileValue instanceof File) {
      fileName = fileValue.name.slice(0, 180);
      mimeType = fileValue.type || "application/octet-stream";
      sizeBytes = fileValue.size;
      const safeTarget = targetEmail.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const safeName = fileName.replace(/[^a-zA-Z0-9가-힣._-]+/g, "-");
      objectKey = `instructor-resources/${safeTarget}/${id}-${safeName}`;
      await env.FILES.put(objectKey, fileValue.stream(), {
        httpMetadata: { contentType: mimeType, contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}` },
        customMetadata: { targetEmail, resourceId: id },
      });
    }

    try {
      await db.prepare(`INSERT INTO instructor_resources
        (id, target_email, title, resource_type, request_note, delivery_type, placement, stage, external_url, object_key, file_name, mime_type, size_bytes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
          id, targetEmail, title, resourceType, requestNote, deliveryType, placement, placement === "roadmap" ? stage : null,
          deliveryType === "link" ? externalUrl : null, objectKey, fileName, mimeType, sizeBytes, user.email,
        ).run();
    } catch (error) {
      if (objectKey) await env.FILES.delete(objectKey);
      throw error;
    }
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "요청을 처리하지 못했습니다." }, { status: 500 });
  }
}

import { env } from "cloudflare:workers";
import { siteDisplayName } from "@/app/display-name";
import { requireAdmin, seedInstructor } from "../session";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function textValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function validWebUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if ("error" in auth) return auth.error;
    const { db, user } = auth.session;

    const [instructors, resources] = await Promise.all([
      db.prepare(`SELECT
        u.email, u.display_name, u.role, u.created_at,
        p.grade, p.contract_status, p.settlement_rate, p.specialty, p.manager_name, p.manager_email,
        COUNT(t.id) AS task_count,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done_count
      FROM users u
      JOIN instructor_profiles p ON p.user_email = u.email
      LEFT JOIN onboarding_tasks t ON t.user_email = u.email
      WHERE u.role = 'instructor'
      GROUP BY u.email, u.display_name, u.role, u.created_at, p.grade, p.contract_status, p.settlement_rate, p.specialty, p.manager_name, p.manager_email
      ORDER BY u.created_at DESC`).all(),
      db.prepare(`SELECT
        r.id, r.target_email, r.title, r.resource_type, r.request_note, r.delivery_type,
        r.external_url, r.file_name, r.mime_type, r.size_bytes, r.created_by, r.created_at,
        u.display_name AS target_name
      FROM instructor_resources r
      JOIN users u ON u.email = r.target_email
      ORDER BY r.created_at DESC`).all(),
    ]);

    return Response.json({
      user: { email: user.email, displayName: user.display_name, role: user.role },
      instructors: instructors.results.map((item) => ({ ...item, display_name: siteDisplayName(String(item.display_name ?? "")) })),
      resources: resources.results.map((item) => ({ ...item, target_name: siteDisplayName(String(item.target_name ?? "")) })),
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
      if (String(body.action ?? "") !== "registerInstructor") {
        return Response.json({ error: "지원하지 않는 요청입니다." }, { status: 400 });
      }

      const displayName = siteDisplayName(String(body.displayName ?? "").trim());
      const email = String(body.email ?? "").trim().toLowerCase();
      const specialty = String(body.specialty ?? "").trim() || "전문 분야 등록 전";
      const grade = String(body.grade ?? "").trim() || "연습강사";
      const managerName = String(body.managerName ?? "").trim() || user.display_name;
      const managerEmail = String(body.managerEmail ?? "").trim().toLowerCase() || user.email;
      const settlementRate = Number(body.settlementRate ?? 50);

      if (!displayName || !EMAIL_PATTERN.test(email)) {
        return Response.json({ error: "강사 이름과 올바른 이메일을 입력해 주세요." }, { status: 400 });
      }
      if (!Number.isInteger(settlementRate) || settlementRate < 0 || settlementRate > 100) {
        return Response.json({ error: "정산율은 0~100 사이의 정수로 입력해 주세요." }, { status: 400 });
      }
      const existing = await db.prepare("SELECT email FROM users WHERE email = ?").bind(email).first();
      if (existing) return Response.json({ error: "이미 등록된 이메일입니다." }, { status: 409 });

      await seedInstructor(db, { email, displayName, specialty, grade, settlementRate, managerName, managerEmail });
      return Response.json({ ok: true, email }, { status: 201 });
    }

    const form = await request.formData();
    if (textValue(form, "action") !== "createResource") {
      return Response.json({ error: "지원하지 않는 요청입니다." }, { status: 400 });
    }

    const targetEmail = textValue(form, "targetEmail").toLowerCase();
    const title = textValue(form, "title");
    const resourceType = textValue(form, "resourceType") || "전자책";
    const requestNote = textValue(form, "requestNote");
    const deliveryType = textValue(form, "deliveryType");
    const externalUrl = textValue(form, "externalUrl");
    const fileValue = form.get("file");

    if (!targetEmail || !title || !["link", "file"].includes(deliveryType)) {
      return Response.json({ error: "대상 강사, 자료명, 전달 방식을 확인해 주세요." }, { status: 400 });
    }
    const target = await db.prepare("SELECT email FROM users WHERE email = ? AND role = 'instructor'").bind(targetEmail).first();
    if (!target) return Response.json({ error: "등록된 강사를 선택해 주세요." }, { status: 400 });
    if (deliveryType === "link" && !validWebUrl(externalUrl)) {
      return Response.json({ error: "http:// 또는 https://로 시작하는 올바른 링크를 입력해 주세요." }, { status: 400 });
    }
    if (deliveryType === "file" && (!(fileValue instanceof File) || fileValue.size === 0)) {
      return Response.json({ error: "전달할 파일을 선택해 주세요." }, { status: 400 });
    }
    if (fileValue instanceof File && fileValue.size > MAX_FILE_BYTES) {
      return Response.json({ error: "파일은 25MB 이하만 업로드할 수 있습니다." }, { status: 413 });
    }

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
        (id, target_email, title, resource_type, request_note, delivery_type, external_url, object_key, file_name, mime_type, size_bytes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, targetEmail, title, resourceType, requestNote, deliveryType, deliveryType === "link" ? externalUrl : null, objectKey, fileName, mimeType, sizeBytes, user.email)
        .run();
    } catch (error) {
      if (objectKey) await env.FILES.delete(objectKey);
      throw error;
    }

    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "요청을 처리하지 못했습니다." }, { status: 500 });
  }
}

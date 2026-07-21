import { adminAuthConfigured, adminSessionCookie, clearAdminSessionCookie, createAdminSession, validAdminCredentials } from "../../admin-auth";
import { ensureCoreSchema } from "@/db/runtime";

export const dynamic = "force-dynamic";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

async function attemptKey(request: Request) {
  const address = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  if (!adminAuthConfigured()) return Response.json({ error: "관리자 로그인이 아직 설정되지 않았습니다." }, { status: 503 });

  const db = await ensureCoreSchema();
  const key = await attemptKey(request);
  const now = Date.now();
  const attempts = await db.prepare("SELECT attempts, window_started_at FROM admin_login_attempts WHERE id = ?")
    .bind(key).first<{ attempts: number; window_started_at: number }>();
  if (attempts && now - Number(attempts.window_started_at) < WINDOW_MS && Number(attempts.attempts) >= MAX_ATTEMPTS) {
    return Response.json({ error: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({})) as { username?: string; password?: string };
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!await validAdminCredentials(username, password)) {
    if (!attempts || now - Number(attempts.window_started_at) >= WINDOW_MS) {
      await db.prepare(`INSERT INTO admin_login_attempts (id, attempts, window_started_at) VALUES (?, 1, ?)
        ON CONFLICT(id) DO UPDATE SET attempts = 1, window_started_at = excluded.window_started_at`).bind(key, now).run();
    } else {
      await db.prepare("UPDATE admin_login_attempts SET attempts = attempts + 1 WHERE id = ?").bind(key).run();
    }
    return Response.json({ error: "관리자 계정 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  await db.prepare("DELETE FROM admin_login_attempts WHERE id = ?").bind(key).run();
  const token = await createAdminSession(username);
  return Response.json({ ok: true }, { headers: { "set-cookie": adminSessionCookie(request, token) } });
}

export async function DELETE(request: Request) {
  return Response.json({ ok: true }, { headers: { "set-cookie": clearAdminSessionCookie(request) } });
}

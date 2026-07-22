import { ensureCoreSchema } from "@/db/runtime";
import { createInstructorSession, instructorSessionCookie, verifyInstructorPassword } from "../../instructor-auth";

export const dynamic = "force-dynamic";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

async function attemptKey(request: Request, username: string) {
  const address = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`instructor:${address}:${username}`));
  return `instructor:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { username?: string; password?: string };
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!username || !password) return Response.json({ error: "아이디와 비밀번호를 입력해 주세요." }, { status: 400 });

  const db = await ensureCoreSchema();
  const key = await attemptKey(request, username);
  const now = Date.now();
  const attempts = await db.prepare("SELECT attempts, window_started_at FROM admin_login_attempts WHERE id = ?")
    .bind(key).first<{ attempts: number; window_started_at: number }>();
  if (attempts && now - Number(attempts.window_started_at) < WINDOW_MS && Number(attempts.attempts) >= MAX_ATTEMPTS) {
    return Response.json({ error: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요." }, { status: 429 });
  }

  const account = await db.prepare(`SELECT c.user_email, c.username, c.password_hash, c.password_salt
    FROM instructor_credentials c
    JOIN users u ON u.email = c.user_email AND u.role = 'instructor'
    JOIN instructor_profiles p ON p.user_email = u.email AND p.registered_by_admin = 1
    WHERE c.username = ?`).bind(username).first<{ user_email: string; username: string; password_hash: string; password_salt: string }>();
  const valid = account ? await verifyInstructorPassword(password, account.password_hash, account.password_salt) : false;
  if (!account || !valid) {
    if (!attempts || now - Number(attempts.window_started_at) >= WINDOW_MS) {
      await db.prepare(`INSERT INTO admin_login_attempts (id, attempts, window_started_at) VALUES (?, 1, ?)
        ON CONFLICT(id) DO UPDATE SET attempts = 1, window_started_at = excluded.window_started_at`).bind(key, now).run();
    } else {
      await db.prepare("UPDATE admin_login_attempts SET attempts = attempts + 1 WHERE id = ?").bind(key).run();
    }
    return Response.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  await db.prepare("DELETE FROM admin_login_attempts WHERE id = ?").bind(key).run();
  const token = await createInstructorSession(account.user_email, account.username);
  return Response.json({ ok: true }, { headers: { "set-cookie": instructorSessionCookie(request, token) } });
}

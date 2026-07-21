import { adminAuthConfigured, adminSessionCookie, clearAdminSessionCookie, createAdminSession, validAdminCredentials } from "../../admin-auth";
import { requestIdentity } from "../../session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!requestIdentity(request)) return Response.json({ error: "사이트 로그인이 필요합니다." }, { status: 401 });
  if (!adminAuthConfigured()) return Response.json({ error: "관리자 로그인이 아직 설정되지 않았습니다." }, { status: 503 });

  const body = await request.json().catch(() => ({})) as { username?: string; password?: string };
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!await validAdminCredentials(username, password)) {
    return Response.json({ error: "관리자 계정 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const token = await createAdminSession(username);
  return Response.json({ ok: true }, { headers: { "set-cookie": adminSessionCookie(request, token) } });
}

export async function DELETE(request: Request) {
  return Response.json({ ok: true }, { headers: { "set-cookie": clearAdminSessionCookie(request) } });
}

import { env } from "cloudflare:workers";
import { hasAdminSession } from "../../admin-auth";
import { ensureUser } from "../../session";

export const dynamic = "force-dynamic";

type ResourceRow = {
  id: string;
  target_email: string;
  delivery_type: "link" | "file";
  external_url: string | null;
  object_key: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await ensureUser(request);
    if (!session) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { id } = await params;
    const resource = await session.db.prepare(`SELECT id, target_email, delivery_type, external_url, object_key, file_name, mime_type, size_bytes
      FROM instructor_resources WHERE id = ?`).bind(id).first<ResourceRow>();
    if (!resource) return Response.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 });

    const canManage = session.user.role === "admin" || session.user.role === "superadmin" || await hasAdminSession(request);
    if (!canManage && resource.target_email !== session.user.email) {
      return Response.json({ error: "이 자료에 접근할 권한이 없습니다." }, { status: 403 });
    }

    if (resource.delivery_type === "link") {
      if (!resource.external_url) return Response.json({ error: "연결된 링크가 없습니다." }, { status: 404 });
      const target = new URL(resource.external_url);
      if (target.protocol !== "http:" && target.protocol !== "https:") {
        return Response.json({ error: "안전하지 않은 링크입니다." }, { status: 400 });
      }
      return Response.redirect(target.toString(), 302);
    }

    if (!resource.object_key) return Response.json({ error: "연결된 파일이 없습니다." }, { status: 404 });
    const object = await env.FILES.get(resource.object_key);
    if (!object) return Response.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("content-type", resource.mime_type || headers.get("content-type") || "application/octet-stream");
    headers.set("content-length", String(resource.size_bytes ?? object.size));
    headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(resource.file_name ?? "download")}`);
    headers.set("cache-control", "private, no-store");
    return new Response(object.body, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "자료를 열지 못했습니다." }, { status: 500 });
  }
}

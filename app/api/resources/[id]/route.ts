import { env } from "cloudflare:workers";
import { hasAdminSession } from "../../admin-auth";
import { ensureUser } from "../../session";
import { ensureCoreSchema } from "@/db/runtime";

export const dynamic = "force-dynamic";

type ResourceRow = {
  id: string;
  target_email: string;
  delivery_type: "text" | "link" | "file";
  placement: "roadmap" | "library" | "contract";
  external_url: string | null;
  object_key: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await ensureUser(request);
    const adminSession = await hasAdminSession(request);
    if (!session && !adminSession) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const db = session?.db ?? await ensureCoreSchema();
    const { id } = await params;
    const resource = await db.prepare(`SELECT id, target_email, delivery_type, placement, external_url, object_key, file_name, mime_type, size_bytes
      FROM instructor_resources WHERE id = ?`).bind(id).first<ResourceRow>();
    if (!resource) return Response.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 });

    const canManage = adminSession || session?.user.role === "admin" || session?.user.role === "superadmin";
    if (!canManage && resource.target_email !== session?.user.email) {
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

    if (resource.delivery_type === "text") {
      return Response.json({ error: "이 항목은 화면에서 확인하는 안내입니다." }, { status: 400 });
    }

    if (!resource.object_key) return Response.json({ error: "연결된 파일이 없습니다." }, { status: 404 });
    const object = await env.FILES.get(resource.object_key);
    if (!object) return Response.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("content-type", resource.mime_type || headers.get("content-type") || "application/octet-stream");
    headers.set("content-length", String(resource.size_bytes ?? object.size));
    headers.set("content-disposition", `${resource.placement === "contract" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(resource.file_name ?? "download")}`);
    headers.set("cache-control", "private, no-store");
    return new Response(object.body, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "자료를 열지 못했습니다." }, { status: 500 });
  }
}

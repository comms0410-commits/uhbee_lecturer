import { clearInstructorSessionCookie } from "../../instructor-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return new Response(null, {
    status: 302,
    headers: { location: "/", "set-cookie": clearInstructorSessionCookie(request) },
  });
}

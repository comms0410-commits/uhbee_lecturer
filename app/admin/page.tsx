import { headers } from "next/headers";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import { siteDisplayName } from "../display-name";
import { AdminPortal } from "./AdminPortal";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const signedInUser = await getChatGPTUser();

  if (!signedInUser && !isLocal) {
    return (
      <main className="signin-shell">
        <section className="signin-card" aria-labelledby="admin-signin-title">
          <div className="brand-mark">UhB</div>
          <span className="eyebrow">ADMIN CONSOLE</span>
          <h1 id="admin-signin-title">관리자 인증이<br />필요합니다.</h1>
          <p>강사 등록, 강사용 자료 전달과 강사별 진행 관리는 승인된 운영진만 이용할 수 있습니다.</p>
          <a className="primary-button signin-button" href={chatGPTSignInPath("/admin")}>ChatGPT로 관리자 인증하기 <span aria-hidden="true">→</span></a>
          <small>권한 확인은 서버에서 안전하게 처리됩니다.</small>
        </section>
      </main>
    );
  }

  return (
    <AdminPortal
      initialUser={{
        displayName: siteDisplayName(signedInUser?.displayName ?? "김어비"),
        email: signedInUser?.email ?? "demo@localhost",
      }}
    />
  );
}

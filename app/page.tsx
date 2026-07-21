import { headers } from "next/headers";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import { OnboardingApp } from "./OnboardingApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const signedInUser = await getChatGPTUser();

  if (!signedInUser && !isLocal) {
    return (
      <main className="signin-shell">
        <section className="signin-card" aria-labelledby="signin-title">
          <div className="brand-mark">UBII</div>
          <span className="eyebrow">강사 운영 내비게이션</span>
          <h1 id="signin-title">계약부터 첫 강의까지,<br />한 흐름으로 준비하세요.</h1>
          <p>내 진행 단계와 필수 체크리스트, 기획안 검토와 위기 대응을 한곳에서 관리합니다.</p>
          <a className="primary-button signin-button" href={chatGPTSignInPath("/")}>ChatGPT로 안전하게 시작하기 <span aria-hidden="true">→</span></a>
          <small>승인된 어비 강사와 운영진만 이용할 수 있습니다.</small>
        </section>
      </main>
    );
  }

  return (
    <OnboardingApp
      initialUser={{
        displayName: signedInUser?.displayName ?? "김어비",
        email: signedInUser?.email ?? "demo@localhost",
      }}
    />
  );
}

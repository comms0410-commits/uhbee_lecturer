"use client";

import { useEffect, useState, type FormEvent } from "react";
import { OnboardingApp } from "./OnboardingApp";

type Identity = { displayName: string; email: string };

export function InstructorAccess() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [checking, setChecking] = useState(true);
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const check = async () => {
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json() as { user: { displayName: string; email: string } };
        setIdentity(data.user);
      }
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { void check(); }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/instructor/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(credentials),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "로그인하지 못했습니다.");
      await check();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "로그인하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (checking) return <main className="signin-shell"><section className="signin-card signin-loading"><div className="brand-mark">UhB</div><p>강사 계정을 확인하고 있습니다.</p></section></main>;
  if (identity) return <OnboardingApp initialUser={identity} />;

  return <main className="signin-shell"><section className="signin-card instructor-login-card" aria-labelledby="instructor-signin-title">
    <div className="brand-mark">UhB</div><span className="eyebrow">INSTRUCTOR SIGN IN</span>
    <h1 id="instructor-signin-title">강사 계정으로<br />로그인하세요.</h1>
    <p>관리자가 등록할 때 발급한 아이디와 비밀번호를 입력해 주세요.</p>
    <form onSubmit={login}><label><span>강사 아이디</span><input required autoComplete="username" value={credentials.username} onChange={(event) => setCredentials({ ...credentials, username: event.target.value })} /></label><label><span>비밀번호</span><input required type="password" autoComplete="current-password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} /></label>{error && <div className="signin-error" role="alert">{error}</div>}<button className="primary-button signin-button" disabled={busy}>{busy ? "확인하는 중…" : "강사 로그인"}<span aria-hidden="true">→</span></button></form>
    <small>계정을 잊은 경우 관리자에게 문의해 주세요.</small>
  </section></main>;
}

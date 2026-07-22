"use client";

import { useEffect, useState, type FormEvent } from "react";
import { OnboardingApp } from "./OnboardingApp";

type Identity = { displayName: string; email: string };

export function InstructorAccess() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<"instructor" | "admin">("instructor");
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [adminCredentials, setAdminCredentials] = useState({ username: "uhbee", password: "" });
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

  const adminLogin = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(adminCredentials),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "관리자 로그인에 실패했습니다.");
      window.location.assign("/admin");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "관리자 로그인에 실패했습니다.");
      setBusy(false);
    }
  };

  const selectMode = (nextMode: "instructor" | "admin") => {
    setMode(nextMode);
    setError("");
  };

  if (checking) return <main className="signin-shell"><section className="signin-card signin-loading"><div className="brand-mark">UhB</div><p>강사 계정을 확인하고 있습니다.</p></section></main>;
  if (identity) return <OnboardingApp initialUser={identity} />;

  return <main className="signin-shell"><section className="signin-card instructor-login-card" aria-labelledby="account-signin-title">
    <div className="brand-mark">UhB</div>
    <div className="login-role-switch" role="tablist" aria-label="로그인 유형"><button type="button" role="tab" aria-selected={mode === "instructor"} className={mode === "instructor" ? "active" : ""} onClick={() => selectMode("instructor")}>강사 로그인</button><button type="button" role="tab" aria-selected={mode === "admin"} className={mode === "admin" ? "active" : ""} onClick={() => selectMode("admin")}>관리자 로그인</button></div>
    <span className="eyebrow">{mode === "instructor" ? "INSTRUCTOR SIGN IN" : "ADMIN SIGN IN"}</span>
    <h1 id="account-signin-title">{mode === "instructor" ? <>강사 계정으로<br />로그인하세요.</> : <>관리자 계정으로<br />로그인하세요.</>}</h1>
    <p>{mode === "instructor" ? "관리자가 등록할 때 발급한 아이디와 비밀번호를 입력해 주세요." : "강사 등록과 운영 자료 관리를 위한 관리자 전용 화면입니다."}</p>
    {mode === "instructor" ? <form onSubmit={login}><label><span>강사 아이디</span><input required autoComplete="username" value={credentials.username} onChange={(event) => setCredentials({ ...credentials, username: event.target.value })} /></label><label><span>비밀번호</span><input required type="password" autoComplete="current-password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} /></label>{error && <div className="signin-error" role="alert">{error}</div>}<button className="primary-button signin-button" disabled={busy}>{busy ? "확인하는 중…" : "강사 로그인"}<span aria-hidden="true">→</span></button></form> : <form onSubmit={adminLogin}><label><span>관리자 아이디</span><input required autoComplete="username" value={adminCredentials.username} onChange={(event) => setAdminCredentials({ ...adminCredentials, username: event.target.value })} /></label><label><span>비밀번호</span><input required type="password" autoComplete="current-password" value={adminCredentials.password} onChange={(event) => setAdminCredentials({ ...adminCredentials, password: event.target.value })} /></label>{error && <div className="signin-error" role="alert">{error}</div>}<button className="primary-button signin-button" disabled={busy}>{busy ? "확인하는 중…" : "관리자 로그인"}<span aria-hidden="true">→</span></button></form>}
    <small>{mode === "instructor" ? "계정을 잊은 경우 관리자에게 문의해 주세요." : "관리자 계정은 승인된 운영진만 사용해 주세요."}</small>
  </section></main>;
}

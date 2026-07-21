"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type Instructor = {
  email: string;
  display_name: string;
  role: string;
  created_at: string;
  grade: string;
  contract_status: string;
  settlement_rate: number;
  specialty: string;
  manager_name: string;
  manager_email: string;
  task_count: number;
  done_count: number;
};

type Resource = {
  id: string;
  target_email: string;
  target_name: string;
  title: string;
  resource_type: string;
  request_note: string;
  delivery_type: "link" | "file";
  external_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_by: string;
  created_at: string;
};

type AdminData = {
  user: { email: string; displayName: string; role: string };
  instructors: Instructor[];
  resources: Resource[];
};

const emptyInstructor = {
  displayName: "",
  email: "",
  specialty: "",
  grade: "연습강사",
  settlementRate: "50",
  managerName: "",
  managerEmail: "",
};

const emptyResource = {
  targetEmail: "",
  title: "",
  resourceType: "전자책",
  requestNote: "",
  deliveryType: "link" as "link" | "file",
  externalUrl: "",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function formatBytes(value: number | null) {
  if (!value) return "파일";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))}KB`;
  return `${(value / (1024 * 1024)).toFixed(1)}MB`;
}

export function AdminPortal({ initialUser }: { initialUser: { displayName: string; email: string } }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState<"instructors" | "resources">("instructors");
  const [instructor, setInstructor] = useState(emptyInstructor);
  const [resource, setResource] = useState(emptyResource);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"" | "load" | "instructor" | "resource">("load");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setBusy("load");
    setError("");
    try {
      const response = await fetch("/api/admin", { cache: "no-store" });
      const payload = await response.json() as AdminData & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "관리자 데이터를 불러오지 못했습니다.");
      setData(payload);
      setResource((current) => ({ ...current, targetEmail: current.targetEmail || payload.instructors[0]?.email || "" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "관리자 데이터를 불러오지 못했습니다.");
    } finally {
      setBusy("");
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [message]);

  const completedAverage = useMemo(() => {
    if (!data?.instructors.length) return 0;
    const total = data.instructors.reduce((sum, item) => sum + (Number(item.done_count) / Math.max(Number(item.task_count), 1)) * 100, 0);
    return Math.round(total / data.instructors.length);
  }, [data]);

  const registerInstructor = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("instructor");
    setError("");
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "registerInstructor", ...instructor, settlementRate: Number(instructor.settlementRate) }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "강사를 등록하지 못했습니다.");
      setInstructor(emptyInstructor);
      setMessage("신규 강사와 기본 온보딩 7단계를 등록했습니다.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "강사를 등록하지 못했습니다.");
      setBusy("");
    }
  };

  const createResource = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("resource");
    setError("");
    try {
      const form = new FormData();
      form.set("action", "createResource");
      Object.entries(resource).forEach(([key, value]) => form.set(key, value));
      if (file) form.set("file", file);
      const response = await fetch("/api/admin", { method: "POST", body: form });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "자료를 전달하지 못했습니다.");
      const targetEmail = resource.targetEmail;
      setResource({ ...emptyResource, targetEmail });
      setFile(null);
      const fileInput = document.getElementById("resource-file") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      setMessage("강사의 자료실에 요청 자료를 전달했습니다.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "자료를 전달하지 못했습니다.");
      setBusy("");
    }
  };

  if (error && !data) {
    return (
      <main className="admin-access-shell">
        <section className="admin-access-card">
          <span>ACCESS RESTRICTED</span>
          <h1>관리자 페이지에<br />접근할 수 없습니다.</h1>
          <p>{error}</p>
          <div><a className="primary-button" href="/">강사 센터로 돌아가기</a><button className="secondary-button" onClick={() => void load()}>다시 확인</button></div>
        </section>
      </main>
    );
  }

  return (
    <div className="admin-portal-shell">
      <aside className="admin-portal-sidebar">
        <a className="admin-wordmark" href="/"><strong>UhB</strong><span>ADMIN<br />CONSOLE</span></a>
        <div className="admin-identity"><span>{(data?.user.displayName ?? initialUser.displayName).slice(0, 1)}</span><div><strong>{data?.user.displayName ?? initialUser.displayName}</strong><small>{data?.user.role === "superadmin" ? "최고관리자" : "관리자"}</small></div></div>
        <nav aria-label="관리자 메뉴">
          <button className={tab === "instructors" ? "active" : ""} onClick={() => setTab("instructors")}><span>01</span>강사 관리</button>
          <button className={tab === "resources" ? "active" : ""} onClick={() => setTab("resources")}><span>02</span>요청 자료 전달</button>
        </nav>
        <a className="admin-back-link" href="/"><span>←</span> 강사 센터로 돌아가기</a>
      </aside>

      <section className="admin-portal-content">
        <header className="admin-portal-topbar"><div><span>OPERATIONS</span><strong>{tab === "instructors" ? "강사 관리" : "요청 자료 전달"}</strong></div><div><i className={busy === "load" ? "loading" : ""} />{busy === "load" ? "데이터 확인 중" : "운영 데이터 연결됨"}</div></header>
        <main className="admin-portal-stage">
          <div className="admin-page-heading"><div><span>INSTRUCTOR OPERATIONS</span><h1>강사 운영을 한곳에서<br />정확하게 관리하세요.</h1><p>신규 강사를 등록하고, 강사가 요청한 전자책·템플릿·강의자료를 파일 또는 링크로 바로 전달합니다.</p></div><button className="secondary-button" onClick={() => void load()} disabled={busy === "load"}>새로고침</button></div>

          <section className="admin-metric-grid">
            <article><span>등록 강사</span><strong>{data?.instructors.length ?? 0}</strong><small>명</small></article>
            <article><span>평균 온보딩</span><strong>{completedAverage}</strong><small>%</small></article>
            <article><span>전달 자료</span><strong>{data?.resources.length ?? 0}</strong><small>건</small></article>
            <article className="dark"><span>운영 계정</span><strong>{data?.user.role === "superadmin" ? "SUPER" : "ADMIN"}</strong><small>{data?.user.email ?? initialUser.email}</small></article>
          </section>

          <div className="admin-tabs" role="tablist"><button className={tab === "instructors" ? "active" : ""} onClick={() => setTab("instructors")}>신규 강사 등록</button><button className={tab === "resources" ? "active" : ""} onClick={() => setTab("resources")}>파일·링크 전달</button></div>

          {tab === "instructors" ? (
            <div className="admin-work-grid">
              <form className="admin-form-panel" onSubmit={registerInstructor}>
                <div className="admin-panel-title"><span>NEW INSTRUCTOR</span><h2>신규 강사 등록</h2><p>등록 즉시 강사 계정과 기본 온보딩 7단계가 생성됩니다.</p></div>
                <div className="admin-form-grid two"><label><span>강사명 *</span><input required value={instructor.displayName} onChange={(event) => setInstructor({ ...instructor, displayName: event.target.value })} placeholder="홍길동" /></label><label><span>이메일 *</span><input required type="email" value={instructor.email} onChange={(event) => setInstructor({ ...instructor, email: event.target.value })} placeholder="instructor@example.com" /></label></div>
                <div className="admin-form-grid two"><label><span>전문 분야</span><input value={instructor.specialty} onChange={(event) => setInstructor({ ...instructor, specialty: event.target.value })} placeholder="AI 업무자동화" /></label><label><span>강사 등급</span><select value={instructor.grade} onChange={(event) => setInstructor({ ...instructor, grade: event.target.value })}><option>연습강사</option><option>파트너강사</option><option>전문강사</option><option>마스터강사</option></select></label></div>
                <div className="admin-form-grid three"><label><span>정산율 (%)</span><input type="number" min="0" max="100" value={instructor.settlementRate} onChange={(event) => setInstructor({ ...instructor, settlementRate: event.target.value })} /></label><label><span>담당 매니저</span><input value={instructor.managerName} onChange={(event) => setInstructor({ ...instructor, managerName: event.target.value })} placeholder={data?.user.displayName ?? initialUser.displayName} /></label><label><span>매니저 이메일</span><input type="email" value={instructor.managerEmail} onChange={(event) => setInstructor({ ...instructor, managerEmail: event.target.value })} placeholder={data?.user.email ?? initialUser.email} /></label></div>
                <button className="primary-button full" disabled={busy === "instructor"}>{busy === "instructor" ? "등록하는 중…" : "신규 강사 등록하기"}</button>
              </form>

              <section className="admin-list-panel">
                <div className="admin-panel-title compact"><span>INSTRUCTOR LIST</span><h2>등록 강사</h2><p>{data?.instructors.length ?? 0}명의 진행 상태를 확인합니다.</p></div>
                <div className="admin-instructor-list">
                  {data?.instructors.map((item) => {
                    const progress = Math.round((Number(item.done_count) / Math.max(Number(item.task_count), 1)) * 100);
                    return <article key={item.email}><div className="admin-avatar">{item.display_name.slice(0, 1)}</div><div><strong>{item.display_name}<em>{item.grade}</em></strong><span>{item.specialty} · {item.email}</span><div className="admin-progress"><i><b style={{ width: `${progress}%` }} /></i><small>{progress}%</small></div></div><time>{formatDate(item.created_at)}</time></article>;
                  })}
                  {!data?.instructors.length && <div className="admin-empty"><strong>아직 등록된 강사가 없습니다.</strong><span>왼쪽 양식에서 첫 강사를 등록해 주세요.</span></div>}
                </div>
              </section>
            </div>
          ) : (
            <div className="admin-work-grid">
              <form className="admin-form-panel" onSubmit={createResource}>
                <div className="admin-panel-title"><span>RESOURCE DELIVERY</span><h2>요청 자료 전달</h2><p>강사의 요청 내용을 기록하고 파일 또는 링크를 개인 자료실에 보냅니다.</p></div>
                <div className="admin-form-grid two"><label><span>대상 강사 *</span><select required value={resource.targetEmail} onChange={(event) => setResource({ ...resource, targetEmail: event.target.value })}><option value="">강사를 선택하세요</option>{data?.instructors.map((item) => <option key={item.email} value={item.email}>{item.display_name} · {item.email}</option>)}</select></label><label><span>자료 종류</span><select value={resource.resourceType} onChange={(event) => setResource({ ...resource, resourceType: event.target.value })}><option>전자책</option><option>템플릿</option><option>강의자료</option><option>워크시트</option><option>기타</option></select></label></div>
                <label><span>자료명 *</span><input required value={resource.title} onChange={(event) => setResource({ ...resource, title: event.target.value })} placeholder="요청한 전자책 또는 자료 이름" /></label>
                <label><span>강사 요청 내용</span><textarea rows={4} value={resource.requestNote} onChange={(event) => setResource({ ...resource, requestNote: event.target.value })} placeholder="요청 배경, 필요한 범위, 전달 메모를 기록하세요." /></label>
                <div className="delivery-switch" aria-label="전달 방식"><button type="button" className={resource.deliveryType === "link" ? "active" : ""} onClick={() => setResource({ ...resource, deliveryType: "link" })}>링크로 전달</button><button type="button" className={resource.deliveryType === "file" ? "active" : ""} onClick={() => setResource({ ...resource, deliveryType: "file" })}>파일 업로드</button></div>
                {resource.deliveryType === "link" ? <label><span>자료 링크 *</span><input required type="url" value={resource.externalUrl} onChange={(event) => setResource({ ...resource, externalUrl: event.target.value })} placeholder="https://…" /></label> : <label className="admin-file-field"><span>업로드 파일 * <small>최대 25MB</small></span><input id="resource-file" required type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><em>{file ? `${file.name} · ${formatBytes(file.size)}` : "전자책, PDF, 문서, 압축 파일 등을 선택하세요."}</em></label>}
                <button className="primary-button full" disabled={busy === "resource" || !data?.instructors.length}>{busy === "resource" ? "전달하는 중…" : "강사 자료실에 전달하기"}</button>
              </form>

              <section className="admin-list-panel">
                <div className="admin-panel-title compact"><span>DELIVERY HISTORY</span><h2>최근 전달 내역</h2><p>강사별 파일과 링크를 다시 열어 확인할 수 있습니다.</p></div>
                <div className="admin-resource-list">
                  {data?.resources.map((item) => <article key={item.id}><span className={`resource-kind ${item.delivery_type}`}>{item.delivery_type === "file" ? "FILE" : "LINK"}</span><div><strong>{item.title}</strong><span>{item.target_name} · {item.resource_type}</span><small>{item.delivery_type === "file" ? `${item.file_name} · ${formatBytes(item.size_bytes)}` : item.external_url}</small></div><div><time>{formatDate(item.created_at)}</time><a href={`/api/resources/${item.id}`} target="_blank" rel="noreferrer">열기 ↗</a></div></article>)}
                  {!data?.resources.length && <div className="admin-empty"><strong>아직 전달한 자료가 없습니다.</strong><span>강사의 첫 요청 자료를 등록해 주세요.</span></div>}
                </div>
              </section>
            </div>
          )}
        </main>
      </section>
      {error && data && <div className="admin-toast error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}
      {message && <div className="admin-toast" role="status">✓ {message}</div>}
    </div>
  );
}

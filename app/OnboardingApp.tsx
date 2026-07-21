"use client";

import { useEffect, useMemo, useState } from "react";
import { siteDisplayName } from "./display-name";

type TaskStatus = "not_started" | "in_progress" | "review" | "revision" | "done";
type Section = "home" | "roadmap" | "planner" | "operations" | "zoom" | "coach" | "crisis" | "library" | "support";

type Task = {
  id: string;
  stage: number;
  title: string;
  category: string;
  status: TaskStatus;
  due_date: string | null;
  sort_order: number;
};

type DeliveredResource = {
  id: string;
  title: string;
  resource_type: string;
  request_note: string;
  delivery_type: "link" | "file";
  external_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

type Workspace = {
  user: { email: string; displayName: string; role: "instructor" | "admin" | "superadmin" };
  profile: { grade: string; contract_status: string; settlement_rate: number; specialty: string; manager_name: string; manager_email: string };
  tasks: Task[];
  plan: { content: Record<string, string>; status: string; version: number; reviewerComment: string | null; updatedAt: string | null };
  issues: Array<{ id: string; severity: number; category: string; course_name: string; status: string; created_at: string }>;
  resources: DeliveredResource[];
};

const navItems: Array<{ id: Section; label: string; code: string }> = [
  { id: "home", label: "내 진행현황", code: "01" },
  { id: "roadmap", label: "강사 육성 로드맵", code: "02" },
  { id: "planner", label: "강의 기획안", code: "03" },
  { id: "operations", label: "강의 운영 매뉴얼", code: "04" },
  { id: "zoom", label: "Zoom 사용법", code: "05" },
  { id: "coach", label: "코치방·수강생", code: "06" },
  { id: "crisis", label: "위기대응 센터", code: "07" },
  { id: "library", label: "자료실", code: "08" },
  { id: "support", label: "문의·지원", code: "09" },
];

const defaultTasks: Task[] = [
  { id: "profile", stage: 1, title: "강사 프로필과 전문 분야 등록", category: "기본 정보", status: "done", due_date: "7월 18일", sort_order: 0 },
  { id: "channel", stage: 2, title: "채널 진단 결과 제출", category: "채널·콘텐츠", status: "done", due_date: "7월 19일", sort_order: 1 },
  { id: "skills", stage: 3, title: "강의 스킬 기본교육 이수", category: "강사 역량", status: "done", due_date: "7월 20일", sort_order: 2 },
  { id: "plan", stage: 4, title: "무료강의 기획안 보완", category: "강의 설계", status: "revision", due_date: "오늘", sort_order: 3 },
  { id: "rehearsal", stage: 5, title: "Zoom 리허설 참여", category: "운영 검증", status: "in_progress", due_date: "7월 23일", sort_order: 4 },
  { id: "coach", stage: 6, title: "코치방 개설 및 링크 제출", category: "수강생 성공", status: "not_started", due_date: "7월 25일", sort_order: 5 },
  { id: "safety", stage: 7, title: "위기대응 교육 확인", category: "위험 관리", status: "not_started", due_date: "7월 26일", sort_order: 6 },
];

const emptyWorkspace = (name: string, email: string): Workspace => ({
  user: { email, displayName: name, role: "superadmin" },
  profile: { grade: "연습강사", contract_status: "계약 완료", settlement_rate: 50, specialty: "AI 업무자동화", manager_name: "이수민 매니저", manager_email: "support@ubii.co.kr" },
  tasks: defaultTasks,
  plan: { content: {}, status: "draft", version: 1, reviewerComment: "성과 표현의 근거와 실습 완료 기준을 조금 더 구체적으로 적어 주세요.", updatedAt: null },
  issues: [],
  resources: [],
});

const statusMeta: Record<TaskStatus, { label: string; tone: string }> = {
  not_started: { label: "미시작", tone: "neutral" },
  in_progress: { label: "진행 중", tone: "blue" },
  review: { label: "검토 대기", tone: "orange" },
  revision: { label: "보완 필요", tone: "red" },
  done: { label: "완료", tone: "green" },
};

const planSteps = ["강의 기본 정보", "수강생 이해", "강의 목표", "회차별 커리큘럼", "무료강의 설계", "운영 설계", "수강생 지원", "표현·운영 점검"];

function displayFirstName(name: string) {
  const trimmed = siteDisplayName(name).trim();
  if (!trimmed) return "강사";
  return trimmed.includes("@") ? "강사" : trimmed.split(" ")[0];
}

export function OnboardingApp({ initialUser }: { initialUser: { displayName: string; email: string } }) {
  const [workspace, setWorkspace] = useState<Workspace>(() => emptyWorkspace(initialUser.displayName, initialUser.email));
  const [active, setActive] = useState<Section>("home");
  const [syncState, setSyncState] = useState<"loading" | "ready" | "offline">("loading");
  const [toast, setToast] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/workspace", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("workspace unavailable");
        return response.json() as Promise<Workspace>;
      })
      .then((data) => { if (!cancelled) { setWorkspace(data); setSyncState("ready"); } })
      .catch(() => { if (!cancelled) setSyncState("offline"); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const completed = workspace.tasks.filter((task) => task.status === "done").length;
  const progress = Math.round((completed / Math.max(workspace.tasks.length, 1)) * 100);
  const nextTask = workspace.tasks.find((task) => task.status !== "done") ?? workspace.tasks[workspace.tasks.length - 1];

  const apiPatch = async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/workspace", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(result.error ?? "저장하지 못했습니다.");
    }
    return response.json();
  };

  const toggleTask = async (task: Task) => {
    const nextStatus: TaskStatus = task.status === "done" ? "in_progress" : "done";
    setWorkspace((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item) }));
    try {
      await apiPatch({ action: "toggleTask", id: task.id, status: nextStatus });
      setToast(nextStatus === "done" ? "완료로 기록했어요." : "진행 중으로 되돌렸어요.");
    } catch (error) {
      setWorkspace((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === task.id ? task : item) }));
      setToast(error instanceof Error ? error.message : "저장하지 못했습니다.");
    }
  };

  const moveTo = (section: Section) => { setActive(section); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="wordmark" onClick={() => moveTo("home")} aria-label="어비 강사 센터 홈">
          <span className="wordmark-main">UhB</span><span className="wordmark-sub">INSTRUCTOR CENTER</span>
        </button>
        <div className="profile-mini">
          <div className="avatar">{displayFirstName(workspace.user.displayName).slice(0, 1)}</div>
          <div><strong>{displayFirstName(workspace.user.displayName)} 강사</strong><span>{workspace.profile.grade} · {workspace.profile.specialty}</span></div>
        </div>
        <nav aria-label="주요 메뉴">
          <p className="nav-label">강사 가이드</p>
          {navItems.map((item) => (
            <button key={item.id} className={`nav-item ${active === item.id ? "active" : ""}`} onClick={() => moveTo(item.id)}>
              <span className="nav-code">{item.code}</span><span>{item.label}</span>
              {item.id === "crisis" && <span className="nav-alert">!</span>}
            </button>
          ))}
          <p className="nav-label nav-label-admin">운영 관리</p>
          <a className="nav-item" href="/admin"><span className="nav-code">A</span><span>관리자 페이지</span><span className="nav-count">↗</span></a>
        </nav>
        <div className="sidebar-foot">
          <span className={`sync-dot ${syncState}`} />
          <div><strong>{syncState === "ready" ? "안전하게 저장 중" : syncState === "offline" ? "미리보기 모드" : "데이터 연결 중"}</strong><span>마지막 확인 · 방금 전</span></div>
        </div>
      </aside>

      <section className="app-content">
        <header className="topbar">
          <button className="mobile-brand" onClick={() => moveTo("home")}>UhB</button>
          <div className="top-context"><span>강사 가이드</span><strong>{navItems.find((item) => item.id === active)?.label}</strong></div>
          <div className="top-actions">
            <div className="view-switch" aria-label="화면 전환"><button className="selected" onClick={() => setActive("home")}>강사 화면</button><a href="/admin">관리자 페이지</a></div>
            <a className="mobile-admin-link" href="/admin">관리자</a>
            <button className="icon-button" aria-label="알림 3개"><span className="bell-shape" aria-hidden="true" /><b>3</b></button>
            <a className="user-pill" href="/signout-with-chatgpt?return_to=%2F" title="로그아웃"><span>{displayFirstName(workspace.user.displayName).slice(0, 1)}</span><strong>{displayFirstName(workspace.user.displayName)}</strong></a>
          </div>
        </header>

        <main className="main-stage">
          <>
              {active === "home" && <HomeDashboard workspace={workspace} progress={progress} nextTask={nextTask} onToggle={toggleTask} onMove={moveTo} />}
              {active === "roadmap" && <Roadmap tasks={workspace.tasks} onToggle={toggleTask} />}
              {active === "planner" && <Planner workspace={workspace} setWorkspace={setWorkspace} apiPatch={apiPatch} notify={setToast} />}
              {active === "operations" && <Operations notify={setToast} />}
              {active === "zoom" && <ZoomGuide notify={setToast} />}
              {active === "coach" && <CoachGuide notify={setToast} />}
              {active === "crisis" && <CrisisCenter workspace={workspace} setWorkspace={setWorkspace} apiPatch={apiPatch} notify={setToast} />}
              {active === "library" && <Library resources={workspace.resources} notify={setToast} />}
              {active === "support" && <Support notify={setToast} />}
          </>
        </main>

        <nav className="mobile-nav" aria-label="모바일 빠른 메뉴">
          {[navItems[0], navItems[1], navItems[2], navItems[6], navItems[7]].map((item) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => moveTo(item.id)}><span>{item.code}</span>{item.label.replace("강사 ", "").replace("·수강생", "")}</button>)}
        </nav>
      </section>
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const meta = statusMeta[status];
  return <span className={`status-badge ${meta.tone}`}><i />{meta.label}</span>;
}

function HomeDashboard({ workspace, progress, nextTask, onToggle, onMove }: { workspace: Workspace; progress: number; nextTask: Task; onToggle: (task: Task) => void; onMove: (section: Section) => void }) {
  const firstName = displayFirstName(workspace.user.displayName);
  return (
    <div className="page home-page">
      <PageHeading eyebrow="TODAY · 2026. 07. 21" title={`안녕하세요, ${firstName} 강사님`} description="첫 무료강의까지 4일 남았어요. 오늘은 기획안 보완에 집중하면 됩니다." action={<button className="secondary-button" onClick={() => onMove("support")}>담당자에게 문의</button>} />
      <section className="priority-card">
        <div className="priority-copy">
          <span className="priority-kicker"><i /> 지금 가장 먼저 할 일</span>
          <h2>{nextTask.title}</h2>
          <p>관리자 피드백 2건을 반영한 뒤 다시 검토를 요청해 주세요. 예상 소요 시간은 약 25분입니다.</p>
          <div className="priority-meta"><span>마감 <strong>{nextTask.due_date}</strong></span><span>담당 <strong>{workspace.profile.manager_name}</strong></span><span>현재 <StatusBadge status={nextTask.status} /></span></div>
          <button className="light-button" onClick={() => onMove(nextTask.stage === 4 ? "planner" : "roadmap")}>이어서 작성하기 <span aria-hidden="true">→</span></button>
        </div>
        <div className="progress-orbit" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><div><strong>{progress}%</strong><span>전체 여정</span></div></div>
      </section>

      <div className="dashboard-grid">
        <section className="panel today-panel">
          <div className="panel-head"><div><span className="section-index">01</span><h2>오늘의 체크리스트</h2></div><button className="text-button" onClick={() => onMove("roadmap")}>전체 보기 →</button></div>
          <div className="task-list">
            {workspace.tasks.slice(3, 6).map((task) => (
              <div className="task-row" key={task.id}>
                <button className={`check-control ${task.status === "done" ? "checked" : ""}`} onClick={() => onToggle(task)} aria-label={`${task.title} ${task.status === "done" ? "완료 취소" : "완료"}`}><span>✓</span></button>
                <div className="task-copy"><strong>{task.title}</strong><span>{task.category} · {task.due_date}</span></div>
                <StatusBadge status={task.status} />
              </div>
            ))}
          </div>
          <div className="feedback-note"><span className="feedback-avatar">이</span><div><strong>이수민 매니저의 피드백</strong><p>“기대 변화”를 수강생 행동으로 바꾸면 기획안이 훨씬 명확해질 것 같아요.</p></div><button onClick={() => onMove("planner")}>확인</button></div>
        </section>

        <aside className="panel status-panel">
          <div className="panel-head"><div><span className="section-index">02</span><h2>내 강사 상태</h2></div><span className="grade-badge">{workspace.profile.grade}</span></div>
          <dl className="profile-facts"><div><dt>계약 상태</dt><dd><span className="mini-check">✓</span>{workspace.profile.contract_status}</dd></div><div><dt>전문 분야</dt><dd>{workspace.profile.specialty}</dd></div><div><dt>정산 비율</dt><dd>{workspace.profile.settlement_rate}%</dd></div><div><dt>담당 관리자</dt><dd>{workspace.profile.manager_name}</dd></div></dl>
          <a className="manager-contact" href={`mailto:${workspace.profile.manager_email}`}><span className="avatar small">이</span><div><strong>{workspace.profile.manager_name}</strong><span>{workspace.profile.manager_email}</span></div><b>메일</b></a>
        </aside>
      </div>

      <section className="panel journey-panel">
        <div className="panel-head"><div><span className="section-index">03</span><h2>나의 강사 여정</h2></div><span className="quiet-copy">7단계 중 {workspace.tasks.filter((task) => task.status === "done").length}단계 완료</span></div>
        <div className="journey-track">
          {workspace.tasks.map((task, index) => <button key={task.id} className={`journey-step ${task.status}`} onClick={() => onMove(index === 3 ? "planner" : "roadmap")}><span className="journey-dot">{task.status === "done" ? "✓" : task.stage}</span><strong>{task.category}</strong><small>{statusMeta[task.status].label}</small></button>)}
        </div>
      </section>

      <div className="quick-grid">
        <button className="quick-card cobalt" onClick={() => onMove("planner")}><span>기획안</span><strong>강의 기획안<br />이어서 작성</strong><b>→</b></button>
        <button className="quick-card ivory" onClick={() => onMove("zoom")}><span>리허설</span><strong>Zoom 준비<br />체크하기</strong><b>→</b></button>
        <button className="quick-card ivory" onClick={() => onMove("coach")}><span>수강생</span><strong>코치방 개설<br />가이드 보기</strong><b>→</b></button>
        <button className="quick-card coral" onClick={() => onMove("crisis")}><span>긴급 지원</span><strong>위기 이슈<br />신고하기</strong><b>→</b></button>
      </div>
    </div>
  );
}

function Roadmap({ tasks, onToggle }: { tasks: Task[]; onToggle: (task: Task) => void }) {
  const descriptions = ["프로필, 전문 분야, 계약·정산 정보를 확인합니다.", "채널 진단과 콘텐츠 개선 과제를 정리합니다.", "강의 스킬과 커리큘럼 구성 원칙을 익힙니다.", "기획안과 무료강의 자료를 완성하고 검토받습니다.", "OT와 Zoom 리허설을 통과해 운영을 검증합니다.", "코치방 운영 기록과 성공사례를 축적합니다.", "민원·위기 이슈의 1·2·3단계 대응을 익힙니다."];
  return <div className="page"><PageHeading eyebrow="GROWTH ROADMAP" title="전문강사까지, 7단계로 준비합니다" description="각 단계의 완료 기준을 확인하고 하나씩 체크하세요. 검토가 필요한 단계는 담당 관리자가 함께 확인합니다." />
    <div className="roadmap-summary"><div><strong>{tasks.filter((t) => t.status === "done").length}<span>/7</span></strong><p>완료한 단계</p></div><div className="roadmap-line"><i style={{ width: `${tasks.filter((t) => t.status === "done").length / 7 * 100}%` }} /></div><span>현재 <b>4. 강의 설계</b> 진행 중</span></div>
    <div className="roadmap-list">{tasks.map((task) => <article className={`roadmap-card ${task.status}`} key={task.id}><div className="roadmap-number">{String(task.stage).padStart(2, "0")}</div><div className="roadmap-body"><div className="roadmap-title"><div><span>{task.category}</span><h2>{task.title}</h2></div><StatusBadge status={task.status} /></div><p>{descriptions[task.stage - 1]}</p><div className="roadmap-actions"><button className="secondary-button">학습하기</button><button className="secondary-button">자료 다운로드</button><button className="secondary-button">과제 제출</button><button className={`complete-button ${task.status === "done" ? "done" : ""}`} onClick={() => onToggle(task)}>{task.status === "done" ? "✓ 완료됨" : "완료 체크"}</button></div><footer><span>완료 기준</span><strong>{task.stage === 4 ? "관리자 검토 승인" : task.stage === 5 ? "리허설 통과" : "필수 항목 확인 및 제출"}</strong><small>마감 {task.due_date}</small></footer></div></article>)}</div>
  </div>;
}

function Planner({ workspace, setWorkspace, apiPatch, notify }: { workspace: Workspace; setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>; apiPatch: (payload: Record<string, unknown>) => Promise<unknown>; notify: (message: string) => void }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const content = workspace.plan.content;
  const update = (key: string, value: string) => setWorkspace((current) => ({ ...current, plan: { ...current.plan, content: { ...current.plan.content, [key]: value } } }));
  const save = async (submit = false) => { setSaving(true); try { await apiPatch({ action: submit ? "submitPlan" : "savePlan", content }); setWorkspace((current) => ({ ...current, plan: { ...current.plan, status: submit ? "review" : "draft" } })); notify(submit ? "관리자에게 검토를 요청했어요." : "기획안을 안전하게 저장했어요."); } catch (error) { notify(error instanceof Error ? error.message : "저장하지 못했습니다."); } finally { setSaving(false); } };
  const fieldSets = [
    [{ key: "courseTitle", label: "강의명", placeholder: "예: 반복 업무를 줄이는 AI 자동화 실전" }, { key: "audience", label: "대상 수강생", placeholder: "예: 생성형 AI를 처음 업무에 적용하는 실무자" }, { key: "format", label: "강의 형태·시간·정원", placeholder: "무료강의 · 90분 · 최대 70명" }, { key: "expertise", label: "강사의 전문성과 경험", placeholder: "이 강의를 진행할 수 있는 실제 경험과 근거를 적어 주세요." }],
    [{ key: "currentSituation", label: "수강생의 현재 상황", placeholder: "지금 어떤 상황에서 무엇을 어려워하나요?" }, { key: "painPoint", label: "해결하려는 핵심 불편", placeholder: "강의를 듣지 않으면 계속되는 불편을 구체적으로 적어 주세요." }, { key: "expectedChange", label: "기대 변화", placeholder: "수강 후 가능한 변화를 과장 없이 적어 주세요." }],
    [{ key: "goals", label: "수강 후 가능한 행동 3가지", placeholder: "1. 업무를 분류한다\n2. 적합한 도구를 선택한다\n3. 자동화 흐름을 직접 만든다" }, { key: "deliverable", label: "측정 가능한 결과물", placeholder: "예: 본인 업무용 자동화 시나리오 1개" }],
    [{ key: "curriculum", label: "회차별 커리큘럼", placeholder: "회차 / 주제 / 핵심 내용 / 실습 / 과제 / 준비물 / 시간" }, { key: "practice", label: "수강생 직접 실습", placeholder: "강사 시연이 아닌 수강생 실행 과제를 적어 주세요." }],
    [{ key: "freeFlow", label: "무료강의 흐름", placeholder: "강사 소개·공감 → 핵심 개념 → 실전 시연 → 질문 → 심화과정 안내" }, { key: "valueBoundary", label: "무료·본강의 가치 구분", placeholder: "무료강의에서 제공할 가치와 본강의 심화 범위를 구분해 주세요." }],
    [{ key: "zoomPlan", label: "Zoom 운영 준비", placeholder: "화면 공유, 참여 방식, 질의응답, 녹화 여부를 적어 주세요." }, { key: "notice", label: "사전·사후 안내", placeholder: "24시간 전, 1시간 전, 종료 후 안내 내용을 적어 주세요." }],
    [{ key: "coachRoom", label: "코치방 운영 기준", placeholder: "운영 시간, 질문 응답 기준, 과제 피드백 방식을 적어 주세요." }, { key: "feedback", label: "과제·피드백", placeholder: "제출 방식, 마감, 피드백 기준" }],
    [{ key: "evidence", label: "성과 표현의 근거", placeholder: "사용할 사례와 확인 가능한 근거를 적어 주세요." }, { key: "riskCheck", label: "저작권·개인정보·과장 표현 점검", placeholder: "개인차 명시, 결과 보장 금지, 사용 자료의 권리 확인" }],
  ];
  const completion = Math.round(Object.values(content).filter(Boolean).length / 19 * 100);
  return <div className="page planner-page"><PageHeading eyebrow="LESSON PLANNER" title="강의 기획안 만들기" description="좋은 강의가 되기 위한 질문에 답하면, 검토 가능한 기획안이 완성됩니다." action={<div className="version-chip">v{workspace.plan.version} · {workspace.plan.status === "review" ? "검토 대기" : "작성 중"}</div>} />
    <div className="planner-layout"><aside className="plan-steps"><div className="plan-progress"><strong>{completion}%</strong><span>작성 진행률</span><div><i style={{ width: `${completion}%` }} /></div></div>{planSteps.map((label, index) => <button key={label} className={step === index ? "active" : ""} onClick={() => setStep(index)}><span>{index + 1}</span><div><strong>{label}</strong><small>{index < step ? "작성 완료" : index === step ? "작성 중" : "미작성"}</small></div></button>)}</aside>
      <section className="plan-editor"><div className="editor-head"><span>STEP {step + 1}</span><h2>{planSteps[step]}</h2><p>{step === 0 ? "수강생이 처음 보아도 강의의 대상과 가치를 이해할 수 있게 적어 주세요." : "구체적인 상황과 실제 행동을 중심으로 작성해 주세요."}</p></div><div className="form-stack">{fieldSets[step].map((field) => <label key={field.key}><span>{field.label}<b>필수</b></span>{field.key === "goals" || field.key === "curriculum" || field.key === "freeFlow" ? <textarea value={content[field.key] ?? ""} onChange={(e) => update(field.key, e.target.value)} placeholder={field.placeholder} rows={5} /> : <input value={content[field.key] ?? ""} onChange={(e) => update(field.key, e.target.value)} placeholder={field.placeholder} />}</label>)}</div><div className="editor-actions"><button className="secondary-button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>이전</button><button className="primary-button" onClick={() => step === 7 ? save(false) : setStep((value) => Math.min(7, value + 1))}>{step === 7 ? "임시저장" : "저장하고 다음"} →</button></div></section>
      <aside className="writing-guide"><div className="guide-card good"><span>좋은 작성 예</span><p>“수강생이 본인의 반복 업무 1개를 골라 자동화 순서도를 완성한다.”</p></div><div className="guide-card warning"><span>주의할 표현</span><p>“누구나 월 1,000만 원”처럼 근거 없는 수익·성과 보장 표현은 사용할 수 없어요.</p></div><div className="guide-check"><h3>검토 체크리스트</h3>{["행동 중심 목표인가요?", "실습 산출물이 있나요?", "개인차를 명시했나요?", "저작권을 확인했나요?"].map((item, index) => <div key={item}><span>{index < 2 ? "✓" : ""}</span>{item}</div>)}</div>{workspace.plan.reviewerComment && <div className="review-comment"><span>관리자 코멘트</span><p>{workspace.plan.reviewerComment}</p></div>}</aside></div>
    <div className="planner-footer"><div><span>자동 저장</span><strong>{workspace.plan.updatedAt ? "최근 저장됨" : "새 기획안"}</strong></div><div><button className="secondary-button" onClick={() => notify("미리보기 화면을 준비했어요.")}>미리보기</button><button className="secondary-button" onClick={() => window.print()}>PDF로 저장</button><button className="primary-button" disabled={saving} onClick={() => save(true)}>{saving ? "요청 중…" : "관리자 검토 요청"}</button></div></div>
  </div>;
}

function Operations({ notify }: { notify: (message: string) => void }) {
  const [tab, setTab] = useState<"before" | "during" | "after">("before");
  const groups = {
    before: ["강의기획안·자료·회차별 목표 최종 확인", "신청자 명단·코치방·Zoom 링크 확인", "화면 공유 자료·데모 계정 준비", "음향·카메라·인터넷 사전 테스트", "저작권·개인정보·수익 보장 표현 점검", "24시간 전·1시간 전 안내 발송"],
    during: ["입장 확인 및 시작 안내", "목표·순서·질문 방법 고지", "실습과 채팅 질문으로 참여 유도", "핵심 내용과 질의응답 시간 관리", "장애 발생 시 대체 안내문 공지", "불만은 공개 논쟁 대신 기록 후 협의"],
    after: ["자료·녹화본 제공 정책 안내", "과제와 다음 회차 준비물 공지", "출결·질문·주요 피드백 기록", "개선 사항과 성공사례 후보 기록", "정산에 필요한 완료 기록 확인"],
  };
  const [checked, setChecked] = useState<string[]>([]);
  return <div className="page"><PageHeading eyebrow="OPERATION MANUAL" title="강의 전·중·후, 빠짐없이 운영하세요" description="필요한 순간에 바로 실행할 수 있도록 준비물, 실행 순서, 완료 기준을 나눴습니다." />
    <div className="phase-tabs">{(["before", "during", "after"] as const).map((id, index) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}><span>{index + 1}</span><div><strong>강의 {id === "before" ? "전" : id === "during" ? "중" : "후"}</strong><small>{id === "before" ? "준비와 사전 점검" : id === "during" ? "진행과 참여 관리" : "기록과 후속 안내"}</small></div></button>)}</div>
    <div className="manual-layout"><section className="panel manual-checks"><div className="panel-head"><div><span className="section-index">CHECK</span><h2>{tab === "before" ? "강의 시작 전 최종 점검" : tab === "during" ? "수업 진행 체크" : "강의 종료 후 기록"}</h2></div><span className="quiet-copy">{groups[tab].filter((item) => checked.includes(`${tab}:${item}`)).length}/{groups[tab].length} 완료</span></div>{groups[tab].map((item, index) => { const key = `${tab}:${item}`; const active = checked.includes(key); return <button className={`manual-row ${active ? "done" : ""}`} key={item} onClick={() => setChecked((list) => active ? list.filter((value) => value !== key) : [...list, key])}><span>{active ? "✓" : index + 1}</span><div><strong>{item}</strong><small>{index % 2 === 0 ? "완료 기준을 확인하고 체크해 주세요." : "운영진과 공유가 필요한 항목입니다."}</small></div><b>{active ? "완료" : "체크"}</b></button>; })}<button className="primary-button full" onClick={() => notify("현재 체크 상태를 저장했어요.")}>현재 상태 저장하기</button></section>
      <aside className="manual-side"><div className="dark-card"><span>문제 발생 시</span><h3>기술 장애는<br />3단계로 대응합니다</h3><ol><li><b>1</b>원인과 영향 범위 확인</li><li><b>2</b>대체 링크·자료 즉시 안내</li><li><b>3</b>관리자에게 기록 공유</li></ol><button onClick={() => notify("대체 안내문을 복사했어요.")}>대체 안내문 복사</button></div><div className="tip-card"><span>운영 TIP</span><p>질의응답 시간을 먼저 확보한 뒤 나머지 콘텐츠 분량을 조절하면 종료 시간이 안정적이에요.</p></div></aside></div>
  </div>;
}

function ZoomGuide({ notify }: { notify: (message: string) => void }) {
  const [open, setOpen] = useState(0);
  const faq = [{ q: "소리가 들리지 않아요", a: "마이크 입력 장치와 컴퓨터 소리 공유를 확인합니다. 해결되지 않으면 채팅으로 재접속 링크를 안내하고 공동호스트에게 진행을 맡깁니다." }, { q: "화면 공유가 되지 않아요", a: "호스트의 화면 공유 권한과 운영체제 권한을 확인합니다. 즉시 해결이 어렵다면 자료 링크를 채팅과 코치방에 공유합니다." }, { q: "수강생이 입장하지 못해요", a: "회의 ID·암호·대기실 승인 여부를 확인합니다. 5분 이상 지속되면 관리자에게 참석자 정보와 증상을 전달합니다." }, { q: "녹화 제공 문의가 있어요", a: "사전에 고지한 녹화 정책과 개인정보 동의 범위를 확인한 뒤 동일한 기준으로 안내합니다." }];
  return <div className="page"><PageHeading eyebrow="ZOOM PLAYBOOK" title="Zoom 리허설, 화면 순서대로 따라하세요" description="강의 시작 20분 전부터 종료 안내까지 실제 운영 순서로 정리했습니다." action={<span className="date-pill">다음 리허설 · 7월 23일 15:00</span>} />
    <section className="zoom-hero"><div><span>20 MIN BEFORE</span><h2>리허설 방에 먼저 입장해<br />장비와 권한을 확인하세요.</h2><p>공동호스트와 입장·화면공유·채팅 권한을 한 번씩 실행하면 대부분의 현장 문제를 예방할 수 있어요.</p><button className="light-button" onClick={() => notify("리허설 체크를 시작했어요.")}>리허설 체크 시작 →</button></div><div className="zoom-window" aria-hidden="true"><div className="window-bar"><i /><i /><i /><span>UhB · 강의 리허설</span></div><div className="speaker-box"><span>UhB</span><strong>카메라 프레임</strong></div><div className="window-controls"><span>MIC</span><span>CAM</span><span>SHARE</span><b>END</b></div></div></section>
    <div className="guide-columns"><section><span className="section-index">01 · 준비</span><h2>강사 준비 체크리스트</h2>{["Zoom 계정과 최신 앱", "회의명·대기실·암호", "호스트·공동호스트 권한", "화면·컴퓨터 소리 공유", "카메라·마이크·조명", "채팅·녹화·이름 정책"].map((item, index) => <div className="number-check" key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong><i>확인</i></div>)}</section><section><span className="section-index">02 · 운영</span><h2>수업 운영 절차</h2><ol className="vertical-steps">{["15~20분 전 입장 및 장비 점검", "공동호스트와 권한 리허설", "입장 시 이름·음소거·질문 안내", "자료 공유와 실습 전환 확인", "문제 시 대체 링크 즉시 공지", "종료 전 다음 회차·과제 안내"].map((item, index) => <li key={item}><span>{index + 1}</span><div><strong>{item}</strong><small>{index === 4 ? "채팅과 코치방 모두 공지" : "완료 후 다음 단계로 이동"}</small></div></li>)}</ol></section></div>
    <section className="faq-section"><div className="section-title"><span className="section-index">03 · 문제 해결</span><h2>자주 발생하는 상황</h2></div>{faq.map((item, index) => <div className={`faq-row ${open === index ? "open" : ""}`} key={item.q}><button onClick={() => setOpen(open === index ? -1 : index)}><span>0{index + 1}</span><strong>{item.q}</strong><b>{open === index ? "−" : "+"}</b></button>{open === index && <div><p>{item.a}</p><button onClick={() => notify("수강생 안내 문구를 복사했어요.")}>안내 문구 복사</button></div>}</div>)}</section>
  </div>;
}

function CoachGuide({ notify }: { notify: (message: string) => void }) {
  const steps = ["대화 아이콘 선택", "그룹채팅 선택", "커버 이미지 설정", "방 이름 입력", "설명·주제 작성", "프로필 참여 설정", "참여 코드 설정", "관리자에게 인증 제출"];
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); notify("표준 문구를 복사했어요."); } catch { notify("문구를 선택해 복사해 주세요."); } };
  return <div className="page"><PageHeading eyebrow="COACH ROOM" title="코치방 개설부터 종강까지" description="카카오 오픈채팅 개설 순서와 수강생 운영 기준을 한 화면에서 확인하세요." />
    <section className="coach-intro"><div><span>8 STEPS</span><h2>약 10분이면<br />표준 코치방을 만들 수 있어요.</h2><p>방 이름과 설명, 참여 코드, 고정 공지를 먼저 준비해 두면 더 빠릅니다.</p></div><div className="coach-rule"><span>권장 인원</span><strong>60–70명</strong><small>강의 성격에 따라 관리자와 조정</small></div></section>
    <div className="coach-layout"><section className="phone-steps"><div className="mock-phone"><div className="phone-top"><span>9:41</span><b>● ●</b></div><div className="chat-preview"><i>UhB</i><strong>[AI 실무 1기] 김어비_코칭방</strong><span>질문 가능 시간 · 평일 10:00–18:00</span><div className="chat-note">공지 · Zoom 링크와 과제 제출 양식을 확인해 주세요.</div></div></div><div className="steps-grid">{steps.map((item, index) => <button key={item} onClick={() => notify(`${index + 1}단계 완료로 표시했어요.`)}><span>{index + 1}</span><strong>{item}</strong><i>체크</i></button>)}</div></section>
      <aside className="coach-copy"><h2>표준 설정</h2>{[{ label: "방 이름", text: "[AI 실무 1기] 김어비_코칭방" }, { label: "방 설명", text: "운영 기간과 질문 가능 시간을 확인해 주세요. 개인 연락처·광고·비방은 금지합니다." }, { label: "고정 공지", text: "Zoom 링크 / 일정 / 질문 양식 / 자료 안내 / 운영 규칙" }].map((item) => <div className="copy-box" key={item.label}><span>{item.label}</span><p>{item.text}</p><button onClick={() => copy(item.text)}>복사</button></div>)}<div className="rule-list"><h3>운영 원칙</h3><p>응답 가능 시간과 예상 시간을 미리 공지</p><p>민감정보는 공개방에 남기지 않기</p><p>비방·도배·저작권 침해는 기록 후 이관</p><p>종강 후 유지·자료 보관 기간 공지</p></div></aside></div>
  </div>;
}

function CrisisCenter({ workspace, setWorkspace, apiPatch, notify }: { workspace: Workspace; setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>; apiPatch: (payload: Record<string, unknown>) => Promise<unknown>; notify: (message: string) => void }) {
  const [severity, setSeverity] = useState(2);
  const [form, setForm] = useState({ courseName: "", category: "강의 품질", detail: "", immediateAction: "", evidenceUrl: "" });
  const submit = async () => { try { const result = await apiPatch({ action: "reportIssue", severity, ...form }) as { id?: string }; if (result.id) setWorkspace((current) => ({ ...current, issues: [{ id: result.id!, severity, category: form.category, course_name: form.courseName, status: "reported", created_at: new Date().toISOString() }, ...current.issues] })); setForm({ courseName: "", category: "강의 품질", detail: "", immediateAction: "", evidenceUrl: "" }); notify(severity === 3 ? "최고관리자에게 긴급 이슈를 전달했어요." : "이슈를 안전하게 접수했어요."); } catch (error) { notify(error instanceof Error ? error.message : "신고하지 못했습니다."); } };
  const scripts = ["불편을 드려 죄송합니다. 말씀 주신 내용을 정확히 확인한 뒤 안내드리겠습니다. 확인을 위해 운영팀에도 전달하겠습니다.", "이 사안은 공개 채팅에서 상세히 다루기보다 정확한 확인 후 개별 안내드리겠습니다. 운영팀과 함께 확인해보겠습니다.", "환불 및 보상 관련 사항은 회사의 공식 기준에 따라 운영팀이 안내드리고 있습니다. 요청 내용을 전달해 확인 후 답변드리겠습니다."];
  return <div className="page"><PageHeading eyebrow="CRISIS RESPONSE" title="혼자 판단하지 말고, 단계에 맞게 이관하세요" description="사실과 증빙을 먼저 기록하고 환불·법적 약속은 반드시 운영진에게 넘겨 주세요." action={<span className="urgent-pill"><i /> 긴급 시 즉시 관리자 연락</span>} />
    <div className="crisis-principles">{["감정적으로 반박하지 않기", "사실·시간·대화 먼저 기록", "금전·법적 약속하지 않기", "개인정보 공개하지 않기", "심각도에 따라 즉시 이관"].map((item, index) => <div key={item}><span>{index + 1}</span><strong>{item}</strong></div>)}</div>
    <section className="severity-grid">{[{ level: 1, title: "일반 문의·불만", examples: "자료 누락 · 링크 오류 · 일정 문의", action: "사실 확인 후 표준 안내", route: "24시간 내 미해결 시 관리자" }, { level: 2, title: "민원 가능성", examples: "품질 · 환불 · 공개 채팅 항의", action: "공개 논쟁 중단, 증빙 저장", route: "즉시 담당 관리자" }, { level: 3, title: "긴급 이슈", examples: "협박 · 성희롱 · 개인정보 · 법적 언급", action: "답변 최소화, 증빙 보존", route: "즉시 최고관리자" }].map((item) => <button className={`severity-card level-${item.level} ${severity === item.level ? "selected" : ""}`} key={item.level} onClick={() => setSeverity(item.level)}><span>{item.level}단계</span><h2>{item.title}</h2><p>{item.examples}</p><dl><div><dt>즉시 행동</dt><dd>{item.action}</dd></div><div><dt>이관</dt><dd>{item.route}</dd></div></dl></button>)}</section>
    <div className="crisis-layout"><section className="panel issue-form"><div className="panel-head"><div><span className="section-index">REPORT</span><h2>{severity}단계 이슈 신고</h2></div><span className={`severity-dot level-${severity}`}>{severity}</span></div><div className="two-fields"><label><span>강의명</span><input value={form.courseName} onChange={(e) => setForm({ ...form, courseName: e.target.value })} placeholder="강의명을 입력하세요" /></label><label><span>상황 분류</span><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>강의 품질</option><option>환불·보상</option><option>개인정보</option><option>폭언·협박</option><option>기술 문제</option><option>기타</option></select></label></div><label><span>상세 상황 <b>최소 10자</b></span><textarea rows={5} value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} placeholder="발생 시간, 수강생의 표현, 상황의 흐름을 사실 중심으로 적어 주세요." /></label><label><span>즉시 조치 내용</span><input value={form.immediateAction} onChange={(e) => setForm({ ...form, immediateAction: e.target.value })} placeholder="현재까지 취한 조치를 적어 주세요." /></label><label><span>증빙 링크 <em>선택</em></span><input value={form.evidenceUrl} onChange={(e) => setForm({ ...form, evidenceUrl: e.target.value })} placeholder="안전한 저장소의 캡처·대화 링크" /></label><button className={`primary-button full ${severity === 3 ? "danger" : ""}`} onClick={submit}>{severity === 3 ? "긴급 이슈 즉시 이관" : "관리자에게 신고하기"}</button></section>
      <aside className="response-scripts"><h2>표준 응대 문구</h2>{scripts.map((script, index) => <div key={script}><span>{["일반 불만 접수", "공개 논쟁 차단", "환불·보상 요구"][index]}</span><p>{script}</p><button onClick={async () => { try { await navigator.clipboard.writeText(script); notify("응대 문구를 복사했어요."); } catch { notify("문구를 선택해 복사해 주세요."); } }}>복사</button></div>)}</aside></div>
  </div>;
}

function Library({ resources: deliveredResources, notify }: { resources: DeliveredResource[]; notify: (message: string) => void }) {
  const resources = [{ type: "기획안", title: "무료강의 기획안 기본 양식", meta: "DOCX · 2026.07.18 업데이트" }, { type: "운영", title: "강의 전·중·후 체크리스트", meta: "PDF · 2026.07.20 업데이트" }, { type: "Zoom", title: "Zoom 리허설 확인표", meta: "PDF · 2026.07.12 업데이트" }, { type: "코치방", title: "코치방 고정 공지 템플릿", meta: "DOCX · 2026.07.16 업데이트" }, { type: "위기대응", title: "민원·위기 이슈 신고 양식", meta: "DOCX · 2026.07.21 업데이트" }, { type: "브랜드", title: "어비 강의 자료 디자인 가이드", meta: "PDF · 2026.06.30 업데이트" }];
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => resources.filter((resource) => `${resource.type} ${resource.title}`.includes(query)), [query]);
  return <div className="page"><PageHeading eyebrow="RESOURCE LIBRARY" title="필요한 양식과 자료를 바로 찾으세요" description="강의 준비와 운영에 사용하는 최신 공식 자료만 모았습니다." />
    {deliveredResources.length > 0 && <section className="delivered-resources"><div className="delivered-head"><div><span>FOR YOU</span><h2>관리자가 전달한 요청 자료</h2></div><strong>{deliveredResources.length}건</strong></div><div>{deliveredResources.map((resource) => <article key={resource.id}><span className={`delivery-icon ${resource.delivery_type}`}>{resource.delivery_type === "file" ? "F" : "↗"}</span><div><em>{resource.resource_type}</em><h3>{resource.title}</h3><p>{resource.request_note || (resource.delivery_type === "file" ? resource.file_name : "외부 링크로 전달된 자료입니다.")}</p></div><a href={`/api/resources/${resource.id}`} target="_blank" rel="noreferrer">{resource.delivery_type === "file" ? "다운로드" : "링크 열기"} <span>→</span></a></article>)}</div></section>}
    <div className="library-toolbar"><label><span aria-hidden="true">⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="자료명 또는 카테고리 검색" /></label><div>{["전체", "기획안", "운영", "Zoom", "코치방", "위기대응"].map((item) => <button key={item} onClick={() => setQuery(item === "전체" ? "" : item)}>{item}</button>)}</div></div>
    <div className="resource-grid">{filtered.map((resource, index) => <article key={resource.title}><div className={`file-cover cover-${index % 4}`}><span>{resource.type}</span><strong>{resource.title.split(" ").slice(0, 2).join(" ")}</strong><b>{resource.meta.startsWith("DOCX") ? "D" : "P"}</b></div><span className="resource-type">{resource.type}</span><h2>{resource.title}</h2><p>{resource.meta}</p><button onClick={() => notify(`${resource.title} 다운로드를 준비했어요.`)}>다운로드 <span>↓</span></button></article>)}</div>
  </div>;
}

function Support({ notify }: { notify: (message: string) => void }) {
  return <div className="page"><PageHeading eyebrow="HELP DESK" title="어떤 도움이 필요하신가요?" description="일반 문의는 담당 관리자에게, 긴급한 수강생 이슈는 위기대응 센터로 접수해 주세요." />
    <div className="support-grid"><section className="panel"><span className="section-index">MY MANAGER</span><h2>이수민 매니저</h2><p>기획안 검토, 리허설 일정, 강의 준비 상태를 함께 확인합니다.</p><a className="primary-button" href="mailto:support@ubii.co.kr">이메일 보내기</a><small>평일 10:00–18:00 · 평균 3시간 내 답변</small></section><section className="panel"><span className="section-index">QUICK REQUEST</span><h2>지원 요청 남기기</h2><label><span>문의 유형</span><select><option>기획안·검토</option><option>강의 일정</option><option>Zoom·기술</option><option>계약·정산</option></select></label><label><span>문의 내용</span><textarea rows={4} placeholder="필요한 도움을 구체적으로 적어 주세요." /></label><button className="primary-button" onClick={() => notify("지원 요청을 접수했어요.")}>요청 보내기</button></section></div>
  </div>;
}

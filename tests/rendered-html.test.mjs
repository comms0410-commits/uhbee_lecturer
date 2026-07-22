import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("defines the complete UhB instructor center", async () => {
  const [app, page, instructorAccess, layout, admin, adminApi, displayName, instructorAuth] = await Promise.all([
    readFile(new URL("../app/OnboardingApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/InstructorAccess.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminPortal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/display-name.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/instructor-auth.ts", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /title: "어비 강사 온보딩 센터"/);
  assert.match(page, /InstructorAccess/);
  assert.match(instructorAccess, /강사 계정으로/);
  assert.match(instructorAccess, /관리자 로그인/);
  assert.match(instructorAccess, /api\/instructor\/login/);
  assert.match(instructorAccess, /api\/admin\/login/);
  assert.match(app, /내 진행현황/);
  assert.match(app, /강의 기획안/);
  assert.match(app, /위기대응 센터/);
  assert.match(app, /관리자 페이지/);
  assert.match(admin, /신규 강사 등록/);
  assert.match(admin, /로그인 아이디/);
  assert.match(admin, /초기 비밀번호/);
  assert.match(admin, /강사용 자료 전달/);
  assert.match(admin, /강사별 진행 관리/);
  assert.match(admin, /ADMIN SIGN IN/);
  assert.match(admin, /관리자 로그인/);
  assert.match(admin, /등록된 강사가 없습니다/);
  assert.doesNotMatch(admin, /payload\.instructors\[0\]/);
  assert.match(adminApi, /p\.registered_by_admin = 1/);
  assert.match(adminApi, /registeredByAdmin: true/);
  assert.match(adminApi, /hashInstructorPassword/);
  assert.match(instructorAuth, /PBKDF2_ITERATIONS/);
  assert.match(instructorAuth, /PBKDF2_ITERATIONS = 100_000/);
  assert.match(app, /확인하기/);
  assert.match(app, /진행 공유/);
  assert.match(app, /진행 대기/);
  assert.match(app, /관리자 검토 체크리스트/);
  assert.match(app, /원본 PDF 다운로드/);
  assert.doesNotMatch(app, /이수민 매니저|이메일 보내기|과제 제출|학습하기/);
  assert.match(displayName, /홍길동/);
  assert.doesNotMatch(`${app}${page}${layout}${admin}`, /codex-preview|Your site is taking shape|react-loading-skeleton|uhbee1004/i);
});

test("ships persistence, migrations, and a branded social card", async () => {
  const [hosting, page, layout] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.equal(JSON.parse(hosting).d1, "DB");
  assert.equal(JSON.parse(hosting).r2, "FILES");
  assert.match(page, /InstructorAccess/);
  assert.match(layout, /og\.png/);
  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../drizzle/0000_bent_silver_surfer.sql", import.meta.url));
  await access(new URL("../drizzle/0001_wise_havok.sql", import.meta.url));
  await access(new URL("../drizzle/0002_outstanding_doorman.sql", import.meta.url));
  await access(new URL("../drizzle/0003_tiny_korvac.sql", import.meta.url));
  await access(new URL("../drizzle/0004_graceful_the_executioner.sql", import.meta.url));
  await access(new URL("../drizzle/0005_overjoyed_spot.sql", import.meta.url));
  await access(new URL("../drizzle/0006_brown_omega_sentinel.sql", import.meta.url));
  await access(new URL("../app/api/instructor/login/route.ts", import.meta.url));
  await access(new URL("../public/manuals/coach-room-kakao-openchat-guide.pdf", import.meta.url));
  await access(new URL("../public/manuals/coach-room-page-4.png", import.meta.url));
  await access(new URL("../app/api/admin/route.ts", import.meta.url));
  await access(new URL("../app/api/admin/login/route.ts", import.meta.url));
  await access(new URL("../app/api/resources/[id]/route.ts", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});

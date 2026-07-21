import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("defines the complete UhB instructor center", async () => {
  const [app, page, layout, admin, displayName] = await Promise.all([
    readFile(new URL("../app/OnboardingApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminPortal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/display-name.ts", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /title: "어비 강사 온보딩 센터"/);
  assert.match(page, /getChatGPTUser/);
  assert.match(app, /내 진행현황/);
  assert.match(app, /강의 기획안/);
  assert.match(app, /위기대응 센터/);
  assert.match(app, /관리자 페이지/);
  assert.match(admin, /신규 강사 등록/);
  assert.match(admin, /파일·링크 전달/);
  assert.match(displayName, /홍길동/);
  assert.match(page, /siteDisplayName/);
  assert.doesNotMatch(`${app}${page}${layout}${admin}`, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships persistence, migrations, and a branded social card", async () => {
  const [hosting, page, layout] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.equal(JSON.parse(hosting).d1, "DB");
  assert.equal(JSON.parse(hosting).r2, "FILES");
  assert.match(page, /getChatGPTUser/);
  assert.match(layout, /og\.png/);
  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../drizzle/0000_bent_silver_surfer.sql", import.meta.url));
  await access(new URL("../drizzle/0001_wise_havok.sql", import.meta.url));
  await access(new URL("../drizzle/0002_outstanding_doorman.sql", import.meta.url));
  await access(new URL("../app/api/admin/route.ts", import.meta.url));
  await access(new URL("../app/api/resources/[id]/route.ts", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});

import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("defines the complete UBII instructor center", async () => {
  const [app, page, layout] = await Promise.all([
    readFile(new URL("../app/OnboardingApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /title: "어비 강사 온보딩 센터"/);
  assert.match(page, /getChatGPTUser/);
  assert.match(app, /내 진행현황/);
  assert.match(app, /강의 기획안/);
  assert.match(app, /위기대응 센터/);
  assert.match(app, /관리자 운영 현황/);
  assert.doesNotMatch(`${app}${page}${layout}`, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships persistence, migrations, and a branded social card", async () => {
  const [hosting, page, layout] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.equal(JSON.parse(hosting).d1, "DB");
  assert.match(page, /getChatGPTUser/);
  assert.match(layout, /og\.png/);
  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../drizzle/0000_bent_silver_surfer.sql", import.meta.url));
  await access(new URL("../drizzle/0001_wise_havok.sql", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});

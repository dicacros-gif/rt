import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the finished trend dashboard without starter preview code", async () => {
  const [page, layout, dashboard, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/trends-dashboard.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(page, /<TrendsDashboard\s*\/>/);
  assert.match(layout, /lang="ko"/);
  assert.match(layout, /TREND NOW/);
  assert.match(dashboard, /연관 검색어/);
  assert.match(dashboard, /실시간 순위/);
  assert.doesNotMatch(page + layout + dashboard, /codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("remembers successful delete authorization on the same device", async () => {
  const [route, dashboard, staticPage] = await Promise.all([
    readFile(new URL("app/api/trends/route.ts", root), "utf8"),
    readFile(new URL("app/trends-dashboard.tsx", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
  ]);

  assert.match(route, /request\.cookies\.get\(deleteDeviceCookie\)/);
  assert.match(route, /httpOnly:\s*true/);
  assert.match(route, /sameSite:\s*"lax"/);
  assert.match(route, /maxAge:\s*deleteDeviceMaxAge/);
  assert.match(dashboard, /removeKeyword\(\{ portalId: view\.portalId, item \}, ""\)/);
  assert.match(dashboard, /response\.status === 401/);
  assert.match(staticPage, /LOCAL_DELETE_AUTH_STORAGE/);
  assert.match(staticPage, /saveLocalDeleteAuthorization\(\)/);
});

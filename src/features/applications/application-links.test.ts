import assert from "node:assert/strict";
import test from "node:test";
import { buildApplicationLinks } from "./application-links";

test("quick links include every filtered application with an http or https URL", () => {
  const links = buildApplicationLinks([
    { id: 1, company: "甲公司", role: "后端", applicationUrl: "https://example.com/a" },
    { id: 2, company: "乙公司", role: "全栈", applicationUrl: null },
    { id: 3, company: "甲公司", role: "前端", applicationUrl: "https://example.com/a" },
    { id: 4, company: "丙公司", role: "算法", applicationUrl: "http://example.org/job" },
  ]);

  assert.deepEqual(links, [
    { id: 1, company: "甲公司", role: "后端", href: "https://example.com/a" },
    { id: 3, company: "甲公司", role: "前端", href: "https://example.com/a" },
    { id: 4, company: "丙公司", role: "算法", href: "http://example.org/job" },
  ]);
});

test("quick links reject unsafe or malformed URLs", () => {
  assert.deepEqual(buildApplicationLinks([
    { id: 1, company: "甲", role: "开发", applicationUrl: "javascript:alert(1)" },
    { id: 2, company: "乙", role: "开发", applicationUrl: "file:///C:/secret" },
    { id: 3, company: "丙", role: "开发", applicationUrl: "/relative" },
    { id: 4, company: "丁", role: "开发", applicationUrl: "not a url" },
  ]), []);
});

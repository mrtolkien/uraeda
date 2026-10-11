import { expect, test } from "vite-plus/test";
import { pathLink } from "../routes.tsx";

test("a feature's workflow file opens in the UI", () => {
  expect(pathLink("specs/2026-10-11-web-ui/spec.md#us1")).toEqual({
    href: "/f/2026-10-11-web-ui/spec.md#us1",
    inApp: true,
  });
});

/** Codex review: a bug's files open in the UI too. */
test("a bug's workflow file opens in the UI", () => {
  expect(pathLink("specs/bugs/2026-10-11-crash/assessment.md")).toEqual({
    href: "/f/2026-10-11-crash/assessment.md",
    inApp: true,
  });
});

test("a draft opens in its editor, other files as text", () => {
  expect(pathLink("specs/drafts/idea.md").href).toBe("/edit/specs/drafts/idea.md");
  expect(pathLink("crates/core/src/api.rs")).toEqual({
    href: "/raw/crates/core/src/api.rs",
    inApp: false,
  });
});

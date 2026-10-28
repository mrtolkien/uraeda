// The address each workflow file's link takes: in the UI, as text, or on the decisions page.
import { expect, test } from "vite-plus/test";
import { pathLink } from "../links.tsx";

test("a feature's workflow file opens in the UI", () => {
  expect(pathLink("specs/2026-10-11-web-ui/spec.md#us1", "uraeda")).toEqual({
    href: "/r/uraeda/f/2026-10-11-web-ui/spec.md#us1",
    inApp: true,
  });
});

/** A change's files open in the UI too, at its page's address. */
test("a change's workflow file opens in the UI", () => {
  expect(pathLink("specs/changes/2026-10-11-crash/proposal.md", "uraeda")).toEqual({
    href: "/r/uraeda/f/2026-10-11-crash/proposal.md",
    inApp: true,
  });
});

test("a proposal file or a note file opens in its editor, other files as text", () => {
  expect(pathLink("specs/proposals/idea.md", "uraeda").href).toBe(
    "/r/uraeda/edit/specs/proposals/idea.md",
  );
  expect(pathLink("specs/notes/flat/note.md", "uraeda").href).toBe(
    "/r/uraeda/edit/specs/notes/flat/note.md",
  );
  expect(pathLink("crates/core/src/api.rs", "uraeda")).toEqual({
    href: "/r/uraeda/raw/crates/core/src/api.rs",
    inApp: false,
  });
  expect(pathLink("specs/x/mockups/ui.html", "uraeda")).toEqual({
    href: "/r/uraeda/mockups/specs/x/mockups/ui.html",
    inApp: false,
  });
  // The mockup route serves only a mockups folder's files: other HTML opens as text.
  expect(pathLink("docs/page.html", "uraeda")).toEqual({
    href: "/r/uraeda/raw/docs/page.html",
    inApp: false,
  });
});

/** US8 6: the constitution and the decisions open on their page, not as text. */
test("a decision and the constitution open on the decisions page", () => {
  expect(pathLink("specs/decisions/git.md", "uraeda")).toEqual({
    href: "/r/uraeda/decisions/git",
    inApp: true,
  });
  expect(pathLink("specs/decisions/git.md#rules", "uraeda").href).toBe("/r/uraeda/decisions/git");
  expect(pathLink("specs/CONSTITUTION.md", "uraeda")).toEqual({
    href: "/r/uraeda/decisions",
    inApp: true,
  });
  // A file under a decision's folder, like an image, is no decision.
  expect(pathLink("specs/decisions/images/a.md", "uraeda").inApp).toBe(false);
});

/** US2 more 5: from an item's file, a decision opens as its branch has it, at its anchor. */
test("a spec's decision link opens the branch's decision at its anchor", () => {
  const folder = "2026-10-17-spec-page";
  expect(pathLink("specs/decisions/task-storage.md", "uraeda", "rules", { folder })).toEqual({
    href: `/r/uraeda/f/${folder}/decisions/task-storage#rules`,
    inApp: true,
  });
  expect(pathLink("specs/decisions/task-storage.md", "uraeda", undefined, { folder }).href).toBe(
    `/r/uraeda/f/${folder}/decisions/task-storage`,
  );
  // From elsewhere, the decisions page, as the default branch has it.
  expect(pathLink("specs/decisions/task-storage.md", "uraeda", "rules").href).toBe(
    "/r/uraeda/decisions/task-storage",
  );
  // A feature's own file keeps its anchor, from its folder or not.
  expect(pathLink("specs/2026-10-11-web-ui/spec.md", "uraeda", "us1", { folder }).href).toBe(
    "/r/uraeda/f/2026-10-11-web-ui/spec.md#us1",
  );
});

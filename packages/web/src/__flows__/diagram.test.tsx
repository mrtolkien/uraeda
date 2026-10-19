// Flow: diagrams. A fenced `mermaid` block is drawn by Pele and never runs a script in the page,
// even when its text holds one; a diagram that fails to draw shows its source; a link in a diagram
// opens in a new tab and leaves the page and its unsaved work where they are. Every diagram the
// repository tracks draws. The diagrams decision's rules "Checked by the diagram's tests".
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { render as drawDiagram } from "pele";
import { commitOnBranch } from "uraeda-binding/test-utils";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { Diagram } from "../Diagram.tsx";
import { fixtureRepo, startApp } from "./harness.tsx";

const FEATURE = "2026-10-11-web-ui";
const root = join(import.meta.dirname, "../../../..");
const FENCE = "`".repeat(3);

/** Texts that would run in a page that put them in as HTML: a handler, a script, a link. */
const HOSTILE = [
  'flowchart LR\n a["<img src=x onerror=alert(1)>"] --> b',
  'flowchart LR\n a[x] --> b\n click a "javascript:alert(1)"\n click b call alert(1)',
  "sequenceDiagram\n A->>B: <script>alert(1)</script> <b onmouseover=alert(1)>hi</b>",
  "flowchart LR\n a[\"<style>*{display:none}</style><a href='javascript:alert(1)'>x</a>\"] --> b",
  'flowchart LR\n a["x<foreignObject><body onload=alert(1)>"] --> b',
];

/** What the drawn page may not hold: a script, a foreign object, a handler, a javascript link. */
function expectNothingRuns(container: HTMLElement) {
  expect(container.querySelector("script, foreignObject")).toBeNull();
  for (const element of container.querySelectorAll("*")) {
    expect(element.getAttributeNames().filter((name) => name.startsWith("on"))).toEqual([]);
    expect(element.getAttribute("href") ?? "").not.toMatch(/^\s*javascript:/i);
  }
}

/** A file of two diagrams, the first one hostile. */
const NOTES = [
  "# Notes",
  "",
  `${FENCE}mermaid\n${HOSTILE[0]}\n${FENCE}`,
  "",
  `${FENCE}mermaid\nflowchart LR\n a --> b\n${FENCE}`,
  "",
].join("\n");

const app = startApp({
  repo: () => {
    const repo = fixtureRepo();
    commitOnBranch(repo, FEATURE, { [`specs/${FEATURE}/discovery-02.md`]: NOTES });
    return repo;
  },
});

afterEach(() => vi.restoreAllMocks());

test("a diagram whose text holds a script, a handler, or a javascript link draws none of them", async () => {
  for (const source of HOSTILE) {
    const { container, unmount } = render(<Diagram source={source} />);
    // Drawn as a picture of its own, or refused as a source that does not parse: nothing runs.
    await waitFor(() => expect(container.querySelector("svg, pre")).not.toBeNull(), {
      timeout: 10_000,
    });
    expectNothingRuns(container);
    unmount();
  }
});

test("a diagram that fails to draw shows its source", async () => {
  const source = "flowchart LR\n a[unclosed --> b[";
  const { container } = render(<Diagram source={source} />);

  await waitFor(() => expect(container.querySelector("pre")).not.toBeNull(), { timeout: 10_000 });
  expect(container.querySelector("pre")?.textContent).toContain("unclosed");
});

test("a link in a diagram opens in a new tab, never replacing the page", async () => {
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  render(
    <Diagram source={'flowchart LR\n  a[Docs] --> b\n  click a "https://example.dev/docs"'} />,
  );

  const link = await screen.findByRole("link", { name: /Docs/ }, { timeout: 10_000 });
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  link.dispatchEvent(click);

  expect(click.defaultPrevented).toBe(true);
  expect(open).toHaveBeenCalledWith("https://example.dev/docs", "_blank", "noopener,noreferrer");
});

test("a page holding a diagram draws it in place, hostile text included, and runs nothing", async () => {
  const { container } = await app.open(`/f/${FEATURE}/discovery-02.md`);

  await waitFor(() => expect(document.querySelectorAll("svg").length).toBeGreaterThan(1), {
    timeout: 10_000,
  });
  expectNothingRuns(document.body);
  expect(container.querySelector("script")).toBeNull();
  cleanup();
});

test("every diagram the repository tracks draws", () => {
  const files = execFileSync("git", ["ls-files", "*.md"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const fenced = new RegExp(`^${FENCE}mermaid\\n([\\s\\S]*?)^${FENCE}`, "gm");
  const sources = files.flatMap((file) =>
    [...readFileSync(join(root, file), "utf8").matchAll(fenced)].map((match) => ({
      file,
      source: match[1]!,
    })),
  );
  expect(sources.length).toBeGreaterThan(0);
  for (const { file, source } of sources) {
    expect(() => drawDiagram(source), file).not.toThrow();
  }
});

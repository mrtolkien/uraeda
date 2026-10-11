import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { fixtureRepo, git, renderPage } from "./helpers.tsx";

const TEXT = `# Web UI

> [!WARNING]
> Mind the gap.

- [pro] fast
- [con] slow

<div>raw</div>

See [the spec](spec.md#data), [the code](/crates/core/src/git.rs), and [Vite](https://vite.dev).
`;

/** A repository whose web UI proposal holds TEXT, on the checkout. */
function repo() {
  const repo = fixtureRepo();
  git(repo, "switch", "--quiet", "2026-10-11-web-ui");
  writeFileSync(join(repo, "specs/2026-10-11-web-ui/proposal.md"), TEXT);
  return repo;
}

test("draws callouts, typed bullets, and raw HTML as text", async () => {
  await renderPage("/f/2026-10-11-web-ui/proposal.md", repo());

  expect(await screen.findByText("Warning")).toBeTruthy();
  expect(screen.getByText("Mind the gap.")).toBeTruthy();
  expect(screen.getByText("fast").closest("li")?.className).toContain("pro");
  expect(screen.getByText("<div>raw</div>")).toBeTruthy();
  expect(document.querySelector(".page div div")?.textContent).not.toBe("raw");
});

test("opens workflow files in the UI, code as text, and the web in a new tab", async () => {
  await renderPage("/f/2026-10-11-web-ui/proposal.md", repo());

  const code = await screen.findByText("the code");
  expect(code.closest("a")?.getAttribute("href")).toBe("/raw/crates/core/src/git.rs");
  expect(code.closest("a")?.getAttribute("target")).toBe("_blank");
  expect(screen.getByText("Vite").closest("a")?.getAttribute("target")).toBe("_blank");
  fireEvent.click(screen.getByText("the spec"));
  expect(window.location.pathname).toBe("/f/2026-10-11-web-ui/spec.md");
});

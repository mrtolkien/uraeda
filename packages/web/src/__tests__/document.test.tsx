import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, screen, within } from "@testing-library/react";
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
  const fast = screen
    .getAllByRole("listitem")
    .find((item) => item.textContent?.includes("fast")) as HTMLElement;
  expect(within(fast).getByText("+")).toBeTruthy();
  expect(screen.getByText("<div>raw</div>")).toBeTruthy();
  expect(screen.queryByText("raw", { exact: true })).toBeNull();
});

test("opens workflow files in the UI, code as text, and the web in a new tab", async () => {
  await renderPage("/f/2026-10-11-web-ui/proposal.md", repo());

  const code = await screen.findByRole("link", { name: "the code" });
  expect(code.getAttribute("href")).toBe("/raw/crates/core/src/git.rs");
  expect(code.getAttribute("target")).toBe("_blank");
  expect(screen.getByRole("link", { name: "Vite" }).getAttribute("target")).toBe("_blank");
  fireEvent.click(screen.getByRole("link", { name: "the spec" }));
  expect(window.location.pathname).toBe("/f/2026-10-11-web-ui/spec.md");
});

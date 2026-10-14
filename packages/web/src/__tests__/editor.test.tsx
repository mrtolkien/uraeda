import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import * as binding from "uraeda-binding";
import { expect, test } from "vite-plus/test";
import { navigate } from "../routes.tsx";
import {
  atRepo,
  answered,
  answersSoFar,
  click,
  fakeAgent,
  fixture,
  fixtureRepo,
  git,
  read,
  renderPage,
  sent,
  serverFetch,
  today,
  type,
} from "./helpers.tsx";

today("2026-10-12");

/** Taps Edit on a written proposal, drawn, and returns its text field (US5 5). */
async function edit() {
  await click(await screen.findByRole("button", { name: "Edit" }));
  return screen.getByRole("textbox", { name: "Text" });
}

/** US4.1 */
test("Draft turns a line into a draft, linked, and opens its editor", async () => {
  const { repo } = await renderPage("/");
  await click(await screen.findByRole("link", { name: /Claude Code runner/ }));

  await click(await screen.findByRole("button", { name: "Draft" }));

  const path = "specs/drafts/claude-code-runner-triggered-manually.md";
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/edit/${path}`)));
  expect(readFileSync(join(repo, path), "utf8")).toMatch(
    /\n---\n\n# Claude Code runner \(triggered manually\)\n/,
  );
  expect(readFileSync(join(repo, "specs/PRIORITIES.md"), "utf8")).toContain(
    "- [Claude Code runner (triggered manually)](drafts/claude-code-runner-triggered-manually.md)",
  );
  expect(git(repo, "status", "--porcelain")).toContain("PRIORITIES.md");
  expect(await screen.findByRole("textbox", { name: "Text" })).toBeTruthy();
});

/** Codex review: Draft drafts the line the human saw, or nothing. */
test("Draft is refused once the priorities changed elsewhere", async () => {
  const { repo } = await renderPage("/");
  await click(await screen.findByRole("link", { name: /Claude Code runner/ }));
  const draft = await screen.findByRole("button", { name: "Draft" });
  const file = join(repo, "specs/PRIORITIES.md");
  // Another line takes `next-1` before the click.
  writeFileSync(file, readFileSync(file, "utf8").replace("## Next\n\n", "## Next\n\n- Other\n"));

  await click(draft);

  expect(await screen.findByText(/PRIORITIES.md changed/)).toBeTruthy();
  expect(existsSync(join(repo, "specs/drafts/other.md"))).toBe(false);
  expect(window.location.pathname).toBe(
    atRepo("/priorities/claude-code-runner-triggered-manually"),
  );
});

/** US5 3 */
test("a new draft shows its hints, which are not in the file (US5 3)", async () => {
  const { repo } = await renderPage("/");
  await click(await screen.findByRole("link", { name: /Claude Code runner/ }));
  await click(await screen.findByRole("button", { name: "Draft" }));
  expect(await screen.findByText("The problem it solves, and for whom.")).toBeTruthy();
  expect(read(repo, "specs/drafts/claude-code-runner-triggered-manually.md")).not.toContain(
    "The problem it solves",
  );
});

/** US5 5 */
test("a written proposal opens drawn, with Edit (US5 5)", async () => {
  await renderPage("/edit/specs/drafts/git-listener.md");
  expect(await screen.findByRole("heading", { name: "What" })).toBeTruthy();
  await click(screen.getByRole("button", { name: "Edit" }));
  expect(screen.getByRole("textbox", { name: "Text" })).toBeTruthy();
});

/** US4.2 */
test("a draft is saved as typed, byte for byte", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = await edit();

  const typed = "# Git listener process\n\n## What\n\nRun  the next step,\twith tabs.\n";
  await type(field, typed);

  await waitFor(() =>
    expect(readFileSync(join(repo, "specs/drafts/git-listener.md"), "utf8")).toBe(typed),
  );
});

test("the discovery effort is set in the proposal's frontmatter", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const file = join(repo, "specs/drafts/git-listener.md");
  const before = readFileSync(file, "utf8");
  await edit();

  await click(await screen.findByRole("radio", { name: "Medium" }));

  await waitFor(() =>
    expect(readFileSync(file, "utf8")).toBe(`---\ndiscovery: medium\n---\n\n${before}`),
  );
});

/** Codex review: discovery changes wait for the saves before them, and Commit for them. */
test("quick discovery changes and Commit all land, in order", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const file = join(repo, "specs/drafts/git-listener.md");
  const field = await edit();
  await type(field, "# Git listener process\n\n## What\n\nTyped.\n");

  // Each click draws, and none waits for the write before it.
  for (const control of [
    screen.getByRole("radio", { name: "Medium" }),
    screen.getByRole("radio", { name: "Low" }),
    screen.getByRole("button", { name: "Commit" }),
  ]) {
    act(() => control.click());
  }

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s").trim()).toBe(
      "chore: edit the draft Git listener process",
    ),
  );
  const committed = "---\ndiscovery: low\n---\n\n# Git listener process\n\n## What\n\nTyped.\n";
  expect(readFileSync(file, "utf8")).toBe(committed);
  expect(git(repo, "show", "HEAD:specs/drafts/git-listener.md")).toBe(committed);
  expect(screen.queryByText(/changed/)).toBeNull();
});

/** US4.3 */
test("a draft is committed with the priorities it changed", async () => {
  const repo = fixtureRepo();
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    readFileSync(join(repo, "specs/PRIORITIES.md"), "utf8").replace(
      "- Claude Code",
      "- Claude Code!",
    ),
  );
  writeFileSync(
    join(repo, "specs/drafts/git-listener.md"),
    "# Git listener process\n\n## What\n\nMore.\n",
  );
  await renderPage("/edit/specs/drafts/git-listener.md", repo);

  expect(await screen.findByText("Your 1 priority change is committed with it.")).toBeTruthy();
  await click(screen.getByRole("button", { name: "Commit" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s").trim()).toBe(
      "chore: edit the draft Git listener process",
    ),
  );
  expect(git(repo, "show", "--name-only", "--format=", "HEAD").trim().split("\n").sort()).toEqual([
    "specs/PRIORITIES.md",
    "specs/drafts/git-listener.md",
  ]);
});

/** Codex review: Commit stops when the text shown could not be saved. */
test("Commit stops when the text could not be saved", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = await edit();
  const file = join(repo, "specs/drafts/git-listener.md");
  writeFileSync(file, "# Theirs\n");
  const before = git(repo, "rev-parse", "HEAD");

  await type(field, "# Mine\n");
  await click(screen.getByRole("button", { name: "Commit" }));

  expect(await screen.findByText(/nothing was committed/)).toBeTruthy();
  expect(git(repo, "rev-parse", "HEAD")).toBe(before);
});

/** Codex review: a draft changed elsewhere shows when the page comes back. */
test("a draft changed elsewhere shows when the page reads again", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = (await edit()) as HTMLTextAreaElement;
  const file = join(repo, "specs/drafts/git-listener.md");
  writeFileSync(file, "# Theirs\n");

  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await waitFor(() => expect(field.value).toBe("# Theirs\n"));
  await type(field, "# Theirs, and mine\n");
  await waitFor(() => expect(readFileSync(file, "utf8")).toBe("# Theirs, and mine\n"));
});

/** US4.4 */
test("Start turns a draft into a feature in its own worktree", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  await type(await screen.findByLabelText("Slug"), "git-listener");

  await click(screen.getByRole("button", { name: "Start the feature" }));

  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/f/2026-10-12-git-listener")));
  expect(
    existsSync(
      join(repo, ".worktrees/2026-10-12-git-listener/specs/2026-10-12-git-listener/proposal.md"),
    ),
  ).toBe(true);
  expect(git(repo, "branch", "--show-current").trim()).toBe("main");
  expect(git(repo, "show", "main:specs/PRIORITIES.md")).toContain(
    "- [Git listener process](/specs/2026-10-12-git-listener/proposal.md)",
  );
});

/** US4.5 */
test("a feature's proposal not committed is edited and committed", async () => {
  const repo = fixtureRepo();
  git(repo, "branch", "2026-10-14-runner", "main");
  git(repo, "worktree", "add", "--quiet", ".worktrees/2026-10-14-runner", "2026-10-14-runner");
  const proposal = join(repo, ".worktrees/2026-10-14-runner/specs/2026-10-14-runner/proposal.md");
  (await import("node:fs")).mkdirSync(join(proposal, ".."), { recursive: true });
  writeFileSync(proposal, "# Runner\n\n## What\n\nRun.\n\n## Why\n\nSpeed.\n");
  await renderPage("/f/2026-10-14-runner", repo);

  await click(await screen.findByRole("button", { name: "Write" }));
  await type(await edit(), "# Runner\n\n## What\n\nRun agents.\n\n## Why\n\nSpeed.\n");
  await click(screen.getByRole("button", { name: "Commit" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s", "2026-10-14-runner").trim()).toBe(
      "chore(runner): proposal",
    ),
  );
  expect(readFileSync(proposal, "utf8")).toContain("Run agents.");
});

/** Review C2: the proposal is freeform, so Start starts any draft. */
test("a draft with the template's placeholders starts", async () => {
  const repo = fixtureRepo();
  writeFileSync(
    join(repo, "specs/drafts/git-listener.md"),
    "# Git listener process\n\n## What\n\n[What the feature does, from the user's point of view.]\n\n## Why\n\n[The problem it solves, and for whom.]\n",
  );
  await renderPage("/edit/specs/drafts/git-listener.md", repo);

  await click(await screen.findByRole("button", { name: "Start the feature" }));

  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/f/2026-10-12-git-listener")));
  expect(git(repo, "branch", "--list", "2026-10-12-git-listener").trim()).not.toBe("");
});

test("a save over a change made elsewhere keeps the text, and offers the new version", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = await edit();
  writeFileSync(join(repo, "specs/drafts/git-listener.md"), "# Changed elsewhere\n");

  await type(field, "# Mine\n");

  expect(
    await screen.findByText(
      "git-listener.md changed on disk since you opened it. Your text was not saved.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy my text" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Load the new version" })).toBeTruthy();
  expect(readFileSync(join(repo, "specs/drafts/git-listener.md"), "utf8")).toBe(
    "# Changed elsewhere\n",
  );
});

/** Review C1: the new version replaces the text, and a later save does not undo it. */
test("Load the new version loads it", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = await edit();
  writeFileSync(join(repo, "specs/drafts/git-listener.md"), "# Changed elsewhere\n");
  await type(field, "# Mine\n");
  await screen.findByRole("button", { name: "Load the new version" });

  await click(screen.getByRole("button", { name: "Load the new version" }));

  await waitFor(() =>
    expect((screen.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement).value).toBe(
      "# Changed elsewhere\n",
    ),
  );
  await type(screen.getByRole("textbox", { name: "Text" }), "# Changed elsewhere\n\nMore.\n");
  await waitFor(() =>
    expect(readFileSync(join(repo, "specs/drafts/git-listener.md"), "utf8")).toBe(
      "# Changed elsewhere\n\nMore.\n",
    ),
  );
});

/** Picks files with "Add image", as the system's picker gives them. */
async function pick(files: File[]) {
  const input = screen.getByLabelText("Add image", { selector: "input" });
  await act(async () => {
    fireEvent.change(input, { target: { files } });
  });
}

/** US1.6 */
test("a draft that gets an image opens at its folder's proposal", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = (await edit()) as HTMLTextAreaElement;
  field.setSelectionRange(field.value.length, field.value.length);
  const bytes = readFileSync(fixture("images/phone.png"));

  await pick([new File([bytes], "login.png", { type: "image/png" })]);

  const moved = "specs/drafts/git-listener/proposal.md";
  await waitFor(() => expect(window.location.pathname).toBe(`/edit/${moved}`));
  await waitFor(() =>
    expect((screen.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement).value).toBe(
      "# Git listener process\n\n## What\n\nRun the next step when a branch changes.\n\n## Why\n\nSo agents start without me.\n\n![login](images/login.webp)\n",
    ),
  );
  await waitFor(() => expect(read(repo, moved)).toContain("![login](images/login.webp)"));
  expect(existsSync(join(repo, "specs/drafts/git-listener/images/login.webp"))).toBe(true);
  expect(existsSync(join(repo, "specs/drafts/git-listener.md"))).toBe(false);
  expect(read(repo)).toContain("(drafts/git-listener/proposal.md)");
});

/** Review focus 12: a slow upload over the limit may fail before the server's refusal arrives. */
test("a file over 20 MB is refused before it is uploaded", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = (await edit()) as HTMLTextAreaElement;
  const before = field.value;

  await pick([new File([new Uint8Array(20 * 1024 * 1024 + 1)], "big.png", { type: "image/png" })]);

  expect(
    (await screen.findAllByText("This image is over 20 MB: big.png is 20.1 MB.")).length,
  ).toBeGreaterThan(0);
  expect(sent.some((request) => request.includes("/attach"))).toBe(false);
  expect(field.value).toBe(before);
  expect(existsSync(join(repo, "specs/drafts/git-listener"))).toBe(false);
});

/** The login banner's proposal, a folder draft, written in a repository: its path. */
function proposal(repo: string, text = "# Login error banner\n\n## What\n\nThe banner.\n") {
  const path = "specs/drafts/login-banner/proposal.md";
  mkdirSync(join(repo, "specs/drafts/login-banner"), { recursive: true });
  writeFileSync(join(repo, path), text);
  return path;
}

/** The address a request goes to. */
const urlOf = (input: RequestInfo | URL) =>
  input instanceof Request ? input.url : input.toString();

/** A PNG, as the picker gives it. */
const png = (name: string) =>
  new File([readFileSync(fixture("images/phone.png"))], name, { type: "image/png" });

/**
 * The server in process, whose uploads wait until the test lets each one through: what happens
 * during an upload.
 */
function holdUploads(repo: string, fetch = serverFetch(repo)) {
  const waiting: Array<() => void> = [];
  return {
    waiting,
    fetch: (async (input, init) => {
      if (urlOf(input).startsWith("/attach")) {
        await new Promise<void>((resolve) => waiting.push(resolve));
      }
      return fetch(input, init);
    }) as typeof globalThis.fetch,
    /** Lets the next upload through, once it waits. */
    async release() {
      await waitFor(() => expect(waiting.length).toBeGreaterThan(0));
      await act(async () => waiting.shift()!());
    },
  };
}

/** Review: a version read during an upload is not taken as the one the save is made over. */
test("a file changed elsewhere during an upload is a conflict, not overwritten", async () => {
  const repo = fixtureRepo();
  const path = proposal(repo);
  const held = holdUploads(repo);
  await renderPage(`/edit/${path}`, repo, { fetch: held.fetch });
  await screen.findByRole("textbox", { name: "Text" });

  await pick([png("login.png")]);
  await waitFor(() => expect(held.waiting).toHaveLength(1));
  writeFileSync(join(repo, path), "# Theirs\n");
  const from = answersSoFar();
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await answered("Draft", from);
  await held.release();

  expect(await screen.findByRole("button", { name: "Load the new version" })).toBeTruthy();
  expect(read(repo, path)).toBe("# Theirs\n");
});

/** Review: a second drop during an upload goes to the folder the first one made. */
test("images added during an upload to a single-file draft all go to its new folder", async () => {
  const repo = fixtureRepo();
  const held = holdUploads(repo);
  await renderPage("/edit/specs/drafts/git-listener.md", repo, { fetch: held.fetch });
  await edit();

  await pick([png("one.png")]);
  await pick([png("two.png")]);
  await held.release();
  await held.release();

  const moved = "specs/drafts/git-listener/proposal.md";
  await waitFor(() => expect(window.location.pathname).toBe(`/edit/${moved}`));
  await waitFor(() =>
    expect(read(repo, moved)).toContain("![one](images/one.webp)\n\n![two](images/two.webp)\n"),
  );
  expect(existsSync(join(repo, "specs/drafts/git-listener/images/two.webp"))).toBe(true);
  // The last status shows on the page at the new path.
  expect(screen.getAllByText("Added two.webp").length).toBeGreaterThan(0);
});

/** Review: a draft's page is kept while its images upload, though the draft moved meanwhile. */
test("the editor keeps its draft while the images upload, though it moved", async () => {
  const repo = fixtureRepo();
  const held = holdUploads(repo);
  await renderPage("/edit/specs/drafts/git-listener.md", repo, { fetch: held.fetch });
  await edit();

  await pick([png("one.png")]);
  await pick([png("two.png")]);
  await held.release();
  await waitFor(() => expect(held.waiting).toHaveLength(1));
  // The draft moved: read again, its old path holds nothing, and fate keeps the draft read last.
  const from = answersSoFar();
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await waitFor(() => expect(answersSoFar()).toBeGreaterThan(from));
  await act(() => new Promise((resolve) => setTimeout(resolve)));

  expect(screen.queryByText(/No draft/)).toBeNull();
  expect(screen.getByRole("textbox", { name: "Text" })).toBeTruthy();
  await held.release();
  await waitFor(() =>
    expect(window.location.pathname).toBe("/edit/specs/drafts/git-listener/proposal.md"),
  );
});

/** Review: an upload that ends after the human left saves its link, and leaves them there. */
test("an upload that ends after the page was left saves its link, where it moved", async () => {
  const repo = fixtureRepo();
  const held = holdUploads(repo);
  await renderPage("/edit/specs/drafts/git-listener.md", repo, { fetch: held.fetch });
  await edit();

  await pick([png("login.png")]);
  await waitFor(() => expect(held.waiting).toHaveLength(1));
  await act(async () => navigate("/"));
  await held.release();

  const moved = "specs/drafts/git-listener/proposal.md";
  await waitFor(() => expect(read(repo, moved)).toContain("![login](images/login.webp)"));
  expect(window.location.pathname).toBe("/");
});

/** Review: what is typed during an upload is saved once it ends, and leaving before asks. */
test("typing during an upload shows saving, and leaving the page asks", async () => {
  const repo = fixtureRepo();
  const path = proposal(repo);
  const held = holdUploads(repo);
  await renderPage(`/edit/${path}`, repo, { fetch: held.fetch });
  const field = await screen.findByRole("textbox", { name: "Text" });

  await pick([png("login.png")]);
  await waitFor(() => expect(held.waiting).toHaveLength(1));
  await type(field, "# Login error banner\n\n## What\n\nThe banner, typed.\n");

  expect(screen.getByText("saving…")).toBeTruthy();
  const leaving = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(leaving);
  expect(leaving.defaultPrevented).toBe(true);
  await held.release();
  await waitFor(() => expect(read(repo, path)).toContain("typed.\n\n![login](images/login.webp)"));
  await waitFor(() => expect(screen.getByText("saved ✓")).toBeTruthy());
});

/** Review: an image is not added over a text that could not be saved, and says so. */
test("an image is refused while the text is not saved, and added once reloaded", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = await edit();
  writeFileSync(join(repo, "specs/drafts/git-listener.md"), "# Theirs\n");
  await type(field, "# Mine\n");

  await pick([png("login.png")]);

  expect(
    (await screen.findAllByText("Your text is not saved: the image was not added.")).length,
  ).toBeGreaterThan(0);
  expect(sent.some((request) => request.includes("/attach"))).toBe(false);

  await click(screen.getByRole("button", { name: "Load the new version" }));
  await waitFor(() =>
    expect((screen.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement).value).toBe(
      "# Theirs\n",
    ),
  );
  await pick([png("login.png")]);
  await waitFor(() =>
    expect(read(repo, "specs/drafts/git-listener/proposal.md")).toBe(
      "# Theirs\n\n![login](images/login.webp)\n",
    ),
  );
});

test.each([
  [
    "an error page",
    () =>
      new Response("<h1>Bad gateway</h1>", {
        status: 502,
        headers: { "content-type": "text/html" },
      }),
    "The image could not be added (HTTP 502).",
  ],
  [
    "the guard's refusal",
    () =>
      new Response("Forbidden site", { status: 403, headers: { "content-type": "text/plain" } }),
    "Forbidden site",
  ],
  [
    "no answer",
    () => {
      throw new TypeError("Failed to fetch");
    },
    "Could not reach the Uraeda server.",
  ],
])("an upload that gets %s says so under the field", async (_, answer, message) => {
  const repo = fixtureRepo();
  const path = proposal(repo);
  const server = serverFetch(repo);
  const fetch: typeof globalThis.fetch = async (input, init) =>
    urlOf(input).startsWith("/attach") ? answer() : server(input, init);
  await renderPage(`/edit/${path}`, repo, { fetch });
  const field = (await screen.findByRole("textbox", { name: "Text" })) as HTMLTextAreaElement;
  const before = field.value;

  await pick([png("login.png")]);

  expect((await screen.findAllByText(message)).length).toBeGreaterThan(0);
  expect(field.value).toBe(before);
});

/** Review: an upload the server never answers ends, with a refusal, instead of holding Submit. */
test("an upload the server does not answer in time says so under the field", async () => {
  const repo = fixtureRepo();
  const path = proposal(repo);
  const server = serverFetch(repo);
  // What the upload's time limit does: its signal aborts the request, which rejects so.
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (!urlOf(input).startsWith("/attach")) {
      return server(input, init);
    }
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    throw new DOMException("The operation timed out.", "TimeoutError");
  };
  await renderPage(`/edit/${path}`, repo, { fetch });
  const field = (await screen.findByRole("textbox", { name: "Text" })) as HTMLTextAreaElement;
  const before = field.value;

  await pick([png("login.png")]);

  expect(
    (await screen.findAllByText("The image could not be added: the server did not answer in time."))
      .length,
  ).toBeGreaterThan(0);
  expect(field.value).toBe(before);
});

/** Edge case: an image added while the feature's agent works is refused, as every write. */
test("an image added while the feature's agent works is refused under the field", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const { folder } = await binding.startFeature(
    repo,
    "specs/drafts/git-listener.md",
    "git-listener",
  );
  const session = await fake.sessions.featureSession(repo, folder);
  await fake.sessions.send(repo, session.id, {
    text: "Continue the feature.",
    workflow: { trigger: "manual" },
  });
  await renderPage(`/edit/specs/${folder}/proposal.md`, repo, { agent: fake });
  const field = (await edit()) as HTMLTextAreaElement;
  const before = field.value;

  await pick([png("login.png")]);

  expect(
    (
      await screen.findAllByText(
        "An agent is working on this feature. Stop it first, or wait for it.",
      )
    ).length,
  ).toBeGreaterThan(0);
  expect(field.value).toBe(before);
  expect(sent.some((request) => request.includes("/attach"))).toBe(true);
});

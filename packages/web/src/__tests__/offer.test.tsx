// The agent's offer to make a session a change (US2 of merge chats): its `uraeda-offer change` block
// drawn as a card with the proposal and its slug, started with one click (SC-001), closed with
// "Not now", waiting while the agent works; and read as text where it cannot apply: an earlier
// offer, a session that already has a workflow, a block still streaming.
import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor, within } from "@testing-library/react";
import { refreshPullRequests } from "uraeda-binding";
import { addChange, temporaryFolder } from "uraeda-binding/test-utils";
import { expect, onTestFinished, test } from "vite-plus/test";
import {
  click,
  type Fake,
  fakeAgent,
  fixtureRepo,
  git,
  refreshUntil,
  renderPage,
  serverFetch,
  today,
} from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";
// The slug the core proposes for the proposal's title.
const SLUG = "login-redirects";
const FOLDER = `2026-10-20-${SLUG}`;
const ASKED = "Why does the login redirect twice? Fix it.";
const PROPOSAL =
  "# Login redirects twice\n\nAfter signing in, the app shows the home page, then the sign-in page again.";

today("2026-10-20");

/** An agent's message holding a change offer of `proposal`. */
const offer = (proposal = PROPOSAL) =>
  `The guard and the router both redirect: this should not land on main directly.\n\n\`\`\`uraeda-offer change\n${proposal}\n\`\`\``;

/** A session without a workflow, its agent's replies to each message being `replies`, in turn. */
async function offered(fake: Fake, repo: string, replies = [offer()]) {
  const chat = await fake.sessions.newChat(repo);
  for (const [index, reply] of replies.entries()) {
    fake.adapter.script([{ text: reply, type: "text" }]);
    const { turn } = await fake.sessions.send(repo, chat.id, {
      text: index === 0 ? ASKED : "And the other one?",
    });
    await fake.sessions.settled(turn);
  }
  return chat.id;
}

/** The server's fetch, counting the requests that call `mutation`. */
function counting(repo: string, fake: Fake, mutation: string) {
  const server = serverFetch(repo, fake.sessions);
  const calls = { count: 0 };
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (typeof init?.body === "string" && init.body.includes(mutation)) {
      calls.count++;
    }
    return server(input, init);
  };
  return { calls, fetch };
}

/** The offer's card, once drawn. */
async function card() {
  return within(await screen.findByRole("region", { name: "Start a change" }));
}

/** The session's transcript. */
const log = () => screen.getByRole("log", { name: "Conversation" });

/** US2.1, SC-001 */
test("Start the change from the agent's offer", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await offered(fake, repo);
  const { calls, fetch } = counting(repo, fake, "session.toChange");
  await renderPage(`/sessions/${id}`, repo, { agent: fake, fetch });

  const shown = await card();
  const proposal = shown.getByRole("textbox", { name: "Proposal" }) as HTMLTextAreaElement;
  expect(proposal.value).toBe(PROPOSAL);
  const slug = (await shown.findByRole("textbox", { name: "Slug" })) as HTMLInputElement;
  await waitFor(() => expect(slug.value).toBe(SLUG));
  // The branch's date is the server's: the card does not guess it from the browser's clock.
  expect(
    shown.getByText(
      "This session goes on in the change’s worktree, on its own branch. The files it edited move there too.",
    ),
  ).toBeTruthy();
  fake.adapter.script([]);
  await click(shown.getByRole("button", { name: "Start the change" }));

  expect(
    await screen.findByText(`Started as the change Login redirects twice, on change/${FOLDER}`),
  ).toBeTruthy();
  expect(calls.count).toBe(1);
  expect(git(repo, "show", `change/${FOLDER}:specs/changes/${FOLDER}/proposal.md`)).toBe(
    `${PROPOSAL}\n`,
  );
});

/** US2 more 1 */
test("Not now closes the card and writes nothing", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await offered(fake, repo);
  const { calls, fetch } = counting(repo, fake, "session.toChange");
  await renderPage(`/sessions/${id}`, repo, { agent: fake, fetch });

  await click((await card()).getByRole("button", { name: "Not now" }));

  await waitFor(() => expect(screen.queryByRole("region", { name: "Start a change" })).toBeNull());
  // The block reads as the agent's text.
  expect(log().textContent).toContain("Login redirects twice");
  expect(calls.count).toBe(0);
  expect(git(repo, "branch", "--list", "change/*")).toBe("");
});

/** US2 more 2 */
test("Start the change waits while the agent works", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await offered(fake, repo);
  // No reply scripted: the turn goes on.
  await fake.sessions.send(repo, id, { text: "And the tests?" });
  await renderPage(`/sessions/${id}`, repo, { agent: fake });

  const shown = await card();

  const start = shown.getByRole("button", { name: "Start the change" });
  expect(start.hasAttribute("disabled") || start.getAttribute("aria-disabled") === "true").toBe(
    true,
  );
  expect(shown.getByText("The agent is working")).toBeTruthy();
});

/** Edge: the agent offers twice in one session. */
test("only the latest offer has buttons", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const later = "# Login loops\n\nThe sign-in page reloads itself.";
  const id = await offered(fake, repo, [offer(), offer(later)]);
  await renderPage(`/sessions/${id}`, repo, { agent: fake });

  const shown = await card();

  expect(screen.getAllByRole("button", { name: "Start the change" })).toHaveLength(1);
  expect((shown.getByRole("textbox", { name: "Proposal" }) as HTMLTextAreaElement).value).toBe(
    later,
  );
  expect(log().textContent).toContain("Login redirects twice");
});

/** Edge: a change offer in a feature's session. */
test("a change offer in a feature's session reads as text", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const session = await fake.sessions.featureSession(repo, CLI);
  fake.adapter.script([{ text: offer(), type: "text" }]);
  const { turn } = await fake.sessions.send(repo, session.id, { text: ASKED });
  await fake.sessions.settled(turn);
  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });

  await waitFor(() => expect(log().textContent).toContain("Login redirects twice"));

  expect(screen.queryByRole("region", { name: "Start a change" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Start the change" })).toBeNull();
});

/** Review focus 6 */
test("a block still streaming reads as text", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  await fake.sessions.send(repo, chat.id, { text: ASKED });
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
  fake.adapter.emit({ id: fake.adapter.sent[0].id, type: "accepted" });
  // The whole block, closing fence included, while the text still streams.
  fake.adapter.emit({ text: offer(), type: "textDelta" });
  await renderPage(`/sessions/${chat.id}`, repo, { agent: fake });

  await waitFor(() => expect(log().textContent).toContain("Login redirects twice"));
  expect(screen.queryByRole("region", { name: "Start a change" })).toBeNull();

  fake.adapter.emit({ text: offer(), type: "text" });

  await refreshUntil(() =>
    expect(screen.getByRole("region", { name: "Start a change" })).toBeTruthy(),
  );
});

/** US2.3 */
test("Make it a change opens the card with the first message", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await offered(fake, repo, ["The guard and the router both redirect."]);
  await renderPage(`/sessions/${id}`, repo, { agent: fake });

  await click(await screen.findByRole("button", { name: "Session actions" }));
  await click(await screen.findByRole("menuitem", { name: "Make it a change" }));

  const shown = await card();
  expect((shown.getByRole("textbox", { name: "Proposal" }) as HTMLTextAreaElement).value).toBe(
    ASKED,
  );
  const slug = (await shown.findByRole("textbox", { name: "Slug" })) as HTMLInputElement;
  await waitFor(() => expect(slug.value).not.toBe(""));
  // At the session's end, after its transcript.
  expect(
    log().compareDocumentPosition(shown.getByRole("button", { name: "Start the change" })) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

/** Edge: the slug's branch or folder exists. */
test("a taken slug shows its message under the card", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  git(repo, "branch", `change/${FOLDER}`, "main");
  const id = await offered(fake, repo);
  await renderPage(`/sessions/${id}`, repo, { agent: fake });
  const shown = await card();
  const slug = (await shown.findByRole("textbox", { name: "Slug" })) as HTMLInputElement;
  await waitFor(() => expect(slug.value).toBe(SLUG));

  await click(shown.getByRole("button", { name: "Start the change" }));

  expect(
    await shown.findByText(`A branch or folder named ${FOLDER} exists: pick another slug`),
  ).toBeTruthy();
  expect(shown.getByRole("button", { name: "Start the change" })).toBeTruthy();
});

const CHANGE = "2026-10-20-login-redirect";
const REASON = "It touches the session store and the router: a spec would settle the edges first.";

/** The change `login-redirect`, its session's agent offering to make it a feature. */
async function featureOffered(fake: Fake, repo: string) {
  addChange(repo, CHANGE, { "proposal.md": "# Login redirects twice\n" });
  const session = await fake.sessions.featureSession(repo, CHANGE);
  fake.adapter.script([
    { text: `This grew.\n\n\`\`\`uraeda-offer feature\n${REASON}\n\`\`\``, type: "text" },
  ]);
  const { turn } = await fake.sessions.send(repo, session.id, { text: "Is this still small?" });
  await fake.sessions.settled(turn);
}

/** The feature's card, once drawn. */
async function featureCard() {
  return within(await screen.findByRole("region", { name: "Make this change a feature" }));
}

/** US4: the agent's offer to make a change a feature. */
test("Keep it a change closes the feature's card and writes nothing", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await featureOffered(fake, repo);
  const { calls, fetch } = counting(repo, fake, "feature.promote");
  await renderPage(`/f/${CHANGE}/session`, repo, { agent: fake, fetch });

  const shown = await featureCard();
  expect(shown.getByText(REASON)).toBeTruthy();
  expect(shown.getByRole("button", { name: "Make it a feature" })).toBeTruthy();
  await click(shown.getByRole("button", { name: "Keep it a change" }));

  await waitFor(() =>
    expect(screen.queryByRole("region", { name: "Make this change a feature" })).toBeNull(),
  );
  expect(log().textContent).toContain(REASON);
  expect(calls.count).toBe(0);
  expect(git(repo, "branch", "--list", CHANGE)).toBe("");
});

/** US4 more 2 */
test("a change with a pull request says so under the feature's card", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await featureOffered(fake, repo);
  await fakeGh(repo, [
    {
      headRefName: `change/${CHANGE}`,
      isDraft: false,
      number: 7,
      reviewDecision: "",
      url: "https://github.com/o/r/pull/7",
    },
  ]);
  await renderPage(`/f/${CHANGE}/session`, repo, { agent: fake });

  const shown = await featureCard();
  await click(shown.getByRole("button", { name: "Make it a feature" }));

  expect(
    await shown.findByText(
      "This change has a pull request: close it first, since its branch would be renamed",
    ),
  ).toBeTruthy();
  expect(git(repo, "branch", "--list", "--format=%(refname:short)", `change/${CHANGE}`)).toBe(
    `change/${CHANGE}\n`,
  );
});

/**
 * A `gh` on the PATH that lists `pulls` as the open pull requests, read once into the binding's
 * snapshot of `repo`, as `feature-page.test.tsx` fakes it.
 */
async function fakeGh(repo: string, pulls: Array<Record<string, unknown>>) {
  const bin = temporaryFolder("uraeda-gh");
  const gh = join(bin, "gh");
  writeFileSync(gh, `#!/bin/sh\necho '${JSON.stringify(pulls)}'\n`);
  chmodSync(gh, 0o755);
  const path = process.env.PATH;
  process.env.PATH = `${bin}:${path ?? ""}`;
  onTestFinished(() => {
    process.env.PATH = path;
  });
  await refreshPullRequests(repo);
}

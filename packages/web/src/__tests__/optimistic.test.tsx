// fate's optimistic results under live updates, through its real client and the server in process:
// a note added at once stays shown while the inbox's live update and a refresh come in, and the
// add's refusal takes it back out, leaving the inbox as the server last sent it.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { FateClient, useFateClient } from "react-fate";
import { expect, test } from "vite-plus/test";
import { fateClients } from "../clients.ts";
import { INBOX_ID, useInbox } from "../data.ts";
import { InboxView } from "../views.ts";
import { fixtureRepo, git, quiet, repositoryName, serverFetch } from "./helpers.tsx";
import { liveSource } from "./live-source.ts";

const PATH = "specs/INBOX.md";

/** The add the test holds: `add` sends it, and it reaches the server once `release` is called. */
type Held = { add: (text: string) => Promise<{ error?: unknown }> };

/** The inbox's notes, one item each, and the hold of the add that `held` gets. */
function Notes({ held }: { held: (hold: Held) => void }) {
  const fate = useFateClient();
  const inbox = useInbox();
  // The added note goes last, written as the last one is, with its own text and a temporary id.
  const last = inbox.categories.at(-1)!;
  const note = (text: string) => ({
    ...last.notes.at(-1)!,
    id: "optimistic:note",
    key: "held",
    spans: [],
    text,
  });
  held({
    add: (text) =>
      fate.mutations.inbox.add({
        input: { hash: inbox.hash, text },
        optimistic: {
          categories: [
            ...inbox.categories.slice(0, -1),
            { ...last, notes: [...last.notes, note(text)] },
          ],
          id: INBOX_ID,
        },
        view: InboxView,
      }),
  });
  return (
    <ul>
      {inbox.categories.flatMap(({ notes }) =>
        notes.map(({ id, text }) => <li key={id}>{text}</li>),
      )}
    </ul>
  );
}

test("an optimistic insert survives a live refresh, and rolls back on refusal", async () => {
  const repo = fixtureRepo();
  writeFileSync(join(repo, PATH), "# Inbox\n\n- First note\n");
  git(repo, "add", "-A");
  git(repo, "commit", "--quiet", "-m", "chore: one note");
  const server = serverFetch(repo);
  // The add waits at the browser until released: what the page shows meanwhile is fate's alone.
  const release = Promise.withResolvers<void>();
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (typeof init?.body === "string" && init.body.includes('"inbox.add"')) {
      await release.promise;
    }
    return server(input, init);
  };
  const live = liveSource(fetch);
  (globalThis as { EventSource?: unknown }).EventSource = live.EventSource;
  const client = fateClients({ fetch, origin: "http://127.0.0.1:4310" })(
    await repositoryName(server),
  );
  let hold: Held | undefined;
  await act(async () =>
    render(
      <FateClient client={client}>
        <Suspense fallback={<p>Loading</p>}>
          <Notes held={(one) => (hold = one)} />
        </Suspense>
      </FateClient>,
    ),
  );
  await screen.findByText("First note");
  await quiet();

  let added: Promise<{ error?: unknown }> | undefined;
  await act(async () => {
    added = hold!.add("Held note");
  });
  expect(screen.getByText("Held note")).toBeTruthy();

  // A change made elsewhere: the server's watcher sends the inbox's live update. The optimistic
  // result holds the whole of `categories`, so the page shows the other note once the add settles.
  writeFileSync(join(repo, PATH), "# Inbox\n\n- First note\n- Note from elsewhere\n");
  await act(() => live.arrived("Note from elsewhere"));
  expect(screen.getByText("Held note")).toBeTruthy();
  // The page coming back to the foreground reads the inbox again: the note stays.
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await quiet();
  expect(screen.getByText("Held note")).toBeTruthy();

  // The add was made over the inbox as it was: the server refuses it, and fate takes it back.
  release.resolve();
  let result: { error?: unknown } | undefined;
  await act(async () => {
    result = await added;
  });
  expect(result?.error).toBeDefined();
  await waitFor(() => expect(screen.queryByText("Held note")).toBeNull());
  expect(screen.getByText("First note")).toBeTruthy();
  expect(screen.getByText("Note from elsewhere")).toBeTruthy();
});

// A job's switch is optimistic (review 05, Codex P2, and the UI's optimistic writes): it shows its
// new value at once, the write runs behind it, `p` twice pauses and then resumes, and a refused
// write puts the value back. Through fate's real client and the server in process, the write held
// at the browser, so what the page shows meanwhile is fate's alone.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { act, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { FateClient } from "react-fate";
import { expect, test } from "vite-plus/test";
import { fateClients } from "../clients.ts";
import { useJobActions, useJobs } from "../jobs/useJobs.ts";
import { RepositoryContext } from "../routes.tsx";
import { fixtureRepo, quiet, serverFetch } from "./helpers.tsx";

const JOB = (repository: string) => `[[jobs]]
name = "Dependencies"
repositories = ["${repository}"]
schedule = "daily 03:00"
prompt = "Upgrade."
`;

/** The jobs' switches as the page draws them, and a button sending the switch of the first. */
function Switches({ onWrite }: { onWrite: (write: () => Promise<string | undefined>) => void }) {
  const { jobs } = useJobs();
  const actions = useJobActions();
  onWrite(() => actions.setOn(jobs[0].name, !jobs[0].on));
  return <p>{jobs.map((job) => `${job.name} ${job.on ? "on" : "paused"}`).join(", ")}</p>;
}

test("a job's switch shows its value at once, twice over, and a refusal puts it back", async () => {
  const repo = fixtureRepo();
  const config = mkdtempSync(join(tmpdir(), "uraeda-config-"));
  const path = join(config, "config.toml");
  writeFileSync(path, JOB(basename(repo)));
  const server = serverFetch(repo, undefined, config);
  const writes: Array<string> = [];
  const release = Promise.withResolvers<void>();
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (typeof init?.body === "string" && init.body.includes('"jobs.setOn"')) {
      writes.push(init.body);
      await release.promise;
    }
    return server(input, init);
  };
  const client = fateClients({ fetch, origin: "http://127.0.0.1:4310" })(basename(repo));
  let write: (() => Promise<string | undefined>) | undefined;
  await act(async () =>
    render(
      <RepositoryContext.Provider value={basename(repo)}>
        <FateClient client={client}>
          <Suspense fallback={<p>Loading</p>}>
            <Switches onWrite={(one) => (write = one)} />
          </Suspense>
        </FateClient>
      </RepositoryContext.Provider>,
    ),
  );
  await screen.findByText("Dependencies on");
  await quiet();

  // Paused at once, before the server answers.
  let first: Promise<string | undefined> | undefined;
  await act(async () => {
    first = write!();
  });
  await screen.findByText("Dependencies paused");

  // Pressed again meanwhile: it reads the value shown, and resumes.
  let second: Promise<string | undefined> | undefined;
  await act(async () => {
    second = write!();
  });
  await screen.findByText("Dependencies on");
  await waitFor(() => expect(writes).toHaveLength(2));
  expect(writes[0]).toContain('"on":false');
  expect(writes[1]).toContain('"on":true');

  // The file cannot be read when the writes reach the server: both are refused, the page shows the
  // switch as the server last sent it.
  writeFileSync(path, "[server\n");
  release.resolve();
  const answers = await act(async () => Promise.all([first, second]));
  expect(answers.every((answer) => typeof answer === "string")).toBe(true);
  await waitFor(() => expect(screen.getByText("Dependencies on")).toBeTruthy());
});

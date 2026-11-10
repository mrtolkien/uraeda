// Fixtures of the job page's tests: a job as the record gives it, the agents on here, the form's
// input for that job, and the page's provider. The real components run over them, with no server.
import type { ReactNode } from "react";
import { FateClient } from "react-fate";
import type { JobRow } from "uraeda-server/fate";
import { render } from "@testing-library/react";
import { vi } from "vite-plus/test";
import { fateClients } from "../clients.ts";
import { ConfirmHost } from "../fields/Confirm.tsx";
import { JobPageView } from "../jobs/JobPage.tsx";
import { KeysProvider } from "../keys/registry.tsx";
import { RepositoryContext } from "../routes.tsx";

/** Thursday 12 November 2026, 10:30. */
export const NOW = new Date(2026, 10, 12, 10, 30);
/** The zone `NOW` is local to, which the times read in. */
export const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export const JOB: JobRow = {
  agent: "claude",
  effort: "high",
  history: [],
  index: 0,
  last: null,
  model: "opus",
  name: "Dependencies",
  next: { at: new Date(2026, 10, 13, 3).toISOString(), text: null, why: null },
  on: true,
  problem: null,
  prompt: "Upgrade the dependencies.",
  reportOnly: false,
  repositories: ["uraeda", "notes"],
  schedule: { hour: 3, kind: "daily", minute: 0 },
  scheduleText: "daily 03:00",
};

export const RUNTIMES = [
  {
    defaults: { effort: "high", model: "opus" },
    icon: "uraeda:harness-claude" as const,
    kind: "claude",
    models: [
      {
        efforts: [
          { id: "high", name: "High" },
          { id: "low", name: "Low" },
        ],
        id: "opus",
        name: "Opus",
      },
    ],
    name: "Claude Code",
  },
];

/** What a job writes: the form's input for the job as the file holds it. */
export const INPUT = {
  agent: "claude",
  effort: "high",
  model: "opus",
  name: "Dependencies",
  prompt: "Upgrade the dependencies.",
  reportOnly: false,
  repositories: ["uraeda", "notes"],
  schedule: "daily 03:00",
};

/** The agent picker reads the fate client, which only its open steps ask anything of. */
const client = fateClients({ fetch: async () => new Response("{}") })("uraeda");

export function around(children: ReactNode) {
  return (
    <RepositoryContext.Provider value="uraeda">
      <FateClient client={client}>
        <KeysProvider>
          <ConfirmHost>{children}</ConfirmHost>
        </KeysProvider>
      </FateClient>
    </RepositoryContext.Provider>
  );
}

export const common = {
  now: NOW,
  repositories: ["uraeda", "notes", "dotfiles"],
  repository: "uraeda",
  runtimes: RUNTIMES,
  zone: ZONE,
};

/** An open job's page over `job`, its writes spied; `rerender` shows it again with another job. */
export function open(
  onSave = vi.fn(async (_input: unknown, _name: string): Promise<string | undefined> => undefined),
  job: JobRow = JOB,
) {
  const onRun = vi.fn(async (): Promise<string | undefined> => undefined);
  const view = (shown: JobRow | undefined) =>
    around(
      <JobPageView
        {...common}
        handlers={{ onRun, onSave }}
        job={shown}
        name="Dependencies"
        renderCard={() => null}
      />,
    );
  const { rerender } = render(view(job));
  return { onRun, onSave, rerender: (next: JobRow) => rerender(view(next)) };
}

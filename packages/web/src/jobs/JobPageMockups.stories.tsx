// The mockups of a scheduled job's page (`specs/2026-11-10-scheduled-jobs/spec.md`): its form, each
// field saved as it is left, and its history in the repository, and a new job's form. The real page
// over fixed jobs, with no server: the stories show the look, and the page's data is the Jobs
// record's. Each write is answered at once, "Run now" included. The list of jobs is in
// `JobsMockups.stories.tsx`.
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { JobRow, JobRunView } from "uraeda-server/fate";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { atMostWidth, PHONE } from "../../.storybook/widthClass.ts";
import { CLAUDE } from "../sampleRuntimes.ts";
import { Shell } from "../Shell.tsx";
import { type CardItem, ItemCard } from "../sidebar/ItemCard.tsx";
import { JobPageView, NewJobPageView } from "./JobPage.tsx";

const nothing = () => {};

/** Thursday 12 November 2026, 10:30, the stories' now. */
const NOW = new Date(2026, 10, 12, 10, 30);
/** The zone `NOW` is local to, which the times read in. */
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute).toISOString();

const PROMPT = `Upgrade the dependencies of the Rust and the pnpm workspaces to their latest versions.

Read each changelog for breaking changes. Run \`vp run ready\`, and fix what the upgrade breaks.
Leave out an upgrade that needs a design choice, and say which.`;

/** A run of the history, newest first: a skipped time, a change's run, and a run by hand. */
const HISTORY: ReadonlyArray<JobRunView> = [
  {
    at: at(11, 3),
    blockedBy: { folder: "2026-11-10-upgrade-three", title: "Upgrade three dependencies" },
    due: at(11, 3),
    folder: null,
    id: "3",
    outcome: "skipped",
    reason: "change-open",
    session: null,
    title: null,
    trigger: "schedule",
  },
  {
    at: at(10, 3),
    blockedBy: null,
    due: at(10, 3),
    folder: "2026-11-10-upgrade-three",
    id: "2",
    outcome: "started",
    reason: null,
    session: "story-run-1",
    title: "Upgrade three dependencies",
    trigger: "schedule",
  },
  {
    at: at(9, 17, 42),
    blockedBy: null,
    due: null,
    folder: null,
    id: "1",
    outcome: "started",
    reason: null,
    session: "story-run-2",
    title: "Dependencies",
    trigger: "manual",
  },
];

/** The cards the sidebar draws for those runs' change and session. */
const CARDS: Readonly<Record<string, CardItem>> = {
  "story-run-1": {
    folder: "2026-11-10-upgrade-three",
    harness: "claude",
    kind: "change",
    label: "Upgrade three dependencies",
    pullRequest: { number: 124, url: "https://github.com/mrtolkien/uraeda/pull/124" },
    status: { label: "Needs you", status: "needs-you" },
    step: { kind: "pull-request", label: "PR ready" },
    title: "Upgrade three dependencies",
  },
  "story-run-2": {
    agent: "claude",
    folder: "story-run-2",
    kind: "session",
    label: "Dependencies",
    status: { label: "Idle", status: "idle" },
    title: "Dependencies",
  },
};

const JOB: JobRow = {
  agent: "claude",
  effort: "high",
  history: [...HISTORY],
  index: 0,
  last: HISTORY.find((run) => run.outcome === "started") ?? null,
  model: "opus",
  name: "Dependencies",
  next: { at: at(13, 3), text: null, why: null },
  on: true,
  problem: null,
  prompt: PROMPT,
  reportOnly: false,
  repositories: ["uraeda"],
  schedule: { hour: 3, kind: "daily", minute: 0 },
  scheduleText: "daily 03:00",
};

const around = {
  now: NOW,
  repositories: ["dotfiles", "notes", "uraeda"],
  repository: "uraeda",
  runtimes: [CLAUDE],
  zone: ZONE,
};

/** A job's page, over `job`: its name and Run now, its form, then its history. */
function OpenJob() {
  return (
    <Shell>
      <JobPageView
        {...around}
        handlers={{ onRun: async () => undefined, onSave: async () => undefined }}
        job={JOB}
        name="Dependencies"
        renderCard={(run) => {
          const item = run.session === null ? undefined : CARDS[run.session];
          return item && <ItemCard href="#" item={item} onOpen={nothing} onStatus={nothing} />;
        }}
      />
    </Shell>
  );
}

/** A new job's page: the empty form, ending with "Add the job". */
function NewJob() {
  return (
    <Shell>
      <NewJobPageView {...around} onSave={async () => undefined} />
    </Shell>
  );
}

const meta = {
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Mockups/Jobs/A job",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** A job's page: its form, each field saved as it is left, then its history. */
export const JobOpen: Story = { render: () => <OpenJob /> };

/** The same on the phone. */
export const JobOpenPhone: Story = { ...JobOpen, beforeEach: atMostWidth(PHONE) };

/** A new job: the same form, empty, ending with "Add the job". */
export const JobNew: Story = { render: () => <NewJob /> };

// What `startScheduler` takes, and the parts of it the scheduler's files share.
import type { Jobs } from "uraeda-binding";
import type { RepoContext } from "../fate/context.ts";
import type { Busy } from "./busy.ts";

/** What `startScheduler` takes: see it. */
export type Options = {
  /** The jobs an acceptance holds busy: a time skips them as working. Its own when left out. */
  busy?: Busy;
  context: (repo: string) => RepoContext;
  /** The switch for all jobs. */
  enabled: () => boolean;
  /** Ms between ticks, 30 seconds by default; null: the test ticks. */
  every?: number | null;
  /** Whether the `jobs` extension is on in the repository of this name. */
  isOn: (repository: string) => boolean;
  jobs: () => Promise<Jobs>;
  now?: () => Date;
  repos: () => Array<{ name: string; path: string }>;
  /** The minute between runs. */
  wait?: (ms: number) => Promise<void>;
};

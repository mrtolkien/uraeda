import { git } from "./git.ts";
import { run } from "./run-command.ts";

/** What `ura next --json` says about who is up: only the fields the loop reads. */
export type NextJson = {
  branch: string | null;
  feature: string;
  step: {
    file: string | null;
    implemented: boolean;
    name: string;
    "plan-review": boolean | null;
    reference: string | null;
    "waits-on": "agent" | "human" | "nobody";
  };
};

/** The feature's step, from `ura`, which owns who is up: the runner reads no `status:` field. */
export async function nextStep(repo: string, feature: string): Promise<NextJson> {
  const out = await run("ura", ["next", feature, "--json"], repo);
  return JSON.parse(out) as NextJson;
}

/** Whether the remote branch holds the commit the checkout's `HEAD` is at. */
export async function isPushed(repo: string, branch: string): Promise<boolean> {
  const head = (await git(repo, ["rev-parse", "HEAD"])).trim();
  const remote = await git(repo, ["ls-remote", "origin", `refs/heads/${branch}`]);
  return remote.split("\t")[0]?.trim() === head;
}

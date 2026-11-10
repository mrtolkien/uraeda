// The sandbox's sample accounts of Claude Code, for the panes and a session's header: `default`, in
// use; `b`, signed out; and `c`, its week used up. Their folders are made up: nothing in the
// sandbox opens them.
import type { Account, AccountWindow } from "uraeda-server/runner/adapter";
import { FakeAccounts } from "uraeda-server/runner/fake";

/** A window of an account, resetting `hours` from now. */
const window = (id: string, label: string, used: number, hours: number): AccountWindow => ({
  id,
  label,
  resetsAt: new Date(Date.now() + hours * 3_600_000).toISOString(),
  used,
});

/** An account of the sample: `default` is the server's own folder, the others are `~/.claude-<name>`. */
const account = (
  name: string,
  state: Account["state"],
  windows: Array<AccountWindow>,
): Account => ({
  askedAt: Date.now(),
  id: `/sandbox/.claude${name === "default" ? "" : `-${name}`}`,
  known: windows.length > 0,
  name,
  state,
  windows,
});

/** The three sample accounts, with the problem line Settings shows for the one signed out. */
export function sampleAccounts(): FakeAccounts {
  const accounts = new FakeAccounts();
  accounts.accounts = [
    account("default", "ready", [
      window("five_hour", "5h", 0.42, 2.5),
      window("seven_day", "Week", 0.34, 80),
    ]),
    account("b", "signed-out", []),
    account("c", "ready", [window("five_hour", "5h", 0.2, 4), window("seven_day", "Week", 1, 30)]),
  ];
  accounts.problemList = ["account b is signed out, in /sandbox/.claude-b"];
  return accounts;
}

// One usage window a runtime reported, in a line and its bar: the harness's mark, the window's
// label, what is left, and when it resets; and every window the runtimes on reported, in the
// runtimes' order and then the windows'. A runtime with accounts shows each account's: on Home its
// name, then its windows, and in the sidebar one line each, its five hours alone. Home's Usage
// pane and the sidebar's allowance share them.
import { HStack } from "@astryxdesign/core/HStack";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { FIVE_HOUR_WINDOW } from "uraeda-server/limits";
import { HarnessMark } from "./HarnessMark.tsx";
import { type Runtime, useRuntimes } from "./runtimes.ts";

const styles = stylex.create({
  // A used-up window has no fill to colour: its words take the error colour. Astryx's `Text` has no
  // error colour (`fields/StatusText.tsx`).
  error: { color: colorVars["--color-error"] },
  // The reset stays whole at the end of a line: the separator never dangles alone.
  together: { whiteSpace: "nowrap" },
});

/**
 * A runtime's usage window: its label, the share used from 0 to 1, and its reset time, none while
 * the window is not open.
 */
export type Window = { label: string; resetsAt: string | null; used: number };

/** A runtime's account, as its record gives it. */
type Account = Runtime["accounts"][number];

/** A runtime's five hours among its `windows`, by identity: none when it did not report them. */
export function fiveHours<Each extends { id: string }>(windows: ReadonlyArray<Each>) {
  return windows.find((window) => window.id === FIVE_HOUR_WINDOW);
}

/** When a window resets: its time today, or its day and time on another day. */
function resets(resetsAt: string) {
  const at = new Date(resetsAt);
  const hasDay = at.toDateString() !== new Date().toDateString();
  return at.toLocaleString([], {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    ...(hasDay ? { weekday: "short" } : {}),
  });
}

/**
 * A window's bar and line. `isCompact`, the sidebar's, says what is left and the reset alone, "5h
 * 58% · 04:33", on one line at the sidebar's width, so two agents' windows leave the navigation its
 * room; its whole line is its title.
 */
export function UsageWindow({
  isCompact = false,
  kind,
  window,
}: {
  isCompact?: boolean;
  kind: string;
  window: Window;
}) {
  const remaining = Math.min(100, Math.max(0, 100 - window.used * 100));
  const name = window.label;
  const left = Math.round(remaining);
  const at = window.resetsAt === null ? null : resets(window.resetsAt);
  return (
    <VStack
      gap={1}
      {...(isCompact
        ? { title: `${name}: ${left}% left${at === null ? "" : `, reset ${at}`}` }
        : {})}
    >
      <ProgressBar
        isLabelHidden
        label={`${name} allowance remaining`}
        value={remaining}
        variant={remaining <= 20 ? "error" : "accent"}
      />
      <HStack align="center" gap={2}>
        <HarnessMark isDecorative kind={kind} />
        <Text
          color="secondary"
          hasTabularNumbers
          type="supporting"
          {...(left === 0 ? { xstyle: styles.error } : {})}
        >
          {isCompact ? `${name} ${left}%` : `${name} ${left}% left`}
          {at !== null && window.resetsAt !== null && (
            <>
              {" "}
              <span {...stylex.props(styles.together)}>
                {isCompact ? "· " : "- reset "}
                <time dateTime={window.resetsAt}>{at}</time>
              </span>
            </>
          )}
        </Text>
      </HStack>
    </VStack>
  );
}

/** The runtimes on here that reported usage windows, or list accounts, in their order. */
export function useReportedRuntimes(): ReadonlyArray<Runtime> {
  return useRuntimes().filter(
    (runtime) => runtime.isOn && (runtime.usage.length > 0 || runtime.accounts.length > 0),
  );
}

/** Whether an account can show windows: signed in. A signed-out or missing one shows none. */
const isReady = (account: Account) => account.state === "ready";

/** What a signed-out or missing account's line says after its name. */
const trouble = (account: Account) => (account.state === "missing" ? "no folder" : "signed out");

/** An account's line, its name alone beside its harness's mark, in the sidebar's text. */
function AccountLine({ kind, text }: { kind: string; text: string }) {
  return (
    <HStack align="center" gap={2}>
      <HarnessMark isDecorative kind={kind} />
      <Text color="secondary" type="supporting">
        {text}
      </Text>
    </HStack>
  );
}

/** Home's account: its name in a line of its own, then its windows; signed out, no bar. */
function AccountWindowsFull({ account, kind }: { account: Account; kind: string }) {
  return (
    <VStack gap={2}>
      <Text type="supporting" weight="semibold">
        {isReady(account) ? account.name : `${account.name} · ${trouble(account)}`}
      </Text>
      {isReady(account) &&
        account.windows.map((window) => (
          <UsageWindow key={window.id} kind={kind} window={window} />
        ))}
    </VStack>
  );
}

/** The sidebar's account: one line, `<name> 5h 58% · 04:33`; signed out, `<name> signed out`. */
function AccountWindowCompact({ account, kind }: { account: Account; kind: string }) {
  const [first] = account.windows;
  if (!isReady(account)) {
    return <AccountLine kind={kind} text={`${account.name} ${trouble(account)}`} />;
  }
  if (first === undefined) {
    return <AccountLine kind={kind} text={account.name} />;
  }
  return (
    <UsageWindow
      isCompact
      kind={kind}
      window={{ ...first, label: `${account.name} ${first.label}` }}
    />
  );
}

/** One runtime's lines: its accounts when it lists some, else its windows. */
function RuntimeWindows({ isCompact, runtime }: { isCompact: boolean; runtime: Runtime }) {
  const { accounts, kind } = runtime;
  if (accounts.length > 0) {
    return accounts.map((account) =>
      isCompact ? (
        <AccountWindowCompact account={account} key={account.id} kind={kind} />
      ) : (
        <AccountWindowsFull account={account} key={account.id} kind={kind} />
      ),
    );
  }
  // The sidebar shows the five hours alone, by identity, and nothing while they are not reported:
  // the week shows on Home.
  const five = isCompact ? fiveHours(runtime.usage) : undefined;
  const windows = isCompact ? (five === undefined ? [] : [five]) : runtime.usage;
  return (
    <VStack gap={2}>
      {windows.map((window) => (
        <UsageWindow isCompact={isCompact} key={window.id} kind={kind} window={window} />
      ))}
    </VStack>
  );
}

/**
 * Every window of `runtimes`, each with its harness's mark: `isCompact`, closer and shorter, one
 * line per account and its five hours alone.
 */
export function UsageWindows({
  isCompact = false,
  runtimes,
  xstyle,
}: {
  isCompact?: boolean;
  runtimes: ReadonlyArray<Runtime>;
  xstyle?: stylex.StyleXStyles;
}) {
  return (
    <VStack gap={isCompact ? 2 : 4} {...(xstyle === undefined ? {} : { xstyle })}>
      {runtimes.map((runtime) => (
        <RuntimeWindows isCompact={isCompact} key={runtime.kind} runtime={runtime} />
      ))}
    </VStack>
  );
}

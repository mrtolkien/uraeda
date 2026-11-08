// One usage window a runtime reported, in a line and its bar: the harness's mark, the window's
// label, what is left, and when it resets; and every window the runtimes on reported, in the
// runtimes' order and then the windows'. Home's Usage pane and the sidebar's allowance share them.
import { HStack } from "@astryxdesign/core/HStack";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { StyleXStyles } from "@stylexjs/stylex";
import { HarnessMark } from "./HarnessMark.tsx";
import { type Runtime, useRuntimes } from "./runtimes.ts";

/** A runtime's usage window: its label, the share used from 0 to 1, and its reset time. */
export type Window = { label: string; resetsAt: string; used: number };

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
  const at = resets(window.resetsAt);
  return (
    <VStack gap={1} {...(isCompact ? { title: `${name}: ${left}% left, reset ${at}` } : {})}>
      <ProgressBar
        isLabelHidden
        label={`${name} allowance remaining`}
        value={remaining}
        variant={remaining <= 20 ? "error" : "accent"}
      />
      <HStack align="center" gap={2}>
        <HarnessMark isDecorative kind={kind} />
        <Text color="secondary" hasTabularNumbers type="supporting">
          {isCompact ? `${name} ${left}% · ` : `${name} ${left}% left - reset `}
          <time dateTime={window.resetsAt}>{at}</time>
        </Text>
      </HStack>
    </VStack>
  );
}

/** The runtimes on here that reported usage windows, in their order. */
export function useReportedRuntimes(): ReadonlyArray<Runtime> {
  return useRuntimes().filter((runtime) => runtime.isOn && runtime.usage.length > 0);
}

/** Every window of `runtimes`, each with its harness's mark: `isCompact`, closer and shorter. */
export function UsageWindows({
  isCompact = false,
  runtimes,
  xstyle,
}: {
  isCompact?: boolean;
  runtimes: ReadonlyArray<Runtime>;
  xstyle?: StyleXStyles;
}) {
  return (
    <VStack gap={isCompact ? 2 : 3} {...(xstyle === undefined ? {} : { xstyle })}>
      {runtimes.flatMap((runtime) =>
        runtime.usage.map((window) => (
          <UsageWindow
            isCompact={isCompact}
            key={`${runtime.kind}:${window.id}`}
            kind={runtime.kind}
            window={window}
          />
        )),
      )}
    </VStack>
  );
}

// Sample 7: the status line, in each mode, over the busiest page.
import { View } from "nsh";
import { type Mode, statusLine } from "./controls";
import { busy, tag } from "./parts";
import type { Tokens } from "../../ui/tokens";

const MODES: Mode[] = ["normal", "insert", "visual", "replace"];

/** The app's own status line, as the session's sample shows it too. */
export function appStatus(v: Tokens, mode: Mode, testID?: string) {
  return statusLine(v, {
    testID,
    mode,
    place: "27:61",
    left: [
      { text: "2026-11-10-nsh-migration", icon: "git", mode: true },
      { text: "session · task 27" },
      { text: "1 working", icon: "bot", color: v.role.lightRunning },
      { text: "2 need you", icon: "alert", color: v.role.needsYou },
    ],
    right: [
      { text: "menu", key: "space" },
      { text: "keys", key: "?" },
      { text: "live · 0.9 ms", mode: true },
    ],
  });
}

export function status(v: Tokens, bare: boolean) {
  const stage = (line: ReturnType<typeof statusLine>, words: string) => (
    <View style={{ gap: 6 }}>
      {tag(v, words)}
      <View
        style={{
          padding: 17,
          overflow: "hidden",
          backgroundColor: v.role.page,
          borderWidth: 1,
          borderColor: v.role.ruleQuiet,
        }}
      >
        {busy(v, 3)}
        {line}
      </View>
    </View>
  );
  if (bare)
    return (
      <View style={{ flex: 1, padding: 32 }}>{stage(appStatus(v, "normal", "status"), "")}</View>
    );
  return (
    <View style={{ flex: 1, padding: 32, gap: 22 }}>
      {stage(
        appStatus(v, "normal", "status"),
        "The app's status line: the mode at the left, the place at the right, counts and hints on the glass.",
      )}
      {MODES.map((mode) =>
        stage(
          statusLine(v, {
            mode,
            place: "27:61",
            left: [{ text: "nsh-migration", mode: true }, { text: "session · task 27" }],
            right: [
              { text: "menu", key: "space" },
              { text: "live", mode: true },
            ],
          }),
          `${mode}: one colour says the mode at both ends, and tints the segment beside each.`,
        ),
      )}
    </View>
  );
}

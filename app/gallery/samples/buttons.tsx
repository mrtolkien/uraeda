// Sample 4: buttons and keys in every state. A picture cannot hover or press, so each state is
// drawn side by side. The first main button is the view's one main action: it breathes.
import { type JSX, View } from "nsh";
import { act, button, hint, key, type State } from "./controls";
import { busy, glass, pane, tag } from "./parts";
import type { Tokens } from "../../ui/tokens";

const STATES: State[] = ["rest", "hover", "focus", "pressed", "disabled"];

export function buttons(v: Tokens) {
  const chip = (name: string, state?: State) => (
    <View style={{ alignSelf: "flex-start" }}>{key(v, name, state)}</View>
  );
  const line = (name: string, cells: (JSX.Element | null)[]) => (
    <View style={{ flexDirection: "row", alignItems: "center", height: 44 }}>
      <View style={{ width: 120 }}>{tag(v, name)}</View>
      {cells.map((cell) => (
        <View style={{ width: 150 }}>{cell}</View>
      ))}
    </View>
  );
  return (
    <View style={{ flex: 1, padding: 32, flexDirection: "row", alignItems: "flex-start", gap: 24 }}>
      {pane(
        v,
        {
          title: "Buttons and keys",
          color: v.role.heading2,
          style: { width: 900 },
          body: { paddingHorizontal: 24, paddingVertical: 20 },
        },
        <>
          {line(
            "",
            STATES.map((state) => tag(v, state)),
          )}
          {line(
            "main",
            STATES.map((state) =>
              button(v, {
                label: "Approve",
                state,
                breathes: state === "rest",
                testID: state === "rest" ? "main-action" : undefined,
              }),
            ),
          )}
          {line(
            "tube",
            STATES.map((state) => button(v, { label: "Cancel", kind: "tube", state })),
          )}
          {line(
            "danger",
            STATES.map((state) => button(v, { label: "Delete", kind: "danger", state })),
          )}
          {line("with a key", [
            button(v, { label: "Keep it", kind: "tube", key: "esc" }),
            button(v, { label: "Keep it", kind: "tube", key: "esc", state: "hover" }),
            button(v, { label: "Send", key: "↵", state: "focus" }),
            button(v, { label: "Send", icon: "send", state: "pressed" }),
            button(v, { label: "Delete", kind: "danger", icon: "alert", state: "disabled" }),
          ])}
          {line("row action", [
            act(v, "m", "move"),
            act(v, "m", "move", "hover"),
            null,
            act(v, "m", "move", "pressed"),
            null,
          ])}
          {line("key", [chip("g"), chip("g", "hover"), null, chip("g", "pressed"), null])}
          {line("hints", [
            hint(v, "↵", "send"),
            hint(v, "ctrl+c", "stop"),
            hint(v, "@", "file"),
            hint(v, "space", "menu"),
            hint(v, "?", "keys"),
          ])}
        </>,
      )}
      <View style={{ flex: 1, gap: 20 }}>
        {pane(
          v,
          {
            title: "On a raised card",
            fill: v.role.raised,
            body: { gap: 14, paddingVertical: 20 },
          },
          <>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {button(v, { label: "Cancel", kind: "tube" })}
              {button(v, { label: "Delete", kind: "danger", icon: "alert" })}
            </View>
            <View style={{ flexDirection: "row" }}>
              {act(v, "↵", "open")}
              {act(v, "m", "move")}
              {act(v, "d", "delete")}
            </View>
          </>,
        )}
        <View
          style={{
            padding: 18,
            overflow: "hidden",
            backgroundColor: v.role.page,
            borderWidth: 1,
            borderColor: v.role.ruleQuiet,
          }}
        >
          {busy(v, 5)}
          {glass(
            v,
            { content: { padding: 14, gap: 14 } },
            <>
              {tag(v, "On glass, nothing is a filled block: its buttons are tubes.", {
                color: v.role.inkQuiet,
              })}
              <View style={{ flexDirection: "row", gap: 8 }}>
                {button(v, { label: "Keep it", kind: "tube", key: "esc" })}
                {button(v, { label: "Open", kind: "tube", state: "hover" })}
                {button(v, { label: "Delete", kind: "danger", icon: "alert" })}
              </View>
              <View style={{ flexDirection: "row" }}>
                {act(v, "u", "undo")}
                {act(v, "↵", "open", "hover")}
              </View>
            </>,
          )}
        </View>
      </View>
    </View>
  );
}

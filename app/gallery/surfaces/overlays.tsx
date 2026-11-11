// The overlays, each open over a busy page: a dialog, which is a sheet on a narrow window; a
// sheet; a popover, which stays a popover at every width; toasts, stacked from the top; an
// overlay in the corner; and a tip beside what the pointer rests on.
import { type JSX, signal, Text, View, type ViewRef } from "nsh";
import { button } from "../samples/controls";
import { busy, icon, mono, prose, tag } from "../samples/parts";
import {
  Dialog,
  Overlay,
  Pane,
  Popover,
  Sheet,
  Toast,
  Toasts,
  Tooltip,
  Well,
} from "../../ui/surfaces";
import type { Tokens } from "../../ui/tokens";

/** The page the overlays float over: a pane with the focus beside one at rest, both busy. */
function page(v: Tokens, narrow: boolean, over: JSX.Element, first?: JSX.Element) {
  return (
    <View
      style={{ flex: 1, flexDirection: "row", gap: v.space.gap.wide, padding: narrow ? 4 : 16 }}
    >
      <Pane
        focused
        running
        title="Session"
        more="· nsh-migration"
        style={{ flex: 2 }}
        body={{ gap: 8 }}
      >
        {first}
        <View style={{ flex: 1 }}>{busy(v, 60)}</View>
      </Pane>
      {narrow ? null : (
        <Pane title="Plan" more="· 61 tasks" tone={v.role.heading1} style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>{busy(v, 30)}</View>
        </Pane>
      )}
      {over}
    </View>
  );
}

/** What a confirmation holds: its words, a field, and its two answers, tubes on glass. */
function question(v: Tokens) {
  return (
    <>
      {prose(v, "Its session and its 4 uncommitted changes go with it. This cannot be undone.")}
      <Well style={{ paddingHorizontal: 9, paddingVertical: 5 }}>
        {mono(v, "Type the task's number to confirm", { color: v.role.inkFaint })}
      </Well>
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
        {button(v, { key: "esc", kind: "tube", label: "Keep it" })}
        {button(v, { icon: "alert", kind: "danger", label: "Delete" })}
      </View>
    </>
  );
}

export function dialog(v: Tokens, narrow: boolean) {
  return page(
    v,
    narrow,
    <Dialog icon={icon("alert", v.role.action)} testID="dialog" title="Delete task 27?">
      {question(v)}
    </Dialog>,
  );
}

export function sheet(v: Tokens, narrow: boolean) {
  return page(
    v,
    narrow,
    <Sheet testID="sheet" title="Outline">
      {["Summary", "What changes", "Requirements", "Open questions", "Success criteria"].map(
        (line, at) => (
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: 8,
              minHeight: narrow ? 44 : v.space.row,
            }}
          >
            {mono(v, String(at + 1), { color: v.role.inkFaint })}
            {mono(v, line)}
          </View>
        ),
      )}
    </Sheet>,
  );
}

/** A menu's rows: a popover is a menu or a selector, never content to read. */
function menu(v: Tokens, narrow: boolean) {
  const rows: Array<[string, string, boolean]> = [
    ["Claude Fable", "default", true],
    ["Claude Opus", "", false],
    ["Codex", "off here", false],
  ];
  return rows.map(([name, aside, picked]) => (
    <View
      style={{
        alignItems: "center",
        backgroundColor: picked ? v.row.selected : undefined,
        flexDirection: "row",
        gap: 8,
        minHeight: narrow ? 44 : v.space.row,
        paddingHorizontal: 8,
      }}
    >
      {icon(picked ? "check" : "ring", picked ? v.role.action : v.role.inkFaint)}
      <View style={{ flexGrow: 1 }}>{mono(v, name)}</View>
      {tag(v, aside)}
    </View>
  ));
}

export function popover(v: Tokens, narrow: boolean) {
  const anchor = signal<ViewRef | null>(null);
  return page(
    v,
    narrow,
    <Popover anchor={anchor()} name="Model" testID="popover" width={260}>
      {menu(v, narrow)}
    </Popover>,
    <View
      ref={(node: ViewRef) => anchor.set(node)}
      style={{ alignSelf: "flex-start", marginLeft: narrow ? 40 : 120 }}
    >
      {button(v, { kind: "tube", label: "Model: Claude Fable", state: "hover" })}
    </View>,
  );
}

export function toasts(v: Tokens, narrow: boolean) {
  return page(
    v,
    narrow,
    <Toasts>
      <Toast icon={icon("git", v.role.action)} testID="toast" title="Landing in git">
        {mono(v, "Approving the spec of Performance pass")}
        {tag(v, "1 more waits its turn")}
      </Toast>
      <Toast icon={icon("check", v.role.action)} title="Deleted the note">
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <View style={{ flexGrow: 1, flexShrink: 1 }}>
            {mono(v, "“Glass bar over the transcript”")}
          </View>
          {button(v, { key: "u", kind: "tube", label: "Undo" })}
        </View>
      </Toast>
    </Toasts>,
  );
}

export function corner(v: Tokens, narrow: boolean) {
  const keys: Array<[string, string]> = [
    ["f", "Find →"],
    ["n", "New →"],
    ["u", "UI →"],
    ["?", "Keyboard shortcuts…"],
  ];
  return page(
    v,
    narrow,
    <Overlay name="Leader menu" place="corner" testID="corner" title="Space">
      {keys.map(([key, word]) => (
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: 8,
            minHeight: narrow ? 44 : v.space.row,
            minWidth: 220,
          }}
        >
          <Text
            style={{
              color: v.key.text,
              fontFamily: v.type.body,
              fontSize: v.type.size,
              fontWeight: "700",
            }}
          >
            {key}
          </Text>
          {mono(v, word)}
        </View>
      ))}
    </Overlay>,
  );
}

export function tip(v: Tokens, narrow: boolean) {
  return page(
    v,
    narrow,
    null,
    <Tooltip
      text="Send the message · Ctrl+⏎"
      style={{ alignSelf: "flex-start", marginLeft: narrow ? 40 : 120, marginTop: 40 }}
    >
      <View testID="tipped">{button(v, { icon: "send", kind: "tube", label: "Send" })}</View>
    </Tooltip>,
  );
}

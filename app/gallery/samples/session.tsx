// Sample 8: a session with an agent running, in the whole app: the places and the features at the
// left, the session in the middle with the focus, what waits and the plan at the right, and the
// status line under them all.
import { type JSX, Scroll, type ScrollRef, View } from "nsh";
import { button, field, hint, row, rowBar, separator } from "./controls";
import { stuckBar } from "./glassbar";
import { pane, tag } from "./parts";
import { appStatus } from "./status";
import { BLOCKS } from "./transcript";
import type { Values } from "./values";

function places(v: Values) {
  const r = v.role;
  return pane(
    v,
    { title: "uraeda", icon: "layers", color: r.h3 },
    <>
      {row(v, { icon: "home", hue: r.accent, text: "Home", meta: "gh" })}
      {row(v, { icon: "inbox", hue: r.needs, text: "Inbox", badge: "10" })}
      {row(v, { icon: "flag", hue: r.accent2, text: "Priorities", meta: "gp" })}
      {row(v, { icon: "chat", hue: r.running, text: "Sessions", meta: "gs", selected: true })}
      {row(v, { icon: "scale", hue: r.added, text: "Decisions", meta: "gd" })}
      {row(v, { icon: "git", hue: r.removed, text: "Git", meta: "gg" })}
      {row(v, { icon: "gear", text: "Settings", meta: "g," })}
    </>,
  );
}

function features(v: Values) {
  const r = v.role;
  const group = (name: string) => tag(v, name, { fontSize: v.type.size, marginBottom: 2 });
  return pane(
    v,
    { title: "Features", more: "· 5", color: r.h2, style: { flex: 1 } },
    <>
      {group("In progress")}
      {row(v, { icon: "dot", hue: r.running, text: "nsh-migration", meta: "plan", selected: true })}
      {row(v, { icon: "dot", hue: r.running, text: "scheduled-jobs", meta: "6/9" })}
      {row(v, { icon: "alert", hue: r.needs, text: "multi-accounts", meta: "q2" })}
      {separator(v)}
      {group("Next")}
      {row(v, { icon: "ring", text: "remote-agents", meta: "spec" })}
      {row(v, { icon: "ring", text: "run-options", meta: "idea" })}
      {separator(v)}
      {group("Done this week")}
      {row(v, { icon: "check", hue: r.added, text: "color-themes", quiet: true })}
      {row(v, { icon: "check", hue: r.added, text: "vim-text", quiet: true })}
    </>,
  );
}

function session(v: Values, breathes: boolean) {
  let scroll: ScrollRef | undefined;
  // The transcript starts scrolled, so the glass bar has text under it.
  setTimeout(() => scroll?.scrollTo({ y: 118, animated: false }), 200);
  return pane(
    v,
    {
      title: "Session",
      more: "· nsh-migration · plan",
      icon: "chat",
      focused: true,
      running: true,
      style: { flex: 1 },
      body: { paddingTop: 11, paddingHorizontal: 0, paddingBottom: 1 },
    },
    <>
      <View style={{ flex: 1 }}>
        <Scroll ref={(node: ScrollRef) => (scroll = node)} style={{ flex: 1 }}>
          <View style={{ paddingTop: 40, paddingBottom: 20 }}>
            {BLOCKS.map((block) => block(v))}
          </View>
        </Scroll>
        {stuckBar(v, "bar")}
      </View>
      <View
        style={{
          marginHorizontal: 1,
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: 12,
          gap: 8,
          borderTopWidth: 1,
          borderColor: v.role.edgeQuiet,
        }}
      >
        {field(v, {
          text: "Keep the glow off list rows, they would shout",
          active: "normal",
          style: { minHeight: 56, alignItems: "flex-start" },
        })}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {hint(v, "↵", "send")}
          {hint(v, "ctrl+c", "stop")}
          {hint(v, "@", "file")}
          <View style={{ flex: 1 }} />
          {button(v, { label: "Send", icon: "send", breathes, testID: "main-action" })}
        </View>
      </View>
    </>,
  );
}

function waiting(v: Values) {
  const r = v.role;
  return pane(
    v,
    { title: "Needs you", more: "· 2", icon: "alert", needs: true },
    <>
      {row(v, { icon: "scale", hue: r.needs, text: "Approve the spec of nsh-migration" })}
      {row(v, { icon: "chat", hue: r.needs, text: "multi-accounts asks: rotate on a limit?" })}
    </>,
  );
}

function plan(v: Values) {
  const r = v.role;
  return pane(
    v,
    { title: "Plan", more: "· 61 tasks", color: r.h1, style: { flex: 1 } },
    <>
      {tag(v, "Wave 13 · surfaces and keys", { fontSize: v.type.size, marginBottom: 2 })}
      {row(v, {
        icon: "check",
        hue: r.added,
        text: "25 The design language's samples",
        quiet: true,
      })}
      {row(v, { icon: "check", hue: r.added, text: "26 Tokens, themes, and fonts", quiet: true })}
      {row(v, { icon: "dot", hue: r.running, text: "27 Surfaces", meta: "2/5", selected: true })}
      {rowBar(v, [
        ["↵", "open"],
        ["s", "session"],
        ["m", "move"],
        ["d", "delete"],
      ])}
      {row(v, { icon: "ring", text: "28 Controls" })}
      {row(v, { icon: "ring", text: "29 Lists, cards, tables, and trees" })}
      {row(v, { icon: "ring", text: "30 The text field" })}
      {row(v, { icon: "ring", text: "31 The document renderer" })}
      {row(v, { icon: "flag", hue: r.needs, text: "35 The gallery", meta: "gate" })}
    </>,
  );
}

function changes(v: Values) {
  const r = v.role;
  return pane(
    v,
    { title: "Changes", more: "· 4", icon: "git", color: r.h3 },
    <>
      {row(v, {
        icon: "file",
        hue: r.added,
        text: "app/ui/surfaces/Surface.tsx",
        meta: "+84",
        metaColor: r.added,
      })}
      {row(v, {
        icon: "file",
        hue: r.accent2,
        text: "app/ui/tokens/height.ts",
        meta: "+41",
        metaColor: r.added,
      })}
      {row(v, {
        icon: "file",
        hue: r.removed,
        text: "app/ui/surfaces/shadow.ts",
        meta: "-22",
        metaColor: r.removed,
      })}
    </>,
  );
}

/** The app, with `over` drawn above its panes: a dimmed page and its dialog. */
export function scene(v: Values, over?: JSX.Element) {
  const gap = v.space.gap.wide;
  // A title stands 12 px above its pane, in the gap: stacked panes are 6 px further apart.
  const stacked = gap - 2;
  return (
    <View
      style={{ flex: 1, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12, gap: gap + 4 }}
    >
      <View style={{ flex: 1, flexDirection: "row", gap }}>
        <View style={{ width: 250, gap: stacked }}>
          {places(v)}
          {features(v)}
        </View>
        {/* Behind an overlay that took the focus, the page's main action rests. */}
        {session(v, over === undefined)}
        <View style={{ width: 350, gap: stacked }}>
          {waiting(v)}
          {plan(v)}
          {changes(v)}
        </View>
      </View>
      {appStatus(v, "normal", "status")}
      {over}
    </View>
  );
}

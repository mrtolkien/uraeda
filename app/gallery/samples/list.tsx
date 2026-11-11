// Sample 6: lists, with a selected row and the bar of its actions.
import { View } from "nsh";
import { row, rowBar, separator } from "./controls";
import { pane, tag } from "./parts";
import type { Values } from "./values";

export function list(v: Values) {
  const r = v.role;
  const group = (name: string) => tag(v, name, { fontSize: v.type.size, marginBottom: 2 });
  return (
    <View style={{ flex: 1, padding: 32, flexDirection: "row", gap: v.space.gap.wide }}>
      {pane(
        v,
        {
          title: "uraeda",
          icon: "layers",
          color: r.h3,
          style: { width: 250, alignSelf: "flex-start" },
        },
        <>
          {row(v, { icon: "home", hue: r.accent, text: "Home", meta: "gh" })}
          {row(v, { icon: "inbox", hue: r.needs, text: "Inbox", badge: "10" })}
          {row(v, { icon: "flag", hue: r.accent2, text: "Priorities", meta: "gp" })}
          {row(v, { icon: "chat", hue: r.running, text: "Sessions", meta: "gs", selected: true })}
          {row(v, { icon: "scale", hue: r.added, text: "Decisions", meta: "gd" })}
          {row(v, { icon: "git", hue: r.removed, text: "Git", meta: "gg" })}
          {row(v, { icon: "plug", text: "Extensions", meta: "ge" })}
          {row(v, { icon: "gear", text: "Settings", meta: "g," })}
        </>,
      )}
      {pane(
        v,
        {
          title: "Features",
          more: "· 5",
          color: r.h2,
          style: { width: 300, alignSelf: "flex-start" },
        },
        <>
          {group("In progress")}
          {row(v, {
            icon: "dot",
            hue: r.running,
            text: "nsh-migration",
            meta: "plan",
            selected: true,
          })}
          {row(v, { icon: "dot", hue: r.running, text: "scheduled-jobs", meta: "6/9" })}
          {row(v, { icon: "alert", hue: r.needs, text: "multi-accounts", meta: "q2" })}
          {separator(v)}
          {group("Next")}
          {row(v, { icon: "ring", text: "remote-agents", meta: "spec" })}
          {row(v, { icon: "ring", text: "run-options", meta: "idea" })}
          {separator(v)}
          {group("Done this week")}
          {row(v, { icon: "check", hue: r.added, text: "color-themes", quiet: true })}
          {row(v, { icon: "check", hue: r.added, text: "extensions-system", quiet: true })}
          {row(v, { icon: "check", hue: r.added, text: "vim-text", quiet: true })}
        </>,
      )}
      {pane(
        v,
        {
          title: "Plan",
          more: "· 61 tasks",
          focused: true,
          style: { width: 380, alignSelf: "flex-start" },
        },
        <>
          {group("Wave 13 · surfaces and keys")}
          {row(v, {
            icon: "check",
            hue: r.added,
            text: "25 The design language's samples",
            quiet: true,
          })}
          {row(v, {
            icon: "check",
            hue: r.added,
            text: "26 Tokens, themes, and fonts",
            quiet: true,
          })}
          {row(v, {
            icon: "dot",
            hue: r.running,
            text: "27 Surfaces",
            meta: "2/5",
            selected: true,
          })}
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
          {row(v, { icon: "ring", text: "32 Keys" })}
          {row(v, { icon: "flag", hue: r.needs, text: "35 The gallery", meta: "gate" })}
        </>,
      )}
      {pane(
        v,
        {
          title: "Changes",
          more: "· 4",
          icon: "git",
          color: r.h3,
          style: { flex: 1, alignSelf: "flex-start" },
        },
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
            hue: r.accent2,
            text: "app/ui/tokens/index.ts",
            meta: "+1 -1",
            metaColor: r.text3,
          })}
          {row(v, {
            icon: "file",
            hue: r.removed,
            text: "app/ui/surfaces/shadow.ts",
            meta: "-22",
            metaColor: r.removed,
          })}
        </>,
      )}
    </View>
  );
}

// Tables, trees, and parts that fold.
import { signal, View } from "nsh";
import { Page, Part } from "../controls/parts";
import { Text } from "../../ui/controls";
import { Collapsible, createCursor, Table, Tree, type TreeNode, treeRows } from "../../ui/lists";
import { Scoped } from "./rows";

const ACCOUNTS = [
  { id: "work", name: "Work · Claude Max", runs: "41", used: "62%", reset: "Fri 09:00" },
  { id: "home", name: "Home · Claude Pro", runs: "7", used: "18%", reset: "Sat 14:00" },
  { id: "codex", name: "Codex · Plus", runs: "12", used: "Over", reset: "Tomorrow 03:00" },
];

const FILES: ReadonlyArray<TreeNode> = [
  {
    children: [
      {
        children: [
          { id: "app/ui/lists/Card.tsx", label: "Card.tsx", meta: "+180" },
          { id: "app/ui/lists/VirtualList.tsx", label: "VirtualList.tsx", meta: "+170" },
          { id: "app/ui/lists/cursor.ts", label: "cursor.ts", meta: "+150" },
        ],
        id: "app/ui/lists",
        label: "lists",
      },
      {
        children: [{ id: "app/ui/controls/icons/lucide.ts", label: "lucide.ts", meta: "+2" }],
        id: "app/ui/controls",
        label: "controls",
      },
    ],
    id: "app/ui",
    label: "app/ui",
  },
  { id: "justfile", label: "justfile", meta: "+6" },
];

/** An account's cell: its name in the ink, an account over its limit in red. */
const cell = (id: string, column: string) => {
  const row = ACCOUNTS.find((one) => one.id === id)!;
  const value = row[column as keyof typeof row];
  return (
    <Text
      bold={column === "name"}
      tone={value === "Over" ? "danger" : column === "name" ? "ink" : "quiet"}
    >
      {value}
    </Text>
  );
};

export function table(narrow: boolean) {
  const accounts = createCursor(() => ACCOUNTS, { initial: "home" });
  const folded = signal<ReadonlySet<string>>(new Set(["app/ui/controls"]));
  const files = createCursor(() => treeRows(FILES, folded()), {
    initial: "app/ui/lists/cursor.ts",
  });
  const open = signal(true);
  const shut = signal(false);
  return (
    <Page narrow={narrow}>
      <Part narrow={narrow} title="Table" wide>
        <Scoped name="Table">
          <Table
            cell={cell}
            columns={[
              { key: "name", title: "Account" },
              { align: "end", key: "runs", title: "Runs", width: 60 },
              { align: "end", key: "used", title: "Used", width: 70 },
              { align: "end", key: "reset", title: "Resets", width: 150 },
            ]}
            cursor={accounts}
          />
        </Scoped>
      </Part>
      <Part narrow={narrow} title="Tree">
        <Scoped name="Tree">
          <Tree
            cursor={files}
            folded={folded()}
            onFold={(id, fold) => {
              const next = new Set(folded());
              if (fold) {
                next.add(id);
              } else {
                next.delete(id);
              }
              folded.set(next);
            }}
          />
        </Scoped>
      </Part>
      <Part narrow={narrow} title="Collapsible">
        <View style={{ gap: 4 }}>
          <Collapsible
            count={3}
            icon="list-checks"
            onToggle={(next) => open.set(next)}
            open={open()}
            title="Tasks done"
          >
            <View style={{ gap: 2, paddingLeft: 30 }}>
              <Text tone="faint">25 The design language's samples</Text>
              <Text tone="faint">26 Tokens, themes, and fonts</Text>
              <Text tone="faint">27 Surfaces</Text>
            </View>
          </Collapsible>
          <Collapsible
            count={12}
            icon="history"
            onToggle={(next) => shut.set(next)}
            open={shut()}
            title="Older sessions"
          >
            <Text tone="faint">Twelve sessions</Text>
          </Collapsible>
          <Collapsible onToggle={() => {}} open={false} state="focus" title="Settled without you" />
        </View>
      </Part>
    </Page>
  );
}

// The inbox's panes and pages. `/inbox` is the list alone. `/inbox/<key>` keeps the list in main,
// where it was, and opens the note beside it in side: the list does not jump as a note opens, and
// `j` `k` then Enter in it open the next note in the same pane. On a phone both are one stack, and
// a note opened from the list is the pane shown, the list one tile away.
import { record } from "../../store";
import { definePane, definePlace } from "../../ui/layout";
import { InboxList } from "./InboxPane";
import { NoteView } from "./NotePane";

export const inboxList = definePane<{ repo: string }>({
  icon: "inbox",
  kind: "inbox",
  mark: ({ repo }) => {
    const inbox = record("Inbox", { repo })();
    return { count: inbox?.count, needs: inbox?.triage === "awaiting-human" };
  },
  stack: "main",
  title: "Inbox",
  view: (props) => <InboxList repo={props.args.repo} />,
});

export const inboxNote = definePane<{ key: string; repo: string }>({
  icon: "file-text",
  kind: "inbox-note",
  stack: "side",
  title: "Note",
  view: (props) => <NoteView noteKey={props.args.key} repo={props.args.repo} />,
});

definePlace("inbox", (route) => [inboxList({ repo: route.repo ?? "" })]);

definePlace("note", (route) => [
  inboxList({ repo: route.repo ?? "" }),
  inboxNote({ key: route.key, repo: route.repo ?? "" }),
]);

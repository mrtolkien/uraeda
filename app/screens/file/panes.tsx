// A workflow file's page, `/f/<folder>/<file>`: the file itself in the main stack, read at the
// measure; beside it, what helps reading it. Every file has its outline; a spec, its review and
// the decisions its branch changes; a plan, its tasks and their progress. Which panes a page has
// follows the file's name, so they are there before the file is read, and stay put.
import { definePane, definePlace, focusPane } from "../../ui/layout";
import { roundPane, roundQuestionsPane } from "../round";
import { Outline } from "./Outline";
import { fileOf, type FileArgs, tabWord } from "./read";
import { Reader } from "./Reader";
import { SpecDecisions } from "./SpecDecisions";
import { SpecReview } from "./SpecReview";
import { Tasks } from "./Tasks";

export const readerPane = definePane<FileArgs>({
  icon: "file-text",
  kind: "file-reader",
  mark: (args) => ({ needs: fileOf(args)()?.status === "awaiting-human" }),
  stack: "main",
  title: (args) => tabWord(args.name),
  view: (props) => <Reader args={props.args} onVerdict={() => focusPane(reviewPane(props.args))} />,
});

export const outlinePane = definePane<FileArgs>({
  flush: true,
  icon: "list",
  kind: "file-outline",
  stack: "side",
  title: "Outline",
  view: (props) => <Outline args={props.args} />,
});

export const tasksPane = definePane<FileArgs>({
  flush: true,
  icon: "list-checks",
  kind: "file-tasks",
  stack: "side",
  title: "Tasks",
  view: (props) => <Tasks args={props.args} />,
});

export const reviewPane = definePane<FileArgs>({
  icon: "badge-check",
  kind: "file-review",
  mark: (args) => {
    const file = fileOf(args)();
    return { count: file?.sinceReview?.parts.length, needs: file?.status === "awaiting-human" };
  },
  stack: "side",
  title: "Review",
  view: (props) => <SpecReview args={props.args} />,
});

export const decisionsPane = definePane<FileArgs>({
  icon: "scale",
  kind: "file-decisions",
  mark: (args) => ({ count: fileOf(args)()?.decisionChanges.length }),
  stack: "side",
  title: "Decisions",
  view: (props) => <SpecDecisions args={props.args} />,
});

definePlace("file", (route) => {
  const args = { folder: route.folder, name: route.name, repo: route.repo ?? "" };
  // A round of questions is answered, one question at a time, beside the list of its questions;
  // a spec or a plan waiting is reviewed in its reader, its verdict in the Review pane.
  if (/^clarifications-\d+\.md$/.test(route.name)) {
    const round = { id: `${route.folder}/${route.name}`, repo: args.repo };
    return [roundPane(round), roundQuestionsPane(round)];
  }
  if (route.name === "spec.md") {
    return [readerPane(args), reviewPane(args), outlinePane(args), decisionsPane(args)];
  }
  if (route.name === "plan.md") {
    return [readerPane(args), reviewPane(args), tasksPane(args), outlinePane(args)];
  }
  return [readerPane(args), outlinePane(args)];
});

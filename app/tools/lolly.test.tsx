// Lolly's walk, `just walk-lolly`: the mouse on a desktop (`specs/ui/personas.md`, "Lolly"), a
// project manager who clicks through the UI and types only in fields. Each step points, hovers,
// clicks, right-clicks, drags, and scrolls, never a key outside a text field, and takes a numbered
// picture after each thing done, in `target/shots/polish-17/<step>-<n>-<what>.png`. A tool to look
// at the app with, never a check: `nsh test` alone, without a display, skips every step at once.
import { type Look, type Walk, walkIn } from "./walker";

const walkStep = walkIn("../target/shots/polish-17");

/** The pause after a pointer's move, as a hand's: the hover's look has drawn. */
const REST = 250;

/** A hand on a mouse: what Lolly does, each thing she does named in the log and pictured. */
class Hand {
  constructor(readonly walk: Walk) {}

  /** Rests the pointer on what `selector` names, as she does to learn what it is. */
  async point(selector: string, what: string) {
    await this.walk.attempt(`point ${what}`, async () => {
      await this.walk.app.hover(selector);
      await this.walk.app.wait(REST);
      await this.walk.shot(`hover-${what}`);
    });
  }

  /** Points, then clicks, as she does: the hover first, the press, then what it did. */
  async click(selector: string, what: string, settle = 700) {
    await this.walk.attempt(`click ${what}`, async () => {
      await this.walk.app.hover(selector);
      await this.walk.app.wait(REST);
      await this.walk.app.press(selector);
      await this.walk.shot(`click-${what}`, settle);
    });
  }

  /** A right-click, out of habit: what menu it opens, if any, said in the log; then closed. */
  async rightClick(selector: string, what: string) {
    await this.walk.attempt(`right-click ${what}`, async () => {
      await this.walk.app.rightClick(selector);
      await this.walk.app.wait(REST);
      const menu = this.walk.app.menu();
      this.walk.log(
        `right-click ${what}: ${menu === null ? "no menu" : menu.map((one) => one.label).join(" | ")}`,
      );
      await this.walk.shot(`right-${what}`);
      if (menu !== null) await this.walk.app.closeMenu();
    });
  }

  /** Words typed into the field `selector` names, as she types them after clicking it. */
  async write(selector: string, words: string, what: string) {
    await this.walk.attempt(`write ${what}`, async () => {
      await this.walk.app.press(selector);
      await this.walk.app.type(selector, words);
      await this.walk.shot(`typed-${what}`);
    });
  }

  /** The wheel over what `selector` names, as near as the driver comes: a drag of its scroll view. */
  async wheel(selector: string, distance: number, what: string) {
    await this.walk.attempt(`wheel ${what}`, async () => {
      await this.walk.app.scroll(selector, distance);
      await this.walk.shot(`wheel-${what}`);
    });
  }

  /** A drag of what `selector` names, by `by` points. */
  async drag(selector: string, by: { x?: number; y?: number }, what: string) {
    await this.walk.attempt(`drag ${what}`, async () => {
      await this.walk.app.drag(selector, by);
      await this.walk.shot(`drag-${what}`);
    });
  }

  /** Whether `words` show, logged: what she reads, or misses. */
  reads(words: string) {
    const shown = this.walk.text().includes(words);
    this.walk.log(`${shown ? "reads" : "does not see"} “${words}”`);
    return shown;
  }

  /** The words on screen, logged once at a page: what she has to read. */
  page(what: string) {
    this.walk.log(`${what}: ${this.walk.text().split("Usage").slice(-1)[0]?.slice(0, 1500)}`);
  }
}

const step = (name: string, body: (hand: Hand) => Promise<void>, look: Look = {}) =>
  walkStep(name, (walk) => body(new Hand(walk)), look);

// Errand 1: "Start a feature". Lolly opens the app after a week away, and looks for where to write
// a proposal and how to start it.

step("01-home after a week away: where do I click", async (hand) => {
  await hand.walk.go("/r/sample/");
  await hand.walk.shot("home");
  await hand.point("text:New", "sidebar-new");
  await hand.point("text:recurring-tasks >> nth=1", "card");
  await hand.rightClick("text:recurring-tasks >> nth=1", "card");
  await hand.point("label:Fold the sidebar", "fold");
  await hand.click("label:Fold the sidebar", "fold");
  await hand.point("label:Unfold the sidebar", "unfold");
  await hand.click("label:Unfold the sidebar", "unfold");
  await hand.point("text:add a note", "status-hint");
  await hand.point("text:Inbox >> nth=0", "sidebar-inbox");
  await hand.click("text:Open the priorities", "open-priorities");
});

step("02-new writing a proposal and starting it", async (hand) => {
  await hand.walk.go("/r/sample/");
  await hand.click("text:New", "sidebar-new");
  hand.page("new");
  await hand.point("id:new-feature", "kind-feature");
  await hand.click("id:new-feature", "kind-feature");
  await hand.write(
    "id:new-composer",
    "Ask before deleting a task. Today a click on the bin deletes it at once.",
    "proposal",
  );
  await hand.point("id:new-start", "start");
  await hand.click("id:new-start", "start");
  hand.page("start dialog");
  await hand.click("id:start-confirm", "confirm", 1500);
  await hand.walk.sees("Open the feature", 30_000);
  await hand.walk.shot("landed", 1500);
  await hand.click("id:start-open", "open-feature", 1500);
  hand.page("feature");
});

// Errand 2: "Pass a gate". Lolly answers the agent's questions, then reads and approves the spec.

step("03-round answering the agent's questions", async (hand) => {
  await hand.walk.go("/r/sample/");
  await hand.click("text:web-ui >> nth=1", "needs-you-card");
  await hand.wheel("text:Goal", 900, "context");
  await hand.point("id:round-next", "first-question");
  await hand.click("id:round-next", "first-question");
  await hand.point("id:option-A", "option");
  await hand.click("id:option-A", "option");
  await hand.click("id:option-B", "option-also");
  await hand.click("id:option-B", "option-unpicked");
  await hand.write("id:round-comment", "Only on the phone.", "answer");
  for (const n of [2, 3]) {
    await hand.click("id:round-next", `next-question-${n}`);
    await hand.click("id:option-A", `option-${n}`);
  }
  await hand.click("id:round-next", "to-the-end");
  hand.page("round end");
  await hand.point("id:round-submit", "submit");
  await hand.click("id:round-submit", "submit");
  // The commit is the button's press: no confirmation comes, as with Ctrl+Enter's.
  hand.page("after");
});

step("04-spec reading and approving the spec", async (hand) => {
  await hand.walk.go("/r/sample/");
  await hand.click("text:recurring-tasks >> nth=1", "needs-you-card");
  await hand.wheel("text:Spec: Recurring tasks", 500, "down");
  await hand.point("text:Spec to review, about 25 minutes.", "part");
  await hand.click("text:Spec to review, about 25 minutes.", "part");
  await hand.rightClick("text:Spec: Recurring tasks", "title");
  await hand.drag("text:Spec to review, about 25 minutes.", { x: 150 }, "select-part");
  hand.page("comment open");
  await hand.write("id:review-comment", "Say what happens to a task done late.", "comment");
  await hand.click("text:Save the comment >> nth=0", "save-comment");
  await hand.wheel("text:Spec: Recurring tasks", 3000, "further");
  await hand.point("id:review-approve", "approve");
  await hand.click("id:review-approve", "approve", 1000);
  hand.page("after");
});

// The rest of the app, by pointer: what she meets around her errands.

step("05-inbox a note added, organised, deleted, and undone", async (hand) => {
  await hand.walk.go("/r/sample/");
  await hand.click("text:Inbox >> nth=0", "sidebar-inbox");
  await hand.write("id:inbox-new-note", "Dark mode for the calendar", "note");
  await hand.point("id:inbox-add-note", "add-note");
  await hand.click("id:inbox-add-note", "add-note", 1500);
  hand.page("inbox");
  const note = "text:We need a home icon >> nth=0";
  await hand.click(note, "note");
  await hand.rightClick(note, "note");
  await hand.point("text:Move to a category", "move");
  await hand.click("text:Move to a category", "move");
  await hand.click("text:Inbox >> nth=0", "outside-the-picker");
  await hand.point("label:Rename the category UI…", "rename-category");
  await hand.click("label:Rename the category UI…", "rename-category");
  await hand.click("text:Cancel", "cancel-rename");
  await hand.click("text:Make it a proposal", "proposal");
  await hand.wheel("text:Now >> nth=0", 400, "the-picker");
  await hand.click("text:Inbox >> nth=0", "outside-the-picker-2");
  await hand.click(note, "note-again");
  await hand.click("text:Delete", "delete", 400);
  hand.page("toast");
  await hand.point("id:undo-toast >> text:Undo", "undo");
  await hand.click("id:undo-toast >> text:Undo", "undo");
});

step("06-session talking to an agent, and scrolling back while it answers", async (hand) => {
  await hand.walk.go("/r/sample/");
  await hand.click("text:Sessions >> nth=0", "sidebar-sessions");
  hand.page("sessions");
  await hand.click("id:sessions >> text:Dark mode", "a-session", 1500);
  await hand.drag("text:Sub-agent: Review the question cards", { x: 200 }, "select-transcript");
  await hand.wheel("id:transcript", -3000, "up");
  await hand.point("id:jump-to-latest", "jump");
  await hand.click("id:jump-to-latest", "jump");
  await hand.write("id:composer", "Make the toggle remember the choice.", "message");
  await hand.point("label:Send", "send");
  await hand.click("label:Send", "send", 400);
  await hand.wheel("id:transcript", -1500, "up-while-it-answers");
  await hand.point("id:stop", "stop");
  await hand.click("id:stop", "stop");
  await hand.click("id:jump-to-latest", "jump-again");
  await hand.rightClick("id:transcript", "transcript");
});

step("07-git staging, committing, pushing", async (hand) => {
  await hand.walk.go("/r/sample/");
  await hand.click("text:Git >> nth=0", "sidebar-git");
  hand.page("git");
  await hand.point("label:Stage notes/standup.md", "stage-icon");
  await hand.click("id:git-changes >> text:README.md", "a-file");
  await hand.point("id:git-discard", "discard");
  await hand.click("id:git-discard", "discard");
  await hand.click("text:Keep them", "keep");
  await hand.click("text:Stage >> nth=0", "stage");
  await hand.write("id:git-message", "Add the notes", "message");
  await hand.point("id:git-commit", "commit");
  await hand.click("id:git-commit", "commit", 1500);
  await hand.click("text:/^Push to origin/", "push");
  hand.page("push dialog");
  await hand.click("text:Cancel", "cancel");
});

step("08-settings every kind of control", async (hand) => {
  await hand.walk.go("/r/sample/");
  await hand.click("text:Settings >> nth=0", "sidebar-settings");
  hand.page("settings");
  await hand.wheel("label:Search the settings", 800, "down");
  await hand.click("text:Keyboard", "keyboard");
  hand.page("keyboard settings");
  await hand.click("text:Settings >> nth=1", "back-to-settings");
  await hand.click("text:Runs", "runs");
  await hand.click("label:Default agent", "a-select");
  await hand.click("text:Fake agent >> nth=1", "an-option");
});

step("09-jobs adding a job", async (hand) => {
  await hand.walk.go("/r/sample/");
  await hand.click("text:Jobs >> nth=0", "sidebar-jobs");
  await hand.click("id:jobs-add", "add");
  await hand.write("id:job-name", "Weekly tidy", "name");
  await hand.write("id:job-prompt", "Tidy the imports.", "prompt");
  await hand.click("id:job-time", "time");
  await hand.click("id:job-add", "add-the-job", 1500);
});

step("10-panes arranging a page by mouse", async (hand) => {
  await hand.walk.go("/r/sample/f/2026-10-17-keyboard-shortcuts/session");
  await hand.walk.shot("session-page", 1500);
  await hand.point("label:Move the pane >> nth=0", "pane-menu");
  await hand.click("label:Move the pane >> nth=0", "pane-menu");
  hand.page("pane menu");
  await hand.click("text:Keyboard shortcuts >> nth=0", "outside-the-menu");
  await hand.drag("label:Resize the side stack", { x: -200 }, "side-edge");
  await hand.click("label:Fold the side stack", "fold-side");
  await hand.click("label:Unfold the side stack", "unfold-side");
});

step(
  "11-small a small laptop's window",
  async (hand) => {
    await hand.walk.go("/r/sample/");
    await hand.walk.shot("home", 1000);
    await hand.click("text:New >> nth=0", "new");
    await hand.click("text:recurring-tasks >> nth=0", "spec");
  },
  { height: 720, width: 1280 },
);

step("12-priorities a proposal's line and its nested lines", async (hand) => {
  await hand.walk.go("/r/sample/");
  await hand.click("text:Priorities >> nth=0", "sidebar-priorities");
  hand.page("priorities");
  await hand.click("text:Claude Code runner (triggered by a git hook)", "a-proposal");
  hand.page("proposal");
  await hand.rightClick("text:Claude Code runner (triggered by a git hook) >> nth=1", "proposal");
});

step("13-decisions reading the decisions", async (hand) => {
  await hand.walk.go("/r/sample/");
  await hand.click("text:Decisions >> nth=0", "sidebar-decisions");
  hand.page("decisions");
  await hand.click("text:Agents >> nth=0", "a-decision");
  await hand.rightClick("text:Agents >> nth=1", "decision-title");
});

// Errand 3: "See it land". Lolly opens the feature whose work is done, to try it and land it.

step("15-land the finished feature, tried and landed", async (hand) => {
  await hand.walk.go("/r/sample/");
  await hand.click("text:keyboard-shortcuts >> nth=1", "needs-you-card", 1500);
  hand.page("finished feature");
  await hand.point("id:feature-next", "next-step");
  await hand.wheel("text:Keyboard shortcuts >> nth=1", 600, "down");
});

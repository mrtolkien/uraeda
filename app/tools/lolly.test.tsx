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
  await hand.point("id:option-a", "option");
  await hand.click("id:option-a", "option");
  await hand.click("id:option-b", "option-also");
  await hand.write("id:round-comment", "Only on the phone.", "answer");
  await hand.click("id:round-next", "next-question");
  await hand.click("id:option-a", "option-2");
  await hand.click("id:round-next", "next-question-2");
  await hand.click("id:option-a", "option-3");
  await hand.click("id:round-next", "to-the-end");
  hand.page("round end");
  await hand.point("id:round-submit", "submit");
  await hand.click("id:round-submit", "submit");
  hand.page("confirm");
  await hand.click("id:round-confirm", "confirm", 2000);
  hand.page("after");
});

step("04-spec reading and approving the spec", async (hand) => {
  await hand.walk.go("/r/sample/");
  await hand.click("text:recurring-tasks >> nth=1", "needs-you-card");
  await hand.wheel("text:Spec: Recurring tasks", 500, "down");
  await hand.point("text:Spec to review, about 25 minutes.", "part");
  await hand.click("text:Spec to review, about 25 minutes.", "part");
  await hand.rightClick("text:Spec: Recurring tasks", "title");
  hand.page("comment open");
  await hand.write("id:review-comment", "Say what happens to a task done late.", "comment");
  await hand.click("text:Save the comment", "save-comment");
  await hand.wheel("text:Spec: Recurring tasks", 3000, "further");
  await hand.point("id:review-approve", "approve");
  await hand.click("id:review-approve", "approve", 1000);
  hand.page("confirm");
  await hand.click("text:Approve >> nth=1", "confirm", 2000);
  hand.page("after");
});

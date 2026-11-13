// The walk of one flow, `just walk-session`: the owner at the desk (`specs/ui/personas.md`, Tolki,
// who lives in the keyboard), living in a session on the sandbox: talking to an agent, watching it
// work, arranging panes, and handling its changes in Git and the editors. Keys only, at a desktop's
// width, a numbered picture after each thing done in `target/shots/polish-5/`, in light too where
// it matters. A tool to look at the app with, run again after a fix, never part of a check:
// `just walk-session 03` runs the steps whose name holds `03`. The steps share one sandbox, in
// order: the chat of step 02 is the one step 03 queues in.
import { opened, walkIn } from "./walker";

const step = walkIn("../target/shots/polish-5");

step("01-list finding a chat, reading the cards", async (walk) => {
  await walk.go("/r/sample/");
  await walk.keys("g", "s");
  await walk.sees("Sessions");
  await walk.shot("sessions");
  await walk.keys("/");
  await walk.shot("search-opened");
  await walk.typed("tidy");
  await walk.shot("search-typed");
  await walk.keys("Enter");
  await walk.shot("search-entered");
  await walk.keys("Escape");
  await walk.shot("search-left");
  await walk.keys("j");
  await walk.shot("moved");
});

step(
  "01b-list in light",
  async (walk) => {
    await walk.go("/r/sample/sessions");
    await walk.app.wait(2000);
    await walk.shot("sessions");
  },
  { theme: "light" },
);

step("02-chat a message, the reply streamed at length", async (walk) => {
  await walk.go("/r/sample/sessions");
  await walk.app.wait(1500);
  await walk.keys("/");
  await walk.typed("README");
  await walk.keys("Enter");
  await walk.shot("found");
  await walk.keys("Enter");
  await walk.app.wait(2000);
  await walk.shot("opened");
  await walk.keys("i");
  await walk.shot("composer-focused");
  await walk.typed("Explain the store at length, with code");
  await walk.shot("typed");
  await walk.keys("Enter");
  await walk.shot("sent", 300);
  await walk.shot("streaming-1", 2500);
  await walk.shot("streaming-2", 4000);
  // Up, away from the end, while it streams: the reader stays where they are.
  await walk.keys("Escape", "k", "k", "k", "k", "k", "ctrl+u", "ctrl+u");
  await walk.shot("scrolled-up", 200);
  await walk.shot("scrolled-up-later", 2500);
  await walk.keys("G");
  await walk.shot("jumped", 400);
  await walk.shot("following", 2500);
  await walk.shot("following-later", 4000);
});

step("03-queue a second message while it replies, a stop, with Vim on", async (walk) => {
  await walk.go("/r/sample/settings");
  await walk.app.wait(1500);
  await walk.keys("/");
  await walk.typed("vim");
  await walk.keys("Enter");
  await walk.shot("settings-vim");
  await walk.keys("j", "Enter");
  await walk.shot("vim-toggled");
  await walk.go("/r/sample/sessions");
  await walk.app.wait(1500);
  await walk.keys("/");
  await walk.typed("README");
  await walk.keys("Enter", "Enter");
  await walk.app.wait(2000);
  await walk.keys("i");
  await walk.shot("vim-insert");
  await walk.typed("Now tell me slowly about the tests");
  await walk.keys("Escape");
  await walk.shot("vim-normal");
  await walk.keys("Enter");
  await walk.shot("vim-normal-enter");
  await walk.keys("i", "Enter");
  await walk.shot("slow-reply", 3000);
  await walk.keys("i");
  await walk.typed("And the imports?");
  await walk.shot("second-typed");
  await walk.keys("Enter");
  await walk.shot("second-sent", 500);
  await walk.keys("Escape");
  await walk.shot("left-field");
  await walk.keys("x");
  await walk.shot("stopped", 300);
  await walk.shot("stopped-later", 3000);
  await walk.shot("next-turn", 5000);
  await walk.keys("i");
  await walk.typed("Go on");
  await walk.keys("Enter");
  await walk.shot("continued", 5000);
  // Vim off again, for the steps after.
  await walk.keys("Escape", "Escape");
  await walk.go("/r/sample/settings");
  await walk.app.wait(1500);
  await walk.keys("/");
  await walk.typed("vim");
  await walk.keys("Enter", "j", "Enter");
  await walk.shot("vim-off");
});

step("04-blocked allowing an action, starting the change", async (walk) => {
  await walk.go("/r/sample/sessions");
  await walk.app.wait(1500);
  await walk.keys("/");
  await walk.typed("tidy");
  await walk.keys("Enter", "Enter");
  await walk.app.wait(2000);
  await walk.shot("blocked-chat");
  await walk.keys("G");
  await walk.shot("at-end");
  await walk.keys("a");
  await walk.shot("allow-asked");
  await walk.keys("Escape");
  await walk.shot("allow-escaped");
  await walk.keys("k");
  await walk.shot("cursor-up");
  await walk.keys("c");
  await walk.shot("change-offer");
  await walk.keys("Escape");
  await walk.shot("change-escaped");
  // The agent's own offer: `c` takes the focus to its proposal, Ctrl+Enter starts the change.
  await walk.keys("G", "c");
  await walk.shot("offer-c");
  await walk.keys("ctrl+Enter");
  await walk.shot("change-started", 3000);
  await walk.shot("change-later", 3000);
});

step(
  "04b-blocked in light",
  async (walk) => {
    await walk.go("/r/sample/sessions");
    await walk.app.wait(1500);
    await walk.keys("/");
    await walk.typed("tidy");
    await walk.keys("Enter", "Enter");
    await walk.app.wait(2000);
    await walk.keys("G");
    await walk.shot("blocked-chat");
  },
  { theme: "light" },
);

step("05-panels activity, changes, sub-agents, the plan", async (walk) => {
  await walk.go("/r/sample/f/2026-10-17-keyboard-shortcuts/session");
  await walk.app.wait(2500);
  await walk.shot("session");
  await walk.keys("l");
  await walk.shot("side-focused");
  await walk.keys("j", "j");
  await walk.shot("side-j");
  await walk.keys("k", "k", "k");
  await walk.shot("side-tabs");
  await walk.keys("l");
  await walk.shot("tab-2");
  await walk.keys("l");
  await walk.shot("tab-3");
  await walk.keys("l");
  await walk.shot("tab-4");
  await walk.keys("l");
  await walk.shot("tab-5");
});

step("06-panes arranging a session's panes by the leader", async (walk) => {
  await walk.go("/r/sample/f/2026-10-17-keyboard-shortcuts/session");
  await walk.app.wait(2500);
  await walk.keys("l", "space");
  await walk.shot("leader");
  await walk.keys("w");
  await walk.shot("pane-menu");
  await walk.motion("split", "s");
  await walk.motion("to-main", "space", "w", "H");
  await walk.motion("made-main", "space", "w", "m");
  await walk.motion("zoomed", "space", "w", "z");
  await walk.motion("unzoomed", "space", "w", "z");
  await walk.motion("one-stack", "space", "w", "o");
  await walk.motion("two-stacks", "space", "w", "o");
  await walk.motion("closed", "space", "w", "q");
  await walk.motion("brought-back", "space", "w", "u");
  await walk.keys("g", "h");
  await walk.app.wait(1500);
  await walk.go("/r/sample/f/2026-10-18-due-reminders/session");
  await walk.app.wait(2500);
  await walk.shot("other-session");
  await walk.motion("reset", "space", "w", "r");
});

step("07-long the chat of 20,000 messages", async (walk) => {
  await walk.go("/r/sample/sessions");
  await walk.app.wait(1500);
  await walk.keys("/");
  await walk.typed("very long");
  await walk.keys("Enter", "Enter");
  const readable = await walk.timed("Reply 9999");
  walk.log(`the long chat's last reply drawn after ${readable ?? "never"} ms`);
  await walk.shot("opened", 100);
  await walk.keys("g", "g");
  await walk.shot("top-at-once", 50);
  await walk.shot("top", 1500);
  await walk.keys("ctrl+d", "ctrl+d");
  await walk.shot("half-pages");
  await walk.keys("G");
  await walk.shot("end-at-once", 50);
  await walk.shot("end", 1500);
  await walk.keys("ctrl+u", "ctrl+u", "ctrl+u");
  await walk.shot("half-pages-up");
  await walk.keys("/");
  await walk.shot("search");
  await walk.typed("Reply 5000");
  await walk.keys("Enter");
  await walk.shot("searched");
});

step("08-git what the agent changed: a diff, a stage, a commit, a push", async (walk) => {
  await walk.go("/r/sample/");
  await walk.keys("g", "c");
  await walk.app.wait(2500);
  await walk.shot("git");
  await walk.keys("Enter");
  await walk.app.wait(1500);
  await walk.shot("diff");
  await walk.keys("l");
  await walk.shot("back-to-list");
  await walk.keys("s");
  await walk.shot("staged", 1200);
  await walk.keys("c");
  await walk.shot("message-field");
  await walk.typed("docs: the session's notes");
  await walk.keys("ctrl+Enter");
  await walk.shot("committed", 2500);
  await walk.keys("Escape", "P");
  await walk.shot("push-asked");
  await walk.keys("Escape");
  await walk.shot("push-escaped");
  // The rest committed, then a pull, which stops on a conflict: a side asked about (Enter keeps
  // the file), then the block taken by hand in the editor, saved, and the merge continued.
  await walk.keys("a", "c");
  await walk.typed("docs: the rest");
  await walk.keys("ctrl+Enter");
  await walk.shot("rest-committed", 2500);
  await walk.keys("Escape", "p");
  await walk.shot("pulled", 3000);
  await walk.keys("o");
  await walk.shot("side-asked");
  await walk.keys("Enter");
  await walk.shot("enter-kept");
  await walk.keys("Escape", "h");
  await walk.shot("editor-focused");
  await walk.keys("2");
  await walk.shot("block-taken");
  await walk.keys("ctrl+Enter");
  await walk.shot("saved", 2000);
  await walk.keys("l", "m");
  await walk.shot("continue-asked");
  await walk.keys("Enter");
  await walk.shot("continued", 3000);
});

step(
  "08b-git in light",
  async (walk) => {
    await walk.go("/r/sample/git");
    await walk.app.wait(2500);
    await walk.shot("git");
  },
  { theme: "light" },
);

step("09-refused a commit the hook refuses", async (walk) => {
  await walk.go("/r/broken/");
  await walk.keys("a");
  await walk.typed("A note the hook refuses");
  await walk.keys("Enter", "Escape", "g", "c");
  await walk.app.wait(2500);
  await walk.keys("s", "c");
  await walk.typed("docs: refused");
  await walk.keys("ctrl+Enter");
  await walk.shot("refused", 3000);
  await walk.keys("Escape");
  await walk.shot("refused-left");
});

step("10-buffer a file edited while an agent writes it", async (walk) => {
  await walk.go("/r/sample/f/2026-10-17-snooze-times/spec.md");
  await walk.app.wait(2000);
  await walk.keys("space", "b");
  await walk.shot("buffer");
  await walk.keys("i");
  await walk.typed("A line typed in the buffer. ");
  await walk.shot("typed");
  await walk.keys("ctrl+Enter");
  await walk.shot("saved", 1200);
  await walk.keys("i");
  await walk.typed("More typed, not saved. ");
  await walk.keys("Escape");
  await walk.shot("unsaved");
  // Another window, as an agent would, writes the same file and saves it.
  const other = await opened("../target/shots/polish-5", "10-other");
  if (other === null) return;
  try {
    await other.go("/r/sample/f/2026-10-17-snooze-times/spec.md");
    await other.app.wait(2000);
    await other.keys("space", "b", "i");
    await other.typed("Written by someone else. ");
    await other.keys("ctrl+Enter");
    await other.shot("saved-elsewhere", 1500);
  } finally {
    other.app.dispose();
  }
  await walk.shot("changed-under", 2000);
  await walk.keys("ctrl+Enter");
  await walk.shot("save-over-asked");
  await walk.keys("v");
  await walk.shot("what-changed");
  await walk.keys("Escape");
  await walk.shot("back-to-text");
  // An undo from another page: the save is undone from the inbox.
  await walk.keys("Escape", "g", "i");
  await walk.app.wait(1500);
  await walk.keys("u");
  await walk.shot("undone-elsewhere", 1500);
});

// Every screen of the app, by the module that declares its panes. A screen task adds ONE line, an
// import of its folder, under its own comment: the module's `definePlace` calls say which panes
// each page of its routes shows (`specs/ui/panes.md`), and the frame draws them. A page whose
// screen is not imported yet draws "Nothing here" in the frame, with the way home.
//
// Each line sits between two comments, so screens built at once each change their own line, and
// merge without touching another's. Keep the order: never move or join the lines.

// Task 36: the shell's own pages ("Nothing here", a repository's gates).
import "./shell/panes";
// Task 37: Home and priorities.
import "./home";
import "./priorities";
// Task 38: Proposals, and starting work.
import "./proposal";
import "./new";
// Task 39: Inbox and triage.
import "./triage";
// Task 40: The feature page.
import "./feature/panes";
// Task 41: Workflow files.
// Task 42: Rounds and reviews.
// Task 43: Sessions.
// Task 44: Session panels and runs.
// Task 45: Decisions.
import "./decisions";
// Task 46: Git.
import "./git/panes";
// Task 47: Editors.
import "./buffer";
// Task 48: Settings.
import "./settings";
// Task 49: Previews.
// Task 50: Notifications, undo, and writes.
// Task 51: Built-in extensions, and extension places.
// Task 65: The Jobs place.
// The end of the screens.

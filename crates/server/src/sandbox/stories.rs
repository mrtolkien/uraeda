//! The stories feature of "sample": a feature at its first round whose proposal and questions
//! link the stories of a Storybook, with a mockup of its own, checked out in a worktree. Its
//! preview decision runs the fake Storybook the server's preview tests run,
//! [`storybook`](super::storybook): an index of the stories files' exports, and a page for each.
//! The main checkout has no preview decision: its stories show how to set one.

use super::git::{Commit, Repo, text};
use super::texts::bytes;

/// The feature's folder, and its branch.
pub(super) const FOLDER: &str = "2026-10-20-sidebar-resize";

/// The stories file its files link, from the repository's top level.
const STORIES: &str = "packages/web/src/SidebarHandle.stories.tsx";

/// The feature's own mockup, a page of its `mockups/` folder.
const MOCKUP: &str = r#"<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>Sidebar handle</title>
<style>
  body { margin: 0; font: 15px system-ui, sans-serif; display: flex; height: 100vh; }
  nav { width: 240px; padding: 16px; background: #e8e6f0; }
  .handle { width: 6px; cursor: col-resize; background: #b4b0c8; }
  main { flex: 1; padding: 24px; }
  @media (prefers-color-scheme: dark) {
    body { background: #1e1e2e; color: #cdd6f4; }
    nav { background: #313244; }
    .handle { background: #585b70; }
  }
</style>
</head>
<body>
<nav><strong>Features</strong><p>Sidebar resize</p><p>Recurring reminders</p></nav>
<div class="handle" role="separator" aria-label="Resize the sidebar"></div>
<main><h1>Sidebar resize</h1><p>Drag the handle to resize the sidebar.</p></main>
</body>
</html>
"#;

/// Builds the feature on its branch from `main`, and checks it out in its worktree. Its
/// preview's command is `storybook`, the fake's, with the port it is given.
pub(super) fn build(repo: &Repo, storybook: &str) -> Result<(), String> {
    repo.branch(FOLDER, "main")?;
    let decision = format!(
        "---\npreview-folder: packages/web\n\
         preview-command: {storybook} --port {{port}}\n---\n\n# Preview\n\n\
         The sandbox's fake Storybook: a page for each story, and their index.\n"
    );
    let exports =
        ["Dragging", "ThinLine", "Grip"].map(|name| format!("export const {name} = {{}};\n"));
    let stories = format!(
        "export default {{ title: \"SidebarHandle\" }};\n\n{}",
        exports.concat()
    );
    let mut files = vec![
        text("specs/decisions/preview.md", decision),
        text(STORIES, stories),
        text(format!("specs/{FOLDER}/mockups/handle.html"), MOCKUP),
    ];
    for name in ["proposal.md", "clarifications-01.md"] {
        let path = format!("specs/{FOLDER}/{name}");
        files.push((
            path.clone(),
            Some(bytes(&format!("preview/feature/{path}"))?),
        ));
    }
    let message = "discovery(sidebar-resize): Sidebar resize";
    repo.commits(FOLDER, vec![Commit::new(message, None, files)])?;
    repo.worktree(FOLDER)
}

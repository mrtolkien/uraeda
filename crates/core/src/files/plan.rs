//! The tasks of a plan, and how many of their steps are checked.

use super::items::TaskItem;

/// Every task of a plan, `## Task N: title`, in order, with its checkbox steps: the same parse the
/// plan's review reads. `dir` is the folder holding the plan, from the repository's top level.
pub fn tasks(text: &str, dir: &str) -> Vec<TaskItem> {
    super::items::tasks(&super::document::parse(text, dir))
}

/// How many checkboxes of a file are checked, out of all of them, outside code blocks.
pub fn checkboxes(text: &str) -> (usize, usize) {
    let mut done = 0;
    let mut total = 0;
    for (_, line) in super::lines_outside_code(text) {
        let item = line.trim_start();
        if item.starts_with("- [ ]") {
            total += 1;
        } else if item.starts_with("- [x]") || item.starts_with("- [X]") {
            total += 1;
            done += 1;
        }
    }
    (done, total)
}

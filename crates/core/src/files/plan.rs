//! The tasks of a plan, and how many of their steps are checked.

use super::items::TaskItem;

/// Every task of a plan, `## Task N: title`, in order, with its checkbox steps: the same parse the
/// plan's review reads. `dir` is the folder holding the plan, from the repository's top level. A
/// title is as written after `Task N:`, with its markup.
pub fn tasks(text: &str, dir: &str) -> Vec<TaskItem> {
    let doc = super::document::parse(text, dir);
    let lines: Vec<&str> = text.lines().collect();
    let mut tasks = super::items::tasks(&doc);
    for task in &mut tasks {
        let line = doc.blocks[task.heading_block as usize].start_line as usize;
        if let Some((_, title)) = lines
            .get(line.wrapping_sub(1))
            .and_then(|line| super::items::task_heading(heading_text(line)))
        {
            task.title = title;
        }
    }
    tasks
}

/// An ATX heading's text, without its opening and closing `#`s.
fn heading_text(line: &str) -> &str {
    let text = line.trim().trim_start_matches('#').trim();
    let closed = text.trim_end_matches('#');
    if closed.len() < text.len() && (closed.is_empty() || closed.ends_with(' ')) {
        closed.trim_end()
    } else {
        text
    }
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

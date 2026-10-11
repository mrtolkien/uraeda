//! The tasks of a plan, and how many of their steps are checked.

/// A plan's `## Task N: title`, with its checkboxes.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Task {
    pub number: u32,
    pub title: String,
    pub done: usize,
    pub total: usize,
}

/// Every task of a plan, in order.
pub fn tasks(text: &str) -> Vec<Task> {
    let mut tasks: Vec<Task> = Vec::new();
    for (_, line) in super::lines_outside_code(text) {
        if let Some(rest) = line.strip_prefix("## Task ") {
            if let Some((number, title)) = rest.split_once(':')
                && let Ok(number) = number.trim().parse()
            {
                tasks.push(Task {
                    number,
                    title: title.trim().to_string(),
                    done: 0,
                    total: 0,
                });
            }
            continue;
        }
        if line.starts_with("## ") {
            continue;
        }
        let Some(task) = tasks.last_mut() else {
            continue;
        };
        let item = line.trim_start();
        if item.starts_with("- [ ]") {
            task.total += 1;
        } else if item.starts_with("- [x]") || item.starts_with("- [X]") {
            task.total += 1;
            task.done += 1;
        }
    }
    tasks
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

//! Codex's thread files, its rollouts, which it keeps by day.

use std::fs;
use std::path::{Path, PathBuf};

/// The names in a folder: none when it cannot be read.
fn entries(folder: &Path) -> Vec<String> {
    let Ok(entries) = fs::read_dir(folder) else {
        return Vec::new();
    };
    let names = entries.flatten().map(|entry| entry.file_name());
    names
        .map(|name| name.to_string_lossy().into_owned())
        .collect()
}

/// The date folders in a folder, as rollouts' `YYYY`, `MM`, and `DD`, the newest first.
fn newest_first(folder: &Path) -> Vec<PathBuf> {
    let mut dated: Vec<(u64, String)> = entries(folder)
        .into_iter()
        .filter(|name| !name.is_empty() && name.bytes().all(|byte| byte.is_ascii_digit()))
        .filter_map(|name| Some((name.parse().ok()?, name)))
        .collect();
    dated.sort_by_key(|(number, _)| std::cmp::Reverse(*number));
    dated
        .into_iter()
        .map(|(_, name)| folder.join(name))
        .collect()
}

/// Whether a thread has its file, `<codex home>/sessions/YYYY/MM/DD/rollout-*-<id>.jsonl`,
/// unread: day after day, the newest first, until found.
pub(super) fn has_rollout(codex_home: &Path, native_id: &str) -> bool {
    let end = format!("-{native_id}.jsonl");
    let found = |day: &PathBuf| {
        let names = entries(day);
        names
            .iter()
            .any(|name| name.starts_with("rollout-") && name.ends_with(&end))
    };
    let years = newest_first(&codex_home.join("sessions"));
    years.iter().any(|year| {
        let months = newest_first(year);
        months
            .iter()
            .any(|month| newest_first(month).iter().any(found))
    })
}

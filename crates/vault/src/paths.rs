//! The vault's paths: relative, with `/`, never leaving the vault, and the rules of the sync on
//! each: what travels to the phone, and what the phone may write.

/// The phone's plugin, in the vault: its files travel from the desktop to the phone only.
pub const PLUGIN_DIR: &str = ".obsidian/plugins/uraeda";

/// The plugin's files the sync carries: never its `data.json`, which holds each device's own
/// settings.
pub const PLUGIN_FILES: [&str; 3] = ["main.js", "manifest.json", "styles.css"];

/// Where a deletion moves a file, on either side: Obsidian's own trash folder.
pub const TRASH: &str = ".trash";

/// A relative path, cleaned: `None` for an empty one, an absolute one, one with `..` or `.`, a
/// backslash, or a NUL. Empty segments, `a//b`, are dropped.
pub fn clean(path: &str) -> Option<String> {
    if path.starts_with('/') || path.contains(['\\', '\0']) {
        return None;
    }
    let parts: Vec<&str> = path.split('/').filter(|p| !p.is_empty()).collect();
    if parts.is_empty() || parts.iter().any(|p| *p == ".." || *p == ".") {
        return None;
    }
    Some(parts.join("/"))
}

/// Whether the plugin's own file, which the desktop alone writes.
pub fn is_plugin_file(path: &str) -> bool {
    path.strip_prefix(PLUGIN_DIR)
        .and_then(|rest| rest.strip_prefix('/'))
        .is_some_and(|name| PLUGIN_FILES.contains(&name))
}

/// Whether a file travels between the desktop and the phone: every file but the hidden ones, a
/// name starting with `.`, save the plugin's own. `.obsidian/` holds each device's own settings,
/// `.trash/` what was deleted, and `ura`'s files being written are hidden until done.
pub fn is_synced(path: &str) -> bool {
    is_plugin_file(path) || !path.split('/').any(|part| part.starts_with('.'))
}

/// Whether a repository's workflow file, linked from git, read only in the vault:
/// `projects/<repository>/specs/...`.
pub fn is_read_only(path: &str) -> bool {
    let mut parts = path.split('/');
    parts.next() == Some("projects") && parts.next().is_some() && parts.next() == Some("specs")
}

/// Whether the phone may write or delete a file: one that syncs, neither the plugin's nor git's.
pub fn phone_may_write(path: &str) -> bool {
    is_synced(path) && !is_plugin_file(path) && !is_read_only(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cleans_or_refuses() {
        assert_eq!(clean("inbox//a.md").as_deref(), Some("inbox/a.md"));
        for bad in ["", "/etc/passwd", "../a", "a/../../b", "a\\b", "./a", "a\0"] {
            assert_eq!(clean(bad), None, "{bad:?}");
        }
    }

    #[test]
    fn what_syncs() {
        assert!(is_synced("inbox/a.md"));
        assert!(is_synced("projects/uraeda/specs/decisions/stack.md"));
        assert!(is_synced(".obsidian/plugins/uraeda/main.js"));
        assert!(!is_synced(".obsidian/plugins/uraeda/data.json"));
        assert!(!is_synced(".obsidian/app.json"));
        assert!(!is_synced(".trash/inbox/a.md"));
        assert!(!is_synced("inbox/.a.md.ura-tmp"));
    }

    #[test]
    fn what_the_phone_writes() {
        assert!(phone_may_write("inbox/a.md"));
        assert!(phone_may_write("wiki/apps/todoist.md"));
        assert!(phone_may_write("projects/uraeda/proposals/x.md"));
        assert!(!phone_may_write("projects/uraeda/specs/CONSTITUTION.md"));
        assert!(!phone_may_write(".obsidian/plugins/uraeda/main.js"));
        assert!(phone_may_write("projects/specs.md"));
    }
}

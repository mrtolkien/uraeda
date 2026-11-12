//! What the fake Storybook draws: its index of the stories files, its manager, and a story's
//! page.
//!
//! A story's page holds the export's name, a button counting its clicks, a disabled button
//! beside it, a separator, the colour mode it was sent, the module script `/story.js`, and the
//! skill's pick script. Its script opens Storybook's channel, beside the page, and shows
//! "Channel open" once it answers. The export `FullHeight` holds them in Storybook's root,
//! `#storybook-root`, as tall as the window, `100dvh`, as a story sized to the viewport is.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{Map, Value, json};

/// The skill's pick script, which a real Storybook loads from its preview's configuration.
pub(super) use crate::files::pick::PICK;

/// The story's own script, which counts the button's clicks and shows the mode it is sent.
pub(super) const STORY_JS: &str = r#"let clicks = 0;
document.getElementById("hide").addEventListener("click", () => {
  clicks += 1;
  document.getElementById("clicks").textContent =
    "Clicked " + clicks + (clicks === 1 ? " time" : " times");
});
const channel = new WebSocket(new URL("storybook-server-channel", location.href).href.replace(/^http/, "ws"));
channel.addEventListener("message", () => {
  const open = document.createElement("p");
  open.textContent = "Channel open";
  document.body.append(open);
}, { once: true });
window.addEventListener("message", (event) => {
  if (event.data && event.data.uraeda === "mode") {
    document.documentElement.dataset.mode = event.data.mode;
    document.getElementById("mode").textContent = "Mode: " + event.data.mode;
  }
});
"#;

/// The title a stories file gives its stories: its name before `.stories.<extension>`.
fn title(file: &Path) -> Option<&str> {
    let name = file.file_name()?.to_str()?;
    let (title, extension) = name.rsplit_once(".stories.")?;
    let lowercase = extension.chars().all(|letter| letter.is_ascii_lowercase());
    (!extension.is_empty() && lowercase).then_some(title)
}

/// The `*.stories.*` files under a folder, without `node_modules` and hidden folders.
fn story_files(folder: &Path, files: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(folder) else {
        return;
    };
    let mut paths: Vec<PathBuf> = entries.flatten().map(|entry| entry.path()).collect();
    paths.sort();
    for path in paths {
        let name = path.file_name().unwrap_or_default().to_string_lossy();
        if path.is_dir() {
            if name != "node_modules" && !name.starts_with('.') {
                story_files(&path, files);
            }
        } else if title(&path).is_some() {
            files.push(path);
        }
    }
}

/// The names a stories file exports: each `export const <name>`.
fn exports(text: &str) -> Vec<&str> {
    let named = text.split("export const ").skip(1).map(|rest| {
        let end = rest.find(|letter: char| !(letter.is_alphanumeric() || letter == '_'));
        &rest[..end.unwrap_or(rest.len())]
    });
    named.filter(|name| !name.is_empty()).collect()
}

/// The index, as Storybook's `index.json` v5, read again from the files at each request.
pub(super) fn index(folder: &Path) -> Value {
    let mut files = Vec::new();
    story_files(folder, &mut files);
    let mut entries = Map::new();
    for file in &files {
        let (Some(title), Ok(inside)) = (title(file), file.strip_prefix(folder)) else {
            continue;
        };
        let text = fs::read_to_string(file).unwrap_or_default();
        for name in exports(&text) {
            let id = format!("{title}--{name}").to_lowercase();
            let entry = json!({
                "exportName": name, "id": id, "importPath": format!("./{}", inside.display()),
                "name": name, "tags": [], "title": title, "type": "story",
            });
            entries.insert(id, entry);
        }
    }
    json!({ "entries": entries, "v": 5 })
}

/// The story page of an entry of the index, when it has that entry.
pub(super) fn story(folder: &Path, id: &str) -> Option<String> {
    let index = index(folder);
    let name = index["entries"][id]["exportName"].as_str()?;
    let root = if name == "FullHeight" {
        r#"<div id="storybook-root" style="height: 100dvh">"#
    } else {
        "<div>"
    };
    Some(format!(
        r#"<!doctype html>
<html lang="en" data-mode="none">
<head><meta charset="utf-8"><title>{name}</title><script src="uraeda-pick.js"></script></head>
<body>
{root}
<h1>{name}</h1>
<p id="mode">No mode</p>
<button type="button" id="hide">Hide the sidebar</button> <button type="button" disabled>Save</button>
<p id="clicks">Clicked 0 times</p>
<div role="separator" tabindex="0" style="height: 8px; background: gray"></div>
</div>
<script type="module" src="story.js"></script>
</body>
</html>
"#
    ))
}

/// Storybook's own interface: the stories' list, and the story `path` names, framed.
pub(super) fn manager(folder: &Path, path: Option<&str>) -> String {
    let index = index(folder);
    let entries: Vec<&Value> = index["entries"]
        .as_object()
        .map(|entries| entries.values().collect())
        .unwrap_or_default();
    let text = |entry: &Value, field: &str| entry[field].as_str().unwrap_or_default().to_owned();
    let first = entries.first().map(|entry| text(entry, "id"));
    let asked = path.and_then(|path| path.strip_prefix("/story/"));
    let id = asked.map(str::to_owned).or(first).unwrap_or_default();
    let items: String = entries
        .iter()
        .map(|entry| {
            let (id, title, name) = (text(entry, "id"), text(entry, "title"), text(entry, "name"));
            format!(r#"<li><a href="?path=/story/{id}">{title} {name}</a></li>"#)
        })
        .collect();
    format!(
        r#"<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Storybook</title></head>
<body>
<nav aria-label="Stories"><ul>{items}</ul></nav>
<iframe id="storybook-preview-iframe" title="storybook-preview-iframe" src="iframe.html?id={id}&amp;viewMode=story"></iframe>
</body>
</html>
"#
    )
}

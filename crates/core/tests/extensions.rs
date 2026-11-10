use std::fs;
use std::path::Path;

use tempfile::TempDir;
use uraeda_core::api::ApiError;
use uraeda_core::extensions::{self, Extension, ExtensionProblem, Extensions, On};

/// The built-in extensions, in the order `read` lists them.
const BUILT_INS: [&str; 10] = [
    "claude",
    "codex",
    "fake",
    "inbox",
    "priorities",
    "decisions",
    "git",
    "jobs",
    "previews",
    "notifications",
];

/// A manifest with one setting, `folder`, a string defaulting to `docs`.
const WIKI: &str = r#"name = "wiki"
title = "Wiki"
description = "Browse the docs folder as a wiki."
version = "0.1.0"
api = 1
icon = "book-open"
scope = "repository"
page = "page.tsx"

[settings.folder]
type = "string"
default = "docs"
label = "Folder"
help = "The folder to browse."
"#;

fn tempdir() -> TempDir {
    TempDir::new().expect("a temporary folder")
}

/// Writes the extension folder `folder` in the config folder `config`: its manifest, and each
/// `(file, text)`.
fn extension(config: &Path, folder: &str, manifest: &str, files: &[(&str, &str)]) {
    let path = extensions::extensions_dir(config).join(folder);
    fs::create_dir_all(&path).unwrap();
    fs::write(path.join("extension.toml"), manifest).unwrap();
    for (file, text) in files {
        fs::write(path.join(file), text).unwrap();
    }
}

/// Writes Uraeda's list of repositories in `data`, with these names.
fn repositories(data: &Path, names: &[&str]) {
    let entries: Vec<String> = names
        .iter()
        .map(|name| {
            format!(
                r#"{{"name":"{name}","path":"/nowhere/{name}","openedAt":"2026-11-08T09:00:00Z"}}"#
            )
        })
        .collect();
    let json = format!(r#"{{"version":1,"repositories":[{}]}}"#, entries.join(","));
    fs::write(data.join("repositories.json"), json).unwrap();
}

fn config_text(config: &Path) -> String {
    fs::read_to_string(config.join("config.toml")).unwrap()
}

fn find<'a>(read: &'a Extensions, name: &str) -> &'a Extension {
    read.extensions
        .iter()
        .find(|extension| extension.name == name && !extension.is_built_in)
        .unwrap_or_else(|| panic!("{name} among {:?}", read.extensions))
}

fn refused(message: &str) -> ApiError {
    ApiError {
        code: "refused",
        message: message.into(),
        output: None,
    }
}

#[test]
fn settings_for_one_repository_override_the_global_ones() {
    let dir = tempdir();
    let (config, data) = (dir.path().join("config"), dir.path().join("data"));
    fs::create_dir_all(&data).unwrap();
    repositories(&data, &["uraeda", "other"]);
    extension(&config, "wiki", WIKI, &[("page.tsx", "")]);
    let file = "# Mine.\n[extensions.wiki]\nfolder = \"notes\"\n\n[extensions.wiki.repositories.uraeda]\nfolder = \"wiki\"\n";
    fs::write(config.join("config.toml"), file).unwrap();

    let settings = |repository: Option<&str>| {
        let json = extensions::settings_json(&config, "wiki", repository);
        serde_json::from_str::<serde_json::Value>(&json).unwrap()["folder"].clone()
    };
    assert_eq!(settings(Some("uraeda")), "wiki");
    assert_eq!(settings(Some("other")), "notes");
    assert_eq!(settings(None), "notes");
    assert_eq!(extensions::settings_json(&config, "nothing", None), "{}");

    let refusals = [
        (
            Some("nowhere"),
            "folder",
            "\"x\"",
            "no repository named nowhere in Uraeda's list",
        ),
        (
            Some("other"),
            "colour",
            "\"x\"",
            "wiki has no setting named colour",
        ),
        (None, "folder", "3", "folder is a string"),
    ];
    for (repository, key, value, message) in refusals {
        let written = extensions::set_setting(&config, &data, "wiki", repository, key, value);
        assert_eq!(written, Err(refused(message)), "{key} = {value}");
        assert_eq!(config_text(&config), file, "unchanged byte for byte");
    }

    extensions::set_setting(&config, &data, "wiki", Some("other"), "folder", "\"pages\"").unwrap();
    assert_eq!(settings(Some("other")), "pages");
    assert_eq!(settings(Some("uraeda")), "wiki");
    assert!(
        config_text(&config).starts_with(file),
        "{}",
        config_text(&config)
    );
    let own = || extensions::repository_settings_json(&config, "wiki");
    assert_eq!(
        own(),
        r#"{"other":{"folder":"pages"},"uraeda":{"folder":"wiki"}}"#
    );
    assert_eq!(
        extensions::repository_settings_json(&config, "nothing"),
        "{}"
    );
}

// Break: `null` refused as "folder is a string", or written, so a value for one repository could
// never go back to the shared one.
#[test]
fn a_null_value_clears_a_setting_back_to_the_shared_one() {
    let dir = tempdir();
    let (config, data) = (dir.path().join("config"), dir.path().join("data"));
    fs::create_dir_all(&data).unwrap();
    repositories(&data, &["uraeda"]);
    extension(&config, "wiki", WIKI, &[("page.tsx", "")]);
    let file = "[extensions.wiki]\nfolder = \"notes\"\n\n[extensions.wiki.repositories.uraeda]\nfolder = \"wiki\" # Mine.\n";
    fs::write(config.join("config.toml"), file).unwrap();
    let folder = |repository: Option<&str>| {
        let json = extensions::settings_json(&config, "wiki", repository);
        serde_json::from_str::<serde_json::Value>(&json).unwrap()["folder"].clone()
    };

    extensions::set_setting(&config, &data, "wiki", Some("uraeda"), "folder", "null").unwrap();
    assert_eq!(folder(Some("uraeda")), "notes");
    assert_eq!(extensions::repository_settings_json(&config, "wiki"), "{}");
    // For every repository: back to the manifest's default.
    extensions::set_setting(&config, &data, "wiki", None, "folder", "null").unwrap();
    assert_eq!(folder(None), "docs");
    assert!(
        !config_text(&config).contains("folder"),
        "{}",
        config_text(&config)
    );
}

#[test]
fn manifest_and_settings_problems() {
    let dir = tempdir();
    let config = dir.path();
    let wiki = |from: &str, to: &str| WIKI.replacen(from, to, 1);
    let rows: [(&str, String, &str, Option<u32>, bool); 9] = [
        (
            "my_wiki",
            wiki("\"wiki\"", "\"my_wiki\""),
            "name is kebab-case, like \"my-extension\"",
            Some(1),
            true,
        ),
        (
            "wika",
            WIKI.to_owned(),
            "the name \"wiki\" differs from the folder's name, \"wika\"",
            Some(1),
            true,
        ),
        (
            "team",
            wiki("\"wiki\"", "\"team\"").replacen("\"repository\"", "\"team\"", 1),
            "scope is \"global\" or \"repository\"",
            Some(7),
            true,
        ),
        (
            "no-page",
            wiki("\"wiki\"", "\"no-page\"").replacen("\"page.tsx\"", "\"missing.tsx\"", 1),
            "page names missing.tsx, which is not a file in the folder",
            Some(8),
            true,
        ),
        (
            "dated",
            wiki("\"wiki\"", "\"dated\"").replacen("\"string\"", "\"date\"", 1),
            "settings.folder: the type is bool, integer, string, or list",
            Some(11),
            true,
        ),
        (
            "typed",
            wiki("\"wiki\"", "\"typed\"").replacen("\"docs\"", "3", 1),
            "settings.folder: the default is not a string",
            Some(12),
            true,
        ),
        (
            "inbox",
            wiki("\"wiki\"", "\"inbox\""),
            "inbox is taken by a built-in extension",
            None,
            true,
        ),
        ("gone", String::new(), "folder not found", None, true),
        (
            "wiki",
            WIKI.to_owned(),
            "folder is a string, so this value is ignored",
            Some(2),
            false,
        ),
    ];
    for (folder, manifest, ..) in &rows {
        if *folder == "gone" {
            let at = extensions::extensions_dir(config);
            std::os::unix::fs::symlink(config.join("nowhere"), at.join("gone")).unwrap();
        } else {
            extension(config, folder, manifest, &[("page.tsx", "")]);
        }
    }
    fs::write(
        config.join("config.toml"),
        "[extensions.wiki]\nfolder = 3\n",
    )
    .unwrap();

    let read = extensions::read(config);
    for (folder, _, message, line, is_fatal) in rows {
        let problems = &find(&read, folder).problems;
        assert_eq!(problems.len(), 1, "{folder}: {problems:?}");
        let ExtensionProblem {
            message: found,
            line: at,
            is_fatal: fatal,
            ..
        } = &problems[0];
        assert_eq!(
            (found.as_str(), *at, *fatal),
            (message, line, is_fatal),
            "{folder}"
        );
    }
    let wiki = find(&read, "wiki");
    assert_eq!(wiki.problems[0].file, "config.toml");
    assert_eq!(wiki.problems[0].setting.as_deref(), Some("folder"));
    assert!(wiki.is_linked, "no .ura-source");
    let json = extensions::settings_json(config, "wiki", None);
    assert_eq!(json, r#"{"folder":"docs"}"#);
}

// Break: `sessions` or `uraeda` read as yours, whose plugin or page would stand in for Uraeda's.
#[test]
fn names_uraeda_keeps_are_refused_like_a_built_in() {
    let dir = tempdir();
    let config = dir.path();
    for name in ["sessions", "uraeda"] {
        let manifest = WIKI.replacen("\"wiki\"", &format!("\"{name}\""), 1);
        extension(config, name, &manifest, &[("page.tsx", "")]);
    }
    let read = extensions::read(config);
    for name in ["sessions", "uraeda"] {
        let problems = &find(&read, name).problems;
        assert_eq!(problems.len(), 1, "{name}: {problems:?}");
        assert_eq!(problems[0].message, format!("{name} is reserved by Uraeda"));
        assert!(problems[0].is_fatal);
    }
}

#[test]
fn built_ins_come_first_without_problems() {
    let dir = tempdir();
    extension(dir.path(), "wiki", WIKI, &[("page.tsx", "")]);
    extension(dir.path(), ".hidden", WIKI, &[]);
    let read = extensions::read(dir.path());
    let names: Vec<&str> = read
        .extensions
        .iter()
        .map(|extension| extension.name.as_str())
        .collect();
    let mut expected = BUILT_INS.to_vec();
    expected.push("wiki");
    assert_eq!(names, expected);
    for extension in read.extensions.iter().filter(|e| e.is_built_in) {
        assert!(extension.problems.is_empty(), "{extension:?}");
        assert_eq!(extension.api, extensions::EXTENSION_API);
        assert!(extension.on_all && extension.server.is_none() && extension.page.is_none());
    }
    let wiki = find(&read, "wiki");
    assert_eq!(wiki.scope, "repository");
    let folder = fs::canonicalize(extensions::extensions_dir(dir.path()).join("wiki")).unwrap();
    assert_eq!(wiki.folder, folder.to_string_lossy());
    let page = folder.join("page.tsx");
    assert_eq!(wiki.page.as_deref(), Some(page.to_string_lossy().as_ref()));
    assert_eq!(wiki.settings[0].default_json, "\"docs\"");
}

#[test]
fn turning_on_keeps_the_rest_of_the_file() {
    let dir = tempdir();
    let (config, data) = (dir.path().join("config"), dir.path().join("data"));
    fs::create_dir_all(&data).unwrap();
    repositories(&data, &["uraeda"]);
    extension(&config, "wiki", WIKI, &[("page.tsx", "")]);
    let file = "# Mine.\n[server]\nport = 4400 # my port\n\n[mine]\nkept = true # unknown\n";
    fs::write(config.join("config.toml"), file).unwrap();

    extensions::set_on(&config, &data, "wiki", On::Some(vec!["uraeda".into()])).unwrap();
    assert_eq!(
        config_text(&config),
        format!("{file}\n[extensions.wiki]\non = [\"uraeda\"]\n")
    );
    let wiki = find(&extensions::read(&config), "wiki").clone();
    assert!(!wiki.on_all);
    assert!(extensions::is_on(&wiki, Some("uraeda")));
    assert!(!extensions::is_on(&wiki, Some("x")));
    assert!(!extensions::is_on(&wiki, None));

    let unlisted = extensions::set_on(&config, &data, "wiki", On::Some(vec!["x".into()]));
    assert_eq!(
        unlisted,
        Err(refused("no repository named x in Uraeda's list"))
    );
    let unknown = extensions::set_on(&config, &data, "nothing", On::All);
    assert_eq!(unknown, Err(refused("no extension named nothing")));

    extensions::set_on(&config, &data, "wiki", On::All).unwrap();
    assert_eq!(
        config_text(&config),
        format!("{file}\n[extensions.wiki]\non = \"all\"\n")
    );
    let wiki = find(&extensions::read(&config), "wiki").clone();
    assert!(extensions::is_on(&wiki, None) && extensions::is_on(&wiki, Some("x")));

    extensions::set_on(&config, &data, "inbox", On::Some(Vec::new())).unwrap();
    let read = extensions::read(&config);
    let inbox = read.extensions.iter().find(|e| e.name == "inbox").unwrap();
    assert!(!extensions::is_on(inbox, Some("uraeda")));
}

#[test]
fn a_first_write_creates_the_file_with_the_nested_table() {
    let dir = tempdir();
    let (config, data) = (dir.path().join("config"), dir.path().join("data"));
    fs::create_dir_all(&data).unwrap();
    repositories(&data, &["my.repo"]);
    extension(&config, "wiki", WIKI, &[("page.tsx", "")]);
    extensions::set_setting(
        &config,
        &data,
        "wiki",
        Some("my.repo"),
        "folder",
        "\"pages\"",
    )
    .unwrap();
    let text = config_text(&config);
    assert!(
        text.ends_with("\n[extensions.wiki.repositories.\"my.repo\"]\nfolder = \"pages\"\n"),
        "{text}"
    );
    let json = extensions::settings_json(&config, "wiki", Some("my.repo"));
    assert_eq!(json, r#"{"folder":"pages"}"#);
}

#[test]
fn an_unreadable_settings_file_turns_your_extensions_off() {
    let dir = tempdir();
    let config = dir.path();
    extension(config, "wiki", WIKI, &[("page.tsx", "")]);
    fs::write(config.join("config.toml"), "[extensions.wiki]\non = [\n").unwrap();
    let read = extensions::read(config);
    let wiki = find(&read, "wiki");
    assert!(!wiki.on_all && wiki.on.is_empty(), "{wiki:?}");
    assert_eq!(wiki.problems.len(), 1, "{:?}", wiki.problems);
    let problem = &wiki.problems[0];
    assert!(
        problem
            .message
            .starts_with("config.toml cannot be read, so wiki is off: "),
        "{}",
        problem.message
    );
    assert_eq!(
        (problem.file.as_str(), problem.is_fatal),
        ("config.toml", false)
    );
    let inbox = read.extensions.iter().find(|e| e.name == "inbox").unwrap();
    assert!(inbox.on_all, "a built-in extension stays on");
}

#[test]
fn settings_file_shape_problems() {
    // The settings file, the problem on wiki's row, its line, and whether wiki is off.
    let rows: [(&str, &str, Option<u32>, bool); 4] = [
        (
            "[extensions.wiki]\non = \"none\"\n",
            "on is \"all\" or a list of repository names, so wiki is off",
            Some(2),
            true,
        ),
        (
            "[extensions.wiki]\non = [1]\n",
            "on is \"all\" or a list of repository names, so wiki is off",
            Some(2),
            true,
        ),
        (
            "extensions = 3\n",
            "extensions is a table, with a table for each extension, so it is ignored",
            Some(1),
            false,
        ),
        (
            "[extensions]\nwiki = 3\n",
            "extensions.wiki is a table, so it is ignored",
            Some(2),
            false,
        ),
    ];
    for (file, message, line, off) in rows {
        let dir = tempdir();
        let config = dir.path();
        extension(config, "wiki", WIKI, &[("page.tsx", "")]);
        fs::write(config.join("config.toml"), file).unwrap();
        let read = extensions::read(config);
        let wiki = find(&read, "wiki");
        assert_eq!(wiki.problems.len(), 1, "{file}: {:?}", wiki.problems);
        let problem = &wiki.problems[0];
        assert_eq!(
            (problem.message.as_str(), problem.line, problem.is_fatal),
            (message, line, false),
            "{file}"
        );
        assert_eq!(!wiki.on_all && wiki.on.is_empty(), off, "{file}");
    }
}

#[test]
fn a_list_default_holds_strings() {
    let dir = tempdir();
    let manifest = WIKI
        .replacen("\"string\"", "\"list\"", 1)
        .replacen("\"docs\"", "[1]", 1);
    extension(dir.path(), "wiki", &manifest, &[("page.tsx", "")]);
    let read = extensions::read(dir.path());
    let problems = &find(&read, "wiki").problems;
    assert_eq!(problems.len(), 1, "{problems:?}");
    assert_eq!(
        (
            problems[0].message.as_str(),
            problems[0].line,
            problems[0].is_fatal
        ),
        (
            "settings.folder: the default is not a list of strings",
            Some(12),
            true
        )
    );
}

#[test]
fn ura_source_records_where_it_came_from() {
    let dir = tempdir();
    let config = dir.path();
    let source = "url = \"https://example.com/wiki.git\"\ncommit = \"abc123\"\nref = \"main\"\n";
    extension(
        config,
        "wiki",
        WIKI,
        &[("page.tsx", ""), (".ura-source", source)],
    );
    let broken = WIKI.replacen("\"wiki\"", "\"notes\"", 1);
    let half = "url = \"https://example.com/notes.git\"\n";
    extension(
        config,
        "notes",
        &broken,
        &[("page.tsx", ""), (".ura-source", half)],
    );
    let read = extensions::read(config);

    let wiki = find(&read, "wiki");
    assert!(!wiki.is_linked && wiki.problems.is_empty(), "{wiki:?}");
    let found = wiki.source.as_ref().expect("a source");
    assert_eq!(
        (
            found.url.as_str(),
            found.commit.as_str(),
            found.git_ref.as_str()
        ),
        ("https://example.com/wiki.git", "abc123", "main")
    );

    let notes = find(&read, "notes");
    assert!(!notes.is_linked && notes.source.is_none(), "{notes:?}");
    assert_eq!(notes.problems.len(), 1, "{:?}", notes.problems);
    let problem = &notes.problems[0];
    assert_eq!(
        (
            problem.file.as_str(),
            problem.message.as_str(),
            problem.is_fatal
        ),
        (
            ".ura-source",
            ".ura-source needs a url, a commit, and a ref",
            false
        )
    );
}

#[test]
fn turning_on_keeps_repositories_already_on() {
    let dir = tempdir();
    let (config, data) = (dir.path().join("config"), dir.path().join("data"));
    fs::create_dir_all(&data).unwrap();
    repositories(&data, &["uraeda"]);
    extension(&config, "wiki", WIKI, &[("page.tsx", "")]);
    fs::write(
        config.join("config.toml"),
        "[extensions.wiki]\non = [\"gone\"]\n",
    )
    .unwrap();

    let names = |names: &[&str]| On::Some(names.iter().map(|name| (*name).to_owned()).collect());
    extensions::set_on(&config, &data, "wiki", names(&["gone", "uraeda"])).unwrap();
    let wiki = find(&extensions::read(&config), "wiki").clone();
    assert_eq!(wiki.on, ["gone", "uraeda"]);
    let refused_new = extensions::set_on(&config, &data, "wiki", names(&["gone", "x"]));
    assert_eq!(
        refused_new,
        Err(refused("no repository named x in Uraeda's list"))
    );
}

#[test]
fn names_that_are_not_kebab_case_are_refused() {
    let dir = tempdir();
    let (config, data) = (dir.path().join("config"), dir.path().join("data"));
    fs::create_dir_all(&data).unwrap();
    repositories(&data, &["uraeda"]);
    extension(&config, "wiki", WIKI, &[("page.tsx", "")]);
    for name in ["", "Wiki", "my_wiki", "../wiki", "-wiki"] {
        let message = format!("{name:?} is not an extension's name, which is kebab-case");
        let on = extensions::set_on(&config, &data, name, On::All);
        assert_eq!(on, Err(refused(&message)), "{name}");
        let setting = extensions::set_setting(&config, &data, name, None, "folder", "\"x\"");
        assert_eq!(setting, Err(refused(&message)), "{name}");
        assert_eq!(extensions::settings_json(&config, name, None), "{}");
    }
    assert!(!config.join("config.toml").exists());
}
